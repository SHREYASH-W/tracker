/**
 * Database migration runner.
 *
 * Uses a simple version-based migration approach: a `schema_version` table
 * tracks the last applied version, and migration SQL is executed in order.
 *
 * This avoids the complexity of drizzle-kit's external migration files while
 * still providing versioned, idempotent migrations.
 */

export interface MigrationClient {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
}

// --- Migration registry ---------------------------------------------------

const migrations: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      -- Companies
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

      CREATE INDEX IF NOT EXISTS companies_name_idx ON companies(name);
      CREATE INDEX IF NOT EXISTS companies_industry_idx ON companies(industry);

      -- People
      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        full_name TEXT NOT NULL,
        job_title TEXT,
        department TEXT,
        seniority TEXT,
        email TEXT,
        phone TEXT,
        linkedin_url TEXT,
        other_profile_url TEXT,
        location TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE INDEX IF NOT EXISTS people_company_idx ON people(company_id);
      CREATE INDEX IF NOT EXISTS people_name_idx ON people(full_name);
      CREATE INDEX IF NOT EXISTS people_email_idx ON people(email);
      CREATE INDEX IF NOT EXISTS people_linkedin_idx ON people(linkedin_url);
      CREATE INDEX IF NOT EXISTS people_job_title_idx ON people(job_title);

      -- Opportunities
      CREATE TABLE IF NOT EXISTS opportunities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        opportunity_type TEXT,
        job_posting_url TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE INDEX IF NOT EXISTS opportunities_company_idx ON opportunities(company_id);

      -- Outreach records
      CREATE TABLE IF NOT EXISTS outreach_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
        purpose TEXT NOT NULL,
        target_role TEXT,
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

      CREATE INDEX IF NOT EXISTS outreach_person_idx ON outreach_records(person_id);
      CREATE INDEX IF NOT EXISTS outreach_opportunity_idx ON outreach_records(opportunity_id);
      CREATE INDEX IF NOT EXISTS outreach_status_idx ON outreach_records(status);
      CREATE INDEX IF NOT EXISTS outreach_followup_idx ON outreach_records(next_follow_up_at);

      -- Interactions
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

      CREATE INDEX IF NOT EXISTS interactions_outreach_idx ON interactions(outreach_record_id);
      CREATE INDEX IF NOT EXISTS interactions_occurred_idx ON interactions(occurred_at);

      -- Message templates
      CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );

      CREATE INDEX IF NOT EXISTS templates_category_idx ON message_templates(category);

      -- Settings (key-value store)
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
    `,
  },
  {
    version: 2,
    name: "default_templates",
    sql: `
      INSERT OR IGNORE INTO message_templates (name, category, subject, body) VALUES
      ('LinkedIn Connection Request', 'LinkedIn connection request', NULL,
        'Hi {{name}},\n\nI hope you are doing well. I came across your profile and was impressed by your work at {{company}} as a {{role}}.\n\nI am currently {{my_background}} and would love to connect and learn from your experience.\n\nThanks,\n[Your Name]'),
      ('Internship Outreach', 'Internship outreach', NULL,
        'Hi {{name}},\n\nI hope this message finds you well. I am a student interested in the {{role}} role at {{company}}.\n\nI have been following the work your team does and would love the opportunity to contribute as an intern. I have experience with {{my_background}} and believe I could add value.\n\nWould you be open to a brief chat about the role?\n\nBest regards,\n[Your Name]'),
      ('Job Referral Request', 'Job referral request', NULL,
        'Hi {{name}},\n\nI hope you are doing well. I noticed there is an opening for {{role}} at {{company}}, and I would love to apply.\n\nI have relevant experience in {{my_background}} and believe I would be a good fit for the team.\n\nWould you be comfortable referring me for this position? I would be happy to share my resume and any additional information you need.\n\nThank you for your time,\n[Your Name]'),
      ('Recruiter Follow-up', 'Recruiter follow-up', NULL,
        'Hi {{name}},\n\nI hope this finds you well. I wanted to follow up on my application for the {{role}} position at {{company}}.\n\nI remain very interested in the opportunity and would be happy to provide any additional information you might need.\n\nThank you for your time and consideration.\n\nBest,\n[Your Name]'),
      ('Thank You Message', 'Thank-you message', NULL,
        'Hi {{name}},\n\nThank you so much for taking the time to speak with me about the {{role}} opportunity at {{company}}.\n\nI really enjoyed our conversation and feel even more excited about the possibility of joining your team.\n\nPlease let me know if there is anything else you need from me.\n\nBest regards,\n[Your Name]'),
      ('Interview Follow-up', 'Interview follow-up', NULL,
        'Hi {{name}},\n\nThank you again for the interview earlier this week. It was great learning more about the {{role}} position and the team at {{company}}.\n\nI wanted to reiterate my interest in the role and my enthusiasm for the opportunity to contribute to your team.\n\nI look forward to hearing from you.\n\nBest regards,\n[Your Name]'),
      ('Cold Email', 'Cold email', NULL,
        'Hi {{name}},\n\nMy name is [Your Name] and I am reaching out because I am very interested in the work being done at {{company}}.\n\nI have a background in {{my_background}} and I am particularly interested in the {{role}} role.\n\nWould you be open to a brief conversation? I would love to learn more about your team and explore how I might be able to contribute.\n\nThank you for your time,\n[Your Name]');

      -- Default settings
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('custom_statuses', '[]'),
        ('theme', 'system');
    `,
  },
];

// --- Runner ---------------------------------------------------------------

const SCHEMA_VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS _schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`;

function getCurrentVersion(client: MigrationClient): number {
  try {
    const row = client
      .prepare("SELECT MAX(version) as v FROM _schema_version")
      .get() as { v: number | null } | undefined;
    return row?.v ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Run all pending database migrations.
 * Safe to call on every startup — it only applies migrations that haven't been applied yet.
 */
export function runMigrations(client: MigrationClient): { applied: number; skipped: number } {
  client.exec(SCHEMA_VERSION_TABLE);

  const currentVersion = getCurrentVersion(client);
  const pending = migrations.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return { applied: 0, skipped: migrations.length };
  }

  // node:sqlite exposes no transaction helper, so apply each migration atomically by hand.
  for (const migration of pending) {
    client.exec("BEGIN");
    try {
      client.exec(migration.sql);
      client
        .prepare("INSERT INTO _schema_version (version, name) VALUES (?, ?)")
        .run(migration.version, migration.name);
      client.exec("COMMIT");
    } catch (err) {
      client.exec("ROLLBACK");
      throw err;
    }
  }

  return { applied: pending.length, skipped: currentVersion };
}
