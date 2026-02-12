import { listCategoriesWithBlipCount } from "@/actions/blips";
import Link from "next/link";

export default async function CategoriesPage() {
  const categoriesWithCount = await listCategoriesWithBlipCount();

  return (
    <div className="container mx-auto max-w-xl px-8 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Categories</h1>
      <ul className="space-y-2">
        {categoriesWithCount.map((cat) => (
          <li key={cat.id}>
            <Link
              href={
                cat.id === "uncategorized"
                  ? "/?categoryId=uncategorized"
                  : `/?categoryId=${cat.id}`
              }
              className="border-border bg-card text-card-foreground hover:bg-accent block rounded-lg border p-4"
            >
              <span className="font-medium">{cat.name}</span>
              <span className="text-muted-foreground ml-2">
                ({cat.blipCount})
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
