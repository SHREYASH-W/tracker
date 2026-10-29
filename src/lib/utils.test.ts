import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dateInputToTimestamp,
  endOfToday,
  formatRelative,
  getInitials,
  isDueToday,
  isOverdue,
  normalizeEmail,
  normalizeUrl,
  parseCsv,
  startOfToday,
  timestampToDateInput,
  toCsv,
} from "./utils";

describe("parseCsv", () => {
  it("parses simple rows and drops blank lines", () => {
    const rows = parseCsv("name,company\nAda,Acme\n\nGrace,Acme\n");
    expect(rows).toEqual([
      ["name", "company"],
      ["Ada", "Acme"],
      ["Grace", "Acme"],
    ]);
  });

  it("handles quoted commas, quotes, and newlines", () => {
    const rows = parseCsv('name,notes\r\n"Lovelace, Ada","Said ""hello"""\r\n"two\nlines",plain');
    expect(rows).toEqual([
      ["name", "notes"],
      ["Lovelace, Ada", 'Said "hello"'],
      ["two\nlines", "plain"],
    ]);
  });

  it("preserves trailing empty cells", () => {
    expect(parseCsv("a,b,c\n1,,")).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
    ]);
  });
});

describe("toCsv", () => {
  it("escapes commas, quotes, and newlines", () => {
    const csv = toCsv([
      ["name", "notes"],
      ["Lovelace, Ada", 'Said "hello"'],
      ["multi\nline", null],
    ]);
    expect(csv).toBe('name,notes\r\n"Lovelace, Ada","Said ""hello"""\r\n"multi\nline",');
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["Full Name", "Company"],
      ["Ada, Lovelace", 'Acme "Research"'],
      ["Grace", "Navy\nLabs"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("normalizers", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("normalizes URLs", () => {
    expect(normalizeUrl("linkedin.com/in/ada")).toBe("https://linkedin.com/in/ada");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("   ")).toBeNull();
  });

  it("derives initials", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("Grace")).toBe("GR");
    expect(getInitials("  ")).toBe("?");
    expect(getInitials("Mary Ann Evans")).toBe("ME");
  });
});

describe("date helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds start and end of day", () => {
    expect(new Date(startOfToday()).getHours()).toBe(0);
    expect(new Date(endOfToday()).getHours()).toBe(23);
    expect(startOfToday()).toBeLessThan(endOfToday());
  });

  it("classifies follow-up dates", () => {
    expect(isOverdue(dateInputToTimestamp("2026-06-14"))).toBe(true);
    expect(isOverdue(dateInputToTimestamp("2026-06-15"))).toBe(false);
    expect(isDueToday(dateInputToTimestamp("2026-06-15"))).toBe(true);
    expect(isDueToday(dateInputToTimestamp("2026-06-16"))).toBe(false);
  });

  it("formats relative dates", () => {
    expect(formatRelative(dateInputToTimestamp("2026-06-15"))).toBe("today");
    expect(formatRelative(dateInputToTimestamp("2026-06-16"))).toBe("tomorrow");
    expect(formatRelative(dateInputToTimestamp("2026-06-14"))).toBe("yesterday");
    expect(formatRelative(dateInputToTimestamp("2026-06-10"))).toBe("5 days ago");
    expect(formatRelative(dateInputToTimestamp("2026-06-20"))).toBe("in 5 days");
    expect(formatRelative(null)).toBe("—");
  });

  it("round-trips date input values in local time", () => {
    const ts = dateInputToTimestamp("2026-06-15");
    expect(ts).not.toBeNull();
    expect(new Date(ts as number).getDate()).toBe(15);
    expect(dateInputToTimestamp("not-a-date")).toBeNull();
  });

  it("formats timestamps for date inputs", () => {
    expect(timestampToDateInput(dateInputToTimestamp("2026-06-15"))).toBe("2026-06-15");
    expect(timestampToDateInput(null)).toBe("");
  });
});
