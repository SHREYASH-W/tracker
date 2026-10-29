"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { eq, like, or, desc, sql } from "drizzle-orm";
import { companySchema } from "@/lib/validators";
import type { ActionResult, CompanyWithStats } from "@/lib/types";

export async function getCompanies(search?: string): Promise<CompanyWithStats[]> {
  let rows;
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    rows = await db
      .select()
      .from(companies)
      .where(or(like(companies.name, term), like(companies.industry, term), like(companies.location, term)))
      .orderBy(companies.name);
  } else {
    rows = await db.select().from(companies).orderBy(companies.name);
  }

  // Get counts via raw SQL for efficiency
  const stats = db.$client.raw.prepare(`
    SELECT
      c.id,
      COUNT(DISTINCT p.id) as people_count,
      COUNT(DISTINCT CASE WHEN o.status NOT IN ('archived','rejected','not_interested') THEN o.id END) as active_outreach,
      MAX(i.occurred_at) as last_interaction
    FROM companies c
    LEFT JOIN people p ON p.company_id = c.id
    LEFT JOIN outreach_records o ON o.person_id = p.id
    LEFT JOIN interactions i ON i.outreach_record_id = o.id
    GROUP BY c.id
  `).all() as { id: number; people_count: number; active_outreach: number; last_interaction: number | null }[];

  const statsMap = new Map(stats.map((s) => [s.id, s]));

  return rows.map((company) => {
    const s = statsMap.get(company.id) ?? { people_count: 0, active_outreach: 0, last_interaction: null };
    return {
      company,
      peopleCount: Number(s.people_count),
      activeOutreachCount: Number(s.active_outreach),
      lastInteractionAt: s.last_interaction,
    };
  });
}

export async function getCompany(id: number) {
  const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createCompany(formData: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = companySchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;
  const result = await db.insert(companies).values({
    name: data.name,
    website: data.website ?? null,
    industry: data.industry ?? null,
    location: data.location ?? null,
    linkedinUrl: data.linkedinUrl ?? null,
    size: data.size ?? null,
    notes: data.notes ?? null,
  }).returning({ id: companies.id });

  revalidatePath("/companies");
  revalidatePath("/people");
  return { success: true, message: "Company created", data: { id: result[0]!.id } };
}

export async function updateCompany(id: number, formData: unknown): Promise<ActionResult> {
  const parsed = companySchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }

  const data = parsed.data;
  await db.update(companies).set({
    name: data.name,
    website: data.website ?? null,
    industry: data.industry ?? null,
    location: data.location ?? null,
    linkedinUrl: data.linkedinUrl ?? null,
    size: data.size ?? null,
    notes: data.notes ?? null,
    updatedAt: Date.now(),
  }).where(eq(companies.id, id));

  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  revalidatePath("/people");
  return { success: true, message: "Company updated" };
}

export async function deleteCompany(id: number): Promise<ActionResult> {
  // Nullify company_id on people first (handled by ON DELETE SET NULL via FK)
  await db.delete(companies).where(eq(companies.id, id));
  revalidatePath("/companies");
  revalidatePath("/people");
  revalidatePath("/");
  return { success: true, message: "Company deleted" };
}

export async function searchCompanies(query: string) {
  if (!query.trim()) {
    return db.select({ id: companies.id, name: companies.name, industry: companies.industry })
      .from(companies).orderBy(companies.name).limit(20);
  }
  const term = `%${query.trim()}%`;
  return db.select({ id: companies.id, name: companies.name, industry: companies.industry })
    .from(companies)
    .where(or(like(companies.name, term), like(companies.industry, term)))
    .orderBy(companies.name)
    .limit(20);
}
