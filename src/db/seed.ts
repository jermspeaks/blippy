import "dotenv/config";
import { db } from "./index";
import { categories } from "./schema";
import { eq } from "drizzle-orm";

const UNCATEGORIZED_ID = "uncategorized";
const UNCATEGORIZED_NAME = "Uncategorized";

async function seed() {
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, UNCATEGORIZED_ID))
    .limit(1);
  if (existing) {
    console.log("Uncategorized category already exists");
    process.exit(0);
    return;
  }
  await db.insert(categories).values({
    id: UNCATEGORIZED_ID,
    name: UNCATEGORIZED_NAME,
    createdAt: new Date(),
  });
  console.log("Seeded Uncategorized category");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
