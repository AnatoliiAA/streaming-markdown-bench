# Stage 0 — Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public GitHub repo where one command (`bun run check`) lints, formats, type-checks, tests and enforces architecture boundaries, CI runs the same on every PR, and three project skills (`project-architecture`, `component-review`, `ds-component`) encode how the rest of the project is built.

**Architecture:** Bun workspaces monorepo with empty-but-real skeletons for `packages/ui`, `packages/bench` (5 domain modules) and `apps/site` (FSD layers). Tooling is test-driven like code: every rule (format, types, boundaries, hooks) gets a red case that must fail before the config is written, then goes green. Skills are written per `superpowers:writing-skills`: a baseline subagent run without the skill fails a pressure scenario, the same run with the skill passes.

**Tech Stack:** Bun (runtime, workspaces, `bun test`), Biome 2.x, TypeScript (`tsc -b`), happy-dom, Playwright (Chromium), steiger (FSD linter), lefthook, GitHub Actions, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-10-24-workflow-and-architecture-design.md` (read §3–§5). Product context: `docs/superpowers/specs/2026-10-24-streaming-markdown-bench-design.md`.

## Global Constraints

- Package names: `@smb/ui`, `@smb/bench`, `@smb/site`, all `"private": true`. Root package `streaming-markdown-bench`.
- Workspaces: `apps/*`, `packages/*`. Pin Bun exactly via the root `"packageManager": "bun@<installed version>"`. Pin Biome to an exact version (no `^`).
- TS: `strict: true`, `noUncheckedIndexedAccess: true`.
- `check` = `biome ci . && tsc -b && bun test && bun run lint:arch`. It must pass from a path containing spaces (the dev path is `E:\Web Development\agents-benchmark`).
- Line endings: LF everywhere (`.gitattributes`: `* text=auto eol=lf`; Biome `lineEnding: "lf"`).
- Import directions (spec §5.2):
  - Cross-package: `site → ui`, `site → bench`, `bench → ∅`, `ui → ∅`.
  - Inside bench: `runner → harness, metrics, corpus`; `harness → adapters, metrics`; `metrics → ∅`; `corpus → ∅`; `adapters → ∅`.
  - No deep imports across modules or packages: import only through the module's `index.ts` / the package name.
  - Site follows FSD 2.x, checked by steiger.
- Playwright files use the suffix `.pw.ts`, so that `bun test` (which picks up `*.test.ts` and `*.spec.ts`) never runs them.
- Git: work happens on branch `chore/workflow`. Never push to `main` after Task 1; `main` changes only through a PR merged by the author.
- Commit after every task with a conventional-commit message ending in the `Co-Authored-By` line from the session's attribution rules.
- Review: Tasks 1–6 are reviewed with the default reviewer of `superpowers:subagent-driven-development`. From Task 7 on, the reviewer also loads `.claude/skills/component-review`.

## Review Focus

1. **Fresh clone on another machine.** Expected: `bun install` alone installs the git hooks and `bun run check` passes → Task 3 test `fresh clone installs hooks`.
2. **CRLF sneaking in from Windows** (`core.autocrlf=true` on the dev machine). Expected: nothing in the index has CRLF, so CI format checks don't fail on line endings → Task 1 verification `git ls-files --eol`.
3. **Generated folders** (`dist`, `storybook-static`, `playwright-report`, `test-results`, `results/`, `corpus/cases/`). Expected: Biome ignores them; a badly formatted file there doesn't fail `check` → Task 2 test.
4. **Relative deep imports between bench modules** (`../metrics/flips` from `runner`). Expected: rejected the same way as package deep imports → Task 4 test matrix row.
5. **Lockfile drift.** Expected: CI uses `--frozen-lockfile` and fails if `bun.lock` is stale or missing; `bun.lock` is committed → Task 6 CI step + Task 1 commit list.

---

## File Structure

```
.gitattributes, .gitignore, package.json, bun.lock, bunfig.toml, tsconfig.base.json, tsconfig.json
biome.json                       format + lint + import-boundary rules
lefthook.yml                     pre-commit: biome check --staged
playwright.config.ts             testDir tests/browser, testMatch **/*.pw.ts, chromium only
CLAUDE.md                        commands, stage map, process, skills index
tests/setup/happy-dom.ts         bun test preload
tests/tooling/                   tests of the tooling itself
  workspace.test.ts              cross-package resolution, DOM preload
  format.test.ts                 biome rules incl. ignored folders
  hooks.test.ts                  lefthook installed on fresh clone
  boundaries.test.ts             import-rule matrix
  run.ts                         helper: run a command, return { code, stdout, stderr }
tests/browser/smoke.pw.ts        Playwright under Bun
packages/ui/{package.json,tsconfig.json,src/index.ts}
packages/bench/{package.json,tsconfig.json,src/index.ts,src/{corpus,metrics,adapters,harness,runner}/index.ts}
apps/site/{package.json,tsconfig.json,src/app/index.ts,src/shared/ui/index.ts}
.claude/skills/project-architecture/SKILL.md
.claude/skills/component-review/SKILL.md
.claude/skills/ds-component/SKILL.md
docs/superpowers/skill-tests/<skill>.md   pressure scenarios + baseline/with-skill results
.github/workflows/ci.yml
```

---

### Task 0: Prerequisites (author, manual)

The agent doesn't do these steps. The author runs them, then confirms in chat.

- [ ] Install Bun: `powershell -c "irm bun.sh/install.ps1 | iex"`, then open a new terminal. Expected: `bun --version` prints ≥ 1.2.
- [ ] Install GitHub CLI: `winget install --id GitHub.cli`. Expected: `gh --version` prints a version.
- [ ] `gh auth login` (GitHub.com, HTTPS, browser). Expected: `gh auth status` shows "Logged in".

---

### Task 1: Repo on GitHub + workspace skeleton + types + bun test

**Files:**
- Create: `.gitattributes`, `.gitignore`, `package.json`, `bunfig.toml`, `tsconfig.base.json`, `tsconfig.json`, `tests/tsconfig.json`, `tests/setup/happy-dom.ts`, `tests/tooling/run.ts`, `tests/tooling/workspace.test.ts`
- Create: `packages/ui/*`, `packages/bench/*` (incl. 5 module `index.ts`), `apps/site/*` (per File Structure)

**Interfaces:**
- Produces:
  - `run(cmd: string[], opts?: { cwd?: string }): Promise<{ code: number; stdout: string; stderr: string }>` in `tests/tooling/run.ts` (`Bun.spawn`, cwd defaults to repo root).
  - Each package's `src/index.ts` and each bench module's `index.ts` contains `export {};` (an empty public API, filled in later stages).
  - Each workspace has a `tsconfig.json` with `composite: true` extending `../../tsconfig.base.json`. The root `tsconfig.json` has `files: []` and references all three workspaces plus `tests/tsconfig.json`.

- [ ] **Step 1: Publish the repo.** Ask the author for a one-line OK before this outward-facing step. Then:
  - `gh repo create streaming-markdown-bench --public --source . --remote origin --push` (pushes the existing docs commits on `main`);
  - `git switch -c chore/workflow`.

  Expected: `git remote -v` shows `origin`, and the current branch is `chore/workflow`.
- [ ] **Step 2: Write the failing test** `tests/tooling/workspace.test.ts`

```ts
test("workspace packages resolve by name", async () => {
  for (const p of ["@smb/ui", "@smb/bench"]) expect(await import(p)).toBeDefined();
});
test("DOM globals are preloaded", () => {
  const el = document.createElement("div");
  el.textContent = "x";
  expect(el.outerHTML).toBe("<div>x</div>");
});
```

- [ ] **Step 3: Run** `bun test tests/tooling/workspace.test.ts`. Expected: FAIL (no workspaces, no `document`).
- [ ] **Step 4: Implement** the root config:
  - root `package.json`: `workspaces`, `packageManager`, devDeps `typescript`, `@types/bun`, `@happy-dom/global-registrator`;
  - each workspace `package.json` with `"exports": { ".": "./src/index.ts" }`; `@smb/site` depends on `@smb/ui` and `@smb/bench` via `workspace:*`;
  - `bunfig.toml` `[test] preload = ["./tests/setup/happy-dom.ts"]` (`GlobalRegistrator.register()`);
  - `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `module: "ESNext"`, `moduleResolution: "bundler"`, `target: "ES2023"`, `lib: ["ES2023","DOM","DOM.Iterable"]`, `jsx: "react-jsx"`, `verbatimModuleSyntax`, `skipLibCheck`, `types: ["bun"]`;
  - `.gitattributes`: `* text=auto eol=lf`;
  - `.gitignore`: `node_modules`, `dist`, `storybook-static`, `playwright-report`, `test-results`, `*.tsbuildinfo`.
- [ ] **Step 5: Run** `bun install && bun test tests/tooling/workspace.test.ts`. Expected: PASS.
- [ ] **Step 6: Red-green the type check.** Add `packages/bench/src/tmp.ts` containing `const a: number[] = []; export const x: number = a[0];`. Run `bunx tsc -b`. Expected: error TS2322 (`number | undefined`). Delete the file and run `bunx tsc -b` again. Expected: exit 0.
- [ ] **Step 7: Verify line endings.** Run `git add -A && git ls-files --eol | grep -c "i/crlf"`. Expected: `0`.
- [ ] **Step 8: Commit** (include `bun.lock`) `chore: bun workspaces skeleton, strict TS, bun test with DOM preload`

---

### Task 2: Biome (format + lint) and the `check` script

**Files:**
- Create: `biome.json`, `tests/tooling/format.test.ts`
- Modify: `package.json` (devDep `@biomejs/biome` exact; scripts `check`, `format`, `lint:arch` = `echo "no arch rules yet"`, replaced in Task 4)

**Interfaces:**
- Consumes: `run` (Task 1)
- Produces: root scripts `check` and `format`; Biome config decisions:
  - formatter: `indentStyle: "space"`, `indentWidth: 2`, `lineWidth: 100`, `lineEnding: "lf"`;
  - JS: `quoteStyle: "double"`, `semicolons: "always"`, `trailingCommas: "all"`;
  - linter: `recommended: true`;
  - `files.includes` excludes `**/dist`, `**/storybook-static`, `**/playwright-report`, `**/test-results`, `results`, `corpus/cases`;
  - `vcs.useIgnoreFile: true`.

- [ ] **Step 1: Write the failing tests** (each test writes a temp file at the given path and deletes it in `finally`)

```ts
test("badly formatted source fails biome ci", async () => {
  await withFile("packages/bench/src/bad.ts", "export const  a=1", async () =>
    expect((await run(["bunx", "biome", "ci", "packages/bench/src/bad.ts"])).code).not.toBe(0),
  );
});
test("well formatted source passes", async () => {
  await withFile("packages/bench/src/good.ts", 'export const a = "x";\n', async () =>
    expect((await run(["bunx", "biome", "ci", "packages/bench/src/good.ts"])).code).toBe(0),
  );
});
test("generated folders are ignored", async () => {
  await withFile("packages/ui/dist/x.js", "const  a=1", async () =>
    expect((await run(["bunx", "biome", "ci", "."])).code).toBe(0),
  );
});
test("CRLF is rejected", async () => {
  await withFile("packages/bench/src/crlf.ts", 'export const a = "x";\r\n', async () =>
    expect((await run(["bunx", "biome", "ci", "packages/bench/src/crlf.ts"])).code).not.toBe(0),
  );
});
```
(`withFile(path, content, fn)` lives in `tests/tooling/run.ts`; add it there.)
- [ ] **Step 2: Run** `bun test tests/tooling/format.test.ts`. Expected: FAIL (Biome not installed).
- [ ] **Step 3: Implement** `biome.json` and the scripts with the values above. Run `bun run format` once over the repo.
- [ ] **Step 4: Run** `bun test tests/tooling/format.test.ts && bun run check`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `chore: biome format/lint and check script`

---

### Task 3: Pre-commit hook (lefthook)

**Files:**
- Create: `lefthook.yml`, `tests/tooling/hooks.test.ts`
- Modify: `package.json` (devDep `lefthook`; script `"prepare": "lefthook install"`)

**Interfaces:**
- Consumes: `run`, `withFile` (Tasks 1–2)
- Produces: pre-commit runs `bunx biome check --staged --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}`; no auto-fix (the commit fails and the dev runs `bun run format`).

- [ ] **Step 1: Write the failing tests**

```ts
test("fresh clone installs hooks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "smb clone ")); // space in path on purpose
  await run(["git", "clone", "--quiet", repoRoot, dir]); // clones HEAD of the current branch
  expect((await run(["bun", "install"], { cwd: dir })).code).toBe(0);
  expect(existsSync(join(dir, ".git/hooks/pre-commit"))).toBe(true);
}, 120_000);
test("commit with badly formatted staged file is blocked", async () => {
  /* in the same temp clone: write packages/bench/src/bad.ts = "export const  a=1", git add, git commit -m x */
  expect(commit.code).not.toBe(0);
}, 120_000);
```

- [ ] **Step 2: Run** `bun test tests/tooling/hooks.test.ts`. Expected: FAIL (no hook).
- [ ] **Step 3: Implement** `lefthook.yml` and the `prepare` script. A clone only sees committed files, so commit `lefthook.yml` + `package.json` + `bun.lock` as a WIP commit before re-running the test.
- [ ] **Step 4: Run** `bun test tests/tooling/hooks.test.ts`. Expected: PASS. Then run `bun run check`. Expected: exit 0.
- [ ] **Step 5: Commit** (amend the WIP commit or add a follow-up) `chore: lefthook pre-commit with biome`

---

### Task 4: Architecture boundaries (Biome rules + steiger)

**Files:**
- Create: `tests/tooling/boundaries.test.ts`
- Modify: `biome.json` (overrides with `noRestrictedImports`), `package.json` (devDep `steiger`, `@feature-sliced/steiger-plugin`; script `lint:arch`), `apps/site/src/**` skeleton if steiger needs it
- Possibly create: `.dependency-cruiser.cjs` (fallback, see Step 3)

**Interfaces:**
- Consumes: `run`, `withFile`
- Produces: `lint:arch` = `steiger ./apps/site/src`, plus `depcruise` if the fallback is used. The violation matrix below is the contract; the tool behind each row is an implementation detail.

- [ ] **Step 1: Write the failing test matrix.** Each row writes the file, runs the checker, expects a non-zero exit and the file name in the output, then deletes the file.

```ts
const VIOLATIONS: [file: string, source: string, why: string][] = [
  ["packages/ui/src/x.ts", 'import "@smb/bench";', "ui → bench"],
  ["packages/ui/src/x.ts", 'import "@smb/site";', "ui → site"],
  ["packages/bench/src/metrics/x.ts", 'import "@smb/ui";', "bench → ui"],
  ["packages/bench/src/metrics/x.ts", 'import "../runner";', "metrics → runner"],
  ["packages/bench/src/corpus/x.ts", 'import "../metrics";', "corpus → metrics"],
  ["packages/bench/src/adapters/x.ts", 'import "../harness";', "adapters → harness"],
  ["packages/bench/src/harness/x.ts", 'import "../runner";', "harness → runner"],
  ["packages/bench/src/runner/x.ts", 'import "../metrics/flips";', "relative deep import"],
  ["apps/site/src/app/x.ts", 'import "@smb/bench/src/metrics";', "package deep import"],
  ["apps/site/src/entities/a/index.ts", 'import "../../features/b";', "FSD: entities → features"],
];
const ALLOWED: [string, string][] = [
  ["packages/bench/src/runner/x.ts", 'import "../metrics";'],
  ["packages/bench/src/harness/x.ts", 'import "../adapters";'],
  ["apps/site/src/app/x.ts", 'import "@smb/ui";'],
];
test.each(VIOLATIONS)("%s rejects %s (%s)", async (file, src) => {
  /* expect check fails */
});
test.each(ALLOWED)("%s allows %s", async (file, src) => {
  /* expect check passes */
});
```
The checker command is `bunx biome lint <file> && bun run lint:arch`. Imported targets that don't exist (e.g. `features/b`) are created as temporary `export {}` stubs in the same `withFile` scope.
- [ ] **Step 2: Run** `bun test tests/tooling/boundaries.test.ts`. Expected: every `VIOLATIONS` row FAILs (nothing rejects them yet).
- [ ] **Step 3: Implement.**
  - Biome `overrides`: one per source folder, with `noRestrictedImports` (`paths` for package names, `patterns` for relative and deep specifiers) at level `error`.
  - steiger with the FSD plugin for `apps/site/src`.
  - If a row can't be expressed in Biome (expected candidates: relative deep imports), move **all bench and package rules** to `dependency-cruiser` (one tool for boundaries, not split per row): `forbidden` rules mirroring the matrix, plus `lint:arch` += `depcruise packages apps --config .dependency-cruiser.cjs`. Record which tool was chosen, and why, in the commit message.
- [ ] **Step 4: Run** `bun test tests/tooling/boundaries.test.ts && bun run check`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `chore: enforce module and FSD import boundaries`

---

### Task 5: Playwright under Bun

**Files:**
- Create: `playwright.config.ts`, `tests/browser/smoke.pw.ts`
- Modify: `package.json` (devDep `@playwright/test`; script `test:browser`)

**Interfaces:**
- Produces:
  - `test:browser` script (exact runner chosen in Step 4);
  - `playwright.config.ts`: `testDir: "tests/browser"`, `testMatch: "**/*.pw.ts"`, one project `chromium`, `reporter: process.env.CI ? "github" : "list"`, `use.viewport: { width: 1280, height: 800 }`.

- [ ] **Step 1: Write the test** `tests/browser/smoke.pw.ts`

```ts
test("chromium renders and runs JS", async ({ page }) => {
  await page.setContent(
    `<main id="m"></main><script>document.getElementById("m").textContent = "ok"</script>`,
  );
  await expect(page.locator("#m")).toHaveText("ok");
});
```

- [ ] **Step 2: Run** `bunx playwright test`. Expected: FAIL (no config / no browser).
- [ ] **Step 3: Implement** the config, then run `bunx playwright install chromium`.
- [ ] **Step 4: Decide the runner.** Run `bun --bun x playwright test` 3 times in a row.
  - If all 3 pass: `test:browser` = `bun --bun x playwright test`.
  - Otherwise: `test:browser` = `bunx playwright test` (Node).

  Write the outcome (which runner, and the error if Bun failed) into a short "Browser tests" note for `CLAUDE.md` (Task 7).
- [ ] **Step 5: Run** `bun run test:browser` (PASS) and `bun run check` (exit 0, and `bun test` does not pick up `.pw.ts`).
- [ ] **Step 6: Commit** `test: playwright smoke under bun`

---

### Task 6: CI + draft PR

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: workflow `ci`, single job id `check` (the status-check name used for branch protection in Task 10).

- [ ] **Step 1: Write the workflow.**
  - Triggers: `pull_request`, and `push` on `main`.
  - Runner: `ubuntu-latest`.
  - Steps:
    1. `actions/checkout@v4`;
    2. `oven-sh/setup-bun@v2` with `bun-version-file: package.json`;
    3. `bun install --frozen-lockfile`;
    4. `bun run check`;
    5. `bunx playwright install --with-deps chromium`;
    6. `bun run test:browser`;
    7. on failure, upload `playwright-report`.
  - `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true`.
- [ ] **Step 2: Push and open a draft PR.** Run `git push -u origin chore/workflow`, then `gh pr create --draft --title "Stage 0: workflow" --body "<summary + link to this plan>"`. End the body with the PR attribution line. Then bind the PR per the session's PR rules.
- [ ] **Step 3: Verify.** Expected: the `ci / check` job is green on the PR. If it is red, fix it in this task: the most likely causes are lockfile drift and the Playwright runner choice under Linux.
- [ ] **Step 4: Red check.** Push a commit with a badly formatted file (`git commit --no-verify`, only for this deliberate check). Expected: CI red on `bun run check`. Then revert that commit with `git revert`. Expected: CI green.

---

### Task 7: `CLAUDE.md` + skill `project-architecture`

**Files:**
- Create: `CLAUDE.md`, `.claude/skills/project-architecture/SKILL.md`, `docs/superpowers/skill-tests/project-architecture.md`

**Interfaces:**
- Produces:
  - **`CLAUDE.md`** sections:
    - Commands: `check`, `format`, `test:browser`, `lint:arch`;
    - Stage map: link to the spec §2;
    - Process: per-component cycle, spec §3.1 in 7 lines;
    - Skills index: which skill to load when;
    - Browser tests: the outcome note from Task 5;
    - Git rules: branch per stage, never push to `main`, author merges.
  - **`project-architecture` SKILL.md**:
    - frontmatter `name: project-architecture`, `description: Use when creating, moving or importing code anywhere in this repo — decides which package/module/FSD layer code belongs to and which imports are allowed`;
    - body:
      - repo map;
      - decision table "kind of code → location", e.g. pure metric function → `packages/bench/src/metrics`, DS component → `packages/ui/src/components/<Name>/`, site user action → `apps/site/src/features/<slice>`;
      - import direction table (Global Constraints);
      - public-API rule;
      - test location rule (colocated `*.test.tsx`; tooling tests in `tests/tooling`; browser in `tests/browser/*.pw.ts`);
      - "the boundary checker is the source of truth — never silence it".

- [ ] **Step 1: Write the pressure scenarios** into `docs/superpowers/skill-tests/project-architecture.md`:
  - (a) "In `packages/bench/src/runner`, use the flip detector from metrics to count flips for a run." Correct answer: `import { detectFlips } from "../metrics"` and export it from `metrics/index.ts`.
  - (b) "Add a 'copy results link' button to the site leaderboard." Correct answer: `features/copy-results-link`, using `shared/ui` Button, wired in `widgets/leaderboard`.
  - (c) "The leaderboard needs the Summary type." Correct answer: import from `@smb/bench` (types only), never `@smb/bench/src/...`.
- [ ] **Step 2: Baseline (RED).** Dispatch a fresh subagent per scenario, _without_ the skill and with `CLAUDE.md` absent from its prompt. Ask it to name the file paths and imports it would write (no edits). Record the answers and the deviations in the test file. Expected: at least one deviation (deep import, wrong layer, or wrong folder). If there are none, make the scenarios harder before continuing.
- [ ] **Step 3: Write** `CLAUDE.md` and the skill.
- [ ] **Step 4: GREEN.** Re-run the same scenarios with the skill loaded. Expected: all three correct. Record the results. Close any loophole a subagent found by editing the skill and re-running.
- [ ] **Step 5: Run** `bun run check` (exit 0) and commit `docs: CLAUDE.md and project-architecture skill`.

---

### Task 8: Skill `component-review`

**Files:**
- Create: `.claude/skills/component-review/SKILL.md`, `docs/superpowers/skill-tests/component-review.md`

**Interfaces:**
- Consumes: `project-architecture` (Task 7). The review skill references it for axis 3.
- Produces: SKILL.md with:
  - frontmatter `name: component-review`, `description: Use after finishing a component (DS component, bench detector/adapter/runner pass, FSD slice) and before committing it — fast three-axis review: regressions, code quality, architecture`;
  - body:
    - **What counts as a component** (spec §3.1 examples and non-examples).
    - **Inputs:** the diff (`git diff --staged` or a commit range) and the plan task text.
    - **Axis 1 — regressions:** run `bun run check`, plus `bun run test:browser` when UI or harness changed; changed public exports and their consumers.
    - **Axis 2 — quality:** a 6-item checklist (naming, size, duplication, dead code, required error handling, tests assert behavior).
    - **Axis 3 — architecture:** a checklist derived from `project-architecture`, plus "matches the sibling components' pattern" and "no raw colors/sizes in `packages/ui`".
    - **Output format:**

      ```
      ## Review: <component>
      must-fix:
      - <file:line> <problem> → <fix>
      nit:
      - …
      verdict: PASS | FIX-REQUIRED
      ```
    - **Rule:** must-fix items are fixed before the commit, and the review is re-run on the fix only.
    - **Size limit:** one pass, ≤ 15 findings, no prose summary.

- [ ] **Step 1: Prepare the planted diff.** In a scratch branch, create a small fake component (e.g. `packages/bench/src/metrics/word-count.ts` + test) with **four planted defects**:
  1. a relative deep import from `runner`;
  2. a test that asserts an internal call instead of the output;
  3. dead code;
  4. a public export renamed while one consumer still uses the old name, so `tsc` fails.

  Save the diff and the defect list into `docs/superpowers/skill-tests/component-review.md`, then delete the scratch branch.
- [ ] **Step 2: Baseline (RED).** A fresh subagent gets the diff and "review this" without the skill. Record which defects it found and whether it ran `bun run check`. Expected: misses at least one defect or doesn't use the output format.
- [ ] **Step 3: Write** the skill.
- [ ] **Step 4: GREEN.** Same subagent prompt + the skill. Expected: all 4 defects reported as must-fix, the output in the exact format, `bun run check` actually run. Close loopholes and re-run.
- [ ] **Step 5: Commit** `docs: component-review skill`

---

### Task 9: Skill `ds-component`

**Files:**
- Create: `.claude/skills/ds-component/SKILL.md`, `docs/superpowers/skill-tests/ds-component.md`

**Interfaces:**
- Consumes: `project-architecture`, `component-review`
- Produces: SKILL.md with:
  - frontmatter `name: ds-component`, `description: Use when creating or changing a component in packages/ui`;
  - body, in order:
    1. Behavior + `axe` test first, in `<Name>.test.tsx` (Testing Library + `axe-core`; zero violations asserted). See it fail.
    2. Implementation: React Aria for interactive behavior; styles in `<Name>.module.css` using only `var(--…)` tokens.
    3. Story file `<Name>.stories.tsx` covering every visual state (variants × disabled/focus/error).
    4. VR: one Playwright screenshot per story in light and dark. Baselines are generated only in CI (Linux) via the workflow input `update-snapshots`, never committed from Windows.
    5. Export from `packages/ui/src/index.ts`.
    6. `component-review`.

  Storybook and the VR workflow input don't exist yet. The skill states that they are introduced in Stage 1, Task 1, so Stage 1 must create them first.

- [ ] **Step 1: Scenario.** "Create a `Badge` component in packages/ui with statuses match/diff/error/timeout." Correct behavior: all 6 steps in order, no hex colors, a test written and seen failing before the implementation.
- [ ] **Step 2: Baseline (RED).** A fresh subagent writes a plan (not code) for the scenario, without the skill. Record the gaps. Expected: misses at least one of test-first, axe, tokens-only, stories for all states, VR, export.
- [ ] **Step 3: Write** the skill.
- [ ] **Step 4: GREEN.** Re-run with the skill. Expected: all 6 steps present and in order. Close loopholes.
- [ ] **Step 5: Commit** `docs: ds-component skill`

---

### Task 10: Close the stage

- [ ] **Step 1:** Run `bun run check && bun run test:browser` locally. Expected: both exit 0.
- [ ] **Step 2:** Whole-branch review with `component-review` over `main..chore/workflow`. Fix must-fix items.
- [ ] **Step 3:** Mark the PR ready (`gh pr ready`), update its body with a checklist of the spec's Stage 0 "done when" items, each ticked with evidence (command, link).
- [ ] **Step 4: Branch protection.** Ask the author for an OK first. Then apply it with `gh api -X PUT repos/{owner}/streaming-markdown-bench/branches/main/protection`:
  - required status check `check`;
  - `strict: true`;
  - PR required, 0 approvals (solo author);
  - `enforce_admins: false`.

  Expected: `gh api …/protection` returns the rule.
- [ ] **Step 5:** Hand the merge to the author (the author merges; agents never merge).

---

## Spec coverage map

| Spec item (workflow spec)                                                                    | Task                      |
| -------------------------------------------------------------------------------------------- | ------------------------- |
| §2 Stage 0 "done when": public repo                                                          | 1                         |
| Bun workspaces skeleton, strict TS                                                           | 1                         |
| Biome, `bun run check`                                                                       | 2 (+4 `lint:arch`)        |
| Playwright verified under Bun                                                                | 5                         |
| Pre-commit hook                                                                              | 3                         |
| CI green on PR                                                                               | 6                         |
| `CLAUDE.md`                                                                                  | 7                         |
| Skills `project-architecture`, `component-review`, `ds-component`, tested per writing-skills | 7, 8, 9                   |
| §3.3 `main` protected, author merges                                                         | 10                        |
| §5.2 boundaries enforced (Biome → dependency-cruiser fallback, steiger)                      | 4                         |
| §5.4 line endings, VR baselines on Linux only                                                | 1, 2, 9                   |
| `add-renderer-adapter` skill, DS components, Storybook                                       | Out of scope (Stages 1–2) |
