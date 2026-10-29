import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runMigrations } from "./migrate";
import { DatabaseWrapper } from "./sqlite-wrapper";

const dbPath = resolve(process.cwd(), process.env.DATABASE_URL ?? "./data/contact_crm.db");
mkdirSync(dirname(dbPath), { recursive: true });

const client = new DatabaseWrapper(dbPath);
client.exec("PRAGMA journal_mode = WAL;");
client.exec("PRAGMA foreign_keys = ON;");

const result = runMigrations(client);
console.log(`Migrations complete: ${result.applied} applied, ${result.skipped} already up to date.`);
client.close();
