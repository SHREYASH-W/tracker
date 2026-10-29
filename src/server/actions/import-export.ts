"use server";
import { revalidatePath } from "next/cache";
import { sqlite } from "@/db";
import { parseCsv, toCsv, normalizeEmail } from "@/lib/utils";
import type { ActionResult, ImportPreview } from "@/lib/types";

// CSV column headers for export / import reference
export const CSV_HEADERS = [
  "fullName", "email", "phone", "jobTitle", "department",
  "companyName", "companyWebsite", "companyIndustry",
  "linkedinUrl", "location", "purpose", "targetRole",
  "channel", "status", "notes",
];

export async function previewCsvImport(csvText: string): Promise<ImportPreview> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { total: 0, valid: 0, duplicates: 0, invalid: 0, rows: [] };
  }

  const headers = rows[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const dataRows = rows.slice(1);

  const preview: ImportPreview = {
    total: dataRows.length,
    valid: 0,
    duplicates: 0,
    invalid: 0,
    rows: [],
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]?.trim() ?? ""; });

    // Map common aliases
    const fullName = obj["full_name"] || obj["fullname"] || obj["name"] || "";
    const email = normalizeEmail(obj["email"] ?? "") ?? "";
    const companyName = obj["company_name"] || obj["company"] || obj["companyname"] || "";
    const jobTitle = obj["job_title"] || obj["title"] || obj["role"] || "";

    const issues: string[] = [];
    if (!fullName) issues.push("Full name is required");
    if (!companyName) issues.push("Company name is required");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("Invalid email");

    if (issues.length > 0) {
      preview.invalid++;
      preview.rows.push({ rowNumber: i + 2, person: { fullName, email: email || null, jobTitle: jobTitle || null, companyName }, status: "invalid", issues });
      continue;
    }

    // Check for duplicates
    const isDup = email
      ? (sqlite.raw.prepare(`SELECT id FROM people WHERE LOWER(email) = LOWER(?) LIMIT 1`).get(email) as { id: number } | undefined) !== undefined
      : false;

    if (isDup) {
      preview.duplicates++;
      preview.rows.push({ rowNumber: i + 2, person: { fullName, email, jobTitle: jobTitle || null, companyName }, status: "duplicate", issues: ["Email already exists"] });
    } else {
      preview.valid++;
      preview.rows.push({ rowNumber: i + 2, person: { fullName, email, jobTitle: jobTitle || null, companyName }, status: "valid", issues: [] });
    }
  }

  return preview;
}

export async function importCsv(csvText: string, skipDuplicates = true): Promise<ActionResult<{ added: number; skipped: number; invalid: number }>> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { success: false, message: "CSV is empty or has no data rows" };

  const headers = rows[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const dataRows = rows.slice(1);

  let added = 0, skipped = 0, invalid = 0;

  for (const row of dataRows) {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]?.trim() ?? ""; });

    const fullName = obj["full_name"] || obj["fullname"] || obj["name"] || "";
    const email = normalizeEmail(obj["email"] ?? "");
    const companyName = obj["company_name"] || obj["company"] || obj["companyname"] || "";
    const jobTitle = obj["job_title"] || obj["title"] || obj["role"] || "";
    const phone = obj["phone"] || obj["phone_number"] || "";
    const linkedinUrl = obj["linkedin_url"] || obj["linkedin"] || "";
    const location = obj["location"] || "";
    const purpose = obj["purpose"] || "Networking";
    const status = obj["status"] || "not_contacted";
    const notes = obj["notes"] || "";

    if (!fullName || !companyName) { invalid++; continue; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid++; continue; }

    if (skipDuplicates && email) {
      const dup = sqlite.raw.prepare(`SELECT id FROM people WHERE LOWER(email) = LOWER(?) LIMIT 1`).get(email) as { id: number } | undefined;
      if (dup) { skipped++; continue; }
    }

    try {
      sqlite.raw.exec("BEGIN DEFERRED");

      let companyId: number;
      const existing = sqlite.raw.prepare(`SELECT id FROM companies WHERE LOWER(name) = LOWER(?) LIMIT 1`).get(companyName) as { id: number } | undefined;
      if (existing) {
        companyId = existing.id;
      } else {
        const res = sqlite.raw.prepare(`INSERT INTO companies (name) VALUES (?)`).run(companyName);
        companyId = Number(res.lastInsertRowid);
      }

      const pRes = sqlite.raw.prepare(`
        INSERT INTO people (company_id, full_name, job_title, email, phone, linkedin_url, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(companyId, fullName, jobTitle || null, email || null, phone || null, linkedinUrl || null, location || null, notes || null);
      const personId = Number(pRes.lastInsertRowid);

      sqlite.raw.prepare(`
        INSERT INTO outreach_records (person_id, purpose, status)
        VALUES (?, ?, ?)
      `).run(personId, purpose, status);

      sqlite.raw.exec("COMMIT");
      added++;
    } catch (err) {
      try { sqlite.raw.exec("ROLLBACK"); } catch {}
      console.error("Import row error:", err);
      invalid++;
    }
  }

  revalidatePath("/people");
  revalidatePath("/companies");
  revalidatePath("/");
  return { success: true, message: `Import complete`, data: { added, skipped, invalid } };
}

export async function exportPeopleCsv(personIds?: number[]): Promise<string> {
  let rows: Record<string, unknown>[];
  if (personIds?.length) {
    const placeholders = personIds.map(() => "?").join(",");
    rows = sqlite.raw.prepare(`
      SELECT p.full_name, p.email, p.phone, p.job_title, p.department,
             c.name as company_name, p.linkedin_url, p.location,
             o.purpose, o.target_role, o.channel, o.status, p.notes,
             o.first_contacted_at, o.next_follow_up_at
      FROM people p
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN outreach_records o ON o.person_id = p.id AND o.id = (
        SELECT id FROM outreach_records WHERE person_id = p.id ORDER BY created_at DESC LIMIT 1
      )
      WHERE p.id IN (${placeholders})
      ORDER BY p.full_name
    `).all(...personIds) as Record<string, unknown>[];
  } else {
    rows = sqlite.raw.prepare(`
      SELECT p.full_name, p.email, p.phone, p.job_title, p.department,
             c.name as company_name, p.linkedin_url, p.location,
             o.purpose, o.target_role, o.channel, o.status, p.notes,
             o.first_contacted_at, o.next_follow_up_at
      FROM people p
      LEFT JOIN companies c ON c.id = p.company_id
      LEFT JOIN outreach_records o ON o.person_id = p.id AND o.id = (
        SELECT id FROM outreach_records WHERE person_id = p.id ORDER BY created_at DESC LIMIT 1
      )
      ORDER BY p.full_name
    `).all() as Record<string, unknown>[];
  }

  const headers = ["Full Name","Email","Phone","Job Title","Department","Company","LinkedIn","Location","Purpose","Target Role","Channel","Status","Notes"];
  const data = rows.map((r) => [
    r.full_name, r.email, r.phone, r.job_title, r.department,
    r.company_name, r.linkedin_url, r.location,
    r.purpose, r.target_role, r.channel, r.status, r.notes,
  ]);

  return toCsv([headers, ...data]);
}

export async function exportFullBackup(): Promise<string> {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    companies: sqlite.raw.prepare("SELECT * FROM companies ORDER BY id").all(),
    people: sqlite.raw.prepare("SELECT * FROM people ORDER BY id").all(),
    opportunities: sqlite.raw.prepare("SELECT * FROM opportunities ORDER BY id").all(),
    outreach_records: sqlite.raw.prepare("SELECT * FROM outreach_records ORDER BY id").all(),
    interactions: sqlite.raw.prepare("SELECT * FROM interactions ORDER BY id").all(),
    message_templates: sqlite.raw.prepare("SELECT * FROM message_templates ORDER BY id").all(),
    settings: sqlite.raw.prepare("SELECT * FROM settings").all(),
  };
  return JSON.stringify(data, null, 2);
}

export async function restoreBackup(jsonText: string): Promise<ActionResult<{ restored: Record<string, number> }>> {
  let data: {
    version: number;
    companies?: unknown[];
    people?: unknown[];
    opportunities?: unknown[];
    outreach_records?: unknown[];
    interactions?: unknown[];
    message_templates?: unknown[];
  };

  try {
    data = JSON.parse(jsonText);
  } catch {
    return { success: false, message: "Invalid JSON — the backup file could not be parsed" };
  }

  if (!data.version || !Array.isArray(data.people)) {
    return { success: false, message: "Invalid backup format — missing required fields" };
  }

  const restored: Record<string, number> = {};

  try {
    sqlite.raw.exec("BEGIN IMMEDIATE");

    // Clear tables in FK-safe order
    sqlite.raw.exec("DELETE FROM interactions");
    sqlite.raw.exec("DELETE FROM outreach_records");
    sqlite.raw.exec("DELETE FROM opportunities");
    sqlite.raw.exec("DELETE FROM people");
    sqlite.raw.exec("DELETE FROM companies");

    const insertRows = (table: string, rows: unknown[]) => {
      if (!rows?.length) return;
      const sample = rows[0] as Record<string, unknown>;
      const cols = Object.keys(sample);
      const placeholders = cols.map(() => "?").join(",");
      const stmt = sqlite.raw.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`);
      rows.forEach((row) => stmt.run(...Object.values(row as Record<string, unknown>)));
      restored[table] = rows.length;
    };

    insertRows("companies", data.companies ?? []);
    insertRows("people", data.people ?? []);
    insertRows("opportunities", data.opportunities ?? []);
    insertRows("outreach_records", data.outreach_records ?? []);
    insertRows("interactions", data.interactions ?? []);
    if (data.message_templates?.length) insertRows("message_templates", data.message_templates);

    sqlite.raw.exec("COMMIT");
  } catch (err) {
    try { sqlite.raw.exec("ROLLBACK"); } catch {}
    return { success: false, message: "Restore failed: " + String(err) };
  }

  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath("/companies");
  revalidatePath("/follow-ups");
  return { success: true, message: "Backup restored successfully", data: { restored } };
}
