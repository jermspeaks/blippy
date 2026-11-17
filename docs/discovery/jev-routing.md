# Space routing with TypeSafe (Jev)

- **Status:** Designed, API probed, not built. Awaiting go-ahead on the open questions.
- **Date started:** 2026-11-16
- **Related:** [inbox-routing.md](inbox-routing.md), [routing-command-center.md](routing-command-center.md), `src/lib/routing.ts`, `src/lib/ai/organize.ts`, `src/actions/capture.ts`, `src/actions/reroute.ts`, [../FUTURE.md](../FUTURE.md). TypeSafe skill: `typesafe@typesafe-ai` (installed). Docs: https://docs.typesafe.ai/llms.txt

## Goal

Use TypeSafe's **Jev** (a "decision model") to make the "which space does this link belong in?" judgment, for the links that domain rules and kind rules (video, book, code) did not already place. Jev returns typed answers with calibrated probabilities, so the decision can be a threshold in our code, not whatever an LLM happened to write.

## What Jev replaces (and what it doesn't)

Today one LLM call per capture batch returns title, summary, topic group, `space` and `book`. Only the **space pick** is a decision; the rest is generation, which Jev does not do.

- **Stays on the LLM:** title, summary, topic group label.
- **Moves to Jev:** the space pick (step 3 of `pickRoute`: domain rule > kind rules > topic group > **AI space** > code fallback > feed). Same slot, same `routedBy = "ai"`, new reason text.
- **Later candidate:** the "is this ONE specific book?" judgment (a Noul per link) in place of the LLM `book` field; the Tier 1 URL rules and Google Books / Open Library confirmation stay.

Because Jev can read the page's Open Graph title and description directly, the space pick no longer depends on the LLM running first, so it works with no OpenAI/Anthropic key.

## Request shape (one request per link, run in parallel)

State: only what a person would look at, as named fields.

```json
{ "link": { "title": "...", "site": "example.com", "description": "first 400 chars", "note": "the link text you pasted" } }
```

Questions (per the skill: one judgment each, plus a companion Noul because a Choice always picks something):

| id | type | instructions / criteria |
| --- | --- | --- |
| `space` | choice | "Which space does `link` belong in?" Options are the eligible spaces, named `space_<n>` or the space name, each described by the space's own description. |
| `any_fit` | noul | "Does `link` clearly belong in at least one of these spaces: <names>?" |

Eligible spaces are the same set the AI routes to today (general and book spaces with auto-intake and AI routing on; `bookSpaceIds` still blocks guesses into book spaces). Spaces with no description get their name only; the routing page already nudges users to write descriptions, and descriptions are now the main quality lever.

## Decision table (in code, not in the model)

| `any_fit` | top `space` probability | Outcome |
| --- | --- | --- |
| >= 0.70 | >= 0.60 | route to that space; reason "Jev: <space> (any fit 0.98, 0.91 for this space)" |
| >= 0.70 | < 0.60 | leave in feed (ambiguous between spaces); log the top two |
| < 0.70 | any | leave in feed |
| request failed | n/a | **error, not "no"**: leave in feed, log "Jev unavailable", retry on the next re-route |

Thresholds live in one module with the question wording, and become settings later.

## Probe results (2026-11-16, synthetic spaces, real API)

- On-topic link (Raft consensus): `any_fit` 0.98, space probability 1.0.
- Off-topic link (history of the bicycle): `any_fit` 0.03, while the Choice alone still picked "recipes" at 0.42. This confirms why the companion Noul is required: the Choice by itself would have misrouted it.
- Cost: about 430 input tokens per link at $0.042 per million (output is free), so roughly $0.00002 per link. Latency about 100 ms per the docs.

## Rollout plan

1. `src/lib/jev.ts`: plain-`fetch` client for `POST /v1/systemone` (matches the project's no-SDK AI providers; key from `TYPESAFE_AI_API_KEY`, never stored in the DB), question builder, decision-table function. Tests inject `fetch`; no test hits the API.
2. **Shadow mode first:** a Settings choice "Space routing: AI model | Jev | Both (log only)". In "Both", routing still uses the AI model, and Jev's answer is written to the routing log so disagreements are visible on `/routing`.
3. Review disagreements on real captures, tune thresholds and space descriptions, then switch the default.
4. Optional: Noul-based book detection; per-space Noul scoring if spaces overlap a lot.

## Open questions

- Shadow mode first (recommended) or switch straight to Jev?
- Default thresholds 0.70 / 0.60 are a starting guess; they should be tuned on real blips.
- Should an unmatched link fall back to the LLM's pick, or stay in the feed? (Recommended: stay in the feed, since the point is to trust the calibrated answer.)
- Rate limits are per organization (see the developer console); parallel per-link requests need a small concurrency cap.
