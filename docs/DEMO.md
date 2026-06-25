# BacBan Demo

This repo has two demo paths:

- Hosted browser demo: open `docs/index.html`, then launch `docs/demo-app/`. It
  runs the real React app with browser-local storage. No Docker API is required.
- Local Docker demo: seed `kanban-data/kanban-data.json` from
  `demo/kanban-data.demo.json`.

The hosted demo writes to the visitor's browser local storage and has no
persistence guarantee. Clearing site data removes it. The local Docker demo
writes to ignored runtime board data under `kanban-data/`.

## Hosted Browser Demo

When `docs/` is served by GitHub Pages or a static server, open:

```text
docs/index.html
docs/demo-app/
```

The app seeds itself from `kanban-frontend/public/demo-data.json` on first load.
Visitors can use the in-app reset button or `docs/demo-app/?resetDemo=1` to
restore the sample board.

## Run an Empty Docker Board

```powershell
git clone <repo-url> bacban
cd bacban
docker compose up -d --build
```

Open:

- UI: `http://localhost:3000`
- API health: `http://localhost:3001/health`

On first run, the backend creates `kanban-data/kanban-data.json` with empty Work and Life boards.

## Seed the Demo Board

From the repo root:

```powershell
docker compose down
New-Item -ItemType Directory -Force .\kanban-data | Out-Null
if (Test-Path .\kanban-data\kanban-data.json) {
  Move-Item .\kanban-data\kanban-data.json ".\kanban-data\kanban-data.$(Get-Date -Format yyyyMMddHHmmss).json"
}
Copy-Item .\demo\kanban-data.demo.json .\kanban-data\kanban-data.json
docker compose up -d --build
```

Then open `http://localhost:3000`.

The seed data includes:

- Work and Life boards.
- To Do, In Progress, and Done examples.
- Due dates, project colors, waiting-on status, references, and subtasks.
- A sample agent-loop card showing the intended intake-to-status workflow.

## Reset Back to Empty

To return to a fresh board while keeping a backup:

```powershell
docker compose down
if (Test-Path .\kanban-data\kanban-data.json) {
  Move-Item .\kanban-data\kanban-data.json ".\kanban-data\kanban-data.$(Get-Date -Format yyyyMMddHHmmss).json"
}
docker compose up -d
```

The backend recreates a blank `kanban-data/kanban-data.json` when it starts.

## API Smoke Test

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health'
$data = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/data'
$data.boards.work.tasks.todo | Select-Object id,text
```

Automations should use the full-state write contract in `docs/ONBOARDING.md` before they modify the board.
