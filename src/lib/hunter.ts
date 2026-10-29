import type { EmailLookupResult, HrContactResult, HrSearchResult } from "./email-lookup";

const HUNTER_API_BASE = "https://api.hunter.io/v2";

export class HunterApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "HunterApiError";
    this.status = status;
    this.code = code;
  }
}

interface HunterFinderPayload {
  data?: {
    email?: string | null;
    score?: number | null;
    verification?: { status?: string | null } | null;
    domain?: string | null;
    position?: string | null;
    company?: string | null;
    linkedin_url?: string | null;
    phone_number?: string | null;
    sources?: unknown[];
  };
  errors?: Array<{ details?: string; code?: number | string }>;
}

interface HunterDomainPayload {
  data?: {
    domain?: string | null;
    organization?: string | null;
    emails?: Array<{
      value?: string | null;
      score?: number | null;
      confidence?: number | null;
      verification?: { status?: string | null } | null;
      sources?: unknown[];
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
      seniority?: string | null;
      department?: string | null;
      linkedin?: string | null;
      phone_number?: string | null;
    }>;
  };
  errors?: Array<{ details?: string; code?: number | string }>;
}

const HR_TITLE_TERMS = [
  "recruiter",
  "talent acquisition",
  "talent partner",
  "recruiting",
  "talent",
  "hiring",
];

/** Recruiting-focused titles first, then general HR, then other people-team roles. */
function hrTitleRank(position: string | null): number {
  const title = (position ?? "").toLowerCase();
  if (HR_TITLE_TERMS.some((term) => title.includes(term))) return 0;
  if (title.includes("people")) return 1;
  if (title.includes("human resources") || /(^|\s)hr(\s|$)/.test(title)) return 2;
  return 3;
}

export async function findHunterEmail(
  input: { fullName: string; domain: string },
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<EmailLookupResult | null> {
  const apiKey = options.apiKey ?? process.env.HUNTER_API_KEY;
  if (!apiKey) {
    throw new HunterApiError(
      "Hunter API key is not configured. Add HUNTER_API_KEY to .env.local.",
      0,
      "missing_key",
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    domain: input.domain,
    full_name: input.fullName,
    api_key: apiKey,
  });

  let response: Response;
  try {
    response = await fetchImpl(`${HUNTER_API_BASE}/email-finder?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HunterApiError("Could not reach Hunter. Check your connection and try again.", 0, "network");
  }

  let body: HunterFinderPayload | null = null;
  try {
    body = (await response.json()) as HunterFinderPayload;
  } catch {
    // Some Hunter errors return no JSON; fall through to the status-based message.
  }

  if (!response.ok) {
    const firstError = body?.errors?.[0];
    throw new HunterApiError(
      firstError?.details ?? `Hunter request failed (${response.status}).`,
      response.status,
      firstError?.code != null ? String(firstError.code) : undefined,
    );
  }

  const data = body?.data;
  if (!data?.email) return null;

  return {
    provider: "hunter",
    email: data.email,
    score: typeof data.score === "number" ? data.score : 0,
    verificationStatus: data.verification?.status ?? null,
    domain: data.domain ?? input.domain,
    position: data.position ?? null,
    company: data.company ?? null,
    linkedinUrl: data.linkedin_url ?? null,
    phoneNumber: data.phone_number ?? null,
    sourceCount: Array.isArray(data.sources) ? data.sources.length : 0,
  };
}

export async function findHunterHrContacts(
  input: { domain: string },
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<HrSearchResult> {
  const apiKey = options.apiKey ?? process.env.HUNTER_API_KEY;
  if (!apiKey) {
    throw new HunterApiError(
      "Hunter API key is not configured. Add HUNTER_API_KEY to .env.local.",
      0,
      "missing_key",
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    domain: input.domain,
    department: "hr",
    limit: "10",
    offset: "0",
    api_key: apiKey,
  });

  let response: Response;
  try {
    response = await fetchImpl(`${HUNTER_API_BASE}/domain-search?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HunterApiError("Could not reach Hunter. Check your connection and try again.", 0, "network");
  }

  let body: HunterDomainPayload | null = null;
  try {
    body = (await response.json()) as HunterDomainPayload;
  } catch {
    // Some Hunter errors return no JSON; fall through to the status-based message.
  }

  if (!response.ok) {
    const firstError = body?.errors?.[0];
    throw new HunterApiError(
      firstError?.details ?? `Hunter request failed (${response.status}).`,
      response.status,
      firstError?.code != null ? String(firstError.code) : undefined,
    );
  }

  const data = body?.data;
  const seen = new Set<string>();
  const contacts: HrContactResult[] = [];

  for (const entry of data?.emails ?? []) {
    const email = entry.value?.trim();
    if (!email || !email.includes("@")) continue;

    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const name = [entry.first_name, entry.last_name].filter(Boolean).join(" ").trim();
    contacts.push({
      email,
      fullName: name || email.split("@")[0]!,
      jobTitle: entry.position ?? null,
      department: entry.department ?? null,
      seniority: entry.seniority ?? null,
      linkedinUrl: entry.linkedin ?? null,
      phoneNumber: entry.phone_number ?? null,
      score: typeof entry.confidence === "number" ? entry.confidence : 0,
      verificationStatus: entry.verification?.status ?? null,
      sourceCount: Array.isArray(entry.sources) ? entry.sources.length : 0,
    });
  }

  contacts.sort((a, b) => {
    const rank = hrTitleRank(a.jobTitle) - hrTitleRank(b.jobTitle);
    if (rank !== 0) return rank;
    const verified =
      Number(b.verificationStatus === "valid") - Number(a.verificationStatus === "valid");
    if (verified !== 0) return verified;
    return b.score - a.score;
  });

  return {
    domain: data?.domain ?? input.domain,
    organization: data?.organization ?? null,
    contacts,
  };
}
