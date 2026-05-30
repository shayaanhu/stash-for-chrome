import NumberFlow from "@number-flow/react";
import {
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  PanelTopClose,
  Pencil,
  Search,
  Settings,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StashMascot, type MascotState } from "../components/mascot/StashMascot";
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
  softDeleteSession,
  updateSessionName
} from "../shared/storage";
import { matchesSession, sortSessionsNewestFirst } from "../shared/session-utils";
import type { SaveTarget, StashSession, StashTab } from "../shared/types";

type ViewMode = "library" | "trash";

type SaveBurst = {
  id: string;
  tabs: StashTab[];
};

export function PopupApp() {
  const reduceMotion = useReducedMotion();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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
  const [mascotSignal, setMascotSignal] = useState<MascotState>("idle");

  const reload = useCallback(async () => {
    const [nextSessions, nextSettings] = await Promise.all([getSessions(), getSettings()]);
    setSessions(sortSessionsNewestFirst(nextSessions));
    setSaveTarget(nextSettings.saveTarget);
    setCompactMode(nextSettings.compactMode);
  }, []);

  useEffect(() => {
    void reload();

    const handleStorageChange = () => {
      void reload();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [reload]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const activeCount = sessions.filter((session) => !session.deletedAt).length;
  const trashCount = sessions.filter((session) => session.deletedAt).length;

  const visibleSessions = useMemo(() => {
    const isTrash = viewMode === "trash";

    return sessions
      .filter((session) => (isTrash ? Boolean(session.deletedAt) : !session.deletedAt))
      .filter((session) => matchesSession(session, query));
  }, [query, sessions, viewMode]);

  const emptyMascotState: MascotState = useMemo(() => {
    if (query.trim().length > 0) {
      return "search-miss";
    }

    if (viewMode === "trash") {
      return mascotSignal === "trash-empty" ? "trash-empty" : "idle";
    }

    return mascotSignal === "save" ? "save" : "idle";
  }, [mascotSignal, query, viewMode]);

  async function handleSaveTabs() {
    setIsSaving(true);
    setStatus(null);

    const wasEmpty = activeCount === 0;
    const response = await sendBackgroundRequest({
      type: "SAVE_TABS",
      target: saveTarget
    });

    setIsSaving(false);

    if (!response.ok) {
      setStatus(response.error);
      toast.error(response.error);
      return;
    }

    const savedSession = response.session;

    setSaveBurst({ id: savedSession.id, tabs: savedSession.tabs.slice(0, 4) });
    setFreshlySavedId(savedSession.id);
    setExpandedIds((current) => new Set(current).add(savedSession.id));
    setViewMode("library");
    setMascotSignal(wasEmpty ? "save" : "idle");
    await reload();

    window.setTimeout(() => setSaveBurst(null), reduceMotion ? 180 : 700);
    window.setTimeout(() => setFreshlySavedId(null), reduceMotion ? 300 : 1500);
    window.setTimeout(() => setMascotSignal("idle"), reduceMotion ? 300 : 900);
    window.setTimeout(
      () => {
        toast.success(`Saved ${savedSession.tabs.length} ${savedSession.tabs.length === 1 ? "tab" : "tabs"}.`, {
          action: {
            label: "Undo",
            onClick: () => {
              void undoSave(savedSession);
            }
          }
        });
      },
      reduceMotion ? 0 : 520
    );
  }

  async function undoSave(session: StashSession) {
    await createWindow(session.tabs.map((tab) => tab.url));
    await deleteSessionForever(session.id);
    await reload();
  }

  async function handleRestoreAll(session: StashSession) {
    if (session.tabs.length === 0) {
      return;
    }

    setRestoreBurstId(session.id);
    await createWindow(session.tabs.map((tab) => tab.url));
    toast.success("Restored to a new window.");
    window.setTimeout(() => setRestoreBurstId(null), reduceMotion ? 120 : 360);
  }

  async function handleRestoreTab(tab: StashTab) {
    await createTab(tab.url);
    toast.success("Restored tab.");
  }

  async function handleDeleteSession(session: StashSession) {
    await softDeleteSession(session.id);
    await reload();
    toast("Moved to trash.", {
      action: {
        label: "Undo",
        onClick: () => {
          void restoreDeletedSession(session.id).then(reload);
        }
      }
    });
  }

  async function handleDeleteForever(sessionId: string) {
    await deleteSessionForever(sessionId);
    await reload();
    toast("Deleted forever.");
  }

  async function handleEmptyTrash() {
    await emptyTrash();
    await reload();
    setMascotSignal("trash-empty");
    toast("Trash emptied.");
    window.setTimeout(() => setMascotSignal("idle"), reduceMotion ? 200 : 850);
  }

  async function handleRemoveTab(sessionId: string, tabId: string) {
    await removeTabFromSession(sessionId, tabId);
    await reload();
  }

  function toggleExpanded(sessionId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }

      return next;
    });
  }

  function startRename(session: StashSession) {
    setEditingId(session.id);
    setDraftName(session.name);
  }

  async function submitRename(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!editingId) {
      return;
    }

    await updateSessionName(editingId, draftName);
    setEditingId(null);
    setDraftName("");
    await reload();
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setEditingId(null);
      setDraftName("");
    }
  }

  function openOptionsPage() {
    chrome.runtime.openOptionsPage();
  }

  return (
    <TooltipProvider delayDuration={350}>
      <main
        className={cn(
          "relative min-h-[560px] w-[430px] overflow-hidden bg-bg p-[18px] text-ink",
          compactMode && "is-compact"
        )}
      >
        <header className="mb-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold tracking-normal text-accent">Stash</p>
            <h1 className="truncate font-display text-[22px] font-semibold leading-tight tracking-normal">
              {viewMode === "trash" ? "Trash" : "Saved sessions"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <IconButton label="Settings" onClick={openOptionsPage}>
              <Settings size={16} />
            </IconButton>
            <motion.div
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
            >
              <Button variant="primary" onClick={handleSaveTabs} disabled={isSaving} className="w-[112px]">
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <PanelTopClose size={16} />}
                <span>{isSaving ? "Saving" : "Save tabs"}</span>
              </Button>
            </motion.div>
          </div>
        </header>

        <label className="mb-2 flex h-10 items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface px-3 text-muted transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
          <Search size={16} />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search sessions, tabs, URLs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted-2"
            autoFocus
          />
        </label>

        {status ? (
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-3 py-2 text-sm leading-snug text-danger-ink"
          >
            {status}
          </motion.p>
        ) : null}

        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
          <TabsList className="grid-cols-2">
            <TabsTrigger value="library" active={viewMode === "library"}>
              Library
              <span className="font-mono text-xs text-muted-2">
                <NumberFlow value={activeCount} />
              </span>
            </TabsTrigger>
            <TabsTrigger value="trash" active={viewMode === "trash"}>
              Trash
              <span className="font-mono text-xs text-muted-2">
                <NumberFlow value={trashCount} />
              </span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${viewMode}-${query.trim() ? "search" : "all"}`}
              initial={reduceMotion ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
              transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
            >
              <TabsContent value={viewMode}>
                {viewMode === "trash" && trashCount > 0 ? (
                  <div className="-mt-1 mb-3 flex items-center justify-between text-xs text-muted">
                    <span>30-day trash</span>
                    <Button variant="ghost" size="sm" className="h-7 px-1 text-xs text-accent" onClick={handleEmptyTrash}>
                      Empty trash
                    </Button>
                  </div>
                ) : null}

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
                    onRestoreDeleted={async (sessionId) => {
                      await restoreDeletedSession(sessionId);
                      await reload();
                    }}
                    onRemoveTab={handleRemoveTab}
                  />
                ) : (
                  <EmptyState
                    viewMode={viewMode}
                    query={query}
                    mascotState={emptyMascotState}
                    isSaving={isSaving}
                    reduceMotion={Boolean(reduceMotion)}
                    onSave={handleSaveTabs}
                  />
                )}
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>

        <AnimatePresence>{saveBurst ? <SaveChoreography burst={saveBurst} reduceMotion={Boolean(reduceMotion)} /> : null}</AnimatePresence>
        <Toaster />
      </main>
    </TooltipProvider>
  );
}

function SessionList({
  sessions,
  expandedIds,
  editingId,
  draftName,
  viewMode,
  freshlySavedId,
  restoreBurstId,
  compactMode,
  reduceMotion,
  onDraftNameChange,
  onToggleExpanded,
  onRenameStart,
  onRenameSubmit,
  onRenameKeyDown,
  onRestoreAll,
  onRestoreTab,
  onDeleteSession,
  onDeleteForever,
  onRestoreDeleted,
  onRemoveTab
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
  onDraftNameChange: (name: string) => void;
  onToggleExpanded: (sessionId: string) => void;
  onRenameStart: (session: StashSession) => void;
  onRenameSubmit: (event?: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onRenameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onRestoreAll: (session: StashSession) => void | Promise<void>;
  onRestoreTab: (tab: StashTab) => void | Promise<void>;
  onDeleteSession: (session: StashSession) => void | Promise<void>;
  onDeleteForever: (sessionId: string) => void | Promise<void>;
  onRestoreDeleted: (sessionId: string) => void | Promise<void>;
  onRemoveTab: (sessionId: string, tabId: string) => void | Promise<void>;
}) {
  return (
    <LayoutGroup>
      <motion.section className="grid gap-2.5 pb-14" aria-label={viewMode === "trash" ? "Deleted sessions" : "Saved sessions"}>
        <AnimatePresence initial={false}>
          {sessions.map((session, index) => {
            const isExpanded = expandedIds.has(session.id);
            const isEditing = editingId === session.id;
            const isFresh = freshlySavedId === session.id;
            const isRestoring = restoreBurstId === session.id;

            return (
              <motion.article
                key={session.id}
                layout
                initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
                transition={{
                  layout: { duration: 0.18, ease: [0.2, 0, 0, 1] },
                  duration: 0.24,
                  delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.18),
                  ease: [0.22, 1, 0.36, 1]
                }}
                className={cn(
                  "group overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[0_1px_0_rgba(31,27,22,0.04),0_10px_22px_rgba(31,27,22,0.035)] transition-[border-color,box-shadow,transform] duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:-translate-y-px hover:border-border-strong hover:shadow-[0_1px_0_rgba(31,27,22,0.05),0_12px_26px_rgba(31,27,22,0.055)]",
                  isFresh && "border-accent/60"
                )}
              >
                <div
                  className={cn(
                    "grid items-center gap-2 px-2.5 py-2.5",
                    compactMode ? "min-h-[52px]" : "min-h-[64px]",
                    "grid-cols-[28px_minmax(0,1fr)_auto_auto]"
                  )}
                >
                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label={isExpanded ? "Collapse session" : "Expand session"}
                    onClick={() => onToggleExpanded(session.id)}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </Button>

                  <div className="min-w-0">
                    {isEditing ? (
                      <form className="grid grid-cols-[minmax(0,1fr)_28px] items-center gap-1.5" onSubmit={onRenameSubmit}>
                        <Input
                          value={draftName}
                          onChange={(event) => onDraftNameChange(event.target.value)}
                          onKeyDown={onRenameKeyDown}
                          onBlur={() => void onRenameSubmit()}
                          className="h-8"
                          autoFocus
                        />
                        <Button type="submit" variant="primary" size="iconSm" aria-label="Save name">
                          <Check size={15} />
                        </Button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="flex max-w-full flex-col items-start gap-1 text-left"
                        onClick={() => onToggleExpanded(session.id)}
                      >
                        <span className="flex max-w-full items-center gap-2">
                          {isFresh ? <FreshDot reduceMotion={reduceMotion} /> : null}
                          <span className="block truncate font-display text-sm font-semibold leading-tight tracking-normal text-ink">
                            {session.name}
                          </span>
                        </span>
                        <span className="block max-w-full truncate font-mono text-[11px] leading-tight text-muted">
                          <NumberFlow value={session.tabs.length} /> {session.tabs.length === 1 ? "tab" : "tabs"} ·{" "}
                          {formatDate(session.createdAt)}
                        </span>
                      </button>
                    )}
                  </div>

                  <FaviconSpine tabs={session.tabs} isRestoring={isRestoring} reduceMotion={reduceMotion} />

                  <div className="flex items-center gap-1">
                    {viewMode === "trash" ? (
                      <>
                        <IconButton label="Restore session" onClick={() => void onRestoreDeleted(session.id)}>
                          <Undo2 size={15} />
                        </IconButton>
                        <IconButton label="Delete forever" danger onClick={() => void onDeleteForever(session.id)}>
                          <X size={15} />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <IconButton label="Restore all" onClick={() => void onRestoreAll(session)}>
                          <ArchiveRestore size={15} />
                        </IconButton>
                        <IconButton label="Rename" onClick={() => onRenameStart(session)}>
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton label="Move to trash" danger onClick={() => void onDeleteSession(session)}>
                          <Trash2 size={15} />
                        </IconButton>
                      </>
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded ? (
                    <motion.ul
                      key="tabs"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                      className="m-0 grid list-none gap-px overflow-hidden border-t border-border p-1.5"
                    >
                      <AnimatePresence initial={false}>
                        {session.tabs.map((tab) => (
                          <motion.li
                            key={tab.id}
                            layout
                            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                            className="grid min-h-10 grid-cols-[minmax(0,1fr)_30px] items-center gap-1.5 rounded-[var(--radius-btn)] transition-colors duration-[var(--dur-instant)] ease-[var(--ease-standard)] hover:bg-surface-subtle"
                          >
                            <button
                              type="button"
                              className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)_16px] items-center gap-2 px-2 py-1.5 text-left"
                              onClick={() => void onRestoreTab(tab)}
                            >
                              <span className="transition-transform duration-[var(--dur-instant)] ease-[var(--ease-standard)] group-hover:translate-x-0.5">
                                <Favicon tab={tab} />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-ink">{tab.title}</span>
                                <span className="mt-0.5 block truncate text-[11px] text-muted">{formatUrl(tab.url)}</span>
                              </span>
                              <ExternalLink size={14} className="text-muted" />
                            </button>
                            {viewMode === "library" ? (
                              <IconButton label="Delete tab" danger onClick={() => void onRemoveTab(session.id, tab.id)}>
                                <Trash2 size={14} />
                              </IconButton>
                            ) : null}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </motion.ul>
                  ) : null}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </motion.section>
    </LayoutGroup>
  );
}

function EmptyState({
  viewMode,
  query,
  mascotState,
  isSaving,
  reduceMotion,
  onSave
}: {
  viewMode: ViewMode;
  query: string;
  mascotState: MascotState;
  isSaving: boolean;
  reduceMotion: boolean;
  onSave: () => void;
}) {
  const isSearchEmpty = query.trim().length > 0;
  const title = isSearchEmpty ? "No matches" : viewMode === "trash" ? "Trash is empty" : "No saved sessions yet";
  const copy = isSearchEmpty
    ? "Try a session name, tab title, or URL."
    : viewMode === "trash"
      ? "Deleted sessions will wait here for 30 days."
      : "Clear the tab strip without losing the trail.";

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="grid min-h-[358px] place-content-center rounded-[var(--radius-card)] border border-border bg-surface px-7 py-8 text-center shadow-[0_1px_0_rgba(31,27,22,0.04),0_10px_22px_rgba(31,27,22,0.035)]"
    >
      <StashMascot state={mascotState} reduceMotion={reduceMotion} className="mx-auto mb-5" />
      <p className="mb-2 font-display text-[17px] font-semibold tracking-normal text-ink">{title}</p>
      <p className="mx-auto mb-4 max-w-[260px] text-sm leading-relaxed text-muted">{copy}</p>
      {viewMode === "library" && !isSearchEmpty ? (
        <motion.div
          className="mx-auto"
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
        >
          <Button variant="primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <PanelTopClose size={16} />}
            {isSaving ? "Saving" : "Save tabs"}
          </Button>
        </motion.div>
      ) : null}
    </motion.section>
  );
}

function SaveChoreography({ burst, reduceMotion }: { burst: SaveBurst; reduceMotion: boolean }) {
  if (reduceMotion) {
    return null;
  }

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[78px] z-20 flex -translate-x-1/2 items-center"
      initial={{ opacity: 0, y: -8, scale: 1.04 }}
      animate={{ opacity: [0, 1, 1, 0], y: [-8, 8, 68, 86], scale: [1.04, 1, 0.86, 0.7] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      {burst.tabs.map((tab, index) => (
        <motion.span
          key={`${burst.id}-${tab.id}`}
          className="-ml-1 first:ml-0"
          initial={{ x: (index - 1.5) * 14, rotate: (index - 1.5) * 5 }}
          animate={{ x: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34, delay: index * 0.025 }}
        >
          <Favicon tab={tab} large />
        </motion.span>
      ))}
    </motion.div>
  );
}

function FreshDot({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0 rounded-full bg-accent">
      {!reduceMotion ? (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent"
          initial={{ opacity: 0.55, scale: 1 }}
          animate={{ opacity: 0, scale: 1.65 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
    </span>
  );
}

function FaviconSpine({
  tabs,
  isRestoring,
  reduceMotion
}: {
  tabs: StashTab[];
  isRestoring: boolean;
  reduceMotion: boolean;
}) {
  const visibleTabs = tabs.slice(0, 4);
  const overflow = tabs.length - visibleTabs.length;

  return (
    <div className="flex min-w-[58px] justify-end">
      {visibleTabs.map((tab, index) => (
        <motion.span
          key={tab.id}
          className="-ml-1 first:ml-0"
          animate={
            isRestoring && !reduceMotion
              ? { x: (index - 1.5) * 5, y: index % 2 === 0 ? -2 : 2, rotate: (index - 1.5) * 4 }
              : { x: 0, y: 0, rotate: 0 }
          }
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ zIndex: visibleTabs.length - index }}
        >
          <Favicon tab={tab} />
        </motion.span>
      ))}
      {overflow > 0 ? (
        <span className="-ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-btn)] border border-border bg-chip px-1 font-mono text-[10px] font-semibold text-muted">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function Favicon({ tab, large = false }: { tab: StashTab; large?: boolean }) {
  const className = cn(
    "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-btn)] border border-border bg-chip object-cover text-[10px] font-bold text-muted shadow-[0_1px_0_rgba(31,27,22,0.05)]",
    large ? "h-7 w-7" : "h-5 w-5"
  );

  if (!tab.favicon) {
    return <span className={className}>{getFallbackLetter(tab.title)}</span>;
  }

  return <img className={className} src={tab.favicon} alt="" />;
}

function IconButton({
  label,
  danger = false,
  children,
  onClick
}: {
  label: string;
  danger?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.span
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
          className="inline-flex"
        >
          <Button
            type="button"
            variant={danger ? "danger" : "secondary"}
            size="icon"
            aria-label={label}
            onClick={onClick}
            className="h-8 w-8 text-muted"
          >
            {children}
          </Button>
        </motion.span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function createTab(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: true }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function createWindow(urls: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.windows.create({ url: urls, focused: true }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getFallbackLetter(title: string) {
  return title.trim().charAt(0).toUpperCase() || "S";
}
