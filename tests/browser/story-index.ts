// Pure helpers for the shared story spec (stories.pw.ts). Unit-tested by story-index.test.ts
// under `bun test`; imported by Playwright under Node, so no Bun-only APIs here.

export interface StoryRef {
  id: string;
  title: string;
  name: string;
}

interface IndexEntry {
  id: string;
  title: string;
  name: string;
  type?: string;
  tags?: string[];
}

/** Stories from a Storybook `index.json` that the VR/axe spec covers: no docs, no `!vr`, sorted by id. */
export function listStories(indexJson: unknown): StoryRef[] {
  const entries = (indexJson as { entries?: unknown } | null)?.entries;
  if (typeof entries !== "object" || entries === null) {
    throw new Error("Not a Storybook index.json: missing `entries`");
  }
  return Object.values(entries as Record<string, IndexEntry>)
    .filter((e) => e.type === "story" && !(e.tags ?? []).includes("!vr"))
    .map(({ id, title, name }) => ({ id, title, name }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Screenshot baselines are generated on Linux (CI) only; other platforms render fonts differently. */
export function shouldAssertScreenshots(platform: string): boolean {
  return platform === "linux";
}
