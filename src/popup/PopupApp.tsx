import NumberFlow from "@number-flow/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  PanelTopClose,
  Pencil,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyPreview } from "../components/empty/EmptyPreview";
import { TrashEmpty } from "../components/empty/TrashEmpty";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Toaster } from "../components/ui/toaster";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";
import { sendBackgroundRequest } from "../shared/messages";
import { getSessions, getSettings } from "../shared/storage";
import { matchesSession, sortSessionsNewestFirst } from "../shared/session-utils";
import type { SaveTarget, StashSession, StashTab } from "../shared/types";

type ViewMode = "library" | "trash";
type SaveBurst = { id: string; tabs: StashTab[] };

export function PopupApp() {
  const reduceMotion = useReducedMotion();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [sessions, setSessions] = useState<StashSession[]>([]);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>("current-window");
  const [compactMode, setCompactMode] = useState(false);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("library");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [freshlySavedId, setFreshlySavedId] = useState<string | null>(null);
  const [saveBurst, setSaveBurst] = useState<SaveBurst | null>(null);
  const [restoreBurstId, setRestoreBurstId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextSessions, nextSettings] = await Promise.all([getSessions(), getSettings()]);
    setSessions(sortSessionsNewestFirst(nextSessions));
    setSaveTarget(nextSettings.saveTarget);
    setCompactMode(nextSettings.compactMode);
  }, []);

  useEffect(() => {
    void reload();
    chrome.storage.onChanged.addListener(reload);
    return () => chrome.storage.onChanged.removeListener(reload);
  }, [reload]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeCount = sessions.filter((s) => !s.deletedAt).length;
  const trashCount  = sessions.filter((s) =>  s.deletedAt).length;

  const visibleSessions = useMemo(() => {
    const isTrash = viewMode === "trash";
    return sessions
      .filter((s) => (isTrash ? Boolean(s.deletedAt) : !s.deletedAt))
      .filter((s) => matchesSession(s, query));
  }, [sessions, query, viewMode]);

  async function handleSaveTabs() {
    setIsSaving(true);
    const response = await sendBackgroundRequest({ type: "SAVE_TABS", target: saveTarget });
    setIsSaving(false);

    if (!response.ok || !response.session) {
      toast.error(response.ok ? "Nothing was saved." : response.error);
      return;
    }

    const saved = response.session;
    setSaveBurst({ id: saved.id, tabs: saved.tabs.slice(0, 4) });
    setFreshlySavedId(saved.id);
    setJustSaved(true);
    setExpandedIds((cur) => new Set(cur).add(saved.id));
    setViewMode("library");
    await reload();

    setTimeout(() => setJustSaved(false),     reduceMotion ? 0 : 1400);
    setTimeout(() => setSaveBurst(null),      reduceMotion ? 0 : 650);
    setTimeout(() => setFreshlySavedId(null), reduceMotion ? 0 : 1800);
    setTimeout(
      () => toast.success(`Saved ${saved.tabs.length} ${saved.tabs.length === 1 ? "tab" : "tabs"}.`, {
        action: { label: "Undo", onClick: () => void undoSave(saved) },
      }),
      reduceMotion ? 0 : 520,
    );
  }

  async function undoSave(session: StashSession) {
    // Undoing a save reopens the tabs and removes the just-created session.
    await sendBackgroundRequest({ type: "RESTORE_SESSION", sessionId: session.id });
    await reload();
  }

  async function reAddSessions(toAdd: StashSession[]) {
    await sendBackgroundRequest({ type: "ADD_SESSIONS", sessions: toAdd });
    await reload();
  }

  async function undoRestore(toAdd: StashSession[]) {
    await sendBackgroundRequest({ type: "UNDO_RESTORE_SESSION", sessions: toAdd });
    await reload();
  }

  async function handleRestoreAll(session: StashSession) {
    if (!session.tabs.length) return;
    setRestoreBurstId(session.id);
    // Restore runs in the service worker, so it completes even as the popup closes.
    const response = await sendBackgroundRequest({ type: "RESTORE_SESSION", sessionId: session.id });
    await reload();
    setTimeout(() => setRestoreBurstId(null), reduceMotion ? 0 : 400);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }

    const r = response.restore;
    // Anything failed → the session was kept (nothing lost), so no Undo. If the
    // cause is file access, offer a one-tap jump to the toggle.
    if (r && r.opened === 0) {
      toast.error(
        r.needsFileAccess
          ? "Local files need “Allow access to file URLs”. Turn it on, then restore again."
          : "Couldn’t open these tabs. Nothing was removed from your stash.",
        r.needsFileAccess ? { action: { label: "Enable", onClick: openFileAccessSettings } } : undefined,
      );
      return;
    }

    if (r && r.failed > 0) {
      toast.warning(
        r.needsFileAccess
          ? `Opened ${r.opened} of ${r.opened + r.failed}. Local files need file access — kept in your stash so you can retry.`
          : `Opened ${r.opened} of ${r.opened + r.failed}. The rest are kept in your stash.`,
        r.needsFileAccess ? { action: { label: "Enable", onClick: openFileAccessSettings } } : undefined,
      );
      return;
    }

    toast.success(
      `Restored ${session.tabs.length} ${session.tabs.length === 1 ? "tab" : "tabs"}. Cleared from your stash.`,
      { action: { label: "Undo", onClick: () => void undoRestore([session]) } },
    );
  }

  async function handleRestoreTab(tab: StashTab) {
    const response = await sendBackgroundRequest({ type: "RESTORE_TAB", url: tab.url });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success("Tab restored.");
  }

  async function handleDeleteSession(session: StashSession) {
    await sendBackgroundRequest({ type: "SOFT_DELETE_SESSION", sessionId: session.id });
    await reload();
    toast.success("Moved to trash.", {
      action: {
        label: "Undo",
        onClick: () =>
          void sendBackgroundRequest({ type: "RESTORE_DELETED_SESSION", sessionId: session.id }).then(reload),
      },
    });
  }

  async function handleDeleteForever(session: StashSession) {
    await sendBackgroundRequest({ type: "DELETE_FOREVER", sessionId: session.id });
    await reload();
    toast.success("Deleted forever.", {
      action: { label: "Undo", onClick: () => void reAddSessions([session]) },
    });
  }

  async function handleEmptyTrash() {
    const trashSessions = sessions.filter((s) => s.deletedAt);
    await sendBackgroundRequest({ type: "EMPTY_TRASH" });
    await reload();
    toast.success("Trash emptied.", {
      action: { label: "Undo", onClick: () => void reAddSessions(trashSessions) },
    });
  }

  async function handleRestoreDeleted(id: string) {
    await sendBackgroundRequest({ type: "RESTORE_DELETED_SESSION", sessionId: id });
    await reload();
    toast.success("Restored from trash.", {
      action: {
        label: "Undo",
        onClick: () =>
          void sendBackgroundRequest({ type: "SOFT_DELETE_SESSION", sessionId: id }).then(reload),
      },
    });
  }

  async function handleRemoveTab(sessionId: string, tabId: string) {
    await sendBackgroundRequest({ type: "REMOVE_TAB", sessionId, tabId });
    await reload();
  }

  function toggleExpanded(id: string) {
    setExpandedIds((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startRename(session: StashSession) {
    setEditingId(session.id);
    setDraftName("");
    setOriginalName(session.name);
  }

  async function submitRename(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!editingId) return;

    const newName = draftName.trim();
    const oldName = originalName;

    // If the name hasn't changed or is empty, restore the old name in sessions and exit
    if (!newName || newName === oldName.trim()) {
      setSessions((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, name: oldName } : s))
      );
      setEditingId(null);
      setDraftName("");
      setOriginalName("");
      return;
    }

    await sendBackgroundRequest({ type: "RENAME_SESSION", sessionId: editingId, name: newName });
    const targetId = editingId;
    setEditingId(null);
    setDraftName("");
    setOriginalName("");
    await reload();

    toast.success(`Renamed to "${newName}".`, {
      action: {
        label: "Undo",
        onClick: () => {
          void sendBackgroundRequest({ type: "RENAME_SESSION", sessionId: targetId, name: oldName }).then(reload);
        },
      },
    });
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (editingId && originalName) {
        setSessions((prev) =>
          prev.map((s) => (s.id === editingId ? { ...s, name: originalName } : s))
        );
      }
      setEditingId(null);
      setDraftName("");
      setOriginalName("");
      void reload();
    }
  }

  return (
    <TooltipProvider delayDuration={400}>
      <main className={cn(
        "paper-bg relative flex h-[580px] w-[400px] flex-col overflow-hidden text-ink",
        compactMode && "is-compact",
      )}>

        {/* ── Header ─────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 pb-4 pt-5">
          <div>
            <h1 className="wordmark text-[30px] text-ink leading-none">
              Stash
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  aria-label="Settings"
                  onClick={() => chrome.runtime.openOptionsPage()}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] text-muted shadow-[var(--shadow-raised)] transition-[box-shadow,color] duration-[var(--dur-fast)] hover:text-ink hover:shadow-[var(--shadow-raised-hover)]"
                  whileHover={{ y: -2, rotate: 35 }}
                  whileTap={{ scale: 0.9, y: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                >
                  <Settings size={15} />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>

            <motion.div
              whileHover={{ scale: 1.035 }}
              whileTap={{ scale: 0.95 }}
              animate={justSaved && !reduceMotion ? { scale: [1, 1.06, 1] } : undefined}
              transition={{ type: "spring", stiffness: 480, damping: 26 }}
            >
              <Button variant="primary" size="md" onClick={handleSaveTabs} disabled={isSaving} className="gap-1.5">
                <span className="grid place-items-center" style={{ width: 14, height: 14 }}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isSaving ? "load" : justSaved ? "done" : "idle"}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.5, rotate: -30 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: 30 }}
                      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      className="flex"
                    >
                      {isSaving
                        ? <Loader2 size={14} className="animate-spin" />
                        : justSaved
                        ? <Check size={14} strokeWidth={3} />
                        : <PanelTopClose size={14} />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                {isSaving ? "Saving…" : justSaved ? "Saved!" : "Save tabs"}
              </Button>
            </motion.div>
          </div>
        </header>

        {/* ── Tab nav ────────────────────────────────────────── */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="space-y-2.5 px-5 pb-3 pt-1">
            <TabsList>
              <TabsTrigger value="library" active={viewMode === "library"}>
                Library
                {activeCount > 0 && (
                  <span className={cn(
                    "inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold leading-none transition-colors duration-[var(--dur-fast)]",
                    viewMode === "library" ? "bg-accent/15 text-accent-text" : "bg-ink/[0.07] text-muted-2",
                  )}>
                    <NumberFlow value={activeCount} />
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="trash" active={viewMode === "trash"}>
                Trash
                {trashCount > 0 && (
                  <span className={cn(
                    "inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold leading-none transition-colors duration-[var(--dur-fast)]",
                    viewMode === "trash" ? "bg-accent/15 text-accent-text" : "bg-ink/[0.07] text-muted-2",
                  )}>
                    <NumberFlow value={trashCount} />
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <label className="flex h-10 items-center gap-2.5 rounded-full border border-border bg-surface px-4 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus-within:border-accent/40 focus-within:shadow-[var(--shadow-md)]">
              <Search size={15} className="shrink-0 text-muted-2" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search sessions, tabs, URLs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted-2"
                style={{ fontFamily: "var(--font-body)" }}
              />
            </label>
          </div>

          {/* ── Content ──────────────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${viewMode}-${query.trim() ? "q" : "all"}`}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
              >
                <TabsContent value={viewMode}>
                  {viewMode === "trash" && trashCount > 0 && (
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-2">
                        30-day trash
                      </span>
                      <motion.button
                        type="button"
                        onClick={handleEmptyTrash}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.95, y: 0 }}
                        transition={{ type: "spring", stiffness: 480, damping: 26 }}
                        className="flex items-center gap-1.5 rounded-full bg-[image:linear-gradient(180deg,#C84A4A_0%,#B84040_55%,#9E3434_100%)] px-3.5 py-1.5 font-body text-[13px] font-semibold text-white shadow-[0_1px_1px_rgba(80,20,20,0.40),0_5px_12px_-4px_rgba(184,64,64,0.50),inset_0_1px_0_rgba(255,255,255,0.25)] transition-[box-shadow,filter] duration-[var(--dur-fast)] hover:brightness-[1.05] hover:shadow-[0_2px_3px_rgba(80,20,20,0.40),0_10px_20px_-6px_rgba(184,64,64,0.55),inset_0_1px_0_rgba(255,255,255,0.30)]"
                      >
                        <Trash2 size={13} />
                        Empty trash
                      </motion.button>
                    </div>
                  )}

                  {visibleSessions.length > 0 ? (
                    <SessionList
                      sessions={visibleSessions}
                      expandedIds={expandedIds}
                      editingId={editingId}
                      draftName={draftName}
                      viewMode={viewMode}
                      freshlySavedId={freshlySavedId}
                      restoreBurstId={restoreBurstId}
                      compactMode={compactMode}
                      reduceMotion={Boolean(reduceMotion)}
                      onDraftNameChange={(name) => {
                        setDraftName(name);
                        setSessions((prev) =>
                          prev.map((s) => (s.id === editingId ? { ...s, name } : s))
                        );
                      }}
                      onToggleExpanded={toggleExpanded}
                      onRenameStart={startRename}
                      onRenameSubmit={submitRename}
                      onRenameKeyDown={handleRenameKeyDown}
                      onRestoreAll={handleRestoreAll}
                      onRestoreTab={handleRestoreTab}
                      onDeleteSession={handleDeleteSession}
                      onDeleteForever={handleDeleteForever}
                      onRestoreDeleted={handleRestoreDeleted}
                      onRemoveTab={handleRemoveTab}
                    />
                  ) : (
                    <EmptyState
                      viewMode={viewMode}
                      query={query}
                      reduceMotion={Boolean(reduceMotion)}
                    />
                  )}
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>

        <AnimatePresence>
          {saveBurst && <SaveBurstAnim burst={saveBurst} reduceMotion={Boolean(reduceMotion)} />}
        </AnimatePresence>
        <Toaster />
      </main>
    </TooltipProvider>
  );
}

/* ── Session list ──────────────────────────────────────────────── */
function SessionList({
  sessions, expandedIds, editingId, draftName, viewMode,
  freshlySavedId, restoreBurstId, compactMode, reduceMotion,
  onDraftNameChange, onToggleExpanded, onRenameStart, onRenameSubmit,
  onRenameKeyDown, onRestoreAll, onRestoreTab, onDeleteSession,
  onDeleteForever, onRestoreDeleted, onRemoveTab,
}: {
  sessions: StashSession[];
  expandedIds: Set<string>;
  editingId: string | null;
  draftName: string;
  viewMode: ViewMode;
  freshlySavedId: string | null;
  restoreBurstId: string | null;
  compactMode: boolean;
  reduceMotion: boolean;
  onDraftNameChange: (n: string) => void;
  onToggleExpanded: (id: string) => void;
  onRenameStart: (s: StashSession) => void;
  onRenameSubmit: (e?: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onRenameKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onRestoreAll: (s: StashSession) => void | Promise<void>;
  onRestoreTab: (t: StashTab) => void | Promise<void>;
  onDeleteSession: (s: StashSession) => void | Promise<void>;
  onDeleteForever: (s: StashSession) => void | Promise<void>;
  onRestoreDeleted: (id: string) => void | Promise<void>;
  onRemoveTab: (sid: string, tid: string) => void | Promise<void>;
}) {
  return (
    <LayoutGroup>
      <motion.section
        className="grid gap-2"
        aria-label={viewMode === "trash" ? "Deleted sessions" : "Saved sessions"}
      >
        <AnimatePresence initial={false}>
          {sessions.map((session, i) => {
            const isExpanded  = expandedIds.has(session.id);
            const isEditing   = editingId === session.id;
            const isFresh     = freshlySavedId === session.id;
            const isRestoring = restoreBurstId === session.id;

            return (
              <motion.article
                key={session.id}
                layout
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82, x: 24, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                whileHover={reduceMotion ? undefined : { y: -3, transition: { type: "spring", stiffness: 420, damping: 26 } }}
                whileTap={reduceMotion ? undefined : { scale: 0.992 }}
                transition={{
                  layout: { duration: 0.16, ease: [0.2, 0, 0, 1] },
                  duration: 0.22,
                  delay: reduceMotion ? 0 : Math.min(i * 0.04, 0.16),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  // Accent spine is an inset box-shadow so it follows the rounded edge the full height (no corner clipping)
                  "group relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[inset_4px_0_0_0_var(--color-accent),var(--shadow-sm)] transition-shadow duration-[var(--dur-base)] hover:border-border-strong hover:shadow-[inset_4px_0_0_0_var(--color-accent),var(--shadow-md)]",
                  isFresh && "ring-2 ring-accent/30",
                )}
              >
                {/* Card header */}
                <div className={cn(
                  "flex items-start gap-3 pl-4 pr-3",
                  compactMode ? "py-3" : "py-5",
                )}>
                  {/* Expand button — just the chevron, small, top-left */}
                  <motion.button
                    type="button"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    onClick={() => onToggleExpanded(session.id)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-surface-subtle text-muted shadow-[var(--shadow-xs)] transition-all duration-[var(--dur-fast)] hover:border-border-strong hover:bg-control-hover hover:text-ink hover:shadow-[var(--shadow-sm)]"
                  >
                    <motion.span
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 24 }}
                      className="inline-flex"
                    >
                      <ChevronRight size={16} />
                    </motion.span>
                  </motion.button>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isFresh && <FreshDot reduceMotion={reduceMotion} />}
                      <form 
                        className="w-full" 
                        onSubmit={(e) => { e.preventDefault(); void onRenameSubmit(); }}
                      >
                        {isEditing ? (
                          <textarea
                            ref={(el) => {
                              if (el && !el.dataset.hasFocused) {
                                el.focus();
                                el.select();
                                el.dataset.hasFocused = "true";
                              }
                            }}
                            value={draftName}
                            onChange={(e) => onDraftNameChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                e.currentTarget.blur();
                              } else {
                                onRenameKeyDown(e as any);
                              }
                            }}
                            onBlur={() => { if (isEditing) { void onRenameSubmit(); } }}
                            className="font-display display-title block w-full text-[17px] font-semibold text-ink leading-snug bg-transparent border-none outline-none focus:outline-none focus:ring-0 pl-2 pr-0 py-0 rounded-none resize-none overflow-hidden cursor-text h-[48px] scrollbar-none"
                          />
                        ) : (
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() => onToggleExpanded(session.id)}
                          >
                            <span className="font-display display-title text-[17px] font-semibold text-ink leading-snug line-clamp-2 break-words select-none pl-2">
                              {session.name}
                            </span>
                          </button>
                        )}
                      </form>
                    </div>
                    
                    <button
                      type="button"
                      className="mt-2 flex w-full items-center gap-2 text-left"
                      onClick={() => onToggleExpanded(session.id)}
                    >
                      <FaviconSpine tabs={session.tabs} isRestoring={isRestoring} reduceMotion={reduceMotion} />
                      <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-muted-2">
                        <NumberFlow value={session.tabs.length} />&nbsp;{session.tabs.length === 1 ? "tab" : "tabs"}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-muted-2 whitespace-nowrap">
                        {formatDate(session.createdAt)}
                      </span>
                    </button>
                  </div>

                  {/* Right zone — secondary actions fade in on hover (reserved space, no shift),
                      primary Restore is always visible and large for an easy tap. */}
                  <div className="flex shrink-0 items-center gap-1">
                    <div className="pointer-events-none flex items-center gap-0.5 opacity-0 transition-opacity duration-[var(--dur-base)] group-hover:pointer-events-auto group-hover:opacity-100">
                      {viewMode === "trash" ? (
                        <ActionBtn label="Delete forever" danger onClick={() => void onDeleteForever(session)}>
                          <X size={14} />
                        </ActionBtn>
                      ) : (
                        <>
                          <ActionBtn label="Rename" onClick={() => onRenameStart(session)}>
                            <Pencil size={14} />
                          </ActionBtn>
                          <ActionBtn label="Move to trash" danger onClick={() => void onDeleteSession(session)}>
                            <Trash2 size={14} />
                          </ActionBtn>
                        </>
                      )}
                    </div>
                    {viewMode === "trash" ? (
                      <RestoreButton
                        label="Restore from trash"
                        icon={<Undo2 size={16} />}
                        onClick={() => void onRestoreDeleted(session.id)}
                      />
                    ) : (
                      <RestoreButton
                        label="Restore tabs"
                        icon={<RotateCcw size={16} />}
                        onClick={() => void onRestoreAll(session)}
                      />
                    )}
                  </div>
                </div>

                {/* Expanded tab list */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.ul
                      key="tabs"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                      className="m-0 list-none overflow-hidden border-t border-border p-1.5"
                    >
                      <AnimatePresence initial={false}>
                        {session.tabs.map((tab) => (
                          <motion.li
                            key={tab.id}
                            layout
                            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
                            className="group/row flex min-h-[38px] items-center gap-1 rounded-[10px] transition-colors hover:bg-surface-subtle"
                          >
                            <button
                              type="button"
                              className="flex flex-1 min-w-0 items-center gap-2.5 px-2.5 py-1.5 text-left transition-transform duration-[var(--dur-fast)] ease-[var(--ease-std)] group-hover/row:translate-x-0.5 active:scale-[0.99]"
                              onClick={() => void onRestoreTab(tab)}
                            >
                              <Favicon tab={tab} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-ink">{tab.title}</span>
                                <span className="block truncate font-mono text-[11.5px] text-muted-2">{formatUrl(tab.url)}</span>
                              </span>
                              <ExternalLink size={12} className="shrink-0 -translate-x-1 text-muted-2 opacity-0 transition-all duration-[var(--dur-fast)] group-hover/row:translate-x-0 group-hover/row:opacity-100" />
                            </button>
                            {viewMode === "library" && (
                              <ActionBtn label="Remove tab" danger onClick={() => void onRemoveTab(session.id, tab.id)} className="mr-1">
                                <Trash2 size={13} />
                              </ActionBtn>
                            )}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </motion.section>
    </LayoutGroup>
  );
}

/* ── Empty state ───────────────────────────────────────────────── */
function EmptyState({
  viewMode, query, reduceMotion,
}: {
  viewMode: ViewMode; query: string; reduceMotion: boolean;
}) {
  const isSearch = query.trim().length > 0;
  const showPreview = !isSearch;
  const title = isSearch
    ? "No matches"
    : viewMode === "trash"
    ? "Trash is empty"
    : "Nothing stashed yet";
  const copy = isSearch
    ? "Try a session name, tab title, or URL."
    : viewMode === "trash"
    ? "Sessions you delete rest here for 30 days before they're gone for good."
    : "Tuck every open tab into one tidy session. Bring the whole set back in a single click.";

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center"
    >
      {showPreview && (
        <div className="mb-7">
          {viewMode === "trash"
            ? <TrashEmpty reduceMotion={reduceMotion} />
            : <EmptyPreview reduceMotion={reduceMotion} />}
        </div>
      )}
      <p className="display-emphasis font-display text-[25px] leading-tight text-ink">{title}</p>
      <p className="mt-2.5 max-w-[250px] text-[13px] leading-relaxed text-muted">{copy}</p>
    </motion.section>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */
function ActionBtn({
  label, danger = false, children, onClick, className,
}: {
  label: string; danger?: boolean; children: React.ReactNode;
  onClick: () => void; className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          aria-label={label}
          onClick={onClick}
          whileHover={{ scale: 1.18 }}
          whileTap={{ scale: 0.82 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-muted-2 transition-colors duration-[var(--dur-fast)]",
            danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-surface-muted hover:text-ink",
            className,
          )}
        >
          {children}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/* Primary action on every card: large, always-visible, fills with accent on hover. */
function RestoreButton({
  label, icon, onClick,
}: {
  label: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          aria-label={label}
          onClick={onClick}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.84 }}
          transition={{ type: "spring", stiffness: 480, damping: 20 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] text-accent-text shadow-[var(--shadow-raised)] transition-[color,box-shadow,border-color] duration-[var(--dur-fast)] hover:border-accent hover:bg-accent hover:bg-none hover:text-[#FFF2BD] hover:shadow-[var(--shadow-primary)]"
        >
          {icon}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function FreshDot({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0 rounded-full bg-accent">
      {!reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent"
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </span>
  );
}

function FaviconSpine({
  tabs, isRestoring, reduceMotion,
}: { tabs: StashTab[]; isRestoring: boolean; reduceMotion: boolean }) {
  const visible  = tabs.slice(0, 3);
  const overflow = tabs.length - visible.length;
  return (
    <div className="flex shrink-0 items-center">
      {visible.map((tab, i) => (
        <motion.span
          key={tab.id}
          className="-ml-1.5 shrink-0 first:ml-0"
          style={{ zIndex: visible.length - i }}
          animate={
            isRestoring && !reduceMotion
              ? { x: (i - 1) * 4, rotate: (i - 1) * 5 }
              : { x: 0, rotate: 0 }
          }
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <Favicon tab={tab} spine />
        </motion.span>
      ))}
      {overflow > 0 && (
        <span className="-ml-1.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-border bg-chip px-1 font-mono text-[9px] font-semibold text-muted-2 ring-[2px] ring-white">
          +{overflow}
        </span>
      )}
    </div>
  );
}

/** Open Stash's details page, where "Allow access to file URLs" lives. */
function openFileAccessSettings() {
  void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
}

/** Chrome's own favicon cache — served locally, so it never 404s or needs auth. */
function chromeFaviconUrl(pageUrl: string, size = 32): string {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", String(size));
  return url.toString();
}

function Favicon({ tab, spine = false }: { tab: StashTab; spine?: boolean }) {
  // Reset the error state if this slot gets reused for a different tab.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [tab.url]);

  const cls = cn(
    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-chip)] border border-border bg-chip object-cover text-[9px] font-bold text-muted-2",
    spine && "ring-[2px] ring-white shadow-[var(--shadow-xs)]",
  );

  const src = tab.url ? chromeFaviconUrl(tab.url) : tab.favicon;
  if (!src || failed) {
    return <span className={cls}>{tab.title.trim().charAt(0).toUpperCase() || "S"}</span>;
  }
  return <img className={cls} src={src} alt="" onError={() => setFailed(true)} />;
}

function SaveBurstAnim({ burst, reduceMotion }: { burst: SaveBurst; reduceMotion: boolean }) {
  if (reduceMotion) return null;
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[72px] z-20 -translate-x-1/2"
      initial={{ opacity: 0, y: -10, scale: 1.1 }}
      animate={{ opacity: [0, 1, 1, 0], y: [-10, 0, 60, 80], scale: [1.1, 1, 0.85, 0.7] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center">
        {burst.tabs.map((tab, i) => (
          <motion.span
            key={`${burst.id}-${tab.id}`}
            className="-ml-1 first:ml-0"
            initial={{ x: (i - 1.5) * 12, rotate: (i - 1.5) * 6 }}
            animate={{ x: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32, delay: i * 0.03 }}
          >
            <Favicon tab={tab} />
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Utils ─────────────────────────────────────────────────────── */
function formatDate(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(ts));
}

function formatUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}
