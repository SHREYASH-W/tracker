import { LlmError, type LlmGenerateRequest, type LlmProvider } from "../types";

export const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434";
export const OLLAMA_DEFAULT_MODEL = "llama3.1";

interface OllamaResponse {
  message?: { content?: string | null };
  error?: string;
}

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Local Ollama provider. Enabled by default unless OLLAMA_ENABLED=false;
 * an unreachable server just fails fast and the chain moves on.
 */
export function createOllamaProvider(options: OllamaProviderOptions = {}): LlmProvider {
  const baseUrl = (options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? OLLAMA_DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const model = options.model ?? process.env.OLLAMA_MODEL ?? OLLAMA_DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const enabled = options.baseUrl !== undefined || process.env.OLLAMA_ENABLED !== "false";

  return {
    id: "ollama",
    label: "Ollama (local)",
    model,
    local: true,
    isConfigured: () => enabled,

    async generate(request: LlmGenerateRequest, signal?: AbortSignal): Promise<string> {
      if (!enabled) {
        throw new LlmError("Ollama is disabled", "ollama", "not_configured");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const combined = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;

      try {
        let response: Response;
        try {
          response = await fetchImpl(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: request.messages,
              stream: false,
              ...(request.json ? { format: "json" } : {}),
              options: {
                temperature: request.temperature ?? 0.2,
                num_predict: request.maxTokens ?? 1024,
              },
            }),
            signal: combined,
            cache: "no-store",
          });
        } catch {
          if (signal?.aborted) {
            throw new LlmError("Ollama request was aborted", "ollama", "aborted");
          }
          if (controller.signal.aborted) {
            throw new LlmError("Ollama request timed out", "ollama", "network");
          }
          throw new LlmError("Could not reach Ollama. Is it running on 127.0.0.1:11434?", "ollama", "network");
        }

        if (response.status === 429) {
          throw new LlmError("Ollama is rate limited", "ollama", "rate_limited", 429);
        }
        if (!response.ok) {
          throw new LlmError(`Ollama request failed (${response.status})`, "ollama", "http", response.status);
        }

        let body: OllamaResponse | null = null;
        try {
          body = (await response.json()) as OllamaResponse;
        } catch {
          body = null;
        }

        const content = body?.message?.content?.trim();
        if (!content) {
          throw new LlmError("Ollama returned an empty response", "ollama", "empty");
        }
        return content;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
