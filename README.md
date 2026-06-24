# BacBan

BacBan is a local-first kanban board built for human task tracking and Codex-assisted workflow triage. It runs as a Dockerized React frontend plus a small Express JSON backend, with the live board state stored outside Git in `kanban-data/`.

The project also documents the current Gmail-to-BacBan agent path: Gmail Pub/Sub notifications wake a local listener, the listener starts a Codex/OpenCLAW triage run, and Codex updates the BacBan API when an email should create, move, complete, or annotate cards.

## Features

- Dockerized kanban board with persistent local JSON storage.
- Multiple boards and columns, drag-and-drop card movement, subtasks, priorities, references, due dates, and project colors.
- Agent-friendly card fields: `updatedAt`, `doneAt`, `waitingOn`, and `references`.
- Recent-card glow for newly changed cards, with brighter attention highlighting for cards that need Eric or external input.
- Durable runbook for Gmail Pub/Sub, Codex, OpenCLAW, and future native Codex automation.

## Quickstart

Prerequisites:

- Docker Desktop
- Git
- Optional for agent automation: Codex CLI, OpenCLAW/gog, gcloud, and a Google Cloud project with Gmail API and Pub/Sub API enabled

Run the app:

```powershell
git clone <repo-url> bacban
cd bacban
docker compose up -d
```

Open the board:

- UI: `http://localhost:3000`
- API health: `http://localhost:3001/health`
- Full board state: `http://localhost:3001/api/data`

The backend creates `kanban-data/kanban-data.json` on first run if it does not exist. That directory is intentionally ignored by Git because it contains live personal board data.

## Development

Production-style Docker stack:

```powershell
docker compose up -d
```

Rebuild after frontend or backend changes:

```powershell
docker compose build
docker compose up -d
```

Optional frontend dev server:

```powershell
docker compose --profile dev up kanban-dev
```

The dev service also uses port 3000, so stop the production frontend first if needed.

## Agent Automation

Start with these files:

- `AGENTS.md`: operating rules for future Codex runs in this repository.
- `AGENT.md`: app architecture and Docker details.
- `codex/GMAIL_BACBAN_RUNBOOK.md`: current working Gmail-to-BacBan architecture and safety rules.
- `docs/CODEX_GMAIL_SETUP.md`: setup guide for Gmail Pub/Sub, OpenCLAW/gog, and native Codex alternatives.

Native Codex hooks are useful for lifecycle checks inside an existing Codex run. They do not receive Gmail Pub/Sub pushes by themselves. For inbound email automation, use an external listener that calls OpenCLAW, `codex exec`, the Codex SDK, or the Codex App Server.

## Private State

Do not commit:

- `kanban-data/`
- OAuth client secrets or token caches
- OpenCLAW config files
- `.env` files
- service account keys
- Codex job payloads or generated outputs with private mail/task content

The `.gitignore` is set up for those defaults. Check `git status --short --ignored` before publishing.

## Publishing

See `docs/GITHUB_PUBLISHING.md` before adding a remote or pushing. The remaining publishing choices are repo owner/name, public vs. private visibility, and license.
