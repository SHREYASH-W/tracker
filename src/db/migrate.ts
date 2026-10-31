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
  {
    version: 3,
    name: "automation_foundation",
    sql: `
      -- Search profiles: plain-language targets expanded into titles/keywords.
      CREATE TABLE IF NOT EXISTS search_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        titles TEXT NOT NULL DEFAULT '[]',
        keywords TEXT NOT NULL DEFAULT '[]',
        role_type TEXT NOT NULL DEFAULT 'both',
        locations TEXT NOT NULL DEFAULT '[]',
        remote_ok INTEGER NOT NULL DEFAULT 0,
        experience_level TEXT NOT NULL DEFAULT 'any',
        excluded_keywords TEXT NOT NULL DEFAULT '[]',
        min_match_score INTEGER NOT NULL DEFAULT 60,
        auto_apply_mode TEXT NOT NULL DEFAULT 'off',
        auto_apply_threshold INTEGER NOT NULL DEFAULT 80,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS search_profiles_active_idx ON search_profiles(active);

      -- Resume files and structured, user-correctable profiles.
      CREATE TABLE IF NOT EXISTS resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS resumes_active_idx ON resumes(is_active);

      CREATE TABLE IF NOT EXISTS resume_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
        headline TEXT,
        summary TEXT,
        skills TEXT NOT NULL DEFAULT '[]',
        projects TEXT NOT NULL DEFAULT '[]',
        education TEXT NOT NULL DEFAULT '[]',
        experience TEXT NOT NULL DEFAULT '[]',
        links TEXT NOT NULL DEFAULT '[]',
        raw_text TEXT,
        parsed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS resume_profiles_resume_idx ON resume_profiles(resume_id);

      -- Jobs found across ATS and public job boards.
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        source TEXT NOT NULL,
        source_job_id TEXT,
        title TEXT NOT NULL,
        company_name TEXT NOT NULL,
        location TEXT,
        remote INTEGER,
        role_type TEXT,
        employment_type TEXT,
        description TEXT,
        url TEXT,
        apply_url TEXT,
        salary_min INTEGER,
        salary_max INTEGER,
        salary_currency TEXT,
        posted_at INTEGER,
        closed_at INTEGER,
        status TEXT NOT NULL DEFAULT 'open',
        dedupe_hash TEXT NOT NULL,
        raw TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS jobs_dedupe_hash_idx ON jobs(dedupe_hash);
      CREATE INDEX IF NOT EXISTS jobs_company_idx ON jobs(company_id);
      CREATE INDEX IF NOT EXISTS jobs_source_idx ON jobs(source);
      CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
      CREATE INDEX IF NOT EXISTS jobs_posted_idx ON jobs(posted_at);

      CREATE TABLE IF NOT EXISTS job_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        label TEXT NOT NULL,
        kind TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        config TEXT NOT NULL DEFAULT '{}',
        last_run_at INTEGER,
        last_status TEXT,
        last_error TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS job_sources_key_idx ON job_sources(key);

      CREATE TABLE IF NOT EXISTS job_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES search_profiles(id) ON DELETE CASCADE,
        resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
        score INTEGER NOT NULL DEFAULT 0,
        breakdown TEXT NOT NULL DEFAULT '{}',
        explanation TEXT,
        gaps TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS job_matches_unique_idx ON job_matches(job_id, profile_id, resume_id);
      CREATE INDEX IF NOT EXISTS job_matches_profile_idx ON job_matches(profile_id);
      CREATE INDEX IF NOT EXISTS job_matches_score_idx ON job_matches(score);

      -- Applications and the durable apply queue.
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
        person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        profile_id INTEGER REFERENCES search_profiles(id) ON DELETE SET NULL,
        mode TEXT NOT NULL DEFAULT 'review',
        status TEXT NOT NULL DEFAULT 'queued',
        score INTEGER,
        payload TEXT NOT NULL DEFAULT '{}',
        screenshot_path TEXT,
        deep_link TEXT,
        error TEXT,
        submitted_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS applications_job_idx ON applications(job_id);
      CREATE INDEX IF NOT EXISTS applications_status_idx ON applications(status);

      CREATE TABLE IF NOT EXISTS apply_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES search_profiles(id) ON DELETE CASCADE,
        resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
        application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_attempt_at INTEGER,
        last_error TEXT,
        deep_link TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS apply_queue_job_profile_idx ON apply_queue(job_id, profile_id);
      CREATE INDEX IF NOT EXISTS apply_queue_status_idx ON apply_queue(status);
      CREATE INDEX IF NOT EXISTS apply_queue_next_attempt_idx ON apply_queue(next_attempt_at);

      CREATE TABLE IF NOT EXISTS answer_bank (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS answer_bank_key_idx ON answer_bank(key);

      -- Outreach drafts awaiting review or send.
      CREATE TABLE IF NOT EXISTS email_drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        outreach_id INTEGER REFERENCES outreach_records(id) ON DELETE SET NULL,
        job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
        template_id INTEGER REFERENCES message_templates(id) ON DELETE SET NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        model TEXT,
        approved_at INTEGER,
        sent_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS email_drafts_person_idx ON email_drafts(person_id);
      CREATE INDEX IF NOT EXISTS email_drafts_status_idx ON email_drafts(status);

      -- Per-provider, per-operation daily quota accounting.
      CREATE TABLE IF NOT EXISTS provider_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        operation TEXT NOT NULL,
        day TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        quota_limit INTEGER,
        metadata TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS provider_usage_unique_idx ON provider_usage(provider, operation, day);
      CREATE INDEX IF NOT EXISTS provider_usage_day_idx ON provider_usage(day);

      -- Background run logs.
      CREATE TABLE IF NOT EXISTS automation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        profile_id INTEGER REFERENCES search_profiles(id) ON DELETE SET NULL,
        stats TEXT NOT NULL DEFAULT '{}',
        log TEXT,
        started_at INTEGER,
        finished_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS automation_runs_kind_idx ON automation_runs(kind);
      CREATE INDEX IF NOT EXISTS automation_runs_status_idx ON automation_runs(status);

      -- Contacts linked to the jobs they are relevant to.
      CREATE TABLE IF NOT EXISTS person_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        relevance TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS person_jobs_unique_idx ON person_jobs(person_id, job_id);
      CREATE INDEX IF NOT EXISTS person_jobs_job_idx ON person_jobs(job_id);

      -- Seed the source registry. Aggregators that need a key start disabled.
      INSERT OR IGNORE INTO job_sources (key, label, kind, enabled, config) VALUES
        ('greenhouse', 'Greenhouse', 'ats', 1, '{}'),
        ('lever', 'Lever', 'ats', 1, '{}'),
        ('ashby', 'Ashby', 'ats', 1, '{}'),
        ('remotive', 'Remotive', 'remote_board', 1, '{}'),
        ('remoteok', 'RemoteOK', 'remote_board', 1, '{}'),
        ('arbeitnow', 'Arbeitnow', 'job_board', 1, '{}'),
        ('themuse', 'The Muse', 'job_board', 1, '{}'),
        ('hn_who_is_hiring', 'HN Who is Hiring', 'community', 1, '{}'),
        ('adzuna', 'Adzuna', 'aggregator', 0, '{}'),
        ('jsearch', 'JSearch (RapidAPI)', 'aggregator', 0, '{}');
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

  // BEGIN IMMEDIATE serializes writers so parallel build workers cannot apply
  // the same migration twice: the loser waits, then re-checks the version.
  let applied = 0;
  for (const migration of pending) {
    client.exec("BEGIN IMMEDIATE");
    try {
      if (getCurrentVersion(client) >= migration.version) {
        client.exec("COMMIT");
        continue;
      }

      client.exec(migration.sql);
      client
        .prepare("INSERT OR IGNORE INTO _schema_version (version, name) VALUES (?, ?)")
        .run(migration.version, migration.name);
      client.exec("COMMIT");
      applied++;
    } catch (err) {
      try {
        client.exec("ROLLBACK");
      } catch {
        // Ignore rollback errors; the transaction may already be closed.
      }
      throw err;
    }
  }

  return { applied, skipped: migrations.length - applied };
}
