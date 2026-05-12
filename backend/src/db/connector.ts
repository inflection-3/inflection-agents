import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL ?? "./inflection.db", {
  create: true,
  readwrite: true,
});

sqlite.run("PRAGMA journal_mode=WAL");
sqlite.run("PRAGMA foreign_keys=ON");

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
