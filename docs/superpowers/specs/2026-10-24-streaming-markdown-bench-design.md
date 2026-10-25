# Streaming Markdown Bench — Design Spec

- **Date:** 2026-10-24
- **Author:** Anatolii Abaturov
- **Status:** Draft. The architecture (§4) has been agreed in brainstorming. §6–§8 are proposals to review.

---

## 1. Why this project exists

**Goal:** build a public, credible portfolio project that makes the author's CV stand out for frontend roles at AI labs (Anthropic, OpenAI, others), with a focus on **agent and chat product UIs**.

**Problem it addresses:** the author's GitHub is nearly empty because all his professional work lives in company accounts. A CV alone reads like "one of a thousand".

**Why streaming markdown:** every LLM product renders markdown while it streams in, token by token. Many libraries already do this (Vercel Streamdown, streaming-markdown, markdown-parser, stream-md and others), but **nobody compares them objectively**. Nobody measures stability (flicker, block "flips", layout shift), how correct the intermediate states are, or accessibility while streaming.

**Time budget:** 1–2 months of evenings.

## 2. Overall plan (two phases)

| Phase                                             | Weeks | Output                                                                                                                                                        |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Bench** (this spec)                          | 1–3   | Open-source benchmark and conformance suite, public results site, data-driven article                                                                         |
| **2. Fix the biggest gap** (separate spec, later) | 4–8   | Either a small focused library (most likely accessibility and stability while streaming) or upstream PRs to existing libraries, based on the Phase 1 findings |

Phase 2 is designed only after Phase 1 produces data.

## 3. Success criteria (Phase 1)

1. Public GitHub repo with a README that explains the methodology and how to add a library.
2. At least **4 libraries** benchmarked, including a "re-parse everything" baseline.
3. At least **30 stream cases** in the corpus: real LLM outputs plus synthetic edge cases.
4. Public static results site with tables, charts and side-by-side replay.
5. One article that walks through the findings with data.
6. At least **one issue or PR** filed upstream, based on a real finding.
7. All of the following run with one command: the bench, the tests and the site build. CI re-runs everything.

## 4. Architecture (agreed)

Five modules. Each has one job and talks to the others only through files or a typed interface.

```
corpus/   ──▶  runner/  ──uses──▶  adapters/
  (JSON)        (Playwright)          (one file per library)
                    │
                    ▼
               results/ (JSON)  ──▶  site/ (static report + demo)
```

### 4.1 Corpus (`corpus/`)

Each case is one JSON file:

```ts
type StreamCase = {
  id: string; // "tables-wide-01"
  source: "claude" | "gpt" | "synthetic";
  tags: string[]; // ["table", "code", "long", "adversarial"]
  text: string; // full final markdown
  chunks: { delta: string; t: number }[]; // t = ms since stream start
};
```

- **Real outputs.** Recorded from the Claude and OpenAI APIs with a small recorder script. The prompt is stored next to each case. Covered content: tables, nested lists, code blocks, links, headings, long answers up to ~50k tokens.
- **Synthetic edge cases.** The stream is cut in the middle of `**`, inside a code fence opener, mid table row, mid link `[text](ur`, and so on.
- **Chunking policies.** One `text` can be re-chunked three ways:
  - `token`: original timing;
  - `random`: seeded random splits;
  - `adversarial`: a split at every markdown-significant character.
- **No employer or proprietary content.** Everything is generated fresh.

### 4.2 Adapters (`adapters/`)

```ts
interface RendererAdapter {
  name: string;
  version: string; // read from package.json
  mount(el: HTMLElement): {
    push(delta: string): void;
    end(): void;
    unmount(): void;
  };
}
```

- **Initial set:**
  - Streamdown;
  - streaming-markdown;
  - react-markdown re-rendering the full text on each chunk (the baseline);
  - one or two more from the existing landscape.
- **Adding a library** means writing one file plus registering it.
- **Bundling:** each adapter is bundled separately into the harness page, so libraries never share global state.

### 4.3 Runner (`runner/`)

Playwright with Chromium. For each (adapter × case × chunking policy):

1. Open the harness page and mount the adapter.
2. Replay the chunks with a controlled clock, in one of two modes:
   - `realtime`: honours `t`;
   - `flood`: as fast as possible.
3. Collect the metrics from §4.4.
4. Write one JSON result.

### 4.4 Metrics

| Group         | Metric                                                         | How it is measured                                                                                                                                                        |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Performance   | Frame time p50/p95, long tasks count, total time, peak JS heap | rAF timestamps, `PerformanceObserver('longtask')`, CDP `Performance.getMetrics`                                                                                           |
| Stability     | Cumulative layout shift                                        | `PerformanceObserver('layout-shift')`                                                                                                                                     |
| Stability     | **Block flips**                                                | After each chunk, snapshot the tag of every top-level block by index. A flip is a change of tag (or block type) of a block already shown, e.g. `p` → `h2` or `p` → `pre`. |
| Correctness   | Final DOM match                                                | Normalized HTML compared to the reference (full `text` through micromark + GFM). Reported as match or diff.                                                               |
| Correctness   | **Raw syntax leaks**                                           | Number of intermediate snapshots whose visible text contains markdown syntax (`**`, `__`, a code fence, `](`) that is absent from the reference visible text              |
| Accessibility | Live-region updates                                            | Count of DOM mutations inside `aria-live` regions, i.e. how many times a screen reader would announce something                                                           |
| Accessibility | A11y tree churn                                                | Playwright accessibility snapshots after each chunk, diffed. Counts role/name changes of nodes that were already shown.                                                   |

Accessibility metrics are an **approximation**. Five cases get a manual check in NVDA (Windows) and VoiceOver (macOS), and the notes are stored in `results/manual-a11y/`.

### 4.5 Results (`results/`)

- One JSON file per run, committed to the repo.
- Each file includes the environment: browser version, CPU throttling, OS, adapter versions.
- One `summary.json` aggregates all runs for the site.

### 4.6 Site (`site/`)

A static site, which is also the public demo:

- a leaderboard per metric group, with a methodology link next to each number;
- per-case drill-down;
- **side-by-side replay:** the same case plays in all libraries at once, with a speed slider and a "pause on flip" toggle that makes flicker obvious.

## 5. Data flow

```
recorder script ──▶ corpus/*.json
chunker (policy, seed) ──▶ chunk stream
runner × adapters ──▶ results/<date>/<adapter>/<case>.<policy>.json
aggregate ──▶ results/summary.json ──▶ site build ──▶ static deploy
```

## 6. Tech stack (proposal, to review)

- **Language:** TypeScript (strict), Node 22.
- **Repo structure:** a single repo with pnpm workspaces, but only where needed: `harness` and `site` are packages; everything else is plain folders.
- **Harness page:** Vite. One entry per adapter.
- **Runner:** `@playwright/test` used as a library (not as a test runner) for full control over timing.
- **Reference renderer:** `micromark` + `micromark-extension-gfm`.
- **Site:** Vite + React, built as static files. Charts with Observable Plot. Deployed to GitHub Pages or Vercel.
- **CI:** GitHub Actions:
  - on every PR: unit tests and a smoke bench;
  - weekly scheduled: the full bench, which also catches new library versions.

## 7. Error handling (proposal)

- **Adapter throws or hangs.** The error is recorded in the result as `status: "error" | "timeout"` with a message, and the run continues. Default timeout: 60 s per case.
- **Noisy performance numbers.**
  - Each perf measurement runs **5 times**; the median and p95 are reported.
  - CPU throttling is fixed via CDP (4×), so results stay comparable across machines.
  - Raw runs are kept.
- **Determinism.** Random chunking uses a stored seed, and replay timing is driven by the runner, not by `setTimeout` drift. Re-running a case must produce identical chunk boundaries.
- **Library version changes.** Results are keyed by adapter version, so the site never mixes versions.

## 8. Testing (proposal)

- **Unit (Vitest):**
  - chunking policies (boundaries, seeds);
  - flip detector;
  - syntax-leak detector;
  - normalized-HTML comparison;
  - aggregation.
    Each detector gets hand-made fixtures where the expected count is known.
- **Adapter contract test:** every adapter renders 3 tiny fixtures (paragraph, list, code block) to the expected normalized HTML. This catches broken adapters before benchmarking.
- **Runner smoke test:** one short case per adapter in CI; asserts that a valid result JSON is produced.
- **Replay determinism test:** the same case is run twice, and the chunk boundaries and order of DOM snapshots are asserted to be identical.
- **Development style:** TDD for detectors and metrics, since they are the heart of the bench's credibility.

## 9. Out of scope (Phase 1)

- Writing a new streaming markdown renderer (that is Phase 2, if the data justifies it).
- Frameworks other than React. Vanilla libraries are fine through the adapter interface.
- Math/LaTeX, Mermaid and syntax-highlighting quality. A possible later extension.
- Browsers other than Chromium.
- Real screen-reader automation beyond the manual checks in §4.4.

## 10. Risks

| Risk                                                | Mitigation                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Metrics look arbitrary or unfair to library authors | Publish the methodology, link every metric to its code, invite authors to review the adapters before publishing       |
| Perf noise makes rankings unstable                  | Median of 5 runs, fixed throttling, show confidence ranges rather than a single winner                                |
| Scope creep into Phase 2                            | Phase 2 needs its own spec. Phase 1 is done when §3 is met.                                                           |
| Time (evenings only)                                | Order of work: corpus + 2 adapters + stability metrics first. These make a publishable result even if the rest slips. |

## 11. Next step

Review this spec. Once it is approved, write the implementation plan (writing-plans) in the project repo and start with the corpus, the chunkers and the flip detector, test-first.
