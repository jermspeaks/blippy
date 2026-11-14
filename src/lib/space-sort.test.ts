import { describe, it, expect } from "vitest";
import { parseSpaceSort, sortBlips } from "./space-sort";

const b = (title: string | null, day: number) => ({
  title,
  content: title ?? "zzz",
  createdAt: new Date(2026, 10, day),
});

describe("space sort", () => {
  const items = [b("Banana", 2), b("apple", 3), b("Cherry", 1)];
  it("sorts by date and title (case-insensitive)", () => {
    expect(sortBlips(items, "newest").map((x) => x.title)).toEqual([
      "apple",
      "Banana",
      "Cherry",
    ]);
    expect(sortBlips(items, "oldest").map((x) => x.title)).toEqual([
      "Cherry",
      "Banana",
      "apple",
    ]);
    expect(sortBlips(items, "title-asc").map((x) => x.title)).toEqual([
      "apple",
      "Banana",
      "Cherry",
    ]);
    expect(sortBlips(items, "title-desc").map((x) => x.title)).toEqual([
      "Cherry",
      "Banana",
      "apple",
    ]);
  });
  it("does not mutate and falls back to newest on bad input", () => {
    const copy = [...items];
    sortBlips(items, "oldest");
    expect(items).toEqual(copy);
    expect(parseSpaceSort("nope")).toBe("newest");
    expect(parseSpaceSort(undefined)).toBe("newest");
    expect(parseSpaceSort("oldest")).toBe("oldest");
  });
});
