import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

declare module "bun:test" {
  // biome-ignore lint/suspicious/noExplicitAny: mirrors bun:test's own Matchers<T = unknown> signature for declaration merging
  interface Matchers<T = any> extends TestingLibraryMatchers<unknown, T> {}
  // biome-ignore lint/suspicious/noExplicitAny: mirrors bun:test's own AsymmetricMatchers declaration merging
  interface AsymmetricMatchers extends TestingLibraryMatchers<unknown, any> {}
}
