"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { searchProfiles } from "@/db/schema";
import { searchProfileSchema } from "@/lib/validators";
import type { ActionResult } from "@/lib/types";
import { expandQuery, type ExpandedQuery } from "@/server/llm/expand-query";

function revalidateProfiles(): void {
  revalidatePath("/search-profiles");
  revalidatePath("/");
}

function serializeProfile(data: z.infer<typeof searchProfileSchema>) {
  return {
    name: data.name,
    prompt: data.prompt,
    titles: JSON.stringify(data.titles),
    keywords: JSON.stringify(data.keywords),
    locations: JSON.stringify(data.locations),
    excludedKeywords: JSON.stringify(data.excludedKeywords),
    roleType: data.roleType,
    remoteOk: data.remoteOk,
    experienceLevel: data.experienceLevel,
    minMatchScore: data.minMatchScore,
    active: data.active,
  };
}

export async function expandSearchQuery(prompt: string): Promise<ActionResult<ExpandedQuery>> {
  const parsed = z.string().trim().min(2).max(200).safeParse(prompt);
  if (!parsed.success) {
    return { success: false, message: "Describe your target role first", error: "Describe your target role first" };
  }

  const expansion = await expandQuery(parsed.data);
  return {
    success: true,
    message:
      expansion.provider === "heuristic"
        ? "Expanded locally — connect an AI provider for smarter results"
        : `Expanded with ${expansion.provider}`,
    data: expansion,
  };
}

export async function createSearchProfile(formData: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = searchProfileSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      error: parsed.error.errors[0]?.message,
    };
  }

  const result = await db
    .insert(searchProfiles)
    .values(serializeProfile(parsed.data))
    .returning({ id: searchProfiles.id });

  revalidateProfiles();
  return {
    success: true,
    message: "Search profile created",
    data: { id: result[0]!.id },
  };
}

export async function updateSearchProfile(
  id: number,
  formData: unknown,
): Promise<ActionResult> {
  const idParsed = z.number().int().positive().safeParse(id);
  if (!idParsed.success) return { success: false, message: "Invalid search profile" };

  const parsed = searchProfileSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Validation failed",
      error: parsed.error.errors[0]?.message,
    };
  }

  await db
    .update(searchProfiles)
    .set({ ...serializeProfile(parsed.data), updatedAt: Date.now() })
    .where(eq(searchProfiles.id, idParsed.data));

  revalidateProfiles();
  return { success: true, message: "Search profile updated" };
}

export async function toggleSearchProfileActive(
  id: number,
  active: boolean,
): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.number().int().positive(), active: z.boolean() })
    .safeParse({ id, active });
  if (!parsed.success) return { success: false, message: "Invalid request" };

  await db
    .update(searchProfiles)
    .set({ active: parsed.data.active, updatedAt: Date.now() })
    .where(eq(searchProfiles.id, parsed.data.id));

  revalidateProfiles();
  return {
    success: true,
    message: parsed.data.active ? "Search profile activated" : "Search profile paused",
  };
}

export async function deleteSearchProfile(id: number): Promise<ActionResult> {
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) return { success: false, message: "Invalid search profile" };

  await db.delete(searchProfiles).where(eq(searchProfiles.id, parsed.data));
  revalidateProfiles();
  return { success: true, message: "Search profile deleted" };
}
