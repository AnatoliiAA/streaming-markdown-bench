import { expect } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// Dynamic import: jest-dom must load after the DOM globals exist.
const matchers = await import("@testing-library/jest-dom/matchers");
expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);
