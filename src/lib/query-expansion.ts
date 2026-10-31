import { z } from "zod";
import {
  EXPERIENCE_LEVELS,
  SEARCH_ROLE_TYPES,
  type ExperienceLevel,
  type SearchRoleType,
} from "@/lib/constants";
import { parseJsonLoose } from "@/lib/json";

/**
 * Shape the LLM is asked to return. Kept lenient because models occasionally
 * drift; every field is normalised afterwards.
 */
export const queryExpansionSchema = z.object({
  titles: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  excludedKeywords: z.array(z.string()).optional(),
  roleType: z.string().optional(),
  experienceLevel: z.string().optional(),
  remoteOk: z.boolean().optional(),
  summary: z.string().optional(),
});

export type RawQueryExpansion = z.infer<typeof queryExpansionSchema>;

export interface QueryExpansionResult {
  titles: string[];
  keywords: string[];
  locations: string[];
  excludedKeywords: string[];
  roleType: SearchRoleType;
  experienceLevel: ExperienceLevel;
  remoteOk: boolean;
  summary?: string;
}

interface RoleFamily {
  pattern: RegExp;
  titles: string[];
  keywords: string[];
}

const ROLE_FAMILIES: RoleFamily[] = [
  {
    pattern:
      /\b(ai|a\.i\.|ml|machine learning|deep learning|artificial intelligence|data scien|nlp|computer vision|llm)\b/i,
    titles: [
      "Machine Learning Intern",
      "AI/ML Intern",
      "Machine Learning Engineer",
      "AI Engineer",
      "Data Scientist",
    ],
    keywords: ["python", "pytorch", "tensorflow", "scikit-learn", "nlp", "computer vision", "llm"],
  },
  {
    pattern: /\b(software engineer|software developer|swe|sde|full[- ]?stack|backend|front[- ]?end|web developer)\b/i,
    titles: [
      "Software Engineer Intern",
      "Software Engineer",
      "Full Stack Developer",
      "Backend Engineer",
      "Frontend Engineer",
    ],
    keywords: ["javascript", "typescript", "react", "node.js", "sql", "git", "rest api"],
  },
  {
    pattern: /\b(data analyst|data analytics|business intelligence|bi developer|analytics)\b/i,
    titles: ["Data Analyst Intern", "Data Analyst", "Business Intelligence Analyst"],
    keywords: ["sql", "excel", "tableau", "power bi", "python", "dashboards"],
  },
  {
    pattern: /\b(devops|sre|site reliability|cloud engineer|platform engineer|infrastructure)\b/i,
    titles: ["DevOps Intern", "DevOps Engineer", "Cloud Engineer", "Site Reliability Engineer"],
    keywords: ["docker", "kubernetes", "aws", "terraform", "linux", "ci/cd"],
  },
  {
    pattern: /\b(cyber ?security|security engineer|information security|appsec|penetration)\b/i,
    titles: ["Security Engineer Intern", "Security Engineer", "Application Security Engineer"],
    keywords: ["security", "owasp", "penetration testing", "networking", "linux", "siem"],
  },
  {
    pattern: /\b(product manager|product management|product owner|apm)\b/i,
    titles: ["Associate Product Manager", "Product Manager Intern", "Product Manager"],
    keywords: ["product strategy", "roadmap", "user research", "analytics", "agile"],
  },
  {
    pattern: /\b(ux|ui|product design|interaction design|graphic design)\b/i,
    titles: ["UX Design Intern", "Product Designer", "UI/UX Designer"],
    keywords: ["figma", "user research", "prototyping", "wireframes", "design systems"],
  },
  {
    pattern: /\b(mobile|android|ios|react native|flutter)\b/i,
    titles: ["Mobile Developer Intern", "Android Developer", "iOS Developer", "Mobile Engineer"],
    keywords: ["kotlin", "swift", "flutter", "react native", "mobile ui"],
  },
  {
    pattern: /\b(qa|quality assurance|test engineer|sdet|automation testing)\b/i,
    titles: ["QA Intern", "QA Engineer", "SDET", "Automation Test Engineer"],
    keywords: ["testing", "selenium", "playwright", "cypress", "test automation"],
  },
  {
    pattern: /\b(business analyst|consultant|strategy|operations)\b/i,
    titles: ["Business Analyst Intern", "Business Analyst", "Strategy Associate"],
    keywords: ["excel", "sql", "stakeholder management", "reporting", "analysis"],
  },
];

const LOCATION_TERMS = [
  "bengaluru",
  "bangalore",
  "hyderabad",
  "pune",
  "mumbai",
  "new delhi",
  "delhi",
  "noida",
  "gurugram",
  "gurgaon",
  "chennai",
  "kolkata",
  "ahmedabad",
  "jaipur",
  "india",
  "london",
  "manchester",
  "dublin",
  "berlin",
  "munich",
  "amsterdam",
  "paris",
  "madrid",
  "barcelona",
  "zurich",
  "toronto",
  "vancouver",
  "new york",
  "san francisco",
  "seattle",
  "austin",
  "boston",
  "chicago",
  "los angeles",
  "united states",
  "usa",
  "uk",
  "canada",
  "germany",
  "europe",
] as const;

const TITLE_NOISE =
  /\b(i want|i am looking for|looking for|would like|a job as|a role as|jobs?|roles?|positions?|openings?|opportunit(y|ies)|internships?|intern|full[- ]?time|part[- ]?time|remote|onsite|on[- ]site|in|at|for|with|an?|the)\b/gi;

function titleCaseWord(word: string): string {
  if (word.includes("/") || word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function baseTitle(prompt: string): string {
  const stripped = prompt.replace(TITLE_NOISE, " ").replace(/[.,;:!?]+$/g, "").replace(/\s+/g, " ").trim();
  if (!stripped) return "Software Engineer";
  return stripped
    .split(" ")
    .slice(0, 6)
    .map(titleCaseWord)
    .join(" ");
}

function containsAny(text: string, terms: readonly string[]): string[] {
  const lower = ` ${text.toLowerCase()} `;
  return terms.filter((term) => lower.includes(` ${term} `) || lower.includes(`${term},`) || lower.includes(`${term}.`));
}

export function detectRoleType(prompt: string): SearchRoleType {
  if (/\b(intern|internship|trainee|co-?op)\b/i.test(prompt)) return "internship";
  if (/\b(full[- ]?time|full time|permanent|graduate scheme)\b/i.test(prompt)) return "full_time";
  return "both";
}

export function detectExperienceLevel(prompt: string): ExperienceLevel {
  if (/\b(student|fresher|intern|internship)\b/i.test(prompt)) return "student";
  if (/\b(entry[- ]level|junior|new grad|graduate|trainee)\b/i.test(prompt)) return "entry";
  if (/\b(senior|staff|principal|lead|leadership)\b/i.test(prompt)) return "senior";
  if (/\b(mid[- ]level|mid level|intermediate|2\+|3\+|4\+)\b/i.test(prompt)) return "mid";
  return "any";
}

function uniqueStrings(values: unknown, limit: number, maxLength = 120): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed.slice(0, maxLength));
    if (out.length >= limit) break;
  }
  return out;
}

/** Deterministic expansion that always works offline — the LLM fallback. */
export function heuristicExpansion(prompt: string, context?: string): QueryExpansionResult {
  const text = [context?.trim(), prompt.trim()].filter(Boolean).join(" ");
  const roleType = detectRoleType(text);
  const experienceLevel = detectExperienceLevel(text);
  const matched = ROLE_FAMILIES.filter((family) => family.pattern.test(text));
  const base = baseTitle(text);

  const candidates: string[] = [];
  if (roleType !== "full_time") candidates.push(`${base} Intern`, `${base} Internship`);
  candidates.push(base);

  const titles: string[] = [];
  const keywords: string[] = [];

  if (matched.length > 0) {
    for (const family of matched) {
      const familyTitles =
        roleType === "full_time"
          ? family.titles.filter((title) => !/intern/i.test(title))
          : family.titles;
      titles.push(...familyTitles);
      keywords.push(...family.keywords);
    }
  }

  titles.push(...candidates);

  const locations = containsAny(text, LOCATION_TERMS).map((term) =>
    term.replace(/\b\w/g, (char) => char.toUpperCase()),
  );
  const remoteOk = /\b(remote|work from home|wfh|anywhere)\b/i.test(text)
    ? true
    : /\b(on[- ]?site|in[- ]office|hybrid in office)\b/i.test(text)
      ? false
      : true;

  const finalTitles = uniqueStrings(titles, 12);
  const finalKeywords = uniqueStrings(keywords, 20);

  return {
    titles: finalTitles.length > 0 ? finalTitles : [`${base} Intern`, base],
    keywords: finalKeywords,
    locations,
    excludedKeywords: [],
    roleType,
    experienceLevel,
    remoteOk,
    summary: `Targeting ${finalTitles.slice(0, 3).join(", ") || base}${
      locations.length ? ` in ${locations.join(", ")}` : remoteOk ? " (remote-friendly)" : ""
    }.`,
  };
}

function coerceEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const normalised = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowed.includes(normalised as T) ? (normalised as T) : fallback;
}

const REMOTE_LOCATION_PATTERN =
  /^(remote(?:\s+only)?|fully remote|anywhere|worldwide|global|work from home|wfh|hybrid)$/i;

/** Remote is a work mode, not a city — move such entries into remoteOk. */
function splitRemoteLocations(values: string[]): { locations: string[]; mentionsRemote: boolean } {
  const locations: string[] = [];
  let mentionsRemote = false;

  for (const value of values) {
    if (REMOTE_LOCATION_PATTERN.test(value.trim())) {
      mentionsRemote = true;
      continue;
    }
    locations.push(value);
  }

  return { locations, mentionsRemote };
}

/**
 * Merge raw LLM output with heuristic defaults, dedupe and cap everything.
 * Empty LLM fields fall back to the deterministic expansion.
 */
export function normalizeExpansion(
  raw: RawQueryExpansion,
  prompt: string,
  context?: string,
): QueryExpansionResult {
  const fallback = heuristicExpansion(prompt, context);

  const titles = uniqueStrings(raw.titles, 12);
  const keywords = uniqueStrings(raw.keywords, 20);
  const { locations, mentionsRemote } = splitRemoteLocations(uniqueStrings(raw.locations, 8));
  const excludedKeywords = uniqueStrings(raw.excludedKeywords, 10);

  const summary = typeof raw.summary === "string" ? raw.summary.trim().slice(0, 280) : undefined;

  return {
    titles: titles.length > 0 ? titles : fallback.titles,
    keywords: keywords.length > 0 ? keywords : fallback.keywords,
    locations,
    excludedKeywords,
    roleType: coerceEnum(raw.roleType, SEARCH_ROLE_TYPES, fallback.roleType),
    experienceLevel: coerceEnum(raw.experienceLevel, EXPERIENCE_LEVELS, fallback.experienceLevel),
    remoteOk:
      raw.remoteOk === true ||
      mentionsRemote ||
      (raw.remoteOk === undefined && fallback.remoteOk),
    ...(summary ? { summary } : fallback.summary ? { summary: fallback.summary } : {}),
  };
}

/** Parse an LLM response into a normalised expansion, or null if unusable. */
export function parseQueryExpansion(
  text: string,
  prompt: string,
  context?: string,
): QueryExpansionResult | null {
  const parsed = parseJsonLoose(text);
  if (parsed === null || typeof parsed !== "object") return null;

  const checked = queryExpansionSchema.safeParse(parsed);
  if (!checked.success) return null;

  return normalizeExpansion(checked.data, prompt, context);
}
