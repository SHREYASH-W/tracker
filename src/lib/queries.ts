import { desc, eq } from "drizzle-orm";
import { statSync } from "node:fs";
import { db, DB_PATH, sqlite } from "@/db";
import {
  companies,
  interactions,
  messageTemplates,
  opportunities,
  outreachRecords,
  people,
} from "@/db/schema";
import {
  POSITIVE_OUTCOME_STATUSES,
  STATUS_LIST,
  isActiveOutreachStatus,
  isClosedStatus,
} from "./constants";
import type {
  ActivityItem,
  Company,
  CompanyBreakdown,
  CompanyOption,
  CompanyWithStats,
  DashboardStats,
  FollowUpItem,
  Interaction,
  OutreachRecord,
  PersonWithRelations,
  StatusDistribution,
} from "./types";
import { endOfToday, isOverdue } from "./utils";

// --- Shared shapes ---------------------------------------------------------

export interface PeopleQueryOptions {
  q?: string;
  status?: string;
  purpose?: string;
  sort?: "recent" | "name" | "company" | "followup";
}

export interface PersonDetail {
  person: PersonWithRelations["person"];
  company: Company | null;
  outreach: OutreachRecord[];
  interactions: Interaction[];
  opportunities: (typeof opportunities.$inferSelect)[];
  companyOptions: CompanyOption[];
}

export interface CompanyDetail {
  company: Company;
  people: PersonWithRelations[];
  opportunities: (typeof opportunities.$inferSelect)[];
  interactions: (Interaction & { personName: string | null })[];
  stats: {
    peopleCount: number;
    activeOutreachCount: number;
    lastInteractionAt: number | null;
  };
}

export interface DashboardData {
  stats: DashboardStats;
  statusDistribution: StatusDistribution[];
  companyBreakdown: CompanyBreakdown[];
  followUps: FollowUpItem[];
  activity: ActivityItem[];
}

export interface SettingsOverview {
  dbPath: string;
  fileSizeBytes: number;
  schemaVersion: number;
  counts: {
    people: number;
    companies: number;
    outreach: number;
    interactions: number;
    templates: number;
  };
}

export type ActivityFilter = "all" | "interactions" | "people" | "companies";

// --- People ---------------------------------------------------------------

function primaryOutreachOf(records: OutreachRecord[]): OutreachRecord | null {
  if (records.length === 0) return null;
  return [...records].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export function getPeople(options: PeopleQueryOptions = {}): PersonWithRelations[] {
  const rows = db
    .select({
      person: people,
      company: {
        id: companies.id,
        name: companies.name,
        industry: companies.industry,
        location: companies.location,
      },
    })
    .from(people)
    .leftJoin(companies, eq(people.companyId, companies.id))
    .all();

  const allOutreach = db.select().from(outreachRecords).all();
  const outreachByPerson = new Map<number, OutreachRecord[]>();
  for (const record of allOutreach) {
    const list = outreachByPerson.get(record.personId) ?? [];
    list.push(record);
    outreachByPerson.set(record.personId, list);
  }

  let result: PersonWithRelations[] = rows.map(({ person, company }) => {
    const records = outreachByPerson.get(person.id) ?? [];
    const primary = primaryOutreachOf(records);
    const companyRow =
      company?.id != null
        ? {
            id: company.id,
            name: company.name ?? "",
            industry: company.industry ?? null,
            location: company.location ?? null,
          }
        : null;

    return {
      person,
      company: companyRow,
      primaryOutreach: primary
        ? {
            id: primary.id,
            status: primary.status,
            purpose: primary.purpose,
            channel: primary.channel,
            targetRole: primary.targetRole,
            firstContactedAt: primary.firstContactedAt,
            lastContactedAt: primary.lastContactedAt,
            lastResponseAt: primary.lastResponseAt,
            nextFollowUpAt: primary.nextFollowUpAt,
          }
        : null,
      outreachCount: records.length,
    };
  });

  const q = options.q?.trim().toLowerCase();
  if (q) {
    result = result.filter(({ person, company, primaryOutreach }) => {
      const haystack = [
        person.fullName,
        person.email,
        person.jobTitle,
        person.department,
        person.location,
        person.notes,
        company?.name,
        company?.industry,
        primaryOutreach?.targetRole,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (options.status) {
    result = result.filter(({ person }) =>
      (outreachByPerson.get(person.id) ?? []).some((r) => r.status === options.status),
    );
  }

  if (options.purpose) {
    result = result.filter(({ person }) =>
      (outreachByPerson.get(person.id) ?? []).some((r) => r.purpose === options.purpose),
    );
  }

  switch (options.sort) {
    case "name":
      result.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
      break;
    case "company":
      result.sort((a, b) => (a.company?.name ?? "").localeCompare(b.company?.name ?? ""));
      break;
    case "followup":
      result.sort((a, b) => {
        const aDate = a.primaryOutreach?.nextFollowUpAt ?? Number.MAX_SAFE_INTEGER;
        const bDate = b.primaryOutreach?.nextFollowUpAt ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });
      break;
    default:
      result.sort((a, b) => b.person.updatedAt - a.person.updatedAt);
  }

  return result;
}

export function getPersonDetail(id: number): PersonDetail | null {
  const row = db
    .select({ person: people, company: companies })
    .from(people)
    .leftJoin(companies, eq(people.companyId, companies.id))
    .where(eq(people.id, id))
    .get();

  if (!row) return null;

  const outreach = db
    .select()
    .from(outreachRecords)
    .where(eq(outreachRecords.personId, id))
    .orderBy(desc(outreachRecords.updatedAt))
    .all();

  const interactionRows =
    outreach.length > 0
      ? db
          .select()
          .from(interactions)
          .orderBy(desc(interactions.occurredAt))
          .all()
          .filter((i) => outreach.some((o) => o.id === i.outreachRecordId))
      : [];

  const opportunityRows = row.person.companyId
    ? db
        .select()
        .from(opportunities)
        .where(eq(opportunities.companyId, row.person.companyId))
        .all()
    : [];

  return {
    person: {
      ...row.person,
      companyId: row.person.companyId ?? null,
    },
    company: row.company ?? null,
    outreach,
    interactions: interactionRows,
    opportunities: opportunityRows,
    companyOptions: getCompanyOptions(),
  };
}

export function getAllOutreachRecords(): OutreachRecord[] {
  return db.select().from(outreachRecords).all();
}

export function getCompanyOptions(): CompanyOption[] {
  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .orderBy(companies.name)
    .all();
}

// --- Companies ------------------------------------------------------------

export function getCompanies(): CompanyWithStats[] {
  const companyRows = db.select().from(companies).orderBy(companies.name).all();
  const personRows = db.select().from(people).all();
  const outreachRows = db.select().from(outreachRecords).all();
  const interactionRows = db
    .select({ occurredAt: interactions.occurredAt, outreachRecordId: interactions.outreachRecordId })
    .from(interactions)
    .all();

  const personById = new Map(personRows.map((p) => [p.id, p]));
  const outreachById = new Map(outreachRows.map((o) => [o.id, o]));

  return companyRows.map((company) => {
    const companyPeople = personRows.filter((p) => p.companyId === company.id);
    const personIds = new Set(companyPeople.map((p) => p.id));
    const companyOutreach = outreachRows.filter((o) => personIds.has(o.personId));
    const outreachIds = new Set(companyOutreach.map((o) => o.id));
    const companyInteractions = interactionRows.filter((i) => {
      if (outreachIds.has(i.outreachRecordId)) return true;
      const record = outreachById.get(i.outreachRecordId);
      if (!record) return false;
      const person = personById.get(record.personId);
      return person?.companyId === company.id;
    });

    return {
      company,
      peopleCount: companyPeople.length,
      activeOutreachCount: companyOutreach.filter((o) => isActiveOutreachStatus(o.status)).length,
      lastInteractionAt:
        companyInteractions.length > 0
          ? Math.max(...companyInteractions.map((i) => i.occurredAt))
          : null,
    };
  });
}

export function getCompanyDetail(id: number): CompanyDetail | null {
  const company = db.select().from(companies).where(eq(companies.id, id)).get();
  if (!company) return null;

  const companyPeople = getPeople().filter((p) => p.person.companyId === id);
  const opportunityRows = db
    .select()
    .from(opportunities)
    .where(eq(opportunities.companyId, id))
    .all();

  const outreachRows = db.select().from(outreachRecords).all();
  const personIds = new Set(companyPeople.map((p) => p.person.id));
  const personNameById = new Map(companyPeople.map((p) => [p.person.id, p.person.fullName]));
  const outreachToPerson = new Map(
    outreachRows.filter((o) => personIds.has(o.personId)).map((o) => [o.id, o.personId]),
  );
  const interactionRows = db
    .select()
    .from(interactions)
    .orderBy(desc(interactions.occurredAt))
    .all()
    .filter((i) => outreachToPerson.has(i.outreachRecordId))
    .map((i) => ({
      ...i,
      personName: personNameById.get(outreachToPerson.get(i.outreachRecordId) as number) ?? null,
    }));

  return {
    company,
    people: companyPeople,
    opportunities: opportunityRows,
    interactions: interactionRows,
    stats: {
      peopleCount: companyPeople.length,
      activeOutreachCount: outreachRows.filter(
        (o) => personIds.has(o.personId) && isActiveOutreachStatus(o.status),
      ).length,
      lastInteractionAt:
        interactionRows.length > 0 ? Math.max(...interactionRows.map((i) => i.occurredAt)) : null,
    },
  };
}

// --- Follow-ups -----------------------------------------------------------

export function getFollowUps(): FollowUpItem[] {
  const rows = db
    .select({
      outreach: outreachRecords,
      personName: people.fullName,
      companyId: companies.id,
      companyName: companies.name,
    })
    .from(outreachRecords)
    .innerJoin(people, eq(outreachRecords.personId, people.id))
    .leftJoin(companies, eq(people.companyId, companies.id))
    .all();

  return rows
    .filter((row) => row.outreach.nextFollowUpAt != null && !isClosedStatus(row.outreach.status))
    .map((row) => ({
      outreachId: row.outreach.id,
      personId: row.outreach.personId,
      personName: row.personName,
      companyId: row.companyId ?? null,
      companyName: row.companyName ?? null,
      purpose: row.outreach.purpose,
      status: row.outreach.status,
      lastContactedAt: row.outreach.lastContactedAt,
      nextFollowUpAt: row.outreach.nextFollowUpAt as number,
    }))
    .sort((a, b) => a.nextFollowUpAt - b.nextFollowUpAt);
}

// --- Activity -------------------------------------------------------------

export function getActivity(limit = 50, filter: ActivityFilter = "all"): ActivityItem[] {
  const includeInteractions = filter === "all" || filter === "interactions";
  const includePeople = filter === "all" || filter === "people";
  const includeCompanies = filter === "all" || filter === "companies";

  const items: ActivityItem[] = [];

  if (includeInteractions) {
    const rows = db
      .select({
        interaction: interactions,
        personId: people.id,
        personName: people.fullName,
        companyId: companies.id,
        companyName: companies.name,
      })
      .from(interactions)
      .innerJoin(outreachRecords, eq(interactions.outreachRecordId, outreachRecords.id))
      .innerJoin(people, eq(outreachRecords.personId, people.id))
      .leftJoin(companies, eq(people.companyId, companies.id))
      .orderBy(desc(interactions.occurredAt))
      .limit(limit)
      .all();

    for (const row of rows) {
      const summary = row.interaction.summary?.trim();
      items.push({
        type: "interaction",
        id: row.interaction.id,
        timestamp: row.interaction.occurredAt,
        personId: row.personId,
        companyId: row.companyId ?? null,
        personName: row.personName,
        companyName: row.companyName ?? null,
        summary: summary
          ? `${row.interaction.interactionType} — ${summary}`
          : row.interaction.interactionType,
        details: row.interaction.outcome ?? null,
      });
    }
  }

  if (includePeople) {
    const rows = db
      .select({ person: people, companyName: companies.name })
      .from(people)
      .leftJoin(companies, eq(people.companyId, companies.id))
      .orderBy(desc(people.createdAt))
      .limit(limit)
      .all();

    for (const row of rows) {
      items.push({
        type: "person_created",
        id: row.person.id,
        timestamp: row.person.createdAt,
        personId: row.person.id,
        companyId: row.person.companyId ?? null,
        personName: row.person.fullName,
        companyName: row.companyName ?? null,
        summary: `Added ${row.person.fullName} to the directory`,
        details: row.person.jobTitle,
      });
    }
  }

  if (includeCompanies) {
    const rows = db
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .all();

    for (const company of rows) {
      items.push({
        type: "company_created",
        id: company.id,
        timestamp: company.createdAt,
        personId: null,
        companyId: company.id,
        personName: null,
        companyName: company.name,
        summary: `Added company ${company.name}`,
        details: company.industry,
      });
    }
  }

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

// --- Dashboard ------------------------------------------------------------

export function getDashboardData(): DashboardData {
  const personRows = db.select().from(people).all();
  const companyRows = db.select().from(companies).all();
  const outreachRows = db.select().from(outreachRecords).all();
  const interactionRows = db.select().from(interactions).all();

  const messagesSent = interactionRows.filter(
    (i) => i.interactionType === "Message Sent" || i.interactionType === "Follow-up Sent",
  ).length;
  const awaitingReplies = outreachRows.filter((o) => o.status === "awaiting_reply").length;
  const dueDate = endOfToday();
  const followUpsDue = outreachRows.filter(
    (o) => o.nextFollowUpAt != null && o.nextFollowUpAt <= dueDate && !isClosedStatus(o.status),
  ).length;
  const interviews = interactionRows.filter((i) => i.interactionType === "Interview").length;
  const positiveOutcomes = outreachRows.filter((o) =>
    (POSITIVE_OUTCOME_STATUSES as string[]).includes(o.status),
  ).length;
  const rejections = outreachRows.filter((o) => o.status === "rejected").length;

  const statusDistribution: StatusDistribution[] = STATUS_LIST.map((def) => ({
    status: def.value,
    label: def.label,
    count: outreachRows.filter((o) => o.status === def.value).length,
    category: def.category,
  })).filter((entry) => entry.count > 0);

  const companyBreakdown: CompanyBreakdown[] = companyRows
    .map((company) => ({
      companyId: company.id,
      companyName: company.name,
      contactCount: personRows.filter((p) => p.companyId === company.id).length,
    }))
    .filter((entry) => entry.contactCount > 0)
    .sort((a, b) => b.contactCount - a.contactCount)
    .slice(0, 6);

  return {
    stats: {
      totalPeople: personRows.length,
      totalCompanies: companyRows.length,
      messagesSent,
      awaitingReplies,
      followUpsDue,
      interviews,
      positiveOutcomes,
      rejections,
    },
    statusDistribution,
    companyBreakdown,
    followUps: getFollowUps(),
    activity: getActivity(8),
  };
}

// --- Templates ------------------------------------------------------------

export function getTemplates() {
  return db.select().from(messageTemplates).orderBy(messageTemplates.category, messageTemplates.name).all();
}

// --- Settings -------------------------------------------------------------

export function getSettingsOverview(): SettingsOverview {
  let fileSizeBytes = 0;
  try {
    fileSizeBytes = statSync(DB_PATH).size;
  } catch {
    fileSizeBytes = 0;
  }

  let schemaVersion = 0;
  try {
    const row = sqlite
      .prepare("SELECT MAX(version) as v FROM _schema_version")
      .get() as { v: number | null } | undefined;
    schemaVersion = row?.v ?? 0;
  } catch {
    schemaVersion = 0;
  }

  return {
    dbPath: DB_PATH,
    fileSizeBytes,
    schemaVersion,
    counts: {
      people: db.select().from(people).all().length,
      companies: db.select().from(companies).all().length,
      outreach: db.select().from(outreachRecords).all().length,
      interactions: db.select().from(interactions).all().length,
      templates: db.select().from(messageTemplates).all().length,
    },
  };
}

// --- Small helpers --------------------------------------------------------

export function getDueFollowUpBuckets(followUps: FollowUpItem[]) {
  const overdue = followUps.filter((f) => isOverdue(f.nextFollowUpAt));
  const today = followUps.filter((f) => !isOverdue(f.nextFollowUpAt) && f.nextFollowUpAt <= endOfToday());
  const upcoming = followUps.filter((f) => f.nextFollowUpAt > endOfToday());
  return { overdue, today, upcoming };
}
