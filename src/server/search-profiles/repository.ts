import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { searchProfiles } from "@/db/schema";
import type { SearchProfile, SearchProfileView } from "@/lib/types";
import { safeJsonParse } from "@/lib/utils";

function parseStringArray(value: string): string[] {
  const parsed = safeJsonParse<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string");
}

export function toSearchProfileView(row: SearchProfile): SearchProfileView {
  return {
    ...row,
    titles: parseStringArray(row.titles),
    keywords: parseStringArray(row.keywords),
    locations: parseStringArray(row.locations),
    excludedKeywords: parseStringArray(row.excludedKeywords),
  };
}

export async function listSearchProfiles(options: { activeOnly?: boolean } = {}): Promise<SearchProfileView[]> {
  const rows = await db
    .select()
    .from(searchProfiles)
    .orderBy(desc(searchProfiles.createdAt), desc(searchProfiles.id));

  const views = rows.map(toSearchProfileView);
  return options.activeOnly ? views.filter((profile) => profile.active) : views;
}

export async function getSearchProfile(id: number): Promise<SearchProfileView | null> {
  const rows = await db
    .select()
    .from(searchProfiles)
    .where(eq(searchProfiles.id, id))
    .limit(1);
  return rows[0] ? toSearchProfileView(rows[0]) : null;
}
