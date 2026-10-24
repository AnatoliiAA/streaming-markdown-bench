# Workflow, Design System & Architecture — Design Spec

- **Date:** 2026-10-24
- **Status:** Approved in brainstorming (2026-10-24). Awaiting written-spec review.
- **Relates to:** [Streaming Markdown Bench — Design Spec](2026-10-24-streaming-markdown-bench-design.md) (the "bench spec"). This spec changes _how_ and _in what order_ the bench is built. It also replaces the bench spec's §6 (tech stack). The bench spec's goals, metrics and success criteria are unchanged.
- **Supersedes:** `docs/superpowers/plans/2026-10-24-streaming-markdown-bench-core.md`. Its task content is reused, re-cut into components, for Stage 2.

---

## 1. Intent

The project is a portfolio piece for frontend roles at AI labs. The _way_ it is built is part of what it shows. A reviewer opening the repo should see:

- a clear architecture with enforced boundaries;
- a real design system;
- test-first development;
- small reviewed PRs with green CI.

So we build the workflow first, then the design system, and only then the product.

## 2. Stages

| #   | Stage             | Branch / PR                              | Done when                                                                                                                                                                                                                                                           |
| --- | ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Workflow**      | `chore/workflow` → one PR                | Public GitHub repo; Bun workspaces skeleton; Biome; strict TS; `bun run check` green; Playwright verified under Bun; pre-commit hook; CI green on the PR; `CLAUDE.md`; project skills `project-architecture`, `component-review`, `ds-component` written and tested |
| 1   | **Design system** | `feat/ui-*` (one PR per component group) | `packages/ui` has tokens (light/dark) and the components the site needs (§5.3). Each has behavior + axe tests, a story and visual-regression baselines. Storybook builds statically.                                                                                |
| 2   | **Bench core**    | `feat/bench-*`                           | The bench spec §3 items 1–3 and 7 (bench + tests part), built in `packages/bench`. Skill `add-renderer-adapter` written once the adapter interface exists.                                                                                                          |
| 3   | **Site**          | `feat/site-*`                            | The bench spec §3 item 4 and item 7 (site build part), built in `apps/site` with FSD on top of `@smb/ui`.                                                                                                                                                           |

Each stage gets its own implementation plan, written just before the stage starts. Article and upstream issue (bench spec §3.5–3.6) follow Stage 3 and are not engineering stages.

## 3. Development process

### 3.1 Per-component cycle

A **component** is one finished, independently testable unit. Examples:

- a DS component (`Slider`);
- a bench detector (flip detector);
- an adapter;
- a runner pass;
- an FSD slice (`features/replay-speed`).

Config tweaks, copy changes, or adding a prop to an existing component are _not_ components.

1. Write a failing test (red). Run it and see it fail for the expected reason.
2. Write the minimal implementation (green).
3. Refactor while green.
4. `bun run check`.
5. **Component review** (§3.2).
6. Fix the findings, re-run `bun run check`.
7. Commit (one commit per component, conventional-commit message).

Small changes skip step 5 but still go through TDD and `bun run check`.

### 3.2 Component review

It is run by a fresh subagent that loads the `component-review` skill and gets the component's diff and the plan task. It reviews three axes:

1. **Regressions.** `bun run check` and visual-regression tests are green. Behavior outside the component is unchanged. Public APIs that other modules consume are unchanged, or every consumer was updated.
2. **Code quality.** Naming, size, duplication, dead code, error handling where the spec requires it, and tests that assert behavior rather than implementation.
3. **Architecture and patterns.** The code is in the right layer or module. Imports go only through public APIs. It matches existing component patterns and follows `project-architecture`.

Output: a short list of findings, each tagged `must-fix` or `nit`. All `must-fix` items are fixed immediately, before the commit. `nit` items are fixed if they are cheap; otherwise drop them. The review is meant to be quick: one pass, no essay.

### 3.3 Git and GitHub

- Public GitHub repo `streaming-markdown-bench`, default branch `main`. `main` is protected: it requires a PR with green CI.
- One branch and one PR per stage, or per component group inside a stage. Inside the PR, one commit per reviewed component.
- The author merges PRs. Agents never merge and never push to `main`.

## 4. Skills

### 4.1 Existing skills used

| Skill                                        | Used for                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `superpowers:test-driven-development`        | Red → green → refactor discipline in every task                                                           |
| `superpowers:writing-plans`                  | One plan per stage                                                                                        |
| `superpowers:subagent-driven-development`    | Executing plans; a fresh implementer per task                                                             |
| `superpowers:requesting-code-review`         | Mechanics of dispatching the reviewer; the checklist comes from `component-review`                        |
| `superpowers:verification-before-completion` | No "done" claims without the command output                                                               |
| `superpowers:writing-skills`                 | Authoring the project skills below, test-first (baseline run without the skill fails, run with it passes) |
| `superpowers:finishing-a-development-branch` | Closing a stage: PR creation                                                                              |

### 4.2 Project skills (in `.claude/skills/`, committed)

| Skill                  | Content                                                                                                                                                                                                    | Stage |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `project-architecture` | Repo map; what goes where (FSD layers for the site, domain modules for bench, `packages/ui`); public-API rule; allowed import directions; naming; where tests live                                         | 0     |
| `component-review`     | The §3.2 procedure: inputs, the three axes as a checklist, the commands to run, the output format, the fix-immediately rule, and what counts as a component                                                | 0     |
| `ds-component`         | How to build a DS component: behavior + axe test first → implementation with tokens only (no raw colors or sizes) → story with every state → VR baseline in light and dark → export from the package index | 0     |
| `add-renderer-adapter` | One adapter file + registration + contract test                                                                                                                                                            | 2     |

Every skill is validated per `writing-skills`: a pressure scenario fails without the skill and passes with it.

## 5. Architecture

### 5.1 Repo layout

```
.claude/skills/            project skills
.github/workflows/         ci.yml
apps/site/                 FSD app (Stage 3)
packages/ui/               design system (Stage 1)
packages/bench/            bench core (Stage 2)
corpus/                    stream cases (data)
results/                   bench output (data)
docs/superpowers/{specs,plans}/
biome.json, tsconfig.base.json, package.json (workspaces), bunfig.toml, lefthook.yml, CLAUDE.md
```

Package names: `@smb/ui`, `@smb/bench`, `@smb/site` (all private; `smb` = streaming-markdown-bench).

### 5.2 Module rules

- **`apps/site` — Feature-Sliced Design 2.x.**
  - Layers: `app → pages → widgets → features → entities → shared`. A layer imports only from layers below it.
  - Slices on the same layer don't import each other.
  - Each slice exposes only `index.ts`.
  - `@smb/ui` is consumed through `shared/ui`, which re-exports it and holds site-specific pieces.
  - Enforced by **steiger**.
- **`packages/bench` — domain modules.**
  - `corpus`, `metrics`, `adapters`, `harness`, `runner`. Each has `index.ts` as its only public entry.
  - Allowed directions: `runner → harness, metrics, corpus`; `harness → adapters, metrics`; `metrics` and `corpus` import no other module.
  - No deep imports across modules.
- **`packages/ui`.**
  - `tokens/` and `components/<Name>/`. Components import tokens (CSS vars) and shared primitives only, never each other's internals.
  - The package exports only through `src/index.ts`.
- **Cross-package:** `site → ui`, `site → bench` (types and the summary schema only), `bench → nothing`, `ui → nothing`.
- **Enforcement:** `dependency-cruiser` on resolved paths owns package and module boundaries (Biome `noRestrictedImports` was tried and rejected: it only matches import specifier text). `steiger` owns FSD for `apps/site`.

### 5.3 Design system

- **Styling:**
  - CSS custom properties for tokens: color, space, radius, typography, motion, z-index.
  - Light and dark theme via `[data-theme]` plus `prefers-color-scheme`.
  - Components use CSS Modules.
  - No raw colors or sizes outside `tokens/`. This is checked in review; a lint rule is added if feasible.
- **Behavior and a11y:** React Aria (hooks or components) for interactive widgets: slider, switch, tabs, select, tooltip, table sorting.
- **Initial component set** (what the bench spec §4.6 site needs):
  - `Button`, `Switch`, `Slider`, `Select`, `Tabs`;
  - `Table` (sortable);
  - `Badge` (status: match / diff / error / timeout);
  - `Card`/`Panel`, `Tooltip`;
  - `Stat` (metric value + methodology link);
  - `CodeBlock`/`Mono`;
  - `Stack`/`Grid` layout primitives.

  Charts use Observable Plot, themed from tokens. Plot is not part of the DS.
- **Storybook** (Vite builder) is the showcase. Its static build is published next to the site.

### 5.4 Tooling

| Concern                                       | Tool                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Runtime, package manager, workspaces, scripts | **Bun** (one pinned version; `packageManager` field)                                                                           |
| Lint + format                                 | **Biome** (`biome ci` in CI, `biome check --write` locally)                                                                    |
| Types                                         | `tsc --noEmit -b` (Biome doesn't type-check); TS `strict`, `noUncheckedIndexedAccess`                                          |
| Unit + component tests                        | `bun test` + happy-dom (preload) + Testing Library + axe-core                                                                  |
| Browser tests, visual regression              | Playwright (Chromium), `toHaveScreenshot` over Storybook stories, light + dark                                                 |
| Build                                         | Vite (site, harness, Storybook)                                                                                                |
| Pre-commit                                    | lefthook: `biome check --staged`                                                                                               |
| CI                                            | GitHub Actions: `bun install --frozen-lockfile`, `bun run check`, Playwright tests; Linux-generated VR baselines are canonical |

Root scripts:
- `check` = `biome ci && tsc -b && bun test`;
- `test:browser` = Playwright;
- `format` = `biome check --write`.

**Bun + Playwright risk:** Stage 0 runs a smoke Playwright test under Bun first. If it is unreliable, browser tests run through `bunx --bun=false playwright test` (Node), and everything else stays on Bun. The outcome is recorded in `CLAUDE.md`.

**Line endings:** `.gitattributes` with `* text=auto eol=lf` (the dev machine has `core.autocrlf=true`); Biome is configured for LF.

**Windows note:** the author develops on Windows. VR baselines are generated in CI (Linux) or in the Playwright Docker image, never on the dev machine, to avoid font-rendering diffs.

## 6. Changes to the bench spec

- §6: pnpm → Bun workspaces; Vitest → `bun test` (+ Playwright for browser tests); add Biome. Repo structure as §5.1 here.
- Folders `runner/ adapters/ harness/` move under `packages/bench/src/`. `corpus/` and `results/` stay at the root.
- §8 testing strategy is unchanged in substance; the runner changes as above.

## 7. Risks

| Risk                                                                  | Mitigation                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow + DS stages eat the time budget before any bench data exists | Stage 0 is capped at ~3 evenings. The DS ships only the §5.3 set, no speculative components. The bench spec's "corpus + 2 adapters + stability metrics first" rule still holds inside Stage 2. |
| Bun incompatibilities (Playwright, happy-dom, Storybook)              | Verified in Stage 0 with smoke tests; Node fallback per tool, documented                                                                                                                       |
| Reviews become slow ceremony                                          | Review only real components; fixed checklist; one pass                                                                                                                                         |
| VR flakiness across OSes                                              | Baselines generated on Linux only; animations disabled in VR; fixed viewport                                                                                                                   |
