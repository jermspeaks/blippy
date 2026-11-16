export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Same day of the month `n` months on, clamped to the month's last day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(d: Date, n: number): Date {
  const x = startOfDay(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

export type SnoozePreset = { key: "tomorrow" | "week" | "month"; label: string; date: Date };

/** Quick snooze choices. Each is the start of a later day: the blip is due again that morning. */
export function snoozePresets(now: Date = new Date()): SnoozePreset[] {
  return [
    { key: "tomorrow", label: "Tomorrow", date: addDays(now, 1) },
    { key: "week", label: "In a week", date: addDays(now, 7) },
    { key: "month", label: "In a month", date: addMonths(now, 1) },
  ];
}

/** Parse the value of an <input type="date"> ("YYYY-MM-DD") as a local day, or null if invalid. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/** "YYYY-MM-DD" in local time, for an <input type="date"> min/value. */
export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A snooze must land on a day after today, otherwise the blip would still be due. */
export function isLaterDay(date: Date, now: Date = new Date()): boolean {
  return startOfDay(date).getTime() > startOfDay(now).getTime();
}
