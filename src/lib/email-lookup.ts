export const EMAIL_PROVIDERS = ["hunter", "prospeo", "enrichlayer"] as const;

export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export const EMAIL_PROVIDER_LABELS: Record<EmailProvider, string> = {
  hunter: "Hunter",
  prospeo: "Prospeo",
  enrichlayer: "Enrich Layer",
};

export interface EmailLookupResult {
  provider: EmailProvider;
  email: string;
  score: number | null;
  verificationStatus: string | null;
  domain: string | null;
  position: string | null;
  company: string | null;
  linkedinUrl: string | null;
  phoneNumber: string | null;
  sourceCount: number | null;
  isCatchAll?: boolean;
}

export interface HrContactResult {
  email: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  seniority: string | null;
  linkedinUrl: string | null;
  phoneNumber: string | null;
  score: number;
  verificationStatus: string | null;
  sourceCount: number;
}

export interface HrSearchResult {
  domain: string;
  organization: string | null;
  contacts: HrContactResult[];
}

export function isEmailProvider(value: unknown): value is EmailProvider {
  return typeof value === "string" && (EMAIL_PROVIDERS as readonly string[]).includes(value);
}

/** Turn a website or URL into the bare domain the email providers expect. */
export function normalizeEmailDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  let domain = value.trim().toLowerCase();
  if (!domain) return null;

  domain = domain.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.split(/[/?#]/, 1)[0] ?? "";
  domain = domain.split(":", 1)[0] ?? "";

  if (
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)
  ) {
    return null;
  }

  return domain;
}
