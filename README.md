# Blippy

Blip cultivation: capture small sparks of attention (questions, ideas, themes), resurface them in a feed, and cultivate or let them go.

**Phase 1** is web-only: SQLite-backed blips, a resurfacing feed, quick capture, categories, snooze/fizzle, and settings (theme + profile placeholder).

## Features

- **Feed** — Blips due for review (or never scheduled), with optional category filter. Open, snooze, or fizzle from the card.
- **Quick capture** — Add a blip with optional category (including Uncategorized).
- **Blip detail** — View and edit content/category, snooze, or fizzle.
- **Categories** — List categories with blip counts; link to filter the feed by category or Uncategorized.
- **Settings** — Theme (Light / Dark / System), profile placeholder for later.

## Tech stack

React 19, Next.js (App Router), TypeScript (strict), Tailwind CSS v4, shadcn/ui (Slate), Zustand, Zod, React Hook Form, Drizzle ORM, SQLite. See [ARCHITECTURE.md](ARCHITECTURE.md).

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
| `npm run db:seed`       | Seed Uncategorized category                |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Tech stack, structure, data flow.
- [DATA_MODEL.md](DATA_MODEL.md) — Tables and relationships.
- [Testing.md](Testing.md) — Unit and E2E testing.
- [FUTURE.md](FUTURE.md) — Later phases (SRS, moves, auth, Swift, workflows).

## License

MIT. Copyright (c) Jeremy Wong.
