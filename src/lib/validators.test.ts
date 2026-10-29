import { describe, expect, it } from "vitest";
import {
  addContactSchema,
  companySchema,
  hrContactImportSchema,
  interactionSchema,
  templateSchema,
} from "./validators";

const baseContact = {
  fullName: "Ada Lovelace",
  companyName: "Acme Corp",
  purpose: "Networking" as const,
};

describe("addContactSchema", () => {
  it("accepts a minimal contact and applies defaults", () => {
    const parsed = addContactSchema.parse(baseContact);
    expect(parsed.fullName).toBe("Ada Lovelace");
    expect(parsed.companyName).toBe("Acme Corp");
    expect(parsed.status).toBe("not_contacted");
    expect(parsed.email).toBeUndefined();
  });

  it("requires a name", () => {
    const result = addContactSchema.safeParse({ ...baseContact, fullName: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("fullName"))).toBe(true);
    }
  });

  it("requires an existing company id or a new company name", () => {
    const result = addContactSchema.safeParse({ ...baseContact, companyName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("company"))).toBe(true);
    }
  });

  it("normalizes and validates email addresses", () => {
    const parsed = addContactSchema.parse({ ...baseContact, email: "  Ada@Example.COM " });
    expect(parsed.email).toBe("ada@example.com");

    const invalid = addContactSchema.safeParse({ ...baseContact, email: "not-an-email" });
    expect(invalid.success).toBe(false);
  });

  it("rejects invalid profile URLs", () => {
    const result = addContactSchema.safeParse({
      ...baseContact,
      linkedinUrl: "not a url",
    });
    expect(result.success).toBe(false);
  });

  it("converts date inputs to timestamps", () => {
    const parsed = addContactSchema.parse({
      ...baseContact,
      firstContactedAt: "2026-01-15",
      nextFollowUpAt: "2026-02-01",
    });
    expect(parsed.firstContactedAt).toBe(new Date("2026-01-15T00:00:00").getTime());
    expect(parsed.nextFollowUpAt).toBe(new Date("2026-02-01T00:00:00").getTime());
  });

  it("rejects an unknown purpose", () => {
    const result = addContactSchema.safeParse({ ...baseContact, purpose: "Anything" });
    expect(result.success).toBe(false);
  });
});

describe("hrContactImportSchema", () => {
  const baseImport = {
    domain: "acme.com",
    companyName: "Acme",
    targetRole: "AI/ML Internship",
    purpose: "Internship" as const,
    contacts: [
      {
        email: "sam@acme.com",
        fullName: "Sam Patel",
        jobTitle: "Technical Recruiter",
      },
    ],
  };

  it("accepts HR contacts with a target role", () => {
    const parsed = hrContactImportSchema.parse(baseImport);
    expect(parsed.targetRole).toBe("AI/ML Internship");
    expect(parsed.contacts).toHaveLength(1);
  });

  it("requires a target role", () => {
    const result = hrContactImportSchema.safeParse({ ...baseImport, targetRole: "  " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("targetRole"))).toBe(true);
    }
  });

  it("requires at least one contact", () => {
    const result = hrContactImportSchema.safeParse({ ...baseImport, contacts: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid contact emails", () => {
    const result = hrContactImportSchema.safeParse({
      ...baseImport,
      contacts: [{ fullName: "Sam Patel", email: "not-an-email" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("companySchema", () => {
  it("requires a company name", () => {
    expect(companySchema.safeParse({ name: "" }).success).toBe(false);
    expect(companySchema.parse({ name: " Acme " }).name).toBe("Acme");
  });
});

describe("interactionSchema", () => {
  it("parses an interaction with defaults", () => {
    const parsed = interactionSchema.parse({
      outreachRecordId: 4,
      interactionType: "Message Sent",
      occurredAt: "2026-06-01",
    });
    expect(parsed.outreachRecordId).toBe(4);
    expect(parsed.occurredAt).toBe(new Date("2026-06-01T00:00:00").getTime());
    expect(parsed.summary).toBe("");
    expect(parsed.outcome).toBe("");
  });

  it("rejects an unknown interaction type", () => {
    const result = interactionSchema.safeParse({
      outreachRecordId: 4,
      interactionType: "Carrier Pigeon",
      occurredAt: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("templateSchema", () => {
  it("accepts a template body and defaults the subject", () => {
    const parsed = templateSchema.parse({
      name: "Intro",
      category: "Cold email",
      body: "Hi {{name}}",
    });
    expect(parsed.subject).toBe("");
  });

  it("rejects an empty body", () => {
    const result = templateSchema.safeParse({ name: "Intro", category: "Other", body: "  " });
    expect(result.success).toBe(false);
  });
});
