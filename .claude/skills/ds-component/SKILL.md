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

The DS foundation must exist: React + react-dom, Testing Library, `axe-core`, React Aria, CSS Modules typing, Storybook, the shared VR spec (one Playwright spec iterating every story in light and dark), and the `vr-update.yml` baseline workflow. They arrive in Stage 1, Tasks 1–3 (DS foundation). If any is missing, stop and do that task first. Never build a component without them, and never skip its story or VR "for later".

## Steps

1. **Test first.** `<Name>.test.tsx` is the FIRST file written, before the implementation and before any token. Testing Library asserts behavior (rendered output, keyboard and pointer interaction, each variant and state) plus an `axe-core` check asserting zero violations; never weaken that assertion. Run it and see it fail for the expected reason (missing component or missing behavior). If you need a token that does not exist, add it only after the test is red, as part of making it green.
2. **Implement (green).** Minimal code to pass.
   - Interactive behavior through React Aria; no hand-rolled key handling or ARIA.
   - Styles in `<Name>.module.css` using only `var(--…)` tokens. No raw colors/sizes outside `tokens/`. New values become tokens (light and dark).
   - Status meaning is never carried by color alone: add text or an icon (Badge match/diff/error/timeout reads without color).
   - Refactor while green.
3. **Story (mandatory).** `<Name>.stories.tsx` has one story per visual state: every variant, crossed with disabled, focus and error where applicable.
4. **VR (mandatory).** VR is ONE shared Playwright spec, `tests/browser/stories.pw.ts` (Stage 1 Task 3), that iterates every story in light and dark: axe with all rules (incl. color-contrast) on every platform, screenshots on Linux only. Components never write their own VR spec; a new story is picked up automatically, so step 3 is what adds the screenshots. Tag a story `!vr` only if it cannot be screenshotted deterministically.
   - Baselines are generated ONLY in CI on Linux by `.github/workflows/vr-update.yml`. Never generate or commit them from Windows or macOS dev machines (font rendering differs).
   - Refresh procedure (the only way baselines are committed):
     1. Start the run. Pre-merge (normal case): `gh pr edit <pr> --add-label update-vr`. On main or without a PR: `gh workflow run vr-update.yml --ref <branch>`.
     2. `gh run list --workflow vr-update.yml --branch <branch> -L 1 --json databaseId --jq '.[0].databaseId'` gives `<id>`.
     3. `gh run watch <id>`
     4. `gh run download <id> -n vr-baselines -D tests/browser/__screenshots__`
     5. Commit `test(vr): baselines from CI run <id>` and push.
     6. Label path only: `gh pr edit <pr> --remove-label update-vr`.
   - When a story is renamed or removed, delete its old PNGs in `tests/browser/__screenshots__` before committing (the download never deletes files).
5. **Export** from `packages/ui/src/index.ts`. `<Name>/index.ts` re-exports only. The site consumes the component through `apps/site/src/shared/ui` only, never by deep path into `packages/ui`.
6. **Verify and review.** `bun run check` (exit 0), `bun run test:browser` (always; VR is mandatory), then `component-review` (fresh subagent). Fix findings, re-run check. One commit per component.

## Checklist

- [ ] Prerequisites present (else Stage 1 Tasks 1–3 first)
- [ ] Test (behavior + axe, zero violations) written first and seen failing
- [ ] Tokens added only after the red test; none raw in the CSS module
- [ ] React Aria for interaction; no color-only status
- [ ] Story per visual state (picked up by the shared VR spec, no per-component VR spec)
- [ ] VR baselines come from CI Linux only
- [ ] Exported from `packages/ui/src/index.ts`; site uses `shared/ui`
- [ ] `bun run check` green, `component-review` PASS

## Rules

- A component without a test-first record, story and VR is unfinished, not "deferred".
- Never weaken boundary rules to get green.
