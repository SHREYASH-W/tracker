import { describe, expect, it } from "vitest";
import { EnrichLayerApiError, findEnrichLayerEmail } from "./enrichlayer";

const liveResponse = {
  name: "Satya Nadella",
  emails: [
    {
      email: "satyan@microsoft.com",
      normalized: "satyan@microsoft.com",
      validity: "valid",
      validatedAt: "2026-10-26T09:29:12.947767",
      gateway: "microsoft",
      isDisposable: false,
      isConsumer: false,
      isDomainCatchall: null,
      mxRecords: ["microsoft-com.mail.protection.outlook.com"],
    },
  ],
};

describe("findEnrichLayerEmail", () => {
  it("calls the prospect endpoint with bearer auth and maps the response", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(liveResponse), { status: 200 });
    }) as typeof fetch;

    const result = await findEnrichLayerEmail(
      { fullName: "Satya Nadella", domain: "microsoft.com" },
      { apiKey: "test-token", fetchImpl },
    );

    const { url, init } = calls[0]!;
    expect(url).toContain("https://api.enrichlayer.com/v3/email/prospect?");
    expect(url).toContain("full_name=Satya+Nadella");
    expect(url).toContain("domain=microsoft.com");
    expect(url).toContain("limit=5");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");

    expect(result).toEqual({
      provider: "enrichlayer",
      email: "satyan@microsoft.com",
      score: null,
      verificationStatus: "valid",
      domain: "microsoft.com",
      position: null,
      company: null,
      linkedinUrl: null,
      phoneNumber: null,
      sourceCount: null,
      isCatchAll: false,
    });
  });

  it("prefers verified work mailboxes over risky candidates", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          name: "Alex Example",
          emails: [
            { email: "alex@catchall.example", validity: "valid", isDomainCatchall: true },
            { email: "alex@disposable.example", validity: "valid", isDisposable: true },
            {
              email: "alex@acme.com",
              normalized: "alex@acme.com",
              validity: "valid",
              isDomainCatchall: false,
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await findEnrichLayerEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-token", fetchImpl },
    );

    expect(result?.email).toBe("alex@acme.com");
    expect(result?.verificationStatus).toBe("valid");
    expect(result?.isCatchAll).toBe(false);
  });

  it("flags catch-all results", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          name: "Alex Example",
          emails: [
            {
              email: "alex@acme.com",
              validity: "valid",
              isDisposable: false,
              isDomainCatchall: true,
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await findEnrichLayerEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-token", fetchImpl },
    );

    expect(result?.isCatchAll).toBe(true);
  });

  it("maps disposable candidates to a disposable status", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          name: "Alex Example",
          emails: [{ email: "alex@mailinator.com", validity: "valid", isDisposable: true }],
        }),
        { status: 200 },
      )) as typeof fetch;

    const result = await findEnrichLayerEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-token", fetchImpl },
    );

    expect(result?.verificationStatus).toBe("disposable");
  });

  it("returns null when no candidate emails exist", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ name: "Alex Example", emails: [] }), {
        status: 200,
      })) as typeof fetch;

    const result = await findEnrichLayerEmail(
      { fullName: "Alex Example", domain: "acme.com" },
      { apiKey: "test-token", fetchImpl },
    );

    expect(result).toBeNull();
  });

  it("reports rejected tokens", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401 })) as typeof fetch;

    await expect(
      findEnrichLayerEmail(
        { fullName: "Alex Example", domain: "acme.com" },
        { apiKey: "bad-token", fetchImpl },
      ),
    ).rejects.toMatchObject({
      name: "EnrichLayerApiError",
      status: 401,
      code: "unauthorized",
    });
  });

  it("reports rate limits", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })) as typeof fetch;

    await expect(
      findEnrichLayerEmail(
        { fullName: "Alex Example", domain: "acme.com" },
        { apiKey: "test-token", fetchImpl },
      ),
    ).rejects.toMatchObject({ status: 429, code: "rate_limit" });
  });

  it("reports exhausted credits", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402 })) as typeof fetch;

    await expect(
      findEnrichLayerEmail(
        { fullName: "Alex Example", domain: "acme.com" },
        { apiKey: "test-token", fetchImpl },
      ),
    ).rejects.toMatchObject({ status: 402, code: "out_of_credits" });
  });

  it("surfaces other API errors", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ detail: "Domain not supported" }), { status: 422 })) as typeof fetch;

    await expect(
      findEnrichLayerEmail(
        { fullName: "Alex Example", domain: "acme.com" },
        { apiKey: "test-token", fetchImpl },
      ),
    ).rejects.toMatchObject({
      name: "EnrichLayerApiError",
      status: 422,
      message: "Domain not supported",
    });
  });

  it("requires a token", async () => {
    await expect(
      findEnrichLayerEmail({ fullName: "Alex Example", domain: "acme.com" }, { apiKey: "" }),
    ).rejects.toBeInstanceOf(EnrichLayerApiError);

    await expect(
      findEnrichLayerEmail({ fullName: "Alex Example", domain: "acme.com" }, { apiKey: "" }),
    ).rejects.toMatchObject({ status: 0, code: "missing_key" });
  });
});
