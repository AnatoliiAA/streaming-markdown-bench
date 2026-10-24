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

pending
