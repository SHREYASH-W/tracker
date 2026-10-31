import { createHash } from "node:crypto";
import type { ZodType } from "zod";
import { parseJsonLoose } from "@/lib/json";
import { TtlCache } from "@/server/providers/cache";
import { SlidingWindowRateLimiter } from "@/server/providers/rate-limit";
import { recordUsage } from "@/server/providers/usage";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createOllamaProvider } from "./providers/ollama";
import {
  LlmError,
  LlmNotConfiguredError,
  type LlmErrorCode,
  type LlmGenerateRequest,
  type LlmMessage,
  type LlmProvider,
  type LlmProviderId,
  type LlmProviderStatus,
  type LlmResult,
} from "./types";

const DEFAULT_ORDER: LlmProviderId[] = ["groq", "ollama", "gemini"];

const PROVIDER_FACTORIES: Record<LlmProviderId, () => LlmProvider> = {
  groq: () => createGroqProvider(),
  ollama: () => createOllamaProvider(),
  gemini: () => createGeminiProvider(),
};

interface CachedGeneration {
  text: string;
  provider: LlmProviderId;
  model: string;
}

interface LlmRuntime {
  chain: LlmProvider[];
  limiter: SlidingWindowRateLimiter;
  cache: TtlCache<CachedGeneration>;
}

let runtime: LlmRuntime | null = null;

/** Rebuild provider instances / limits from the current environment. */
export function resetLlmRuntime(): void {
  runtime = null;
}

function parseProviderId(value: string): LlmProviderId | null {
  const id = value.trim().toLowerCase();
  return id === "groq" || id === "ollama" || id === "gemini" ? id : null;
}

/** Primary provider first, then configured fallbacks, then anything missing. */
export function getProviderOrder(): LlmProviderId[] {
  const primary = parseProviderId(process.env.LLM_PROVIDER ?? "groq") ?? "groq";
  const fallbackEnv = process.env.LLM_FALLBACKS?.trim();
  const fallbacks = (fallbackEnv ?? "ollama,gemini")
    .split(",")
    .map(parseProviderId)
    .filter((id): id is LlmProviderId => id !== null);

  const order: LlmProviderId[] = [];
  for (const id of [primary, ...fallbacks, ...DEFAULT_ORDER]) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRuntime(): LlmRuntime {
  if (runtime) return runtime;

  const chain = getProviderOrder().map((id) => PROVIDER_FACTORIES[id]());
  const limit = parsePositiveInt(process.env.LLM_RATE_LIMIT_PER_MINUTE, 20);
  const ttlMs = parsePositiveInt(process.env.LLM_CACHE_TTL_MS, 10 * 60 * 1000);

  runtime = {
    chain,
    limiter: new SlidingWindowRateLimiter(limit, 60_000),
    cache: new TtlCache<CachedGeneration>(ttlMs, 300),
  };
  return runtime;
}

export function getLlmStatus(): {
  primary: LlmProviderId | null;
  anyConfigured: boolean;
  providers: LlmProviderStatus[];
  order: LlmProviderId[];
} {
  const { chain } = getRuntime();
  const providers = chain.map((provider, index) => ({
    id: provider.id,
    label: provider.label,
    model: provider.model,
    local: provider.local,
    configured: provider.isConfigured(),
    order: index,
  }));

  return {
    primary: providers.find((provider) => provider.configured)?.id ?? null,
    anyConfigured: providers.some((provider) => provider.configured),
    providers,
    order: chain.map((provider) => provider.id),
  };
}

export interface GenerateOptions {
  /** Operation label used for quota tracking (e.g. "query_expansion"). */
  operation: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Disable/inspect the short-lived identical-request cache. */
  useCache?: boolean;
  /** Ask the provider for strict JSON output. */
  json?: boolean;
}

export interface GenerateJsonOptions<T> extends GenerateOptions {
  schema: ZodType<T>;
}

export interface LlmJsonResult<T> extends LlmResult {
  data: T;
}

function cacheKeyFor(
  options: GenerateOptions,
  chain: LlmProvider[],
  request: LlmGenerateRequest,
): string {
  const hash = createHash("sha256");
  hash.update(options.operation);
  hash.update(
    JSON.stringify({
      messages: request.messages,
      json: request.json ?? false,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      chain: chain.map((provider) => `${provider.id}:${provider.model}`),
    }),
  );
  return hash.digest("hex");
}

async function safeRecordUsage(
  provider: LlmProvider,
  operation: string,
  ok: boolean,
): Promise<void> {
  await recordUsage({
    provider: provider.id,
    operation,
    metadata: { model: provider.model, ok },
  });
}

function toFailure(err: unknown): { code: LlmErrorCode; message: string } {
  if (err instanceof LlmError) return { code: err.code, message: err.message };
  if (err instanceof Error) return { code: "invalid_response", message: err.message };
  return { code: "invalid_response", message: "Unknown LLM failure" };
}

async function runChain<T>(
  options: GenerateOptions,
  parse: (text: string) => T,
): Promise<LlmResult & { value: T }> {
  const { chain, limiter, cache } = getRuntime();
  const configured = chain.filter((provider) => provider.isConfigured());
  if (configured.length === 0) throw new LlmNotConfiguredError();

  const request: LlmGenerateRequest = {
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    json: options.json ?? false,
  };

  const key = cacheKeyFor(options, configured, request);
  const cached = options.useCache === false ? undefined : cache.get(key);

  if (cached) {
    try {
      return {
        text: cached.text,
        provider: cached.provider,
        model: cached.model,
        cached: true,
        failures: [],
        value: parse(cached.text),
      };
    } catch {
      // Corrupt/incompatible cache entry — drop it and call the provider.
      cache.delete(key);
    }
  }

  const failures: LlmResult["failures"] = [];

  for (const provider of configured) {
    if (!limiter.tryAcquire(provider.id)) {
      failures.push({
        provider: provider.id,
        code: "rate_limited",
        message: `${provider.label} hit the local request limit — try again shortly`,
      });
      continue;
    }

    try {
      const text = await provider.generate(request, options.signal);
      await safeRecordUsage(provider, options.operation, true);

      let value: T;
      try {
        value = parse(text);
      } catch (err) {
        const failure = toFailure(err);
        failures.push({ provider: provider.id, code: failure.code, message: failure.message });
        continue;
      }

      cache.set(key, { text, provider: provider.id, model: provider.model });
      return {
        text,
        provider: provider.id,
        model: provider.model,
        cached: false,
        failures,
        value,
      };
    } catch (err) {
      await safeRecordUsage(provider, options.operation, false);
      const failure = toFailure(err);
      failures.push({ provider: provider.id, code: failure.code, message: failure.message });
      if (err instanceof LlmError && err.code === "aborted") break;
    }
  }

  const allRateLimited =
    failures.length > 0 && failures.every((failure) => failure.code === "rate_limited");
  const detail = failures.map((failure) => `${failure.provider}: ${failure.message}`).join("; ");
  throw new LlmError(
    `All LLM providers failed${detail ? ` (${detail})` : ""}`,
    "none",
    allRateLimited ? "rate_limited" : "http",
  );
}

/** Generate plain text, walking the provider fallback chain. */
export async function generateText(options: GenerateOptions): Promise<LlmResult> {
  const { value, ...result } = await runChain(options, (text) => text);
  void value;
  return result;
}

/** Generate JSON and validate it with a zod schema before accepting it. */
export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<LlmJsonResult<T>> {
  const { value, ...result } = await runChain({ ...options, json: true }, (text) => {
    const parsed = parseJsonLoose(text);
    if (parsed === null) throw new Error("LLM response did not contain JSON");

    const checked = options.schema.safeParse(parsed);
    if (!checked.success) {
      throw new Error(checked.error.errors[0]?.message ?? "LLM JSON failed validation");
    }
    return checked.data;
  });

  return { ...result, data: value };
}

export { LlmError, LlmNotConfiguredError } from "./types";
export type { LlmResult, LlmProviderStatus, LlmProviderId } from "./types";
