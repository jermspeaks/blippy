# Changelog

Completed work, newest first. Planned work lives in [FUTURE.md](FUTURE.md); design notes are in [discovery/](discovery/).

## 1.0.0 (2026-11-16)

### Reading list
- Separate reading list (`/reading`) of saved articles, added from the feed, spaces, blip detail, or by pasting a URL. Stored sanitized article text (Readability + sanitize-html), SSRF-guarded fetch, purged when the blip is deleted (with a confirmation dialog).
- Distraction-free reader with status (unread/reading/done), reading time, scroll position restore, and display settings (theme, font, size, width).
- Highlights and notes anchored by text quote. See [discovery/reading-list.md](discovery/reading-list.md).

### Feed and snooze
- Snooze presets: tomorrow, a week, a month, custom date.
- Feed size cap setting (5 to 200, default 50) with a "showing N of M due" note. See [discovery/snooze-and-feed-limit.md](discovery/snooze-and-feed-limit.md).

### Code space
- Specialized space for repository links (GitHub, GitLab, Bitbucket, Codeberg/Gitea, SourceHut), repo roots only, shown as a table with stars, language, topics and description. Topic spaces win over the code space. Optional `GITHUB_TOKEN`. See [discovery/code-space.md](discovery/code-space.md).

### Book space
- Specialized space with cover, title, author, and a manual edit dialog.
- Only verified books qualify: bookstore and Big Five publisher URLs, ISBN in the URL, or an AI-named book confirmed by Google Books / Open Library. Rate-limit and network errors are retried later, not recorded as failures. See [discovery/book-space.md](discovery/book-space.md).

### Routing and spaces (2026-11-14)
- Routing command center (`/routing`): routing order, per-space state, AI prompt, audit log with decision reasons.
- Domain rules, per-space AI routing controls, re-routing of existing feed blips, selector for storing blips into a space.
- Snoozed blips view (`/spaces/snoozed`) with Unsnooze.
- Spaces management: table, create dialog, settings dialog, sorting, fizzle actions, group triage.
- Video space kind with YouTube routing.
- Categories removed (migration 0007).
- See [discovery/spaces.md](discovery/spaces.md), [discovery/routing-command-center.md](discovery/routing-command-center.md), [discovery/inbox-routing.md](discovery/inbox-routing.md), [discovery/reroute.md](discovery/reroute.md), [discovery/video-space.md](discovery/video-space.md).

### Capture and AI import (2026-11-12)
- Markdown link capture, OG metadata fetch, AI titles/summaries/topic groups (OpenAI or Anthropic), grouped link cards, reprocessing, result panel. See [discovery/ai-link-import.md](discovery/ai-link-import.md), [discovery/capture-result-panel.md](discovery/capture-result-panel.md).

### Foundations (2026-02)
- Next.js, Drizzle + SQLite, shadcn/ui, theme support, blip capture, feed, blip detail, Dependabot.
