export const spaceSorts = [
  "newest",
  "oldest",
  "title-asc",
  "title-desc",
] as const;
export type SpaceSort = (typeof spaceSorts)[number];

export const spaceSortLabels: Record<SpaceSort, string> = {
  newest: "Newest added",
  oldest: "Oldest added",
  "title-asc": "Title A–Z",
  "title-desc": "Title Z–A",
};

export function parseSpaceSort(value: string | undefined): SpaceSort {
  return (spaceSorts as readonly string[]).includes(value ?? "")
    ? (value as SpaceSort)
    : "newest";
}

type Sortable = { title: string | null; content: string; createdAt: Date };
const titleOf = (b: Sortable) => (b.title ?? b.content).toLowerCase();

export function sortBlips<T extends Sortable>(
  items: T[],
  sort: SpaceSort
): T[] {
  const out = [...items];
  switch (sort) {
    case "newest":
      return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case "oldest":
      return out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case "title-asc":
      return out.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    case "title-desc":
      return out.sort((a, b) => titleOf(b).localeCompare(titleOf(a)));
  }
}

/** Fixed format so server and client render the same text. */
export function formatAdded(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
