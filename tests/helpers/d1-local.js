// Async D1 API shape backed by an isolated SQLite fixture, not a production adapter.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function localD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL(
        "../../cloudflare/migrations/0001_foundation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const convert = (value) =>
    value instanceof ArrayBuffer
      ? Buffer.from(value)
      : ArrayBuffer.isView(value)
        ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
        : value;
  const statement = (sql, args = []) => ({
    bind(...values) {
      return statement(sql, values.map(convert));
    },
    async first() {
      return sqlite.prepare(sql).get(...args) || null;
    },
    async run() {
      const result = sqlite.prepare(sql).run(...args);
      return { success: true, meta: { changes: result.changes } };
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...args) };
    },
  });
  return {
    sqlite,
    beforeBatch: null,
    prepare: statement,
    async batch(statements) {
      await this.beforeBatch?.();
      sqlite.exec("BEGIN");
      try {
        for (const stmt of statements) await stmt.all();
        sqlite.exec("COMMIT");
        return statements.map(() => ({ success: true }));
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
