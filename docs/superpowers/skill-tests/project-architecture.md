# project-architecture skill: pressure scenarios

## Scenarios

- (a) In `packages/bench/src/runner`, use the flip detector from metrics to count flips for a run. Correct: `import { detectFlips } from "../metrics"`, exported from `metrics/index.ts`; the runner logic lives in its own file, not in `runner/index.ts`.
- (b) Add a "copy results link" button to the site leaderboard. Correct: `features/copy-results-link`, `Button` from `shared/ui`, wired in `widgets/leaderboard`, relative imports to each `index.ts`.
- (c) The leaderboard needs the `Summary` type. Correct: `import type { Summary } from "@smb/bench"`, never `@smb/bench/src/...`.

## Baseline (RED)


Scenarios (as in the plan):
(a) In packages/bench/src/runner, use detectFlips from metrics.
(b) Add a "copy results link" button to the site leaderboard.
(c) The leaderboard needs the Summary type (defined at packages/bench/src/runner/types.ts).

Results:
(a) Import `import { detectFlips } from "../metrics"` — correct; metrics/flips.ts + re-export from metrics/index.ts — correct.
    DEVIATION: put the runner's flip-counting logic directly into `runner/index.ts` ("it is the only file in that folder"). index.ts must be the public API (re-exports) only; logic goes in its own file (e.g. runner/count-flips.ts) re-exported from index.ts.
(b) features/copy-results-link/{ui/CopyResultsLinkButton.tsx,index.ts}, wired in widgets/leaderboard, Button from shared/ui — correct,
    BUT the agent found it by reading the Stage 0 plan (which literally contains the answer), and
    DEVIATION: unsure how to write intra-site imports — proposed bare `import { Button } from "shared/ui"` (no alias exists; would not resolve) with relative path as a fallback. No convention exists.
(c) `import type { Summary } from "@smb/bench"`, re-export chain runner/types.ts → runner/index.ts → src/index.ts — correct (derived from .dependency-cruiser.cjs). Placed usage in widgets/leaderboard/model — acceptable.

Controller ruling for the skill: inside apps/site, imports between FSD layers/slices use RELATIVE paths to the slice's index (e.g. `../../../shared/ui`) — no path alias in Stage 0 (an `@/` alias may be introduced in Stage 3 together with Vite config; the skill must say so). Inside a bench module, sibling files import each other relatively; other modules only via `../<module>` (its index.ts).
GREEN must check: (a) logic NOT in index.ts; (b) relative import to shared/ui index, no bare "shared/ui"; (c) unchanged.

## With skill (GREEN)

pending
