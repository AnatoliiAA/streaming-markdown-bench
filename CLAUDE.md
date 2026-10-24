# Streaming Markdown Bench

Portfolio repo: a benchmark of streaming-markdown renderers (`packages/bench`), a design system (`packages/ui`), and a results site (`apps/site`). Bun workspaces, strict TypeScript, Biome. Specs and plans live in `docs/superpowers/`.

## Commands

| Command | What it does |
| --- | --- |
| `bun run check` | `biome ci . && tsc -b && bun test && bun run lint:arch`. Must exit 0 before every commit. `bun test` takes ~40-60s (tooling tests clone the repo and run the boundary matrix). |
| `bun run format` | `biome check --write .` |
| `bun run lint:arch` | Boundary check: dependency-cruiser + steiger (see skill `project-architecture`) |
| `bun run test:browser` | Playwright (`tests/browser/*.pw.ts`). Not part of `check` (needs a browser); run `bunx playwright install chromium` once per machine. CI runs both. |

Biome ignores all Markdown (`!**/*.md`) and `docs/`.

## Stages

Stage 0 Workflow (branch `chore/workflow`) -> 1 Design system -> 2 Bench core -> 3 Site. Details: `docs/superpowers/specs/2026-10-24-workflow-and-architecture-design.md` section 2.

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
| Reviewing a finished component (step 5) | `component-review` (Task 8) |
| Building a `packages/ui` component | `ds-component` (Task 9) |
| Any feature or bugfix | `superpowers:test-driven-development` |

## Browser tests

Playwright runs under Node, not Bun: `test:browser` = `bunx playwright test`. `bunx --bun playwright test` failed 3/3 on Bun 1.4.4 + @playwright/test 1.64.1 (worker process exits with code 1). Retry Bun when either is upgraded. Browser tests are `tests/browser/*.pw.ts`, never `*.spec.ts` (`bun test` would pick those up).

## Shell (this machine)

bun/gh may be missing from PATH in agent shells: `export PATH="$HOME/.bun/bin:/c/Program Files/GitHub CLI:$PATH"`.

## Git rules

- One branch per stage (or component group); one PR per branch.
- Never push to `main`; the author merges. Agents never merge.
- Commits are conventional (`feat:`, `fix:`, `docs:`, `chore:`, `test:`) and end with a `Co-Authored-By:` trailer.
- Visual-regression baselines are generated on Linux (CI/Docker), never on the Windows dev machine.
