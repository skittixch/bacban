# Security Policy

## Supported Versions

BacBan is currently a private-preview local tool. Security fixes target the
default branch first.

## Reporting a Vulnerability

Do not open a public issue for a vulnerability that includes live board data,
OAuth details, webhook payloads, local network details, credentials, or private
workflow content.

Report privately to the repository owner. Include:

- A short summary of the issue.
- Steps to reproduce with demo data when possible.
- Whether the issue affects local board data, assistant writes, Gmail intake,
  WhatsApp status messages, or deployment configuration.
- Any relevant logs with secrets and personal data removed.

## Security Boundaries

- Live board state belongs in ignored `kanban-data/`.
- OAuth clients, token caches, service-account keys, `.env` files, OpenCLAW
  config, and private Codex job payloads must not be committed.
- Assistants should write through the BacBan API only after backing up the JSON
  data file and reading back changed cards.
- Gmail remains read-only unless the operator explicitly approves a send,
  draft, archive, delete, or label action.
