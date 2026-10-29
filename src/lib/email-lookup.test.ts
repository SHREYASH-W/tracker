import { describe, expect, it } from "vitest";
import { isEmailProvider, normalizeEmailDomain } from "./email-lookup";

describe("normalizeEmailDomain", () => {
  it("strips protocol, www, path, and port", () => {
    expect(normalizeEmailDomain("https://www.Acme.com/careers?ref=1")).toBe("acme.com");
    expect(normalizeEmailDomain("  https://sub.acme.io:8443/path ")).toBe("sub.acme.io");
    expect(normalizeEmailDomain("ftp://files.example.com")).toBe("files.example.com");
  });

  it("accepts bare domains and multi-part TLDs", () => {
    expect(normalizeEmailDomain("acme.co.uk")).toBe("acme.co.uk");
  });

  it("rejects values that are not domains", () => {
    expect(normalizeEmailDomain("not-a-domain")).toBeNull();
    expect(normalizeEmailDomain("localhost:3000")).toBeNull();
    expect(normalizeEmailDomain("")).toBeNull();
    expect(normalizeEmailDomain(null)).toBeNull();
  });
});

describe("isEmailProvider", () => {
  it("accepts supported providers", () => {
    expect(isEmailProvider("hunter")).toBe(true);
    expect(isEmailProvider("prospeo")).toBe(true);
    expect(isEmailProvider("enrichlayer")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isEmailProvider("clearbit")).toBe(false);
    expect(isEmailProvider(null)).toBe(false);
  });
});
