/**
 * Called once at app startup (server side) to ensure all migrations run.
 * Uses a flag on globalThis so it only runs once per process, not on every hot reload.
 */

const g = globalThis as unknown as { __crmDbInitialized?: boolean };

export function initDb() {
  if (g.__crmDbInitialized) return;
  // Dynamic require so this only runs in a Node.js (server) context.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runMigrations } = require("../db/migrate") as { runMigrations: () => { applied: number; skipped: number } };
  const result = runMigrations();
  if (result.applied > 0) {
    console.log(`[CRM] Applied ${result.applied} migration(s)`);
  }
  g.__crmDbInitialized = true;
}
