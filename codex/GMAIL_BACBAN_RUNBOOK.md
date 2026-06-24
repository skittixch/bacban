# Gmail to BacBan Agent Runbook

Last updated: 2026-06-24

This file is the durable handoff for the Gmail-triggered BacBan workflow across Codex, OpenCLAW, BacBan, and future Hermes-style agents.

## Current Architecture

Incoming Gmail is not handled by native Codex hooks. The current event path is:

1. Gmail Pub/Sub watch for the configured Gmail account on `INBOX`.
2. `gog` / OpenCLAW webhook listener receives the push event.
3. OpenCLAW maps the event to hook id `gmail-bacban-triage` with stable session key `hook:gmail-bacban-triage`.
4. The mapped prompt runs Codex against the live BacBan stack at `X:\_bacsapps\bacban`.
5. Codex reads Gmail context as needed, keeps Gmail read-only unless Eric explicitly approves Gmail mutations, and updates BacBan through the live API when justified.
6. If BacBan changed or Eric needs a decision, the workflow may send a concise private WhatsApp summary to Eric through OpenCLAW.

Important distinction: OpenCLAW is the inbound/event and WhatsApp gateway. BacBan API readback is the source of truth for whether board work succeeded.

## Native Codex Hooks Finding

Codex hooks are lifecycle hooks inside a Codex run, not external inbound webhooks. They can run around events such as `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `PostCompact`, and `Stop`.

Use native Codex hooks for local enforcement around an already-running Codex turn, such as checking commands, enforcing backup policy, logging, or stop-time validation.

Do not expect native Codex hooks to receive Gmail Pub/Sub or wake Codex by themselves. To replace OpenCLAW later, use an external listener that calls one of:

- `codex exec`
- Codex SDK
- Codex App Server

The simplest future native-ish shape would be:

`Gmail Pub/Sub listener -> local handler -> codex exec or Codex SDK -> BacBan API -> optional WhatsApp`

## Gmail Triage Rules

Future Gmail-triggered runs are allowed to create, update, move, complete, reopen, and annotate BacBan cards when the email is actionable.

Default routing:

- Personal/home/school/Edie/Jessica/admin items: `Life`
- Lyndon, Rachel, Tiki Taco, RW2 Productions, Field Trip Films items: `Work`
- New unscheduled work: `To Do`
- Active work: `In Progress`
- Blocked, waiting, review, or needs Eric input: `On hold` or closest waiting/review column
- Finished work: `Done` / `Completed`

Gmail remains read-only unless Eric explicitly approves send, archive, delete, label, or draft actions.

## BacBan Write Contract

Before any BacBan write:

1. Verify health at `http://127.0.0.1:3001/health`.
2. Back up `X:\_bacsapps\bacban\kanban-data\kanban-data.json`.
3. GET the full state from `http://127.0.0.1:3001/api/data`.
4. Modify only the needed card or cards.
5. Validate JSON.
6. POST the full updated state to `/api/data`.
7. Verify health again.
8. Read back the changed card or cards.

Prefer updating an existing relevant card over creating a duplicate. If an email clearly asks for a separate task, create or update a visible card instead of burying the request only in another card's references.

## Card Field Conventions

Use compatible JSON fields only.

- `createdAt`: existing board display date shape is acceptable.
- `updatedAt`: UTC ISO string, for every create/update/move.
- `doneAt`: UTC ISO string when moved to done/completed.
- `waitingOn`: only when Eric or an external party needs to act; this drives attention highlighting.
- `references`: dated, human-scannable notes with latest signal, work done, evidence, verification, status, and next action.

Older numeric `doneAt` values are still supported by the UI.

## Recent and Attention Highlighting

The BacBan frontend highlights cards changed in the last 24 hours:

- Desktop card path: `kanban-frontend/src/components/TaskCard.jsx`
- Responsive/mobile card path: `kanban-frontend/src/components/MobileDemo.jsx`
- Shared desktop styling: `kanban-frontend/src/index.css`
- Mobile styling: `kanban-frontend/src/components/MobileDemo.css`
- UI mutation timestamps: `kanban-frontend/src/hooks/useKanban.js`

Recent cards get a cyan AI-style outline glow. Recent cards that need attention get a brighter amber/pink/cyan glow. A card needs attention when it is not done and has `waitingOn`, is in a waiting/hold/review column, or is due soon/overdue.

## WhatsApp Boundary

Eric has approved concise private WhatsApp summaries to the configured private WhatsApp target for this Gmail-to-BacBan workflow only when BacBan changed or Eric's attention is needed.

For any incoming email Eric should personally look at, the WhatsApp message should answer:

- who is waiting on Eric
- what they need him to do
- short context, such as the sender/project/subject

Preferred shape: `<person/org> is waiting on you to <specific action>. <short context/project>.`

If the sender or requested action is unclear, say that plainly instead of guessing. Keep the message private, short, and decision-oriented. This approval applies even when the main useful action is marking or creating a BacBan card with `waitingOn` for Eric attention.

This approval does not authorize:

- Gmail sends
- Gmail drafts
- Gmail archive/delete/label changes
- messages to third parties
- unrelated outbound notifications

If WhatsApp delivery fails, do not mark the BacBan write as failed until board write/readback has been checked separately.

## Git and Private State

`X:\_bacsapps\bacban` is now a local Git repository. Initial baseline commit:

`cb72753 Initial BacBan source baseline`

The repository intentionally ignores private/runtime state by default:

- `kanban-data/`
- `kanban-frontend/node_modules/`
- `kanban-frontend/build/`
- `codex/outputs/`
- `codex/jobs/`
- `codex/scripts/bacban-notify*.ps1`
- env, credential, token, and key patterns

Use `git status` and `git diff` for future app/doc changes. Do not force-add ignored private state without explicit approval.

## Verification Anchors

Useful checks:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health'
gog gmail watch status --account <configured-gmail-account> --json --no-input
openclaw config validate
openclaw status --json
docker compose ps
git status --short --ignored
```

When changing the frontend:

```powershell
docker compose build kanban-frontend
docker compose up -d kanban-frontend
```

Then verify in browser at `http://localhost:3000`.
