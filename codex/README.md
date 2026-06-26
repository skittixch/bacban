# Codex Workspace

This folder is for Codex-only artifacts for BacBan.

Use it for:

- job manifests under `jobs/`
- harness scripts that talk to the existing BacBan API
- dry-run logs and evidence under `outputs/`
- screenshots, audits, and temporary notes
- lightweight workflow overlays such as `LOOP_LIBRARY.md`
- durable agent runbooks such as `GMAIL_BACBAN_RUNBOOK.md`
- event intake rules under `event-intake/`
- private runtime event evidence under `agent-ledger/`

Do not put runtime app code here unless the user explicitly asks for a BacBan feature that belongs in the product.

Read `GMAIL_BACBAN_RUNBOOK.md` before changing the Gmail-triggered BacBan triage path, OpenCLAW/Gmail hook setup, Telegram cutover or notification behavior, Codex native-hook assumptions, or future Codex SDK / `codex exec` replacement work.

Read `event-intake/event-rules.md` before changing inbound Gmail, WhatsApp, OpenCLAW, or future listener behavior. Append incoming event evidence with `event-intake/Write-AgentLedgerEvent.ps1`; keep runtime `agent-ledger/*.jsonl` files private and ignored.
