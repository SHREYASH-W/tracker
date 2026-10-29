"use server";
import { revalidatePath } from "next/cache";
import { db, sqlite } from "@/db";
import { interactions, outreachRecords } from "@/db/schema";
import { desc, eq, and, lte, gte, isNotNull } from "drizzle-orm";
import { interactionSchema, outreachSchema, statusUpdateSchema } from "@/lib/validators";
import type { ActionResult, FollowUpItem } from "@/lib/types";

export async function createOutreachRecord(formData: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = outreachSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }
  const data = parsed.data;
  const result = await db.insert(outreachRecords).values({
    personId: data.personId,
    opportunityId: data.opportunityId ?? null,
    purpose: data.purpose,
    targetRole: data.targetRole ?? null,
    channel: data.channel ?? null,
    status: data.status,
    firstContactedAt: data.firstContactedAt ?? null,
    lastContactedAt: data.firstContactedAt ?? null,
    lastResponseAt: data.lastResponseAt ?? null,
    nextFollowUpAt: data.nextFollowUpAt ?? null,
    notes: data.notes ?? null,
  }).returning({ id: outreachRecords.id });

  revalidatePath("/people");
  revalidatePath(`/people/${data.personId}`);
  revalidatePath("/");
  return { success: true, message: "Outreach record created", data: { id: result[0]!.id } };
}

export async function updateOutreachStatus(formData: unknown): Promise<ActionResult> {
  const parsed = statusUpdateSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }
  const { outreachId, status, note } = parsed.data;

  // Get the current outreach record to know the person
  const current = await db.select().from(outreachRecords).where(eq(outreachRecords.id, outreachId)).limit(1);
  if (!current[0]) return { success: false, message: "Outreach record not found" };

  const oldStatus = current[0].status;
  if (oldStatus === status) return { success: true, message: "Status unchanged" };

  // Update status
  await db.update(outreachRecords).set({
    status,
    updatedAt: Date.now(),
  }).where(eq(outreachRecords.id, outreachId));

  // Log status change as an interaction
  await db.insert(interactions).values({
    outreachRecordId: outreachId,
    interactionType: "Note",
    occurredAt: Date.now(),
    summary: note
      ? `Status changed from "${oldStatus}" to "${status}". Note: ${note}`
      : `Status changed from "${oldStatus}" to "${status}"`,
    outcome: status,
  });

  revalidatePath("/people");
  revalidatePath(`/people/${current[0].personId}`);
  revalidatePath("/");
  revalidatePath("/follow-ups");
  return { success: true, message: "Status updated" };
}

export async function logInteraction(formData: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = interactionSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: "Validation failed", error: parsed.error.errors[0]?.message };
  }
  const data = parsed.data;

  // Get associated person for cache invalidation
  const outreach = await db.select().from(outreachRecords)
    .where(eq(outreachRecords.id, data.outreachRecordId)).limit(1);
  if (!outreach[0]) return { success: false, message: "Outreach record not found" };

  const result = await db.insert(interactions).values({
    outreachRecordId: data.outreachRecordId,
    interactionType: data.interactionType,
    channel: data.channel ?? null,
    occurredAt: data.occurredAt,
    summary: data.summary ?? null,
    outcome: data.outcome ?? null,
    nextFollowUpAt: data.nextFollowUpAt ?? null,
  }).returning({ id: interactions.id });

  // Update outreach record timestamps and follow-up
  await db.update(outreachRecords).set({
    lastContactedAt: data.occurredAt,
    ...(data.nextFollowUpAt ? { nextFollowUpAt: data.nextFollowUpAt } : {}),
    updatedAt: Date.now(),
  }).where(eq(outreachRecords.id, data.outreachRecordId));

  revalidatePath("/people");
  revalidatePath(`/people/${outreach[0].personId}`);
  revalidatePath("/activity");
  revalidatePath("/follow-ups");
  revalidatePath("/");
  return { success: true, message: "Interaction logged", data: { id: result[0]!.id } };
}

export async function completeFollowUp(outreachId: number): Promise<ActionResult> {
  const current = await db.select().from(outreachRecords).where(eq(outreachRecords.id, outreachId)).limit(1);
  if (!current[0]) return { success: false, message: "Not found" };

  await db.update(outreachRecords).set({
    nextFollowUpAt: null,
    updatedAt: Date.now(),
  }).where(eq(outreachRecords.id, outreachId));

  await db.insert(interactions).values({
    outreachRecordId: outreachId,
    interactionType: "Note",
    occurredAt: Date.now(),
    summary: "Follow-up marked as complete",
  });

  revalidatePath("/follow-ups");
  revalidatePath("/people");
  revalidatePath(`/people/${current[0].personId}`);
  revalidatePath("/");
  return { success: true, message: "Follow-up completed" };
}

export async function rescheduleFollowUp(outreachId: number, nextFollowUpAt: number): Promise<ActionResult> {
  const current = await db.select().from(outreachRecords).where(eq(outreachRecords.id, outreachId)).limit(1);
  if (!current[0]) return { success: false, message: "Not found" };

  await db.update(outreachRecords).set({
    nextFollowUpAt,
    status: "follow_up_needed",
    updatedAt: Date.now(),
  }).where(eq(outreachRecords.id, outreachId));

  revalidatePath("/follow-ups");
  revalidatePath("/people");
  revalidatePath(`/people/${current[0].personId}`);
  return { success: true, message: "Follow-up rescheduled" };
}

export async function getFollowUps(): Promise<{
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  soon: FollowUpItem[];
  later: FollowUpItem[];
}> {
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const soonEnd = now + 7 * 86400000;

  const rows = sqlite.raw.prepare(`
    SELECT
      o.id as outreach_id, o.person_id, o.purpose, o.status,
      o.last_contacted_at, o.next_follow_up_at,
      p.full_name, p.company_id,
      c.name as company_name
    FROM outreach_records o
    JOIN people p ON p.id = o.person_id
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE o.next_follow_up_at IS NOT NULL
    ORDER BY o.next_follow_up_at ASC
  `).all() as {
    outreach_id: number; person_id: number; purpose: string; status: string;
    last_contacted_at: number | null; next_follow_up_at: number;
    full_name: string; company_id: number | null; company_name: string | null;
  }[];

  const toItem = (r: (typeof rows)[0]): FollowUpItem => ({
    outreachId: r.outreach_id,
    personId: r.person_id,
    personName: r.full_name,
    companyId: r.company_id,
    companyName: r.company_name,
    purpose: r.purpose,
    status: r.status,
    lastContactedAt: r.last_contacted_at,
    nextFollowUpAt: r.next_follow_up_at,
  });

  return {
    overdue: rows.filter((r) => r.next_follow_up_at < todayStart.getTime()).map(toItem),
    today: rows.filter((r) => r.next_follow_up_at >= todayStart.getTime() && r.next_follow_up_at <= todayEnd.getTime()).map(toItem),
    soon: rows.filter((r) => r.next_follow_up_at > todayEnd.getTime() && r.next_follow_up_at <= soonEnd).map(toItem),
    later: rows.filter((r) => r.next_follow_up_at > soonEnd).map(toItem),
  };
}

export async function getActivityTimeline(limit = 50) {
  return sqlite.raw.prepare(`
    SELECT
      'interaction' as type,
      i.id,
      i.occurred_at as ts,
      p.full_name as person_name,
      c.name as company_name,
      i.interaction_type as headline,
      i.summary as detail
    FROM interactions i
    JOIN outreach_records o ON o.id = i.outreach_record_id
    JOIN people p ON p.id = o.person_id
    LEFT JOIN companies c ON c.id = p.company_id
    ORDER BY i.occurred_at DESC
    LIMIT ?
  `).all(limit) as {
    type: string; id: number; ts: number;
    person_name: string; company_name: string | null;
    headline: string; detail: string | null;
  }[];
}
