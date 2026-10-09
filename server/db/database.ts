import Database from "better-sqlite3";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type Db = InstanceType<typeof Database>;
const migrationsDir = fileURLToPath(new URL("./migrations/", import.meta.url));
let current: Db | undefined;
let currentPath: string | undefined;
export function openDatabase(
  file = process.env.DATABASE_PATH ||
    join(
      process.env.LOCALAPPDATA || process.env.APPDATA || process.cwd(),
      "JSN Designs Business Studio",
      "business.sqlite",
    ),
) {
  if (file !== ":memory:")
    mkdirSync(
      file.slice(0, Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\"))),
      { recursive: true },
    );
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (
      db.prepare("SELECT version FROM schema_migrations").all() as {
        version: number;
      }[]
    ).map((r) => r.version),
  );
  const migrations = readdirSync(migrationsDir)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)));
  for (const name of migrations) {
    const version = Number(name.slice(0, 3));
    if (applied.has(version)) continue;
    db.transaction(() => {
      db.exec(readFileSync(join(migrationsDir, name), "utf8"));
      db.prepare(
        "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
      ).run(version, new Date().toISOString());
    })();
  }
  const integrity = db.pragma("integrity_check") as {
    integrity_check: string;
  }[];
  if (integrity[0]?.integrity_check !== "ok") {
    db.close();
    throw new Error("SQLite integrity check failed during initialization.");
  }
  if (
    !(db.pragma("foreign_keys") as { foreign_keys: number }[])[0]?.foreign_keys
  ) {
    db.close();
    throw new Error("SQLite foreign key enforcement could not be enabled.");
  }
  if ((db.pragma("foreign_key_check") as unknown[]).length > 0) {
    db.close();
    throw new Error(
      "SQLite foreign-key integrity check failed during initialization.",
    );
  }
  return db;
}
export function initializeDatabase() {
  if (!current) {
    currentPath =
      process.env.DATABASE_PATH ||
      join(
        process.env.LOCALAPPDATA || process.env.APPDATA || process.cwd(),
        "JSN Designs Business Studio",
        "business.sqlite",
      );
    current = openDatabase(currentPath);
  }
  return current;
}
export function getDatabase(): Db {
  return current ?? initializeDatabase();
}
export function restoreDatabase(backupPath: string) {
  if (!currentPath || currentPath === ":memory:")
    throw new Error("Restore is unavailable for an in-memory database.");
  const target = currentPath,
    candidate = `${target}.restore-${Date.now()}`,
    recovery = `${target}.recovery-${Date.now()}`;
  const check = new Database(backupPath);
  try {
    check.pragma("foreign_keys = ON");
    const tables = new Set(
      (
        check
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all() as { name: string }[]
      ).map((row) => row.name),
    );
    const requiredTables = [
      "schema_migrations",
      "clients",
      "quotations",
      "quotation_items",
      "orders",
      "payments",
      "tasks",
    ];
    if (
      (check.pragma("integrity_check") as { integrity_check: string }[])[0]
        ?.integrity_check !== "ok" ||
      (check.pragma("foreign_key_check") as unknown[]).length > 0 ||
      !check.prepare("SELECT 1 FROM schema_migrations WHERE version=1").get() ||
      requiredTables.some((name) => !tables.has(name))
    )
      throw new Error("Invalid backup database.");
  } finally {
    check.close();
  }
  current?.close();
  current = undefined;
  try {
    renameSync(target, recovery);
    copyFileSync(backupPath, candidate);
    renameSync(candidate, target);
    current = openDatabase(target);
    currentPath = target;
    return recovery;
  } catch (error) {
    try {
      rmSync(candidate, { force: true });
      if (!current && existsSync(recovery)) {
        if (existsSync(target))
          renameSync(target, `${target}.failed-${Date.now()}`);
        renameSync(recovery, target);
      }
      current = openDatabase(target);
      currentPath = target;
    } catch {
      /* preserve original failure; recovery file remains available */
    }
    throw error;
  }
}
export function setDatabaseForTests(db?: Db) {
  current?.close();
  current = db;
  currentPath = undefined;
}
export function removeDatabaseFile(path: string) {
  try {
    unlinkSync(path);
  } catch {
    /* best effort cleanup */
  }
}
