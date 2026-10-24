import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");

export type RunResult = { code: number; stdout: string; stderr: string };

export async function run(cmd: string[], opts: { cwd?: string } = {}): Promise<RunResult> {
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd ?? repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

/** Writes a temp file (creating parent dirs), runs fn, then always removes the file and any dirs it created. */
export async function withFile(
  relPath: string,
  content: string,
  fn: () => Promise<void>,
): Promise<void> {
  const full = resolve(repoRoot, relPath);
  const created: string[] = [];
  let dir = dirname(full);
  while (!existsSync(dir)) {
    created.push(dir);
    dir = dirname(dir);
  }
  try {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    await fn();
  } finally {
    rmSync(full, { force: true });
    for (const d of created) rmSync(d, { recursive: true, force: true });
  }
}
