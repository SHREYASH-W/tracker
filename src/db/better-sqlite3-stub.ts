/**
 * Stub for the `better-sqlite3` package.
 *
 * The official Drizzle `better-sqlite3` driver imports `better-sqlite3` at
 * the module level (`import Client from "better-sqlite3"`). On systems without
 * C++ build tools, the native addon cannot be compiled.
 *
 * This stub satisfies the import resolution so the module loads. The `Client`
 * constructor is never called at runtime because we always pass a wrapper
 * object (that mimics the better-sqlite3 API) to `drizzle()` directly.
 */

export interface BetterSqlite3Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  raw(): { all(...params: unknown[]): unknown[][]; get(...params: unknown[]): unknown[] | undefined };
}

export interface BetterSqlite3Database {
  prepare(sql: string): BetterSqlite3Statement;
  exec(sql: string): void;
  transaction<T>(fn: (...args: unknown[]) => T): TransactionFn<T>;
  pragma(sql: string): unknown;
  close(): void;
}

export interface TransactionFn<T = unknown> {
  (...args: unknown[]): T;
  deferred(...args: unknown[]): T;
  immediate(...args: unknown[]): T;
  exclusive(...args: unknown[]): T;
}

// The default export is a function that throws if ever called.
// Drizzle only calls `new Client(...)` when the first argument to
// `drizzle()` is undefined or a string — we always pass an object.
function DatabaseStub(): BetterSqlite3Database {
  throw new Error(
    "better-sqlite3 native module is not available. " +
      "Pass a DatabaseWrapper instance to drizzle() instead of a file path.",
  );
}

export default DatabaseStub;
