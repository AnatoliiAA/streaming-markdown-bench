// FSD 2.x rules for apps/site (spec §5.2): layer direction, slice isolation, public API.
// Package and packages/bench boundaries are checked by dependency-cruiser (.dependency-cruiser.cjs).
import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([...fsd.configs.recommended]);
