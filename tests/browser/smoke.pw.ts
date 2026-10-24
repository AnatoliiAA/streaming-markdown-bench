import { expect, test } from "@playwright/test";

test("chromium renders and runs JS", async ({ page }) => {
  await page.setContent(
    `<main id="m"></main><script>document.getElementById("m").textContent = "ok"</script>`,
  );
  await expect(page.locator("#m")).toHaveText("ok");
});
