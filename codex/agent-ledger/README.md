# Agent Ledger

This folder holds local, private runtime evidence for inbound assistant events.

Tracked files in this folder document the ledger. Runtime JSONL files are ignored by Git because they can contain private Gmail, WhatsApp, board, and workflow metadata.

Default event log:

```text
codex\agent-ledger\events.jsonl
```

Backend board-change evidence:

```text
codex\agent-ledger\board-events.jsonl
codex\agent-ledger\deleted-cards.jsonl
codex\agent-ledger\deleted-card-feedback.jsonl
codex\agent-ledger\collection-routing.jsonl
```

`board-events.jsonl` is appended after successful full-state BacBan writes that
create, update, move, reorder, complete, reopen, or delete cards. `deleted-cards.jsonl`
holds compact tombstones for deleted top-level cards so future inbox intake can
check whether a candidate email looks like something the owner already trashed.
`deleted-card-feedback.jsonl` holds optional reasons entered from the delete
toast, such as "newsletter noise"; those reasons are included in deleted-card
similarity checks.
`collection-routing.jsonl` holds compact Work/Life cross-board move hints so
future intake can route similar cards to the owner-corrected collection.

Append records through:

```powershell
.\codex\event-intake\Write-AgentLedgerEvent.ps1 -PayloadJson '<json>' -Source gmail -Gateway openclaw
```

Do not store raw email bodies, OAuth tokens, API keys, service-account keys, WhatsApp session data, or full message dumps in this folder.
