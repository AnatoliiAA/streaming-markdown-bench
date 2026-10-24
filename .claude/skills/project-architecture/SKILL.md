---
name: project-architecture
description: Use when creating, moving or importing code anywhere in this repo — decides which package/module/FSD layer code belongs to and which imports are allowed
---

# Project architecture

Decide where code goes and what it may import. The boundary checker (`bun run lint:arch`) is the source of truth: if it fails, fix the code. Never silence it (no config edits, rule disables, or `off` entries to make a violation pass).

## Repo map

| Path | Package | Role |
| --- | --- | --- |
| `packages/ui` | `@smb/ui` | Design system: `tokens/`, `components/<Name>/`, entry `src/index.ts` |
| `packages/bench` | `@smb/bench` | Bench core, modules `corpus metrics adapters harness runner`, entry `src/index.ts` |
| `apps/site` | `@smb/site` | Results site, Feature-Sliced Design 2.x, root `src/` |
| `tests/tooling`, `tests/browser` | - | Tooling tests, Playwright tests (outside boundary rules) |
| `corpus/`, `results/` | - | Data at repo root |

## What goes where

| Kind of code | Location |
| --- | --- |
| Pure metric function (flip detector) | `packages/bench/src/metrics/<name>.ts`, re-exported from `metrics/index.ts` |
| Renderer adapter | `packages/bench/src/adapters/` |
| Orchestrating a run (uses adapters + metrics) | `packages/bench/src/harness/` |
| Whole-run pipeline, summary types | `packages/bench/src/runner/` |
| Stream case data/loading | `packages/bench/src/corpus/` |
| DS component | `packages/ui/src/components/<Name>/`, exported from `packages/ui/src/index.ts` |
| Colors, spacing, type, motion values | `packages/ui/src/tokens/` (no raw colors/sizes elsewhere) |
| Site: composition of a screen part (leaderboard) | `apps/site/src/widgets/<slice>` |
| Site: a user action (copy link, replay speed) | `apps/site/src/features/<slice>` |
| Site: a domain object (result row, renderer) | `apps/site/src/entities/<slice>` |
| Site: route-level page | `apps/site/src/pages/<slice>` |
| Site: providers, global setup | `apps/site/src/app` |
| Site: generic UI, lib, API glue; DS re-exports | `apps/site/src/shared/{ui,lib,api}` |

Slices (widgets/features/entities/pages) are folders with segments inside (`ui/`, `model/`, `lib/`, `api/`) and an `index.ts`.

## Import directions

| From | May import | Never |
| --- | --- | --- |
| `packages/ui` | itself | any `@smb/*`, `packages/*`, `apps/*` |
| `packages/bench` | itself | any `@smb/*`, other packages, apps |
| bench `corpus`, `metrics`, `adapters` | no other bench module | any other bench module |
| bench `harness` | `adapters`, `metrics` | `corpus`, `runner` |
| bench `runner` | `harness`, `metrics`, `corpus` | `adapters` |
| `apps/site` | `@smb/ui`, `@smb/bench` (entry points only) | deep paths |
| Site layers | `app -> pages -> widgets -> features -> entities -> shared`: only layers below | upward imports; same-layer slice to slice |

## Public-API rule

- Every module/slice has an `index.ts` that is the public API only: re-exports, no logic. Logic goes in its own file (`metrics/flips.ts`, `runner/count-flips.ts`), re-exported from `index.ts`. A folder with one file still follows this.
- Outside a module/slice, import only its `index.ts`. Never reach into its files.
- Cross-package: only package entry points `@smb/ui`, `@smb/bench`; never `@smb/bench/src/...` or a relative path into another package. Use `import type` for types (e.g. `import type { Summary } from "@smb/bench"`); if the type is not exported from `src/index.ts`, re-export it through the module `index.ts` chain up to `src/index.ts`.
- `@smb/ui` is consumed inside the site only through `shared/ui` (which re-exports it and holds site-specific pieces). Slices never import `@smb/ui` directly.

## Import syntax

| Where | Write |
| --- | --- |
| Bench file -> sibling file in same module | relative: `./flips` |
| Bench module -> another bench module | `../metrics` (its `index.ts`), never `../metrics/flips` |
| Site slice/layer -> other layer or slice | relative path to the target's `index.ts`, e.g. `../../../shared/ui` |
| Site -> packages | `@smb/ui` (only in `shared/ui`), `@smb/bench` |

There is no path alias in Stage 0 and a bare `"shared/ui"` does not resolve. An `@/` alias may be introduced in Stage 3 together with the Vite config; until then use relative paths.

## Tests

| Kind | Location |
| --- | --- |
| Unit / component | colocated `*.test.ts` / `*.test.tsx` next to the code |
| Tooling (config, boundary matrix) | `tests/tooling/` |
| Browser (Playwright) | `tests/browser/*.pw.ts`, never `*.spec.ts` |

## How boundaries are enforced

`bun run lint:arch` = steiger + dependency-cruiser. Biome has no boundary rules.

| Tool / config | Covers |
| --- | --- |
| steiger (`steiger.config.mjs`) | FSD in `apps/site/src`: layer direction, slice isolation, public API. `fsd/insignificant-slice` is off |
| dependency-cruiser (`.dependency-cruiser.cjs`) | Resolved-path rules: package isolation, no deep package imports, bench module directions, no deep bench-module imports, unresolvable imports. Parses TS via `@swc/core` (TypeScript 7 has no JS API) |

Run `bun run lint:arch` after moving or adding imports. A violation means the code is in the wrong place or imports the wrong thing: move the code or go through the public API.
