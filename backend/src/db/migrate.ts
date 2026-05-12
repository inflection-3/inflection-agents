/**
 * Run as: bun run src/db/migrate.ts
 * Applies SQL migration files in order, tracking applied migrations in a
 * __drizzle_migrations table so each file only runs once.
 */
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const dbPath = process.env.DATABASE_URL ?? "./inflection.db";
const migrationsDir = join(import.meta.dir, "migrations");

const db = new Database(dbPath, { create: true, readwrite: true });
db.run("PRAGMA journal_mode=WAL");
db.run("PRAGMA foreign_keys=OFF"); // off during migrations to allow table creation order flexibility

db.run(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

const applied = new Set(
  db.prepare("SELECT hash FROM __drizzle_migrations").all().map((r: any) => r.hash)
);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = readFileSync(join(migrationsDir, file), "utf-8");

  // Drizzle generates --> statement-breakpoint comments between statements
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const applyMigration = db.transaction(() => {
    for (const stmt of statements) {
      db.run(stmt);
    }
    db.run("INSERT INTO __drizzle_migrations (hash) VALUES (?)", [file]);
  });

  applyMigration();
  console.log(`✓ applied: ${file}`);
}

db.run("PRAGMA foreign_keys=ON");
db.close();
console.log("Migrations complete.");
