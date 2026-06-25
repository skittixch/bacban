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

Returns the complete board document.

## Write Board State

```http
POST /api/data
Content-Type: application/json
```

The body must be the full board document, not a patch. This keeps the API small
and makes assistant writes auditable.

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
- `updatedAt`: UTC ISO timestamp for agent-created or agent-updated cards.
- `doneAt`: UTC ISO timestamp when a card moves to done/completed.
- `waitingOn`: short reason the card needs a person or external system.
- `references`: HTML notes shown in the card detail view.

## Automation Boundary

Card creation is intake. It should not be reported as task completion unless
the requested work itself is complete.
