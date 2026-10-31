import { describe, expect, it } from "vitest";
import { DatabaseWrapper } from "../db/sqlite-wrapper";
import { runMigrations } from "../db/migrate";

function tableNames(db: DatabaseWrapper): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

describe("automation foundation migration", () => {
  it("creates every pipeline table and is idempotent", () => {
    const db = new DatabaseWrapper(":memory:");
    try {
      const first = runMigrations(db);
      expect(first.applied).toBe(3);

      const tables = tableNames(db);
      for (const name of [
        "search_profiles",
        "resumes",
        "resume_profiles",
        "jobs",
        "job_sources",
        "job_matches",
        "applications",
        "apply_queue",
        "answer_bank",
        "email_drafts",
        "provider_usage",
        "automation_runs",
        "person_jobs",
      ]) {
        expect(tables).toContain(name);
      }

      const sources = db.prepare("SELECT COUNT(*) AS n FROM job_sources").get() as { n: number };
      expect(Number(sources.n)).toBe(10);

      const second = runMigrations(db);
      expect(second.applied).toBe(0);
    } finally {
      db.close();
    }
  });

  it("stores search profile arrays and defaults", () => {
    const db = new DatabaseWrapper(":memory:");
    try {
      runMigrations(db);
      const result = db
        .prepare(
          `INSERT INTO search_profiles (name, prompt, titles, keywords)
           VALUES (?, ?, ?, ?)`,
        )
        .run("AI/ML", "aiml internship", JSON.stringify(["ML Intern"]), JSON.stringify(["PyTorch"]));

      const row = db
        .prepare("SELECT * FROM search_profiles WHERE id = ?")
        .get(Number(result.lastInsertRowid)) as Record<string, unknown>;

      expect(row.name).toBe("AI/ML");
      expect(JSON.parse(String(row.titles))).toEqual(["ML Intern"]);
      expect(JSON.parse(String(row.keywords))).toEqual(["PyTorch"]);
      expect(row.role_type).toBe("both");
      expect(row.remote_ok).toBe(0);
      expect(row.min_match_score).toBe(60);
      expect(row.active).toBe(1);
      expect(row.auto_apply_mode).toBe("off");
    } finally {
      db.close();
    }
  });
});
