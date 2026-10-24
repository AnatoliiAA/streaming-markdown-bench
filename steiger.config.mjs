// FSD 2.x rules for apps/site (spec §5.2): layer direction, slice isolation, public API.
// Package and packages/bench boundaries are checked by dependency-cruiser (.dependency-cruiser.cjs).
import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // Structural advice, not an import-direction rule: it errors on legal early-stage trees
      // (a slice referenced once -> "consider merging", an unreferenced slice -> "remove it"),
      // so the first legal features -> entities import in Stage 3 would fail `check`.
      "fsd/insignificant-slice": "off",
    },
  },
]);
