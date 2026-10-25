import { expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withFile } from "./run";

test("withFile refuses to overwrite or delete a pre-existing file", async () => {
  const rel = "tests/tooling/preexisting.tmp";
  const full = resolve(import.meta.dir, "preexisting.tmp");
  writeFileSync(full, "keep me");
  try {
    let called = false;
    await expect(
      withFile(rel, "new", async () => {
        called = true;
      }),
    ).rejects.toThrow(rel);
    expect(called).toBe(false);
    expect(existsSync(full)).toBe(true);
    expect(readFileSync(full, "utf8")).toBe("keep me");
  } finally {
    rmSync(full, { force: true });
  }
});
