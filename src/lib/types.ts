import type {
  companies,
  interactions,
  messageTemplates,
  opportunities,
  outreachRecords,
  people,
  settings,
} from "@/db/schema";

// --- Infer types from schema ----------------------------------------------

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;

export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;

export type OutreachRecord = typeof outreachRecords.$inferSelect;
export type NewOutreachRecord = typeof outreachRecords.$inferInsert;

export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;

export type Setting = typeof settings.$inferSelect;

/** Minimal company shape for selectors. */
export interface CompanyOption {
  id: number;
  name: string;
}

// --- Composite view types (for directory / dashboard queries) -----------

/** A person row with their company and primary outreach info. */
export interface PersonWithRelations {
  person: Person;
  company: Pick<Company, "id" | "name" | "industry" | "location"> | null;
  primaryOutreach: {
    id: number;
    status: string;
    purpose: string;
    channel: string | null;
    targetRole: string | null;
    firstContactedAt: number | null;
    lastContactedAt: number | null;
    lastResponseAt: number | null;
    nextFollowUpAt: number | null;
  } | null;
  outreachCount: number;
}

/** A company row with aggregated stats. */
export interface CompanyWithStats {
  company: Company;
  peopleCount: number;
  activeOutreachCount: number;
  lastInteractionAt: number | null;
}

/** A follow-up item. */
export interface FollowUpItem {
  outreachId: number;
  personId: number;
  personName: string;
  companyId: number | null;
  companyName: string | null;
  purpose: string;
  status: string;
  lastContactedAt: number | null;
  nextFollowUpAt: number;
}

/** An activity timeline entry. */
export interface ActivityItem {
  type: "interaction" | "status_change" | "person_created" | "company_created";
  id: number;
  timestamp: number;
  personId?: number | null;
  companyId?: number | null;
  personName: string | null;
  companyName: string | null;
  summary: string;
  details?: string | null;
}

/** Dashboard summary stats. */
export interface DashboardStats {
  totalPeople: number;
  totalCompanies: number;
  messagesSent: number;
  awaitingReplies: number;
  followUpsDue: number;
  interviews: number;
  positiveOutcomes: number;
  rejections: number;
}

/** Status distribution for charts. */
export interface StatusDistribution {
  status: string;
  label: string;
  count: number;
  category: "neutral" | "active" | "positive" | "negative";
}

/** Company breakdown for charts. */
export interface CompanyBreakdown {
  companyId: number;
  companyName: string;
  contactCount: number;
}

/** Result of an operation. */
export interface ActionResult<T = void> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/** Duplicate detection result. */
export interface DuplicateWarning {
  personId: number;
  personName: string;
  companyName: string | null;
  matchField: "email" | "linkedin" | "name_company";
}

/** Import preview result. */
export interface ImportPreview {
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
  rows: {
    rowNumber: number;
    person: {
      fullName: string;
      email: string | null;
      jobTitle: string | null;
      companyName: string | null;
    };
    status: "valid" | "duplicate" | "invalid";
    issues: string[];
  }[];
}
