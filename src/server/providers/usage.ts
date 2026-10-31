import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { providerUsage } from "@/db/schema";
import type { ProviderUsage } from "@/lib/types";
import { safeJsonParse } from "@/lib/utils";

/** UTC day key used for daily quota windows (YYYY-MM-DD). */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export interface RecordUsageInput {
  provider: string;
  operation: string;
  quotaLimit?: number | null;
  metadata?: Record<string, unknown>;
}

export interface UsageSnapshot {
  provider: string;
  operation: string;
  day: string;
  count: number;
  quotaLimit: number | null;
  remaining: number | null;
  metadata: Record<string, unknown>;
  updatedAt: number;
}

/** Increment the daily counter for a provider call. Never throws into callers. */
export async function recordUsage(input: RecordUsageInput): Promise<ProviderUsage | null> {
  const day = utcDay();
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  try {
    const rows = await db
      .insert(providerUsage)
      .values({
        provider: input.provider,
        operation: input.operation,
        day,
        count: 1,
        quotaLimit: input.quotaLimit ?? null,
        metadata: metadata ?? "{}",
      })
      .onConflictDoUpdate({
        target: [providerUsage.provider, providerUsage.operation, providerUsage.day],
        set: {
          count: sql`${providerUsage.count} + 1`,
          quotaLimit: sql`coalesce(${input.quotaLimit ?? null}, ${providerUsage.quotaLimit})`,
          metadata: metadata ? metadata : sql`${providerUsage.metadata}`,
          updatedAt: Date.now(),
        },
      })
      .returning();
    return rows[0] ?? null;
  } catch {
    // Quota bookkeeping must never break the caller.
    return null;
  }
}

export async function getUsageCount(
  provider: string,
  operation: string,
  day: string = utcDay(),
): Promise<number> {
  const rows = await db
    .select({ count: providerUsage.count })
    .from(providerUsage)
    .where(
      and(
        eq(providerUsage.provider, provider),
        eq(providerUsage.operation, operation),
        eq(providerUsage.day, day),
      ),
    )
    .limit(1);
  return rows[0]?.count ?? 0;
}

export async function getProviderUsage(day: string = utcDay()): Promise<UsageSnapshot[]> {
  const rows = await db
    .select()
    .from(providerUsage)
    .where(eq(providerUsage.day, day));

  return rows
    .map((row) => ({
      provider: row.provider,
      operation: row.operation,
      day: row.day,
      count: row.count,
      quotaLimit: row.quotaLimit,
      remaining:
        typeof row.quotaLimit === "number" ? Math.max(0, row.quotaLimit - row.count) : null,
      metadata: safeJsonParse<Record<string, unknown>>(row.metadata, {}),
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.operation.localeCompare(b.operation));
}
