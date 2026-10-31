import { LlmError, type LlmGenerateRequest, type LlmMessage, type LlmProvider } from "../types";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string | null }> };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string };
}

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function toGeminiRole(role: LlmMessage["role"]): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

export function createGeminiProvider(options: GeminiProviderOptions = {}): LlmProvider {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? process.env.GEMINI_MODEL ?? GEMINI_DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;

  return {
    id: "gemini",
    label: "Google Gemini",
    model,
    local: false,
    isConfigured: () => Boolean(apiKey?.trim()),

    async generate(request: LlmGenerateRequest, signal?: AbortSignal): Promise<string> {
      if (!apiKey) {
        throw new LlmError(
          "Gemini is not configured (GEMINI_API_KEY missing)",
          "gemini",
          "not_configured",
        );
      }

      const systemText = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n")
        .trim();
      const contents = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: toGeminiRole(m.role), parts: [{ text: m.content }] }));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const combined = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;

      try {
        let response: Response;
        try {
          response = await fetchImpl(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
              contents,
              generationConfig: {
                temperature: request.temperature ?? 0.2,
                maxOutputTokens: request.maxTokens ?? 1024,
                ...(request.json ? { responseMimeType: "application/json" } : {}),
              },
            }),
            signal: combined,
            cache: "no-store",
          });
        } catch {
          if (signal?.aborted) {
            throw new LlmError("Gemini request was aborted", "gemini", "aborted");
          }
          if (controller.signal.aborted) {
            throw new LlmError("Gemini request timed out", "gemini", "network");
          }
          throw new LlmError("Could not reach Gemini", "gemini", "network");
        }

        if (response.status === 429) {
          throw new LlmError("Gemini rate limit reached", "gemini", "rate_limited", 429);
        }
        if (!response.ok) {
          throw new LlmError(`Gemini request failed (${response.status})`, "gemini", "http", response.status);
        }

        let body: GeminiResponse | null = null;
        try {
          body = (await response.json()) as GeminiResponse;
        } catch {
          body = null;
        }

        const content = (body?.candidates?.[0]?.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!content) {
          throw new LlmError("Gemini returned an empty response", "gemini", "empty");
        }
        return content;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
