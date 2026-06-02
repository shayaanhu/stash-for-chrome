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
    name: "Stash - Tab Manager, Save & Restore Tabs",
    description:
      "Save all your tabs in one click. Restore them any time. A tab manager that turns browser chaos into a clean, searchable library.",
    version: "1.0.1",
    minimum_chrome_version: "116",
    permissions: ["contextMenus", "storage", "unlimitedStorage", "tabs", "alarms"],
    action: {
      default_title: "Stash — save your tabs"
    },
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
