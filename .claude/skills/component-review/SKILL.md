---
name: component-review
description: Use after finishing a component (DS component, bench detector/adapter/runner pass, FSD slice) and before committing it — fast three-axis review: regressions, code quality, architecture
---

# Component review

One fast pass over a finished component, in a fresh context. You are read-only on the working tree: never edit code, never "fix as you go". The implementer fixes; the review is then re-run on the fix only.

## Step 0 - Gate: is it a component?

Decide first, from the diff. When unsure whether it is a component, treat it as one (full review).

| Component (review it) | Not a component (no review) |
| --- | --- |
| DS component (`Slider`), bench detector, adapter, runner pass, FSD slice (`features/replay-speed`) | Config tweak, copy change, a prop added to an existing component, one-line script |

Not a component: run `bun run check` (plus `bun run test:browser` per Axis 1), reply with exactly one line and stop. No nits, no follow-ups, no suggestions. On FAIL, classify the failure with the base procedure below.

```
not a component — check: PASS
not a component — check: FAIL — <failing step>: caused-by-diff | pre-existing
```

- When the diff hits the `test:browser` trigger paths (Axis 1), append `; test:browser: PASS | FAIL | not run (<reason>)` to the same line. Still one line, no evidence block.
- `caused-by-diff`: the implementer fixes it and the gate is re-run on the fix (still no full review). `pre-existing`: does not block the change, but report it to the controller/author.

## Inputs

- The diff: `git diff --staged` (base = `HEAD`), or a commit range `git diff <base>..<head>` (base = the range's first commit's parent, as given). The base worktree below is created at that base.
- The plan task text (requirements the component must meet).

## Axis 1 - Regressions

| Check | How |
| --- | --- |
| Everything green | Run `bun run check` as ONE command (`biome ci . && tsc -b && bun test && bun run lint:arch`). Run `bun run test:browser` (not part of check) when the diff touches `packages/ui/**`, `apps/site/**`, `tests/browser/**` or `playwright.config.ts`. If it cannot run (no browser installed), say so in `evidence:`; never skip silently. |
| Public API | `git diff` on every `index.ts`: for each renamed/removed/changed export, grep all consumers; a stale consumer is a break (`tsc` shows it) |
| Outside behavior | Files changed outside the component are justified by the task |

### Failure you think is unrelated to the diff

Do not guess. A failure counts as pre-existing only after it was reproduced at base; never classify without running it there.

1. `git worktree add <tmp> <base>` (a path outside the repo) and `bun install --frozen-lockfile` there.
2. Run just the failing test/command in `<tmp>`.
3. `git worktree remove --force <tmp>`.

Fails at base too = pre-existing: report ONE nit line, not must-fix. Passes at base = caused by the diff: must-fix.

## Axis 2 - Code quality

Findings are about code in the diff only; pre-existing issues outside the diff are out of scope.

- [ ] Naming: clear, matches repo conventions
- [ ] Size: no oversized function/file; one responsibility
- [ ] Duplication: no copy of existing code in the repo
- [ ] Dead code: no unused exports, variables, branches, imports
- [ ] Error handling exactly where the spec/task requires it, not elsewhere
- [ ] Tests assert behavior (output, rendered result), not internals (`spyOn` + `toHaveBeenCalled` on a helper is a defect)

## Axis 3 - Architecture

Load `project-architecture` and check:

- [ ] Code is in the right module/layer (its "What goes where" table)
- [ ] Imports follow its direction table, and only through public `index.ts` (no relative deep import into another module/package)
- [ ] `index.ts` is re-exports only; logic is in its own file
- [ ] Matches the sibling components' pattern (open 1-2 neighbours: file layout, naming, export style, test placement)
- [ ] No raw colors/sizes in `packages/ui` (tokens only). No lint rule yet: this review is the check.

`bun run lint:arch` failing because of the diff is a must-fix; never accept silenced rules or config edits as the fix.

## Severity

| must-fix | nit |
| --- | --- |
| Build, type, lint or arch failure caused by the diff | Style preference, naming taste |
| Test that asserts no behavior | Cosmetic ordering, comment wording |
| Public-API break (a consumer not updated) | Pre-existing failure (one line) |
| Dead code | |
| Spec/task requirement missing | |

## Output format (exact)

```
## Review: <component>
must-fix:
- <file:line> <problem> → <fix>
nit:
- <file:line> <problem>
verdict: PASS | FIX-REQUIRED
evidence: (optional, ≤ 5 lines: commands run + PASS/FAIL)
```

- `PASS` only when must-fix is empty (write `- none`); otherwise `FIX-REQUIRED`.
- One pass, at most 15 findings, one line each. If more, keep all must-fix first, then truncate nits. No prose summary, no "optional follow-ups", no praise section. `evidence:` is a command list, not a summary.

## Rules

- Must-fix items are fixed before the commit; nits only if cheap.
- After fixes, re-run the review on the fix only (the new diff), not the whole component.
- Never edit code, config or lint rules as the reviewer.
