import { z } from "zod";
import {
  CHANNEL_VALUES,
  INTERACTION_TYPES,
  PURPOSE_VALUES,
  STATUS_VALUES,
  TEMPLATE_CATEGORIES,
} from "./constants";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .nullable()
  .optional();

const optionalUrl = z
  .string()
  .trim()
  .url("Please enter a valid URL")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v))
  .nullable()
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .email("Please enter a valid email address")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v?.toLowerCase()))
  .nullable()
  .optional();

// --- Add Contact form -----------------------------------------------------

export const addContactSchema = z.object({
  // Personal info
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(200, "Name is too long"),
  jobTitle: optionalString,
  department: optionalString,
  seniority: optionalString,
  email: optionalEmail,
  phone: optionalString,
  linkedinUrl: optionalUrl,
  otherProfileUrl: optionalUrl,
  location: optionalString,
  notes: optionalString,

  // Company
  companyName: z.string().trim().max(200, "Company name is too long").optional(),
  companyId: z.number().int().positive().optional(),
  // Company fields (used when creating new company)
  companyWebsite: optionalUrl,
  companyIndustry: optionalString,
  companyLocation: optionalString,
  companyLinkedinUrl: optionalUrl,
  companySize: optionalString,
  companyNotes: optionalString,

  // Outreach
  purpose: z.enum(PURPOSE_VALUES, { message: "Select a purpose" }),
  targetRole: optionalString,
  channel: z.enum(CHANNEL_VALUES, { message: "Select a channel" }).optional().or(z.literal("")),
  status: z.enum(STATUS_VALUES).default("not_contacted"),
  firstContactedAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + "T00:00:00").getTime() : null)),
  lastResponseAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + "T00:00:00").getTime() : null)),
  nextFollowUpAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + "T00:00:00").getTime() : null)),
  outreachNotes: optionalString,

  // Opportunity (optional)
  opportunityTitle: optionalString,
  opportunityType: optionalString,
  jobPostingUrl: optionalUrl,
}).superRefine((data, ctx) => {
  if (!data.companyId && !data.companyName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["companyName"],
      message: "Select an existing company or enter a new one",
    });
  }
});

export type AddContactFormData = z.infer<typeof addContactSchema>;

// --- Edit Person form -----------------------------------------------------

export const editPersonSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  jobTitle: optionalString,
  department: optionalString,
  seniority: optionalString,
  email: optionalEmail,
  phone: optionalString,
  linkedinUrl: optionalUrl,
  otherProfileUrl: optionalUrl,
  location: optionalString,
  notes: optionalString,
  companyId: z.number().int().positive().optional().nullable(),
});

export type EditPersonFormData = z.infer<typeof editPersonSchema>;

// --- Company form ---------------------------------------------------------

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(200),
  website: optionalUrl,
  industry: optionalString,
  location: optionalString,
  linkedinUrl: optionalUrl,
  size: optionalString,
  notes: optionalString,
});

export type CompanyFormData = z.infer<typeof companySchema>;

// --- Outreach record form --------------------------------------------------

export const outreachSchema = z.object({
  personId: z.number().int().positive(),
  opportunityId: z.number().int().positive().optional().nullable(),
  purpose: z.enum(PURPOSE_VALUES),
  targetRole: optionalString,
  channel: z.enum(CHANNEL_VALUES).optional().or(z.literal("")),
  status: z.enum(STATUS_VALUES).default("not_contacted"),
  firstContactedAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + "T00:00:00").getTime() : null)),
  lastResponseAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + "T00:00:00").getTime() : null)),
  nextFollowUpAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + "T00:00:00").getTime() : null)),
  notes: optionalString,
});

export type OutreachFormData = z.infer<typeof outreachSchema>;

// --- HR contact import -----------------------------------------------------

export const hrContactImportSchema = z.object({
  domain: z.string().trim().min(1, "Company domain is required").max(300),
  companyName: z.string().trim().max(200).optional().nullable(),
  targetRole: z.string().trim().min(1, "Add a target role before saving contacts").max(160),
  purpose: z.enum(PURPOSE_VALUES, { message: "Select an outreach type" }),
  contacts: z
    .array(
      z.object({
        email: z.string().trim().email("Invalid email address").max(320),
        fullName: z.string().trim().min(1, "Contact name is required").max(200),
        jobTitle: z.string().trim().max(200).optional().nullable(),
        department: z.string().trim().max(100).optional().nullable(),
        seniority: z.string().trim().max(100).optional().nullable(),
        linkedinUrl: z.string().trim().max(500).optional().nullable(),
        phoneNumber: z.string().trim().max(80).optional().nullable(),
      }),
    )
    .min(1, "Select at least one contact")
    .max(10, "Select at most 10 contacts"),
});

export type HrContactImportData = z.infer<typeof hrContactImportSchema>;

// --- Interaction form ------------------------------------------------------

export const interactionSchema = z.object({
  outreachRecordId: z.number().int().positive(),
  interactionType: z.enum(INTERACTION_TYPES, { message: "Select an interaction type" }),
  channel: z.enum(CHANNEL_VALUES).optional().or(z.literal("")),
  occurredAt: z
    .string()
    .min(1, "Date is required")
    .transform((v) => new Date(v + "T00:00:00").getTime()),
  summary: z.string().max(2000, "Summary is too long").optional().default(""),
  outcome: z.string().max(500).optional().default(""),
  nextFollowUpAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v + "T00:00:00").getTime() : null)),
});

export type InteractionFormData = z.infer<typeof interactionSchema>;

// --- Message template form ------------------------------------------------

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  category: z.enum(TEMPLATE_CATEGORIES).or(z.literal("Other")),
  subject: z.string().max(200).optional().default(""),
  body: z.string().trim().min(1, "Message body is required").max(5000),
});

export type TemplateFormData = z.infer<typeof templateSchema>;

// --- Status update --------------------------------------------------------

export const statusUpdateSchema = z.object({
  outreachId: z.number().int().positive(),
  status: z.enum(STATUS_VALUES),
  note: z.string().max(500).optional().default(""),
});

export type StatusUpdateFormData = z.infer<typeof statusUpdateSchema>;

// --- Follow-up reschedule -------------------------------------------------

export const rescheduleSchema = z.object({
  followUpId: z.number().int().positive(),
  nextFollowUpAt: z
    .string()
    .min(1, "Date is required")
    .transform((v) => new Date(v + "T00:00:00").getTime()),
});

export type RescheduleFormData = z.infer<typeof rescheduleSchema>;

// --- CSV import schema (for validation) -----------------------------------

export const csvRowSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  companyName: z.string().min(1),
  linkedinUrl: z.string().optional(),
  location: z.string().optional(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
});
