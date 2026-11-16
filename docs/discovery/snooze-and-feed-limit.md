# Snooze presets and feed limit

- **Status:** Built
- **Date started:** 2026-11-16
- **Related:** [inbox-routing.md](inbox-routing.md), `src/lib/snooze.ts`, `src/components/snooze-menu.tsx`, `src/components/feed-settings-form.tsx`, `src/actions/blips.ts`, `src/actions/settings.ts`, [../FUTURE.md](../FUTURE.md)

## Goal

Two small controls over what the feed shows. **Snooze** used to mean only "tomorrow"; now you pick when a blip comes back (tomorrow, a week, a month, or a date). The **feed limit** replaces the fixed 50 blips with a setting, so a big backlog doesn't overwhelm you or a short one isn't padded.

## Decisions

- **Presets are tomorrow, in a week, in a month, plus a custom date.** Each is the **start of a later day**, so the blip is due again that morning (the feed treats anything due through the end of today as due). Month math clamps to the last day of the target month (Jan 31 + 1 month = Feb 28).
- **A snooze must land on a day after today** (checked in the `snoozeBlip` action as well as the date picker's `min`), so a snooze can't leave a blip still due. The dialog shows each preset's date.
- **One snooze control everywhere:** the feed card and the blip detail page share `SnoozeMenu` (a dialog with the presets and a date field). The old fixed "+1 day" is gone.
- **Feed limit is "max feed size", not "per day".** A per-day quota would need to track what was shown today; a size limit gets the same relief without state. Stored in `app_settings` as `feed.cap`, **default 50, range 5 to 200** (whole numbers; invalid input is rejected). Set in Settings > Feed.
- **Nothing is hidden silently:** the feed shows "Showing N of M due" with a link to Settings when the limit cuts it off. Blips beyond the limit are not deleted or snoozed; they appear as others are triaged. Ordering is unchanged (earliest review date, then oldest).

## Out of scope / later

- A per-day quota; "next Monday" / "this weekend" presets; remembering a favorite preset; a limit per group.

## Follow-ups

- [x] Snooze presets and custom date.
- [x] Configurable feed limit with a "showing N of M" note.
