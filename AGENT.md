# Agent Project Rules: Kanban Board (BacBan)

## Architecture

- **React/CRA** frontend in `kanban-frontend/` — served via nginx in production.
- **Node.js** backend in `kanban-backend/` — simple REST persistence layer (GET/POST `/api/data`).
- **Data** lives in `kanban-data/kanban-data.json` — bind-mounted into the backend container at `/data`.
- State management via custom hook `useKanban.js` — handles boards, columns, tasks, **subtasks** (fractal nested kanbans), drag-and-drop, undo/redo history, and auto-save.
- Dark mode, custom CSS tokens, and theming tracked in `useKanban.js`.

## Docker Containers

### Production Stack (default)

```bash
docker compose up -d
```

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `kanban-frontend` | `bacban-kanban-frontend` (nginx) | `3000 → 80` | Serves built React app |
| `kanban-backend` | `bacban-kanban-backend` (node) | `3001 → 3001` | JSON persistence API |

### Development Server (optional)

```bash
# Stop production frontend first (port conflict on 3000)
docker compose stop kanban-frontend

# Start dev server with hot-reload
docker compose --profile dev up kanban-dev
```

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `kanban-dev` | `node:18-alpine` | `3000 → 3000` | CRA dev server with hot-reload, volume-mounts `kanban-frontend/` |

> **Note:** `kanban-dev` and `kanban-frontend` both use port 3000. Only run one at a time.

## Development Workflow

### Do NOT run npm on the host

This project relies on Docker. **Do NOT run native host-machine package managers** (like `npm` or `yarn` via PowerShell/cmd). The host environment may not have them installed or configured correctly.

### Installing packages

If you need to install new npm dependencies, execute them inside the running dev container:

```bash
docker exec kanban-dev npm install <package-name>
```

If the dev container isn't running, you can use a one-off exec against the frontend build:

```bash
docker compose run --rm kanban-dev npm install <package-name>
```

### Promoting changes to production

When changes are complete and verified in the dev environment, rebuild the production frontend:

```bash
docker compose build kanban-frontend
docker compose up -d kanban-frontend
```

This bakes the latest source + dependencies into the nginx image.

## Data Model

Tasks support optional **nested subtasks** (fractal kanban). The `subtasks` field is optional and backward-compatible:

```json
{
  "id": "task_abc",
  "text": "Project Name",
  "createdAt": "5/18/2026",
  "priority": 1,
  "color": "#f97316",
  "references": "<p>Notes and <b>formatted text</b></p><span class=\"ref-img-wrapper\"><img class=\"ref-inline-img\" src=\"data:image/png;base64,...\" /></span>",
  "subtasks": {
    "columns": ["todo", "doing", "done"],
    "columnTitles": { "todo": "To Do", "doing": "Doing", "done": "Done" },
    "items": {
      "todo": [{ "id": "st_1", "text": "Subtask text", "createdAt": "5/18/2026" }],
      "doing": [],
      "done": []
    }
  }
}
```

The `references` field is optional (backward-compatible). It stores sanitized HTML from the built-in contentEditable editor, including base64-encoded inline images. Missing/empty `references` renders an empty editor placeholder.
