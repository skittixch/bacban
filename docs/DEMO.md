# BacBan Demo

This demo gives a new user a populated board without committing or overwriting live board data. The app always reads and writes `kanban-data/kanban-data.json`; the tracked demo file lives separately at `demo/kanban-data.demo.json`.

For a visual overview before running Docker, open `docs/index.html` or publish the
`docs/` folder with GitHub Pages.

## Run an Empty Board

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
