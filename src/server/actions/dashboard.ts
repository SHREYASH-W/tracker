"use server";
import { sqlite } from "@/db";
import type { DashboardStats, StatusDistribution, CompanyBreakdown } from "@/lib/types";
import { getStatusDef } from "@/lib/constants";

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const row = sqlite.raw.prepare(`
    SELECT
      (SELECT COUNT(*) FROM people) as total_people,
      (SELECT COUNT(*) FROM companies) as total_companies,
      COUNT(CASE WHEN o.status IN ('message_sent','message_drafted','awaiting_reply','replied','follow_up_needed','interview_discussion','shortlisted','selected_offer','rejected','not_interested') THEN 1 END) as messages_sent,
      COUNT(CASE WHEN o.status = 'awaiting_reply' THEN 1 END) as awaiting_replies,
      COUNT(CASE WHEN o.next_follow_up_at IS NOT NULL AND o.next_follow_up_at <= ? THEN 1 END) as followups_due,
      COUNT(CASE WHEN o.status = 'interview_discussion' THEN 1 END) as interviews,
      COUNT(CASE WHEN o.status IN ('interview_discussion','shortlisted','selected_offer') THEN 1 END) as positive,
      COUNT(CASE WHEN o.status IN ('rejected','not_interested') THEN 1 END) as rejections
    FROM outreach_records o
  `).get(todayEnd.getTime()) as Record<string, number>;

  return {
    totalPeople: Number(row.total_people),
    totalCompanies: Number(row.total_companies),
    messagesSent: Number(row.messages_sent),
    awaitingReplies: Number(row.awaiting_replies),
    followUpsDue: Number(row.followups_due),
    interviews: Number(row.interviews),
    positiveOutcomes: Number(row.positive),
    rejections: Number(row.rejections),
  };
}

export async function getStatusDistribution(): Promise<StatusDistribution[]> {
  const rows = sqlite.raw.prepare(`
    SELECT
      COALESCE(o.status, 'not_contacted') as status,
      COUNT(*) as cnt
    FROM people p
    LEFT JOIN outreach_records o ON o.person_id = p.id AND o.id = (
      SELECT id FROM outreach_records WHERE person_id = p.id ORDER BY created_at DESC LIMIT 1
    )
    GROUP BY COALESCE(o.status, 'not_contacted')
    ORDER BY cnt DESC
  `).all() as { status: string; cnt: number }[];

  return rows.map((r) => {
    const def = getStatusDef(r.status);
    return {
      status: r.status,
      label: def.label,
      count: Number(r.cnt),
      category: def.category,
    };
  });
}

export async function getCompanyBreakdown(limit = 8): Promise<CompanyBreakdown[]> {
  return (sqlite.raw.prepare(`
    SELECT
      c.id as company_id,
      c.name as company_name,
      COUNT(DISTINCT p.id) as contact_count
    FROM companies c
    JOIN people p ON p.company_id = c.id
    GROUP BY c.id
    ORDER BY contact_count DESC
    LIMIT ?
  `).all(limit) as { company_id: number; company_name: string; contact_count: number }[]).map((r) => ({
    companyId: r.company_id,
    companyName: r.company_name,
    contactCount: Number(r.contact_count),
  }));
}

export async function getRecentActivity(limit = 10) {
  return sqlite.raw.prepare(`
    SELECT
      i.id,
      i.occurred_at as ts,
      i.interaction_type,
      i.summary,
      p.full_name as person_name,
      p.id as person_id,
      c.name as company_name
    FROM interactions i
    JOIN outreach_records o ON o.id = i.outreach_record_id
    JOIN people p ON p.id = o.person_id
    LEFT JOIN companies c ON c.id = p.company_id
    ORDER BY i.occurred_at DESC
    LIMIT ?
  `).all(limit) as {
    id: number; ts: number; interaction_type: string; summary: string | null;
    person_name: string; person_id: number; company_name: string | null;
  }[];
}

export async function getTopFollowUps(limit = 5) {
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  return sqlite.raw.prepare(`
    SELECT
      o.id as outreach_id,
      o.person_id,
      o.next_follow_up_at,
      o.purpose,
      o.status,
      p.full_name,
      c.name as company_name
    FROM outreach_records o
    JOIN people p ON p.id = o.person_id
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE o.next_follow_up_at IS NOT NULL AND o.next_follow_up_at <= ?
    ORDER BY o.next_follow_up_at ASC
    LIMIT ?
  `).all(todayEnd.getTime(), limit) as {
    outreach_id: number; person_id: number; next_follow_up_at: number;
    purpose: string; status: string; full_name: string; company_name: string | null;
  }[];
}
