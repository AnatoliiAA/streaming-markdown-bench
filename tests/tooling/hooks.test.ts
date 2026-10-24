import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { run } from "./run";

const repoRoot = resolve(import.meta.dir, "../..");
let dir = "";
const output = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;
const git = ["git", "-c", "user.name=test", "-c", "user.email=test@example.com"];

function put(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Resets the clone to a clean state so each test starts independent. */
async function reset() {
  await run(["git", "reset", "--hard", "-q", "HEAD"], { cwd: dir });
  await run(["git", "clean", "-fdq", "--", "packages", "docs", "NOTES.md"], { cwd: dir });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "smb clone ")); // space in path on purpose
  const clone = await run(["git", "clone", "--quiet", repoRoot, dir]);
  if (clone.code !== 0) throw new Error(`hooks setup: git clone failed:\n${output(clone)}`);
  const install = await run(["bun", "install", "--frozen-lockfile"], { cwd: dir });
  if (install.code !== 0) throw new Error(`hooks setup: bun install failed:\n${output(install)}`);
}, 180_000);

afterAll(() => {
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Windows may hold handles briefly (EBUSY/EPERM); a leftover temp dir must not fail the suite.
  }
});

test("fresh clone installs hooks", () => {
  expect(existsSync(join(dir, ".git/hooks/pre-commit"))).toBe(true);
});

test("commit with badly formatted staged file is blocked", async () => {
  await reset();
  put("packages/bench/src/bad.ts", "export const  a=1");
  expect((await run(["git", "add", "packages/bench/src/bad.ts"], { cwd: dir })).code).toBe(0);
  const commit = await run([...git, "commit", "-m", "x"], { cwd: dir });
  expect(commit.code).not.toBe(0);
  expect(output(commit)).toContain("Formatter would have printed");
  expect(output(commit)).toContain("bad.ts");
  const log = await run(["git", "log", "--format=%s", "-1"], { cwd: dir });
  expect(log.stdout.trim()).not.toBe("x");
}, 120_000);

test("commit with well formatted staged file succeeds", async () => {
  await reset();
  put("packages/bench/src/good.ts", 'export const a = "x";\n');
  expect((await run(["git", "add", "packages/bench/src/good.ts"], { cwd: dir })).code).toBe(0);
  const commit = await run([...git, "commit", "-m", "good"], { cwd: dir });
  expect(commit.code).toBe(0);
}, 120_000);

test.each(["docs/x.md", "NOTES.md"])(
  "badly formatted markdown %s is never blocked",
  async (rel) => {
    await reset();
    put(rel, "#  bad\n\n\n\ntext");
    expect((await run(["git", "add", rel], { cwd: dir })).code).toBe(0);
    const commit = await run([...git, "commit", "-m", "docs"], { cwd: dir });
    expect(commit.code).toBe(0);
  },
  120_000,
);
