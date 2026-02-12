# Testing Strategy

Blippy uses unit tests (Vitest + React Testing Library) and end-to-end tests (Playwright).

## Unit tests (Vitest)

- **Location:** `src/**/*.test.ts` and `src/**/*.spec.ts`
- **Run:** `npm run test` (watch mode) or `npm run test -- --run` (single run)
- **Setup:** `src/test/setup.ts` loads `@testing-library/jest-dom/vitest` for DOM matchers.
- **Config:** `vitest.config.ts` (jsdom environment, path alias `@/`).

**What we test:**

- Zod validation schemas (`src/lib/validations.test.ts`)
- Utility functions
- Presentational components (forms, cards) with React Testing Library
- Server Actions can be tested with a test database or mocks

**Adding a unit test:**

1. Create a file next to the module: `*.test.ts` or `*.spec.ts`.
2. Use `describe`, `it`, `expect` from Vitest.
3. For components: `import { render, screen } from "@testing-library/react"` and assert on rendered output.

## E2E tests (Playwright)

- **Location:** `e2e/*.spec.ts`
- **Run:** `npm run test:e2e`
- **Config:** `playwright.config.ts` — base URL `http://localhost:6900`, starts dev server if not already running (`reuseExistingServer: true`).

**What we test:**

- Critical user flows: open feed, navigate to Capture, navigate to Settings, theme section visible.
- Add scenarios for: capture a blip, open blip detail, snooze, fizzle.

**Adding an E2E test:**

1. Add a `.spec.ts` file in `e2e/`.
2. Use `test()` and `expect()` from `@playwright/test`.
3. Prefer `getByRole`, `getByLabel` for stability. If multiple elements match, scope with `getByRole('main')` or `getByRole('navigation').first()`.

## Commands

| Command                 | Description                |
| ----------------------- | -------------------------- |
| `npm run test`          | Unit tests (Vitest, watch) |
| `npm run test -- --run` | Unit tests, single run     |
| `npm run test:e2e`      | E2E tests (Playwright)     |

Ensure the app runs on port 6900 before E2E (or let Playwright start it).
