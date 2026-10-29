import { describe, expect, it } from "vitest";
import { findProspeoEmail } from "./prospeo";

describe("findProspeoEmail", () => {
  it("sends the person and company data and maps the result", async () => {
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.prospeo.io/enrich-person");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)["X-KEY"]).toBe("test-key");
      expect(JSON.parse(String(init?.body))).toEqual({
        data: {
          first_name: "Alex",
          last_name: "Example",
          company_website: "acme.com",
          linkedin_url: "https://linkedin.com/in/alex",
        },
      });

      return new Response(
        JSON.stringify({
          error: false,
          person: {
            person_id: "abc123",
            full_name: "Alex Example",
            linkedin_url: "https://linkedin.com/in/alex",
            current_job_title: "Engineer",
            email: { status: "VERIFIED", revealed: true, email: "alex@acme.com" },
          },
          company: { name: "Acme", website: "acme.com" },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await findProspeoEmail(
      { fullName: "Alex Example", domain: "acme.com", linkedinUrl: "https://linkedin.com/in/alex" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result).toEqual({
      provider: "prospeo",
      email: "alex@acme.com",
      score: null,
      verificationStatus: "valid",
      domain: "acme.com",
      position: "Engineer",
      company: "Acme",
      linkedinUrl: "https://linkedin.com/in/alex",
      phoneNumber: null,
      sourceCount: null,
    });
  });

  it("uses full_name for single-word names and omits an absent LinkedIn URL", async () => {
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        data: { full_name: "Cher", company_website: "acme.com" },
      });
      return new Response(JSON.stringify({ error: true, error_code: "NO_MATCH" }), { status: 200 });
    }) as typeof fetch;

    const result = await findProspeoEmail(
      { fullName: "Cher", domain: "acme.com" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result).toBeNull();
  });

  it("returns null when the email is not revealed", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          error: false,
          person: {
            email: { status: "VERIFIED", revealed: false, email: null },
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await findProspeoEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result).toBeNull();
  });

  it("maps accept-all statuses", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          error: false,
          person: {
            email: { status: "CATCH_ALL", revealed: true, email: "alex@acme.com" },
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await findProspeoEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-key", fetchImpl },
    );

    expect(result?.verificationStatus).toBe("accept_all");
  });

  it("surfaces an invalid API key error", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: true, error_code: "INVALID_API_KEY" }),
        { status: 401 },
      )) as typeof fetch;

    await expect(
      findProspeoEmail(
        { fullName: "Alex Example", domain: "acme.com" },
        { apiKey: "bad-key", fetchImpl },
      ),
    ).rejects.toMatchObject({
      name: "ProspeoApiError",
      status: 401,
      code: "INVALID_API_KEY",
      message: "Prospeo rejected the API key. Check PROSPEO_API_KEY in .env.local.",
    });
  });

  it("surfaces rate limit errors", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: true, error_code: "Rate limit exceeded" }),
        { status: 429 },
      )) as typeof fetch;

    await expect(
      findProspeoEmail(
        { fullName: "Alex Example", domain: "acme.com" },
        { apiKey: "test-key", fetchImpl },
      ),
    ).rejects.toMatchObject({
      name: "ProspeoApiError",
      status: 429,
      message: "Prospeo's rate limit was reached. Try again later.",
    });
  });

  it("requires an API key", async () => {
    await expect(
      findProspeoEmail({ fullName: "Alex Example", domain: "acme.com" }, { apiKey: "" }),
    ).rejects.toMatchObject({ name: "ProspeoApiError", status: 0, code: "missing_key" });
  });
});
