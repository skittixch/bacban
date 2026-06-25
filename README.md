# BacBan

[![CI](https://github.com/skittixch/bacban/actions/workflows/ci.yml/badge.svg)](https://github.com/skittixch/bacban/actions/workflows/ci.yml)
[![Pages](https://github.com/skittixch/bacban/actions/workflows/pages.yml/badge.svg)](https://github.com/skittixch/bacban/actions/workflows/pages.yml)
[![Security Policy](https://img.shields.io/badge/security-policy-blue.svg)](SECURITY.md)
[![Private-first](https://img.shields.io/badge/data-local--first-0f766e.svg)](#private-state)

BacBan is a local-first kanban board for human task tracking and agent-assisted workflow triage. It pairs a Dockerized React board with a small Express JSON API, then gives assistants a strict write contract for creating, moving, and annotating cards without exposing live board data.

The project is built for people who want a real task board that local AI agents can update safely: email intake, Codex loops, private status messages, evidence links, waiting-on states, and clear next actions.

## Demo

- Static dark-mode project overview: `docs/index.html`
- Demo seed data: `demo/kanban-data.demo.json`
- Demo setup guide: `docs/DEMO.md`

The docs page describes the current app surface; it is not a fake product
dashboard. The demo seed uses safe sample data. Live board state stays in
ignored `kanban-data/`.

## What It Does

- Runs a two-service local stack: React frontend plus Express API.
- Stores board state in local JSON, outside Git by default.
- Supports Work and Life boards, custom columns, drag-and-drop cards, nested subtasks, references, due dates, project colors, undo/redo, and mobile views.
- Highlights recently changed cards and brighter waiting-on cards.
- Gives assistants stable fields: `updatedAt`, `doneAt`, `waitingOn`, and `references`.
- Documents an event-to-board loop for Gmail, OpenCLAW/gog, Codex, and future `codex exec` or SDK runners.

## Quickstart

Prerequisites:

- Docker Desktop
- Git
- Optional for agent automation: Codex CLI, OpenCLAW/gog, `gcloud`, and a Google Cloud project with Gmail API and Pub/Sub API enabled

Run the app:

```powershell
git clone https://github.com/skittixch/bacban.git
cd bacban
docker compose up -d --build
```

Open:

- UI: `http://localhost:3000`
- API health: `http://localhost:3001/health`
- Full board state: `http://localhost:3001/api/data`

On first run, the backend creates `kanban-data/kanban-data.json`. That directory is ignored because it contains live board data.

## Agent Write Contract

Any assistant that writes to BacBan should:

1. Verify `GET http://127.0.0.1:3001/health`.
2. Back up `kanban-data/kanban-data.json`.
3. GET the full board state from `/api/data`.
4. Modify only the relevant card or cards.
5. Validate JSON.
6. POST the full state back to `/api/data`.
7. Verify health again.
8. Read back the changed card or cards.

Card creation is intake, not completion. A good loop does one bounded useful action, records evidence, updates the card, and stops with `complete`, `blocked`, `waiting`, or `no-op`.

## Repository Layout

```text
.
|-- kanban-frontend/        React board UI
|-- kanban-backend/         Express JSON persistence API
|-- demo/                   Safe demo board seed
|-- docs/                   Demo page and operator docs
|-- codex/                  Agent runbooks and local-loop notes
|-- .github/                CI, Pages, templates, Dependabot
`-- docker-compose.yml      Local production stack
```

## Documentation

- `docs/index.html`: GitHub Pages-ready demo page.
- `docs/DEMO.md`: seed and reset a safe sample board.
- `docs/ONBOARDING.md`: board-only, WhatsApp, and Gmail-to-board setup path.
- `docs/CODEX_GMAIL_SETUP.md`: deeper event architecture notes.
- `docs/API.md`: local HTTP API contract.
- `docs/REPO_BEST_PRACTICES.md`: repo-quality research and the checklist applied here.
- `docs/GITHUB_PUBLISHING.md`: private-first publishing and public-release checks.

## Development

Production-style Docker stack:

```powershell
docker compose up -d --build
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

## Private State

Do not commit:

- `kanban-data/`
- OAuth client secrets or token caches
- OpenCLAW config files
- `.env` files
- service account keys
- Codex job payloads or generated outputs with private mail/task content

The `.gitignore` covers these defaults. Run `git status --short --ignored` before publishing.

## Status

BacBan is private-first and local-operator oriented. Public release should happen only after the tracked local runbooks and account-specific workflow notes are sanitized or moved out of the public branch.

## License

Private preview. See `LICENSE` for the current all-rights-reserved license notice. Swap this for an explicit open-source license before publishing as OSS.
