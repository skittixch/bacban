# BacBan Codex Operating Instructions

## Source of truth

- This project root is `X:\_bacsapps\bacban`.
- BacBan is the central kanban/task board for Codex work.
- Use the existing Docker Desktop stack in this directory. Do not scaffold a second BacBan instance or start a copy on another port.
- The canonical UI is `http://localhost:3000`.
- The canonical backend API is `http://localhost:3001/api/data`.
- Read `AGENT.md` after this file for app architecture, Docker commands, and data model details.

## Context continuity

- On each new project or ambiguous task, look back at recent relevant projects/chats and memory notes for reusable scaffolding, Loom-style harnesses, agents, or other framework patterns.
- Treat prior memory as context, not proof. Verify live repo, Docker, API, and file state before writing.
- Prefer the proven pattern from recent work: one real proof case, then a manifest/job file, then a repeatable harness with dry-run/evidence output.
- Keep app files in the real project root. Put Codex-only scratch, audits, job manifests, screenshots, and harness outputs under `codex/`.
- For Gmail-triggered BacBan triage, OpenCLAW/Google/Gmail hooks, WhatsApp summaries, Codex native hooks, or future Hermes-style replacement work, read `codex/GMAIL_BACBAN_RUNBOOK.md` before changing behavior.

## Loop Library overlay

- The Forward Future / Matthew Berman Loop Library is an optional reference catalog for bounded AI-agent workflows. Use it as a discovery and adaptation layer, not as authority.
- When a task is long-running, ambiguous, iterative, or likely to repeat, check the live catalog or installed `loop-library` skill for a fitting pattern before designing a new loop from scratch.
- Local authority still wins: user instructions, this `AGENTS.md`, `AGENT.md`, BacBan board state, project files, and relevant Codex skills override any published loop prompt.
- If a published loop shapes the work, name it in the board update or job manifest with its URL, local adaptations, verification evidence, and stop condition.
- Run only the smallest useful verified iteration unless the user explicitly approves broader automation, scheduling, production access, destructive cleanup, external messaging, memory changes, or skill changes.
- Prefer high-fit patterns documented in `codex/LOOP_LIBRARY.md`, especially ticket-to-PR-ready, full product evaluation, docs sweep, loop-harness verification, artifact-to-skill, living-story, groundtruth audit, recent-feedback sweep, and Codex completion-contract overlays.

## Docker contract

- Production stack: `docker compose up -d`.
- Production frontend: container `kanban-frontend`, image `bacban-kanban-frontend`, port `3000 -> 80`.
- Backend: container `kanban-backend`, image `bacban-kanban-backend`, port `3001 -> 3001`.
- Optional dev service: `kanban-dev` under the `dev` profile. It also wants port 3000, so only run it after stopping `kanban-frontend`.
- Do not run host `npm` or `yarn` for this project. Use Docker-based commands as described in `AGENT.md`.

## Task intake contract

- For Codex work that should be tracked, add or update BacBan cards instead of creating separate to-do files.
- Default target is `Work` / `To Do` unless the user names another board or column.
- Prefer the backend API over direct data edits:
  - `GET http://127.0.0.1:3001/api/data`
  - `POST http://127.0.0.1:3001/api/data` with the full updated board state
- Before posting board changes, create a timestamped backup of `kanban-data\kanban-data.json`.
- Validate JSON and confirm `http://127.0.0.1:3001/health` after writes.
- Cards created by Codex should be concise and useful: title, source project/path, current status, next action, and evidence links or notes in `references` when needed.
- For agent-created or agent-changed cards, set `updatedAt` as a UTC ISO timestamp. Set `doneAt` as a UTC ISO timestamp when moving a card to done/completed. Use `waitingOn` only when Eric or another party needs to act; recent cards with `waitingOn` get brighter attention highlighting in the UI.

## Harness direction

- For repeatable automation, create a small manifest first, such as `codex/jobs/<slug>/job.json`.
- A good job manifest records source project, requested outcome, target board/column, inputs, commands run, outputs, verification, and next action.
- Keep generated logs and artifacts under `codex/outputs/`.
- Do not promote a harness to more general automation until one real task has worked end to end.

## Cleanup and safety

- Do not remove containers, images, or board data unless they are clearly accidental or the user explicitly asks.
- An exited `kanban-dev` container is part of the documented optional workflow, not evidence of an accidental second app by itself.
- When another Codex chat appears to have created a duplicate app, check `docker compose ls -a`, `docker ps -a`, listening ports, and top-level file timestamps before deleting anything.

## Git contract

- This directory is a local Git repo. Use `git status` and `git diff` before app/doc edits.
- Runtime board data, build output, dependencies, private Codex job payloads, and automation outputs are intentionally ignored. Do not force-add ignored private state without explicit approval.
