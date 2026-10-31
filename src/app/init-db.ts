/**
 * Called once at app startup (server side) to run all pending DB migrations.
 * The globalThis flag prevents re-running on every Next.js hot reload.
 */

const g = globalThis as unknown as { __crmDbInitialized?: boolean };

export function initDb() {
  if (g.__crmDbInitialized) return;

  // Dynamic require so this only executes on the server (Node.js runtime).
  // We import sqlite from the already-initialised db singleton so the
  // DatabaseWrapper is available before migrations run.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sqlite } = require("@/db") as { sqlite: import("@/db/sqlite-wrapper").DatabaseWrapper };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runMigrations } = require("@/db/migrate") as {
    runMigrations: (client: { exec(s: string): void; prepare(s: string): { get(...p: unknown[]): unknown; run(...p: unknown[]): unknown } }) => { applied: number; skipped: number };
  };

  const result = runMigrations(sqlite.raw);
  if (result.applied > 0) {
    console.log(`[CRM] Applied ${result.applied} migration(s)`);
  }
  g.__crmDbInitialized = true;
}
