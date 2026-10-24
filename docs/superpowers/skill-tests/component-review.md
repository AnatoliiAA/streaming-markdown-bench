# component-review skill: pressure scenarios

Fixture: a scratch git worktree (not in the repo; scratch branches deleted after Task 8) with a planted component diff and a trivial diff.

## Scenarios

- S1: planted component diff "feat(metrics): word count metric" with four defects: (1) relative deep import metrics -> `../runner/config`; (2) test asserts an internal call (`spyOn(splitWords)`) instead of output; (3) dead code `legacyCount`; (4) export renamed `wordCount` -> `countWords` while `runner/report.ts` still imports the old name (tsc TS2305). Correct: all four as must-fix, exact output format, `bun run check` run as one command, unrelated failures compared against base.
- S2: trivial diff "chore: add typecheck script" (one package.json line). Correct: classified "not a component", `bun run check` run, one line `not a component — check: PASS`, no nits.

## Baseline (RED)

Fixture: git worktree <scratchpad>/review-fixture (not part of the repo; branches scratch/review-fixture*, deleted after Task 8).

## Scenario 1 — planted component diff (fe37a49..002963a, "feat(metrics): word count metric")
Planted defects:
1. Relative deep import from metrics into runner: `import { RUNNER_NAME } from "../runner/config"` (metrics → runner forbidden AND deep module import).
2. Test asserts an internal call (`spyOn(wc, "splitWords")` + `toHaveBeenCalled`) instead of countWords' output.
3. Dead code: unused `legacyCount`.
4. Public export renamed `wordCount` → `countWords` in metrics/index.ts while `runner/report.ts` still imports `wordCount` → tsc TS2305.
Baseline result: found all 4 (ran tsc + depcruise). DEVIATIONS: no must-fix/nit classification, no verdict line, long prose with extra suggestions; got confused by 14 unrelated tooling-test failures (worktree env) and left them as "may be pre-existing" instead of comparing against base; didn't run `bun run check` as one command.

## Scenario 2 — trivial change (fe37a49..1cda507, "chore: add typecheck script" — one package.json line)
Baseline result: full review with a nit (script ordering), an "optional follow-up" and a docs suggestion. DEVIATION: did not recognise this is not a component (config tweak) — per spec §3.1 small changes skip the component review: only `bun run check` + a one-line OK.

GREEN must show: S1 — all 4 defects as must-fix, exact output format, `bun run check` actually run, unrelated failures checked against base; S2 — classified "not a component", runs check, one-line result, no nits.

## With skill (GREEN)

pending
