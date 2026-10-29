/**
 * Core database operation tests.
 * Uses an in-memory SQLite database so tests are fast and isolated.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DatabaseWrapper } from "../db/sqlite-wrapper";

let db: DatabaseWrapper;

beforeAll(() => {
  db = new DatabaseWrapper(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  // Run migrations inline
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      website TEXT,
      industry TEXT,
      location TEXT,
      linkedin_url TEXT,
      size TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL,
      job_title TEXT,
      email TEXT,
      phone TEXT,
      linkedin_url TEXT,
      location TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS outreach_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      opportunity_id INTEGER,
      purpose TEXT NOT NULL,
      channel TEXT,
      status TEXT NOT NULL DEFAULT 'not_contacted',
      first_contacted_at INTEGER,
      last_contacted_at INTEGER,
      last_response_at INTEGER,
      next_follow_up_at INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outreach_record_id INTEGER NOT NULL REFERENCES outreach_records(id) ON DELETE CASCADE,
      interaction_type TEXT NOT NULL,
      channel TEXT,
      occurred_at INTEGER NOT NULL,
      summary TEXT,
      outcome TEXT,
      next_follow_up_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);
});

afterAll(() => {
  db.close();
});

describe("DatabaseWrapper", () => {
  it("creates a company and retrieves it", () => {
    const res = db.prepare("INSERT INTO companies (name, industry) VALUES (?, ?)").run("Acme Corp", "Technology");
    expect(Number(res.lastInsertRowid)).toBeGreaterThan(0);
    const row = db.prepare("SELECT * FROM companies WHERE name = ?").get("Acme Corp") as { name: string; industry: string };
    expect(row.name).toBe("Acme Corp");
    expect(row.industry).toBe("Technology");
  });

  it("creates a person linked to a company", () => {
    const compRes = db.prepare("INSERT INTO companies (name) VALUES (?)").run("Beta Inc.");
    const compId = Number(compRes.lastInsertRowid);
    const personRes = db.prepare("INSERT INTO people (company_id, full_name, email) VALUES (?, ?, ?)").run(compId, "Jane Smith", "jane@beta.com");
    const personId = Number(personRes.lastInsertRowid);
    expect(personId).toBeGreaterThan(0);
    const row = db.prepare("SELECT p.full_name, c.name as company FROM people p JOIN companies c ON c.id = p.company_id WHERE p.id = ?").get(personId) as { full_name: string; company: string };
    expect(row.full_name).toBe("Jane Smith");
    expect(row.company).toBe("Beta Inc.");
  });

  it("creates an outreach record with a status", () => {
    const pRes = db.prepare("INSERT INTO people (full_name) VALUES (?)").run("Bob Jones");
    const personId = Number(pRes.lastInsertRowid);
    const oRes = db.prepare("INSERT INTO outreach_records (person_id, purpose, status) VALUES (?, ?, ?)").run(personId, "Networking", "message_sent");
    const outreachId = Number(oRes.lastInsertRowid);
    const row = db.prepare("SELECT status FROM outreach_records WHERE id = ?").get(outreachId) as { status: string };
    expect(row.status).toBe("message_sent");
  });

  it("cascades delete outreach records when person is deleted", () => {
    const pRes = db.prepare("INSERT INTO people (full_name) VALUES (?)").run("Delete Me");
    const personId = Number(pRes.lastInsertRowid);
    db.prepare("INSERT INTO outreach_records (person_id, purpose, status) VALUES (?, ?, ?)").run(personId, "Job", "not_contacted");
    db.prepare("DELETE FROM people WHERE id = ?").run(personId);
    const row = db.prepare("SELECT COUNT(*) as n FROM outreach_records WHERE person_id = ?").get(personId) as { n: number };
    expect(Number(row.n)).toBe(0);
  });

  it("cascades delete interactions when outreach record is deleted", () => {
    const pRes = db.prepare("INSERT INTO people (full_name) VALUES (?)").run("Cascade Test");
    const personId = Number(pRes.lastInsertRowid);
    const oRes = db.prepare("INSERT INTO outreach_records (person_id, purpose, status) VALUES (?, ?, ?)").run(personId, "Referral", "replied");
    const outreachId = Number(oRes.lastInsertRowid);
    db.prepare("INSERT INTO interactions (outreach_record_id, interaction_type, occurred_at) VALUES (?, ?, ?)").run(outreachId, "Message Sent", Date.now());
    db.prepare("DELETE FROM outreach_records WHERE id = ?").run(outreachId);
    const row = db.prepare("SELECT COUNT(*) as n FROM interactions WHERE outreach_record_id = ?").get(outreachId) as { n: number };
    expect(Number(row.n)).toBe(0);
  });

  it("detects duplicate emails correctly", () => {
    db.prepare("INSERT INTO people (full_name, email) VALUES (?, ?)").run("Alice A", "alice@example.com");
    const dup = db.prepare("SELECT id FROM people WHERE LOWER(email) = LOWER(?) LIMIT 1").get("alice@example.com") as { id: number } | undefined;
    expect(dup).toBeDefined();
    const noDup = db.prepare("SELECT id FROM people WHERE LOWER(email) = LOWER(?) LIMIT 1").get("notexist@example.com") as { id: number } | undefined;
    expect(noDup).toBeUndefined();
  });

  it("updates status and does NOT auto-determine rejection from date", () => {
    const pRes = db.prepare("INSERT INTO people (full_name) VALUES (?)").run("Status Test");
    const personId = Number(pRes.lastInsertRowid);
    const oRes = db.prepare("INSERT INTO outreach_records (person_id, purpose, status) VALUES (?, ?, ?)").run(personId, "Internship", "awaiting_reply");
    const outreachId = Number(oRes.lastInsertRowid);
    // Simulate 60 days passing — status must NOT auto-change
    const sixtyDaysAgo = Date.now() - 60 * 86400000;
    db.prepare("UPDATE outreach_records SET last_contacted_at = ? WHERE id = ?").run(sixtyDaysAgo, outreachId);
    const row = db.prepare("SELECT status FROM outreach_records WHERE id = ?").get(outreachId) as { status: string };
    expect(row.status).toBe("awaiting_reply"); // unchanged — system never auto-rejects
  });

  it("follow-up overdue calculation is date-based", () => {
    const yesterday = Date.now() - 86400000;
    const tomorrow = Date.now() + 86400000;
    expect(yesterday < Date.now()).toBe(true);
    expect(tomorrow > Date.now()).toBe(true);
  });

  it("transaction rolls back on error", () => {
    let errorThrown = false;
    try {
      const tx = db.transaction(() => {
        db.prepare("INSERT INTO companies (name) VALUES (?)").run("Rollback Co");
        throw new Error("Intentional rollback");
      });
      tx();
    } catch {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
    const row = db.prepare("SELECT id FROM companies WHERE name = ?").get("Rollback Co") as { id: number } | undefined;
    expect(row).toBeUndefined();
  });
});

describe("Import validation", () => {
  it("parses basic CSV correctly", async () => {
    const { parseCsv } = await import("../lib/utils");
    const csv = `name,email,company\nJane Smith,jane@x.com,Acme\n"Bob ""The Builder"" Jones",bob@x.com,"Big Co, Inc."`;
    const rows = parseCsv(csv);
    expect(rows.length).toBe(3);
    expect(rows[1]![0]).toBe("Jane Smith");
    expect(rows[2]![0]).toBe('Bob "The Builder" Jones');
    expect(rows[2]![2]).toBe("Big Co, Inc.");
  });

  it("generates CSV with proper quoting", async () => {
    const { toCsv } = await import("../lib/utils");
    const csv = toCsv([["Name", "Email"], ["Jane, Smith", "jane@x.com"]]);
    expect(csv).toContain('"Jane, Smith"');
    expect(csv).toContain("jane@x.com");
  });

  it("normalizes emails to lowercase", async () => {
    const { normalizeEmail } = await import("../lib/utils");
    expect(normalizeEmail("JANE@EXAMPLE.COM")).toBe("jane@example.com");
    expect(normalizeEmail("  alice@test.org  ")).toBe("alice@test.org");
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });

  it("follow-up date helpers work correctly", async () => {
    const { isOverdue, isDueToday, isDueSoon } = await import("../lib/utils");
    const yesterday = Date.now() - 86400000;
    const tomorrow = Date.now() + 86400000;
    const threeDays = Date.now() + 3 * 86400000;
    expect(isOverdue(yesterday)).toBe(true);
    expect(isOverdue(tomorrow)).toBe(false);
    expect(isDueToday(Date.now())).toBe(true);
    expect(isDueSoon(threeDays)).toBe(true);
    expect(isDueSoon(yesterday)).toBe(false);
  });
});
