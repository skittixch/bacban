# BacBan Onboarding

This guide is for someone who wants to run BacBan on their own Windows machine and then, if useful, teach an assistant to update the board safely.

Start small. The board is useful by itself. The Gmail, WhatsApp, Telegram, and Codex pieces only make sense after you trust the local board and understand the write contract.

Keep account names, tokens, OAuth client files, OpenCLAW config, local phone numbers, and live board data out of Git.

## Before You Start

BacBan currently assumes:

- Windows.
- PowerShell.
- Docker Desktop.
- Git.
- Local-first board data stored outside Git.

For agent automation, it also assumes a high-capacity Codex setup. The author's workflow is built around the high-usage OpenAI ChatGPT Pro tier with Codex, specifically the $200/month Pro plan. The app still runs without that, but the deeper automation loops are designed for a model and usage budget that can handle long context, project files, verification steps, and repeated readback.

## Choose Your First Mode

Pick one mode and get it working before moving to the next.

- Board only: run BacBan locally and manage cards yourself.
- Board plus private status: let the assistant send private status messages to you when a card changes or needs attention.
- Gmail to board: let Gmail events create or update BacBan cards after readback verification.
- Gmail plus private status: combine Gmail intake with private status messages only when the board changed or you need to act.

Do not enable outbound Gmail sends, third-party Telegram or WhatsApp messages, publishing, payment actions, or destructive changes without explicit approval for that action class.

## 1. Run BacBan

This step proves the local app works.

```powershell
git clone <repo-url> bacban
cd bacban
docker compose up -d --build
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health'
```

Open `http://localhost:3000`.

For a populated first-run board, follow `docs/DEMO.md`.

At this point you should spend a few minutes using the board manually. Rename a card, move it, add a reference, and make sure the local workflow feels understandable before adding automation.

## 2. Make the Board Yours

The sample shape reflects the author's defaults. Replace it with yours.

Useful first edits:

- Rename boards and columns to match your daily categories.
- Delete sample cards that do not match your life.
- Add a few real Work cards and a few real Life cards.
- Use references for links, notes, screenshots, or evidence you want an assistant to preserve.
- Use `waitingOn` only when a person or outside system must act.

The goal is not to design the perfect board. The goal is to give the assistant a concrete place to put real work without guessing.

## 3. Define the Agent Write Contract

Any local assistant that writes to BacBan should follow this sequence:

1. Verify `http://127.0.0.1:3001/health`.
2. Back up `kanban-data\kanban-data.json`.
3. GET the full state from `http://127.0.0.1:3001/api/data`.
4. Update only the relevant cards.
5. Validate JSON.
6. POST the full state back to `/api/data`.
7. Verify health again.
8. Read back the touched card or cards.
9. Send a private status only when a card changed, work completed, work blocked, or you need to act.

The assistant should treat an incoming message as intake, not completion. It should do one bounded useful loop when possible, update durable state, then report complete, blocked, or no-op.

## 4. Test One Assistant Loop

Before adding Gmail, WhatsApp, or Telegram, test a boring local loop:

1. Ask the assistant to inspect one real project note or email excerpt you provide manually.
2. Have it decide whether an existing card should be updated or a new card should be created.
3. Require it to follow the write contract.
4. Check the card yourself in the browser.
5. Keep the result only if the card is accurate and readable.

This is the trust-building step. If one card cannot be updated clearly, do not automate a whole inbox yet.

## 5. Add Private Status Through OpenCLAW

Prerequisites:

- OpenCLAW installed and available on `PATH`.
- A private Telegram target for owner status, plus the current WhatsApp fallback until Telegram is verified end to end.

Useful setup and verification commands:

```powershell
openclaw channels list --all
openclaw channels add
openclaw channels login --channel whatsapp
openclaw channels status --probe
openclaw config validate
openclaw status --json
```

Keep the private-status boundary narrow:

- OK: private status to you after a BacBan change, completion, blocked state, or attention-needed event.
- OK: "Alex is waiting on you to approve the draft. Project: demo release notes."
- Not OK by default: messages to clients, vendors, teammates, or groups.
- Not OK by default: messages that imply a task was completed when the assistant only logged intake.

Store OpenCLAW config, Telegram bot credentials, and channel credentials in local config only. Do not commit them.

If Telegram is the intended owner status channel, keep WhatsApp as a temporary fallback until a live Telegram send/receive proof exists and the cutover note in `docs/TELEGRAM_CUTOVER.md` is complete.

## 6. Add Gmail Events

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
  -> optional private status
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
- Set `waitingOn` when you or another party must act.
- Send a private status only when BacBan changed or you need attention.

## 7. Codex Execution Options

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

## 8. Recovery Checks

If a message arrives but BacBan does not change:

1. Check `http://127.0.0.1:3001/health`.
2. Check OpenCLAW status.
3. Check Gmail watch status.
4. Check whether the webhook reached the handler.
5. Check the assistant run output.
6. Check whether the message was informational and correctly handled as no-op.

If private status fails but BacBan changed, treat notification recovery separately. The board write remains the source of truth.
