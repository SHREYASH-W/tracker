import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runMigrations } from "./migrate";
import { schema } from "./schema";
import { DatabaseWrapper } from "./sqlite-wrapper";

// --- Database path --------------------------------------------------------

const DB_PATH = resolve(process.cwd(), process.env.DATABASE_URL ?? "./data/contact_crm.db");

// Ensure the data directory exists before opening the database.
try {
  mkdirSync(dirname(DB_PATH), { recursive: true });
} catch {
  // Directory may already exist — ignore
}

// --- Singleton database instance -----------------------------------------
// Using a global prevents duplicate initialization during Next.js dev hot reloads.

type DBInstance = ReturnType<typeof drizzle> & { $client: DatabaseWrapper };

const globalForDb = globalThis as unknown as {
  __crmDb?: DBInstance;
  __crmDbPath?: string;
};

function createDb(): DBInstance {
  const client = new DatabaseWrapper(DB_PATH);

  // Wait for concurrent connections (build workers, dev reloads) before failing
  // on a lock, then enable WAL for better concurrency and durability.
  client.exec("PRAGMA busy_timeout = 5000;");
  client.exec("PRAGMA journal_mode = WAL;");
  client.exec("PRAGMA foreign_keys = ON;");

  // Apply pending migrations before serving any queries.
  runMigrations(client);

  const db = drizzle(client, { schema }) as DBInstance;
  return db;
}

export const db: DBInstance = (() => {
  // Reuse if the path matches (handles dev hot reload correctly).
  if (globalForDb.__crmDb && globalForDb.__crmDbPath === DB_PATH) {
    return globalForDb.__crmDb;
  }

  const instance = createDb();
  globalForDb.__crmDb = instance;
  globalForDb.__crmDbPath = DB_PATH;
  return instance;
})();

/** Direct access to the underlying DatabaseWrapper for raw SQL / migrations. */
export const sqlite = db.$client as DatabaseWrapper;

/** Path to the SQLite database file (used for backups). */
export { DB_PATH };
