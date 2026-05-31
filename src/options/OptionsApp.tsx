import { Keyboard, LayoutList, PanelTopClose, Rows3 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { defaultSettings, getSettings, updateSettings } from "../shared/storage";
import type { SaveTarget, StashSettings } from "../shared/types";

export function OptionsApp() {
  const reduceMotion = useReducedMotion();
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
    <main className="paper-bg min-h-screen px-6 py-14 text-ink">
      <Card className="mx-auto max-w-[760px] p-7">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-text">Stash</p>
            <h1 className="display-hero font-display text-[30px] font-semibold leading-tight">Settings</h1>
          </div>

          {status ? (
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-full border border-success-border bg-success-soft px-2.5 py-1 text-xs font-bold text-success"
            >
              {status}
            </motion.span>
          ) : null}
        </header>

        <SettingGroup
          icon={<PanelTopClose size={18} />}
          title="Default save target"
          description="Choose what the popup and keyboard shortcut capture."
        >
          <div className="grid grid-cols-2 gap-[3px] rounded-[var(--radius-card)] border border-border bg-surface-muted p-[3px]">
            <SegmentButton
              active={settings.saveTarget === "current-window"}
              onClick={() => void setSaveTarget("current-window")}
            >
              Current window
            </SegmentButton>
            <SegmentButton
              active={settings.saveTarget === "all-windows"}
              onClick={() => void setSaveTarget("all-windows")}
            >
              All windows
            </SegmentButton>
          </div>
        </SettingGroup>

        <SettingGroup
          icon={settings.compactMode ? <Rows3 size={18} /> : <LayoutList size={18} />}
          title="Density"
          description="Use tighter rows in the popup."
        >
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-surface-subtle px-3 text-sm font-semibold">
            <span>Compact mode</span>
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(event) => void setCompactMode(event.target.checked)}
              className="h-[18px] w-[18px] accent-accent"
            />
          </label>
        </SettingGroup>

        <SettingGroup
          icon={<Keyboard size={18} />}
          title="Keyboard shortcut"
          description="Command+Shift+S on macOS, Ctrl+Shift+S elsewhere."
        >
          <Button variant="secondary" onClick={openShortcutSettings} className="justify-self-start">
            Open shortcuts
          </Button>
        </SettingGroup>
      </Card>
    </main>
  );
}

function SettingGroup({
  icon,
  title,
  description,
  children
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_minmax(220px,auto)] items-center gap-6 border-t border-border py-5 max-[640px]:grid-cols-1">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent-text">{icon}</span>
        <div>
          <h2 className="mb-1 font-display text-[15px] font-semibold tracking-normal">{title}</h2>
          <p className="m-0 text-sm leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SegmentButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative h-8 rounded-[var(--radius-btn)] px-3 text-sm font-bold text-muted transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)]",
        active && "border border-border bg-surface text-ink shadow-[0_1px_0_rgba(31,27,22,0.04)]"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
