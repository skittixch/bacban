# Agent Ledger

This folder holds local, private runtime evidence for inbound assistant events.

Tracked files in this folder document the ledger. Runtime JSONL files are ignored by Git because they can contain private Gmail, WhatsApp, board, and workflow metadata.

Default event log:

```text
codex\agent-ledger\events.jsonl
```

Append records through:

```powershell
.\codex\event-intake\Write-AgentLedgerEvent.ps1 -PayloadJson '<json>' -Source gmail -Gateway openclaw
```

Do not store raw email bodies, OAuth tokens, API keys, service-account keys, WhatsApp session data, or full message dumps in this folder.
