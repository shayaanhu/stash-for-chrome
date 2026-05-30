import { Keyboard, LayoutList, PanelTopClose, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";
import { defaultSettings, getSettings, updateSettings } from "../shared/storage";
import type { SaveTarget, StashSettings } from "../shared/types";

export function OptionsApp() {
  const [settings, setSettings] = useState<StashSettings>(defaultSettings);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  async function setSaveTarget(saveTarget: SaveTarget) {
    const nextSettings = await updateSettings({ saveTarget });
    setSettings(nextSettings);
    flashSaved();
  }

  async function setCompactMode(compactMode: boolean) {
    const nextSettings = await updateSettings({ compactMode });
    setSettings(nextSettings);
    flashSaved();
  }

  function openShortcutSettings() {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }

  function flashSaved() {
    setStatus("Saved");
    window.setTimeout(() => setStatus(null), 1400);
  }

  return (
    <main className="options-shell">
      <section className="settings-panel">
        <header className="settings-header">
          <div>
            <p className="eyebrow">Stash</p>
            <h1>Settings</h1>
          </div>
          {status ? <span className="saved-pill">{status}</span> : null}
        </header>

        <div className="setting-group">
          <div className="setting-label">
            <PanelTopClose size={18} />
            <div>
              <h2>Default save target</h2>
              <p>Choose what the popup and keyboard shortcut capture.</p>
            </div>
          </div>

          <div className="segmented-control" role="radiogroup" aria-label="Default save target">
            <button
              type="button"
              className={settings.saveTarget === "current-window" ? "active" : ""}
              onClick={() => void setSaveTarget("current-window")}
            >
              Current window
            </button>
            <button
              type="button"
              className={settings.saveTarget === "all-windows" ? "active" : ""}
              onClick={() => void setSaveTarget("all-windows")}
            >
              All windows
            </button>
          </div>
        </div>

        <div className="setting-group">
          <div className="setting-label">
            {settings.compactMode ? <Rows3 size={18} /> : <LayoutList size={18} />}
            <div>
              <h2>Density</h2>
              <p>Use tighter rows in the popup.</p>
            </div>
          </div>

          <label className="switch-row">
            <span>Compact mode</span>
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(event) => void setCompactMode(event.target.checked)}
            />
          </label>
        </div>

        <div className="setting-group">
          <div className="setting-label">
            <Keyboard size={18} />
            <div>
              <h2>Keyboard shortcut</h2>
              <p>Command+Shift+S on macOS, Ctrl+Shift+S elsewhere.</p>
            </div>
          </div>

          <button type="button" className="secondary-button" onClick={openShortcutSettings}>
            Open shortcuts
          </button>
        </div>
      </section>
    </main>
  );
}
