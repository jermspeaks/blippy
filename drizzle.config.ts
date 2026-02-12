import { defineConfig } from "drizzle-kit";
import path from "path";

const url = process.env.DATABASE_URL ?? "file:./blippy.db";
const filePath = url.replace(/^file:/, "").trim();
const dbPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: dbPath },
});
