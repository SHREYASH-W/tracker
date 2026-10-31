export type LlmProviderId = "groq" | "ollama" | "gemini";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmGenerateRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for strict JSON output when supported. */
  json?: boolean;
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly label: string;
  readonly model: string;
  readonly local: boolean;
  isConfigured(): boolean;
  generate(request: LlmGenerateRequest, signal?: AbortSignal): Promise<string>;
}

export type LlmErrorCode =
  | "not_configured"
  | "network"
  | "http"
  | "rate_limited"
  | "empty"
  | "invalid_response"
  | "aborted";

export class LlmError extends Error {
  constructor(
    message: string,
    readonly provider: LlmProviderId | "none",
    readonly code: LlmErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export class LlmNotConfiguredError extends LlmError {
  constructor(message = "No LLM provider is configured. Add a key to .env.local or run Ollama.") {
    super(message, "none", "not_configured");
    this.name = "LlmNotConfiguredError";
  }
}

/** Result returned by the orchestrator. */
export interface LlmResult {
  text: string;
  provider: LlmProviderId;
  model: string;
  cached: boolean;
  /** Per-provider failures collected while walking the fallback chain. */
  failures: { provider: LlmProviderId; code: LlmErrorCode; message: string }[];
}

export interface LlmProviderStatus {
  id: LlmProviderId;
  label: string;
  model: string;
  local: boolean;
  configured: boolean;
  /** Position in the fallback chain (0 = primary), or -1 if not in the chain. */
  order: number;
}
