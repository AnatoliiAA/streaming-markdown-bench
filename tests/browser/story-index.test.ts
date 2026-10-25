import { describe, expect, test } from "bun:test";
import { listStories, shouldAssertScreenshots } from "./story-index";

const entry = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `T/${id}`,
  name: id,
  type: "story",
  tags: ["dev", "test"],
  importPath: "./x.stories.tsx",
  ...extra,
});

describe("listStories", () => {
  test("filters docs entries out", () => {
    const index = {
      v: 5,
      entries: { a: entry("a"), d: entry("d", { type: "docs" }) },
    };
    expect(listStories(index).map((s) => s.id)).toEqual(["a"]);
  });

  test("excludes stories tagged !vr", () => {
    const index = {
      v: 5,
      entries: { a: entry("a"), b: entry("b", { tags: ["dev", "!vr"] }) },
    };
    expect(listStories(index).map((s) => s.id)).toEqual(["a"]);
  });

  test("sorts by id and returns id, title, name only", () => {
    const index = { v: 5, entries: { c: entry("c"), a: entry("a"), b: entry("b") } };
    expect(listStories(index)).toEqual([
      { id: "a", title: "T/a", name: "a" },
      { id: "b", title: "T/b", name: "b" },
      { id: "c", title: "T/c", name: "c" },
    ]);
  });

  test("rejects input that is not a Storybook index", () => {
    expect(() => listStories(null)).toThrow();
    expect(() => listStories({ v: 5 })).toThrow();
  });
});

describe("shouldAssertScreenshots", () => {
  test("true only on linux", () => {
    expect(shouldAssertScreenshots("linux")).toBe(true);
    for (const p of ["win32", "darwin", "freebsd", ""])
      expect(shouldAssertScreenshots(p)).toBe(false);
  });
});
