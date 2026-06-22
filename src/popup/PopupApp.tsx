import NumberFlow from "@number-flow/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Loader2,
  PanelTopClose,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { getSessions, getSessionOrder, getSettings } from "../shared/storage";
import { applySessionOrder, matchesSession, autoNameSession } from "../shared/session-utils";
import type { SaveTarget, StashSession, StashTab } from "../shared/types";

type ViewMode = "library" | "trash";
type SaveBurst = { id: string; tabs: StashTab[] };

function isSavableChromeTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");
}

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
  const [activeTab, setActiveTab] = useState<StashTab | null>(null);
  const [activeSession, setActiveSession] = useState<StashSession | null>(null);
  const [openTabs, setOpenTabs] = useState<chrome.tabs.Tab[]>([]);
  const [openTabsExpanded, setOpenTabsExpanded] = useState(false);
  const [isSessionTabDragging, setIsSessionTabDragging] = useState(false);
  const [newGroupProgress, setNewGroupProgress] = useState(0);
  const newGroupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newGroupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newGroupDoneRef = useRef(false);
  const newGroupDragDataRef = useRef<{ fromSessionId: string; tab: StashTab; tabId: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pointerYRef = useRef(0);
  const initialPointerYRef = useRef(0);

  // A small activation distance lets a plain click still restore a tab — only a
  // deliberate drag (>6px) starts moving it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // A single save fires several storage writes + an explicit refresh in quick
  // succession. Coalesce them into one trailing reload so the heavy
  // re-normalize + list re-render happens once, not on top of the animations.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(async () => {
      reloadTimer.current = null;
      const [nextSessions, nextSettings, nextOrder] = await Promise.all([getSessions(), getSettings(), getSessionOrder()]);
      setSessions(applySessionOrder(nextSessions, nextOrder));
      setSaveTarget(nextSettings.saveTarget);
      setCompactMode(nextSettings.compactMode);
    }, 50);
  }, []);

  useEffect(() => {
    reload();
    chrome.storage.onChanged.addListener(reload);
    return () => {
      chrome.storage.onChanged.removeListener(reload);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [reload]);

  const loadOpenTabs = useCallback(async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    setOpenTabs(tabs.filter((t) => isSavableChromeTabUrl(t.url)));
  }, []);

  useEffect(() => {
    void loadOpenTabs();
    const onTabUpdate = () => void loadOpenTabs();
    chrome.tabs.onUpdated.addListener(onTabUpdate);
    chrome.tabs.onRemoved.addListener(onTabUpdate);
    chrome.tabs.onCreated.addListener(onTabUpdate);
    return () => {
      chrome.tabs.onUpdated.removeListener(onTabUpdate);
      chrome.tabs.onRemoved.removeListener(onTabUpdate);
      chrome.tabs.onCreated.removeListener(onTabUpdate);
    };
  }, [loadOpenTabs]);


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

  async function handleCreateEmptyGroup() {
    const response = await sendBackgroundRequest({ type: "CREATE_EMPTY_SESSION" });
    if (!response.ok || !response.session) {
      toast.error("Couldn't create group.");
      return;
    }
    await reload();
    const session = response.session;
    setEditingId(session.id);
    setDraftName(session.name);
    setOriginalName(session.name);
    setExpandedIds((cur) => new Set(cur).add(session.id));
  }

  // ── Drag tabs between groups / drag sessions to reorder ──────────────────────

  // For tab drags: prefer pointer-within so the new-group-zone only activates
  // when the cursor is physically over it — prevents closestCenter from stealing
  // the event when the tab is near (but not on) the zone strip.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (args.active.data.current?.type === "session") return closestCenter(args);
    const within = pointerWithin(args);
    return within.length > 0 ? within : closestCenter(args);
  }, []);

  function onDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type as string | undefined;
    if (type === "session") {
      setActiveSession((event.active.data.current?.session as StashSession | undefined) ?? null);
      setIsSessionTabDragging(false);
    } else {
      setActiveTab((event.active.data.current?.tab as StashTab | undefined) ?? null);
      setIsSessionTabDragging(type === "tab");
      const native = event.activatorEvent as PointerEvent | MouseEvent;
      initialPointerYRef.current = native.clientY;
      pointerYRef.current = native.clientY;
    }
  }

  function onDragMove(event: DragMoveEvent) {
    if (event.active.data.current?.type !== "tab") return;
    const y = initialPointerYRef.current + event.delta.y;
    pointerYRef.current = y;
    const el = scrollContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const zone = 80;
    if (y > rect.bottom - zone) {
      el.scrollTop += Math.min((y - (rect.bottom - zone)) / zone, 1) * 16;
    } else if (y < rect.top + zone) {
      el.scrollTop -= Math.min(((rect.top + zone) - y) / zone, 1) * 16;
    }
  }

  function clearNewGroupDrag() {
    if (newGroupTimerRef.current) { clearTimeout(newGroupTimerRef.current); newGroupTimerRef.current = null; }
    if (newGroupIntervalRef.current) { clearInterval(newGroupIntervalRef.current); newGroupIntervalRef.current = null; }
    setNewGroupProgress(0);
    setIsSessionTabDragging(false);
    newGroupDoneRef.current = false;
    newGroupDragDataRef.current = null;
  }

  function onDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type !== "tab") return;

    if (event.over?.id === "new-group-zone") {
      if (newGroupTimerRef.current !== null || newGroupDoneRef.current) return;

      const fromSessionId = event.active.data.current?.fromSessionId as string | undefined;
      const tab = event.active.data.current?.tab as StashTab | undefined;
      const tabId = String(event.active.id);
      if (!fromSessionId || !tab) return;
      newGroupDragDataRef.current = { fromSessionId, tab, tabId };

      setNewGroupProgress(0);
      const startTime = Date.now();
      const duration = 1500;

      newGroupIntervalRef.current = setInterval(() => {
        setNewGroupProgress(Math.min(((Date.now() - startTime) / duration) * 100, 100));
      }, 30);

      newGroupTimerRef.current = setTimeout(() => {
        clearInterval(newGroupIntervalRef.current!);
        newGroupIntervalRef.current = null;
        newGroupTimerRef.current = null;

        const data = newGroupDragDataRef.current;
        if (!data) return;

        // Mark done BEFORE dispatching pointerup so onDragEnd bails correctly
        newGroupDoneRef.current = true;

        // End the drag — DnD Kit's PointerSensor listens for pointerup on document
        document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1 }));

        const now = Date.now();
        const newSession: StashSession = {
          id: crypto.randomUUID(),
          name: autoNameSession([data.tab], now),
          createdAt: now,
          tabs: [data.tab],
          manuallyCreated: true,
        };

        // Build the next list + explicit display order SYNCHRONOUSLY from current
        // state. The order must be computed here (not inside the setSessions
        // updater, which React runs asynchronously) — otherwise the request fires
        // with an empty order, applySessionOrder falls back to newest-first, and
        // the brand-new group shoots to the top. New group sits right after source.
        const updated = sessions.map(s => s.id === data.fromSessionId
          ? { ...s, tabs: s.tabs.filter(t => t.id !== data.tabId) }
          : s
        );
        const idx = updated.findIndex(s => s.id === data.fromSessionId);
        const result = idx === -1
          ? [...updated, newSession]
          : [...updated.slice(0, idx + 1), newSession, ...updated.slice(idx + 1)];
        const newOrder = result.filter(s => !s.deletedAt).map(s => s.id);

        // Optimistic: new session with tab appears right after source; source loses the tab.
        setSessions(result);

        // If the source group just lost its last tab, collapse it — otherwise it
        // sits open showing the empty "Drop tabs here" placeholder. Groups should
        // only expand when the user clicks them.
        const sourceAfter = updated.find(s => s.id === data.fromSessionId);
        if (sourceAfter && sourceAfter.tabs.length === 0) {
          setExpandedIds(cur => { const n = new Set(cur); n.delete(data.fromSessionId); return n; });
        }

        // One atomic write: pull the tab into a new group placed right after the
        // source, and lock in the display order — all in a single storage set.
        // Splitting this across REORDER + ADD + MOVE let an intermediate reload
        // render the tab snapped back to the source group (jarring) before the
        // move landed. The new group carries the real tab, so nothing is lost.
        void sendBackgroundRequest({
          type: "CREATE_GROUP_FROM_TAB",
          fromSessionId: data.fromSessionId,
          tabId: data.tabId,
          newSession: { ...newSession, tabs: [] },
          order: newOrder,
        });
      }, duration);
    } else {
      if (newGroupTimerRef.current) { clearTimeout(newGroupTimerRef.current); newGroupTimerRef.current = null; }
      if (newGroupIntervalRef.current) { clearInterval(newGroupIntervalRef.current); newGroupIntervalRef.current = null; }
      setNewGroupProgress(0);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const type = active.data.current?.type as string | undefined;

    if (newGroupDoneRef.current) {
      clearNewGroupDrag();
      setActiveTab(null);
      setActiveSession(null);
      return;
    }
    clearNewGroupDrag();

    if (type === "session") {
      setActiveSession(null);
      if (!over || active.id === over.id) return;

      setSessions((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        void sendBackgroundRequest({ type: "REORDER_SESSIONS", order: next.map((s) => s.id) });
        return next;
      });
    } else if (type === "open-tab") {
      setActiveTab(null);
      if (!over) return;
      const toSessionId = String(over.id);
      const chromeTabId = active.data.current?.chromeTabId as number | undefined;
      const tab = active.data.current?.tab as StashTab | undefined;
      if (!chromeTabId || !tab) return;

      // Remove from open tabs panel immediately.
      setOpenTabs((prev) => prev.filter((t) => t.id !== chromeTabId));

      const response = await sendBackgroundRequest({
        type: "ADD_OPEN_TAB_TO_SESSION",
        sessionId: toSessionId,
        tabId: chromeTabId,
      });
      if (!response.ok) {
        toast.error(response.error);
        void loadOpenTabs();
      } else {
        const target = sessions.find((s) => s.id === toSessionId);
        toast.success(`Tab stashed in "${target?.name ?? "group"}".`, {
          action: { label: "Undo", onClick: () => void reload() },
        });
      }
    } else {
      setActiveTab(null);
      if (!over) return;
      const fromSessionId = active.data.current?.fromSessionId as string | undefined;
      const tab = active.data.current?.tab as StashTab | undefined;
      const toSessionId = String(over.id);
      const tabId = String(active.id);
      // "new-group-zone" is not a real session — drop without 1.5s hold is a no-op.
      if (!fromSessionId || !tab || fromSessionId === toSessionId || toSessionId === "new-group-zone") return;

      // Optimistic: move locally now; the debounced reload reconciles with storage.
      setSessions((prev) => applyTabMove(prev, fromSessionId, toSessionId, tabId));
      // Collapse the source if this was its last tab — keeps the "drop here" placeholder hidden.
      const srcAfter = sessions.find(s => s.id === fromSessionId);
      if (srcAfter && srcAfter.tabs.filter(t => t.id !== tabId).length === 0) {
        setExpandedIds(cur => { const n = new Set(cur); n.delete(fromSessionId); return n; });
      }

      const response = await sendBackgroundRequest({ type: "MOVE_TAB", fromSessionId, toSessionId, tabId });
      if (!response.ok) {
        toast.error(response.error);
        void reload();
      }
    }
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
    const src = sessions.find(s => s.id === sessionId);
    const willBeEmpty = src ? src.tabs.filter(t => t.id !== tabId).length === 0 : false;
    await sendBackgroundRequest({ type: "REMOVE_TAB", sessionId, tabId });
    await reload();
    if (willBeEmpty) {
      setExpandedIds(cur => { const n = new Set(cur); n.delete(sessionId); return n; });
    }
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
          <div ref={scrollContainerRef} className={cn("stash-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1", isSessionTabDragging ? "pb-24" : "pb-5")}>
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

                  <DndContext
                    sensors={sensors}
                    collisionDetection={collisionDetection}
                    autoScroll={false}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                    onDragOver={onDragOver}
                    onDragCancel={() => { clearNewGroupDrag(); setActiveTab(null); setActiveSession(null); }}
                  >
                    {viewMode === "library" && (
                      <div className="mb-2 flex items-center justify-between">
                        {openTabs.length > 0 ? (
                          <motion.button
                            type="button"
                            onClick={() => setOpenTabsExpanded((v) => !v)}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.95, y: 0 }}
                            transition={{ type: "spring", stiffness: 480, damping: 26 }}
                            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 font-body text-[12px] font-medium text-muted shadow-[var(--shadow-sm)] transition-[box-shadow,color] duration-[var(--dur-fast)] hover:text-ink hover:shadow-[var(--shadow-md)]"
                          >
                            <motion.span
                              animate={{ rotate: openTabsExpanded ? 90 : 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 24 }}
                              className="inline-flex"
                            >
                              <ChevronRight size={12} />
                            </motion.span>
                            Open tabs
                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent/15 px-1 font-mono text-[10px] font-semibold text-accent-text">
                              {openTabs.length}
                            </span>
                          </motion.button>
                        ) : <div />}
                        <motion.button
                          type="button"
                          onClick={() => void handleCreateEmptyGroup()}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.95, y: 0 }}
                          transition={{ type: "spring", stiffness: 480, damping: 26 }}
                          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 font-body text-[12px] font-medium text-muted shadow-[var(--shadow-sm)] transition-[box-shadow,color] duration-[var(--dur-fast)] hover:text-ink hover:shadow-[var(--shadow-md)]"
                        >
                          <Plus size={12} />
                          New group
                        </motion.button>
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {viewMode === "library" && openTabsExpanded && openTabs.length > 0 && (
                        <motion.div
                          key="open-tabs-panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                          className="mb-3 overflow-hidden"
                        >
                          <OpenTabsPanel tabs={openTabs} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {visibleSessions.length > 0 ? (
                      <SortableContext
                        items={visibleSessions.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
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
                      </SortableContext>
                    ) : (
                      <EmptyState
                        viewMode={viewMode}
                        query={query}
                        reduceMotion={Boolean(reduceMotion)}
                      />
                    )}

                    {isSessionTabDragging && viewMode === "library" && (
                      <NewGroupDropZone progress={newGroupProgress} />
                    )}

                    <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
                      {activeTab
                        ? <TabDragPreview tab={activeTab} />
                        : activeSession
                        ? <SessionCardGhost session={activeSession} />
                        : null}
                    </DragOverlay>
                  </DndContext>
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
          {sessions.map((session, i) => (
            <SessionCard
              key={session.id}
              session={session}
              index={i}
              isExpanded={expandedIds.has(session.id)}
              isEditing={editingId === session.id}
              isFresh={freshlySavedId === session.id}
              isRestoring={restoreBurstId === session.id}
              viewMode={viewMode}
              draftName={draftName}
              compactMode={compactMode}
              reduceMotion={reduceMotion}
              onDraftNameChange={onDraftNameChange}
              onToggleExpanded={onToggleExpanded}
              onRenameStart={onRenameStart}
              onRenameSubmit={onRenameSubmit}
              onRenameKeyDown={onRenameKeyDown}
              onRestoreAll={onRestoreAll}
              onRestoreTab={onRestoreTab}
              onDeleteSession={onDeleteSession}
              onDeleteForever={onDeleteForever}
              onRestoreDeleted={onRestoreDeleted}
              onRemoveTab={onRemoveTab}
            />
          ))}
        </AnimatePresence>
      </motion.section>
    </LayoutGroup>
  );
}

/* ── One session card (drop target for tabs, draggable for reorder) ─ */
function SessionCard({
  session, index: i, isExpanded, isEditing, isFresh, isRestoring, viewMode,
  draftName, compactMode, reduceMotion,
  onDraftNameChange, onToggleExpanded, onRenameStart, onRenameSubmit,
  onRenameKeyDown, onRestoreAll, onRestoreTab, onDeleteSession,
  onDeleteForever, onRestoreDeleted, onRemoveTab,
}: {
  session: StashSession;
  index: number;
  isExpanded: boolean;
  isEditing: boolean;
  isFresh: boolean;
  isRestoring: boolean;
  viewMode: ViewMode;
  draftName: string;
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
  const {
    active: dndActive,
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: session.id,
    data: { type: "session", session },
    disabled: viewMode !== "library",
  });

  const isSessionDrag = dndActive?.data.current?.type === "session";
  // Any drag in progress (tab or session). Hover/tap micro-animations are
  // suppressed while dragging — otherwise the pointer passing over a card
  // triggers its lift/scale spring mid-drag, which reads as jank on the
  // neighbouring groups.
  const isAnyDragging = dndActive != null;

  // Only apply positional transform during session-level reorder drags;
  // ignore it when a tab is being dragged so sessions don't shift around.
  const sortStyle: React.CSSProperties = isSessionDrag
    ? { transform: CSS.Transform.toString(transform), transition }
    : {};

  // Tab-drop highlight: a tab from a different group is hovering over this card.
  const isTabDropTarget =
    isOver &&
    !isSessionDrag &&
    (dndActive?.data.current?.fromSessionId as string | undefined) !== session.id;

  // Reorder highlight: a different session card is being dragged over this one.
  const isReorderTarget = isOver && isSessionDrag && dndActive?.id !== session.id;

  return (
    <motion.article
      ref={setNodeRef}
      style={sortStyle}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0 : 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82, x: 24, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      whileHover={reduceMotion || isDragging || isAnyDragging ? undefined : { y: -3, transition: { type: "spring", stiffness: 420, damping: 26 } }}
      whileTap={reduceMotion || isAnyDragging ? undefined : { scale: 0.992 }}
      transition={{
        duration: 0.22,
        delay: reduceMotion ? 0 : Math.min(i * 0.04, 0.16),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        // Accent spine is an inset box-shadow so it follows the rounded edge the full height (no corner clipping)
        "group relative overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[inset_4px_0_0_0_var(--color-accent),var(--shadow-sm)] transition-[box-shadow,border-color,background-color] duration-[var(--dur-base)] hover:border-border-strong hover:shadow-[inset_4px_0_0_0_var(--color-accent),var(--shadow-md)]",
        isTabDropTarget ? "border-accent bg-accent/[0.05] ring-2 ring-accent/55" : "border-border",
        isReorderTarget && "ring-2 ring-border-strong border-border-strong",
        isFresh && "ring-2 ring-accent/30",
      )}
    >
      {/* Card header */}
      <div className={cn(
        "flex items-start gap-3 pl-4 pr-3",
        compactMode ? "py-3" : "py-5",
      )}>
        {/* Expand button — also the drag handle in library view */}
        <motion.button
          {...(viewMode === "library" ? { ...attributes, ...listeners } : {})}
          type="button"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          onClick={() => onToggleExpanded(session.id)}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-surface-subtle text-muted shadow-[var(--shadow-xs)] transition-all duration-[var(--dur-fast)] hover:border-border-strong hover:bg-control-hover hover:text-ink hover:shadow-[var(--shadow-sm)]",
            viewMode === "library" && "touch-none cursor-grab active:cursor-grabbing",
          )}
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
          <div className="flex items-start gap-2">
            {isFresh && <FreshDot reduceMotion={reduceMotion} />}
            <form
              className="flex-1 min-w-0"
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
            {/* Action buttons live in the title row so they never overlap the date pills */}
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
              ) : session.tabs.length > 0 ? (
                <RestoreButton
                  label="Restore tabs"
                  icon={<RotateCcw size={16} />}
                  onClick={() => void onRestoreAll(session)}
                />
              ) : (
                <div className="h-9 w-9" />
              )}
            </div>
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
            {session.tabs.length === 0 ? (
              <li className="flex items-center justify-center py-4 font-body text-[12px] text-muted-2">
                Drop tabs here to add them
              </li>
            ) : (
              session.tabs.map((tab) => (
                <TabRow
                  key={tab.id}
                  tab={tab}
                  sessionId={session.id}
                  viewMode={viewMode}
                  onRestoreTab={onRestoreTab}
                  onRemoveTab={onRemoveTab}
                />
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ── One tab row (draggable into another group) ────────────────── */
function TabRow({
  tab, sessionId, viewMode, onRestoreTab, onRemoveTab,
}: {
  tab: StashTab;
  sessionId: string;
  viewMode: ViewMode;
  onRestoreTab: (t: StashTab) => void | Promise<void>;
  onRemoveTab: (sid: string, tid: string) => void | Promise<void>;
}) {
  const draggable = viewMode === "library";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tab.id,
    data: { type: "tab", fromSessionId: sessionId, tab },
    disabled: !draggable,
  });

  return (
    <li
      ref={setNodeRef}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      className={cn(
        "group/row flex min-h-[38px] items-center gap-1 rounded-[10px] transition-colors hover:bg-surface-subtle",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
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
        <ActionBtn label="Remove tab" danger onClick={() => void onRemoveTab(sessionId, tab.id)} className="mr-1">
          <Trash2 size={13} />
        </ActionBtn>
      )}
    </li>
  );
}

/* ── Open tabs panel — drag source for stashing into groups ────── */
function OpenTabsPanel({ tabs }: { tabs: chrome.tabs.Tab[] }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-sm)]">
      <ul className="stash-scroll m-0 max-h-[176px] list-none overflow-y-auto p-1.5">
        {tabs.map((tab) => (
          <OpenTabRow key={tab.id} chromeTab={tab} />
        ))}
      </ul>
      <div className="border-t border-border/60 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">
          Drag a tab onto a group to stash it there
        </p>
      </div>
    </div>
  );
}

function OpenTabRow({ chromeTab }: { chromeTab: chrome.tabs.Tab }) {
  const stashTab = useMemo<StashTab>(
    () => ({
      id: `client-${chromeTab.id}`,
      url: chromeTab.url ?? "",
      title: chromeTab.title?.trim() || chromeTab.url || "Untitled",
      favicon: chromeTab.favIconUrl ?? "",
      capturedAt: Date.now(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chromeTab.id, chromeTab.url, chromeTab.title, chromeTab.favIconUrl],
  );

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `open-tab-${chromeTab.id}`,
    data: { type: "open-tab", chromeTabId: chromeTab.id, tab: stashTab },
  });

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group/ot flex min-h-[36px] touch-none cursor-grab items-center gap-2 rounded-[8px] px-2.5 py-1 transition-colors hover:bg-surface-subtle active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <Favicon tab={stashTab} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{stashTab.title}</span>
        <span className="block truncate font-mono text-[11px] text-muted-2">{formatUrl(stashTab.url)}</span>
      </span>
      <GripVertical size={12} className="shrink-0 text-muted-2/40 transition-opacity group-hover/ot:text-muted-2" />
    </li>
  );
}

/* ── Floating preview shown under the cursor while dragging ─────── */
function TabDragPreview({ tab }: { tab: StashTab }) {
  return (
    <div
      className="flex max-w-[260px] items-center gap-2 rounded-[10px] border border-accent/40 bg-surface px-2.5 py-1.5 shadow-[var(--shadow-lg,0_12px_28px_-8px_rgba(0,0,0,0.35))]"
      style={{ transform: "rotate(-2deg) scale(1.04)" }}
    >
      <Favicon tab={tab} />
      <span className="truncate text-[14px] font-medium text-ink">{tab.title}</span>
    </div>
  );
}

/** Pure, optimistic mirror of storage.moveTab for instant UI feedback. */
function applyTabMove(
  sessions: StashSession[],
  fromSessionId: string,
  toSessionId: string,
  tabId: string,
): StashSession[] {
  const source = sessions.find((s) => s.id === fromSessionId);
  const tab = source?.tabs.find((t) => t.id === tabId);
  if (!source || !tab || fromSessionId === toSessionId) return sessions;

  return sessions.map((session) => {
    if (session.id === fromSessionId) {
      const tabs = session.tabs.filter((t) => t.id !== tabId);
      return { ...session, tabs };
    }
    if (session.id === toSessionId) {
      if (session.tabs.some((t) => t.id === tabId)) return session;
      return { ...session, tabs: [...session.tabs, tab] };
    }
    return session;
  });
}

/* ── New-group drop zone (shown while dragging a session tab) ───── */
function NewGroupDropZone({ progress }: { progress: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: "new-group-zone" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative mt-3 flex h-12 items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed transition-colors duration-150",
        isOver
          ? "border-accent/50 bg-accent/[0.06] text-accent-text"
          : "border-border/60 text-muted-2",
      )}
    >
      <Plus size={13} className="shrink-0" />
      <span className="font-body text-[12px] font-medium select-none">
        {isOver ? "Hold to create new group…" : "Drop here to create new group"}
      </span>
      {isOver && (
        <div
          className="absolute bottom-0 left-0 h-[3px] bg-accent"
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
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

/* ── Full-card ghost shown in DragOverlay while dragging a session ─ */
function SessionCardGhost({ session }: { session: StashSession }) {
  return (
    <div
      className="w-[368px] overflow-hidden rounded-[var(--radius-card)] border border-accent/25 bg-surface shadow-[inset_4px_0_0_0_var(--color-accent),0_24px_48px_-8px_rgba(0,0,0,0.28),0_8px_16px_-4px_rgba(0,0,0,0.12)]"
      style={{ transform: "rotate(-0.8deg) scale(1.025)" }}
    >
      <div className="flex items-start gap-3 px-4 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-surface-subtle text-muted shadow-[var(--shadow-xs)]">
          <ChevronRight size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-display display-title block pl-2 text-[17px] font-semibold leading-snug text-ink line-clamp-1">
            {session.name}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <FaviconSpine tabs={session.tabs} isRestoring={false} reduceMotion={true} />
            <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-muted-2">
              {session.tabs.length}&nbsp;{session.tabs.length === 1 ? "tab" : "tabs"}
            </span>
            <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-mono text-[11px] text-muted-2 whitespace-nowrap">
              {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(session.createdAt))}
            </span>
          </div>
        </div>
      </div>
    </div>
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
