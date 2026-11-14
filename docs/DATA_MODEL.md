# Data model

Phase 1 uses four tables (`categories`, `blips`, `blip_groups`, `app_settings`). The canonical schema is in `src/db/schema.ts` (Drizzle).

## Tables

### categories

| Column     | Type    | Constraints | Description                      |
| ---------- | ------- | ----------- | -------------------------------- |
| id         | text    | PK          | Unique id (e.g. `uncategorized`) |
| name       | text    | NOT NULL    | Display name                     |
| created_at | integer | NOT NULL    | Timestamp (mode: timestamp)      |

- One row represents “Uncategorized” (id `uncategorized`); other categories are user-defined later.

### blips

| Column         | Type    | Constraints                  | Description                                    |
| -------------- | ------- | ---------------------------- | ---------------------------------------------- |
| id             | text    | PK                           | UUID                                           |
| content        | text    | NOT NULL                     | Blip body                                      |
| category_id    | text    | nullable, FK → categories.id | Category or null (uncategorized)               |
| status         | text    | NOT NULL, default `active`   | `active` \| `matured` \| `fizzled`             |
| next_review_at | integer | nullable                     | Timestamp (mode: timestamp); when to resurface |
| created_at     | integer | NOT NULL                     | Timestamp                                      |
| updated_at     | integer | NOT NULL                     | Timestamp                                      |

- **status:** `active` = in feed/cultivation; `matured` = graduated; `fizzled` = terminal, no longer shown in feed.
- **next_review_at:** Used for feed: “due” when `next_review_at <= today` or null. Snooze sets this to a future date.

### blips: link-card columns

Populated by the markdown import on the Capture page; all nullable (null for plain blips): `title`, `summary`, `image_url`, `url`, `site_name`, and `group_id` (FK → `blip_groups.id`).

### blip_groups

`id` (PK), `label` (topic name, e.g. "Nvidia Leadership"), `created_at`. Blips sharing a `group_id` render together in the feed.

### app_settings

Key/value store (`key` PK, `value`). Holds `ai.provider` and `ai.model.<provider>`. API keys are NOT stored here; they come from env vars.

## Relationships

- **categories → blips:** One category has many blips (`category_id` FK). Blips with `category_id IS NULL` are “Uncategorized”.

## ER (conceptual)

```mermaid
erDiagram
  categories ||--o{ blips : has
  categories {
    string id PK
    string name
    datetime created_at
  }
  blips {
    string id PK
    text content
    string category_id FK
    string status
    datetime next_review_at
    datetime created_at
    datetime updated_at
  }
```

## Migrations

- Generated with: `npm run db:generate`
- Applied with: `npm run db:migrate`
- Seed (e.g. Uncategorized): `npm run db:seed`

Additional `app_settings` keys: `ai.instructions` (extra prompt text appended to the built-in system prompt) and `ai.options` (JSON: temperature, topP, maxOutputTokens, frequencyPenalty, presencePenalty; absent fields use provider defaults).

## Spaces

- **spaces:** `id`, `name`, `description`, `kind` (`general` | `video`, default `general`), `auto_intake` (boolean), `ai_routing` (boolean, default true; when false the AI never routes new links here), `created_at`. A `video` space renders a tiled player grid and receives YouTube links automatically; see [discovery/video-space.md](discovery/video-space.md).
- **blips.space_id** (nullable FK): a stored blip. Blips with a `space_id` are excluded from the feed.
- **blips.routed_by** (nullable: `rule` | `group` | `ai`): how a blip was auto-routed into its space at capture; null when stored by hand. See [discovery/inbox-routing.md](discovery/inbox-routing.md).
- **blips.routed_reason** (nullable text): why the blip was auto-routed; cleared with `routed_by`.
- **routing_events:** audit log of capture/reprocess routing decisions: `id`, `blip_id`, `blip_title`, `url`, `space_id`, `space_name` (null = stayed in the feed), `routed_by` (`rule` | `group` | `ai`, null = no route), `reason`, `source` (`capture` | `reprocess`), `created_at`. No foreign keys, so entries survive deletes and renames. Shown at `/routing`.
- **blip_groups.space_id** (nullable FK): links a topic group to at most one space (a space can have many groups).
- **Auto-intake:** on import/reprocess, a blip whose group is linked to a space with `auto_intake` on is stored in that space. A new group whose label matches a space name (case-insensitive) is linked automatically. Linking a group, creating a same-named space, or turning auto-intake on stores the group's existing unstored blips too.
- Deleting a space returns its blips to the feed and unlinks its groups. Unlinking a group does not evict blips already stored.
