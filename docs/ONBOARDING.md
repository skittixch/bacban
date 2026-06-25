# BacBan Onboarding

This guide gets a new operator from a local board to optional WhatsApp and Gmail-triggered assistant control. Keep account names, tokens, OAuth client files, OpenCLAW config, local phone numbers, and live board data out of Git.

## Choose a Mode

- Board only: run BacBan locally and manage cards by hand.
- Board plus WhatsApp: allow private status messages to the operator.
- Gmail to board: let Gmail events create or update BacBan cards after readback verification.
- Gmail plus WhatsApp: same as Gmail to board, with private status messages only when the board changed or the operator needs to act.

Do not enable outbound Gmail sends, third-party WhatsApp messages, publishing, payment actions, or destructive changes without explicit approval for that action class.

## 1. Run BacBan

Prerequisites:

- Docker Desktop
- Git

```powershell
git clone <repo-url> bacban
cd bacban
docker compose up -d --build
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health'
```

Open `http://localhost:3000`.

For a populated first-run board, follow `docs/DEMO.md`.

## 2. Define the Agent Write Contract

Any local assistant that writes to BacBan should follow this sequence:

1. Verify `http://127.0.0.1:3001/health`.
2. Back up `kanban-data\kanban-data.json`.
3. GET the full state from `http://127.0.0.1:3001/api/data`.
4. Update only the relevant cards.
5. Validate JSON.
6. POST the full state back to `/api/data`.
7. Verify health again.
8. Read back the touched card or cards.
9. Send a private status only when a card changed, work completed, work blocked, or the operator needs to act.

The assistant should treat an incoming message as intake, not completion. It should do one bounded useful loop when possible, update durable state, then report complete, blocked, or no-op.

## 3. Add WhatsApp Status Through OpenCLAW

Prerequisites:

- OpenCLAW installed and available on `PATH`.
- A WhatsApp channel configured in OpenCLAW.

Useful setup and verification commands:

```powershell
openclaw channels list --all
openclaw channels add
openclaw channels login --channel whatsapp
openclaw channels status --probe
openclaw config validate
openclaw status --json
```

Keep the WhatsApp boundary narrow:

- OK: private status to the operator after a BacBan change, completion, blocked state, or attention-needed event.
- OK: "Alex is waiting on you to approve the draft. Project: demo release notes."
- Not OK by default: messages to clients, vendors, teammates, or groups.
- Not OK by default: messages that imply a task was completed when the assistant only logged intake.

Store OpenCLAW config and channel credentials in local config only. Do not commit them.

## 4. Add Gmail Events

Gmail push notifications need an external listener. Native Codex hooks run inside a Codex session; they are not a Gmail webhook server by themselves.

Prerequisites:

- Google Cloud project.
- Gmail API enabled.
- Cloud Pub/Sub API enabled.
- OAuth client for the mailbox.
- `gcloud` authenticated locally.
- `gog` authenticated to the mailbox.
- An HTTPS endpoint that reaches the local listener, such as Tailscale Funnel or another tunnel.
- OpenCLAW/gog webhook support, or another listener that can call `codex exec` or the Codex SDK.

Setup shape:

```text
Gmail Pub/Sub watch
  -> Pub/Sub push subscription
  -> local HTTPS listener
  -> assistant run
  -> BacBan API write/readback
  -> optional private WhatsApp status
```

OpenCLAW/gog command shape:

```powershell
openclaw webhooks gmail setup `
  --account <gmail-account> `
  --project <google-cloud-project-id> `
  --topic <pubsub-topic-name> `
  --subscription <pubsub-subscription-name> `
  --json

gog gmail watch status --account <gmail-account> --json --no-input
openclaw status --json
```

The Gmail handler prompt should require:

- Read Gmail context only unless explicit approval allows Gmail send, draft, archive, delete, or label changes.
- Match to existing BacBan cards before creating a duplicate.
- Use the BacBan write contract.
- Move cards only when status really changed.
- Set `updatedAt` on every agent change.
- Set `doneAt` only when moving a card to Done or Completed.
- Set `waitingOn` when the operator or another party must act.
- Send a private WhatsApp status only when BacBan changed or the operator needs attention.

## 5. Codex Execution Options

For a simple listener, call `codex exec` from the repo root after the listener resolves the Gmail message context:

```powershell
Push-Location <repo-root>

$payload = Get-Content .\event.json -Raw
$prompt = @"
You are handling one inbound BacBan event.

Read AGENTS.md and docs/ONBOARDING.md first.
Event JSON:
$payload

Decide whether to update BacBan.
If useful work can be started safely, do one bounded loop.
Keep Gmail read-only unless explicit approval is present.
Use the BacBan write contract and verify readback.
Report complete, blocked, or no-op through the same private intake channel when appropriate.
"@

try {
  codex exec --sandbox workspace-write "$prompt"
} finally {
  Pop-Location
}
```

Use the Codex SDK instead when a service needs structured thread reuse, tool orchestration, or explicit sandbox control.

## 6. Recovery Checks

If a message arrives but BacBan does not change:

1. Check `http://127.0.0.1:3001/health`.
2. Check OpenCLAW status.
3. Check Gmail watch status.
4. Check whether the webhook reached the handler.
5. Check the assistant run output.
6. Check whether the message was informational and correctly handled as no-op.

If WhatsApp fails but BacBan changed, treat notification recovery separately. The board write remains the source of truth.
