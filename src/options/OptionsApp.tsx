import { Download, Keyboard, LayoutList, PanelTopClose, Rows3, Upload } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { sendBackgroundRequest } from "../shared/messages";
import { SCHEMA_VERSION, defaultSettings, getSessions, getSettings, normalizeSessions, updateSettings } from "../shared/storage";
import type { SaveTarget, StashSession, StashSettings } from "../shared/types";

export function OptionsApp() {
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<StashSettings>(defaultSettings);
  const [sessions, setSessions] = useState<StashSession[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
    void refreshSessions();
    const onChanged = () => void refreshSessions();
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  async function refreshSessions() {
    setSessions(await getSessions());
  }

  async function setSaveTarget(saveTarget: SaveTarget) {
    setSettings(await updateSettings({ saveTarget }));
    flash("Saved");
  }

  async function setCompactMode(compactMode: boolean) {
    setSettings(await updateSettings({ compactMode }));
    flash("Saved");
  }

  function openShortcutSettings() {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }

  function flash(message: string) {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 1800);
  }

  function handleExport() {
    const payload = {
      app: "stash",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      sessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-importing the same file
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const rawSessions = Array.isArray(parsed) ? parsed : parsed?.sessions;
      const valid = normalizeSessions(rawSessions);
      if (valid.length === 0) {
        flash("No valid sessions found in that file");
        return;
      }
      const response = await sendBackgroundRequest({ type: "ADD_SESSIONS", sessions: valid });
      if (!response.ok) {
        flash(response.error);
        return;
      }
      await refreshSessions();
      const added = response.count ?? 0;
      flash(added > 0 ? `Imported ${added} ${added === 1 ? "session" : "sessions"}` : "Already up to date");
    } catch {
      flash("That file could not be read as Stash JSON");
    }
  }

  const tabCount = sessions.reduce((total, session) => total + session.tabs.length, 0);

  return (
    <main className="paper-bg min-h-screen px-6 py-12 text-ink">
      <Card className="mx-auto max-w-[760px] p-7">
        <header className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-text">Stash</p>
            <h1 className="font-display display-emphasis text-[30px] font-semibold leading-tight">Settings</h1>
          </div>

          {status ? (
            <motion.span
              key={status}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full border border-success-border bg-success-soft px-3 py-1 text-xs font-bold text-success"
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
          <div className="grid grid-cols-2 gap-1 rounded-full border border-border/70 bg-surface-muted p-1 shadow-[inset_0_1px_3px_rgba(20,35,80,0.13)]">
            <SegmentButton active={settings.saveTarget === "current-window"} onClick={() => void setSaveTarget("current-window")}>
              Current window
            </SegmentButton>
            <SegmentButton active={settings.saveTarget === "all-windows"} onClick={() => void setSaveTarget("all-windows")}>
              All windows
            </SegmentButton>
          </div>
        </SettingGroup>

        <SettingGroup
          icon={settings.compactMode ? <Rows3 size={18} /> : <LayoutList size={18} />}
          title="Density"
          description="Use tighter rows in the popup."
        >
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-surface-subtle px-4 text-sm font-semibold">
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

        <SettingGroup
          icon={<Download size={18} />}
          title="Backup and restore"
          description={`Export your ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} (${tabCount} ${tabCount === 1 ? "tab" : "tabs"}) to a file, or import a backup.`}
        >
          <div className="flex flex-wrap items-center gap-2 justify-self-start">
            <Button variant="secondary" onClick={handleExport} disabled={sessions.length === 0} className="gap-1.5">
              <Download size={14} /> Export
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload size={14} /> Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => void handleImportFile(event)}
            />
          </div>
        </SettingGroup>
      </Card>
    </main>
  );
}

function SettingGroup({
  icon,
  title,
  description,
  children,
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

function SegmentButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-8 rounded-full px-3 text-sm font-semibold transition-[color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-std)] active:scale-[0.97]",
        active
          ? "bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] text-ink shadow-[0_1px_2px_rgba(20,35,80,0.13),inset_0_1px_0_rgba(255,255,255,0.9)]"
          : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
