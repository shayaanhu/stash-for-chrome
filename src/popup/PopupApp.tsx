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
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Toaster } from "../components/ui/toaster";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../lib/utils";
import { sendBackgroundRequest } from "../shared/messages";
import {
  deleteSessionForever,
  emptyTrash,
  getSessions,
  getSettings,
  removeTabFromSession,
  restoreDeletedSession,
  saveSessions,
  softDeleteSession,
  updateSessionName,
} from "../shared/storage";
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
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
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
    setStatus(null);
    const response = await sendBackgroundRequest({ type: "SAVE_TABS", target: saveTarget });
    setIsSaving(false);

    if (!response.ok) {
      setStatus(response.error);
      toast.error(response.error);
      return;
    }

    const saved = response.session;
    setSaveBurst({ id: saved.id, tabs: saved.tabs.slice(0, 4) });
    setFreshlySavedId(saved.id);
    setExpandedIds((cur) => new Set(cur).add(saved.id));
    setViewMode("library");
    await reload();

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
    await createWindow(session.tabs.map((t) => t.url));
    await deleteSessionForever(session.id);
    await reload();
  }

  async function handleRestoreAll(session: StashSession) {
    if (!session.tabs.length) return;
    setRestoreBurstId(session.id);
    await createWindow(session.tabs.map((t) => t.url));
    toast.success("Restored to a new window.");
    setTimeout(() => setRestoreBurstId(null), reduceMotion ? 0 : 400);
  }

  async function handleRestoreTab(tab: StashTab) {
    await createTab(tab.url);
    toast.success("Tab restored.");
  }

  async function handleDeleteSession(session: StashSession) {
    await softDeleteSession(session.id);
    await reload();
    toast("Moved to trash.", {
      action: {
        label: "Undo",
        onClick: () => void restoreDeletedSession(session.id).then(reload),
      },
    });
  }

  async function handleDeleteForever(session: StashSession) {
    await deleteSessionForever(session.id);
    await reload();
    toast("Deleted forever.", {
      action: {
        label: "Undo",
        onClick: async () => {
          const current = await getSessions();
          await saveSessions([...current, session]);
          await reload();
        },
      },
    });
  }

  async function handleEmptyTrash() {
    const trashSessions = sessions.filter((s) => s.deletedAt);
    await emptyTrash();
    await reload();
    toast("Trash emptied.", {
      action: {
        label: "Undo",
        onClick: async () => {
          const current = await getSessions();
          await saveSessions([...current, ...trashSessions]);
          await reload();
        },
      },
    });
  }

  async function handleRemoveTab(sessionId: string, tabId: string) {
    await removeTabFromSession(sessionId, tabId);
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
    setDraftName(session.name);
  }

  async function submitRename(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!editingId) return;
    await updateSessionName(editingId, draftName);
    setEditingId(null);
    setDraftName("");
    await reload();
  }

  function handleRenameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setEditingId(null); setDraftName(""); }
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
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-btn)] text-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-muted hover:text-ink"
                  whileTap={{ scale: 0.90 }}
                  transition={{ duration: 0.1 }}
                >
                  <Settings size={15} />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>

            <motion.div whileTap={{ scale: 0.96 }} transition={{ duration: 0.1 }}>
              <Button variant="primary" size="md" onClick={handleSaveTabs} disabled={isSaving} className="gap-1.5">
                {isSaving
                  ? <Loader2 size={14} className="animate-spin" />
                  : <PanelTopClose size={14} />}
                {isSaving ? "Saving…" : "Save tabs"}
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
                    "font-mono text-[11px]",
                    viewMode === "library" ? "text-accent-text" : "text-muted-2",
                  )}>
                    <NumberFlow value={activeCount} />
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="trash" active={viewMode === "trash"}>
                Trash
                {trashCount > 0 && (
                  <span className={cn(
                    "font-mono text-[11px]",
                    viewMode === "trash" ? "text-accent-text" : "text-muted-2",
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
            {status && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 rounded-[var(--radius-btn)] border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger-ink"
              >
                {status}
              </motion.p>
            )}

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
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.1 }}
                        className="flex items-center gap-1.5 rounded-[var(--radius-btn)] bg-danger px-3.5 py-1.5 font-body text-[13px] font-semibold text-white shadow-[var(--shadow-xs)] transition-[background-color,opacity] duration-[var(--dur-fast)] hover:opacity-90"
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
                      onDraftNameChange={setDraftName}
                      onToggleExpanded={toggleExpanded}
                      onRenameStart={startRename}
                      onRenameSubmit={submitRename}
                      onRenameKeyDown={handleRenameKeyDown}
                      onRestoreAll={handleRestoreAll}
                      onRestoreTab={handleRestoreTab}
                      onDeleteSession={handleDeleteSession}
                      onDeleteForever={handleDeleteForever}
                      onRestoreDeleted={async (id) => { await restoreDeletedSession(id); await reload(); }}
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
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={{
                  layout: { duration: 0.16, ease: [0.2, 0, 0, 1] },
                  duration: 0.22,
                  delay: reduceMotion ? 0 : Math.min(i * 0.04, 0.16),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  "group relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-sm)] transition-shadow duration-[var(--dur-base)] hover:shadow-[var(--shadow-md)]",
                  isFresh && "ring-2 ring-accent/30",
                )}
              >
                {/* Left accent strip — full height, clipped by card overflow-hidden */}
                <div className={cn(
                  "absolute inset-y-0 left-0 w-[3px] transition-opacity duration-[var(--dur-base)]",
                  isFresh ? "bg-accent opacity-100" : "bg-accent opacity-0 group-hover:opacity-50",
                )} />

                {/* Card header */}
                <div className={cn(
                  "flex items-start gap-3 pl-4 pr-3",
                  compactMode ? "py-3" : "py-5",
                )}>
                  {/* Expand button — just the chevron, small, top-left */}
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    onClick={() => onToggleExpanded(session.id)}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-2 transition-colors hover:text-muted"
                  >
                    <motion.span
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                      className="inline-flex"
                    >
                      <ChevronRight size={13} />
                    </motion.span>
                  </button>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <form className="flex items-center gap-1.5" onSubmit={onRenameSubmit}>
                        <Input
                          value={draftName}
                          onChange={(e) => onDraftNameChange(e.target.value)}
                          onKeyDown={onRenameKeyDown}
                          onBlur={() => void onRenameSubmit()}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button type="submit" variant="primary" size="iconSm" aria-label="Save">
                          <Check size={13} />
                        </Button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => onToggleExpanded(session.id)}
                      >
                        <span className="flex items-center gap-2">
                          {isFresh && <FreshDot reduceMotion={reduceMotion} />}
                          <span className="font-display display-title block truncate text-[17px] font-semibold text-ink leading-snug">
                            {session.name}
                          </span>
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-muted-2">
                            <NumberFlow value={session.tabs.length} />&nbsp;{session.tabs.length === 1 ? "tab" : "tabs"}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-muted-2">
                            {formatDate(session.createdAt)}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Right zone — fixed width so actions never bleed over text */}
                  <div className={cn(
                    "relative shrink-0",
                    viewMode === "trash" ? "w-[60px]" : "w-[88px]",
                  )}>
                    {/* Favicons — hidden on hover */}
                    <div className="flex items-center justify-end transition-opacity duration-[var(--dur-base)] group-hover:opacity-0 group-hover:pointer-events-none">
                      <FaviconSpine tabs={session.tabs} isRestoring={isRestoring} reduceMotion={reduceMotion} />
                    </div>
                    {/* Actions — shown on hover, exact same footprint */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-[var(--dur-base)] group-hover:pointer-events-auto group-hover:opacity-100">
                      {viewMode === "trash" ? (
                        <>
                          <ActionBtn label="Restore session" onClick={() => void onRestoreDeleted(session.id)}>
                            <Undo2 size={14} />
                          </ActionBtn>
                          <ActionBtn label="Delete forever" danger onClick={() => void onDeleteForever(session)}>
                            <X size={14} />
                          </ActionBtn>
                        </>
                      ) : (
                        <>
                          <ActionBtn label="Restore all tabs" onClick={() => void onRestoreAll(session)}>
                            <RotateCcw size={14} />
                          </ActionBtn>
                          <ActionBtn label="Rename" onClick={() => onRenameStart(session)}>
                            <Pencil size={14} />
                          </ActionBtn>
                          <ActionBtn label="Move to trash" danger onClick={() => void onDeleteSession(session)}>
                            <Trash2 size={14} />
                          </ActionBtn>
                        </>
                      )}
                    </div>
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
                            className="flex min-h-[38px] items-center gap-1 rounded-[var(--radius-btn)] transition-colors hover:bg-surface-subtle"
                          >
                            <button
                              type="button"
                              className="flex flex-1 min-w-0 items-center gap-2.5 px-2.5 py-1.5 text-left"
                              onClick={() => void onRestoreTab(tab)}
                            >
                              <Favicon tab={tab} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-ink">{tab.title}</span>
                                <span className="block truncate font-mono text-[11.5px] text-muted-2">{formatUrl(tab.url)}</span>
                              </span>
                              <ExternalLink size={12} className="shrink-0 text-muted-2" />
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
  const isLibraryEmpty = !isSearch && viewMode === "library";
  const title = isSearch
    ? "No matches"
    : viewMode === "trash"
    ? "Trash is empty"
    : "Nothing stashed yet";
  const copy = isSearch
    ? "Try a session name, tab title, or URL."
    : viewMode === "trash"
    ? "Deleted sessions wait here for 30 days."
    : "Save your open tabs into one tidy session — restore the whole set in a click.";

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center"
    >
      {isLibraryEmpty && (
        <div className="mb-7">
          <EmptyPreview reduceMotion={reduceMotion} />
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
          whileTap={{ scale: 0.88 }}
          transition={{ duration: 0.1 }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-[var(--radius-btn)] text-muted-2 transition-colors duration-[var(--dur-fast)]",
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
    <div className="flex items-center">
      {visible.map((tab, i) => (
        <motion.span
          key={tab.id}
          className="-ml-1.5 first:ml-0"
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
        <span className="-ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-chip px-1 font-mono text-[9px] font-semibold text-muted-2 ring-[2px] ring-white">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function Favicon({ tab, spine = false }: { tab: StashTab; spine?: boolean }) {
  const cls = cn(
    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-chip)] border border-border bg-chip object-cover text-[9px] font-bold text-muted-2",
    spine && "ring-[2px] ring-white shadow-[var(--shadow-xs)]",
  );
  if (!tab.favicon) {
    return <span className={cls}>{tab.title.trim().charAt(0).toUpperCase() || "S"}</span>;
  }
  return <img className={cls} src={tab.favicon} alt="" />;
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
function createTab(url: string): Promise<void> {
  return new Promise((res, rej) =>
    chrome.tabs.create({ url, active: true }, () =>
      chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()
    )
  );
}

function createWindow(urls: string[]): Promise<void> {
  return new Promise((res, rej) =>
    chrome.windows.create({ url: urls, focused: true }, () =>
      chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res()
    )
  );
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(ts));
}

function formatUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}
