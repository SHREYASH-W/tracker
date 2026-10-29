"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, sqlite } from "@/db";
import {
  companies,
  interactions,
  messageTemplates,
  opportunities,
  outreachRecords,
  people,
} from "@/db/schema";
import { PURPOSE_VALUES, STATUS_VALUES, isClosedStatus } from "./constants";
import {
  EMAIL_PROVIDER_LABELS,
  isEmailProvider,
  normalizeEmailDomain,
  type EmailLookupResult,
  type HrSearchResult,
} from "./email-lookup";
import { HunterApiError, findHunterEmail, findHunterHrContacts } from "./hunter";
import { ProspeoApiError, findProspeoEmail } from "./prospeo";
import { EnrichLayerApiError, findEnrichLayerEmail } from "./enrichlayer";
import type { FormState, CsvImportRow, HrContactImportSummary, ImportSummary } from "./action-types";
import { getCompanyOptions } from "./queries";
import type { ActionResult, CompanyOption } from "./types";
import { normalizeEmail, normalizeUrl } from "./utils";
import {
  addContactSchema,
  companySchema,
  csvRowSchema,
  editPersonSchema,
  hrContactImportSchema,
  interactionSchema,
  outreachSchema,
  statusUpdateSchema,
  templateSchema,
  type HrContactImportData,
} from "./validators";

// --- Helpers --------------------------------------------------------------

function refreshAll() {
  revalidatePath("/", "layout");
}

function formError(error: z.ZodError): FormState {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (errors[key] ??= []).push(issue.message);
    }
  }
  return {
    success: false,
    message: "Please fix the highlighted fields.",
    errors,
  };
}

function failed<T = void>(message: string): ActionResult<T> {
  return { success: false, message, error: message };
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toOutreachInput(formData: FormData) {
  return {
    personId: Number(field(formData, "personId")) || 0,
    opportunityId: optionalNumber(formData.get("opportunityId")),
    purpose: field(formData, "purpose"),
    targetRole: field(formData, "targetRole"),
    channel: field(formData, "channel"),
    status: field(formData, "status") || "not_contacted",
    firstContactedAt: field(formData, "firstContactedAt"),
    lastResponseAt: field(formData, "lastResponseAt"),
    nextFollowUpAt: field(formData, "nextFollowUpAt"),
    notes: field(formData, "notes"),
  };
}

function nextStatusForInteraction(type: string, current: string): string {
  const closed = isClosedStatus(current);
  switch (type) {
    case "Message Sent":
      if (closed) return current;
      return current === "not_contacted" || current === "message_drafted"
        ? "awaiting_reply"
        : current;
    case "Follow-up Sent":
      return closed ? current : "awaiting_reply";
    case "Reply Received":
      return closed ? current : "replied";
    case "Interview":
      return "interview_discussion";
    case "Rejection":
      return "rejected";
    case "Offer":
      return "selected_offer";
    default:
      return current;
  }
}

const CONTACT_TYPES = new Set(["Message Sent", "Follow-up Sent", "Call", "Interview", "Referral"]);
const RESPONSE_TYPES = new Set(["Reply Received", "Call", "Interview", "Rejection", "Offer"]);

// --- Contacts -------------------------------------------------------------

export async function createContactAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    fullName: field(formData, "fullName"),
    jobTitle: field(formData, "jobTitle"),
    department: field(formData, "department"),
    seniority: field(formData, "seniority"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    linkedinUrl: field(formData, "linkedinUrl"),
    otherProfileUrl: field(formData, "otherProfileUrl"),
    location: field(formData, "location"),
    notes: field(formData, "notes"),
    companyName: field(formData, "companyName"),
    companyId: optionalNumber(formData.get("companyId")),
    companyWebsite: field(formData, "companyWebsite"),
    companyIndustry: field(formData, "companyIndustry"),
    companyLocation: field(formData, "companyLocation"),
    companyLinkedinUrl: field(formData, "companyLinkedinUrl"),
    companySize: field(formData, "companySize"),
    companyNotes: field(formData, "companyNotes"),
    purpose: field(formData, "purpose"),
    targetRole: field(formData, "targetRole"),
    channel: field(formData, "channel"),
    status: field(formData, "status") || "not_contacted",
    firstContactedAt: field(formData, "firstContactedAt"),
    lastResponseAt: field(formData, "lastResponseAt"),
    nextFollowUpAt: field(formData, "nextFollowUpAt"),
    outreachNotes: field(formData, "outreachNotes"),
    opportunityTitle: field(formData, "opportunityTitle"),
    opportunityType: field(formData, "opportunityType"),
    jobPostingUrl: field(formData, "jobPostingUrl"),
  };

  const parsed = addContactSchema.safeParse(raw);
  if (!parsed.success) return formError(parsed.error);

  const data = parsed.data;
  const email = normalizeEmail(data.email);
  if (email) {
    const existing = db.select().from(people).all().find((p) => normalizeEmail(p.email) === email);
    if (existing) {
      return {
        success: false,
        message: `A contact with this email already exists: ${existing.fullName}.`,
        errors: { email: ["This email is already in use."] },
      };
    }
  }

  try {
    sqlite.exec("BEGIN");

    let companyId: number | null = data.companyId ?? null;
    if (!companyId && data.companyName) {
      const name = data.companyName;
      const existingCompany = db
        .select()
        .from(companies)
        .all()
        .find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const created = db
          .insert(companies)
          .values({
            name,
            website: normalizeUrl(data.companyWebsite),
            industry: data.companyIndustry ?? null,
            location: data.companyLocation ?? null,
            linkedinUrl: normalizeUrl(data.companyLinkedinUrl),
            size: data.companySize ?? null,
            notes: data.companyNotes ?? null,
          })
          .returning({ id: companies.id })
          .get();
        companyId = created?.id ?? null;
      }
    }

    const personRow = db
      .insert(people)
      .values({
        companyId,
        fullName: data.fullName,
        jobTitle: data.jobTitle ?? null,
        department: data.department ?? null,
        seniority: data.seniority ?? null,
        email,
        phone: data.phone ?? null,
        linkedinUrl: normalizeUrl(data.linkedinUrl),
        otherProfileUrl: normalizeUrl(data.otherProfileUrl),
        location: data.location ?? null,
        notes: data.notes ?? null,
      })
      .returning({ id: people.id })
      .get();

    if (!personRow) throw new Error("Failed to create contact");

    let opportunityId: number | null = null;
    if (companyId && data.opportunityTitle) {
      const opportunityRow = db
        .insert(opportunities)
        .values({
          companyId,
          title: data.opportunityTitle,
          opportunityType: data.opportunityType ?? null,
          jobPostingUrl: normalizeUrl(data.jobPostingUrl),
        })
        .returning({ id: opportunities.id })
        .get();
      opportunityId = opportunityRow?.id ?? null;
    }

    db.insert(outreachRecords)
      .values({
        personId: personRow.id,
        opportunityId,
        purpose: data.purpose,
        targetRole: data.targetRole ?? null,
        channel: data.channel || null,
        status: data.status,
        firstContactedAt: data.firstContactedAt ?? null,
        lastContactedAt: data.firstContactedAt ?? null,
        lastResponseAt: data.lastResponseAt ?? null,
        nextFollowUpAt: data.nextFollowUpAt ?? null,
        notes: data.outreachNotes ?? null,
      })
      .run();

    sqlite.exec("COMMIT");
    refreshAll();

    return {
      success: true,
      message: `${data.fullName} was added to your contacts.`,
      personId: personRow.id,
      companyId: companyId ?? undefined,
    };
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors — the transaction may already be closed.
    }
    console.error("createContactAction failed", error);
    return { success: false, message: "Could not create the contact. Please try again." };
  }
}

export async function updatePersonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = optionalNumber(formData.get("id"));
  if (!id) return { success: false, message: "Missing contact id." };

  const raw = {
    fullName: field(formData, "fullName"),
    jobTitle: field(formData, "jobTitle"),
    department: field(formData, "department"),
    seniority: field(formData, "seniority"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    linkedinUrl: field(formData, "linkedinUrl"),
    otherProfileUrl: field(formData, "otherProfileUrl"),
    location: field(formData, "location"),
    notes: field(formData, "notes"),
    companyId: optionalNumber(formData.get("companyId")) ?? null,
  };

  const parsed = editPersonSchema.safeParse(raw);
  if (!parsed.success) return formError(parsed.error);

  const data = parsed.data;
  try {
    db.update(people)
      .set({
        fullName: data.fullName,
        jobTitle: data.jobTitle ?? null,
        department: data.department ?? null,
        seniority: data.seniority ?? null,
        email: normalizeEmail(data.email),
        phone: data.phone ?? null,
        linkedinUrl: normalizeUrl(data.linkedinUrl),
        otherProfileUrl: normalizeUrl(data.otherProfileUrl),
        location: data.location ?? null,
        notes: data.notes ?? null,
        companyId: data.companyId ?? null,
        updatedAt: Date.now(),
      })
      .where(eq(people.id, id))
      .run();

    refreshAll();
    return { success: true, message: "Contact updated." };
  } catch (error) {
    console.error("updatePersonAction failed", error);
    return { success: false, message: "Could not update the contact." };
  }
}

export async function deletePersonAction(id: number): Promise<ActionResult> {
  try {
    db.delete(people).where(eq(people.id, id)).run();
    refreshAll();
    return { success: true, message: "Contact deleted." };
  } catch (error) {
    console.error("deletePersonAction failed", error);
    return failed("Could not delete the contact.");
  }
}

// --- Email enrichment -----------------------------------------------------

export async function emailLookupAction(
  personId: number,
  provider: string,
  domainInput: string,
): Promise<ActionResult<EmailLookupResult>> {
  if (!isEmailProvider(provider)) return failed("Choose a valid email provider.");

  const person = db.select().from(people).where(eq(people.id, personId)).get();
  if (!person) return failed("Contact not found.");

  const domain = normalizeEmailDomain(domainInput);
  if (!domain) return failed("Enter a valid company domain, like example.com.");

  const label = EMAIL_PROVIDER_LABELS[provider];

  try {
    const result =
      provider === "prospeo"
        ? await findProspeoEmail({
            fullName: person.fullName,
            domain,
            linkedinUrl: person.linkedinUrl,
          })
        : provider === "enrichlayer"
          ? await findEnrichLayerEmail({ fullName: person.fullName, domain })
          : await findHunterEmail({ fullName: person.fullName, domain });

    if (!result) {
      return {
        success: true,
        message: `${label} could not find an email for ${person.fullName} at ${domain}.`,
      };
    }
    return { success: true, message: `${label} found ${result.email}.`, data: result };
  } catch (error) {
    if (error instanceof HunterApiError) {
      if (error.status === 401 || error.status === 403) {
        return failed("Hunter rejected the API key. Check HUNTER_API_KEY in .env.local.");
      }
      if (error.status === 429) {
        return failed("Hunter's rate limit was reached. Try again later.");
      }
      return failed(error.message);
    }
    if (error instanceof ProspeoApiError) {
      if (error.status === 401 || error.status === 403 || error.code === "INVALID_API_KEY") {
        return failed("Prospeo rejected the API key. Check PROSPEO_API_KEY in .env.local.");
      }
      if (error.status === 429) {
        return failed("Prospeo's rate limit was reached. Try again later.");
      }
      return failed(error.message);
    }
    if (error instanceof EnrichLayerApiError) {
      if (error.status === 401 || error.status === 403 || error.code === "unauthorized") {
        return failed("Enrich Layer rejected the API token. Check ENRICH_LAYER_API_KEY in .env.local.");
      }
      if (error.status === 429) {
        return failed("Enrich Layer's rate limit was reached. Try again later.");
      }
      if (error.code === "out_of_credits") {
        return failed("Your Enrich Layer account is out of credits. Add credits or use Hunter or Prospeo instead.");
      }
      return failed(error.message);
    }
    console.error("emailLookupAction failed", error);
    return failed(`Could not query ${label}. Please try again.`);
  }
}

export async function saveFoundEmailAction(
  personId: number,
  emailInput: string,
): Promise<ActionResult> {
  const parsed = z.string().trim().email().safeParse(emailInput);
  if (!parsed.success) return failed("The provider returned an invalid email address.");

  const email = normalizeEmail(parsed.data);
  if (!email) return failed("The provider returned an invalid email address.");

  const person = db.select().from(people).where(eq(people.id, personId)).get();
  if (!person) return failed("Contact not found.");

  const duplicate = db
    .select()
    .from(people)
    .all()
    .find((row) => row.id !== personId && normalizeEmail(row.email) === email);
  if (duplicate) {
    return failed(`This email already belongs to ${duplicate.fullName}.`);
  }

  try {
    db.update(people)
      .set({ email, updatedAt: Date.now() })
      .where(eq(people.id, personId))
      .run();
    refreshAll();
    return { success: true, message: `Email saved for ${person.fullName}.` };
  } catch (error) {
    console.error("saveFoundEmailAction failed", error);
    return failed("Could not save the email.");
  }
}

// --- HR contacts ----------------------------------------------------------

export async function findHrContactsAction(
  domainInput: string,
): Promise<ActionResult<HrSearchResult>> {
  const domain = normalizeEmailDomain(domainInput);
  if (!domain) return failed("Enter a valid company domain, like example.com.");

  try {
    const result = await findHunterHrContacts({ domain });
    if (result.contacts.length === 0) {
      return {
        success: true,
        message: `Hunter found no HR or recruiting contacts at ${domain}.`,
        data: result,
      };
    }
    return {
      success: true,
      message: `Found ${result.contacts.length} HR ${
        result.contacts.length === 1 ? "contact" : "contacts"
      } at ${result.organization ?? domain}.`,
      data: result,
    };
  } catch (error) {
    if (error instanceof HunterApiError) {
      if (error.status === 401 || error.status === 403) {
        return failed("Hunter rejected the API key. Check HUNTER_API_KEY in .env.local.");
      }
      if (error.status === 429) {
        return failed("Hunter's rate limit was reached. Try again later.");
      }
      return failed(error.message);
    }
    console.error("findHrContactsAction failed", error);
    return failed("Could not search Hunter. Please try again.");
  }
}

export async function addHrContactsAction(
  input: HrContactImportData,
): Promise<ActionResult<HrContactImportSummary>> {
  const parsed = hrContactImportSchema.safeParse(input);
  if (!parsed.success) {
    return failed(parsed.error.issues[0]?.message ?? "Check the selected contacts and try again.");
  }

  const data = parsed.data;
  const domain = normalizeEmailDomain(data.domain);
  if (!domain) return failed("Enter a valid company domain, like example.com.");

  try {
    const companyRows = db.select().from(companies).all();
    let company = companyRows.find((row) => normalizeEmailDomain(row.website) === domain) ?? null;
    if (!company && data.companyName) {
      const nameKey = data.companyName.trim().toLowerCase();
      company = companyRows.find((row) => row.name.trim().toLowerCase() === nameKey) ?? null;
    }

    const existingPeople = db.select().from(people).all();
    const existingEmails = new Set(
      existingPeople.map((row) => normalizeEmail(row.email)).filter(Boolean) as string[],
    );
    const namesInCompany = new Set(
      company
        ? existingPeople
            .filter((row) => row.companyId === company.id)
            .map((row) => row.fullName.trim().toLowerCase())
        : [],
    );

    const seen = new Set<string>();
    const pending: typeof data.contacts = [];
    const skippedEmails: string[] = [];

    for (const contact of data.contacts) {
      const email = normalizeEmail(contact.email);
      if (!email) continue;
      const nameKey = contact.fullName.trim().toLowerCase();
      if (seen.has(email) || existingEmails.has(email) || namesInCompany.has(nameKey)) {
        skippedEmails.push(email);
        continue;
      }
      seen.add(email);
      pending.push(contact);
    }

    const summary: HrContactImportSummary = {
      added: 0,
      skipped: skippedEmails.length,
      addedEmails: [],
      skippedEmails,
      companyId: company?.id ?? null,
    };

    if (pending.length === 0) {
      return {
        success: true,
        message:
          skippedEmails.length > 0
            ? "Those contacts are already in your CRM."
            : "No contacts to add.",
        data: summary,
      };
    }

    sqlite.exec("BEGIN");

    let companyId = company?.id ?? null;
    if (!companyId) {
      const created = db
        .insert(companies)
        .values({
          name: data.companyName?.trim() || domain,
          website: `https://${domain}`,
        })
        .returning({ id: companies.id })
        .get();
      companyId = created?.id ?? null;
    }
    if (!companyId) throw new Error("Failed to create company");

    for (const contact of pending) {
      const email = normalizeEmail(contact.email);
      if (!email) continue;

      const personRow = db
        .insert(people)
        .values({
          companyId,
          fullName: contact.fullName.trim(),
          jobTitle: contact.jobTitle ?? null,
          department: contact.department ?? null,
          seniority: contact.seniority ?? null,
          email,
          phone: contact.phoneNumber ?? null,
          linkedinUrl: normalizeUrl(contact.linkedinUrl),
        })
        .returning({ id: people.id })
        .get();
      if (!personRow) throw new Error("Failed to create contact");

      db.insert(outreachRecords)
        .values({
          personId: personRow.id,
          purpose: data.purpose,
          targetRole: data.targetRole,
          channel: "Email",
          status: "not_contacted",
        })
        .run();

      summary.added++;
      summary.addedEmails.push(email);
    }

    summary.companyId = companyId;
    sqlite.exec("COMMIT");
    refreshAll();

    const displayName = data.companyName?.trim() || domain;
    const parts = [
      `${summary.added} ${summary.added === 1 ? "contact" : "contacts"} added to ${displayName}`,
    ];
    if (summary.skipped > 0) {
      parts.push(`${summary.skipped} already in your CRM`);
    }
    return { success: true, message: `${parts.join(", ")}.`, data: summary };
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }
    console.error("addHrContactsAction failed", error);
    return failed("Could not add the HR contacts. Please try again.");
  }
}

// --- Outreach -------------------------------------------------------------

export async function createOutreachAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = outreachSchema.safeParse(toOutreachInput(formData));
  if (!parsed.success) return formError(parsed.error);

  const data = parsed.data;
  try {
    const firstContactedAt = data.firstContactedAt ?? null;
    const status = data.status;
    db.insert(outreachRecords)
      .values({
        personId: data.personId,
        opportunityId: data.opportunityId ?? null,
        purpose: data.purpose,
        targetRole: data.targetRole ?? null,
        channel: data.channel || null,
        status,
        firstContactedAt,
        lastContactedAt:
          status !== "not_contacted" && status !== "message_drafted" ? firstContactedAt : null,
        lastResponseAt: data.lastResponseAt ?? null,
        nextFollowUpAt: data.nextFollowUpAt ?? null,
        notes: data.notes ?? null,
      })
      .run();

    refreshAll();
    return { success: true, message: "Outreach record added." };
  } catch (error) {
    console.error("createOutreachAction failed", error);
    return { success: false, message: "Could not add the outreach record." };
  }
}

export async function updateOutreachStatusAction(
  outreachId: number,
  status: string,
): Promise<ActionResult> {
  const parsed = statusUpdateSchema.safeParse({ outreachId, status });
  if (!parsed.success) return failed("Invalid status update.");

  try {
    const current = db
      .select()
      .from(outreachRecords)
      .where(eq(outreachRecords.id, outreachId))
      .get();
    if (!current) return failed("Outreach record not found.");

    const now = Date.now();
    db.update(outreachRecords)
      .set({
        status: parsed.data.status,
        lastContactedAt:
          parsed.data.status !== "not_contacted" && parsed.data.status !== "message_drafted"
            ? current.lastContactedAt ?? now
            : current.lastContactedAt,
        updatedAt: now,
      })
      .where(eq(outreachRecords.id, outreachId))
      .run();

    refreshAll();
    return { success: true, message: "Status updated." };
  } catch (error) {
    console.error("updateOutreachStatusAction failed", error);
    return failed("Could not update the status.");
  }
}

// --- Interactions ---------------------------------------------------------

export async function logInteractionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = {
    outreachRecordId: optionalNumber(formData.get("outreachRecordId")),
    interactionType: field(formData, "interactionType"),
    channel: field(formData, "channel"),
    occurredAt: field(formData, "occurredAt"),
    summary: field(formData, "summary"),
    outcome: field(formData, "outcome"),
    nextFollowUpAt: field(formData, "nextFollowUpAt"),
  };

  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) return formError(parsed.error);

  const data = parsed.data;
  try {
    const outreach = db
      .select()
      .from(outreachRecords)
      .where(eq(outreachRecords.id, data.outreachRecordId))
      .get();
    if (!outreach) return { success: false, message: "Outreach record not found." };

    const occurredAt = data.occurredAt;
    const nextFollowUp = data.nextFollowUpAt ?? null;

    sqlite.exec("BEGIN");

    db.insert(interactions)
      .values({
        outreachRecordId: data.outreachRecordId,
        interactionType: data.interactionType,
        channel: data.channel || null,
        occurredAt,
        summary: data.summary || null,
        outcome: data.outcome || null,
        nextFollowUpAt: nextFollowUp,
      })
      .run();

    const status = nextStatusForInteraction(data.interactionType, outreach.status);
    const firstContactedAt =
      CONTACT_TYPES.has(data.interactionType) || RESPONSE_TYPES.has(data.interactionType)
        ? outreach.firstContactedAt ?? occurredAt
        : outreach.firstContactedAt;
    const lastContactedAt = CONTACT_TYPES.has(data.interactionType)
      ? Math.max(outreach.lastContactedAt ?? 0, occurredAt)
      : outreach.lastContactedAt;
    const lastResponseAt = RESPONSE_TYPES.has(data.interactionType)
      ? Math.max(outreach.lastResponseAt ?? 0, occurredAt)
      : outreach.lastResponseAt;

    db.update(outreachRecords)
      .set({
        status,
        firstContactedAt,
        lastContactedAt,
        lastResponseAt,
        nextFollowUpAt: nextFollowUp ?? outreach.nextFollowUpAt,
        updatedAt: Date.now(),
      })
      .where(eq(outreachRecords.id, data.outreachRecordId))
      .run();

    sqlite.exec("COMMIT");
    refreshAll();
    return { success: true, message: "Interaction logged." };
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors.
    }
    console.error("logInteractionAction failed", error);
    return { success: false, message: "Could not log the interaction." };
  }
}

// --- Follow-ups ------------------------------------------------------------

export async function rescheduleFollowUpAction(
  followUpId: number,
  dateValue: string,
): Promise<ActionResult> {
  const parsed = z
    .string()
    .min(1)
    .transform((value) => new Date(value + "T00:00:00").getTime())
    .refine((ts) => !Number.isNaN(ts))
    .safeParse(dateValue);
  if (!parsed.success) return failed("Choose a valid follow-up date.");

  try {
    db.update(outreachRecords)
      .set({ nextFollowUpAt: parsed.data, updatedAt: Date.now() })
      .where(eq(outreachRecords.id, followUpId))
      .run();
    refreshAll();
    return { success: true, message: "Follow-up rescheduled." };
  } catch (error) {
    console.error("rescheduleFollowUpAction failed", error);
    return failed("Could not reschedule the follow-up.");
  }
}

export async function clearFollowUpAction(followUpId: number): Promise<ActionResult> {
  try {
    db.update(outreachRecords)
      .set({ nextFollowUpAt: null, updatedAt: Date.now() })
      .where(eq(outreachRecords.id, followUpId))
      .run();
    refreshAll();
    return { success: true, message: "Follow-up cleared." };
  } catch (error) {
    console.error("clearFollowUpAction failed", error);
    return failed("Could not clear the follow-up.");
  }
}

// --- Companies -------------------------------------------------------------

export async function saveCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = optionalNumber(formData.get("id"));
  const parsed = companySchema.safeParse({
    name: field(formData, "name"),
    website: field(formData, "website"),
    industry: field(formData, "industry"),
    location: field(formData, "location"),
    linkedinUrl: field(formData, "linkedinUrl"),
    size: field(formData, "size"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) return formError(parsed.error);

  const data = parsed.data;
  const duplicate = db
    .select()
    .from(companies)
    .all()
    .find(
      (company) =>
        company.id !== id && company.name.trim().toLowerCase() === data.name.trim().toLowerCase(),
    );
  if (duplicate) {
    return {
      success: false,
      message: "A company with this name already exists.",
      errors: { name: ["This company already exists."] },
    };
  }

  try {
    const values = {
      name: data.name,
      website: normalizeUrl(data.website),
      industry: data.industry ?? null,
      location: data.location ?? null,
      linkedinUrl: normalizeUrl(data.linkedinUrl),
      size: data.size ?? null,
      notes: data.notes ?? null,
      updatedAt: Date.now(),
    };

    if (id) {
      db.update(companies).set(values).where(eq(companies.id, id)).run();
    } else {
      const created = db
        .insert(companies)
        .values(values)
        .returning({ id: companies.id })
        .get();
      refreshAll();
      return {
        success: true,
        message: "Company saved.",
        companyId: created?.id,
      };
    }

    refreshAll();
    return { success: true, message: "Company updated.", companyId: id };
  } catch (error) {
    console.error("saveCompanyAction failed", error);
    return { success: false, message: "Could not save the company." };
  }
}

export async function deleteCompanyAction(id: number): Promise<ActionResult> {
  try {
    db.delete(companies).where(eq(companies.id, id)).run();
    refreshAll();
    return { success: true, message: "Company deleted. Contacts were kept without a company." };
  } catch (error) {
    console.error("deleteCompanyAction failed", error);
    return failed("Could not delete the company.");
  }
}

// --- Templates -------------------------------------------------------------

export async function saveTemplateAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = optionalNumber(formData.get("id"));
  const parsed = templateSchema.safeParse({
    name: field(formData, "name"),
    category: field(formData, "category"),
    subject: field(formData, "subject"),
    body: field(formData, "body"),
  });
  if (!parsed.success) return formError(parsed.error);

  const data = parsed.data;

  try {
    const values = {
      name: data.name,
      category: data.category,
      subject: data.subject || null,
      body: data.body,
      updatedAt: Date.now(),
    };

    if (id) {
      db.update(messageTemplates).set(values).where(eq(messageTemplates.id, id)).run();
    } else {
      db.insert(messageTemplates).values(values).run();
    }

    refreshAll();
    return { success: true, message: id ? "Template updated." : "Template created." };
  } catch (error) {
    console.error("saveTemplateAction failed", error);
    return { success: false, message: "Could not save the template." };
  }
}

export async function deleteTemplateAction(id: number): Promise<ActionResult> {
  try {
    db.delete(messageTemplates).where(eq(messageTemplates.id, id)).run();
    refreshAll();
    return { success: true, message: "Template deleted." };
  } catch (error) {
    console.error("deleteTemplateAction failed", error);
    return failed("Could not delete the template.");
  }
}

// --- Import ---------------------------------------------------------------

export async function importContactsAction(
  rows: CsvImportRow[],
): Promise<ActionResult<ImportSummary>> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return failed("No rows to import.");
  }
  if (rows.length > 2000) {
    return failed("Please import at most 2,000 rows at a time.");
  }

  const summary: ImportSummary = {
    imported: 0,
    skipped: 0,
    companiesCreated: 0,
    errors: [],
  };

  try {
    const existingPeople = db.select().from(people).all();
    const existingEmails = new Set(
      existingPeople.map((p) => normalizeEmail(p.email)).filter(Boolean) as string[],
    );
    const existingNames = new Set(existingPeople.map((p) => p.fullName.trim().toLowerCase()));
    const companyRows = db.select().from(companies).all();
    const companyByName = new Map(companyRows.map((c) => [c.name.trim().toLowerCase(), c.id]));
    let currentCompanyCount = companyRows.length;

    for (let i = 0; i < rows.length; i++) {
      const parsed = csvRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        summary.skipped++;
        summary.errors.push(`Row ${i + 2}: missing or invalid required fields.`);
        continue;
      }

      const row = parsed.data;
      const email = normalizeEmail(row.email);
      const nameKey = row.fullName.trim().toLowerCase();
      if ((email && existingEmails.has(email)) || existingNames.has(nameKey)) {
        summary.skipped++;
        continue;
      }

      let companyId = companyByName.get(row.companyName.trim().toLowerCase());
      if (!companyId) {
        const created = db
          .insert(companies)
          .values({ name: row.companyName.trim() })
          .returning({ id: companies.id })
          .get();
        if (created) {
          companyId = created.id;
          companyByName.set(row.companyName.trim().toLowerCase(), created.id);
          currentCompanyCount++;
        }
      }
      if (!companyId) {
        summary.skipped++;
        summary.errors.push(`Row ${i + 2}: could not create the company.`);
        continue;
      }

      const personRow = db
        .insert(people)
        .values({
          companyId,
          fullName: row.fullName.trim(),
          email,
          phone: row.phone?.trim() || null,
          jobTitle: row.jobTitle?.trim() || null,
          linkedinUrl: normalizeUrl(row.linkedinUrl),
          location: row.location?.trim() || null,
          notes: row.notes?.trim() || null,
        })
        .returning({ id: people.id })
        .get();
      if (!personRow) {
        summary.skipped++;
        summary.errors.push(`Row ${i + 2}: could not create the contact.`);
        continue;
      }

      const purpose = PURPOSE_VALUES.includes(row.purpose as (typeof PURPOSE_VALUES)[number])
        ? (row.purpose as string)
        : "Networking";

      db.insert(outreachRecords)
        .values({
          personId: personRow.id,
          purpose,
          channel: row.linkedinUrl ? "LinkedIn" : "Other",
          status: "not_contacted",
          notes: null,
        })
        .run();

      summary.imported++;
      if (email) existingEmails.add(email);
      existingNames.add(nameKey);
    }

    summary.companiesCreated = currentCompanyCount - companyRows.length;
    refreshAll();
    return {
      success: true,
      message: `Imported ${summary.imported} contact${summary.imported === 1 ? "" : "s"}${
        summary.skipped ? `, skipped ${summary.skipped}` : ""
      }.`,
      data: summary,
    };
  } catch (error) {
    console.error("importContactsAction failed", error);
    return failed("Import failed. No contacts were saved.");
  }
}

// --- Client data helpers ---------------------------------------------------

export async function getCompanyOptionsAction(): Promise<CompanyOption[]> {
  return getCompanyOptions();
}

// Keep a typed reference to statuses so client dropdowns can rely on the server module.
export async function getStatusValuesAction(): Promise<string[]> {
  return [...STATUS_VALUES];
}
