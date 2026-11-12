# Blippy - Agent Guide

Blip cultivation: capture small sparks of attention (questions, ideas, themes), resurface them in a feed, then cultivate or let them go.

## Tech stack

React 19, Next.js (App Router), TypeScript (strict), Tailwind CSS v4 (`@theme` in CSS, no `tailwind.config.js`), shadcn/ui (Slate) + Lucide icons, Zustand, React Hook Form + Zod, Drizzle ORM + SQLite (`better-sqlite3`).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server at http://localhost:6900 |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (with Tailwind class sorting) |
| `npm run test -- --run` | Vitest, single run (plain `npm run test` is watch mode) |
| `npm run test:e2e` | Playwright (reuses a running dev server) |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle migrations / schema push |
| `npm run db:seed` | Seed the database |

## Project structure

```
src/
  app/          # App Router routes, layout, API route handlers
  components/   # layout/, ui/ (shadcn), and feature components
  actions/      # Server Actions (blips.ts, categories.ts)
  db/           # Drizzle schema, client, seed
  lib/          # Utilities, Zod schemas (validations.ts)
  stores/       # Zustand stores (e.g. sidebar)
  test/         # Vitest setup
e2e/            # Playwright specs
drizzle/        # Generated migrations
```

Data flow: UI -> Server Actions / Route Handlers -> SQLite via Drizzle.

## Conventions

- Mutations go through Server Actions in `src/actions/`; validate input with the Zod schemas in `src/lib/validations.ts`.
- Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`. Update `DATA_MODEL.md` if the model changes.
- Use shadcn/ui components from `src/components/ui` before building custom primitives.
- Keep TypeScript strict; use the `@/` path alias.
- Put unit tests next to the module as `*.test.ts`; E2E tests live in `e2e/*.spec.ts`.
- Config lives in `.env` / `.env.local` (`DATABASE_URL`, e.g. `file:./blippy.db`); see `.env.example`.

## Capture / AI import

Capture pastes markdown -> `src/lib/markdown-links.ts` extracts links -> `src/lib/og.ts` fetches OG metadata (with an SSRF guard) -> `src/lib/ai/organize.ts` asks the provider (`src/lib/ai/providers.ts`, plain `fetch`, OpenAI or Anthropic) for title/summary/topic group -> `src/actions/capture.ts` saves blips. Without an API key it falls back to OG data. Provider/model are chosen in Settings; keys come from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` in `.env.local` (never stored in the tracked DB).

## Spaces

`src/actions/spaces.ts` holds all space logic (CRUD, store/unstore, group linking, `sweepSpace`). Spaces hook into the AI topic groups (`blip_groups`), not user categories. The importer passes space names to the AI as preferred group labels. See DATA_MODEL.md.

## Gotchas

- `blippy.db` is tracked in git, so running or seeding the app shows up as a modified file. Don't commit it by accident.
- Git: this app has its own repository; run git commands from this directory.

## More docs

- [README.md](README.md) - features and setup
- [ARCHITECTURE.md](ARCHITECTURE.md) - stack and structure
- [DATA_MODEL.md](DATA_MODEL.md) - schema
- [Testing.md](Testing.md) - testing strategy
- [FUTURE.md](FUTURE.md) - roadmap
