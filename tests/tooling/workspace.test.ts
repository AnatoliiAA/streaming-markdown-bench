import { expect, test } from "bun:test";

test("workspace packages resolve by name", async () => {
  for (const p of ["@smb/ui", "@smb/bench"]) expect(await import(p)).toBeDefined();
});

test("DOM globals are preloaded", () => {
  const el = document.createElement("div");
  el.textContent = "x";
  expect(el.outerHTML).toBe("<div>x</div>");
});
