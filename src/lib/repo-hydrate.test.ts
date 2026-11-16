import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "blippy-test-")
  );
  process.env.DATABASE_URL = `file:${require("path").join(dir, "t.db")}`;
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/repo-lookup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/repo-lookup")>()),
  lookupRepo: vi.fn(),
}));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blips, repoDetails, spaces } from "@/db/schema";
import { lookupRepo, RepoLookupUnavailableError } from "@/lib/repo-lookup";
import { hydratePendingRepos, pendingRepoBlips } from "./repo-hydrate";
import { ensureCodeSpace, sweepRepoBlips } from "./code-space";
import { refreshRepo } from "@/actions/repos";
import { convertSpaceToCode } from "@/actions/spaces";

const now = new Date();
const seed = (id: string, url: string | null, extra: Partial<typeof blips.$inferInsert> = {}) =>
  db.insert(blips).values({ id, content: id, title: id, url, status: "active", createdAt: now, updatedAt: now, ...extra });
const info = (o: Record<string, unknown> = {}) => ({
  description: "A GUI library",
  stars: 24000,
  language: "Rust",
  topics: ["gui"],
  license: "MIT",
  homepage: null,
  pushedAt: now,
  archived: false,
  ...o,
});
const detailsOf = async (id: string) =>
  (await db.select().from(repoDetails).where(eq(repoDetails.blipId, id)))[0];
const blipOf = async (id: string) => (await db.select().from(blips).where(eq(blips.id, id)))[0];

beforeAll(() => migrate(db, { migrationsFolder: "drizzle" }));
beforeEach(() => vi.clearAllMocks());

describe("code space", () => {
  it("adopts a general 'Programming Projects' space instead of duplicating it", async () => {
    await db.insert(spaces).values({ id: "sp-pp", name: "Programming Projects", kind: "general", autoIntake: true, aiRouting: true, createdAt: now });
    const s = ensureCodeSpace(db)!;
    expect(s).toMatchObject({ id: "sp-pp", kind: "code" });
    expect(ensureCodeSpace(db)!.id).toBe("sp-pp");
    expect((await db.select().from(spaces)).filter((x) => x.kind === "code")).toHaveLength(1);
  });

  it("returns null with auto-intake off", async () => {
    await db.update(spaces).set({ autoIntake: false }).where(eq(spaces.id, "sp-pp"));
    expect(ensureCodeSpace(db)).toBeNull();
    await db.update(spaces).set({ autoIntake: true }).where(eq(spaces.id, "sp-pp"));
  });

  it("sweeps only unstored repo-root blips", async () => {
    await seed("s1", "https://github.com/o/r");
    await seed("s2", "https://github.com/o/r/blob/main/x.md");
    await seed("s3", "https://github.com/o/stored", { spaceId: "sp-pp" });
    expect(sweepRepoBlips(db, "sp-pp")).toBe(1);
    expect((await blipOf("s1")).spaceId).toBe("sp-pp");
    expect((await blipOf("s2")).spaceId).toBeNull();
  });
});

describe("hydrating repo details", () => {
  it("stores details and fills an empty summary, leaving the title alone", async () => {
    vi.mocked(lookupRepo).mockResolvedValue(info());
    await seed("r1", "https://github.com/iced-rs/iced", { spaceId: "sp-pp", title: "iced", summary: null });
    const counts = await hydratePendingRepos(25, "sp-pp");
    expect(counts.ok).toBeGreaterThanOrEqual(1);
    expect(await detailsOf("r1")).toMatchObject({ provider: "github", owner: "iced-rs", name: "iced", stars: 24000, language: "Rust", topics: '["gui"]', lookupStatus: "ok" });
    expect(await blipOf("r1")).toMatchObject({ title: "iced", summary: "A GUI library" });
  });

  it("keeps an existing summary", async () => {
    vi.mocked(lookupRepo).mockResolvedValue(info());
    await seed("r2", "https://github.com/o/keep", { spaceId: "sp-pp", summary: "my own note" });
    await hydratePendingRepos(25, "sp-pp");
    expect((await blipOf("r2")).summary).toBe("my own note");
  });

  it("records failed for a missing repo, and defers (records nothing) when the host is unavailable", async () => {
    vi.mocked(lookupRepo).mockImplementation(async (ref) => {
      if (ref.name === "gone") return null;
      throw new RepoLookupUnavailableError("HTTP 429");
    });
    await seed("r3", "https://github.com/o/gone", { spaceId: "sp-pp" });
    await seed("r4", "https://github.com/o/busy", { spaceId: "sp-pp" });
    const counts = await hydratePendingRepos(25, "sp-pp");
    expect(counts).toMatchObject({ failed: 1, deferred: 1 });
    expect((await detailsOf("r3")).lookupStatus).toBe("failed");
    expect(await detailsOf("r4")).toBeUndefined();
    expect(pendingRepoBlips(25, "sp-pp").map((b) => b.id)).toEqual(["r4"]);
  });

  it("refresh replaces a failed row, and a failed refresh keeps earlier good details", async () => {
    vi.mocked(lookupRepo).mockResolvedValue(info({ stars: 5 }));
    expect(await refreshRepo("r3")).toEqual({ ok: true, found: true });
    expect(await detailsOf("r3")).toMatchObject({ lookupStatus: "ok", stars: 5 });
    vi.mocked(lookupRepo).mockResolvedValue(null);
    expect(await refreshRepo("r3")).toEqual({ ok: true, found: false });
    expect((await detailsOf("r3")).lookupStatus).toBe("ok");
    vi.mocked(lookupRepo).mockRejectedValue(new RepoLookupUnavailableError("HTTP 403"));
    expect(await refreshRepo("r3")).toMatchObject({ ok: false });
  });
});

describe("convert to code", () => {
  it("converts a general space once and refuses a second code space", async () => {
    await db.insert(spaces).values({ id: "sp-gen", name: "Gen", kind: "general", autoIntake: true, aiRouting: true, createdAt: now });
    expect(await convertSpaceToCode("sp-gen")).toMatchObject({ ok: false });
    expect(await convertSpaceToCode("sp-pp")).toMatchObject({ ok: false });
  });
});
