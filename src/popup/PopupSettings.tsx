import {
  AppWindow,
  ArrowLeft,
  Download,
  ExternalLink,
  Keyboard,
  PanelTopClose,
  Puzzle,
  Rows3,
  Upload,
} from "lucide-react";
import { motion } from "motion/react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { sendBackgroundRequest } from "../shared/messages";
import {
  SCHEMA_VERSION,
  defaultSettings,
  getSessions,
  getSettings,
  normalizeSessions,
  updateSettings,
} from "../shared/storage";
import type { SaveTarget, StashSession, StashSettings } from "../shared/types";

/** In-popup settings panel. Slides over the main view; no separate options tab. */
export function PopupSettings({
  onClose,
  reduceMotion,
}: {
  onClose: () => void;
  reduceMotion: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<StashSettings>(defaultSettings);
  const [sessions, setSessions] = useState<StashSession[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
    void getSessions().then(setSessions);
  }, []);

  function flash(message: string) {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 1600);
  }

  async function patch(next: Partial<StashSettings>) {
    setSettings(await updateSettings(next));
    flash("Saved");
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
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const rawSessions = Array.isArray(parsed) ? parsed : parsed?.sessions;
      const valid = normalizeSessions(rawSessions);
      if (valid.length === 0) {
        flash("No valid sessions in that file");
        return;
      }
      const response = await sendBackgroundRequest({ type: "ADD_SESSIONS", sessions: valid });
      if (!response.ok) {
        flash(response.error);
        return;
      }
      setSessions(await getSessions());
      const added = response.count ?? 0;
      flash(added > 0 ? `Imported ${added} ${added === 1 ? "session" : "sessions"}` : "Already up to date");
    } catch {
      flash("Couldn't read that file as Stash JSON");
    }
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { x: "100%" }}
      animate={{ x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      className="paper-bg absolute inset-0 z-30 flex flex-col text-ink"
    >
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        <button
          type="button"
          aria-label="Back"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-[var(--shadow-xs)] transition-[color,box-shadow] duration-[var(--dur-fast)] hover:text-ink hover:shadow-[var(--shadow-sm)]"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="font-display display-emphasis text-[20px] font-semibold leading-none">Settings</h2>
        {status && (
          <motion.span
            key={status}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ml-auto rounded-full border border-success-border bg-success-soft px-2.5 py-1 font-mono text-[10px] font-bold text-success"
          >
            {status}
          </motion.span>
        )}
      </header>

      <div className="stash-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <Row icon={<PanelTopClose size={16} />} title="Save target" hint="What the keyboard shortcut captures.">
          <div className="grid grid-cols-2 gap-1 rounded-full border border-border/70 bg-surface-muted p-1 shadow-[inset_0_1px_3px_rgba(20,35,80,0.13)]">
            <Seg active={settings.saveTarget === "current-window"} onClick={() => void patch({ saveTarget: "current-window" as SaveTarget })}>
              This window
            </Seg>
            <Seg active={settings.saveTarget === "all-windows"} onClick={() => void patch({ saveTarget: "all-windows" as SaveTarget })}>
              All windows
            </Seg>
          </div>
        </Row>

        <Toggle
          icon={<Rows3 size={16} />}
          title="Compact mode"
          hint="Tighter rows."
          checked={settings.compactMode}
          onChange={(v) => void patch({ compactMode: v })}
        />

        <Toggle
          icon={<AppWindow size={16} />}
          title="Restore in new window"
          hint="Open restored tabs in a fresh window."
          checked={settings.restoreInNewWindow}
          onChange={(v) => void patch({ restoreInNewWindow: v })}
        />

        <Row icon={<Keyboard size={16} />} title="Keyboard shortcut" hint="⌘⇧S / Ctrl⇧S to save.">
          <LinkButton onClick={() => void chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}>
            Shortcuts <ExternalLink size={13} />
          </LinkButton>
        </Row>

        <Row icon={<Puzzle size={16} />} title="Extension page" hint="Permissions & file access.">
          <LinkButton onClick={() => void chrome.tabs.create({ url: "chrome://extensions" })}>
            Open <ExternalLink size={13} />
          </LinkButton>
        </Row>

        <Row
          icon={<Download size={16} />}
          title="Backup"
          hint={`${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} saved.`}
        >
          <div className="flex gap-2">
            <LinkButton onClick={handleExport} disabled={sessions.length === 0}>
              <Download size={13} /> Export
            </LinkButton>
            <LinkButton onClick={() => fileInputRef.current?.click()}>
              <Upload size={13} /> Import
            </LinkButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => void handleImportFile(e)}
            />
          </div>
        </Row>
      </div>
    </motion.div>
  );
}

function Row({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex items-center justify-between gap-3 border-t border-border py-3.5 first:border-t-0">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-accent-text">{icon}</span>
        <div className="min-w-0">
          <h3 className="font-display text-[13.5px] font-semibold leading-tight">{title}</h3>
          <p className="m-0 text-[11.5px] leading-snug text-muted">{hint}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </section>
  );
}

function Toggle({
  icon, title, hint, checked, onChange,
}: {
  icon: ReactNode; title: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <Row icon={icon} title={title} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 rounded-full transition-colors duration-[var(--dur-fast)]",
          checked ? "bg-accent" : "bg-surface-muted border border-border-strong",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cn(
            "absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow-[var(--shadow-sm)]",
            checked ? "right-[3px]" : "left-[3px]",
          )}
        />
      </button>
    </Row>
  );
}

function Seg({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-7 rounded-full px-3 text-[12px] font-semibold transition-[color,box-shadow] duration-[var(--dur-fast)] active:scale-[0.97]",
        active
          ? "bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] text-ink shadow-[0_1px_2px_rgba(20,35,80,0.13),inset_0_1px_0_rgba(255,255,255,0.9)]"
          : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function LinkButton({
  children, onClick, disabled,
}: {
  children: ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[var(--shadow-sm)] transition-[box-shadow,color] duration-[var(--dur-fast)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:shadow-none"
    >
      {children}
    </button>
  );
}
