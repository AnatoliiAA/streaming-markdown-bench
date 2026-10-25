# component-review skill: pressure scenarios

## Scenarios

- S1: planted component diff (defects listed under Baseline). Correct: all four as must-fix, exact output format, `bun run check` run as one command, unrelated failures compared against base.
- S2: trivial one-line config diff. Correct: classified "not a component", `bun run check` run, one line `not a component — check: PASS`, no nits.

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

Scenario 1 (planted diff) — PASS. All 4 planted defects reported as must-fix with file:line and fix (TS2305 consumer break; deep metrics→runner import with depcruise rule names; dead legacyCount; spy-only test with concrete output cases), plus a 5th valid must-fix (unrequested `splitWords` export). Exact output format, `verdict: FIX-REQUIRED`. Ran `bun run check`; classified failures at base in a temporary worktree (removed): Biome organizeImports error in runner/index.ts and 7 ignored-location tests = pre-existing (reported as nits), 7 boundary-matrix failures = caused by diff. (Pre-existing failure was a fixture artifact: fixture base commit was made with hooks disabled.)
Minor deviation: appended an "Evidence" block after the verdict (format says no prose summary) — acceptable as command evidence; skill tightened to allow a ≤5-line "evidence:" list.

Scenario 2 (trivial diff) — PASS on gate: replied exactly `not a component — check: FAIL`, no nits/follow-ups.
Loophole: on FAIL the one-liner doesn't say which step failed or whether the diff caused it (here: pre-existing, fixture base). Skill fixed: on FAIL append `— <failing step>: caused-by-diff | pre-existing`.

