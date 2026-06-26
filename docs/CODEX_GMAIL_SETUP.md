# Codex Gmail Setup

This guide documents the supported ways to connect Gmail Pub/Sub events to BacBan and Codex. It is written to keep reusable project setup in Git while keeping account names, OAuth secrets, OpenCLAW config, token caches, and private board data out of Git.

## Architecture Options

### Current Local Path

The current working path is:

```text
Gmail Pub/Sub watch
  -> Pub/Sub push subscription
  -> gog/OpenCLAW webhook listener
  -> OpenCLAW hook mapping
  -> Codex triage run in this repo
  -> BacBan API write/readback
  -> optional private Telegram summary
```

Use this path when you want the same local-authenticated Codex behavior that is already working on this machine.

### Native Codex Alternatives

Codex hooks are lifecycle hooks inside a Codex run. They can run scripts on events such as `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `PostCompact`, and `Stop`, but they are not an inbound webhook server for Gmail.

If OpenCLAW is replaced later, keep the same source-of-truth shape:

```text
Gmail Pub/Sub listener
  -> local handler
  -> codex exec or Codex SDK
  -> BacBan API write/readback
  -> optional notification channel
```

Use `codex exec` for a simple non-interactive script path. Use the Codex SDK when a real service needs to create/resume Codex threads programmatically and manage sandbox settings. Use the App Server only when you need lower-level JSON-RPC control.

## Gmail Pub/Sub Requirements

Gmail push notifications require Google Cloud Pub/Sub. At a high level:

1. Create or select a Google Cloud project.
2. Enable the Gmail API and Cloud Pub/Sub API.
3. Create a Pub/Sub topic, for example `projects/<project-id>/topics/gmail-watch`.
4. Grant Pub/Sub publish permission on that topic to:

```text
gmail-api-push@system.gserviceaccount.com
```

5. Create a Pub/Sub subscription. For this local workflow, use a push subscription whose endpoint is an HTTPS URL that reaches your local listener, such as a Tailscale Funnel URL or another HTTPS tunnel.
6. Authenticate the Gmail account with a Gmail OAuth scope that can call `users.watch` and read enough mailbox context for triage.
7. Call `users.watch` with the topic name and `labelIds: ["INBOX"]`.
8. Renew the watch at least every seven days. A daily renewal is safer.

The push payload contains a Pub/Sub message whose `message.data` field is base64url-encoded JSON with the watched `emailAddress` and a Gmail `historyId`. The listener must use Gmail history/message APIs to determine what changed since the last handled history ID.

## OpenCLAW/gog Setup Shape

Keep concrete account names and secrets in local config, not in this repository.

Expected local pieces:

- Google Cloud project with Gmail API and Pub/Sub API enabled.
- OAuth client credentials for the Gmail account.
- `gog` authenticated to the Gmail account.
- OpenCLAW webhook listener reachable by Pub/Sub push.
- OpenCLAW hook mapping with a stable id such as `gmail-bacban-triage`.
- Codex running in the BacBan repo root.

Useful verification commands:

```powershell
gog gmail watch status --account <gmail-account> --json --no-input
openclaw config validate
openclaw status --json
docker compose ps
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health'
```

The hook prompt should require:

- Gmail read-only unless the user explicitly approves Gmail send, draft, archive, delete, or label changes.
- BacBan writes only through the live API after backing up `kanban-data\kanban-data.json`.
- Full API readback after writes.
- Update/create/move/complete/reopen cards as emails require.
- Set `updatedAt` on every agent change.
- Set `doneAt` only when moving a card to done/completed.
- Set `waitingOn` when Eric or another party needs action.
- Send a concise private Telegram summary only when BacBan changed or Eric's attention is needed.

## BacBan Write Contract

Use this sequence for automated board writes:

1. Verify `http://127.0.0.1:3001/health`.
2. Back up `kanban-data\kanban-data.json`.
3. GET the full state from `http://127.0.0.1:3001/api/data`.
4. Modify only the relevant cards.
5. Validate JSON.
6. POST the full updated state to `/api/data`.
7. Verify health again.
8. Read back the touched card or cards.

Prefer updating an existing relevant card over creating a duplicate. Create a new visible card when an email is clearly a separate task.

## Codex Exec Sketch

This is the simplest replacement shape for the OpenCLAW mapping. The listener still receives Pub/Sub and resolves the Gmail message context; Codex handles triage and board edits.

```powershell
Push-Location <repo-root>

$payload = Get-Content .\event.json -Raw
$prompt = @"
You are handling one Gmail-triggered BacBan triage event.

Repo: <repo-root>
Rules: read AGENTS.md and codex/GMAIL_BACBAN_RUNBOOK.md first.
Event JSON:
$payload

Determine whether BacBan needs a card create/update/move/completion.
Keep Gmail read-only unless explicit user approval is present.
Use the BacBan API write contract and verify readback.
"@

try {
  codex exec --sandbox workspace-write "$prompt"
} finally {
  Pop-Location
}
```

For a service process, use the Codex SDK instead of shelling out if you need thread reuse, structured control, or sandbox selection from application code.

## Notification Boundary

The approved notification behavior is narrow:

- OK: private Telegram summary to Eric when a Gmail-triggered BacBan change occurred or Eric needs to look at an email.
- The message should say who is waiting on Eric and what they need him to do.
- Not OK without explicit approval: Gmail sends, Gmail drafts, Gmail archive/delete/label changes, messages to third parties, or unrelated outbound notifications.

## Recovery Checks

If Gmail mail arrives but BacBan does not change:

1. Check Pub/Sub/watch status.
2. Check OpenCLAW/gog listener status.
3. Check whether the event reached the hook mapping.
4. Check Codex run output.
5. Check BacBan API health and write/readback.
6. Check whether the email was informational and correctly treated as no-op.

If Telegram fails, treat that separately from BacBan. A notification failure does not mean the board write failed. Until the Telegram cutover is proven end to end, the existing WhatsApp fallback remains the live status path.

## Source Docs

- Gmail push notifications: https://developers.google.com/workspace/gmail/api/guides/push
- Pub/Sub push subscription authentication: https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex SDK: https://developers.openai.com/codex/sdk
- Codex CLI: https://developers.openai.com/codex/cli

For a broader first-run path that includes BacBan, Telegram status, Gmail events, and the assistant write contract, see `docs/ONBOARDING.md`.
