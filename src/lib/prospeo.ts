import type { EmailLookupResult } from "./email-lookup";

const PROSPEO_API_BASE = "https://api.prospeo.io";

export class ProspeoApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ProspeoApiError";
    this.status = status;
    this.code = code;
  }
}

interface ProspeoEmailPayload {
  status?: string | null;
  revealed?: boolean;
  email?: string | null;
}

interface ProspeoEnrichPayload {
  error?: boolean;
  error_code?: string;
  person?: {
    full_name?: string | null;
    linkedin_url?: string | null;
    current_job_title?: string | null;
    email?: ProspeoEmailPayload | null;
  } | null;
  company?: {
    name?: string | null;
    website?: string | null;
  } | null;
}

function splitFullName(fullName: string): {
  first_name?: string;
  last_name?: string;
  full_name?: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { full_name: parts[0] ?? fullName.trim() };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function mapEmailStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  switch (status.toUpperCase()) {
    case "VERIFIED":
    case "VALID":
      return "valid";
    case "ACCEPT_ALL":
    case "CATCH_ALL":
      return "accept_all";
    case "INVALID":
    case "NOT_FOUND":
      return "invalid";
    case "DISPOSABLE":
      return "disposable";
    default:
      return status.toLowerCase();
  }
}

function isRateLimitCode(code: string): boolean {
  const normalized = code.toLowerCase().replace(/[\s_-]+/g, "_");
  return normalized.includes("rate") || normalized.includes("limit");
}

function prospeoErrorMessage(code: string | undefined, status: number): string {
  if (code === "INVALID_API_KEY") {
    return "Prospeo rejected the API key. Check PROSPEO_API_KEY in .env.local.";
  }
  if (code === "INSUFFICIENT_CREDITS") {
    return "Your Prospeo account is out of credits. Add credits or use Hunter instead.";
  }
  if (code === "INVALID_DATAPOINTS") {
    return "Prospeo needs a full name and company domain for this lookup.";
  }
  if (code === "INVALID_REQUEST") {
    return "Prospeo rejected the request. Check the name and company domain.";
  }
  if (code === "INTERNAL_ERROR") {
    return "Prospeo had an internal error. Please try again later.";
  }
  if (code && isRateLimitCode(code)) {
    return "Prospeo's rate limit was reached. Try again later.";
  }
  return `Prospeo request failed (${status}).`;
}

export async function findProspeoEmail(
  input: { fullName: string; domain: string; linkedinUrl?: string | null },
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<EmailLookupResult | null> {
  const apiKey = options.apiKey ?? process.env.PROSPEO_API_KEY;
  if (!apiKey) {
    throw new ProspeoApiError(
      "Prospeo API key is not configured. Add PROSPEO_API_KEY to .env.local.",
      0,
      "missing_key",
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const data: Record<string, string> = {
    ...splitFullName(input.fullName),
    company_website: input.domain,
  };
  if (input.linkedinUrl?.trim()) {
    data.linkedin_url = input.linkedinUrl.trim();
  }

  let response: Response;
  try {
    response = await fetchImpl(`${PROSPEO_API_BASE}/enrich-person`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-KEY": apiKey },
      body: JSON.stringify({ data }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ProspeoApiError("Could not reach Prospeo. Check your connection and try again.", 0, "network");
  }

  let body: ProspeoEnrichPayload | null = null;
  try {
    body = (await response.json()) as ProspeoEnrichPayload;
  } catch {
    // Some Prospeo errors return no JSON; fall through to the status-based message.
  }

  const code = body?.error_code;
  if (!response.ok || body?.error) {
    if (code === "NO_MATCH") return null;
    if (response.status === 429 || (code && isRateLimitCode(code))) {
      throw new ProspeoApiError(
        "Prospeo's rate limit was reached. Try again later.",
        429,
        code ?? "rate_limit",
      );
    }
    throw new ProspeoApiError(
      prospeoErrorMessage(code, response.status),
      response.status,
      code,
    );
  }

  const email = body?.person?.email;
  if (!email?.email || email.revealed === false) return null;

  return {
    provider: "prospeo",
    email: email.email,
    score: null,
    verificationStatus: mapEmailStatus(email.status),
    domain: input.domain,
    position: body?.person?.current_job_title ?? null,
    company: body?.company?.name ?? null,
    linkedinUrl: body?.person?.linkedin_url ?? input.linkedinUrl ?? null,
    phoneNumber: null,
    sourceCount: null,
  };
}
