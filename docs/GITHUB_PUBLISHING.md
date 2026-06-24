# GitHub Publishing

This repository is ready to be treated as a real local Git project. Publishing still needs an explicit decision about repo owner/name, visibility, and license.

## Before Creating a Remote

Run:

```powershell
git status --short --ignored
git ls-files
git diff --check
```

Confirm these are not tracked:

- `kanban-data/`
- OAuth secrets
- OpenCLAW config
- service account keys
- token caches
- `.env` files
- `codex/jobs/`
- `codex/outputs/`
- `kanban-frontend/node_modules/`
- `kanban-frontend/build/`

Do not use `git add -f` on ignored private state.

## Repo Choices Needed

Choose:

- Owner: personal account or organization.
- Name: suggested `bacban`.
- Visibility: private by default unless you intentionally want a public release.
- License: leave unlicensed/private by default, or add a chosen OSS license before public release.

## Push With GitHub CLI

After the choices above are made:

```powershell
gh repo create <owner>/bacban --private --source . --remote origin --push
```

For a public repo, use `--public` only after confirming no private data is tracked and a license choice has been made.

## Push With Existing Empty Remote

```powershell
git remote add origin git@github.com:<owner>/bacban.git
git branch -M main
git push -u origin main
```

## After Publishing

Verify the GitHub file list in the browser. The published repo should include app source, Docker config, root docs, `AGENTS.md`, and `codex/GMAIL_BACBAN_RUNBOOK.md`; it should not include live board data or local credential/config files.
