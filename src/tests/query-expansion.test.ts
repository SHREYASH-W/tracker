import { describe, expect, it } from "vitest";
import {
  detectExperienceLevel,
  detectRoleType,
  heuristicExpansion,
  normalizeExpansion,
  parseQueryExpansion,
} from "@/lib/query-expansion";

describe("heuristicExpansion", () => {
  it("expands an AI/ML internship with titles, keywords and location", () => {
    const result = heuristicExpansion("AI/ML internship in Bengaluru, remote ok");

    expect(result.roleType).toBe("internship");
    expect(result.experienceLevel).toBe("student");
    expect(result.remoteOk).toBe(true);
    expect(result.titles).toContain("Machine Learning Intern");
    expect(result.titles.some((title) => /intern/i.test(title))).toBe(true);
    expect(result.keywords).toContain("python");
    expect(result.locations).toEqual(["Bengaluru"]);
    expect(result.summary).toContain("Machine Learning");
  });

  it("always returns at least one title for vague input", () => {
    const result = heuristicExpansion("something interesting");
    expect(result.titles.length).toBeGreaterThan(0);
    expect(result.keywords).toEqual([]);
  });

  it("detects full-time and senior roles", () => {
    const result = heuristicExpansion("Senior backend engineer full-time");
    expect(result.roleType).toBe("full_time");
    expect(result.experienceLevel).toBe("senior");
    expect(result.titles).toContain("Backend Engineer");
    expect(result.titles.some((title) => /intern/i.test(title))).toBe(false);
  });

  it("deduplicates titles case-insensitively", () => {
    const result = heuristicExpansion("software engineer intern");
    const lower = result.titles.map((title) => title.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});

describe("detectRoleType / detectExperienceLevel", () => {
  it("understands internship and full-time words", () => {
    expect(detectRoleType("summer internship")).toBe("internship");
    expect(detectRoleType("full-time software role")).toBe("full_time");
    expect(detectRoleType("software engineer")).toBe("both");
  });

  it("understands experience words", () => {
    expect(detectExperienceLevel("new grad engineer")).toBe("entry");
    expect(detectExperienceLevel("mid level analyst")).toBe("mid");
    expect(detectExperienceLevel("staff engineer")).toBe("senior");
    expect(detectExperienceLevel("data scientist")).toBe("any");
  });
});

describe("parseQueryExpansion", () => {
  it("parses fenced JSON and normalises arrays", () => {
    const text = [
      "```json",
      JSON.stringify({
        titles: ["ML Intern", "ml intern", "AI Engineer"],
        keywords: ["Python", "python", "PyTorch"],
        locations: ["Remote"],
        excludedKeywords: ["unpaid"],
        roleType: "internship",
        experienceLevel: "student",
        remoteOk: true,
        summary: "ML internships",
      }),
      "```",
    ].join("\n");

    const parsed = parseQueryExpansion(text, "AI/ML internship");
    expect(parsed).not.toBeNull();
    expect(parsed!.titles).toEqual(["ML Intern", "AI Engineer"]);
    expect(parsed!.keywords).toEqual(["Python", "PyTorch"]);
    expect(parsed!.roleType).toBe("internship");
    expect(parsed!.experienceLevel).toBe("student");
    expect(parsed!.summary).toBe("ML internships");
  });

  it("returns null for junk or non-object JSON", () => {
    expect(parseQueryExpansion("not json at all", "engineer")).toBeNull();
    expect(parseQueryExpansion("[1,2,3]", "engineer")).toBeNull();
    expect(parseQueryExpansion("", "engineer")).toBeNull();
  });

  it("falls back to heuristics when the model returns empty titles", () => {
    const parsed = parseQueryExpansion(
      JSON.stringify({ titles: [], roleType: "not-a-real-type" }),
      "frontend internship",
    );

    expect(parsed).not.toBeNull();
    expect(parsed!.titles.length).toBeGreaterThan(0);
    expect(parsed!.roleType).toBe("internship");
  });
});

describe("normalizeExpansion", () => {
  it("caps long lists and keeps order", () => {
    const titles = Array.from({ length: 40 }, (_, index) => `Title ${index}`);
    const result = normalizeExpansion({ titles, keywords: [] }, "engineer");

    expect(result.titles).toHaveLength(12);
    expect(result.titles[0]).toBe("Title 0");
  });
});
