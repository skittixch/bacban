# GitHub Publishing

This repository is ready to be treated as a real local Git project. The default
safe publishing path is a private repo at `skittixch/bacban`, followed by a
separate public-release sanitization pass if BacBan should become public OSS.

## Recommended Release Path

Default to a private GitHub repo first. The project contains reusable code and
docs, but some tracked continuity files are intentionally local/operator-specific.
A public release needs an explicit sanitization pass before changing visibility.

Use this split:

- Private repo: OK for the current local project after checking ignored private state is not tracked.
- Public repo: OK only after replacing local paths, account-specific runbooks, and operator-specific workflow notes with generic templates.
- Demo: safe to publish from `demo/kanban-data.demo.json`; do not publish `kanban-data/`.

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

For public release, also inspect or sanitize tracked local-continuity files:

- `codex/GMAIL_BACBAN_RUNBOOK.md`
- `codex/LOOP_LIBRARY.md`
- `AGENTS.md`
- `AGENT.md`
- any docs containing real local paths, account names, phone numbers, project IDs, or private workflow details

Options for public release:

- Keep those files out of the public branch.
- Replace them with `.example.md` templates.
- Move private instructions to an ignored local folder.
- Publish private first and open-source only after a dedicated review.

## Current Target

Default target:

- Owner: `skittixch`
- Name: `bacban`
- Visibility: private first
- License: all rights reserved/private preview until an explicit OSS license is chosen

Do not overwrite `skittixch/kanban`; that existing public repo is not the BacBan
project.

## Demo and Onboarding Files

The GitHub repo should include:

- `README.md`
- `docker-compose.yml`
- `demo/kanban-data.demo.json`
- `docs/index.html`
- `docs/DEMO.md`
- `docs/ONBOARDING.md`
- `docs/API.md`
- `docs/CODEX_GMAIL_SETUP.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`
- `.github/workflows/pages.yml`
- app source under `kanban-backend/` and `kanban-frontend/`

The repo should not include:

- `kanban-data/`
- OAuth secrets or token caches
- OpenCLAW config
- Gmail event payloads
- generated Codex job outputs with private mail/task content

## Create and Push With GitHub CLI

After the private repo exists or the CLI is authenticated:

```powershell
gh repo create skittixch/bacban --private --source . --remote origin --push
```

For a public repo, use `--public` only after confirming no private data is
tracked and a license choice has been made.

## Push With Existing Empty Remote

```powershell
git remote add origin git@github.com:skittixch/bacban.git
git branch -M main
git push -u origin main
```

## After Publishing

Verify the GitHub file list in the browser. The published repo should include
app source, Docker config, root docs, demo data, onboarding docs, community
files, issue templates, CI, and the Pages demo. It should not include live board
data or local credential/config files.

Run the published clone from a separate folder:

```powershell
git clone <published-repo-url> bacban-smoke-test
cd bacban-smoke-test
docker compose up -d --build
Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health'
```

Then seed the demo using `docs/DEMO.md` and confirm `http://localhost:3000`
shows populated Work and Life boards.

## Repo Settings After First Push

Recommended GitHub settings:

- Set the repository description to: `Local-first kanban for human task tracking and bounded AI-agent writeback.`
- Add topics: `kanban`, `local-first`, `codex`, `ai-agents`, `workflow-automation`, `docker`, `react`.
- Keep visibility private until public sanitization is complete.
- Keep the Pages workflow manual until the repo visibility/plan supports GitHub Pages. On the current private repo, GitHub reports that Pages requires either making the repo public or upgrading the account.
- Add branch protection on `main` after CI is green.
- Enable Dependabot security updates and secret scanning where available.
