# BacBan API

BacBan uses a small local JSON API. The backend persists the full board state
to `kanban-data/kanban-data.json`.

## Base URL

```text
http://127.0.0.1:3001
```

## Health

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Read Board State

```http
GET /api/data
```

Returns the complete board document. The response includes
`X-BacBan-State-Hash`, a hash of the current full document.

## Write Board State

```http
POST /api/data
Content-Type: application/json
```

The body must be the full board document, not a patch. This keeps the API small
and makes assistant writes auditable.

Browser/UI clients should send the hash from their last successful read or
write:

```http
X-BacBan-Actor: browser-ui
X-BacBan-Base-Hash: <last X-BacBan-State-Hash>
```

If a browser-looking save omits `X-BacBan-Base-Hash`, the backend returns
`428 Precondition Required`. If the live board changed since the supplied hash,
the backend returns `409 Conflict` instead of overwriting newer state.
Deliberate assistant/operator writes may omit `X-BacBan-Base-Hash` after they
have already followed the guarded health/backup/read/modify/write/readback
sequence.

After a successful write, the backend compares the previous board document with
the new one. When cards were created, updated, moved, reordered, completed,
reopened, or deleted, it appends a compact private board-change record to the
agent ledger.
Deleted top-level cards also get an append-only tombstone record so future
inbox intake can avoid re-creating similar noise. Optional UI delete feedback
gets its own private ledger record and is included in future deleted-card
similarity checks. Work/Life cross-board moves also get append-only
collection-routing hints so future intake can route similar tasks to the
owner-corrected collection.

The default Docker stack writes these private runtime files to:

```text
codex\agent-ledger\board-events.jsonl
codex\agent-ledger\deleted-cards.jsonl
codex\agent-ledger\deleted-card-feedback.jsonl
codex\agent-ledger\collection-routing.jsonl
```

Those JSONL files are ignored by Git.

## Board Change Events

```http
GET /api/agent-events?limit=50
```

Returns the most recent private board-change messages recorded by the backend.
This is meant for local Codex/OpenCLAW intake and diagnostics, not for public
sync.

## Deleted Card Tombstones

```http
GET /api/deleted-cards?limit=100
```

Returns recent deleted-card notes with compact card metadata.

```http
POST /api/deleted-cards/check
Content-Type: application/json
```

Example body:

```json
{
  "subject": "Example newsletter subject",
  "from": "sender@example.com",
  "snippet": "Short email summary",
  "threshold": 0.42,
  "limit": 5
}
```

The response returns similar deleted cards above the threshold. Gmail intake
should treat a match as a duplicate/noise warning and inspect before creating a
new BacBan card.

```http
POST /api/deleted-cards/feedback
Content-Type: application/json
```

Example body:

```json
{
  "reason": "newsletter noise",
  "task": { "id": "task_abc", "text": "Example card" },
  "boardId": "life",
  "boardTitle": "Life",
  "columnId": "todo",
  "columnTitle": "To Do",
  "deletedAt": "2026-06-29T19:05:20Z"
}
```

Records optional owner feedback from the delete toast. The board deletion itself
is still inferred from the full-state board write; this endpoint only adds
extra private signal for future Codex/OpenCLAW intake.

```http
GET /api/deleted-card-feedback?limit=100
```

Returns recent delete-feedback notes.

## Collection Routing Hints

```http
GET /api/collection-routes?limit=100
```

Returns recent Work/Life cross-board move notes with compact card metadata and
source/destination locations.

```http
POST /api/collection-routing/check
Content-Type: application/json
```

Example body:

```json
{
  "title": "Sprunky Lab follow-up",
  "snippet": "Publish or continue the personal game prototype",
  "threshold": 0.36,
  "limit": 5
}
```

The response returns similar past collection moves and, when there is enough
signal, a recommended destination board/column. Intake should prefer that
recommendation unless the current evidence clearly belongs elsewhere.

## Safe Write Sequence

1. `GET /health`.
2. Back up `kanban-data/kanban-data.json`.
3. `GET /api/data`.
4. Modify only the intended card or board field.
5. Validate JSON.
6. `POST /api/data`.
7. `GET /health`.
8. `GET /api/data` and read back the changed card.

## Important Fields

- `boards`: map of board ids to board state.
- `boardOrder`: display order for boards.
- `tasks`: map of column ids to card arrays.
- `columnOrder`: display order for a board's columns.
- `columnTitles`: human-readable column names.
- `settings`: app preferences such as completed-card retention, completed-card
  fading, completion burst, and card density.
- `updatedAt`: UTC ISO timestamp for agent-created or agent-updated cards.
- `doneAt`: UTC ISO timestamp when a card moves to done/completed.
- `waitingOn`: short reason the card needs a person or external system.
- `references`: HTML notes shown in the card detail view.
- On Hold, Waiting, and Blocked cards whose latest information timestamp is more
  than 14 days old are treated as UI limbo. They are not moved or deleted; the
  frontend hides them under an `and N more...` row until `updatedAt`,
  `lastInfoAt`, or `lastSignalAt` is refreshed.
- `priority`, `prioritySource`, `priorityTotal`, `priorityLabel`: original
  priority-list evidence from an explicit incoming ordered list. The UI renders
  completed priority cards with a checked badge and compresses active badge
  ranks around the remaining unfinished cards, but the stored values remain the
  original source ranks.
- `priorityGroupId`: optional stable id for the originating ordered list, such
  as a Gmail thread id. Set it when available so active badge compression stays
  scoped to the correct list.

Storage-source preferences are browser-local because they decide where the app
loads the board document from. The default remains the Docker JSON API; the UI
can also keep a browser-local copy and import/export full board JSON files.

## Automation Boundary

Card creation is intake. It should not be reported as task completion unless
the requested work itself is complete.
