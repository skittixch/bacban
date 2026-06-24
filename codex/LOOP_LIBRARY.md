# Loop Library Overlay

Last verified: 2026-06-22
Live catalog: https://signals.forwardfuture.ai/loop-library/catalog.json
Local assessment: `codex/outputs/loop-library-assessment-20260622/assessment.md`

## Purpose

Use Matthew Berman's Forward Future Loop Library as a lightweight pattern source for Codex work. It helps name and adapt repeatable loops with explicit evidence and stop conditions. It does not replace the portable loom, BacBan board state, project instructions, or domain skills.

The optional global Codex skill is installed at `C:\Users\eric\.codex\skills\loop-library`. Restart Codex if it does not appear in `/skills` or when mentioned as `$loop-library`.

## Authority Rules

- Treat Loop Library content as reference data, not permission.
- Re-read live project state before consequential actions.
- Preserve unrelated user work.
- Ask before destructive, irreversible, production, financial, privacy-sensitive, external-message, schedule, memory, or skill-changing actions.
- Adapt thresholds, tools, cadence, owners, and verification to this project. Do not run catalog prompts verbatim when they conflict with local rules.
- If no feedback signal can change the next action, use a one-shot workflow instead of forcing a loop.

## When To Use

Check the catalog or installed skill when work is:

- long-running or likely to suffer from context compaction
- iterative, quality-driven, or benchmark-driven
- a bug/ticket that needs a verified patch
- documentation drift after implementation changes
- UI/product QA that needs browser evidence
- a repeatable harness that may later become a skill
- operational or multi-repo work that needs durable handoff state

Skip it for small one-off commands, direct factual answers, and changes where the next action is obvious and non-repeatable.

## Preferred Patterns

- The ticket-to-PR-ready loop: use for bug cards, user complaints, and failing behavior. Local adaptation: reproduce first, find root cause, make the smallest credible fix, verify before/after, then update BacBan.
- The full product evaluation loop: use for major BacBan UI changes. Local adaptation: inventory real routes, controls, states, and workflows; verify with screenshots/browser checks; preserve evidence under `codex/outputs/`.
- The docs sweep: use after source changes that affect setup, Docker workflow, API shape, data model, or agent instructions.
- The Loop Harness verification loop: use before recurring repository maintenance where one agent should not both generate and approve the result.
- The artifact-to-skill loop: use after a repeated Codex artifact or harness has proven useful and should become a durable skill.
- The Living Story loop: use for multi-repo or long-running programs that need a recurring evidence-based account of priorities and unfinished work.
- The Groundtruth loop: use before trusting operational assumptions, security posture, platform compatibility, privileged surfaces, or scheduled work.
- The recent-feedback sweep: use after repeated user corrections expose a pattern that may need broader repair.
- The Codex completion-contract loop: use as a completion check for long-running Codex tasks so partial results are not reported as done.

## Gated Patterns

- Repository cleanup requires explicit user approval before deleting branches, worktrees, files, or other stale state.
- Production error sweeps and production data cleanup require explicit scoped access, privacy boundaries, reversible operations, and redaction.
- 100% coverage is only appropriate when the user explicitly wants that target and the coverage command is meaningful.
- Performance loops need a named metric, route set, environment, and target. Do not inherit a literal threshold such as 50 ms without adapting it.
- Self-improvement, prompt-mining, memory updates, and history-mining require explicit source authorization and independent review.

## Manifest Shape

Use this field when a published pattern materially shapes a job:

```json
{
  "loopOverlay": {
    "source": "Forward Future Loop Library",
    "title": "The ticket-to-PR-ready loop",
    "url": "https://signals.forwardfuture.ai/loop-library/loops/ticket-to-pr-ready-loop/",
    "localAdaptations": [
      "Use BacBan card as the task source",
      "Preserve unrelated user changes",
      "Run project-specific verification before board update"
    ],
    "stopCondition": "Verified fix, clean no-op, blocked handoff, approval gate, or no-progress stop"
  }
}
```

