import { listCategoriesWithBlipCount } from "@/actions/blips";
import Link from "next/link";

export default async function CategoriesPage() {
  const categoriesWithCount = await listCategoriesWithBlipCount();

  return (
    <div className="container max-w-xl py-8">
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
              className="block rounded-lg border border-border bg-card p-4 text-card-foreground hover:bg-accent"
            >
              <span className="font-medium">{cat.name}</span>
              <span className="ml-2 text-muted-foreground">
                ({cat.blipCount})
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
