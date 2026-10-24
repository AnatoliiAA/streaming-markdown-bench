---
name: ds-component
description: Use when creating or changing a component in packages/ui
---

# DS component

Build one `packages/ui` component, test-first. The order below is fixed. Decisions listed here are settled: do not ask the user about them.

Layout (`project-architecture` and spec 5.3), per component:

```
packages/ui/src/components/<Name>/
  <Name>.tsx  <Name>.module.css  <Name>.test.tsx  <Name>.stories.tsx
  index.ts    (re-exports only)
```

Tokens live in `packages/ui/src/tokens/`.

## Step 0 - Prerequisites (stop, do not defer)

The DS foundation must exist: React + react-dom, Testing Library, `axe-core`, React Aria, CSS Modules typing, Storybook, and the visual-regression (VR) workflow with its `update-snapshots` input. They arrive in Stage 1, Task 1 (DS foundation). If any is missing, stop and do that task first. Never build a component without them, and never skip its story or VR "for later".

## Steps

1. **Test first.** `<Name>.test.tsx` is the FIRST file written, before the implementation and before any token. Testing Library asserts behavior (rendered output, keyboard and pointer interaction, each variant and state) plus an `axe-core` check asserting zero violations. Run it and see it fail for the expected reason (missing component or missing behavior). If you need a token that does not exist, add it only after the test is red, as part of making it green.
2. **Implement (green).** Minimal code to pass.
   - Interactive behavior through React Aria; no hand-rolled key handling or ARIA.
   - Styles in `<Name>.module.css` using only `var(--…)` tokens. No raw colors, sizes or px literals outside `tokens/`. New values become tokens (light and dark).
   - Status meaning is never carried by color alone: add text or an icon (Badge match/diff/error/timeout reads without color).
   - Refactor while green.
3. **Story (mandatory).** `<Name>.stories.tsx` has one story per visual state: every variant, crossed with disabled, focus and error where applicable.
4. **VR (mandatory).** One Playwright screenshot per story, in light and dark.
   - Baselines are generated ONLY in CI on Linux, by running the workflow with the `update-snapshots` input. Never generate or commit them from Windows or macOS dev machines (font rendering differs).
   - Commit the CI-generated baselines from the CI run's output, not from a local run.
5. **Export** from `packages/ui/src/index.ts`. `<Name>/index.ts` re-exports only. The site consumes the component through `apps/site/src/shared/ui` only, never by deep path into `packages/ui`.
6. **Verify and review.** `bun run check` (exit 0), `bun run test:browser` when VR applies, then `component-review` (fresh subagent). Fix findings, re-run check. One commit per component.

## Checklist

- [ ] Prerequisites present (else Stage 1 Task 1 first)
- [ ] Test (behavior + axe, zero violations) written first and seen failing
- [ ] Tokens added only after the red test; none raw in the CSS module
- [ ] React Aria for interaction; no color-only status
- [ ] Story per visual state; VR light + dark per story
- [ ] VR baselines come from CI Linux only
- [ ] Exported from `packages/ui/src/index.ts`; site uses `shared/ui`
- [ ] `bun run check` green, `component-review` PASS

## Rules

- A component without a test-first record, story and VR is unfinished, not "deferred".
- Never weaken the axe assertion or boundary rules to get green.
