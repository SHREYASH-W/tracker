import type { EmailLookupResult } from "./email-lookup";

const ENRICH_LAYER_API_BASE = "https://api.enrichlayer.com";

export class EnrichLayerApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "EnrichLayerApiError";
    this.status = status;
    this.code = code;
  }
}

interface EnrichLayerEmailCandidate {
  email?: string | null;
  normalized?: string | null;
  validity?: string | null;
  validatedAt?: string | null;
  gateway?: string | null;
  isDisposable?: boolean | null;
  isConsumer?: boolean | null;
  isDomainCatchall?: boolean | null;
  mxRecords?: string[] | null;
}

interface EnrichLayerPayload {
  name?: string | null;
  emails?: EnrichLayerEmailCandidate[] | null;
  error?: string | { message?: string | null } | null;
  message?: string | null;
  detail?: string | null;
}

function mapValidity(candidate: EnrichLayerEmailCandidate): string | null {
  if (candidate.isDisposable === true) return "disposable";

  switch (candidate.validity?.trim().toLowerCase()) {
    case "valid":
    case "verified":
      return "valid";
    case "invalid":
      return "invalid";
    case "disposable":
      return "disposable";
    case "accept_all":
    case "accept-all":
    case "catch_all":
    case "catch-all":
    case "catchall":
      return "accept_all";
    case "unknown":
    case "":
    case undefined:
      return null;
    default:
      return candidate.validity!.trim().toLowerCase();
  }
}

/** Lower is better: verified work mailboxes first, risky shapes last. */
function candidateRank(candidate: EnrichLayerEmailCandidate): number {
  const status = mapValidity(candidate);
  let rank =
    status === "valid"
      ? 0
      : status === null
        ? 1
        : status === "accept_all"
          ? 2
          : status === "invalid"
            ? 4
            : status === "disposable"
              ? 5
              : 3;

  if (candidate.isDomainCatchall === true) rank += 0.5;
  if (candidate.isConsumer === true) rank += 0.25;
  return rank;
}

function errorDetail(body: EnrichLayerPayload | null): string | null {
  if (!body) return null;
  if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
  if (body.error && typeof body.error === "object" && body.error.message?.trim()) {
    return body.error.message.trim();
  }
  return body.message?.trim() || body.detail?.trim() || null;
}

export async function findEnrichLayerEmail(
  input: { fullName: string; domain: string },
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<EmailLookupResult | null> {
  const apiKey = options.apiKey ?? process.env.ENRICH_LAYER_API_KEY;
  if (!apiKey) {
    throw new EnrichLayerApiError(
      "Enrich Layer token is not configured. Add ENRICH_LAYER_API_KEY to .env.local.",
      0,
      "missing_key",
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    full_name: input.fullName,
    domain: input.domain,
    limit: "5",
  });

  let response: Response;
  try {
    response = await fetchImpl(`${ENRICH_LAYER_API_BASE}/v3/email/prospect?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new EnrichLayerApiError(
      "Could not reach Enrich Layer. Check your connection and try again.",
      0,
      "network",
    );
  }

  let body: EnrichLayerPayload | null = null;
  try {
    body = (await response.json()) as EnrichLayerPayload;
  } catch {
    // Some Enrich Layer errors return no JSON; fall through to the status-based message.
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new EnrichLayerApiError(
        "Enrich Layer rejected the API token. Check ENRICH_LAYER_API_KEY in .env.local.",
        response.status,
        "unauthorized",
      );
    }
    if (response.status === 402) {
      throw new EnrichLayerApiError(
        "Your Enrich Layer account is out of credits. Add credits or use Hunter or Prospeo instead.",
        response.status,
        "out_of_credits",
      );
    }
    if (response.status === 429) {
      throw new EnrichLayerApiError(
        "Enrich Layer's rate limit was reached. Try again later.",
        response.status,
        "rate_limit",
      );
    }
    throw new EnrichLayerApiError(
      errorDetail(body) ?? `Enrich Layer request failed (${response.status}).`,
      response.status,
    );
  }

  const candidates = (body?.emails ?? [])
    .map((candidate) => ({
      candidate,
      email: (candidate.normalized?.trim() || candidate.email?.trim() || "").trim(),
    }))
    .filter(({ email }) => email.includes("@"));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => candidateRank(a.candidate) - candidateRank(b.candidate));
  const best = candidates[0]!;

  return {
    provider: "enrichlayer",
    email: best.email,
    score: null,
    verificationStatus: mapValidity(best.candidate),
    domain: input.domain,
    position: null,
    company: null,
    linkedinUrl: null,
    phoneNumber: null,
    sourceCount: null,
    isCatchAll: best.candidate.isDomainCatchall === true,
  };
}
