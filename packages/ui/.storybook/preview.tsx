import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";

/**
 * `theme` global: "light" | "dark" pins `<html data-theme>`; unset leaves it off, so the
 * tokens follow `prefers-color-scheme` (checked by the shared story spec).
 */
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Color theme (unset: follow prefers-color-scheme)",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, { globals }) => {
      const root = document.documentElement;
      if (globals.theme === "light" || globals.theme === "dark") root.dataset.theme = globals.theme;
      else delete root.dataset.theme;
      return <Story />;
    },
  ],
  parameters: { layout: "padded" },
};

export default preview;
