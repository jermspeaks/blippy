import { describe, it, expect } from "vitest";
import { parseSpacesListSort, sortSpaces } from "./spaces-list-sort";

const r = (name: string, blipCount: number, day: number | null) => ({
  name,
  blipCount,
  lastAddedAt: day === null ? null : new Date(2026, 10, day),
});

describe("sortSpaces", () => {
  const items = [
    r("beta", 5, 2),
    r("Alpha", 1, 9),
    r("empty", 0, null),
    r("gamma", 9, 5),
  ];
  const names = (s: Parameters<typeof sortSpaces>[1]) =>
    sortSpaces(items, s).map((x) => x.name);
  it("sorts by name, case-insensitive", () => {
    expect(names("name-asc")).toEqual(["Alpha", "beta", "empty", "gamma"]);
    expect(names("name-desc")).toEqual(["gamma", "empty", "beta", "Alpha"]);
  });
  it("sorts by last added with empty spaces last in both directions", () => {
    expect(names("last-added")).toEqual(["Alpha", "gamma", "beta", "empty"]);
    expect(names("last-added-oldest")).toEqual([
      "beta",
      "gamma",
      "Alpha",
      "empty",
    ]);
  });
  it("sorts by blip count", () => {
    expect(names("most-blips")).toEqual(["gamma", "beta", "Alpha", "empty"]);
    expect(names("fewest-blips")).toEqual(["empty", "Alpha", "beta", "gamma"]);
  });
  it("falls back to name-asc on bad input", () => {
    expect(parseSpacesListSort("x")).toBe("name-asc");
    expect(parseSpacesListSort("most-blips")).toBe("most-blips");
  });
});
