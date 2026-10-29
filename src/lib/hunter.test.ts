import { describe, expect, it } from "vitest";
import { findHunterEmail, findHunterHrContacts } from "./hunter";

describe("findHunterEmail", () => {
  it("maps a Hunter response", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      expect(String(url)).toContain("domain=acme.com");
      expect(String(url)).toContain("full_name=Alex+Example");
      expect(String(url)).toContain("api_key=test-key");
      return new Response(
        JSON.stringify({
          data: {
            email: "alex@acme.com",
            score: 91,
            verification: { status: "valid" },
            domain: "acme.com",
            position: "Engineer",
            company: "Acme",
            linkedin_url: "https://linkedin.com/in/alex",
            phone_number: null,
            sources: [{ uri: "https://acme.com/team" }, { uri: "https://example.com" }],
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await findHunterEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result).toEqual({
      provider: "hunter",
      email: "alex@acme.com",
      score: 91,
      verificationStatus: "valid",
      domain: "acme.com",
      position: "Engineer",
      company: "Acme",
      linkedinUrl: "https://linkedin.com/in/alex",
      phoneNumber: null,
      sourceCount: 2,
    });
  });

  it("returns null when Hunter has no email", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: { email: null, sources: [] } }), {
        status: 200,
      })) as typeof fetch;

    const result = await findHunterEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result).toBeNull();
  });

  it("surfaces Hunter API errors", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ errors: [{ details: "The API key is invalid.", code: 401 }] }), {
        status: 401,
      })) as typeof fetch;

    await expect(
      findHunterEmail(
        { fullName: "Alex Example", domain: "acme.com" },
        { apiKey: "bad-key", fetchImpl },
      ),
    ).rejects.toMatchObject({
      name: "HunterApiError",
      status: 401,
      message: "The API key is invalid.",
    });
  });

  it("requires an API key", async () => {
    await expect(
      findHunterEmail({ fullName: "Alex Example", domain: "acme.com" }, { apiKey: "" }),
    ).rejects.toMatchObject({ name: "HunterApiError", status: 0, code: "missing_key" });
  });
});

describe("findHunterHrContacts", () => {
  const responseBody = {
    data: {
      domain: "acme.com",
      organization: "Acme",
      emails: [
        {
          value: "jordan@acme.com",
          confidence: 80,
          verification: { status: "valid" },
          first_name: "Jordan",
          last_name: "Lee",
          position: "HR Generalist",
          department: "hr",
          seniority: "senior",
          linkedin: null,
          phone_number: null,
          sources: [{}],
        },
        {
          value: "sam@acme.com",
          confidence: 92,
          verification: { status: "valid" },
          first_name: "Sam",
          last_name: "Patel",
          position: "Technical Recruiter",
          department: "hr",
          seniority: "senior",
          linkedin: "https://linkedin.com/in/sam",
          phone_number: null,
          sources: [{}, {}],
        },
        {
          value: "SAM@acme.com",
          confidence: 60,
          verification: { status: "accept_all" },
          first_name: "Sam",
          last_name: "Patel",
          position: "Technical Recruiter",
          department: "hr",
        },
        {
          value: "riley@acme.com",
          confidence: 70,
          verification: { status: "accept_all" },
          first_name: "Riley",
          last_name: "Chen",
          position: "People Operations Partner",
          department: "hr",
          seniority: "mid",
          sources: [],
        },
        {
          value: "",
          first_name: "No",
          last_name: "Email",
        },
      ],
    },
  };

  it("requests the HR department and maps contacts recruiting-first", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const query = String(url);
      expect(query).toContain("domain=acme.com");
      expect(query).toContain("department=hr");
      expect(query).toContain("limit=10");
      expect(query).toContain("offset=0");
      expect(query).toContain("api_key=test-key");
      return new Response(JSON.stringify(responseBody), { status: 200 });
    }) as typeof fetch;

    const result = await findHunterHrContacts(
      { domain: "acme.com" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result.domain).toBe("acme.com");
    expect(result.organization).toBe("Acme");
    expect(result.contacts.map((contact) => contact.email)).toEqual([
      "sam@acme.com",
      "riley@acme.com",
      "jordan@acme.com",
    ]);
    expect(result.contacts[0]).toEqual({
      email: "sam@acme.com",
      fullName: "Sam Patel",
      jobTitle: "Technical Recruiter",
      department: "hr",
      seniority: "senior",
      linkedinUrl: "https://linkedin.com/in/sam",
      phoneNumber: null,
      score: 92,
      verificationStatus: "valid",
      sourceCount: 2,
    });
  });

  it("returns an empty list when Hunter finds no HR contacts", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: { domain: "acme.com", emails: [] } }), {
        status: 200,
      })) as typeof fetch;

    const result = await findHunterHrContacts(
      { domain: "acme.com" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result.contacts).toEqual([]);
    expect(result.organization).toBeNull();
  });

  it("surfaces Hunter API errors", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ errors: [{ details: "Rate limit reached.", code: 429 }] }), {
        status: 429,
      })) as typeof fetch;

    await expect(
      findHunterHrContacts({ domain: "acme.com" }, { apiKey: "test-key", fetchImpl }),
    ).rejects.toMatchObject({
      name: "HunterApiError",
      status: 429,
      message: "Rate limit reached.",
    });
  });

  it("requires an API key", async () => {
    await expect(
      findHunterHrContacts({ domain: "acme.com" }, { apiKey: "" }),
    ).rejects.toMatchObject({ name: "HunterApiError", status: 0, code: "missing_key" });
  });
});
