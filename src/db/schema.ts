import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// --- Timestamps helper ---------------------------------------------------

const timestamps = {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

// --- Companies ------------------------------------------------------------

export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    website: text("website"),
    industry: text("industry"),
    location: text("location"),
    linkedinUrl: text("linkedin_url"),
    size: text("size"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("companies_name_idx").on(table.name),
    index("companies_industry_idx").on(table.industry),
  ],
);

// --- People ---------------------------------------------------------------

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    department: text("department"),
    seniority: text("seniority"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    otherProfileUrl: text("other_profile_url"),
    location: text("location"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("people_company_idx").on(table.companyId),
    index("people_name_idx").on(table.fullName),
    index("people_email_idx").on(table.email),
    index("people_linkedin_idx").on(table.linkedinUrl),
    index("people_job_title_idx").on(table.jobTitle),
  ],
);

// --- Opportunities --------------------------------------------------------

export const opportunities = sqliteTable(
  "opportunities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    opportunityType: text("opportunity_type"), // Internship, Full-time, Referral, etc.
    jobPostingUrl: text("job_posting_url"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("opportunities_company_idx").on(table.companyId)],
);

// --- Outreach records -----------------------------------------------------

export const outreachRecords = sqliteTable(
  "outreach_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    opportunityId: integer("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull(), // Internship, Full-time Job, Referral, Networking, Collaboration, Other
    targetRole: text("target_role"),
    channel: text("channel"), // LinkedIn, Email, Phone, Referral, Other
    status: text("status").notNull().default("not_contacted"),
    firstContactedAt: integer("first_contacted_at"),
    lastContactedAt: integer("last_contacted_at"),
    lastResponseAt: integer("last_response_at"),
    nextFollowUpAt: integer("next_follow_up_at"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("outreach_person_idx").on(table.personId),
    index("outreach_opportunity_idx").on(table.opportunityId),
    index("outreach_status_idx").on(table.status),
    index("outreach_followup_idx").on(table.nextFollowUpAt),
  ],
);

// --- Interactions ---------------------------------------------------------

export const interactions = sqliteTable(
  "interactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    outreachRecordId: integer("outreach_record_id")
      .notNull()
      .references(() => outreachRecords.id, { onDelete: "cascade" }),
    interactionType: text("interaction_type").notNull(), // Message Sent, Reply Received, Follow-up Sent, Call, Interview, Referral, Rejection, Offer, Note
    channel: text("channel"),
    occurredAt: integer("occurred_at").notNull(),
    summary: text("summary"),
    outcome: text("outcome"),
    nextFollowUpAt: integer("next_follow_up_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("interactions_outreach_idx").on(table.outreachRecordId),
    index("interactions_occurred_idx").on(table.occurredAt),
  ],
);

// --- Message templates ----------------------------------------------------

export const messageTemplates = sqliteTable(
  "message_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    ...timestamps,
  },
  (table) => [index("templates_category_idx").on(table.category)],
);

// --- Settings (key-value store for custom statuses, preferences, etc.) ----

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// --- Search profiles ------------------------------------------------------
// The user describes a target in plain language; the pipeline expands it into
// titles and keywords. No company domain is required anywhere.

export const searchProfiles = sqliteTable(
  "search_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    // JSON string arrays.
    titles: text("titles").notNull().default("[]"),
    keywords: text("keywords").notNull().default("[]"),
    roleType: text("role_type").notNull().default("both"), // internship | full_time | both
    locations: text("locations").notNull().default("[]"),
    remoteOk: integer("remote_ok", { mode: "boolean" }).notNull().default(false),
    experienceLevel: text("experience_level").notNull().default("any"),
    excludedKeywords: text("excluded_keywords").notNull().default("[]"),
    minMatchScore: integer("min_match_score").notNull().default(60),
    autoApplyMode: text("auto_apply_mode").notNull().default("off"), // off | review | auto
    autoApplyThreshold: integer("auto_apply_threshold").notNull().default(80),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [index("search_profiles_active_idx").on(table.active)],
);

// --- Resumes --------------------------------------------------------------

export const resumes = sqliteTable(
  "resumes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [index("resumes_active_idx").on(table.isActive)],
);

export const resumeProfiles = sqliteTable(
  "resume_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    resumeId: integer("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    headline: text("headline"),
    summary: text("summary"),
    // JSON string arrays / structured objects.
    skills: text("skills").notNull().default("[]"),
    projects: text("projects").notNull().default("[]"),
    education: text("education").notNull().default("[]"),
    experience: text("experience").notNull().default("[]"),
    links: text("links").notNull().default("[]"),
    rawText: text("raw_text"),
    parsedAt: integer("parsed_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("resume_profiles_resume_idx").on(table.resumeId)],
);

// --- Jobs -----------------------------------------------------------------

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull(),
    sourceJobId: text("source_job_id"),
    title: text("title").notNull(),
    companyName: text("company_name").notNull(),
    location: text("location"),
    remote: integer("remote", { mode: "boolean" }),
    roleType: text("role_type"), // internship | full_time
    employmentType: text("employment_type"),
    description: text("description"),
    url: text("url"),
    applyUrl: text("apply_url"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency"),
    postedAt: integer("posted_at"),
    closedAt: integer("closed_at"),
    status: text("status").notNull().default("open"), // open | closed | ignored | saved | queued
    dedupeHash: text("dedupe_hash").notNull(),
    raw: text("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("jobs_dedupe_hash_idx").on(table.dedupeHash),
    index("jobs_company_idx").on(table.companyId),
    index("jobs_source_idx").on(table.source),
    index("jobs_status_idx").on(table.status),
    index("jobs_posted_idx").on(table.postedAt),
  ],
);

export const jobSources = sqliteTable(
  "job_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    kind: text("kind").notNull(), // ats | job_board | remote_board | community | aggregator
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    config: text("config").notNull().default("{}"),
    lastRunAt: integer("last_run_at"),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [uniqueIndex("job_sources_key_idx").on(table.key)],
);

export const jobMatches = sqliteTable(
  "job_matches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    profileId: integer("profile_id")
      .notNull()
      .references(() => searchProfiles.id, { onDelete: "cascade" }),
    resumeId: integer("resume_id").references(() => resumes.id, {
      onDelete: "set null",
    }),
    score: integer("score").notNull().default(0),
    breakdown: text("breakdown").notNull().default("{}"),
    explanation: text("explanation"),
    gaps: text("gaps"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("job_matches_unique_idx").on(table.jobId, table.profileId, table.resumeId),
    index("job_matches_profile_idx").on(table.profileId),
    index("job_matches_score_idx").on(table.score),
  ],
);

// --- Applications ---------------------------------------------------------

export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    resumeId: integer("resume_id").references(() => resumes.id, {
      onDelete: "set null",
    }),
    personId: integer("person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    profileId: integer("profile_id").references(() => searchProfiles.id, {
      onDelete: "set null",
    }),
    mode: text("mode").notNull().default("review"), // off | review | auto
    status: text("status").notNull().default("queued"),
    score: integer("score"),
    payload: text("payload").notNull().default("{}"),
    screenshotPath: text("screenshot_path"),
    deepLink: text("deep_link"),
    error: text("error"),
    submittedAt: integer("submitted_at"),
    ...timestamps,
  },
  (table) => [
    index("applications_job_idx").on(table.jobId),
    index("applications_status_idx").on(table.status),
  ],
);

export const applyQueue = sqliteTable(
  "apply_queue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    profileId: integer("profile_id")
      .notNull()
      .references(() => searchProfiles.id, { onDelete: "cascade" }),
    resumeId: integer("resume_id").references(() => resumes.id, {
      onDelete: "set null",
    }),
    applicationId: integer("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextAttemptAt: integer("next_attempt_at"),
    lastError: text("last_error"),
    deepLink: text("deep_link"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("apply_queue_job_profile_idx").on(table.jobId, table.profileId),
    index("apply_queue_status_idx").on(table.status),
    index("apply_queue_next_attempt_idx").on(table.nextAttemptAt),
  ],
);

export const answerBank = sqliteTable(
  "answer_bank",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: text("category"),
    ...timestamps,
  },
  (table) => [uniqueIndex("answer_bank_key_idx").on(table.key)],
);

// --- Outreach drafts ------------------------------------------------------

export const emailDrafts = sqliteTable(
  "email_drafts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    outreachId: integer("outreach_id").references(() => outreachRecords.id, {
      onDelete: "set null",
    }),
    jobId: integer("job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    templateId: integer("template_id").references(() => messageTemplates.id, {
      onDelete: "set null",
    }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("draft"), // draft | approved | sent | rejected
    model: text("model"),
    approvedAt: integer("approved_at"),
    sentAt: integer("sent_at"),
    ...timestamps,
  },
  (table) => [
    index("email_drafts_person_idx").on(table.personId),
    index("email_drafts_status_idx").on(table.status),
  ],
);

// --- Provider quota tracking ---------------------------------------------

export const providerUsage = sqliteTable(
  "provider_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    day: text("day").notNull(), // UTC YYYY-MM-DD
    count: integer("count").notNull().default(0),
    quotaLimit: integer("quota_limit"),
    metadata: text("metadata").notNull().default("{}"),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("provider_usage_unique_idx").on(table.provider, table.operation, table.day),
    index("provider_usage_day_idx").on(table.day),
  ],
);

// --- Automation run logs --------------------------------------------------

export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(), // ingest | discover | draft | apply | worker
    status: text("status").notNull().default("queued"),
    profileId: integer("profile_id").references(() => searchProfiles.id, {
      onDelete: "set null",
    }),
    stats: text("stats").notNull().default("{}"),
    log: text("log"),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at"),
    ...timestamps,
  },
  (table) => [
    index("automation_runs_kind_idx").on(table.kind),
    index("automation_runs_status_idx").on(table.status),
  ],
);

// --- Person ↔ job relevance links ---------------------------------------

export const personJobs = sqliteTable(
  "person_jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    relevance: text("relevance"), // recruiter | hiring_manager | engineer | other
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("person_jobs_unique_idx").on(table.personId, table.jobId),
    index("person_jobs_job_idx").on(table.jobId),
  ],
);

// --- Schema map for Drizzle relational queries ---------------------------

export const schema = {
  companies,
  people,
  opportunities,
  outreachRecords,
  interactions,
  messageTemplates,
  settings,
  searchProfiles,
  resumes,
  resumeProfiles,
  jobs,
  jobSources,
  jobMatches,
  applications,
  applyQueue,
  answerBank,
  emailDrafts,
  providerUsage,
  automationRuns,
  personJobs,
};
