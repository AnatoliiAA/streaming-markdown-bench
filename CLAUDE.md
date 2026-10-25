# Streaming Markdown Bench

Portfolio repo: a benchmark of streaming-markdown renderers (`packages/bench`), a design system (`packages/ui`), and a results site (`apps/site`). Bun workspaces, strict TypeScript, Biome. Specs and plans live in `docs/superpowers/`.

## Commands

| Command | What it does |
| --- | --- |
| `bun run check` | `biome ci . && tsc -b && bun run test && bun run lint:arch`. Must exit 0 before every commit. |
| `bun run check:all` | `bun run check && bun run test:tooling`. Run before pushing and whenever you touch tooling config. CI runs it. |
| `bun run test` | `bun test` without `tests/tooling/` (unit, component, `tests/setup/`). |
| `bun run test:tooling` | `bun test ./tests/tooling`: slow tooling tests (clone the repo, run the boundary matrix). |
| `bun run format` | `biome check --write .` |
| `bun run lint:arch` | Boundary check: dependency-cruiser + steiger (see skill `project-architecture`) |
| `bun run test:browser` | Playwright (`tests/browser/*.pw.ts`). Its webServer builds Storybook (`build:storybook`) and serves it on :6007 (reused locally if already running). Not part of `check` (needs a browser); run `bunx playwright install chromium` once per machine. CI runs both. |
| `bun run storybook` | Storybook dev server for `packages/ui` on :6006. |
| `bun run build:storybook` | Static Storybook build into `packages/ui/storybook-static` (git- and Biome-ignored). |

Biome ignores all Markdown (`!**/*.md`) and `docs/`.

## Stages

Stage table: `docs/superpowers/specs/2026-10-24-workflow-and-architecture-design.md` section 2. Current stage: see the open PR / branch.

## Process: per-component cycle (spec section 3.1)

A component = one finished, independently testable unit (DS component, bench detector, adapter, runner pass, FSD slice). Config tweaks, copy changes and adding a prop are not components.

1. Failing test first; run it, see it fail for the expected reason.
2. Minimal implementation (green).
3. Refactor while green.
4. `bun run check`.
5. Component review (fresh subagent, skill `component-review`).
6. Fix findings (`must-fix` always, `nit` if cheap), re-run `bun run check`.
7. One commit per component, conventional-commit message.

Small changes skip step 5 but still do TDD and `bun run check`.

## Skills (`.claude/skills/`)

| Load when | Skill |
| --- | --- |
| Creating, moving or importing code anywhere | `project-architecture` |
| Reviewing a finished component (step 5) | `component-review` |
| Building a `packages/ui` component | `ds-component` |
| Any feature or bugfix | `superpowers:test-driven-development` |

## Browser tests

Playwright runs under Node, not Bun: `test:browser` = `bunx playwright test`; requires Node ≥ 20 on PATH (bunx otherwise shims node to Bun, which fails). `bunx --bun playwright test` failed 3/3 on Bun 1.4.4 + @playwright/test 1.64.1 (worker process exits with code 1). Retry Bun when either is upgraded. Browser tests are `tests/browser/*.pw.ts`, never `*.spec.ts` (`bun test` would pick those up).

## Visual regression

`tests/browser/stories.pw.ts` iterates every story in the Storybook index (except tags `!vr`) in light and dark: axe (all rules) everywhere, screenshots only on Linux (`shouldAssertScreenshots`). Baselines live in `tests/browser/__screenshots__/` and come only from CI:

1. `gh workflow run vr-update.yml --ref <branch>`
2. `gh run watch <id>`
3. `gh run download <id> -n vr-baselines -D tests/browser/__screenshots__`
4. Commit `test(vr): baselines from CI run <id>` and push (the push triggers CI normally; the workflow itself never pushes).

## Shell (this machine)

bun/gh may be missing from PATH in agent shells: `export PATH="$HOME/.bun/bin:/c/Program Files/GitHub CLI:$PATH"`.

## Git rules

- One branch per stage (or component group); one PR per branch.
- Never push to `main`; the author merges. Agents never merge.
- One commit per reviewed component.
- Commits are conventional (`feat:`, `fix:`, `docs:`, `chore:`, `test:`) and end with a `Co-Authored-By:` trailer.
- Visual-regression baselines are generated on Linux (CI/Docker), never on the Windows dev machine.
