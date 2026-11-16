import { describe, it, expect } from "vitest";
import { addDays, addMonths, isLaterDay, parseDateInput, snoozePresets, toDateInput } from "./snooze";

const at = (y: number, m: number, d: number, h = 15) => new Date(y, m - 1, d, h, 30);

describe("snooze presets", () => {
  it("are tomorrow, a week and a month out, at the start of the day", () => {
    const [t, w, m] = snoozePresets(at(2026, 11, 16));
    expect(toDateInput(t.date)).toBe("2026-11-17");
    expect(toDateInput(w.date)).toBe("2026-11-23");
    expect(toDateInput(m.date)).toBe("2026-12-16");
    expect([t, w, m].every((p) => p.date.getHours() === 0 && p.date.getMinutes() === 0)).toBe(true);
  });

  it("clamps month math to the last day of the target month", () => {
    expect(toDateInput(addMonths(at(2026, 1, 31), 1))).toBe("2026-02-28");
    expect(toDateInput(addMonths(at(2028, 1, 31), 1))).toBe("2028-02-29");
    expect(toDateInput(addMonths(at(2026, 12, 15), 1))).toBe("2027-01-15");
    expect(toDateInput(addDays(at(2026, 12, 30), 3))).toBe("2027-01-02");
  });
});

describe("custom dates", () => {
  it("parses a date input as a local day and rejects bad values", () => {
    const d = parseDateInput("2026-11-20")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 20]);
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput("11/20/2026")).toBeNull();
  });

  it("only accepts a day after today", () => {
    const now = at(2026, 11, 16, 23);
    expect(isLaterDay(at(2026, 11, 16, 0), now)).toBe(false);
    expect(isLaterDay(at(2026, 11, 17, 0), now)).toBe(true);
    expect(isLaterDay(at(2026, 11, 1), now)).toBe(false);
  });
});
