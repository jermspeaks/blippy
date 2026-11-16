# Blippy

Blip cultivation: capture small sparks of attention (questions, ideas, themes), resurface them in a feed, and cultivate or let them go.

**Phase 1** is web-only: SQLite-backed blips, a resurfacing feed, quick capture, spaces, snooze/fizzle, and settings (theme + profile placeholder).

## Features

- **Feed** — Blips due for review (or never scheduled), up to a limit you set in Settings (default 50). Open, snooze (tomorrow, a week, a month or a date), store in a space, or fizzle from the card.
- **Quick capture** — Paste markdown notes; each link becomes a blip.
- **Blip detail** — View and edit content, snooze, or fizzle.
- **Books** — A book space shows saved books as cover cards (title, author). Book links route there automatically; add others by title or ISBN. Set `GOOGLE_BOOKS_API_KEY` in `.env.local` for lookups.
- **Code** — A code space shows saved repositories in a table (description, language, stars, topics). Repo links from GitHub, GitLab, Bitbucket and Codeberg land there when no topic space fits. Optional `GITHUB_TOKEN` raises GitHub's rate limit.
- **Reading** — A reading list, separate from spaces: "Read later" on a blip (or paste a link) saves a clean copy of the article for distraction-free reading at `/reading`, with status, reading time, remembered scroll position and display settings (size, width, theme), and highlights with notes.
- **Snoozed** — `/spaces/snoozed` lists snoozed blips so you can unsnooze them.
- **Routing** — Domain rules (e.g. github.com → a space), the AI prompt, and a log of where each link went and why.
- **Settings** — Theme (Light / Dark / System), profile placeholder for later.

## Tech stack

React 19, Next.js (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui (Slate), Zustand, Zod, React Hook Form, Drizzle ORM, SQLite. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Installation and local development

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd blippy
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` or `.env.local` and set `DATABASE_URL` (e.g. `file:./blippy.db`). Local dev uses `.env` or `.env.local`.

3. **Database**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   App runs at **http://localhost:6900**.

## Commands

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | Start dev server (port 6900)               |
| `npm run build`         | Production build                           |
| `npm run start`         | Start production server                    |
| `npm run lint`          | Run ESLint                                 |
| `npm run format`        | Format with Prettier (Tailwind class sort) |
| `npm run test`          | Unit tests (Vitest, watch)                 |
| `npm run test -- --run` | Unit tests, single run                     |
| `npm run test:e2e`      | E2E tests (Playwright)                     |
| `npm run db:generate`   | Generate Drizzle migrations                |
| `npm run db:migrate`    | Apply migrations                           |
| `npm run db:push`       | Push schema (dev)                          |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Tech stack, structure, data flow.
- [docs/discovery/](docs/discovery/) — One discovery doc per feature: goals, decisions, open questions.
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — Tables and relationships.
- [docs/Testing.md](docs/Testing.md) — Unit and E2E testing.
- [docs/FUTURE.md](docs/FUTURE.md) — Later phases (SRS, moves, auth, Swift, workflows).

## License

MIT. Copyright (c) Jeremy Wong.
