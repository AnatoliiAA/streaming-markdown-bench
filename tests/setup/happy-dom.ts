import { afterEach, expect } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// Dynamic imports: testing-library and jest-dom must load after the DOM globals exist.
const { cleanup } = await import("@testing-library/react");
const matchers = await import("@testing-library/jest-dom/matchers");

// Global hook: a module-level afterEach in a shared helper only attaches for the first
// test file that imports it (Bun caches modules), so DOM would leak into later files.
afterEach(cleanup);

// jest-dom's matcher types are not bun:test's Matchers type, hence the cast.
expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);
