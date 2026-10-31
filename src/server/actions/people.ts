"use server";
import { revalidatePath } from "next/cache";
import { db, sqlite } from "@/db";
import { companies, interactions, outreachRecords, people } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, like, lte, or } from "drizzle-orm";
import { addContactSchema, editPersonSchema } from "@/lib/validators";
import type { ActionResult, DuplicateWarning, PersonWithRelations } from "@/lib/types";

// --- Directory query types -----------------------------------------------

export interface PeopleFilters {
  search?: string;
  status?: string;
  companyId?: number;
  role?: string;
  followUp?: "overdue" | "today" | "upcoming" | "none" | "all";
  dateFrom?: number;
  dateTo?: number;
  sortBy?: "name" | "company" | "last_contacted" | "next_follow_up" | "status" | "created";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PeopleDirectoryResult {
  rows: PersonWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getPeopleDirectory(filters: PeopleFilters = {}): Promise<PeopleDirectoryResult> {
  const {
    search, status, companyId, role, followUp,
    dateFrom, dateTo, sortBy = "name", sortDir = "asc",
    page = 1, pageSize = 50,
  } = filters;

  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const soonEnd = now + 7 * 86400000;

  // Build parameterized query
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(`(p.full_name LIKE ? OR c.name LIKE ? OR p.job_title LIKE ? OR p.email LIKE ? OR p.notes LIKE ? OR o.target_role LIKE ?)`);
    params.push(term, term, term, term, term, term);
  }
  if (status && status !== "all") {
    conditions.push(`o.status = ?`); params.push(status);
  }
  if (companyId) {
    conditions.push(`p.company_id = ?`); params.push(companyId);
  }
  if (role?.trim()) {
    const term = `%${role.trim()}%`;
    conditions.push(`(p.job_title LIKE ? OR o.target_role LIKE ?)`);
    params.push(term, term);
  }
  if (followUp === "overdue") {
    conditions.push(`o.next_follow_up_at < ?`); params.push(todayStart.getTime());
  } else if (followUp === "today") {
    conditions.push(`o.next_follow_up_at >= ? AND o.next_follow_up_at <= ?`);
    params.push(todayStart.getTime(), todayEnd.getTime());
  } else if (followUp === "upcoming") {
    conditions.push(`o.next_follow_up_at > ? AND o.next_follow_up_at <= ?`);
    params.push(todayEnd.getTime(), soonEnd);
  } else if (followUp === "none") {
    conditions.push(`o.next_follow_up_at IS NULL`);
  }
  if (dateFrom) { conditions.push(`(o.first_contacted_at >= ? OR o.last_contacted_at >= ?)`); params.push(dateFrom, dateFrom); }
  if (dateTo) { conditions.push(`(o.first_contacted_at <= ? OR o.last_contacted_at <= ?)`); params.push(dateTo, dateTo); }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortColMap: Record<string, string> = {
    name: "p.full_name",
    company: "c.name",
    last_contacted: "o.last_contacted_at",
    next_follow_up: "o.next_follow_up_at",
    status: "o.status",
    created: "p.created_at",
  };
  const orderCol = sortColMap[sortBy] ?? "p.full_name";
  const orderDir = sortDir === "desc" ? "DESC" : "ASC";

  const baseSql = `
    FROM people p
    LEFT JOIN companies c ON c.id = p.company_id
    LEFT JOIN (
      SELECT person_id, id, status, purpose, channel, target_role,
             first_contacted_at, last_contacted_at, last_response_at, next_follow_up_at
      FROM outreach_records
      WHERE id IN (
        SELECT id FROM outreach_records r2
        WHERE r2.person_id = outreach_records.person_id
        ORDER BY created_at DESC LIMIT 1
      )
    ) o ON o.person_id = p.id
    ${whereClause}
  `;

  const countRow = sqlite.raw.prepare(`SELECT COUNT(DISTINCT p.id) as n ${baseSql}`)
    .get(...params) as { n: number };
  const total = Number(countRow.n);
  const offset = (page - 1) * pageSize;

  const rows = sqlite.raw.prepare(`
    SELECT
      p.id, p.company_id, p.full_name, p.job_title, p.department, p.seniority,
      p.email, p.phone, p.linkedin_url, p.other_profile_url, p.location, p.notes,
      p.created_at, p.updated_at,
      c.id as c_id, c.name as c_name, c.industry as c_industry, c.location as c_location,
      o.id as o_id, o.status as o_status, o.purpose as o_purpose, o.channel as o_channel,
      o.target_role as o_target_role, o.first_contacted_at, o.last_contacted_at,
      o.last_response_at, o.next_follow_up_at,
      (SELECT COUNT(*) FROM outreach_records WHERE person_id = p.id) as outreach_count
    ${baseSql}
    GROUP BY p.id
    ORDER BY ${orderCol} ${orderDir} NULLS LAST
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as Record<string, unknown>[];

  const result: PersonWithRelations[] = rows.map((r) => ({
    person: {
      id: r.id as number,
      companyId: r.company_id as number | null,
      fullName: r.full_name as string,
      jobTitle: r.job_title as string | null,
      department: r.department as string | null,
      seniority: r.seniority as string | null,
      email: r.email as string | null,
      phone: r.phone as string | null,
      linkedinUrl: r.linkedin_url as string | null,
      otherProfileUrl: r.other_profile_url as string | null,
      location: r.location as string | null,
      notes: r.notes as string | null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    },
    company: r.c_id ? {
      id: r.c_id as number,
      name: r.c_name as string,
      industry: r.c_industry as string | null,
      location: r.c_location as string | null,
    } : null,
    primaryOutreach: r.o_id ? {
      id: r.o_id as number,
      status: r.o_status as string,
      purpose: r.o_purpose as string,
      channel: r.o_channel as string | null,
      targetRole: r.o_target_role as string | null,
      firstContactedAt: r.first_contacted_at as number | null,
      lastContactedAt: r.last_contacted_at as number | null,
      lastResponseAt: r.last_response_at as number | null,
      nextFollowUpAt: r.next_follow_up_at as number | null,
    } : null,
    outreachCount: Number(r.outreach_count),
  }));

  return { rows: result, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPersonWithDetails(personId: number) {
  const personRows = await db.select().from(people)
    .leftJoin(companies, eq(people.companyId, companies.id))
    .where(eq(people.id, personId)).limit(1);
  if (!personRows[0]) return null;

  const { people: person, companies: company } = personRows[0];

  const outreachRows = await db.select().from(outreachRecords)
    .where(eq(outreachRecords.personId, personId))
    .orderBy(desc(outreachRecords.createdAt));

  const interactionRows = outreachRows.length > 0
    ? await db.select().from(interactions)
        .where(or(...outreachRows.map((o) => eq(interactions.outreachRecordId, o.id))))
        .orderBy(desc(interactions.occurredAt))
    : [];

  return { person, company, outreachRecords: outreachRows, interactions: interactionRows };
}

export async function checkDuplicates(
  fullName: string, email?: string | null, linkedinUrl?: string | null, excludeId?: number
): Promise<DuplicateWarning[]> {
  const warnings: DuplicateWarning[] = [];

  if (email?.trim()) {
    const rows = sqlite.raw.prepare(`
      SELECT p.id, p.full_name, c.name as company_name
      FROM people p LEFT JOIN companies c ON c.id = p.company_id
      WHERE LOWER(p.email) = LOWER(?) ${excludeId ? "AND p.id != ?" : ""}
      LIMIT 3
    `).all(...(excludeId ? [email.trim(), excludeId] : [email.trim()])) as { id: number; full_name: string; company_name: string | null }[];
    rows.forEach((r) => warnings.push({ personId: r.id, personName: r.full_name, companyName: r.company_name, matchField: "email" }));
  }

  if (linkedinUrl?.trim()) {
    const rows = sqlite.raw.prepare(`
      SELECT p.id, p.full_name, c.name as company_name
      FROM people p LEFT JOIN companies c ON c.id = p.company_id
      WHERE LOWER(p.linkedin_url) = LOWER(?) ${excludeId ? "AND p.id != ?" : ""}
      LIMIT 3
    `).all(...(excludeId ? [linkedinUrl.trim(), excludeId] : [linkedinUrl.trim()])) as { id: number; full_name: string; company_name: string | null }[];
    rows.forEach((r) => warnings.push({ personId: r.id, personName: r.full_name, companyName: r.company_name, matchField: "linkedin" }));
  }

  return warnings;
}

export async function createPersonWithOutreach(formData: unknown): Promise<ActionResult<{ personId: number; outreachId: number }>> {
  const parsed = addContactSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors.map(e => e.message).join(", ") };
  }
  const data = parsed.data;

  try {
    sqlite.raw.exec("BEGIN DEFERRED");

    // Resolve or create company
    let companyId = data.companyId;
    if (!companyId) {
      const existing = sqlite.raw.prepare(`SELECT id FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(data.companyName ?? "") as { id: number } | undefined;
      if (existing) {
        companyId = existing.id;
      } else {
        const res = sqlite.raw.prepare(`
          INSERT INTO companies (name, website, industry, location, linkedin_url, size, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.companyName ?? "", data.companyWebsite ?? null, data.companyIndustry ?? null,
          data.companyLocation ?? null, data.companyLinkedinUrl ?? null,
          data.companySize ?? null, data.companyNotes ?? null
        );
        companyId = Number(res.lastInsertRowid);
      }
    }

    // Create person
    const personRes = sqlite.raw.prepare(`
      INSERT INTO people (company_id, full_name, job_title, department, seniority, email, phone, linkedin_url, other_profile_url, location, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId, data.fullName, data.jobTitle ?? null, data.department ?? null,
      data.seniority ?? null, data.email ?? null, data.phone ?? null,
      data.linkedinUrl ?? null, data.otherProfileUrl ?? null,
      data.location ?? null, data.notes ?? null
    );
    const personId = Number(personRes.lastInsertRowid);

    // Create opportunity if title given
    let opportunityId: number | null = null;
    if (data.opportunityTitle?.trim()) {
      const oppRes = sqlite.raw.prepare(`
        INSERT INTO opportunities (company_id, title, opportunity_type, job_posting_url)
        VALUES (?, ?, ?, ?)
      `).run(companyId, data.opportunityTitle, data.opportunityType ?? null, data.jobPostingUrl ?? null);
      opportunityId = Number(oppRes.lastInsertRowid);
    }

    // Create outreach record
    const outreachRes = sqlite.raw.prepare(`
      INSERT INTO outreach_records (person_id, opportunity_id, purpose, channel, status,
        first_contacted_at, last_contacted_at, last_response_at, next_follow_up_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      personId, opportunityId, data.purpose, data.channel ?? null, data.status,
      data.firstContactedAt ?? null, data.firstContactedAt ?? null,
      data.lastResponseAt ?? null, data.nextFollowUpAt ?? null,
      data.outreachNotes ?? null
    );
    const outreachId = Number(outreachRes.lastInsertRowid);

    sqlite.raw.exec("COMMIT");

    revalidatePath("/people");
    revalidatePath("/");
    revalidatePath("/companies");

    return { success: true, message: "Contact created successfully", data: { personId, outreachId } };
  } catch (err) {
    try { sqlite.raw.exec("ROLLBACK"); } catch {}
    console.error("createPersonWithOutreach error:", err);
    return { success: false, message: "Failed to create contact", error: String(err) };
  }
}

export async function updatePerson(personId: number, formData: unknown): Promise<ActionResult> {
  const parsed = editPersonSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }
  const data = parsed.data;
  await db.update(people).set({
    fullName: data.fullName,
    jobTitle: data.jobTitle ?? null,
    department: data.department ?? null,
    seniority: data.seniority ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    linkedinUrl: data.linkedinUrl ?? null,
    otherProfileUrl: data.otherProfileUrl ?? null,
    location: data.location ?? null,
    notes: data.notes ?? null,
    companyId: data.companyId ?? null,
    updatedAt: Date.now(),
  }).where(eq(people.id, personId));

  revalidatePath("/people");
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
  return { success: true, message: "Contact updated" };
}

export async function deletePerson(personId: number): Promise<ActionResult> {
  // Cascade deletes outreach_records → interactions via FK
  await db.delete(people).where(eq(people.id, personId));
  revalidatePath("/people");
  revalidatePath("/");
  revalidatePath("/companies");
  return { success: true, message: "Contact deleted" };
}

export async function getDirectorySummary() {
  const row = sqlite.raw.prepare(`
    SELECT
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN o.status = 'not_contacted' OR o.id IS NULL THEN p.id END) as not_contacted,
      COUNT(DISTINCT CASE WHEN o.status IN ('message_sent','message_drafted') THEN p.id END) as messaged,
      COUNT(DISTINCT CASE WHEN o.status = 'awaiting_reply' THEN p.id END) as awaiting,
      COUNT(DISTINCT CASE WHEN o.next_follow_up_at IS NOT NULL AND o.next_follow_up_at <= ? THEN p.id END) as followup_due,
      COUNT(DISTINCT CASE WHEN o.status IN ('interview_discussion','shortlisted','selected_offer') THEN p.id END) as positive
    FROM people p
    LEFT JOIN outreach_records o ON o.person_id = p.id AND o.id = (
      SELECT id FROM outreach_records WHERE person_id = p.id ORDER BY created_at DESC LIMIT 1
    )
  `).get(new Date().setHours(23, 59, 59, 999)) as Record<string, number>;

  return {
    total: Number(row.total),
    notContacted: Number(row.not_contacted),
    messaged: Number(row.messaged),
    awaiting: Number(row.awaiting),
    followupDue: Number(row.followup_due),
    positive: Number(row.positive),
  };
}
