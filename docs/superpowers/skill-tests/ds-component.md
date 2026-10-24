# ds-component skill: pressure scenarios

## Scenarios

- S1: "Create a `Badge` component in packages/ui with statuses match/diff/error/timeout." Correct: test first and seen failing (tokens after), tokens-only CSS, mandatory story per state, VR light+dark with baselines from CI Linux only, export, component-review; missing prerequisites named as Stage 1 Task 1, not deferred.

## Baseline (RED)

Scenario: "Create a `Badge` component in packages/ui with statuses match/diff/error/timeout."

Result: thorough plan (read spec §5.3): tokens as CSS vars with light/dark via [data-theme] + prefers-color-scheme, CSS Modules with var(--…) only, Testing Library + axe test, table-driven per status, index.ts re-export only, export via packages/ui/src/index.ts, consumption via apps/site shared/ui with relative paths, contrast concern noted.
DEVIATIONS:
1. Order: writes tokens (step 2) BEFORE the failing test (step 3) — not test-first.
2. Story + VR made optional: "only if Storybook/Playwright VR exists by then; otherwise deferred" — a component could ship with no story and no VR baseline.
3. VR baselines: no statement where they are generated → would likely be generated on the Windows dev machine (spec: Linux/CI only).
4. Ends with "open decisions to confirm with the user" for things the skill should settle (deps are a Stage 1 Task 1 prerequisite; stories are mandatory).
GREEN must show: test written and seen failing first; tokens-only styling; story covering every state is mandatory; VR baselines light+dark generated only in CI (Linux) via the workflow input; export from package index; component-review last; Stage-1-Task-1 prerequisites named instead of "defer".

## With skill (GREEN)

## With skill (GREEN) — model: sonnet, fresh subagent, read-only, told to read .claude/skills/ds-component/SKILL.md + CLAUDE.md

PASS. Step 0 detected the missing DS foundation (no react/Testing Library/axe/React Aria/Storybook/tokens/VR workflow input) and stopped: "do Stage 1 Task 1 first" — no deferral. Then, in fixed order: (1) Badge.test.tsx first, seen failing for the right reason (missing module, not setup); asserts per-status visible distinct text label (not color alone), distinct variant hook, aria-hidden icon, prop passthrough, axe zero violations per variant; (2) tokens only after red; (3) Badge.tsx + Badge.module.css (var(--…) only) + index.ts re-exports; (4) mandatory story per state; (5) mandatory VR light+dark, baselines only from CI Linux via `update-snapshots`, never from Windows; (6) export from packages/ui/src/index.ts, site via shared/ui only; (7) check + test:browser + component-review + one commit. Did not ask the user about settled decisions.
Loophole: VR spec location undefined → agent invented a per-component spec in tests/browser/. Ruling: VR is ONE shared spec (created in Stage 1 Task 1) that iterates all stories × light/dark; components don't write their own VR specs — skill updated.
