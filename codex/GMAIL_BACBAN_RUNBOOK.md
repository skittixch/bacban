# Gmail to BacBan Agent Runbook

Last updated: 2026-06-25

This file is the durable handoff for the Gmail-triggered BacBan workflow across Codex, OpenCLAW, BacBan, and future Hermes-style agents.

## Current Architecture

Incoming Gmail is not handled by native Codex hooks. The current event path is:

1. Gmail Pub/Sub watch for the configured Gmail account on `INBOX`.
2. `gog` / OpenCLAW webhook listener receives the push event.
3. OpenCLAW maps the event to hook id `gmail-bacban-triage` with stable session key `hook:gmail-bacban-triage`.
4. The mapped prompt runs Codex against the live BacBan stack from the repo root.
5. Codex reads Gmail context as needed, keeps Gmail read-only unless the owner explicitly approves Gmail mutations, updates BacBan through the live API when justified, and starts a bounded project-local work loop when the email is implementation-ready.
6. If BacBan changed or the owner needs a decision, the workflow may send a concise private status summary through OpenCLAW.

Cutover status belongs in local private operations notes, not in public Git. In this repo, treat Gmail Pub/Sub as the primary intake shape when configured, and verify the current watch each run with `gog gmail watch status --account <configured-gmail-account> --json --no-input`. Keep any scheduled Codex sweep as a safety net, not the main trigger.

Important distinction: OpenCLAW is the inbound/event and WhatsApp gateway. BacBan API readback is the source of truth for whether board work succeeded.

Before changing event classification, same-method status behavior, dedupe, or ledger handling, read `codex\event-intake\event-rules.md`. Inbound Gmail/OpenCLAW events should be appended to the private ledger with `codex\event-intake\Write-AgentLedgerEvent.ps1`; the default runtime log is `codex\agent-ledger\events.jsonl` and must stay out of Git.

Live hook wiring as of 2026-06-24: the OpenCLAW mapping `gmail-bacban-triage` includes a ledger-first requirement in its `messageTemplate`, so every rendered Gmail event should run `Write-AgentLedgerEvent.ps1` before triage, BacBan writes, notifications, or project work.

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

Gmail remains read-only during intake. The standing exception is a concise completion-or-blocked status update to Eric only, when the task is actually complete or genuinely blocked and email is the relevant contact method. Send those status updates only to Eric's approved private email address; do not email third parties or reply to client/boss-facing threads.

Card creation or movement is intake, not completion. For actionable implementation-ready work that can safely be done on this machine, the run should continue after the BacBan update:

1. Re-anchor in the relevant project files, existing BacBan card, runbook, manifest, or handoff.
2. Move or keep the card `In Progress`.
3. Do one bounded safe work loop: inspect the real source of truth, make the smallest useful reversible change or produce the needed artifact, and run proportionate verification.
4. Update BacBan with the work done, evidence path or command/readback result, verification, status, and next action.
5. Continue only while progress is clear and safe; otherwise stop as complete, clean no-op, blocked, approval-required, or waiting.

Fail closed before boss/client-facing delivery, messages to third parties, publishing, payments, credentials, destructive actions, production deploys, or unclear authority. If blocked, put the exact `I need...` list and easiest next step in the private report and on the card when useful.

Default routing:

- Personal/home/school/Edie/Jessica/admin items: `Life`
- BacBan, Backban, Loom, Codex-agent workflow, trigger, automation, and internal workflow/system-setup items: `Life`, not `Work`, unless Eric explicitly routes one elsewhere
- Lyndon, Rachel, Tiki Taco, RW2 Productions, Field Trip Films items: `Work`
- New unscheduled work: `To Do`
- Eric-owned action, approval, or decision needed: `To Do` on the appropriate board, with `waitingOn` and next action explicit
- Active work: `In Progress`
- External wait, non-Eric blocker, review by someone else, or not actionable by Eric right now: `On hold` or closest waiting/review column
- Finished work: `Done` / `Completed`

Gmail remains read-only unless Eric explicitly approves send, archive, delete, label, or draft actions.

## Active Eric / Reply-Nudge Rule

Before notifying Eric about a coworker/client ask, inspect the same Gmail thread for newer Eric sent mail or other clear outgoing activity from Eric.

If Eric meaningfully responded after the ask, classify the event as `already-handled-by-Eric` or `status-only`, update durable state only when useful, and do not send WhatsApp or email. A newer meaningful reply, uploaded asset, shared link, or other clear outgoing action is enough evidence to suppress a duplicate nudge.

If the ask is addressed to Eric or clearly depends on Eric and no meaningful Eric response exists yet, allow a 20-minute grace window from the latest actionable inbound message before nudging. If it is still unanswered after that window, a concise private WhatsApp nudge to Eric is allowed and should include the proposed reply for approval. If the message is newer than 20 minutes, record or track it only if needed and do not nudge unless there is a separate urgent deadline.

Do not send Gmail replies, create Gmail drafts, or reply to third parties without Eric's explicit approval. For any first live email test of a third-party reply flow, send only a private test copy to Eric's approved private address or authenticated `me`. After Eric approves that test and the exact recipient/thread, then and only then send to the intended person.

## Tiki Taco SharePoint / Clipchamp Media Intake

For Rachel/Tiki Taco emails that contain a SharePoint, Clipchamp, or Microsoft Stream video link, first try the authenticated browser route before broad discovery:

1. Open the email link in Chrome using the existing signed-in browser session.
2. Confirm the Stream page title/media name, such as `0624 (1).mov`.
3. Use the Stream command bar `Download` action.
4. If Chrome writes a stable large temp file into the local Downloads folder, copy it into the target project `incoming` folder with a human-readable name.
5. Verify the copied file with `ffprobe` before treating it as source media.

Direct `curl`/HTTP with `download=1` can stop at SharePoint authentication and produce only a small HTML file. Prefer the authenticated browser route for this source class, then verify the downloaded media with `ffprobe`.

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
- `waitingOn`: only when Eric or an external party needs to act; this drives attention highlighting. If `waitingOn` is Eric, route the card to `To Do` unless Eric explicitly asks for it to be held.
- Explicit email priority lists: if the email plainly gives an ordered priority list, set `priority` to the 1-based rank on every affected card, set `prioritySource` to `email`, set `priorityTotal` when known, and set `priorityLabel` only when the sender gave useful wording for the rank. Keep the card order aligned with the stated list when practical, and mention the source email in `references`. Do not infer this from tone alone.
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

## Direct WhatsApp Intake Reliability

As of 2026-06-25, phone-origin WhatsApp messages for the BacBan/OpenCLAW path should route to the dedicated OpenClaw agent `bacban-whatsapp-intake`, not the broad default `main` agent. The intake workspace is private local state, heartbeat-disabled, and should acknowledge quickly or fail closed for broad/unsafe work.

If you keep local operator probes under `codex\scripts\`, use these shapes before changing WhatsApp behavior or when replies regress:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex\scripts\repair-openclaw-whatsapp.ps1 -DryRunMessage -RetryCount 3 -RetryDelaySeconds 1
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex\scripts\openclaw-whatsapp-reliability.ps1 -DryRunMessage
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex\scripts\prove-openclaw-whatsapp-route.ps1 -RecentWithinMinutes 45
```

Private proof artifacts should live under `codex\outputs\` and stay out of Git. A healthy proof should show the latest phone-origin WhatsApp direct session belongs to `bacban-whatsapp-intake`, the broad `main` session did not advance, the tail shows a successful message, and recovery/reliability probes have no critical findings.

The local WhatsApp harnesses use the named mutex `Local\BacBanOpenClawCliLock` so overlapping operator probes do not race OpenClaw CLI calls. If a BacBan due-notification send uses `codex\scripts\bacban-notify.ps1`, it must check the OpenClaw send exit code before marking notifications sent.

## Eric-Only Completion / Blocked Replies

Eric has approved same-method status replies when an incoming email or WhatsApp task has been completed or marked blocked. Use the method that contacted the system when available:

- Email-origin tasks: send or reply only to Eric's approved private email address or authenticated `me`.
- WhatsApp-origin tasks: reply only to the configured private WhatsApp target.

The status message should be short and say whether the task completed or is blocked, what changed, what was verified, and the smallest next action if blocked. This approval does not authorize messages to anyone except Eric, client-visible delivery, publishing, payment, credential, destructive, or production actions.

## Git and Private State

`X:\_bacsapps\bacban` is now a local Git repository. Initial baseline commit:

`cb72753 Initial BacBan source baseline`

The repository intentionally ignores private/runtime state by default:

- `kanban-data/`
- `kanban-frontend/node_modules/`
- `kanban-frontend/build/`
- `codex/outputs/`
- `codex/jobs/`
- `codex/scripts/`
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
