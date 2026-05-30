import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  outDir: "dist",
  manifestVersion: 3,
  vite: () => ({
    plugins: [tailwindcss()]
  }),
  manifest: {
    name: "Stash",
    description: "A beautifully designed tab manager for saving and restoring browser sessions.",
    version: "0.1.0",
    permissions: ["contextMenus", "storage", "tabs"],
    commands: {
      "save-all-tabs": {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S"
        },
        description: "Save all tabs in the current window"
      }
    },
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  }
});
