import { resolve } from "node:path";

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
