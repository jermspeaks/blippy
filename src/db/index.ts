import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import * as schema from "./schema";

function getDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./blippy.db";
  const filePath = url.replace(/^file:/, "").trim();
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

const sqlite = new Database(getDbPath());
export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
