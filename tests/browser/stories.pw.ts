import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { loadTokenCss, readTokens } from "../../packages/ui/src/tokens/read-tokens";
import { listStories, shouldAssertScreenshots } from "./story-index";

const THEMES = ["light", "dark"] as const;
const uiPath = (rel: string): string =>
  fileURLToPath(new URL(`../../packages/ui/${rel}`, import.meta.url));

// The webServer builds Storybook before any test file is loaded, so the index exists here.
const stories = listStories(
  JSON.parse(readFileSync(uiPath("storybook-static/index.json"), "utf8")),
);

async function openStory(page: Page, id: string, theme?: (typeof THEMES)[number]): Promise<void> {
  const globals = theme ? `&globals=theme:${theme}` : "";
  await page.goto(`/iframe.html?id=${id}&viewMode=story${globals}`);
  await page.locator("#storybook-root > *").first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test("the story index lists at least one story", () => {
  expect(stories.length).toBeGreaterThan(0);
});

for (const { id } of stories) {
  for (const theme of THEMES) {
    test(`${id} [${theme}]`, async ({ page }) => {
      await openStory(page, id, theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      const { violations } = await new AxeBuilder({ page }).include("#storybook-root").analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual(
        [],
      );

      if (shouldAssertScreenshots(process.platform)) {
        await expect(page.locator("#storybook-root")).toHaveScreenshot(`${id}--${theme}.png`, {
          animations: "disabled",
        });
      } else {
        test.info().annotations.push({
          type: "skip",
          description: "screenshot: baselines are Linux-only (CI)",
        });
      }
    });
  }
}

test.describe("prefers-color-scheme without a theme global", () => {
  test.use({ colorScheme: "dark" });

  test("html resolves --color-bg to the dark token", async ({ page }) => {
    const expected = readTokens(loadTokenCss()).darkMedia["--color-bg"];
    expect(expected).toBeDefined();

    const first = stories[0];
    if (!first) throw new Error("no stories in the Storybook index");
    await openStory(page, first.id);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");

    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
    );
    expect(bg).toBe(expected as string);

    // reducedMotion: "reduce" comes from playwright.config.ts.
    const fast = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--duration-fast").trim(),
    );
    // The CSS pipeline may serialise 0ms as 0s; both are zero.
    expect(["0ms", "0s"]).toContain(fast);
  });
});

test.describe("OS dark with an explicit light theme global", () => {
  test.use({ colorScheme: "dark" });

  test("the theme global wins over prefers-color-scheme", async ({ page }) => {
    const expected = readTokens(loadTokenCss()).light["--color-bg"];
    expect(expected).toBeDefined();

    const first = stories[0];
    if (!first) throw new Error("no stories in the Storybook index");
    await openStory(page, first.id, "light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // The built CSS may shorten #ffffff to #fff, so compare resolved rgb() values.
    const [bg, want] = await page.evaluate((hex) => {
      const probe = document.createElement("span");
      document.body.append(probe);
      const resolve = (c: string): string => {
        probe.style.color = c;
        return getComputedStyle(probe).color;
      };
      const token = getComputedStyle(document.documentElement).getPropertyValue("--color-bg");
      const out = [resolve(token.trim()), resolve(hex)];
      probe.remove();
      return out;
    }, expected as string);
    expect(bg).toBe(want);
  });
});
