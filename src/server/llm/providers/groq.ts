import { LlmError, type LlmGenerateRequest, type LlmProvider } from "../types";

const GROQ_BASE = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-20b";

interface GroqResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

export interface GroqProviderOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createGroqProvider(options: GroqProviderOptions = {}): LlmProvider {
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
  const model = options.model ?? process.env.GROQ_MODEL ?? GROQ_DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    id: "groq",
    label: "Groq",
    model,
    local: false,
    isConfigured: () => Boolean(apiKey?.trim()),

    async generate(request: LlmGenerateRequest, signal?: AbortSignal): Promise<string> {
      if (!apiKey) {
        throw new LlmError("Groq is not configured (GROQ_API_KEY missing)", "groq", "not_configured");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const combined = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;

      try {
        let response: Response;
        try {
          response = await fetchImpl(`${GROQ_BASE}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: request.messages,
              temperature: request.temperature ?? 0.2,
              max_tokens: request.maxTokens ?? 1024,
              ...(request.json ? { response_format: { type: "json_object" } } : {}),
            }),
            signal: combined,
            cache: "no-store",
          });
        } catch (err) {
          if (signal?.aborted) {
            throw new LlmError("Groq request was aborted", "groq", "aborted");
          }
          if (controller.signal.aborted) {
            throw new LlmError("Groq request timed out", "groq", "network");
          }
          void err;
          throw new LlmError("Could not reach Groq", "groq", "network");
        }

        if (response.status === 429) {
          throw new LlmError("Groq rate limit reached", "groq", "rate_limited", 429);
        }
        if (!response.ok) {
          throw new LlmError(`Groq request failed (${response.status})`, "groq", "http", response.status);
        }

        let body: GroqResponse | null = null;
        try {
          body = (await response.json()) as GroqResponse;
        } catch {
          body = null;
        }

        const content = body?.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new LlmError("Groq returned an empty response", "groq", "empty");
        }
        return content;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
