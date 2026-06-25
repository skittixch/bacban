# Event Intake Rules

This file defines the first durable event-intake registry for BacBan agent work. It is intentionally small: every incoming event should be logged, classified, acted on only within its authority, verified, and left in a terminal state.

## Purpose

Incoming Gmail and WhatsApp/OpenCLAW messages should not stop at "card was created." They should start one bounded useful loop when the request is clear and safe.

The event path should produce:

- A private append-only event record in `codex\agent-ledger\events.jsonl`.
- A BacBan card create/update/move only when the event is actionable.
- One bounded work loop when the task is implementation-ready and safe.
- A short private status reply to Eric only when the work completed, is blocked, changed BacBan, or needs Eric's attention.

## Source Authority

Use this order when sources disagree:

1. Live message/thread data from Gmail, WhatsApp, or the source connector.
2. Live project files, task board state, docs, manifests, and handoffs.
3. Current automation config and health/readback output.
4. Durable runbooks and memory notes.
5. Chat history.

Treat durable memory as context, not proof. Verify live state before board writes, sends, publishing, destructive actions, production deploys, credentials, payment actions, or client-visible delivery.

## Event Classes

Use these classifications in the ledger `result.classification` field:

- `actionable-task`: create/update a card and do one bounded safe loop if possible.
- `attention-needed`: Eric personally needs to read, decide, approve, or provide input.
- `status-only`: record progress on an existing task; no new work is needed.
- `already-handled-by-Eric`: a newer sent message or clear outgoing activity shows Eric has already handled the ask.
- `informational-no-op`: useful context but no board or work change is justified.
- `duplicate`: already handled by a prior event, card update, or ledger entry.
- `approval-required`: useful action exists, but authority is missing.
- `blocked`: action is clear, but required input, access, asset, or tool state is missing.
- `failed`: the intake or write path failed and needs operator repair.

## Terminal States

Every event should stop in one of these states:

- `completed`: requested work was actually completed and verified.
- `board-changed`: BacBan was updated, but work remains.
- `work-started`: a bounded loop started and left durable state.
- `blocked`: exact `I need...` list is known.
- `approval-required`: explicit approval is needed before the next action.
- `no-op`: fresh evidence says no action is needed.
- `already-handled-by-Eric`: Eric has already responded or acted, so no nudge is sent.
- `duplicate`: same event or task was already handled.
- `failed`: infrastructure failed before reliable classification or write/readback.

Do not report card creation as completion unless the requested work itself is complete.

## Gmail and OpenCLAW Rules

For Gmail-origin events:

- Gmail is read-only unless Eric explicitly approves send, draft, archive, delete, or label changes.
- Prefer matching sender, subject, thread id, message id, history id, and existing BacBan references before creating a new card.
- Use the Gmail connector or current Gmail context first when available.
- Do not treat newsletters, routine statements, ads, generic edit alerts, or ambiguous transactional mail as actionable without confirming the underlying work signal.
- Before nudging Eric about a coworker/client ask, read the same thread for newer Eric sent mail. If Eric has meaningfully responded after the ask, classify the event as `already-handled-by-Eric` or `status-only` and do not send WhatsApp or email.
- If an Eric-owned ask has no meaningful Eric response, wait 20 minutes from the latest actionable inbound message before sending a private WhatsApp nudge, unless a separate urgent deadline is explicit.
- Do not send Gmail replies, create Gmail drafts, or reply to third parties without Eric's explicit approval. A first live email test for a third-party reply flow must go only to Eric's approved private address or authenticated `me`; send to the intended person only after Eric approves that test and the exact recipient/thread.

For OpenCLAW/WhatsApp-origin events:

- OpenCLAW is the inbound/status gateway, not proof that BacBan changed.
- BacBan API readback is the source of truth for board success.
- Send WhatsApp status only to Eric's configured private target.
- Do not send to third parties or groups without explicit approval.

## BacBan Write Rules

Before any board write:

1. Verify `http://127.0.0.1:3001/health`.
2. Back up `kanban-data\kanban-data.json`.
3. GET the full state from `http://127.0.0.1:3001/api/data`.
4. Modify only relevant cards.
5. Validate JSON.
6. POST the full state to `/api/data`.
7. Verify health again.
8. Read back the touched card or cards.

Set `updatedAt` on every agent-created or agent-changed card. Set `doneAt` only when moving to Done or Completed. Use `waitingOn` only when Eric or another party needs to act.

When a Gmail or WhatsApp event explicitly states an ordered priority list, preserve it on each affected card with `priority` as the 1-based rank, `prioritySource` set to `email` or `whatsapp`, `priorityTotal` when known, and `priorityLabel` only for useful sender-provided wording. Do not infer priority-list badges from tone or urgency words without an explicit order.

## Ledger Rules

The ledger is private runtime evidence. Keep `codex\agent-ledger\events.jsonl` ignored by Git.

Record one JSON object per line with:

- event id and UTC recorded time
- source and gateway
- dedupe keys and payload hash
- Gmail/OpenCLAW ids when available
- BacBan card id/board/column when available
- classification, status, verification, and next action

Do not store raw email bodies, OAuth tokens, API keys, WhatsApp session secrets, service-account keys, or full private message dumps in the ledger.

## Writer

Use the first local writer:

```powershell
$payload = @{
  emailAddress = '<gmail-account>'
  historyId = '<history-id>'
  messageId = '<gmail-message-id>'
  threadId = '<gmail-thread-id>'
  subject = '<subject>'
  from = '<sender>'
  hookId = 'gmail-bacban-triage'
  sessionKey = 'hook:gmail-bacban-triage'
  classification = 'actionable-task'
  nextAction = 'Match to BacBan card, then run one bounded safe loop.'
} | ConvertTo-Json -Depth 10

.\codex\event-intake\Write-AgentLedgerEvent.ps1 `
  -PayloadJson $payload `
  -Source gmail `
  -Gateway openclaw `
  -Status received
```

Use `-DryRun` to validate the normalized record without appending. Use `-AllowDuplicate` only for deliberate replay tests.
