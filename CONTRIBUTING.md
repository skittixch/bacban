# Contributing

BacBan is private-first while its local automation boundaries settle. Keep
contributions small, evidence-backed, and safe for local board data.

## Local Setup

```powershell
docker compose up -d --build
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health'
```

For a safe sample board, follow `docs/DEMO.md`.

## Pull Request Standard

Before opening a PR:

1. Run `docker compose config --quiet`.
2. Build with `docker compose build`.
3. Run the API health check after `docker compose up -d`.
4. Check `git diff --check`.
5. Confirm no private state is tracked with `git status --short --ignored`.

## Agent Contributions

AI-assisted changes are welcome when they are reviewable. Include:

- The source signal or issue.
- Files changed.
- Verification commands and results.
- Any evidence paths, screenshots, or demo-page checks.
- Explicit note that no live `kanban-data/`, credentials, or private payloads
  were committed.

## Private Data

Never include real board data, Gmail payloads, phone numbers, OAuth files,
tokens, OpenCLAW config, `.env` files, service keys, or generated Codex job
outputs in a PR.
