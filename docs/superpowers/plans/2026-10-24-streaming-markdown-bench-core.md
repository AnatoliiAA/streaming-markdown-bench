# Streaming Markdown Bench — Core (Plan 1 of 2) Implementation Plan

> **SUPERSEDED** by `docs/superpowers/specs/2026-10-24-workflow-and-architecture-design.md`. Kept as source material for the Stage 2 (bench core) plan. Tooling (pnpm/Vitest) and paths here are outdated.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command (`pnpm bench`) replays a corpus of ≥30 markdown streams through ≥4 renderer adapters in Chromium and writes per-run result JSON plus `results/summary.json` with stability, correctness, accessibility and performance metrics.

**Architecture:** Pure, unit-tested logic (case schema, chunkers, detectors, normalization, aggregation) lives in `corpus/` and `runner/metrics/`. A Vite-built harness page (`harness/`) loads exactly one adapter per page load via dynamic import and exposes `window.__bench`. The Playwright runner (`runner/`) drives that page in two passes: a deterministic _fidelity pass_ (snapshot after each chunk) and a throttled _perf pass_ (in-page replay, 5 runs).

**Tech Stack:** TypeScript (strict), Node 22, pnpm workspaces (`harness` only in this plan), Vite, React 18, `playwright` (library), Vitest (+ happy-dom), `micromark` + `micromark-extension-gfm`, `hast-util-from-html`, `hast-util-to-text`, `diff`, `tsx`.

**Spec:** `2026-10-24-streaming-markdown-bench-design.md` (repo root)

**Out of this plan (→ Plan 2):** site + side-by-side replay, weekly full-bench workflow, 5th adapter from the landscape survey, manual NVDA/VoiceOver notes, article, upstream issue, `site` package.

## Global Constraints

- TypeScript `strict: true`; Node 22 (`.nvmrc` = `22`); package manager pnpm.
- All scripts must run on Windows and Linux: no `rm -rf`, no shell globs in npm scripts; use Node APIs.
- Chromium only. CPU throttling for perf = **4×** via CDP `Emulation.setCPUThrottlingRate`.
- Perf: each measurement runs **5 times**; report median and p95; keep raw runs.
- Default timeout **60 s** per (adapter × case × policy) fidelity run, plus 100 ms per snapshot taken (see decisions).
- Random chunking uses a stored seed; default seed **1337**. Re-running a case must produce identical chunk boundaries.
- Result path: `results/<YYYY-MM-DD>/<adapter>/<caseId>.<policy>.json`; every result carries adapter version and environment.
- No employer or proprietary content in the corpus.
- Reference renderer: `micromark` with `gfm()` / `gfmHtml()`, default options (raw HTML escaped).
- Adapter names starting with `__` are test-only and never enter the default bench matrix.

## Plan-level decisions (resolve the spec's open points — review these)

1. **Two passes.** Fidelity pass (unthrottled, settle after each chunk, all policies) produces flips, CLS, leaks, live-region updates, a11y churn and final match. Perf pass runs **only for policy `token`**, in both modes, `realtime` and `flood`, 5 runs × 4× throttle.
2. **Cost caps.** `random`/`adversarial` re-chunking only for cases with `text.length ≤ 20_000` (`RECHUNK_MAX_CHARS`). Fidelity snapshots at most **1500** per run: `stride = ceil(chunks / 1500)`, snapshot after every `stride`-th chunk and after the last. `stride` is recorded in the result.
3. **Realtime compression.** If the last chunk `t` exceeds 60 000 ms, realtime replay is compressed by `timeScale = lastT / 60_000` (recorded). Perf run timeout = 120 s.
4. **Normalization** (for final match): adapters may declare `ignoreSelectors` (e.g. copy buttons). These are removed in-page. Node-side rules are fixed in Task 5 and documented in README.
5. **Flip rule:** compare block type at the same index between consecutive snapshots; a changed type is a flip; a block that disappears is a flip to `"∅"`; new trailing blocks are not flips.
6. **Styling:** every adapter renders with the same neutral `harness/src/base.css` and no library CSS.
7. **4th adapter** = `marked` full re-parse into `innerHTML` (vanilla baseline). A real 5th library is chosen in Plan 2.
8. Repo root = this folder; `git init` happens in Task 1.

## Review Focus

1. **Emoji / astral characters in random or adversarial chunking.** A split inside a surrogate pair would feed invalid UTF-16 to renderers. Expectation: chunkers split only on code-point boundaries → Task 2 test `never splits surrogate pairs`.
2. **Markdown syntax that legitimately stays in the output** (`**kwargs` in a code block, `__init__`). Expectation: zero leaks when the reference visible text contains the token → Task 6 test + synthetic case `synth-code-kwargs`.
3. **Adapter that throws or hangs mid-stream.** Expectation: result `status: "error" | "timeout"` with a message, and the matrix continues → Task 11 tests with `__broken` and `__hang`.
4. **Whitespace in code blocks** (trailing newline, indentation). Expectation: identical code is a match and indentation differences are a mismatch → Task 5 tests.
5. **Malformed case files** (CRLF from a recorder on Windows, deltas that don't join to `text`, decreasing `t`). Expectation: rejected at load with the file name → Task 1 tests; recorder normalizes CRLF → Task 13 test.

---

## File Structure

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, tsconfig.json, vitest.config.ts, .gitignore, .nvmrc, README.md
corpus/
  schema.ts            StreamCase/Chunk types, validateCase
  load.ts              loadCases(dir)
  chunking.ts          rechunk, mulberry32, MD_SIGNIFICANT
  synthetic/defs.ts    SyntheticDef list (≥14)
  synthetic/generate.ts writes corpus/cases/synth-*.json
  cases/*.json         all cases (synthetic + recorded)
  prompts/<id>.md      prompt for each recorded case
recorder/
  to-case.ts           pure: stream events → StreamCase
  record.ts            CLI: Claude / OpenAI streaming → corpus/cases
adapters/
  types.ts             RendererAdapter
  react-markdown-baseline.tsx, streaming-markdown.ts, marked-reparse.ts, streamdown.tsx
  test-only/broken.ts, test-only/hang.ts
harness/               (pnpm package)
  package.json, vite.config.ts, index.html
  src/main.ts          builds window.__bench
  src/bench-api.ts     BenchApi + probe types
  src/registry.ts      adapter name → dynamic import
  src/settle.ts, src/base.css
runner/
  metrics/blocks.ts    blockTypes(container, ignoreSelectors) — DOM, used in page
  metrics/flips.ts     detectFlips
  metrics/leaks.ts     LEAK_TOKENS, findLeakTokens, countLeaks
  metrics/reference.ts renderReference, normalizeHtml, visibleText, htmlDiff
  metrics/a11y.ts      parseAriaSnapshot, diffA11y
  metrics/stats.ts     percentile, median
  types.ts             RunResult, FidelityResult, PerfSample, PerfStats, Env, Summary
  server.ts            serveDir
  guard.ts             runGuarded
  fidelity.ts          runFidelity
  perf.ts              runPerf, summarizePerf
  matrix.ts            buildMatrix
  env.ts               captureEnv
  results.ts           writeResult, readResults
  aggregate.ts         aggregate, aggregateDir
  cli.ts               main(argv)
tests/browser/
  global-setup.ts      builds harness, starts server
  helpers.ts           openHarness
  contract.test.ts, fidelity.test.ts, cli.test.ts
.github/workflows/ci.yml
```

---

### Task 1: Repo scaffold + case schema

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.nvmrc`
- Create: `corpus/schema.ts`, `corpus/load.ts`
- Test: `corpus/schema.test.ts`

**Interfaces:**
- Produces:
  - `type Chunk = { delta: string; t: number }`
  - `type StreamCase = { id: string; source: "claude" | "gpt" | "synthetic"; tags: string[]; text: string; chunks: Chunk[] }`
  - `validateCase(x: unknown): { ok: true; value: StreamCase } | { ok: false; errors: string[] }`
  - `loadCases(dir: string): Promise<StreamCase[]>` reads every `*.json` in the folder, sorted by id, and throws `Error("<file>: <errors joined>")` on the first invalid file.

- [ ] **Step 1: Initialize the repo and toolchain**

`git init`. Root `package.json`: `"private": true`, `"type": "module"`, devDeps `typescript`, `vitest`, `tsx`, `@types/node`, `happy-dom`. Scripts: `"test": "vitest run"`. `pnpm-workspace.yaml`: `packages: ["harness"]`. `.gitignore`: `node_modules`, `harness/dist`, `*.log`. `vitest.config.ts` defines the project `unit` (environment `node`, include `{corpus,runner,recorder}/**/*.test.ts`). The `browser` project is added in Task 8.

- [ ] **Step 2: Write failing tests** in `corpus/schema.test.ts`

```ts
const ok = {
  id: "a-1",
  source: "synthetic",
  tags: [],
  text: "ab",
  chunks: [
    { delta: "a", t: 0 },
    { delta: "b", t: 5 },
  ],
};
test("accepts a valid case", () => expect(validateCase(ok).ok).toBe(true));
test("rejects CRLF", () =>
  expect(validateCase({ ...ok, text: "a\r\nb", chunks: [{ delta: "a\r\nb", t: 0 }] }).ok).toBe(
    false,
  ));
test("rejects deltas that don't join to text", () =>
  expect(validateCase({ ...ok, text: "abc" }).ok).toBe(false));
test("rejects empty delta", () =>
  expect(
    validateCase({
      ...ok,
      chunks: [
        { delta: "", t: 0 },
        { delta: "ab", t: 1 },
      ],
    }).ok,
  ).toBe(false));
test("rejects decreasing t", () =>
  expect(
    validateCase({
      ...ok,
      chunks: [
        { delta: "a", t: 5 },
        { delta: "b", t: 1 },
      ],
    }).ok,
  ).toBe(false));
test("rejects non-integer or negative t", () =>
  expect(
    validateCase({
      ...ok,
      chunks: [
        { delta: "a", t: -1 },
        { delta: "b", t: 1.5 },
      ],
    }).ok,
  ).toBe(false));
test("rejects bad id", () => expect(validateCase({ ...ok, id: "Bad_Id" }).ok).toBe(false));
test("rejects unknown source", () =>
  expect(validateCase({ ...ok, source: "gemini" }).ok).toBe(false));
test("loadCases names the bad file", async () => {
  /* tmp dir with one bad file "x.json" */ await expect(loadCases(tmp)).rejects.toThrow(/x\.json/);
});
```

- [ ] **Step 2b: Run** `pnpm vitest run corpus/schema.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `validateCase` and `loadCases`. Id regex `^[a-z0-9]+(-[a-z0-9]+)*$`. Collect all errors; don't stop at the first.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `chore: scaffold repo; feat(corpus): case schema and loader`

---

### Task 2: Chunking policies

**Files:**
- Create: `corpus/chunking.ts`
- Test: `corpus/chunking.test.ts`

**Interfaces:**
- Consumes: `StreamCase`, `Chunk` (Task 1)
- Produces:
  - `type ChunkPolicy = "token" | "random" | "adversarial"`
  - `DEFAULT_SEED = 1337`, `RECHUNK_MAX_CHARS = 20_000`
  - `MD_SIGNIFICANT = "*_\`~[]()#>|-+!=\\\n"` (one-char set)
  - `mulberry32(seed: number): () => number`
  - `rechunk(c: StreamCase, policy: ChunkPolicy, seed = DEFAULT_SEED): Chunk[]`

Rules: `token` returns a copy of `c.chunks`. `random` cuts into pieces whose lengths are uniform integers in [1, 12] **code points**. `adversarial` makes each `MD_SIGNIFICANT` character its own chunk and keeps maximal runs of other characters together. For `random`/`adversarial`, each new chunk's `t` is the `t` of the original chunk that contains the new chunk's last character.

- [ ] **Step 1: Write failing tests**

```ts
const c = {
  id: "x",
  source: "synthetic",
  tags: [],
  text: "a **b** [c](d)",
  chunks: [
    { delta: "a **b", t: 0 },
    { delta: "** [c](d)", t: 100 },
  ],
} as StreamCase;
test("all policies join back to text", () => {
  for (const p of ["token", "random", "adversarial"] as const)
    expect(
      rechunk(c, p)
        .map((x) => x.delta)
        .join(""),
    ).toBe(c.text);
});
test("adversarial exact split", () =>
  expect(rechunk(c, "adversarial").map((x) => x.delta)).toEqual([
    "a ",
    "*",
    "*",
    "b",
    "*",
    "*",
    " ",
    "[",
    "c",
    "]",
    "(",
    "d",
    ")",
  ]));
test("adversarial t mapping", () =>
  expect(rechunk(c, "adversarial").map((x) => x.t)).toEqual([
    0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100,
  ]));
test("random is deterministic per seed", () =>
  expect(rechunk(c, "random", 7)).toEqual(rechunk(c, "random", 7)));
test("random differs across seeds", () =>
  expect(rechunk(long, "random", 1)).not.toEqual(rechunk(long, "random", 2)));
test("random piece length within 1..12 code points", () => {
  for (const ch of rechunk(long, "random"))
    expect([...ch.delta].length).toBeGreaterThanOrEqual(1),
      expect([...ch.delta].length).toBeLessThanOrEqual(12);
});
test("never splits surrogate pairs", () => {
  const e = mk("👍👍 **🎉**");
  for (const p of ["random", "adversarial"] as const)
    for (const ch of rechunk(e, p))
      expect(ch.delta).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
});
test("t is non-decreasing", () => {
  const t = rechunk(long, "random").map((x) => x.t);
  expect(t).toEqual([...t].sort((a, b) => a - b));
});
```
(`long` = a ~2 KB fixture case; `mk(text)` = a one-chunk case helper defined in the test.)

- [ ] **Step 2: Run** `pnpm vitest run corpus/chunking.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `mulberry32` (standard algorithm) and `rechunk`. Iterate with `Array.from(text)` so splits fall on code points. Map offsets to original chunks using cumulative UTF-16 end offsets.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(corpus): token/random/adversarial chunking`

---

### Task 3: Synthetic edge-case corpus

**Files:**
- Create: `corpus/synthetic/defs.ts`, `corpus/synthetic/generate.ts`, `corpus/cases/synth-*.json` (generated)
- Test: `corpus/synthetic/generate.test.ts`
- Modify: `package.json` (script `"corpus:synthetic": "tsx corpus/synthetic/generate.ts"`)

**Interfaces:**
- Consumes: `StreamCase`, `validateCase`
- Produces:
  - `type SyntheticDef = { id: string; tags: string[]; text: string; cuts: number[] }` (`cuts` = UTF-16 offsets, strictly increasing, within (0, text.length))
  - `defToCase(d: SyntheticDef): StreamCase` with `source: "synthetic"`, `t = 30 * chunkIndex`
  - `generateSynthetic(outDir: string): Promise<string[]>` writes `<id>.json` (2-space JSON + trailing `\n`) and returns the paths

- [ ] **Step 1: Write the defs.** ≥14 entries, each id prefixed `synth-`. Each entry has a cut at the named spot:
  `bold-open` (inside `**`), `fence-open` (after the first two backticks of an opening fence), `fence-lang` (inside ` ```py`), `table-row` (mid row), `table-delim` (before `|---|`), `link-url` (`[text](ur`), `link-text` (`[tex`), `setext-h2` (`Title\n-` then `-`), `list-nested` (inside the indent of a nested item), `ordered-start` (`3.` list), `blockquote-lazy`, `hr-vs-list` (`-` then `--`), `code-kwargs` (Python `def f(**kwargs): __init__` inside a fence, cut mid-fence), `emoji-cjk` (emoji + CJK, cut between them).
- [ ] **Step 2: Write failing tests**

```ts
test("every def produces a valid case", () => {
  for (const d of DEFS) expect(validateCase(defToCase(d)).ok).toBe(true);
});
test("cuts become chunk boundaries", () =>
  expect(defToCase({ id: "synth-x", tags: [], text: "abcd", cuts: [1, 3] }).chunks).toEqual([
    { delta: "a", t: 0 },
    { delta: "bc", t: 30 },
    { delta: "d", t: 60 },
  ]));
test("ids are unique", () => expect(new Set(DEFS.map((d) => d.id)).size).toBe(DEFS.length));
test("generation is byte-identical on re-run", async () => {
  await generateSynthetic(tmp);
  const a = await readAll(tmp);
  await generateSynthetic(tmp);
  expect(await readAll(tmp)).toEqual(a);
});
```

- [ ] **Step 3: Run** `pnpm vitest run corpus/synthetic`. Expected: FAIL. **Implement**, then run again. Expected: PASS.
- [ ] **Step 4: Run** `pnpm corpus:synthetic`. Expected: ≥14 files in `corpus/cases/`.
- [ ] **Step 5: Commit** `feat(corpus): synthetic edge-case generator and cases`

---

### Task 4: Block types + flip detector

**Files:**
- Create: `runner/metrics/blocks.ts`, `runner/metrics/flips.ts`
- Test: `runner/metrics/blocks.test.ts` (`// @vitest-environment happy-dom`), `runner/metrics/flips.test.ts`

**Interfaces:**
- Produces:
  - `BLOCK_TAGS = ["p","h1","h2","h3","h4","h5","h6","pre","ul","ol","blockquote","table","hr"]`
  - `blockTypes(container: Element, ignoreSelectors?: string[]): string[]`: for each top-level child that does not match an ignore selector, return the first element in pre-order (self included) whose tag is in `BLOCK_TAGS`, skipping ignored subtrees; otherwise `"other"`. Pure DOM, with no imports from Node.
  - `type FlipEvent = { chunk: number; index: number; from: string; to: string }`
  - `detectFlips(snaps: string[][], chunkIndexes: number[]): { flips: number; events: FlipEvent[] }`: `chunkIndexes[k]` is the chunk after which `snaps[k]` was taken.

- [ ] **Step 1: Write failing tests**

```ts
// flips.test.ts
test("appending blocks is not a flip", () =>
  expect(detectFlips([["p"], ["p", "pre"], ["p", "pre", "ul"]], [0, 1, 2]).flips).toBe(0));
test("p → h2 is one flip with event", () =>
  expect(detectFlips([["p"], ["h2"]], [3, 4])).toEqual({
    flips: 1,
    events: [{ chunk: 4, index: 0, from: "p", to: "h2" }],
  }));
test("split of last p into p,p is not a flip", () =>
  expect(detectFlips([["p"], ["p", "p"]], [0, 1]).flips).toBe(0));
test("disappearing block flips to ∅", () =>
  expect(detectFlips([["p", "hr"], ["p"]], [0, 1]).events[0]).toEqual({
    chunk: 1,
    index: 1,
    from: "hr",
    to: "∅",
  }));
test("counts every transition", () =>
  expect(detectFlips([["p"], ["ul"], ["p"]], [0, 1, 2]).flips).toBe(2));
test("empty input", () => expect(detectFlips([], []).flips).toBe(0));
// blocks.test.ts
test("unwraps wrappers", () =>
  expect(blockTypes(html(`<div><div><pre><code>x</code></pre></div></div><p>a</p>`))).toEqual([
    "pre",
    "p",
  ]));
test("table inside wrapper", () =>
  expect(blockTypes(html(`<div class="w"><table></table></div>`))).toEqual(["table"]));
test("ignoreSelectors drop nodes", () =>
  expect(blockTypes(html(`<button>Copy</button><p>a</p>`), ["button"])).toEqual(["p"]));
test("unknown → other", () => expect(blockTypes(html(`<span>x</span>`))).toEqual(["other"]));
```

- [ ] **Step 2: Run** `pnpm vitest run runner/metrics/flips runner/metrics/blocks`. Expected: FAIL. **Implement**, run again. Expected: PASS.
- [ ] **Step 3: Commit** `feat(metrics): block types and flip detector`

---

### Task 5: Reference renderer + HTML normalization

**Files:**
- Create: `runner/metrics/reference.ts`
- Test: `runner/metrics/reference.test.ts`

**Interfaces:**
- Produces:
  - `renderReference(md: string): string` = `micromark(md, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })`
  - `normalizeHtml(html: string): string`
  - `visibleText(html: string): string` (`hast-util-to-text` on the parsed fragment)
  - `htmlDiff(expected: string, actual: string): string`: unified diff (`diff.createTwoFilesPatch("reference","adapter",…)`), truncated to 4096 chars

Normalization rules (in order, on a `hast-util-from-html` fragment):
1. Remove `button`, `svg`, `script`, `style`, `template`, and any element with `aria-hidden="true"`, together with their content.
2. Unwrap (replace with children) `div`, `span`, `section`, `article`, `figure`.
3. Keep only these attributes: `a[href]`, `img[src,alt]`, `ol[start]`, `input[type,checked]`, `th|td[align]`. If `th`/`td` have `style="text-align: X"`, convert it to `align="X"`.
4. Text outside `pre`: collapse whitespace runs to one space; trim at block starts and ends; drop whitespace-only text between blocks. Inside `pre`: keep text exactly, except remove one trailing `\n`.
5. Serialize each top-level block on its own line.

- [ ] **Step 1: Write failing tests**

```ts
test("heading", () => expect(normalizeHtml(renderReference("# A"))).toBe("<h1>A</h1>"));
test("unwraps div/span, drops class", () =>
  expect(normalizeHtml(`<div class="x"><p><span>a</span> b</p></div>`)).toBe("<p>a b</p>"));
test("drops buttons and aria-hidden", () =>
  expect(
    normalizeHtml(
      `<div><button>Copy</button><pre><code class="language-js">x</code></pre><i aria-hidden="true">!</i></div>`,
    ),
  ).toBe("<pre><code>x</code></pre>"));
test("style text-align → align", () =>
  expect(normalizeHtml(`<table><tr><td style="text-align: center">a</td></tr></table>`)).toBe(
    normalizeHtml(`<table><tr><td align="center">a</td></tr></table>`),
  ));
test("pre: trailing newline ignored", () =>
  expect(normalizeHtml("<pre><code>a\n</code></pre>")).toBe(
    normalizeHtml("<pre><code>a</code></pre>"),
  ));
test("pre: indentation preserved", () =>
  expect(normalizeHtml("<pre><code>  a</code></pre>")).not.toBe(
    normalizeHtml("<pre><code>a</code></pre>"),
  ));
test("one block per line", () =>
  expect(normalizeHtml(renderReference("a\n\nb"))).toBe("<p>a</p>\n<p>b</p>"));
test("gfm table renders", () =>
  expect(normalizeHtml(renderReference("|a|\n|-|\n|1|"))).toContain("<table>"));
test("visibleText strips syntax", () =>
  expect(visibleText(renderReference("**b** [c](d)"))).toBe("b c"));
test("htmlDiff is capped", () =>
  expect(htmlDiff("a".repeat(9000), "b").length).toBeLessThanOrEqual(4096));
```

- [ ] **Step 2: Run** `pnpm vitest run runner/metrics/reference`. Expected: FAIL. **Implement**, run again. Expected: PASS.
- [ ] **Step 3: Commit** `feat(metrics): reference renderer and HTML normalization`

---

### Task 6: Raw-syntax leak detector

**Files:**
- Create: `runner/metrics/leaks.ts`
- Test: `runner/metrics/leaks.test.ts`

**Interfaces:**
- Produces:
  - `LEAK_TOKENS = ["**", "__", "\`\`\`", "~~~", "]("] as const`; `type LeakToken = typeof LEAK_TOKENS[number]`
  - `findLeakTokens(text: string): LeakToken[]`: tokens present in the text, in `LEAK_TOKENS` order. Pure; bundled into the page.
  - `countLeaks(perSnapshot: LeakToken[][], snapshotChunks: number[], referenceVisible: string): { snapshots: number; firstChunk: number | null }`: a snapshot leaks if it contains a token that is absent from `findLeakTokens(referenceVisible)`.

- [ ] **Step 1: Write failing tests**

```ts
test("finds bold opener", () => expect(findLeakTokens("hello **wor")).toEqual(["**"]));
test("finds link mid-url", () => expect(findLeakTokens("[a](ht")).toEqual(["]("]));
test("counts snapshots, not tokens", () =>
  expect(countLeaks([["**", "]("], [], ["**"]], [0, 1, 2], "plain")).toEqual({
    snapshots: 2,
    firstChunk: 0,
  }));
test("tokens present in reference are not leaks", () =>
  expect(countLeaks([["**", "__"]], [5], "def f(**kwargs): __init__").snapshots).toBe(0));
test("no leaks → null firstChunk", () =>
  expect(countLeaks([[], []], [0, 1], "x")).toEqual({ snapshots: 0, firstChunk: null }));
```

- [ ] **Step 2: Run** `pnpm vitest run runner/metrics/leaks`. Expected: FAIL. **Implement**, run again. Expected: PASS.
- [ ] **Step 3: Commit** `feat(metrics): raw syntax leak detector`

---

### Task 7: Accessibility-tree churn

**Files:**
- Create: `runner/metrics/a11y.ts`
- Test: `runner/metrics/a11y.test.ts`

**Interfaces:**
- Produces:
  - `type AriaNode = { path: string; role: string; name: string }` (`path` = sibling indexes joined by `/`, e.g. `"0/2"`)
  - `parseAriaSnapshot(yaml: string): AriaNode[]` parses Playwright's `locator.ariaSnapshot()` output: `- role "quoted name" [attrs]: trailing text`. The name is the quoted string, otherwise the trailing text (unquote it if YAML-quoted). The role for a `- text: …` line is `text`. Indentation (2 spaces) defines nesting.
  - `diffA11y(prev: AriaNode[], cur: AriaNode[]): number`: for each prev node, add +1 if its path is missing in cur, +1 if the role changed, +1 if the name changed and `!cur.name.startsWith(prev.name)` (pure growth is not churn).

- [ ] **Step 1: Write failing tests**

```ts
const y = `- heading "Title" [level=2]\n- paragraph: hello wor\n- list:\n  - listitem: a`;
test("parses roles, names, paths", () =>
  expect(parseAriaSnapshot(y)).toEqual([
    { path: "0", role: "heading", name: "Title" },
    { path: "1", role: "paragraph", name: "hello wor" },
    { path: "2", role: "list", name: "" },
    { path: "2/0", role: "listitem", name: "a" },
  ]));
test("text growth is not churn", () =>
  expect(
    diffA11y(parseAriaSnapshot("- paragraph: hel"), parseAriaSnapshot("- paragraph: hello")),
  ).toBe(0));
test("role change is churn", () =>
  expect(
    diffA11y(
      parseAriaSnapshot("- paragraph: Title"),
      parseAriaSnapshot(`- heading "Title" [level=2]`),
    ),
  ).toBe(1));
test("rename is churn", () =>
  expect(diffA11y(parseAriaSnapshot("- paragraph: **b"), parseAriaSnapshot("- paragraph: b"))).toBe(
    1,
  ));
test("removed node is churn", () =>
  expect(
    diffA11y(parseAriaSnapshot("- paragraph: a\n- separator"), parseAriaSnapshot("- paragraph: a")),
  ).toBe(1));
```

- [ ] **Step 2: Run** `pnpm vitest run runner/metrics/a11y`. Expected: FAIL. **Implement**, run again. Expected: PASS.
- [ ] **Step 3: Commit** `feat(metrics): accessibility tree churn`

---

### Task 8: Harness page, adapter interface, react-markdown baseline, contract test

**Files:**
- Create: `adapters/types.ts`, `adapters/react-markdown-baseline.tsx`, `adapters/test-only/broken.ts`, `adapters/test-only/hang.ts`
- Create: `harness/package.json`, `harness/vite.config.ts`, `harness/index.html`, `harness/src/{main.ts,bench-api.ts,registry.ts,settle.ts,base.css}`
- Create: `runner/server.ts`, `tests/browser/{global-setup.ts,helpers.ts,contract.test.ts}`
- Modify: `vitest.config.ts` (add project `browser`), root `package.json` (deps `react`, `react-dom`, `react-markdown`, `remark-gfm`, `playwright`, `micromark`, `micromark-extension-gfm`, `hast-util-from-html`, `hast-util-to-text`, `diff`; script `"build:harness": "pnpm --filter harness build"`)

Adapter library deps go in the **root** `package.json`: Vite resolves bare imports from `adapters/` upward to the root `node_modules`.

**Interfaces:**
- Consumes: `blockTypes` (Task 4), `findLeakTokens`/`LeakToken` (Task 6), `Chunk` (Task 1)
- Produces:
  - `adapters/types.ts`: the spec's `RendererAdapter` plus optional `ignoreSelectors?: string[]`. Global `declare const __VERSIONS__: Record<string, string>`.
  - `harness/src/registry.ts`: `export const registry: Record<string, () => Promise<{ default: RendererAdapter }>>`, keys `react-markdown-baseline`, `__broken`, `__hang` (more keys in Tasks 9–10).
  - `harness/src/bench-api.ts`:

    ```ts
    type ChunkProbe = { blocks: string[]; leakTokens: LeakToken[] };
    type FinalProbe = { html: string; cls: number; liveRegionUpdates: number };
    type ReplayProbe = { frameTimes: number[]; longTasks: number; totalMs: number };
    interface BenchApi {
      ready: Promise<{ name: string; version: string; ignoreSelectors: string[] }>;
      mount(): void;
      push(delta: string): void;                 // no settle (stride pushes)
      pushAndSettle(delta: string): Promise<ChunkProbe>;
      endAndSettle(): Promise<FinalProbe>;
      replay(chunks: Chunk[], mode: "realtime" | "flood", timeScale: number): Promise<ReplayProbe>;
      unmount(): void;
    }
    ```

    The page reads `?adapter=<name>`, mounts into `<div id="root">`, and exposes `window.__bench`.
  - `settle(): Promise<void>` = two `requestAnimationFrame`s, then `setTimeout(0)`.
  - `serveDir(dir: string): Promise<{ url: string; close(): Promise<void> }>` (`node:http`, random port, `index.html` fallback for `/`, 404 otherwise).
  - `tests/browser/helpers.ts`: `openHarness(adapter: string): Promise<Page>` navigates to `${url}/?adapter=…` and awaits `__bench.ready`.

In-page probe details:
- `leakTokens` = `findLeakTokens(root.innerText)`.
- `html` = a clone of `#root` with `ignoreSelectors` removed, then its `innerHTML`.
- `cls` = sum of `layout-shift` entries with `!hadRecentInput` since `mount()`.
- `liveRegionUpdates` = number of MutationObserver records (subtree, childList, characterData, attributes) whose target is inside `[aria-live]:not([aria-live="off"]),[role="status"],[role="log"],[role="alert"]`.
- `replay`:
  - `realtime` pushes every chunk with `t / timeScale ≤ elapsed` on each rAF.
  - `flood` pushes each chunk, then yields one macrotask via `MessageChannel`.
  - Both call `end()` and `settle()`. `frameTimes` = rAF deltas over the whole replay. `longTasks` = `longtask` entries during replay.
- `vite.config.ts` defines `__VERSIONS__` by reading `<root>/node_modules/<pkg>/package.json` with `fs` for each adapter package. Baseline: `react-markdown` with `remarkPlugins={[remarkGfm]}`, re-rendered from the accumulated text on each push via `root.render`.
- `__broken` throws on its 2nd `push`. `__hang` runs `while (true) {}` on its 2nd `push`.

- [ ] **Step 1: Write the failing contract test** `tests/browser/contract.test.ts`

````ts
const FIXTURES = {
  paragraph: "Hello *world*\n",
  list: "- a\n- b\n",
  code: "```js\nconst a = 1;\n```\n",
};
for (const name of Object.keys(registry).filter((n) => !n.startsWith("__")))
  for (const [fx, md] of Object.entries(FIXTURES))
    test(`${name} renders ${fx}`, async () => {
      const page = await openHarness(name);
      const final = await page.evaluate(async (md) => {
        __bench.mount();
        await __bench.pushAndSettle(md);
        return __bench.endAndSettle();
      }, md);
      expect(normalizeHtml(final.html)).toBe(normalizeHtml(renderReference(md)));
    });
test("ready reports a real version", async () =>
  expect(
    (await (await openHarness("react-markdown-baseline")).evaluate(() => __bench.ready)).version,
  ).toMatch(/^\d+\.\d+\.\d+/));
````
Vitest project `browser`: include `tests/browser/**/*.test.ts`, globalSetup `tests/browser/global-setup.ts` (runs `pnpm build:harness`, starts `serveDir("harness/dist")`, provides the URL via `project.provide`), `testTimeout: 60_000`, `fileParallelism: false`.

- [ ] **Step 2: Run** `pnpm vitest run --project browser`. Expected: FAIL.
- [ ] **Step 3: Implement** the harness, the adapters, `serveDir` and the helpers as specified above.
- [ ] **Step 4: Run** `pnpm exec playwright install chromium`, then `pnpm vitest run --project browser`. Expected: PASS (4 tests).
- [ ] **Step 5: Commit** `feat(harness): bench page, adapter interface, react-markdown baseline`

---

### Task 9: Vanilla adapters — streaming-markdown and marked re-parse

**Files:**
- Create: `adapters/streaming-markdown.ts`, `adapters/marked-reparse.ts`
- Modify: `harness/src/registry.ts`, `harness/vite.config.ts` (versions), root `package.json` (deps `streaming-markdown`, `marked`)

**Interfaces:**
- Consumes: `RendererAdapter`, registry (Task 8)
- Produces: registry keys `streaming-markdown` and `marked-reparse`

- `streaming-markdown`: `smd.parser(smd.default_renderer(el))`; `push` → `smd.parser_write`; `end` → `smd.parser_end`.
- `marked-reparse`: accumulate text; on each push set `el.innerHTML = marked.parse(text, { gfm: true, async: false })`.

- [ ] **Step 1: Register both adapters.** The Task 8 contract test now covers them automatically.
- [ ] **Step 2: Run** `pnpm vitest run --project browser`. Expected: FAIL for the new keys until they are implemented.
- [ ] **Step 3: Implement** both adapters. If a fixture mismatch is a real normalization gap (not an adapter bug), fix it in `normalizeHtml` with a new unit test in Task 5's test file. Never special-case an adapter in the normalizer.
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(adapters): streaming-markdown and marked re-parse baseline`

---

### Task 10: Streamdown adapter

**Files:**
- Create: `adapters/streamdown.tsx`
- Modify: `harness/src/registry.ts`, `harness/vite.config.ts`, root `package.json` (dep `streamdown`)

**Interfaces:**
- Produces: registry key `streamdown`

React root re-rendering `<Streamdown>{accumulatedText}</Streamdown>` with default props. `ignoreSelectors`: whatever Streamdown renders around code blocks and tables that is not content (inspect real output; e.g. its controls / language header). List the selectors in the adapter file with a one-line comment for each.

- [ ] **Step 1: Register** the adapter.
- [ ] **Step 2: Run** `pnpm vitest run --project browser`. Expected: FAIL.
- [ ] **Step 3: Implement**, then inspect `final.html` for the three fixtures and set `ignoreSelectors`.
- [ ] **Step 4: Run** `pnpm vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(adapters): streamdown`

---

### Task 11: Fidelity pass, result types, error/timeout guard

**Files:**
- Create: `runner/types.ts`, `runner/guard.ts`, `runner/fidelity.ts`, `runner/results.ts`
- Test: `tests/browser/fidelity.test.ts`

**Interfaces:**
- Consumes: `rechunk`, `ChunkPolicy` (2); `detectFlips`, `FlipEvent` (4); `renderReference`, `normalizeHtml`, `visibleText`, `htmlDiff` (5); `countLeaks` (6); `parseAriaSnapshot`, `diffA11y` (7); `BenchApi`, `openHarness` (8)
- Produces (`runner/types.ts`):

  ```ts
  type FidelityResult = { chunks: number; stride: number; flips: number; flipEvents: FlipEvent[]; cls: number;
    leakSnapshots: number; firstLeakChunk: number | null; liveRegionUpdates: number; a11yChurn: number;
    finalMatch: boolean; finalDiff?: string };
  type PerfSample = { frameP50: number; frameP95: number; longTasks: number; totalMs: number; peakHeapBytes: number };
  type PerfStats = { timeScale: number; runs: PerfSample[]; median: PerfSample; p95: PerfSample };
  type Env = { os: string; node: string; browser: string; cpuThrottle: 4; perfRuns: number; adapters: Record<string, string>; commit: string | null };
  type RunResult = { schemaVersion: 1; date: string; adapter: { name: string; version: string }; caseId: string;
    policy: ChunkPolicy; seed: number; env: Env; status: "ok" | "error" | "timeout"; error?: string;
    fidelity?: FidelityResult; perf?: { realtime: PerfStats; flood: PerfStats } };
  ```

  - `MAX_SNAPSHOTS = 1500`; `fidelityTimeoutMs(snapshots: number) = 60_000 + 100 * snapshots`
  - `runGuarded<T>(page: Page, timeoutMs: number, fn: () => Promise<T>): Promise<{ status: "ok"; value: T } | { status: "error" | "timeout"; error: string }>`: races `fn` against the timeout and the page's `pageerror`; on timeout it closes the page.
  - `runFidelity(page: Page, c: StreamCase, chunks: Chunk[]): Promise<FidelityResult>`: mount; for each chunk call `pushAndSettle` when `i % stride === stride - 1 || i === last`, otherwise `push`; at each snapshot read `#root` `ariaSnapshot()`; then `endAndSettle`; compute every field (`flipEvents` capped at 50); `finalDiff` only when no match.
  - `writeResult(root: string, r: RunResult): Promise<string>` → `results/<date>/<adapter>/<caseId>.<policy>.json`; `readResults(dir: string): Promise<RunResult[]>`

- [ ] **Step 1: Write failing tests**

```ts
const setext: StreamCase = {
  id: "t-setext",
  source: "synthetic",
  tags: [],
  text: "Title\n--\n",
  chunks: [
    { delta: "Title\n", t: 0 },
    { delta: "-", t: 30 },
    { delta: "-\n", t: 60 },
  ],
};
test("baseline flips p → h2 on setext", async () => {
  const r = await runFidelity(await openHarness("react-markdown-baseline"), setext, setext.chunks);
  expect(r.flips).toBeGreaterThanOrEqual(1);
  expect(r.flipEvents[0]).toMatchObject({ from: "p", to: "h2" });
  expect(r.finalMatch).toBe(true);
});
test("leak counted on half-open bold", async () => {
  const c = caseFrom(["hello **wor", "ld**"]);
  expect((await runFidelity(await openHarness("marked-reparse"), c, c.chunks)).leakSnapshots).toBe(
    1,
  );
});
test("replay is deterministic", async () => {
  const c = await loadSynth("synth-table-row");
  const ch = rechunk(c, "random");
  const a = await runFidelity(await openHarness("streaming-markdown"), c, ch),
    b = await runFidelity(await openHarness("streaming-markdown"), c, ch);
  expect(a).toEqual(b);
});
test("stride caps snapshots", async () => {
  /* 4000 one-char chunks */ expect((await runFidelity(page, big, big.chunks)).stride).toBe(3);
});
test("throwing adapter → error, message kept", async () => {
  const page = await openHarness("__broken");
  const g = await runGuarded(page, 5_000, () => runFidelity(page, setext, setext.chunks));
  expect(g.status).toBe("error");
  expect(g.error).toMatch(/./);
});
test("hanging adapter → timeout", async () => {
  const hangPage = await openHarness("__hang");
  expect(
    (await runGuarded(hangPage, 2_000, () => runFidelity(hangPage, setext, setext.chunks))).status,
  ).toBe("timeout");
});
test("writeResult path layout", async () =>
  expect(await writeResult(tmp, sample)).toMatch(
    /2026-10-24[\\/]react-markdown-baseline[\\/]t-setext\.token\.json$/,
  ));
```
(`caseFrom(deltas)` builds a valid case with `t = 30·i`.)

- [ ] **Step 2: Run** `pnpm vitest run tests/browser/fidelity.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** types, guard, fidelity and results as specified.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(runner): fidelity pass, result files, error/timeout guard`

---

### Task 12: Perf pass, matrix, aggregation, one-command CLI

**Files:**
- Create: `runner/metrics/stats.ts`, `runner/perf.ts`, `runner/matrix.ts`, `runner/env.ts`, `runner/aggregate.ts`, `runner/cli.ts`
- Test: `runner/metrics/stats.test.ts`, `runner/matrix.test.ts`, `runner/aggregate.test.ts`, `tests/browser/cli.test.ts`
- Modify: root `package.json`: `"bench": "pnpm build:harness && tsx runner/cli.ts"`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `percentile(values: number[], p: number): number` (nearest-rank, p in [0,100]); `median(values) = percentile(values, 50)`
  - `REALTIME_MAX_MS = 60_000`; `timeScaleFor(chunks: Chunk[]) = Math.max(1, last.t / REALTIME_MAX_MS)`; `PERF_RUN_TIMEOUT_MS = 120_000`
  - `runPerf(page: Page, chunks: Chunk[], mode: "realtime" | "flood"): Promise<PerfSample>`: CDP session, `Performance.enable`, `Emulation.setCPUThrottlingRate {rate: 4}`, poll `Performance.getMetrics` `JSHeapUsedSize` every 100 ms for the peak, call `__bench.replay`, compute frame p50/p95 with `percentile`. Use a fresh page per run.
  - `summarizePerf(runs: PerfSample[], timeScale: number): PerfStats`: per-field median and p95
  - `type MatrixEntry = { adapter: string; caseId: string; policy: ChunkPolicy; perf: boolean }`
  - `buildMatrix(cases: StreamCase[], adapters: string[], policies: ChunkPolicy[], withPerf: boolean): MatrixEntry[]`: drops `__*` adapters; drops `random`/`adversarial` when `text.length > RECHUNK_MAX_CHARS`; `perf` only on `token`.
  - `captureEnv(browser: Browser, perfRuns: number, versions: Record<string,string>): Env` (`commit` from `git rev-parse HEAD`, or null)
  - `type AdapterSummary = { key: string; name: string; version: string; runs: number; errors: number; timeouts: number;
      stability: { flipsTotal: number; casesWithFlips: number; clsMedian: number };
      correctness: { finalMatchRate: number; leakSnapshotsTotal: number; casesWithLeaks: number };
      a11y: { liveRegionUpdatesTotal: number; a11yChurnTotal: number };
      perf: Record<"realtime" | "flood", { frameP95: number; longTasks: number; totalMs: number; peakHeapBytes: number } | null> }`
    `type Summary = { generatedAt: string; date: string; env: Env; adapters: AdapterSummary[] }`
  - `aggregate(results: RunResult[]): Summary`: key `name@version`; metrics only from `status === "ok"`; perf fields = median over cases of each case's `median`.
  - `aggregateDir(resultsRoot: string): Promise<Summary>`: newest `YYYY-MM-DD` dir only
  - `main(argv: string[]): Promise<number>`: flags `--adapters a,b`, `--cases id,prefix*`, `--policies`, `--perf-runs` (default 5), `--no-perf`, `--smoke` (= cases `synth-bold-open,synth-fence-open`, policy `token`, perf-runs 1), `--date`, `--out` (default `results`). Builds the matrix, runs each entry under `runGuarded`, writes results, writes `results/summary.json`, logs one progress line per entry, and returns exit code 0 even if some entries errored (errors are data).

- [ ] **Step 1: Write failing unit tests**

```ts
test("percentile nearest-rank", () => {
  expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  expect(percentile([1, 2, 3, 4, 5], 95)).toBe(5);
  expect(percentile([7], 95)).toBe(7);
});
test("matrix skips rechunk for long cases", () =>
  expect(
    buildMatrix([longCase], ["a"], ["token", "random", "adversarial"], true).map((e) => e.policy),
  ).toEqual(["token"]));
test("matrix: perf only on token, no __ adapters", () => {
  const m = buildMatrix([shortCase], ["a", "__hang"], ["token", "random"], true);
  expect(m).toEqual([
    { adapter: "a", caseId: shortCase.id, policy: "token", perf: true },
    { adapter: "a", caseId: shortCase.id, policy: "random", perf: false },
  ]);
});
test("aggregate keys by name@version and ignores errored metrics", () => {
  const s = aggregate([
    ok("x", "1.0.0", { flips: 2 }),
    err("x", "1.0.0"),
    ok("x", "2.0.0", { flips: 0 }),
  ]);
  expect(s.adapters.map((a) => a.key)).toEqual(["x@1.0.0", "x@2.0.0"]);
  expect(s.adapters[0]).toMatchObject({
    runs: 2,
    errors: 1,
    stability: { flipsTotal: 2, casesWithFlips: 1 },
  });
});
test("finalMatchRate", () =>
  expect(
    aggregate([ok("x", "1", { finalMatch: true }), ok("x", "1", { finalMatch: false })]).adapters[0]
      .correctness.finalMatchRate,
  ).toBe(0.5));
```

- [ ] **Step 2: Run** `pnpm vitest run --project unit`. Expected: FAIL. **Implement** stats, matrix and aggregate, then run again. Expected: PASS.
- [ ] **Step 3: Write the failing CLI smoke test** `tests/browser/cli.test.ts`

```ts
test("smoke run writes valid results and summary", async () => {
  expect(await main(["--smoke", "--out", tmp, "--date", "2026-10-24"])).toBe(0);
  const rs = await readResults(join(tmp, "2026-10-24"));
  expect(rs.length).toBe(2 * 4); // 2 cases × 4 adapters, token only
  expect(
    rs.every((r) => r.status === "ok" && r.fidelity && r.perf?.realtime.runs.length === 1),
  ).toBe(true);
  expect(JSON.parse(await readFile(join(tmp, "summary.json"), "utf8")).adapters).toHaveLength(4);
}, 300_000);
```

- [ ] **Step 4: Implement** perf, env and cli. **Run** `pnpm vitest run tests/browser/cli.test.ts`. Expected: PASS.
- [ ] **Step 5: Run** `pnpm bench --smoke`. Expected: progress lines, `results/<today>/…` and `results/summary.json` written, exit 0.
- [ ] **Step 6: Commit** `feat(runner): perf pass, matrix, aggregation, bench CLI`

---

### Task 13: Recorder + real LLM corpus

**Files:**
- Create: `recorder/to-case.ts`, `recorder/record.ts`, `corpus/prompts/*.md`, `corpus/cases/{claude,gpt}-*.json`
- Test: `recorder/to-case.test.ts`
- Modify: root `package.json` (deps `@anthropic-ai/sdk`, `openai`; script `"record": "tsx recorder/record.ts"`)

**Interfaces:**
- Consumes: `StreamCase`, `validateCase`
- Produces:
  - `toCase(events: { delta: string; atMs: number }[], meta: { id: string; source: "claude" | "gpt"; tags: string[] }): StreamCase`: replaces `\r\n` with `\n`, drops empty deltas, `t = round(atMs - events[0].atMs)`
  - CLI `pnpm record --provider claude|gpt --model <id> --prompt corpus/prompts/<id>.md --id <id> --tags a,b [--max-tokens N]`. Claude uses `client.messages.stream(...)` with the `text` event. OpenAI uses streamed chat completions with `choices[0].delta.content`. Both read the key from `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`. `--model` is required (no baked-in default). The CLI writes `corpus/cases/<id>.json` after `validateCase`.

- [ ] **Step 1: Write failing tests**

```ts
test("relative t and CRLF normalization", () =>
  expect(
    toCase(
      [
        { delta: "a\r\n", atMs: 1000 },
        { delta: "", atMs: 1001 },
        { delta: "b", atMs: 1040.6 },
      ],
      meta,
    ),
  ).toMatchObject({
    text: "a\nb",
    chunks: [
      { delta: "a\n", t: 0 },
      { delta: "b", t: 41 },
    ],
  }));
test("output validates", () => expect(validateCase(toCase(evts, meta)).ok).toBe(true));
```

- [ ] **Step 2: Run** `pnpm vitest run recorder`. Expected: FAIL. **Implement** `toCase` and `record.ts`, then run again. Expected: PASS.
- [ ] **Step 3: Write 18 prompts** (10 Claude, 8 GPT), freshly authored, with no employer content. Cover: wide tables (2), nested lists (2), multi-language code blocks (3), link-heavy answers (2), heading-structured docs (2), mixed everything (3), task lists + blockquotes (2), long answers of ~50k tokens (2, tag `long`).
- [ ] **Step 4: Record** them (the user supplies API keys). Then run `pnpm vitest run --project unit` and check that `loadCases("corpus/cases")` returns ≥32 cases.
- [ ] **Step 5: Commit** `feat(recorder): LLM stream recorder and recorded corpus`

---

### Task 14: CI + README methodology

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

- [ ] **Step 1: CI** on `pull_request` and `push` to `main`, `ubuntu-latest`: checkout, pnpm setup, Node 22, `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, `pnpm test`, `pnpm bench --smoke --out ci-results`; upload `ci-results` as an artifact.
- [ ] **Step 2: README** sections:
  - what is measured and why;
  - one subsection per metric that links its source file under `runner/metrics/` (flips, leaks, CLS, live-region updates, a11y churn, final match + the normalization rules);
  - the plan-level decisions (two passes, caps, compression, styling);
  - how to run (`pnpm install`, `pnpm test`, `pnpm bench`);
  - **how to add a library** (one file in `adapters/` + one registry line + a version entry in `vite.config.ts`; the contract test must pass);
  - corpus policy (no proprietary content).
- [ ] **Step 3: Verify** a full local run `pnpm test && pnpm bench` finishes and `results/summary.json` has 4 adapters. Push a branch and confirm CI is green.
- [ ] **Step 4: Commit** `ci: tests and smoke bench; docs: methodology README`

---

## Spec coverage map

| Spec item                                                                 | Task                          |
| ------------------------------------------------------------------------- | ----------------------------- |
| §4.1 schema, real + synthetic cases, 3 chunking policies                  | 1, 2, 3, 13                   |
| §4.2 adapter interface, separate bundles, ≥4 adapters incl. baseline      | 8, 9, 10                      |
| §4.3 runner, realtime/flood, controlled clock                             | 8 (replay), 11, 12            |
| §4.4 perf / CLS / flips / final match / leaks / live regions / a11y churn | 12 / 8+11 / 4 / 5 / 6 / 8 / 7 |
| §4.4 manual NVDA/VoiceOver notes                                          | Plan 2                        |
| §4.5 results per run + env + summary.json                                 | 11, 12                        |
| §4.6 site, §3.4–3.6 article/upstream                                      | Plan 2                        |
| §7 error/timeout, 5 runs, 4× throttle, determinism, version keying        | 11, 12                        |
| §8 unit, contract, smoke, determinism tests                               | 1–7, 8, 12, 11                |
| §3.7 one command + CI                                                     | 12, 14 (site build → Plan 2)  |
