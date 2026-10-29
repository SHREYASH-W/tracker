import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a timestamp (ms since epoch) as a readable date string. */
export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format a timestamp as date + time. */
export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative time like "3 days ago" or "in 2 days" (calendar days). */
export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return "—";
  const now = new Date();
  const then = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const thenStart = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const days = Math.round((thenStart - todayStart) / 86400000);

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Get initials from a full name (max 2 characters). */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0]!.substring(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Normalize an email address (trim + lowercase). */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

/** Normalize a URL (ensure it has a protocol). */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/** Today at midnight (start of day) as a timestamp. */
export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** End of today (23:59:59). */
export function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Check if a follow-up date is overdue. */
export function isOverdue(nextFollowUpAt: number | null | undefined): boolean {
  if (!nextFollowUpAt) return false;
  return nextFollowUpAt < startOfToday();
}

/** Check if a follow-up date is due today. */
export function isDueToday(nextFollowUpAt: number | null | undefined): boolean {
  if (!nextFollowUpAt) return false;
  return nextFollowUpAt >= startOfToday() && nextFollowUpAt <= endOfToday();
}

/** Check if a follow-up date is due soon (within next 7 days). */
export function isDueSoon(nextFollowUpAt: number | null | undefined): boolean {
  if (!nextFollowUpAt) return false;
  return nextFollowUpAt > endOfToday() && nextFollowUpAt <= Date.now() + 7 * 86400000;
}

/** Convert a date input value (YYYY-MM-DD) to a timestamp. */
export function dateInputToTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value + "T00:00:00").getTime();
  return isNaN(ts) ? null : ts;
}

/** Convert a timestamp to a date input value (YYYY-MM-DD) in local time. */
export function timestampToDateInput(ts: number | null | undefined): string {
  if (!ts) return "";
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse a CSV string into rows of string arrays. Handles quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        current.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        current.push(field);
        rows.push(current);
        current = [];
        field = "";
      } else {
        field += char;
      }
    }
  }

  // Last field/row
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Convert rows to CSV string. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = cell == null ? "" : String(cell);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    )
    .join("\r\n");
}

/** Safe JSON parse with fallback. */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
