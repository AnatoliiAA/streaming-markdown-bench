# Stage 1 — Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `packages/ui` ships light/dark tokens and the 12 components the results site needs. Each component has behavior + axe tests, a story per visual state, and Linux-generated visual-regression baselines. Storybook builds statically, and one shared browser spec screenshots and axe-checks every story in both themes.

**Architecture:** Tasks 1–3 build the foundation:
- the component test harness (React, Testing Library, axe in `bun test`);
- tokens with machine-checked contrast and a raw-value guard;
- Storybook, the shared story spec (VR + browser axe) and a CI workflow that generates baselines on Linux.

Tasks 4–15 are one component each. Every component task follows the `ds-component` skill and is reviewed with `component-review`.

**Tech Stack:** Bun 1.4.4, React 19, react-aria-components, Testing Library (+ user-event, jest-dom), axe-core, CSS Modules, Storybook (react-vite), Playwright 1.64.1, @fontsource-variable (Inter, JetBrains Mono), sirv-cli.

**Spec:** `docs/superpowers/specs/2026-10-24-workflow-and-architecture-design.md` (§2 Stage 1, §3 process, §5.3 design system, §5.4 tooling). Product context: `docs/superpowers/specs/2026-10-24-streaming-markdown-bench-design.md` §4.6 (site needs).

## Global Constraints

- Visual direction ("lab instrument"; author's choice, 2026-10-25):
  - neutral grays and ONE accent hue (blue);
  - Inter for UI text, JetBrains Mono for numbers and code;
  - dense, data-first layouts with minimal decoration;
  - numbers use `font-variant-numeric: tabular-nums`.
- Fonts are self-hosted via `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` (no CDN, no system fallback reliance), so VR is deterministic.
- Theming:
  - `:root` holds the light values;
  - dark values appear in BOTH `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }`, and the two blocks must be identical;
  - color tokens are hex literals only (`#rrggbb`), so contrast can be computed.
- No raw colors or sizes in `packages/ui/src/components/**/*.module.css`: only `var(--…)`, `0`, `100%`, `auto`, `inherit`, `currentColor`, `none`, `transparent`. Enforced by a test (Task 2).
- Contrast is enforced by a test (Task 2):
  - text pairs ≥ 4.5:1;
  - UI/graphical pairs (borders of inputs, accent on bg, focus ring on bg) ≥ 3:1;
  - both themes.
- `prefers-reduced-motion: reduce` sets every `--duration-*` token to `0ms`.
- Components:
  - interactive behavior via `react-aria-components` only;
  - variant/state is exposed as `data-*` attributes (React Aria's own `data-pressed`, `data-selected`, … plus our `data-variant`, `data-status`, `data-size`);
  - tests assert roles, text, ARIA and `data-*`, never CSS class names.
- Unit axe runs in happy-dom with `color-contrast` disabled (happy-dom can't compute it). Full axe incl. contrast runs in the browser story spec (Task 3).
- VR:
  - one shared spec `tests/browser/stories.pw.ts`;
  - baselines only from CI Linux: `.github/workflows/vr-update.yml` produces an artifact, which the agent downloads and commits;
  - local VR assertions are skipped on non-Linux; axe still runs.
- `packages/ui` dependencies: `react`, `react-dom` are `peerDependencies` of `@smb/ui` and root devDependencies; `react-aria-components` is a dependency of `@smb/ui`. Pin every new package exactly (no `^`).
- PRs (spec §3.3), one branch per component group:
  - `feat/ui-foundation` (Tasks 1–3);
  - `feat/ui-primitives` (Tasks 4–9);
  - `feat/ui-controls` (Tasks 10–15).

  Each PR is opened as a draft and goes ready after the group review; the author merges.
- Process (retro 2026-10-25):
  - Tasks 1–3 get a task review each.
  - Tasks 4–15 get `component-review` (fresh subagent).
  - must-fix items are fixed immediately; nits are collected in the ledger for the group review at the end of each PR.

## Review Focus

1. **Keyboard-only users.** Every interactive control is operable with Tab/Enter/Space/Arrows/Escape and shows a visible focus ring in both themes. Pinned by: each control task's keyboard test plus a `Focused` story (VR shows the ring).
2. **OS dark mode without `data-theme`.** The page follows `prefers-color-scheme`. Pinned by: Task 2 "dark blocks identical" test and Task 3 browser test with `colorScheme: "dark"` and no `data-theme`.
3. **Reduced motion.** No transitions or animations when `prefers-reduced-motion: reduce`. Pinned by: Task 2 token test; Task 3 sets `reducedMotion: "reduce"` in the story spec.
4. **Long content and narrow viewports.** Long labels wrap, wide tables and code scroll inside a keyboard-focusable region, and nothing overflows the page. Pinned by: `LongContent` stories in CodeBlock (Task 7) and Table (Task 15), with full axe (`scrollable-region-focusable`) in the browser spec.
5. **Running VR on a Windows dev machine.** Screenshot assertions are skipped with a clear reason, not failed, and axe still runs. Pinned by: Task 3 test that the platform gate is applied.

---

## File Structure

```
packages/ui/
  package.json                    exports ".", "./styles.css"; peer react/react-dom; dep react-aria-components
  .storybook/main.ts, preview.tsx  Vite builder; theme global → data-theme on <html>; imports ../src/styles.css
  src/
    index.ts                      public API (re-exports components + types)
    styles.css                    @import fonts + tokens/*.css + base.css
    css-modules.d.ts              declare module "*.module.css"
    tokens/
      color.css space.css typography.css radius.css motion.css z.css
      tokens.test.ts              contrast pairs, identical dark blocks, reduced motion
    base.css                      box-sizing, body font/colors, :focus-visible fallback
    test/
      index.ts                    renderUI, expectNoAxeViolations, user (re-exports)
      no-raw-values.test.ts       guard over components/**/*.module.css
    foundations/Tokens.stories.tsx   swatches + type scale (first story; proves the pipeline)
    components/<Name>/{<Name>.tsx,.module.css,.test.tsx,.stories.tsx,index.ts}
tests/setup/
  happy-dom.ts                    (exists) + jest-dom matchers + css-modules plugin
  css-modules.ts                  Bun.plugin: *.module.css → Proxy(key → key)
tests/browser/
  stories.pw.ts                   shared: every story × light/dark → axe (full) + screenshot
  __screenshots__/                Linux baselines (CI-generated)
playwright.config.ts              + webServer (build storybook, serve with sirv) + snapshotPathTemplate
.github/workflows/ci.yml          + storybook build via webServer (no change if webServer covers it)
.github/workflows/vr-update.yml   workflow_dispatch(branch) → --update-snapshots → commit to branch
```

---

## Group A — Foundation (`feat/ui-foundation`, branch exists)

### Task 1: Component test harness

**Files:**
- Create: `tests/setup/css-modules.ts`, `packages/ui/src/css-modules.d.ts`, `packages/ui/src/test/index.ts`, `packages/ui/src/test/harness.test.tsx`, `packages/ui/src/test/fixture.module.css` (`.root {}`)
- Modify: `tests/setup/happy-dom.ts` (register jest-dom matchers), `bunfig.toml` (preload css-modules), `package.json` (devDeps: react, react-dom, @types/react, @types/react-dom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, axe-core; exact pins), `packages/ui/package.json` (peerDependencies react/react-dom), `packages/ui/tsconfig.json` (types for jest-dom if needed)

**Interfaces:**
- Produces (`packages/ui/src/test/index.ts`, test-only, never exported from the package index):
  - `renderUI(ui: ReactElement): RenderResult` (Testing Library `render`; cleanup after each test)
  - `user`: `userEvent.setup()` factory → `setupUser(): UserEvent`
  - `expectNoAxeViolations(container: Element): Promise<void>`: runs `axe.run(container, { rules: { "color-contrast": { enabled: false } } })` and throws with the violations' ids, help and target selectors when there are any.
- `*.module.css` imports resolve in `bun test` to a Proxy where `styles.foo === "foo"`.

- [ ] **Step 1: Failing tests** `packages/ui/src/test/harness.test.tsx`

```tsx
test("renders React and queries by role", () => {
  renderUI(<button type="button">Go</button>);
  expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
});
test("axe passes on accessible markup", async () => {
  const { container } = renderUI(<img src="x.png" alt="Chart" />);
  await expectNoAxeViolations(container);
});
test("axe fails on inaccessible markup and names the rule", async () => {
  const { container } = renderUI(<img src="x.png" />);
  await expect(expectNoAxeViolations(container)).rejects.toThrow(/image-alt/);
});
test("css modules map keys to themselves", async () => {
  const styles = (await import("./fixture.module.css")).default;   // tiny fixture file next to the test
  expect(styles.root).toBe("root");
});
test("user-event drives keyboard", async () => {
  const u = setupUser(); const onClick = mock(); renderUI(<button type="button" onClick={onClick}>Go</button>);
  await u.tab(); await u.keyboard("{Enter}"); expect(onClick).toHaveBeenCalledTimes(1);
});
```
- [ ] **Step 2: Run** `bun test packages/ui/src/test`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.**
  - Install the deps.
  - `css-modules.ts`: `Bun.plugin({ setup(b) { b.onLoad({ filter: /\.module\.css$/ }, () => ({ exports: { default: new Proxy({}, { get: (_, k) => String(k) }) }, loader: "object" })) } })`.
  - Register `@testing-library/jest-dom/matchers` via `expect.extend` in the happy-dom preload.
- [ ] **Step 4: Run** the same command (PASS), then `bun run check` and `bun run check:all` (exit 0; the boundary matrix must still pass with React present).
- [ ] **Step 5: Commit** `test(ui): component test harness (React, Testing Library, axe, css modules)`

---

### Task 2: Tokens, fonts, base styles + guards

**Files:**
- Create: `packages/ui/src/tokens/{color,space,typography,radius,motion,z}.css`, `packages/ui/src/tokens/tokens.test.ts`, `packages/ui/src/base.css`, `packages/ui/src/styles.css`, `packages/ui/src/test/no-raw-values.test.ts`
- Modify: `packages/ui/package.json` (`exports["./styles.css"] = "./src/styles.css"`; deps `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` exact)

**Interfaces:**
- Produces token names (the only names components may use):
  - color: `--color-bg`, `--color-bg-subtle`, `--color-surface`, `--color-border`, `--color-border-strong`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-hover`, `--color-on-accent`, `--color-focus-ring`, and `--color-status-{match,diff,error,timeout}-{fg,bg}`
  - space: `--space-0`…`--space-8` = 0, 0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3 rem
  - typography:
    - `--font-sans` (Inter Variable + system fallback), `--font-mono` (JetBrains Mono Variable + mono fallback);
    - `--font-size-{xs,sm,md,lg,xl,2xl}` = 0.75, 0.875, 1, 1.125, 1.375, 1.75 rem;
    - `--line-height-{tight,normal}` = 1.25, 1.5;
    - `--font-weight-{regular,medium,semibold}` = 400, 500, 600.
  - radius: `--radius-{sm,md,lg}` = 2px, 4px, 8px
  - border: `--border-width` = 1px
  - focus: `--focus-ring-width` = 2px
  - motion: `--duration-{fast,normal}` = 120ms, 200ms; `--ease-standard` = cubic-bezier(0.2, 0, 0, 1)
  - z: `--z-popover` = 100, `--z-tooltip` = 200
  - control sizes: `--size-control-{sm,md}` = 1.75rem, 2.25rem
- `styles.css` = fonts @imports + all token files + `base.css`. It is the single global stylesheet consumers load (package export `@smb/ui/styles.css`).

- [ ] **Step 1: Failing tests**

`tokens.test.ts`: parse the CSS files with a small regex-based reader (`readTokens(css): { light: Record<string,string>; dark: Record<string,string>; darkMedia: Record<string,string> }`).
```ts
const TEXT_PAIRS = [["--color-text","--color-bg"],["--color-text","--color-surface"],["--color-text","--color-bg-subtle"],
  ["--color-text-muted","--color-bg"],["--color-text-muted","--color-surface"],["--color-on-accent","--color-accent"],
  ...STATUSES.map(s => [`--color-status-${s}-fg`, `--color-status-${s}-bg`])];
const UI_PAIRS = [["--color-border-strong","--color-bg"],["--color-accent","--color-bg"],["--color-focus-ring","--color-bg"],["--color-focus-ring","--color-surface"]];
test.each(["light","dark"])("%s: text pairs ≥ 4.5:1", theme => { for (const [fg,bg] of TEXT_PAIRS) expect(contrast(t[theme][fg], t[theme][bg])).toBeGreaterThanOrEqual(4.5); });
test.each(["light","dark"])("%s: UI pairs ≥ 3:1", …);
test("dark media block equals [data-theme=dark] block", () => expect(t.darkMedia).toEqual(t.dark));
test("every color token is a #rrggbb hex in both themes", …);
test("light and dark define the same color token names", …);
test("reduced motion zeroes every --duration-*", () => { /* parse @media (prefers-reduced-motion: reduce) block */ });
test("contrast() matches WCAG reference values", () => { expect(contrast("#000000","#ffffff")).toBeCloseTo(21, 1); expect(contrast("#777777","#ffffff")).toBeCloseTo(4.48, 2); });
```
`no-raw-values.test.ts`: glob `packages/ui/src/components/**/*.module.css`; for each declaration value, fail on `#hex`, `rgb(`, `hsl(`, `oklch(` and any number+unit except `0` (allowed keywords: `var(--…)`, `0`, `100%`, `auto`, `inherit`, `currentColor`, `none`, `transparent`, `calc(` whose numbers are only inside `var()` or are unitless multipliers). Include a fixture-driven self-test: a temp `.module.css` string with `color: #fff` and `padding: 4px` is reported, and `padding: var(--space-2)` is not (test the pure function `findRawValues(css: string): string[]`).
- [ ] **Step 2: Run** `bun test packages/ui/src/tokens packages/ui/src/test`. Expected: FAIL.
- [ ] **Step 3: Implement** tokens, `base.css` (box-sizing, `body` uses `--font-sans`, `--color-text`, `--color-bg`; `:focus-visible` outline `var(--focus-ring-width) solid var(--color-focus-ring)` with offset 2px; `code, kbd, samp` use `--font-mono`) and `styles.css`. Pick palette values (neutral grays, blue accent, green/amber/red/gray status) that pass the tests; the tests are the gate.
- [ ] **Step 4: Run** the tests (PASS) and `bun run check`.
- [ ] **Step 5: Commit** `feat(ui): tokens (light/dark), fonts, base styles with contrast and raw-value guards`

---

### Task 3: Storybook, shared story spec (VR + browser axe), baseline workflow

**Files:**
- Create: `packages/ui/.storybook/main.ts`, `packages/ui/.storybook/preview.tsx`, `packages/ui/src/foundations/Tokens.stories.tsx`, `tests/browser/stories.pw.ts`, `tests/browser/story-index.ts`, `tests/browser/story-index.test.ts`, `.github/workflows/vr-update.yml`
- Modify: `playwright.config.ts`, root `package.json` (devDeps storybook + @storybook/react-vite + vite + @vitejs/plugin-react + @axe-core/playwright + sirv-cli, exact; scripts `storybook` = `bun run --cwd packages/ui storybook dev -p 6006`, `build:storybook` = `bun run --cwd packages/ui storybook build -o storybook-static`), `CLAUDE.md` (commands + VR workflow), `.claude/skills/ds-component/SKILL.md` (step 4: exact baseline command), `.github/workflows/ci.yml` only if the webServer approach needs it

**Interfaces:**
- Produces:
  - `listStories(indexJson: unknown): { id: string; title: string; name: string }[]` in `tests/browser/story-index.ts`: entries with `type === "story"`, sorted by id, excluding tags `"!vr"`. Pure; unit-tested by `story-index.test.ts`, which runs in `bun test` because the filename is `.test.ts`.
  - Storybook global `theme: "light" | "dark"`; the preview decorator sets `document.documentElement.dataset.theme`.
  - `stories.pw.ts`: for each story × theme, open `/iframe.html?id=<id>&viewMode=story&globals=theme:<theme>`, await `document.fonts.ready`, then:
    1. run `new AxeBuilder({ page }).include("#storybook-root").analyze()` and expect zero violations (all rules incl. color-contrast);
    2. on Linux only, run `expect(page.locator("#storybook-root")).toHaveScreenshot(\`${id}--${theme}.png\`, { animations: "disabled" })`.
  - `playwright.config.ts`:
    - `webServer: { command: "bun run build:storybook && bunx sirv-cli packages/ui/storybook-static --port 6007 --quiet", url: "http://localhost:6007", reuseExistingServer: !process.env.CI, timeout: 180_000 }`;
    - `use.baseURL` and `use.reducedMotion: "reduce"`;
    - `snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}"`.
  - `vr-update.yml`:
    - `workflow_dispatch`, run with `--ref <branch>`;
    - the first step fails if `github.ref_name == 'main'`;
    - installs, runs `bunx playwright install --with-deps chromium` and `bunx playwright test tests/browser/stories.pw.ts --update-snapshots`;
    - uploads `tests/browser/__screenshots__` as artifact `vr-baselines`;
    - `permissions: contents: read`.

    It does NOT push: a push made with `GITHUB_TOKEN` doesn't trigger CI, so the PR head would lack the required `check`.
  - How an agent refreshes baselines: see ds-component step 4 (the single source of truth for the procedure). Rule: baselines are refreshed once per group, after the group's last component and before the group review.

- [ ] **Step 1: Failing tests**
  - `story-index.test.ts`:
    - filters `type: "docs"` out;
    - excludes `tags: ["!vr"]`;
    - sorts by id.
  - `stories.pw.ts`, beyond the per-story loop:
    - one extra test opens a story with `colorScheme: "dark"` and NO theme global, then asserts the computed `--color-bg` on `<html>` equals the dark token value (read it from `tokens/color.css` via the Task 2 reader);
    - one test asserts that when `process.platform !== "linux"` the screenshot step is skipped (unit-test the exported gate `shouldAssertScreenshots(platform: string): boolean` in `story-index.test.ts`: true only for `"linux"`).
- [ ] **Step 2: Run** `bun test tests/browser/story-index.test.ts` (FAIL) and `bun run test:browser` (FAIL: no Storybook).
- [ ] **Step 3: TS2742 check first.**
  - Create `Tokens.stories.tsx` (swatch grid of every color token in a `role="table"`, type scale, spacing scale) using CSF3 `const meta = { … } satisfies Meta;` and `export default meta`.
  - Run `bun run check`.
  - If `tsc -b` reports TS2742, use explicit annotations (`const meta: Meta = …`, `export const X: StoryObj = …`) in all stories. Write that rule into `ds-component` step 3. Do not change the linker.
- [ ] **Step 4: Implement** Storybook config, the spec, the config changes and the workflow. Then:
  - `bun run test:browser` passes locally: axe runs; screenshots are skipped on Windows.
  - `bun run check:all` passes.
- [ ] **Step 5: Commit** `feat(ui): storybook, shared story spec (axe + VR), baseline workflow`
- [ ] **Step 6: Baselines (controller).**
  - Push the branch and open the draft PR `Stage 1: DS foundation`.
  - Run the refresh procedure above.
  - Expected: `tests/browser/__screenshots__/foundations-tokens--*--{light,dark}.png` committed from the CI artifact, and CI on the PR head green with screenshot assertions active on Linux.

**Group A review:** whole-branch review (`component-review`, full) over `main..feat/ui-foundation`, plus triage of the ledger nits. Then the PR goes ready and the author merges.

---

## Component task template (Tasks 4–15)

Every component task runs the `ds-component` skill exactly. Step 0 is satisfied by Group A. Per task, this plan fixes only what the skill can't: the props, the tests that pin behavior, the stories, and notes. Common to all component tasks:

- **Files:** `packages/ui/src/components/<Name>/{<Name>.tsx,<Name>.module.css,<Name>.test.tsx,<Name>.stories.tsx,index.ts}`; modify `packages/ui/src/index.ts`.
- **Every test file** ends with an axe test per story-equivalent state: `await expectNoAxeViolations(container)`.
- **Every component:**
  - forwards `className` and native props where noted;
  - exposes `data-*` for variants;
  - is exported with its props type (`export type { <Name>Props }`).
- **Steps:**
  1. test (red);
  2. implement (green, tokens only);
  3. stories;
  4. export;
  5. `bun run check` + `bun run test:browser`;
  6. `component-review` (fresh subagent);
  7. commit `feat(ui): <Name>`;
  8. baselines are NOT refreshed per component: once per group, after the group's last component and before the group review, the controller follows ds-component step 4.

---

## Group B — Primitives (`feat/ui-primitives`, from main after Group A merges)

### Task 4: Stack

- Props `StackProps`:
  - `direction?: "row" | "column"` (default `"column"`);
  - `gap?: 0|1|2|3|4|5|6|7|8` (→ `--space-N`, default 3);
  - `align?: "start"|"center"|"end"|"stretch"`;
  - `justify?: "start"|"center"|"end"|"between"`;
  - `wrap?: boolean`;
  - `as?: "div"|"section"|"ul"|"ol"` (default `"div"`);
  - plus `children`, `className`.
- Tests:
  - renders the `as` element;
  - `data-direction`, `data-gap`, `data-align`, `data-justify`, `data-wrap` reflect props, with defaults applied;
  - children render in order.
- Stories: Column, Row, Wrap, Gaps (0/3/8).

### Task 5: Grid

- Props `GridProps`:
  - `columns: number | "auto-fit"`;
  - `minColumnWidth?: "sm"|"md"|"lg"` (tokens `--size-column-{sm,md,lg}` = 12rem/16rem/22rem, added to `space.css`; used only with `"auto-fit"`);
  - `gap?` as in Stack;
  - `children`, `className`.
- Tests:
  - `data-columns` is the number or `auto-fit`;
  - `minColumnWidth` without `auto-fit` throws in dev, with the message naming the prop;
  - an inline style is set ONLY as the CSS custom property `--grid-columns`.
- Stories: Fixed3, AutoFit, AutoFitNarrowViewport (story parameter `viewport` 375px).

### Task 6: Card

- Props `CardProps`:
  - `title?: ReactNode`;
  - `headingLevel?: 2|3|4` (default 3);
  - `actions?: ReactNode`;
  - `as?: "section"|"article"|"div"` (default `"section"`);
  - `children`, `className`.
- Tests:
  - with `title`, the region is named by the heading (`getByRole("region", { name })`) via `aria-labelledby`;
  - the heading level matches `headingLevel`;
  - without `title` there is no heading and no `aria-labelledby`;
  - `actions` renders inside the header.
- Stories: Plain, WithTitle, WithActions, LongTitle.

### Task 7: Mono + CodeBlock

- `Mono` = inline `<code>`, props `children`, `className`.
- `CodeBlockProps`:
  - `code: string`;
  - `language?: string`;
  - `label: string` (accessible name of the scroll region);
  - `wrap?: boolean` (default false).
- CodeBlock renders a `<figure>` with an optional caption showing the language. Inside is `<pre tabIndex={0} role="region" aria-label={label}>` wrapping `<code>`. No syntax highlighting (spec §9).
- Tests:
  - text is preserved exactly, including leading spaces and a trailing newline;
  - the region is focusable and named by `label`;
  - `data-wrap` reflects `wrap`;
  - Mono renders a `code` element.
- Stories: Inline, Block, LongContent (a 300-char line, no wrap), Wrapped.

### Task 8: Badge

- Props `BadgeProps`:
  - `status: "match"|"diff"|"error"|"timeout"`;
  - `children?: ReactNode` (overrides the label);
  - `className`.
- Default labels: "Match", "Diff", "Error", "Timeout". An inline SVG icon per status carries `aria-hidden="true"`.
- Tests:
  - per status: visible text label, `data-status`, icon hidden from the a11y tree;
  - the four labels are distinct;
  - `children` overrides the text;
  - the element is a non-focusable `span` (no `tabindex`, no button role).
- Stories: AllStatuses (one story rendering all four in a row), plus one story per status.

### Task 9: Stat

- Props `StatProps`:
  - `label: string`;
  - `value: string | number`;
  - `unit?: string`;
  - `methodologyHref?: string`;
  - `className`.
- Renders a `role="group"` with `aria-labelledby` pointing at the label. The value is in `--font-mono` with tabular nums. When `methodologyHref` is set, a link "How it's measured" is rendered with accessible name `How ${label} is measured`.
- Tests:
  - the group is named by the label;
  - the value and unit are rendered;
  - numbers are formatted with `Intl.NumberFormat("en")` (e.g. 12345 → "12,345");
  - the link is present only with `methodologyHref` and has the exact accessible name.
- Stories: Basic, WithUnit, WithMethodology, LongLabel.

**Group B review:** full `component-review` over `main..feat/ui-primitives` plus nit triage, then the PR goes ready.

---

## Group C — Controls (`feat/ui-controls`, from main after Group B merges)

### Task 10: Button

- React Aria `Button`. Props `ButtonProps`:
  - `variant?: "primary"|"secondary"|"ghost"` (default `"secondary"`);
  - `size?: "sm"|"md"` (default `"md"`);
  - `isDisabled?`, `onPress?`, `type?: "button"|"submit"` (default `"button"`);
  - `children`, `className`.
- Tests:
  - `onPress` fires on click, Enter and Space;
  - it does not fire when `isDisabled`;
  - `data-variant` and `data-size` reflect props;
  - `type` defaults to `"button"`;
  - the focus ring is shown via React Aria's `data-focus-visible` after keyboard focus.
- Stories: Primary, Secondary, Ghost × (Default, Disabled, Focused); Small.

### Task 11: Switch

- React Aria `Switch`. Props `SwitchProps`:
  - `isSelected?`, `defaultSelected?`, `onChange?(isSelected: boolean)`;
  - `isDisabled?`;
  - `children` (label, required).
- Tests:
  - the role is `switch`, named by the label;
  - Space toggles it, and `onChange` receives the new value;
  - the controlled `isSelected` is respected;
  - when disabled it doesn't toggle.
- Stories: Off, On, Disabled, Focused.

### Task 12: Slider

- React Aria `Slider`, single thumb. Props `SliderProps`:
  - `label: string`;
  - `minValue`, `maxValue`, `step`;
  - `value?`, `defaultValue?`, `onChange?(v: number)`;
  - `formatOptions?: Intl.NumberFormatOptions`;
  - `isDisabled?`.
- The output shows the formatted value. This slider is the site's replay speed control (bench spec §4.6).
- Tests:
  - the role is `slider`, named by the label;
  - ArrowRight and ArrowLeft change the value by `step`;
  - Home and End jump to min and max;
  - `aria-valuetext` uses `formatOptions` (e.g. `{ style: "unit", unit: "percent" }`);
  - when disabled it doesn't move.
- Stories: Default, WithFormat, Disabled, Focused.

### Task 13: Select

- React Aria `Select`. Props `SelectProps`:
  - `label: string`;
  - `items: { id: string; label: string }[]`;
  - `selectedKey?`, `defaultSelectedKey?`, `onSelectionChange?(id: string)`;
  - `placeholder?: string` (default "Select…");
  - `isDisabled?`.
- Tests:
  - the trigger button is named by the label and the current value;
  - Enter or ArrowDown opens the listbox;
  - Arrow + Enter selects, closes, and calls `onSelectionChange` with the id;
  - Escape closes without changing;
  - focus returns to the trigger.
- Stories: Closed, WithValue, Open (via `play` or `defaultOpen`), Disabled, LongOptionLabels.

### Task 14: Tabs + Tooltip

Two small components, one commit each, one review covering both.
- `TabsProps`:
  - `ariaLabel: string`;
  - `items: { id: string; label: string; content: ReactNode }[]`;
  - `selectedKey?`, `defaultSelectedKey?`, `onSelectionChange?(id: string)`.
- Tabs tests:
  - `tablist` named by `ariaLabel`;
  - Arrow keys move between tabs (automatic activation);
  - the panel shows the selected content and is labelled by its tab.
- `TooltipProps`:
  - `content: ReactNode`;
  - `children: ReactElement` (a focusable trigger, e.g. `Button`);
  - `delay?: number` (default 600).
- Tooltip tests:
  - focusing the trigger shows a `tooltip` linked via `aria-describedby`;
  - Escape hides it;
  - hover shows it after `delay` (fake timers).
- Stories: Tabs (Default, ManyTabs); Tooltip (OnButton, Open via `defaultOpen`).

### Task 15: Table (sortable)

- React Aria `Table` with sorting. Generic `TableProps<T>`:
  - `ariaLabel: string`;
  - `columns: { id: string; label: string; align?: "start"|"end"; allowsSorting?: boolean; value: (row: T) => string | number; render?: (row: T) => ReactNode }[]`;
  - `rows: T[]`;
  - `rowKey: (row: T) => string`;
  - `sortDescriptor?`, `defaultSortDescriptor?`, `onSortChange?`.
- Sorting:
  - uses `value()`: numbers numerically, strings with `Intl.Collator("en", { numeric: true })`;
  - stable;
  - `align: "end"` columns use tabular nums.
- The table sits in a horizontally scrollable container (`tabIndex={0}`, `role="region"`, `aria-label={ariaLabel}`).
- Tests:
  - the `table` role is named;
  - column headers are rendered;
  - activating a sortable header (click or Enter) sorts ascending, then descending, with `aria-sort` reflecting it;
  - numeric sort puts 9 < 10;
  - non-sortable headers ignore activation;
  - `onSortChange` is called with `{ column, direction }`;
  - the scroll region is focusable.
- Stories: Basic, SortedDesc, ManyColumnsNarrowViewport (375px), Empty (renders a "No results" row via React Aria `renderEmptyState`).

**Group C review:** full `component-review` over `main..feat/ui-controls` plus nit triage; the PR goes ready. **Stage 1 done** when this merges: spec §2 Stage 1 "done when" is checked off in the PR body.

---

## Plan-level decisions (review these)

1. Fonts are self-hosted via @fontsource-variable, for deterministic VR on CI Linux. The accent hue is blue. The exact palette is chosen in Task 2 and gated by the contrast test.
2. The Bun test CSS-modules plugin maps class keys to themselves. Tests never assert class names; variants are `data-*`.
3. VR and browser axe live in ONE spec over the Storybook static build, served by `sirv-cli` through the Playwright `webServer`. Screenshot assertions run on Linux only.
4. Baselines are produced by `vr-update.yml` (label-triggered on the PR; workflow_dispatch only once the workflow is on main) and uploaded as an artifact; the agent downloads and commits them, because a bot push with `GITHUB_TOKEN` wouldn't trigger the required CI check. Procedure: ds-component step 4. Baselines are refreshed once per group, after the group's last component, before the group review.
5. The global stylesheet is exported as `@smb/ui/styles.css`. How `apps/site` loads it (through `shared/ui` CSS, keeping `site-ui-only-via-shared` strict) is decided in Stage 3.
6. TS2742: explicit `Meta`/`StoryObj` annotations if needed. Never switch the Bun linker for it.
7. React 19 + react-aria-components. React is a peer dependency of `@smb/ui`.
8. Three PRs, one per group. Group reviews replace per-task reviews for nits (retro).

## Spec coverage map

| Spec item | Task |
|---|---|
| §5.3 tokens: CSS vars, light/dark via `[data-theme]` + `prefers-color-scheme` | 2 |
| §5.3 CSS Modules, no raw values outside tokens | 1 (typing), 2 (guard) |
| §5.3 React Aria for interactive widgets | 10–15 |
| §5.3 component set: Button, Switch, Slider, Select, Tabs, Table, Badge, Card, Tooltip, Stat, CodeBlock/Mono, Stack/Grid | 4–15 |
| §5.3 Storybook showcase, static build | 3 |
| §5.4 behavior + axe tests in bun test | 1 + every component |
| §5.4 VR light+dark, Linux baselines only | 3 |
| §2 Stage 1 "done when" | Group C close |
| Stage 0 carry-overs: TS2742 check, tokens stylesheet entry, shared VR spec, `update-snapshots` | 3, 2, 3, 3 |
