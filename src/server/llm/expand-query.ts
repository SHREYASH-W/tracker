import {
  heuristicExpansion,
  normalizeExpansion,
  queryExpansionSchema,
  type QueryExpansionResult,
} from "@/lib/query-expansion";
import { generateJson, type GenerateJsonOptions, type LlmJsonResult } from "./index";
import type { LlmProviderId } from "./types";

export interface ExpandedQuery extends QueryExpansionResult {
  provider: LlmProviderId | "heuristic";
  model: string | null;
  cached: boolean;
}

type JsonGenerator = <T>(options: GenerateJsonOptions<T>) => Promise<LlmJsonResult<T>>;

const SYSTEM_PROMPT = `You are a job-search query planner for a local job-hunting CRM.
Given a short description of the role a candidate wants, return search terms that job boards understand.

Rules:
- titles: 5-10 realistic job titles employers actually post. If the target is an internship, include entry-level/intern variants; otherwise include general and seniority-appropriate titles.
- keywords: 8-15 concrete skills, tools, technologies or domain terms useful for matching job descriptions.
- locations: only places the user explicitly mentioned. Return [] when they did not name any.
- excludedKeywords: things the user explicitly wants to avoid. Return [] when none.
- roleType: "internship", "full_time" or "both".
- experienceLevel: "any", "student", "entry", "mid" or "senior".
- remoteOk: true unless the user insists on on-site work.
- summary: one short sentence (max 200 chars) describing the search.

Return ONLY a JSON object with exactly these keys: titles, keywords, locations, excludedKeywords, roleType, experienceLevel, remoteOk, summary. No markdown, no commentary.`;

/** Expand a free-text target into structured search terms, with offline fallback. */
export async function expandQuery(
  prompt: string,
  generate: JsonGenerator = generateJson,
): Promise<ExpandedQuery> {
  const trimmed = prompt.trim();

  try {
    const result = await generate({
      operation: "query_expansion",
      schema: queryExpansionSchema,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Target: ${trimmed || "software internship"}` },
      ],
      temperature: 0.3,
      maxTokens: 800,
    });

    return {
      ...normalizeExpansion(result.data, trimmed),
      provider: result.provider,
      model: result.model,
      cached: result.cached,
    };
  } catch {
    return {
      ...heuristicExpansion(trimmed),
      provider: "heuristic",
      model: null,
      cached: false,
    };
  }
}
