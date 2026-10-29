import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

// --- Schema map for Drizzle relational queries ---------------------------

export const schema = {
  companies,
  people,
  opportunities,
  outreachRecords,
  interactions,
  messageTemplates,
  settings,
};
