import type {
  answerBank,
  applications,
  applyQueue,
  automationRuns,
  companies,
  emailDrafts,
  interactions,
  jobMatches,
  jobSources,
  jobs,
  messageTemplates,
  opportunities,
  outreachRecords,
  people,
  personJobs,
  providerUsage,
  resumeProfiles,
  resumes,
  searchProfiles,
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

export type SearchProfile = typeof searchProfiles.$inferSelect;
export type NewSearchProfile = typeof searchProfiles.$inferInsert;

export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;

export type ResumeProfile = typeof resumeProfiles.$inferSelect;
export type NewResumeProfile = typeof resumeProfiles.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type JobSource = typeof jobSources.$inferSelect;
export type NewJobSource = typeof jobSources.$inferInsert;

export type JobMatch = typeof jobMatches.$inferSelect;
export type NewJobMatch = typeof jobMatches.$inferInsert;

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

export type ApplyQueueItem = typeof applyQueue.$inferSelect;
export type NewApplyQueueItem = typeof applyQueue.$inferInsert;

export type AnswerBankEntry = typeof answerBank.$inferSelect;
export type NewAnswerBankEntry = typeof answerBank.$inferInsert;

export type EmailDraft = typeof emailDrafts.$inferSelect;
export type NewEmailDraft = typeof emailDrafts.$inferInsert;

export type ProviderUsage = typeof providerUsage.$inferSelect;
export type NewProviderUsage = typeof providerUsage.$inferInsert;

export type AutomationRun = typeof automationRuns.$inferSelect;
export type NewAutomationRun = typeof automationRuns.$inferInsert;

export type PersonJob = typeof personJobs.$inferSelect;
export type NewPersonJob = typeof personJobs.$inferInsert;

/** A search profile with JSON columns decoded for UI use. */
export interface SearchProfileView
  extends Omit<SearchProfile, "titles" | "keywords" | "locations" | "excludedKeywords"> {
  titles: string[];
  keywords: string[];
  locations: string[];
  excludedKeywords: string[];
}

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
