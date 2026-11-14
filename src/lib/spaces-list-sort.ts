export const spacesListSorts = [
  "name-asc",
  "name-desc",
  "last-added",
  "last-added-oldest",
  "most-blips",
  "fewest-blips",
] as const;
export type SpacesListSort = (typeof spacesListSorts)[number];

export const spacesListSortLabels: Record<SpacesListSort, string> = {
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  "last-added": "Last added (newest first)",
  "last-added-oldest": "Last added (oldest first)",
  "most-blips": "Most blips",
  "fewest-blips": "Fewest blips",
};

export function parseSpacesListSort(value: string | undefined): SpacesListSort {
  return (spacesListSorts as readonly string[]).includes(value ?? "")
    ? (value as SpacesListSort)
    : "name-asc";
}

type Row = { name: string; blipCount: number; lastAddedAt: Date | null };

export function sortSpaces<T extends Row>(
  items: T[],
  sort: SpacesListSort
): T[] {
  const byName = (a: T, b: T) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  // Spaces with no blips have no date; they always sort last for the date sorts.
  const time = (r: T) => r.lastAddedAt?.getTime() ?? null;
  const byDate = (dir: 1 | -1) => (a: T, b: T) => {
    const ta = time(a);
    const tb = time(b);
    if (ta === null && tb === null) return byName(a, b);
    if (ta === null) return 1;
    if (tb === null) return -1;
    return (ta - tb) * dir || byName(a, b);
  };
  const out = [...items];
  switch (sort) {
    case "name-asc":
      return out.sort(byName);
    case "name-desc":
      return out.sort((a, b) => byName(b, a));
    case "last-added":
      return out.sort(byDate(-1));
    case "last-added-oldest":
      return out.sort(byDate(1));
    case "most-blips":
      return out.sort((a, b) => b.blipCount - a.blipCount || byName(a, b));
    case "fewest-blips":
      return out.sort((a, b) => a.blipCount - b.blipCount || byName(a, b));
  }
}
