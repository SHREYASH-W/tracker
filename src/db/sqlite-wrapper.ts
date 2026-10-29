/**
 * Adapter that wraps Node's built-in `node:sqlite` `DatabaseSync` so it
 * satisfies the interface expected by Drizzle's `better-sqlite3` driver.
 *
 * Key differences handled:
 *  - `node:sqlite`'s `StatementSync` doesn't have a `.raw()` method.
 *    We create a second prepared statement with `setReturnArrays(true)`.
 *  - `node:sqlite` doesn't have a `.transaction()` method.
 *    We emulate it using `BEGIN` / `COMMIT` / `ROLLBACK`.
 */

import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import type { BetterSqlite3Database, BetterSqlite3Statement, TransactionFn } from "./better-sqlite3-stub";

/** A statement that returns rows as arrays (column-ordered) rather than objects. */
interface RawStatement {
  all(...params: unknown[]): unknown[][];
  get(...params: unknown[]): unknown[] | undefined;
}

class RawStatementAdapter implements RawStatement {
  private readonly rawStmt: StatementSync;

  constructor(rawStmt: StatementSync) {
    this.rawStmt = rawStmt;
    this.rawStmt.setReturnArrays(true);
  }

  all(...params: unknown[]): unknown[][] {
    return this.rawStmt.all(...(params as SQLInputValue[])) as unknown as unknown[][];
  }

  get(...params: unknown[]): unknown[] | undefined {
    const result = this.rawStmt.get(...(params as SQLInputValue[]));
    return result === undefined ? undefined : (result as unknown as unknown[]);
  }
}

class StatementAdapter implements BetterSqlite3Statement {
  private readonly stmt: StatementSync;
  private readonly db: DatabaseSync;
  private readonly sql: string;

  constructor(db: DatabaseSync, sql: string) {
    this.db = db;
    this.sql = sql;
    this.stmt = db.prepare(sql);
  }

  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    return this.stmt.run(...(params as SQLInputValue[])) as unknown as {
      changes: number;
      lastInsertRowid: number | bigint;
    };
  }

  all(...params: unknown[]): unknown[] {
    return this.stmt.all(...(params as SQLInputValue[])) as unknown as unknown[];
  }

  get(...params: unknown[]): unknown {
    return this.stmt.get(...(params as SQLInputValue[]));
  }

  raw(): RawStatement {
    // Prepare a fresh statement in array-return mode so the original
    // statement (object mode) is not affected.
    return new RawStatementAdapter(this.db.prepare(this.sql));
  }
}

function createTransactionFn<T extends (...args: unknown[]) => unknown>(
  db: DatabaseSync,
  fn: T,
): TransactionFn<ReturnType<T>> {
  const runWithMode = (beginSql: string) =>
    (...args: unknown[]): ReturnType<T> => {
      db.exec(beginSql);
      try {
        const result = fn(...args);
        db.exec("COMMIT");
        return result as ReturnType<T>;
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // Ignore rollback errors — the connection may already be rolled back
        }
        throw err;
      }
    };

  const wrapper = runWithMode("BEGIN") as TransactionFn<ReturnType<T>>;
  wrapper.deferred = runWithMode("BEGIN DEFERRED");
  wrapper.immediate = runWithMode("BEGIN IMMEDIATE");
  wrapper.exclusive = runWithMode("BEGIN EXCLUSIVE");
  return wrapper;
}

export class DatabaseWrapper implements BetterSqlite3Database {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
  }

  prepare(sql: string): StatementAdapter {
    return new StatementAdapter(this.db, sql);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<T extends (...args: unknown[]) => unknown>(fn: T): TransactionFn<ReturnType<T>> {
    return createTransactionFn(this.db, fn);
  }

  pragma(sql: string): unknown {
    // Strip the "PRAGMA " prefix and execute the remaining SQL
    const cleaned = sql.replace(/^PRAGMA\s+/i, "");
    return this.db.prepare(`PRAGMA ${cleaned}`).all();
  }

  close(): void {
    this.db.close();
  }

  /** Access the underlying node:sqlite DatabaseSync for direct use. */
  get raw(): DatabaseSync {
    return this.db;
  }
}
