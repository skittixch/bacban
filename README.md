# BacBan

[![CI](https://github.com/skittixch/bacban/actions/workflows/ci.yml/badge.svg)](https://github.com/skittixch/bacban/actions/workflows/ci.yml)
[![Security Policy](https://img.shields.io/badge/security-policy-blue.svg)](SECURITY.md)
[![Private-first](https://img.shields.io/badge/data-local--first-0f766e.svg)](#private-state)

BacBan is a local-first task board and agent-operations pattern for the way I use Codex during the day. The app is a real kanban board, but the reason this repo exists is the workflow around it: a careful way for an AI assistant to ingest work, update cards, do one bounded useful loop, leave evidence, and stop before it crosses an unsafe boundary.

This is not a neutral kanban clone. It is an opinionated reference implementation of a single-user, Windows-first, assistant-assisted work system. Another person should be able to run the app, understand the concepts, and reimplement the same pattern with their own inbox, projects, notification channel, and safety rules.

## Live Demo

- Hosted entry: [https://skittixch.github.io/bacban/](https://skittixch.github.io/bacban/)
- Direct app demo: [https://skittixch.github.io/bacban/demo-app/](https://skittixch.github.io/bacban/demo-app/)
- Demo source: `docs/index.html`, `docs/demo-app/`, `demo/kanban-data.demo.json`, `kanban-frontend/public/demo-data.json`

The hosted demo is the real BacBan React app in browser-local storage mode. Visitors can add, edit, move, reset, import, and export cards. Demo data is stored in that visitor's browser and has no retention guarantee.

## What You Are Reimplementing

At a high level, BacBan is six pieces:

1. A local React board UI for Work and Life task tracking.
2. A small Express API that persists one full JSON board document.
3. A data model that gives assistants stable card fields such as `updatedAt`, `doneAt`, `waitingOn`, and `references`.
4. A write contract that makes every assistant board edit auditable: health, backup, full read, narrow edit, validation, full write, health, readback.
5. Event-intake rules for Gmail, WhatsApp/OpenCLAW intake, Telegram cutover, manual prompts, scheduled sweeps, and future listeners.
6. Durable context files so future assistant sessions can continue from project files and board state instead of chat memory alone.

If you copy only the UI, you get a nice local board. If you copy the full pattern, you get a local operating system for agent-assisted work.

## Core Ideas

### Local First

The live board data belongs on your machine, not in the repository. In this implementation the backend writes to `kanban-data/kanban-data.json`, mounted into Docker at `/data`. That directory is ignored by Git because it contains real tasks, private notes, and possibly inbox-derived metadata.

### Assistant As Operator, Not Authority

The assistant may inspect current files, current email/thread context, live board state, runbooks, and project evidence. It should not treat memory or chat history as proof. It should not complete, publish, send, delete, pay, expose credentials, or message third parties without explicit authority for that action.

### Intake Is Not Completion

Creating a card means "the request was captured." It does not mean the work was done. For implementation-ready work, the assistant should continue with one safe, bounded loop, verify it, update the card, and stop as completed, blocked, approval-required, waiting, no-op, duplicate, or failed.

### Portable Loom

The continuity pattern is:

- Warp: persistent board state, project files, specs, runbooks, manifests, and handoffs.
- Weft: the current assistant loop.
- Tension: tests, screenshots, API readbacks, exported artifacts, logs, and clear next actions.

The practical rule is: re-anchor in the board/project files, do one narrow useful loop, verify it, update durable state, then close with what changed and what remains.

### Fail Closed

When authority, inputs, credentials, source files, or tool state are unclear, stop with an exact `I need...` list and the easiest next action. Do not silently guess, and do not bury the blocker only in a board card.

## Quickstart

Prerequisites:

- Windows
- Docker Desktop
- Git
- PowerShell
- Optional for automation: Codex, OpenCLAW/gog, `gcloud`, a Google Cloud project, Gmail API, Cloud Pub/Sub, and an HTTPS route to your local listener

Run the local app:

```powershell
git clone https://github.com/skittixch/bacban.git
cd bacban
docker compose up -d --build
```

Open:

- UI: `http://localhost:3000`
- API health: `http://localhost:3001/health`
- Full board state: `http://localhost:3001/api/data`

On first run, the backend creates `kanban-data/kanban-data.json`.

## Architecture

```text
Browser
  -> React/CRA frontend in kanban-frontend/
  -> Express backend in kanban-backend/
  -> JSON data file in kanban-data/kanban-data.json

Optional agent intake
  -> Gmail Pub/Sub, WhatsApp/OpenCLAW intake, scheduled sweep, or manual prompt
  -> event classification and private ledger
  -> Codex or another assistant running in the repo root
  -> BacBan API write/readback
  -> optional private status back to the owner
```

Production Docker stack:

| Service | Container | Port | Purpose |
| --- | --- | --- | --- |
| `kanban-frontend` | `bacban-kanban-frontend` | `3000 -> 80` | nginx serving the built React app |
| `kanban-backend` | `bacban-kanban-backend` | `3001 -> 3001` | local JSON persistence API |
| `kanban-dev` | `node:18-alpine` | `3000 -> 3000` | optional CRA dev server under the `dev` profile |

`kanban-dev` conflicts with the production frontend on port 3000. Stop `kanban-frontend` before starting the dev service.

## Board Features

BacBan currently includes:

- Work and Life boards, with support for additional custom boards.
- Custom columns per board, ordered through `columnOrder` and named with `columnTitles`.
- Drag-and-drop cards across columns and boards.
- Drag-and-drop board and column ordering.
- Card add, edit, duplicate, delete, undo delete, undo/redo history, and keyboard undo/redo.
- Nested subtasks as "fractal kanbans" inside a card.
- Subtask add, edit, delete, reorder, move across subtask columns, drill-in, and overlay editing.
- Rich `references` HTML for notes, links, evidence, and inline images.
- `dueDate` for date-sensitive work.
- `waitingOn` for a person, system, approval, asset, or external dependency.
- `updatedAt` timestamps for recent-change highlighting.
- `doneAt` timestamps for completed-card retention and cleanup behavior.
- Project color labels with user-editable color names.
- Theme selection, dark mode, compact/comfortable card density, completed-card fading, retention days, and optional completion celebration.
- Server-backed storage through the local API.
- Backend board-change messages for assistant-side awareness of board edits made
  outside the current Codex loop.
- Deleted-card tombstones plus a similarity check API so inbox intake can avoid
  recreating bulk/noise cards the owner already removed.
- Optional delete-reason feedback from the delete toast so owner intent becomes
  private agent-side signal for future intake.
- Work/Life move hints plus a collection-routing check API so owner-corrected
  moves can steer similar future cards to the right board.
- Browser-local storage mode for private experiments and hosted demo use.
- JSON import/export for full board documents.
- Demo reset through the settings panel or `?resetDemo=1`.
- Responsive mobile board view.
- Mobile hold-to-arm adjacent-column movement: hold a card for about one second, get a best-effort haptic bump through `navigator.vibrate` when available, then swipe left or right to move the card one column at a time. The interaction avoids actual card dragging during the gesture and uses small, snappy affordance animations.

## Data Model

The board document is stored as one JSON object. Important fields:

```json
{
  "boards": {
    "work": {
      "title": "Work",
      "tasks": {
        "todo": [],
        "inprogress": [],
        "onhold": [],
        "done": []
      },
      "columnOrder": ["todo", "inprogress", "onhold", "done"],
      "columnTitles": {
        "todo": "To Do",
        "inprogress": "In Progress",
        "onhold": "on hold",
        "done": "Completed"
      }
    }
  },
  "boardOrder": ["work", "life"],
  "theme": "blue",
  "darkMode": true,
  "projectColors": {
    "#ef4444": "Urgent",
    "#f97316": "Operations",
    "#f59e0b": "Setup",
    "#22c55e": "Release",
    "#3b82f6": "Client Work",
    "#8b5cf6": "Automation",
    "#ec4899": "Personal"
  },
  "settings": {
    "completedTaskRetentionDays": 7,
    "completedTaskFade": true,
    "completionCelebration": true,
    "cardDensity": "comfortable"
  }
}
```

A card can contain:

```json
{
  "id": "task_abc",
  "text": "Project Name",
  "createdAt": "6/25/2026",
  "updatedAt": "2026-06-25T18:30:00Z",
  "doneAt": "2026-06-25T19:00:00Z",
  "dueDate": "2026-06-28",
  "color": "#3b82f6",
  "waitingOn": "Client approval",
  "references": "<p>Human-readable evidence and notes.</p>",
  "subtasks": {
    "columns": ["todo", "doing", "done"],
    "columnTitles": {
      "todo": "To Do",
      "doing": "Doing",
      "done": "Done"
    },
    "items": {
      "todo": [],
      "doing": [],
      "done": []
    }
  }
}
```

Field rules:

- Use UTC ISO strings for new `updatedAt` and `doneAt` values.
- Set `updatedAt` on every assistant-created or assistant-changed card.
- Set `doneAt` only when a card moves to a done/completed column.
- Older numeric `doneAt` values remain supported for compatibility.
- Use `waitingOn` only when a person or external system needs to act.
- Keep `references` human-scannable. Prefer dated updates with latest signal, work done, evidence, verification, status, and next action.
- Cards in On Hold, Waiting, or Blocked columns with no fresh information for
  more than 14 days are UI limbo: they remain in the board data but collapse
  under an `and N more...` row. New actionable information should update the
  card and move it to To Do or the needed column; "wait longer" information
  should update the card and keep it visible in On Hold.
- Treat stored priority ranks as original source evidence. The UI shows
  completed priority cards with a checked priority circle and compresses active
  badge numbers around the remaining active cards; reopening a completed
  priority card restores the original ordering.

## Agent Write Contract

Any assistant that writes to BacBan should follow this exact sequence:

1. Verify `GET http://127.0.0.1:3001/health`.
2. Back up `kanban-data/kanban-data.json`.
3. GET the full board state from `http://127.0.0.1:3001/api/data`.
4. Search for an existing relevant card before creating a duplicate.
5. Modify only the relevant board, column, card, or fields.
6. Validate JSON locally.
7. POST the full updated document back to `http://127.0.0.1:3001/api/data`.
8. Verify health again.
9. Read back the touched card or board result.

Do not PATCH fragments. The API accepts the full document so the write is simple and auditable.

## Card Routing Rules

The default routing in this repo is intentionally personal:

- Work/client/project work goes to `Work`.
- Personal, family, school, home, admin, and sensitive local-only planning goes to `Life`.
- BacBan, Backban, Loom, Codex-agent workflow, trigger, automation, and internal workflow/system-setup tasks go to `Life` unless explicitly routed elsewhere.
- New unscheduled work starts in `To Do`.
- Active work goes to `In Progress`.
- External waits, non-Eric blockers, review by someone else, or work not actionable right now goes to `On hold` or the closest waiting/review column.
- Eric-owned action, approval, or decision stays actionable, usually `To Do`, with `waitingOn` and concrete next steps.
- Finished work goes to `Done` / `Completed`.

When adapting BacBan for someone else, replace these defaults with their real boards, columns, attention rules, and authority boundaries.

## Event Intake Rules

Inbound Gmail, WhatsApp, OpenCLAW, manual, or scheduled events should be classified before action. The current classification set is:

- `actionable-task`: create/update a card and do one bounded safe loop if possible.
- `attention-needed`: the owner needs to read, decide, approve, or provide input.
- `status-only`: record progress on an existing task; no new work is needed.
- `already-handled-by-Eric`: a newer sent message or clear outgoing activity shows the ask was already handled.
- `informational-no-op`: useful context but no board or work change is justified.
- `duplicate`: already handled by a prior event, card update, or ledger entry.
- `approval-required`: useful action exists, but authority is missing.
- `blocked`: action is clear, but required input, access, asset, or tool state is missing.
- `failed`: intake or write path failed before reliable classification or readback.

Terminal states are:

- `completed`
- `board-changed`
- `work-started`
- `blocked`
- `approval-required`
- `no-op`
- `already-handled-by-Eric`
- `duplicate`
- `failed`

The rule that matters most: do not report card creation as completion unless the requested work itself is complete.

## Private Event Ledger

Inbound events should leave a private runtime record before triage mutates anything.

Default ledger:

```text
codex\agent-ledger\events.jsonl
```

Writer:

```powershell
.\codex\event-intake\Write-AgentLedgerEvent.ps1 `
  -PayloadJson '<json>' `
  -Source gmail `
  -Gateway openclaw `
  -Status received
```

Ledger records include source/gateway, dedupe keys, Gmail/OpenCLAW ids when available, BacBan card location when available, classification, status, verification, and next action.

Do not store raw email bodies, OAuth tokens, API keys, service-account keys, WhatsApp session data, or full private message dumps in the ledger. Runtime ledger files stay ignored by Git.

The backend also writes local board-change messages to `codex\agent-ledger\board-events.jsonl`, deleted-card tombstones to `codex\agent-ledger\deleted-cards.jsonl`, optional delete-toast reasons to `codex\agent-ledger\deleted-card-feedback.jsonl`, and Work/Life routing hints to `codex\agent-ledger\collection-routing.jsonl`. Before a Gmail/OpenCLAW intake run creates a new card, it should call `POST /api/deleted-cards/check` with the sender, subject, and snippet. A match means "inspect before creating"; it is not a destructive Gmail action. Before choosing Work versus Life, it should call `POST /api/collection-routing/check` with the candidate title/subject/snippet and prefer the recommended board unless current evidence clearly overrides it.

## Gmail To BacBan Workflow

The current intended architecture is:

```text
Gmail Pub/Sub watch on INBOX
  -> Pub/Sub push subscription
  -> gog/OpenCLAW webhook listener
  -> OpenCLAW hook mapping id gmail-bacban-triage
  -> stable session key hook:gmail-bacban-triage
  -> Codex run in this repo
  -> Gmail/thread read as needed
  -> BacBan API write/readback
  -> optional private status to the owner
```

Rules:

- Gmail is read-only unless the owner explicitly approves send, draft, archive, delete, or label actions.
- Match sender, subject, thread id, message id, history id, and existing BacBan references before creating a new card.
- Ignore newsletters, routine statements, ads, generic edit alerts, and ambiguous transactional mail unless they clearly map to real work.
- Before nudging the owner about a coworker/client ask, inspect the same thread for newer sent mail or other clear outgoing activity. If the owner already responded or acted, classify as `already-handled-by-Eric` or `status-only` and do not nudge.
- If the ask clearly depends on the owner and there is no meaningful response, allow a short grace window before sending a private nudge unless an urgent deadline is explicit.
- If an email contains implementation-ready work that can safely be done locally, update BacBan and then do one bounded project-local loop.
- Stop before third-party replies, client-facing delivery, publishing, payment, credentials, destructive changes, production deploys, or unclear authority.

Gmail Pub/Sub requires:

- A Google Cloud project.
- Gmail API and Cloud Pub/Sub API enabled.
- A Pub/Sub topic with publish permission for `gmail-api-push@system.gserviceaccount.com`.
- A push subscription to an HTTPS endpoint that reaches the local listener.
- Gmail OAuth for the mailbox.
- Watch renewal at least every seven days, preferably daily.
- A handler that resolves the Gmail `historyId` to actual message/thread changes.

Native Codex hooks are not a Gmail webhook server. They are lifecycle hooks inside an already-running Codex turn. If OpenCLAW is replaced later, keep the same external-listener shape:

```text
Gmail Pub/Sub listener
  -> local handler
  -> codex exec or Codex SDK
  -> BacBan API write/readback
  -> optional private notification
```

## Private Status And OpenCLAW Workflow

OpenCLAW is the inbound gateway. BacBan API readback is the truth for whether board work succeeded.

Private status target: Telegram.
Current verified fallback: WhatsApp, until Telegram sends and receives are proven end to end.

Approved private status behavior:

- OK: private Telegram summary to the owner when BacBan changed, work completed, work blocked, or the owner needs attention.
- OK: concise wording in the shape `<person/org> is waiting on you to <specific action>. <short context/project>.`
- OK: same-method completion/blocked reply only to the owner.
- Not OK by default: Gmail replies to third parties, Telegram or WhatsApp messages to clients/groups, publishing, destructive actions, payment actions, credential actions, or production deploys.

Current phone-origin WhatsApp intake should route to a dedicated `bacban-whatsapp-intake` OpenCLAW agent rather than a broad default agent. That inbound path remains separate from the owner status channel and should acknowledge quickly or fail closed with the exact missing input.

Local operator harnesses used in this workflow include:

- `codex\scripts\watch-openclaw-whatsapp-inbound.ps1`: watch for recent inbound WhatsApp sessions.
- `codex\scripts\test-openclaw-whatsapp-intake-contract.ps1`: verify the intake agent's response contract.
- `codex\scripts\prove-openclaw-whatsapp-route.ps1`: prove recent phone-origin WhatsApp routed to the expected intake agent.
- `codex\scripts\repair-openclaw-whatsapp.ps1`: inspect and optionally repair gateway/channel/session issues.
- `codex\scripts\openclaw-whatsapp-reliability.ps1`: combined reliability probe, with dry-run and optional live private probe modes.
- `codex\scripts\bacban-notify.ps1`: due/attention notification helper that must check OpenCLAW send success before marking notifications sent.

Telegram delivery and cutover notes live in `docs/TELEGRAM_CUTOVER.md`. Until a live Telegram proof exists, keep the WhatsApp fallback path documented and do not mark the cutover complete.

These harnesses use a named mutex, `Local\BacBanOpenClawCliLock`, so overlapping CLI probes do not race each other. Keep outputs under `codex\outputs/` and keep private runtime evidence out of Git.

## Same-Method Owner Replies

The current approval boundary allows concise completion or blocked status back to the owner through the same private method that originated the task:

- Email-origin task: private email only to the owner's approved private address or authenticated `me`.
- Telegram-origin task: private Telegram only to the configured private target. Use the current verified WhatsApp fallback only while the Telegram cutover is still pending.

The message should say whether the task completed or is blocked, what changed, what was verified, and the smallest next action if blocked. This does not authorize replies to clients, coworkers, vendors, groups, or public channels.

## Loop Library Overlay

`codex/LOOP_LIBRARY.md` documents an optional Loop Library overlay. Use it as a pattern catalog for repeatable agent workflows, not as authority.

Useful pattern names for BacBan work:

- ticket-to-PR-ready loop
- full product evaluation loop
- docs sweep
- loop-harness verification loop
- artifact-to-skill loop
- living-story loop
- groundtruth audit
- recent-feedback sweep
- Codex completion-contract loop

Local rules, BacBan board state, project files, user instructions, and verified evidence always outrank a published loop prompt.

## Development Commands

Use Docker for normal app and development workflows. Do not run host `npm` or `yarn` unless you are intentionally changing that contract.

Production-style stack:

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
docker compose stop kanban-frontend
docker compose --profile dev up kanban-dev
```

Run frontend package commands inside Docker:

```powershell
docker compose run --rm kanban-dev npm run build
```

Build the hosted demo bundle:

```powershell
docker compose run --rm `
  -e PUBLIC_URL=. `
  -e REACT_APP_BACBAN_DEMO=true `
  -e GENERATE_SOURCEMAP=false `
  kanban-dev npm run build
```

Then copy the generated `kanban-frontend/build` output into `docs/demo-app/` only after verifying the source and target paths.

## GitHub And Publishing

GitHub automation currently includes:

- CI workflow: validates Docker Compose, builds services, starts the stack, waits for backend health, then tears down.
- Pages workflow: manual `workflow_dispatch` deployment of `docs/` to GitHub Pages.
- Scorecard workflow: OpenSSF Scorecard on schedule or manual dispatch, gated to public repository visibility.
- Dependabot: dependency update branches for GitHub Actions and package ecosystems.
- Issue templates, PR template, contributing guide, code of conduct, security policy, support file, and license.

The Pages workflow is manual so normal pushes do not fail on accounts or repository states where Pages is unavailable. After changing `docs/`, dispatch Pages deliberately and verify the hosted URL.

## Commit And Cleanup Cadence

The preferred Git posture is frequent small commits, not a long-running dirty tree.

Current operating rule:

- When a coherent scope is ready, verify it, stage only that scope, commit it, and push it.
- Prefer multiple focused commits over one mixed cleanup commit.
- Use clear commit messages that name the real behavior or documentation change.
- Do not hide dirty state with `git reset --hard`, `git checkout --`, force-push, or blind deletion.
- Clean the workspace by committing/pushing reviewed useful work or deleting only files that are clearly generated, cached, temporary, and safe to remove.
- If a file is private, ambiguous, or unreviewed user work, do not delete it just to make `git status` quiet. Leave it and report the exact blocker.
- Use `git fetch --prune` for stale remote-tracking refs.
- Delete local branches only when they are fully merged into `main` / `origin/main` and are not the current branch.
- Do not delete unmerged branches, protected branches, or remote branches unless there is clear evidence they are stale, merged, superseded, and safe.

There is a local Codex automation named `bacban-nightly-repo-cleanup` scheduled for 3:00 AM daily. Its job is to fetch/prune, classify dirty work, make frequent coherent commits, push reviewed scopes, clean only safe generated clutter, update BacBan when useful, and report any remaining blockers.

## Documentation Map

- `AGENTS.md`: current Codex operating instructions for this repo.
- `AGENT.md`: app architecture, Docker contract, and data model.
- `docs/API.md`: local API contract and board JSON fields.
- `docs/DEMO.md`: seed/reset a safe sample board.
- `docs/ONBOARDING.md`: step-by-step path from board-only to assistant intake.
- `docs/CODEX_GMAIL_SETUP.md`: Gmail Pub/Sub, OpenCLAW/gog, and Codex execution architecture.
- `docs/GITHUB_PUBLISHING.md`: private-first publishing and public-release checks.
- `docs/REPO_BEST_PRACTICES.md`: repository-quality checklist used when polishing the repo.
- `codex/README.md`: how to use the local Codex-only workspace.
- `codex/GMAIL_BACBAN_RUNBOOK.md`: durable handoff for Gmail, OpenCLAW, WhatsApp, Codex hooks, and future listener replacements.
- `codex/event-intake/event-rules.md`: event classification, terminal states, ledger, and source-authority rules.
- `codex/event-intake/Write-AgentLedgerEvent.ps1`: private event-ledger writer.
- `codex/agent-ledger/README.md`: private ledger usage notes.
- `codex/LOOP_LIBRARY.md`: optional loop-pattern overlay.

## Repository Layout

```text
.
|-- kanban-frontend/        React board UI and browser-local/demo storage mode
|-- kanban-backend/         Express JSON persistence API
|-- kanban-data/            Runtime board data, ignored by Git
|-- demo/                   Safe demo board seed
|-- docs/                   Hosted demo, setup docs, API docs, publishing docs
|-- codex/                  Runbooks, event intake rules, local harnesses, private outputs
|-- .github/                CI, manual Pages deploy, Scorecard, templates, Dependabot
|-- docker-compose.yml      Local production and optional dev stack
|-- AGENTS.md               Codex operating instructions
`-- AGENT.md                App architecture and Docker rules
```

## Private State

Do not commit:

- `kanban-data/`
- live board exports
- OAuth client secrets
- Gmail token caches
- OpenCLAW config and channel credentials
- phone numbers and WhatsApp session ids
- `.env` files
- service account keys
- API tokens, GitHub tokens, Google credentials, or private keys
- `codex/agent-ledger/*.jsonl`
- `codex/jobs/`
- `codex/outputs/`
- Chrome profiles, screenshots with private content, downloaded media, or client assets
- `kanban-frontend/node_modules/`
- `kanban-frontend/build/`

Run this before publishing:

```powershell
git status --short --ignored
git diff --check
```

If the repo is public, treat every tracked file as something a stranger can read and reuse. Keep account-specific runbooks sanitized or move them out of the public branch.

## Reimplementation Checklist

To build your own BacBan-like setup from scratch:

1. Build a local board UI that can store boards, columns, cards, references, subtasks, due dates, and status metadata.
2. Put the live board state in one local JSON document or another inspectable store.
3. Expose a small local read/write API with health, full read, and full write.
4. Define card fields your assistant can update predictably: `updatedAt`, `doneAt`, `waitingOn`, `references`, board id, column id, and evidence paths.
5. Write the assistant contract before wiring any inbox: health, backup, full read, dedupe, narrow edit, validate, full write, health, readback.
6. Define event classifications and terminal states.
7. Add a private append-only event ledger with dedupe keys and no raw secret/message dumps.
8. Test one manual event end to end.
9. Add a private notification channel only after board writes are trustworthy.
10. Add Gmail Pub/Sub or another inbox source only after you can classify events safely.
11. Keep the listener outside Codex. Let it call `codex exec`, the Codex SDK, or another assistant runner.
12. Keep external actions gated: third-party sends, public publishing, destructive changes, payments, credentials, and production deploys require explicit approval.
13. Preserve evidence for every meaningful loop: command output summaries, paths, screenshots, API readbacks, run JSON, or exported artifacts.
14. Update durable state after every loop so the next assistant session can resume without chat archaeology.

## Current Limits

- Windows and PowerShell are the supported operator environment.
- Docker Desktop is the supported runtime.
- This is a single-user, local-first system, not a multi-tenant SaaS.
- The agent workflow assumes a high-capacity Codex-style assistant and enough usage budget for long-context loops, source inspection, verification, and durable updates.
- OpenCLAW/gog/Gmail pieces depend on local account setup that should not be committed.
- Native Codex hooks are useful guardrails inside a Codex run, not inbound webhooks.
- The hosted demo stores data in visitor browser storage and does not guarantee retention.

## License

Private preview. See `LICENSE` for the current all-rights-reserved license notice. Swap this for an explicit open-source license before publishing as OSS.
