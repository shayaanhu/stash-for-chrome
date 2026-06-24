import NumberFlow from "@number-flow/react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  LayoutGrid,
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
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { FormEvent, KeyboardEvent } from "react";
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PopupSettings } from "./PopupSettings";
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

// The Stash list still reasons in terms of "library" vs "trash"; the top-level
// nav is "open" (live tabs) vs "stash" (saved collection), with trash a sub-view.
type ViewMode = "library" | "trash";
type TopView = "open" | "stash";
type SaveBurst = { id: string; tabs: StashTab[] };

function isSavableChromeTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");
}

/**
 * One pointer sensor, two activation styles. dnd-kit allows a single activation
 * constraint per sensor, but the active node's data tells us what's being
 * dragged — so we pick the rule per draggable:
 *  • group cards (type "session") → press-and-hold 0.5s, so a tap only expands;
 *  • tab rows / everything else   → a small drag picks up instantly, so moving a
 *    tab between groups feels immediate while a tap still restores it.
 */
class MixedActivationPointerSensor extends PointerSensor {
  constructor(props: ConstructorParameters<typeof PointerSensor>[0]) {
    const type = props.activeNode?.data?.current?.type as string | undefined;
    const activationConstraint =
      type === "session"
        ? { delay: 500, tolerance: 8 }
        : { distance: 6 };
    super({ ...props, options: { ...props.options, activationConstraint } });
  }
}

export function PopupApp() {
  const reduceMotion = useReducedMotion();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [sessions, setSessions] = useState<StashSession[]>([]);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>("current-window");
  const [query, setQuery] = useState("");
  const [openFilter, setOpenFilter] = useState("");
  const [topView, setTopView] = useState<TopView>("open");
  const [showTrash, setShowTrash] = useState(false);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const listMode: ViewMode = showTrash ? "trash" : "library";
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [freshlySavedId, setFreshlySavedId] = useState<string | null>(null);
  const [saveBurst, setSaveBurst] = useState<SaveBurst | null>(null);
  const [restoreBurstId, setRestoreBurstId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StashTab | null>(null);
  const [activeSession, setActiveSession] = useState<StashSession | null>(null);
  const [openTabs, setOpenTabs] = useState<chrome.tabs.Tab[]>([]);
  const [isSessionTabDragging, setIsSessionTabDragging] = useState(false);
  const [isOpenTabDragging, setIsOpenTabDragging] = useState(false);
  const [newGroupProgress, setNewGroupProgress] = useState(0);
  const newGroupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newGroupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newGroupDoneRef = useRef(false);
  const newGroupDragDataRef = useRef<{ fromSessionId: string; tab: StashTab; tabId: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pointerYRef = useRef(0);
  const initialPointerYRef = useRef(0);

  // Group cards hold-to-drag (0.5s) so a tap just expands; tab rows drag on a
  // small movement so moving a tab between groups stays instant. See the sensor.
  const sensors = useSensors(
    useSensor(MixedActivationPointerSensor),
    useSensor(KeyboardSensor),
  );

  // True while a real dnd drag (group reorder / tab move) is underway, so the
  // marquee selection stands down — the two pointer gestures never run at once.
  const dragActiveRef = useRef(false);

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
    // tabs.onUpdated is extremely chatty (every favicon/title/loading tick). Only
    // react to changes that affect what we render, and coalesce bursts into one
    // query so a page loading in the background can't stutter the popup.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void loadOpenTabs(); }, 150);
    };
    const onUpdated = (
      _id: number,
      info: { url?: string; title?: string; favIconUrl?: string; status?: string; pinned?: boolean },
    ) => {
      if (
        info.url !== undefined ||
        info.title !== undefined ||
        info.favIconUrl !== undefined ||
        info.status === "complete" ||
        info.pinned !== undefined
      ) {
        schedule();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(schedule);
    chrome.tabs.onCreated.addListener(schedule);
    return () => {
      if (timer) clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(schedule);
      chrome.tabs.onCreated.removeListener(schedule);
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

  const { activeCount, trashCount } = useMemo(() => {
    let active = 0, trashed = 0;
    for (const s of sessions) s.deletedAt ? trashed++ : active++;
    return { activeCount: active, trashCount: trashed };
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    return sessions
      .filter((s) => (showTrash ? Boolean(s.deletedAt) : !s.deletedAt))
      .filter((s) => matchesSession(s, query));
  }, [sessions, query, showTrash]);

  const filteredOpenTabs = useMemo(() => {
    const q = openFilter.trim().toLowerCase();
    if (!q) return openTabs;
    return openTabs.filter(
      (t) =>
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.url ?? "").toLowerCase().includes(q),
    );
  }, [openTabs, openFilter]);

  // Drop selections that point at tabs which have since closed.
  useEffect(() => {
    setSelectedTabIds((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(openTabs.map((t) => t.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [openTabs]);

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
    setExpandedIds((cur) => new Set(cur).add(saved.id));
    setTopView("stash");
    setShowTrash(false);
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
  }

  // ── Open Tabs selection ──────────────────────────────────────────────────────
  // Stable so the memoized open-tab rows don't re-render on unrelated updates.
  const toggleTabSelected = useCallback((tabId: number) => {
    setSelectedTabIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  }, []);

  const filteredIds = useMemo(
    () => filteredOpenTabs.map((t) => t.id).filter((id): id is number => id != null),
    [filteredOpenTabs],
  );
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedTabIds.has(id));

  function toggleSelectAll() {
    setSelectedTabIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...filteredIds]);
    });
  }

  async function handleStashSelected() {
    const ids = [...selectedTabIds];
    if (ids.length === 0) return;
    setIsSaving(true);
    const response = await sendBackgroundRequest({
      type: "STASH_SELECTED_TABS",
      tabIds: ids,
      closeAfter: true,
    });
    setIsSaving(false);

    if (!response.ok || !response.session) {
      toast.error(response.ok ? "Nothing was stashed." : response.error);
      return;
    }

    const saved = response.session;
    setSelectedTabIds(new Set());
    setSaveBurst({ id: saved.id, tabs: saved.tabs.slice(0, 4) });
    setFreshlySavedId(saved.id);
    setTopView("stash");
    setShowTrash(false);
    setExpandedIds((cur) => new Set(cur).add(saved.id));
    await reload();
    void loadOpenTabs();

    setTimeout(() => setSaveBurst(null), reduceMotion ? 0 : 650);
    setTimeout(() => setFreshlySavedId(null), reduceMotion ? 0 : 1800);
    setTimeout(
      () =>
        toast.success(
          `Stashed ${saved.tabs.length} ${saved.tabs.length === 1 ? "tab" : "tabs"}.`,
          { action: { label: "Undo", onClick: () => void undoSave(saved) } },
        ),
      reduceMotion ? 0 : 520,
    );
  }

  // ── Group (session) multi-select ─────────────────────────────────────────────
  function toggleSessionSelected(id: string) {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Clear group selection when switching views so it never carries across modes.
  useEffect(() => { setSelectedSessionIds(new Set()); }, [topView, showTrash]);

  // Drop selections that point at sessions which no longer exist in this view.
  useEffect(() => {
    setSelectedSessionIds((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(visibleSessions.map((s) => s.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleSessions]);

  async function handleBulkRestore() {
    const ids = [...selectedSessionIds];
    if (ids.length === 0) return;
    for (const id of ids) {
      await sendBackgroundRequest(
        showTrash
          ? { type: "RESTORE_DELETED_SESSION", sessionId: id }
          : { type: "RESTORE_SESSION", sessionId: id },
      );
    }
    setSelectedSessionIds(new Set());
    await reload();
    toast.success(`Restored ${ids.length} ${ids.length === 1 ? "group" : "groups"}.`);
  }

  async function handleBulkRemove() {
    const ids = [...selectedSessionIds];
    if (ids.length === 0) return;
    const removed = sessions.filter((s) => ids.includes(s.id));
    // Optimistic: in trash, drop them; in the library, send them to trash.
    const idSet = new Set(ids);
    setSessions(prev => showTrash
      ? prev.filter(s => !idSet.has(s.id))
      : prev.map(s => idSet.has(s.id) ? { ...s, deletedAt: Date.now() } : s));
    setSelectedSessionIds(new Set());
    for (const id of ids) {
      await sendBackgroundRequest(
        showTrash
          ? { type: "DELETE_FOREVER", sessionId: id }
          : { type: "SOFT_DELETE_SESSION", sessionId: id },
      );
    }
    await reload();
    if (showTrash) {
      toast.success(`Deleted ${ids.length} ${ids.length === 1 ? "group" : "groups"}.`);
    } else {
      toast.success(`Moved ${ids.length} ${ids.length === 1 ? "group" : "groups"} to trash.`, {
        action: { label: "Undo", onClick: () => void reAddSessions(removed) },
      });
    }
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
    dragActiveRef.current = true;
    const type = event.active.data.current?.type as string | undefined;
    if (type === "session") {
      setActiveSession((event.active.data.current?.session as StashSession | undefined) ?? null);
      setIsSessionTabDragging(false);
      setIsOpenTabDragging(false);
    } else {
      setActiveTab((event.active.data.current?.tab as StashTab | undefined) ?? null);
      setIsSessionTabDragging(type === "tab");
      setIsOpenTabDragging(type === "open-tab");
      const native = event.activatorEvent as PointerEvent | MouseEvent;
      initialPointerYRef.current = native.clientY;
      pointerYRef.current = native.clientY;
    }
  }

  function onDragMove(event: DragMoveEvent) {
    const moveType = event.active.data.current?.type;
    if (moveType !== "tab" && moveType !== "open-tab") return;
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
    setIsOpenTabDragging(false);
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
        const updated = sessions.map(s => {
          if (s.id !== data.fromSessionId) return s;
          const tabs = s.tabs.filter(t => t.id !== data.tabId);
          // Mirror storage: emptying the source sends it to trash, not a ·0 shell.
          return tabs.length === 0 && !s.deletedAt ? { ...s, tabs, deletedAt: Date.now() } : { ...s, tabs };
        });
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
    dragActiveRef.current = false;
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

      if (toSessionId === "new-group-zone") {
        const now = Date.now();
        const sessionId = crypto.randomUUID();
        const sessionName = autoNameSession([tab], now);
        const newSession: StashSession = {
          id: sessionId,
          name: sessionName,
          createdAt: now,
          tabs: [tab],
          manuallyCreated: true,
        };
        const newOrder = [sessionId, ...sessions.filter(s => !s.deletedAt).map(s => s.id)];
        setSessions(prev => [newSession, ...prev]);

        const response = await sendBackgroundRequest({
          type: "CREATE_GROUP_FROM_OPEN_TAB",
          tabId: chromeTabId,
          sessionId,
          sessionName,
          order: newOrder,
        });
        if (!response.ok) {
          toast.error(response.error);
          void reload();
        } else {
          toast.success(`"${sessionName}" created.`, {
            action: { label: "Undo", onClick: () => void reload() },
          });
        }
        return;
      }

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
    // Optimistic: send it to trash locally so the card animates out immediately,
    // independent of how quickly the background write + reload land.
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, deletedAt: Date.now() } : s));
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
    setSessions(prev => prev.filter(s => s.id !== session.id)); // optimistic
    await sendBackgroundRequest({ type: "DELETE_FOREVER", sessionId: session.id });
    await reload();
    toast.success("Deleted forever.", {
      action: { label: "Undo", onClick: () => void reAddSessions([session]) },
    });
  }

  async function handleEmptyTrash() {
    const trashSessions = sessions.filter((s) => s.deletedAt);
    setSessions(prev => prev.filter(s => !s.deletedAt)); // optimistic
    setShowTrash(false); // never strand the user in an empty trash with no way back
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
    // Optimistic: drop the tab now, and trash the group if that was its last tab.
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const tabs = s.tabs.filter(t => t.id !== tabId);
      return tabs.length === 0 && !s.deletedAt ? { ...s, tabs, deletedAt: Date.now() } : { ...s, tabs };
    }));
    if (willBeEmpty) {
      setExpandedIds(cur => { const n = new Set(cur); n.delete(sessionId); return n; });
    }
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

  // The group list is memoized so unrelated state churn (open-tab polling, the
  // Open Tabs filter, selection in the other view) can't re-render it. For the
  // memo to hold, every callback it receives must keep a stable identity — so we
  // funnel them through a ref that always points at the latest closures.
  const liveHandlers = {
    onToggleSelected: toggleSessionSelected,
    onDraftNameChange: (name: string) => {
      setDraftName(name);
      setSessions((prev) => prev.map((s) => (s.id === editingId ? { ...s, name } : s)));
    },
    onToggleExpanded: toggleExpanded,
    onRenameStart: startRename,
    onRenameSubmit: submitRename,
    onRenameKeyDown: handleRenameKeyDown,
    onRestoreAll: handleRestoreAll,
    onRestoreTab: handleRestoreTab,
    onDeleteSession: handleDeleteSession,
    onDeleteForever: handleDeleteForever,
    onRestoreDeleted: handleRestoreDeleted,
    onRemoveTab: handleRemoveTab,
  };
  const liveHandlersRef = useRef(liveHandlers);
  liveHandlersRef.current = liveHandlers;
  const sessionActions = useMemo(() => ({
    onToggleSelected: (id: string) => liveHandlersRef.current.onToggleSelected(id),
    onDraftNameChange: (n: string) => liveHandlersRef.current.onDraftNameChange(n),
    onToggleExpanded: (id: string) => liveHandlersRef.current.onToggleExpanded(id),
    onRenameStart: (s: StashSession) => liveHandlersRef.current.onRenameStart(s),
    onRenameSubmit: (e?: FormEvent<HTMLFormElement>) => liveHandlersRef.current.onRenameSubmit(e),
    onRenameKeyDown: (e: KeyboardEvent<HTMLInputElement>) => liveHandlersRef.current.onRenameKeyDown(e),
    onRestoreAll: (s: StashSession) => liveHandlersRef.current.onRestoreAll(s),
    onRestoreTab: (t: StashTab) => liveHandlersRef.current.onRestoreTab(t),
    onDeleteSession: (s: StashSession) => liveHandlersRef.current.onDeleteSession(s),
    onDeleteForever: (s: StashSession) => liveHandlersRef.current.onDeleteForever(s),
    onRestoreDeleted: (id: string) => liveHandlersRef.current.onRestoreDeleted(id),
    onRemoveTab: (sid: string, tid: string) => liveHandlersRef.current.onRemoveTab(sid, tid),
  }), []);

  const visibleSessionIds = useMemo(() => visibleSessions.map((s) => s.id), [visibleSessions]);

  return (
    <TooltipProvider delayDuration={400}>
      <main className="paper-bg relative flex h-[580px] w-[400px] flex-col overflow-hidden text-ink">

        {/* ── Persistent top nav: stays put and clickable even while Settings is open ── */}
        <div className="px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <ViewSwitch
              value={topView}
              onChange={(v) => { setTopView(v); setShowSettings(false); }}
              openCount={openTabs.length}
              stashCount={activeCount}
            />
            <motion.button
              type="button"
              aria-label={showSettings ? "Close settings" : "Settings"}
              aria-pressed={showSettings}
              onClick={() => setShowSettings((v) => !v)}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-[image:linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-subtle)_100%)] shadow-[var(--shadow-raised)] transition-[box-shadow,color] duration-[var(--dur-fast)] hover:shadow-[var(--shadow-raised-hover)]",
                showSettings ? "border-accent/40 text-accent-text" : "border-border text-muted hover:text-ink",
              )}
              whileHover={{ y: -2, rotate: 35 }}
              whileTap={{ scale: 0.9, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            >
              <Settings size={16} />
            </motion.button>
          </div>
        </div>

        {/* ── Stage: search + content; Settings slides in over just this area ── */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="px-4 pb-2">
            <label className="flex h-9 items-center gap-2.5 rounded-full border border-border bg-surface px-4 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus-within:border-accent/40 focus-within:shadow-[var(--shadow-md)]">
              <Search size={15} className="shrink-0 text-muted-2" />
              <input
                ref={searchRef}
                type="text"
                placeholder={topView === "open" ? "Filter open tabs" : "Search sessions, tabs, URLs"}
                value={topView === "open" ? openFilter : query}
                onChange={(e) => (topView === "open" ? setOpenFilter(e.target.value) : setQuery(e.target.value))}
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted-2"
                style={{ fontFamily: "var(--font-body)" }}
              />
            </label>
          </div>

          {/* ── Content ──────────────────────────────────────── */}
          <div ref={scrollContainerRef} className={cn("stash-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1", isSessionTabDragging || isOpenTabDragging ? "pb-24" : (topView === "open" && selectedTabIds.size > 0) || (topView === "stash" && selectedSessionIds.size > 0) ? "pb-20" : "pb-12")}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={topView}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
                className="flex min-h-full flex-col"
              >
                <div className="flex flex-1 flex-col">
                  {topView === "open" ? (
                    <OpenTabsView
                      tabs={filteredOpenTabs}
                      selectedIds={selectedTabIds}
                      onToggle={toggleTabSelected}
                      onMarqueeSelect={(ids) => setSelectedTabIds(new Set(ids))}
                      onToggleAll={toggleSelectAll}
                      allSelected={allFilteredSelected}
                      hasAnyTabs={openTabs.length > 0}
                      isFiltering={openFilter.trim().length > 0}
                      reduceMotion={Boolean(reduceMotion)}
                    />
                  ) : (
                    <>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <StashSubTabs
                          showTrash={showTrash}
                          onChange={setShowTrash}
                          savedCount={activeCount}
                          trashCount={trashCount}
                        />

                        {showTrash ? (
                          trashCount > 0 ? (
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
                          ) : null
                        ) : (
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
                        )}
                      </div>

                      <DndContext
                        sensors={sensors}
                        collisionDetection={collisionDetection}
                        autoScroll={false}
                        onDragStart={onDragStart}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        onDragOver={onDragOver}
                        onDragCancel={() => { dragActiveRef.current = false; clearNewGroupDrag(); setActiveTab(null); setActiveSession(null); }}
                      >
                        {visibleSessions.length > 0 ? (
                          <SortableContext
                            items={visibleSessionIds}
                            strategy={verticalListSortingStrategy}
                          >
                            <MarqueeArea
                              enabled
                              threshold={10}
                              suspendRef={dragActiveRef}
                              onMarquee={(ids) => setSelectedSessionIds(new Set(ids))}
                              className="flex-1"
                            >
                              <SessionList
                                sessions={visibleSessions}
                                expandedIds={expandedIds}
                                editingId={editingId}
                                draftName={draftName}
                                viewMode={listMode}
                                freshlySavedId={freshlySavedId}
                                restoreBurstId={restoreBurstId}
                                reduceMotion={Boolean(reduceMotion)}
                                selectedIds={selectedSessionIds}
                                {...sessionActions}
                              />
                            </MarqueeArea>
                          </SortableContext>
                        ) : (
                          <EmptyState
                            viewMode={listMode}
                            query={query}
                            reduceMotion={Boolean(reduceMotion)}
                          />
                        )}

                        {(isSessionTabDragging || isOpenTabDragging) && (
                          <NewGroupDropZone progress={newGroupProgress} instant={isOpenTabDragging} />
                        )}

                        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
                          {activeTab
                            ? <TabDragPreview tab={activeTab} />
                            : activeSession
                            ? <SessionCardGhost session={activeSession} />
                            : null}
                        </DragOverlay>
                      </DndContext>
                    </>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── In-popup settings: slides over the stage; the top nav stays visible ── */}
          <AnimatePresence>
            {showSettings && (
              <PopupSettings onClose={() => setShowSettings(false)} reduceMotion={Boolean(reduceMotion)} />
            )}
          </AnimatePresence>
        </div>

        {/* ── Sticky Stash CTA (Open Tabs view) ──────────────── */}
        <AnimatePresence>
          {topView === "open" && selectedTabIds.size > 0 && !showSettings && (
            <StashFooter
              count={selectedTabIds.size}
              busy={isSaving}
              reduceMotion={Boolean(reduceMotion)}
              onStash={() => void handleStashSelected()}
            />
          )}
        </AnimatePresence>

        {/* ── Bulk action bar (Stash view, groups selected) ──── */}
        <AnimatePresence>
          {topView === "stash" && selectedSessionIds.size > 0 && !showSettings && (
            <BulkActionBar
              count={selectedSessionIds.size}
              inTrash={showTrash}
              reduceMotion={Boolean(reduceMotion)}
              onRestore={() => void handleBulkRestore()}
              onRemove={() => void handleBulkRemove()}
              onClear={() => setSelectedSessionIds(new Set())}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {saveBurst && <SaveBurstAnim burst={saveBurst} reduceMotion={Boolean(reduceMotion)} />}
        </AnimatePresence>

        <Toaster />
      </main>
    </TooltipProvider>
  );
}

/* ── Session list (memoized: unrelated app re-renders don't touch it) ─ */
const SessionList = memo(function SessionList({
  sessions, expandedIds, editingId, draftName, viewMode,
  freshlySavedId, restoreBurstId, reduceMotion,
  selectedIds, onToggleSelected,
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
  reduceMotion: boolean;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
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
  const selectionActive = selectedIds.size > 0;
  return (
    <motion.section
      className="relative grid gap-2"
      aria-label={viewMode === "trash" ? "Deleted sessions" : "Saved sessions"}
    >
        {/* popLayout pulls an exiting card out of flow immediately so the cards
            below slide up to fill the gap (e.g. when a group is emptied → trashed). */}
        <AnimatePresence initial={false} mode="popLayout">
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
              draftName={editingId === session.id ? draftName : ""}
              reduceMotion={reduceMotion}
              selected={selectedIds.has(session.id)}
              selectionActive={selectionActive}
              onToggleSelected={onToggleSelected}
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
  );
});

/* ── One session card (drop target for tabs, draggable for reorder) ─
   Memoized so a marquee drag (which rewrites the selection set on every pointer
   move) only re-renders the cards whose `selected` actually flipped. */
const SessionCard = memo(forwardRef(function SessionCard({
  session, index: i, isExpanded, isEditing, isFresh, isRestoring, viewMode,
  draftName, reduceMotion, selected, selectionActive,
  onToggleSelected,
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
  reduceMotion: boolean;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelected: (id: string) => void;
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
}, forwardedRef: React.ForwardedRef<HTMLElement>) {
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

  // AnimatePresence (popLayout) needs to measure the card, and dnd-kit needs the
  // node too — give both refs the same node.
  const setCardRef = useCallback((node: HTMLElement | null) => {
    setNodeRef(node);
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [setNodeRef, forwardedRef]);

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
      ref={setCardRef}
      data-marquee-id={session.id}
      {...(viewMode === "library" ? { ...attributes, ...listeners } : {})}
      style={sortStyle}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0 : 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
      whileHover={reduceMotion || isDragging || isAnyDragging ? undefined : { y: -3, transition: { type: "spring", stiffness: 420, damping: 26 } }}
      whileTap={reduceMotion || isAnyDragging ? undefined : { scale: 0.992 }}
      transition={{
        duration: 0.2,
        delay: reduceMotion ? 0 : Math.min(i * 0.018, 0.09),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        // Accent spine is an inset box-shadow so it follows the rounded edge the full height (no corner clipping)
        "group relative select-none overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[inset_4px_0_0_0_var(--color-accent),var(--shadow-sm)] transition-[box-shadow,border-color,background-color] duration-[var(--dur-base)] hover:border-border-strong hover:shadow-[inset_4px_0_0_0_var(--color-accent),var(--shadow-md)]",
        viewMode === "library" && "touch-none",
        isTabDropTarget ? "border-accent bg-accent/[0.05] ring-2 ring-accent/55" : "border-border",
        isReorderTarget && "ring-2 ring-border-strong border-border-strong",
        isFresh && "ring-2 ring-accent/30",
        selected && "border-accent bg-accent/[0.04] ring-2 ring-accent/45",
      )}
    >
      {/* Card header — single row. The whole row toggles expand; interactive
          children (checkbox, chevron, actions, rename field) stop propagation. */}
      <div
        onClick={() => { if (!isEditing) onToggleExpanded(session.id); }}
        className="flex cursor-pointer items-center gap-2 py-2.5 pl-2.5 pr-2.5"
      >
        {/* Selection checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label="Select group"
          data-marquee-skip
          onClick={(e) => { e.stopPropagation(); onToggleSelected(session.id); }}
          className={cn(
            "shrink-0 cursor-pointer select-none transition-opacity duration-[var(--dur-fast)]",
            selected || selectionActive ? "opacity-100" : "opacity-35 group-hover:opacity-100",
          )}
        >
          <CheckBox checked={selected} />
        </button>

        {/* Expand button (the whole card is the drag handle for reorder) */}
        <motion.button
          type="button"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          onClick={(e) => { e.stopPropagation(); onToggleExpanded(session.id); }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-2 transition-colors duration-[var(--dur-fast)] hover:text-ink"
        >
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className="inline-flex"
          >
            <ChevronRight size={15} />
          </motion.span>
        </motion.button>

        {/* Favicons (click bubbles to the header → expand) */}
        {session.tabs.length > 0 && (
          <div className="shrink-0">
            <FaviconSpine tabs={session.tabs} isRestoring={isRestoring} reduceMotion={reduceMotion} />
          </div>
        )}

        {/* Name + count */}
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void onRenameSubmit(); }}>
              <textarea
                data-marquee-skip
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
                rows={1}
                className="font-display display-title block w-full text-[14px] font-semibold text-ink leading-tight bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 rounded-none resize-none overflow-hidden cursor-text h-[20px] scrollbar-none"
              />
            </form>
          ) : (
            <div className="flex w-full items-center gap-1.5 text-left">
              {isFresh && <FreshDot reduceMotion={reduceMotion} />}
              <span className="truncate font-display display-title text-[14px] font-semibold leading-tight text-ink select-none">
                {session.name}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-muted-2">· {session.tabs.length}</span>
            </div>
          )}
        </div>

        {/* Actions + restore */}
        <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-0.5">
          <div className="pointer-events-none flex items-center opacity-0 transition-opacity duration-[var(--dur-base)] group-hover:pointer-events-auto group-hover:opacity-100">
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
              icon={<Undo2 size={15} />}
              onClick={() => void onRestoreDeleted(session.id)}
            />
          ) : session.tabs.length > 0 ? (
            <RestoreButton
              label="Restore tabs"
              icon={<RotateCcw size={15} />}
              onClick={() => void onRestoreAll(session)}
            />
          ) : (
            <div className="h-8 w-8" />
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
            data-marquee-skip
            className="m-0 list-none overflow-hidden border-t border-border p-1.5"
          >
            {session.tabs.length === 0 ? (
              <li className="flex items-center justify-center py-2 font-body text-[11px] text-muted-2">
                Drop tabs here
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
}));

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
/* ── Rubber-band (marquee) selection ───────────────────────────────
   Windows/file-manager style: press on empty space or an item and drag a
   rectangle; any element marked [data-marquee-id] it touches is selected.
   A press without movement is a plain click (handlers fire normally). */
function MarqueeArea({
  enabled, onMarquee, className, children, threshold = 5, suspendRef,
}: {
  enabled: boolean;
  onMarquee: (ids: string[]) => void;
  className?: string;
  children: React.ReactNode;
  // Distance the pointer must travel before a marquee starts. Kept above the
  // dnd hold's cancel `tolerance` so a press-drag aborts the hold first, then
  // becomes a marquee — the two never trigger off the same pixel.
  threshold?: number;
  // When this ref reads true a real dnd drag owns the pointer; stand down.
  suspendRef?: { current: boolean };
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(onMarquee);
  cbRef.current = onMarquee;
  // origin holds the press point; once we pass the threshold, dragging=true and
  // the container has pointer capture so it owns every subsequent move/up.
  const originRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const draggingRef = useRef(false);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  function hitTest(left: number, top: number, right: number, bottom: number) {
    const node = ref.current;
    if (!node) return;
    const hits: string[] = [];
    node.querySelectorAll<HTMLElement>("[data-marquee-id]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) {
        hits.push(el.dataset.marqueeId!);
      }
    });
    cbRef.current(hits);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled || e.button !== 0 || suspendRef?.current) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, [data-marquee-skip]")) return;
    originRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    draggingRef.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // A dnd hold just won the gesture — drop any pending marquee origin.
    if (suspendRef?.current) { originRef.current = null; return; }
    const o = originRef.current;
    if (!o) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    if (!draggingRef.current) {
      if (Math.hypot(dx, dy) < threshold) return;
      draggingRef.current = true;
      // Capture so we keep receiving move/up even as the pointer leaves rows.
      try { ref.current?.setPointerCapture(o.pointerId); } catch { /* noop */ }
      document.body.style.userSelect = "none";
    }
    const x = Math.min(o.x, e.clientX);
    const y = Math.min(o.y, e.clientY);
    const w = Math.abs(dx);
    const h = Math.abs(dy);
    setBox({ x, y, w, h });
    hitTest(x, y, x + w, y + h);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!originRef.current) return;
    const wasDragging = draggingRef.current;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    originRef.current = null;
    draggingRef.current = false;
    document.body.style.userSelect = "";
    setBox(null);
    if (wasDragging) {
      const swallow = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    }
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={className}
    >
      {children}
      {box &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] rounded-[4px] border-2 border-accent/70 bg-accent/20 shadow-[0_2px_10px_-2px_rgba(40,92,204,0.4)]"
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          />,
          document.body,
        )}
    </div>
  );
}

/* ── View switch: Open Tabs ⇆ Stash, with a sliding accent pill ─── */
function ViewSwitch({
  value, onChange, openCount, stashCount,
}: {
  value: TopView;
  onChange: (v: TopView) => void;
  openCount: number;
  stashCount: number;
}) {
  const items: { key: TopView; label: string; count: number; icon: React.ReactNode; flow?: boolean }[] = [
    { key: "open", label: "Open Tabs", count: openCount, icon: <LayoutGrid size={14} /> },
    { key: "stash", label: "Stash", count: stashCount, icon: <Layers size={14} />, flow: true },
  ];
  return (
    <div className="relative flex flex-1 items-center gap-1 rounded-full border border-border-strong/60 bg-surface-muted p-1 shadow-[inset_0_1px_3px_rgba(20,35,80,0.13)]">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className="relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-semibold active:scale-[0.98]"
          >
            {active && (
              <motion.span
                layoutId="view-switch-pill"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className="absolute inset-0 rounded-full bg-[image:linear-gradient(180deg,var(--color-accent-hi)_0%,var(--color-accent)_55%,var(--color-accent-lo)_100%)] shadow-[var(--shadow-primary)]"
              />
            )}
            <span className={cn(
              "relative z-10 flex items-center gap-1.5 transition-colors duration-[var(--dur-fast)]",
              active ? "text-white" : "text-muted hover:text-ink",
            )}>
              {it.icon}
              {it.label}
              {it.count > 0 && (
                <span className={cn(
                  "inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold leading-none",
                  active ? "bg-white/25 text-white" : "bg-ink/[0.07] text-muted-2",
                )}>
                  {it.flow ? <NumberFlow value={it.count} /> : it.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Stash sub-tabs: Saved ⇆ Trash, sliding pill (secondary to the top nav) ─── */
function StashSubTabs({
  showTrash, onChange, savedCount, trashCount,
}: {
  showTrash: boolean;
  onChange: (trash: boolean) => void;
  savedCount: number;
  trashCount: number;
}) {
  const items: { key: boolean; label: string; count: number; icon: React.ReactNode }[] = [
    { key: false, label: "Saved", count: savedCount, icon: <Layers size={12} /> },
    { key: true, label: "Trash", count: trashCount, icon: <Trash2 size={12} /> },
  ];
  return (
    <div className="relative flex items-center gap-0.5 rounded-full border border-border-strong/50 bg-surface-muted p-0.5 shadow-[inset_0_1px_2px_rgba(20,35,80,0.10)]">
      {items.map((it) => {
        const active = showTrash === it.key;
        const danger = it.key; // the Trash segment tints red when active
        return (
          <button
            key={String(it.key)}
            type="button"
            onClick={() => onChange(it.key)}
            className="relative flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold active:scale-[0.98]"
          >
            {active && (
              <motion.span
                layoutId="stash-subtab-pill"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className={cn(
                  "absolute inset-0 rounded-full",
                  danger
                    ? "bg-[image:linear-gradient(180deg,#FBE7E2_0%,#F6D8D0_100%)] shadow-[0_1px_2px_rgba(80,20,20,0.14),inset_0_1px_0_rgba(255,255,255,0.8)]"
                    : "bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] shadow-[0_1px_2px_rgba(20,35,80,0.13),inset_0_1px_0_rgba(255,255,255,0.9)]",
                )}
              />
            )}
            <span className={cn(
              "relative z-10 flex items-center gap-1.5 transition-colors duration-[var(--dur-fast)]",
              active ? (danger ? "text-danger-ink" : "text-ink") : "text-muted hover:text-ink",
            )}>
              {it.icon}
              {it.label}
              {it.count > 0 && (
                <span className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold leading-none",
                  active && danger ? "bg-danger/15 text-danger-ink" : "bg-ink/[0.07] text-muted-2",
                )}>
                  {it.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Open Tabs view: pick tabs to stash ────────────────────────── */
function OpenTabsView({
  tabs, selectedIds, onToggle, onMarqueeSelect, onToggleAll, allSelected, hasAnyTabs, isFiltering, reduceMotion,
}: {
  tabs: chrome.tabs.Tab[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onMarqueeSelect: (ids: number[]) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  hasAnyTabs: boolean;
  isFiltering: boolean;
  reduceMotion: boolean;
}) {
  // Marquee drag selects exactly the tabs under the rectangle (replace).
  const onMarquee = useCallback(
    (ids: string[]) => onMarqueeSelect(ids.map(Number)),
    [onMarqueeSelect],
  );
  if (tabs.length === 0) {
    return (
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center"
      >
        <p className="display-emphasis font-display text-[22px] leading-tight text-ink">
          {isFiltering ? "No matching tabs" : "No open tabs"}
        </p>
        <p className="mt-2 max-w-[250px] text-[13px] leading-relaxed text-muted">
          {isFiltering
            ? "Try a different title or URL."
            : hasAnyTabs
            ? "Every open tab is already pinned or can't be stashed."
            : "Open a few tabs, then pick the ones worth keeping."}
        </p>
      </motion.section>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col pb-1">
      {/* Select-all row */}
      <div className="mb-1.5 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onToggleAll}
          className="flex items-center gap-2 rounded-full py-1 pr-2 text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          <CheckBox checked={allSelected} />
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        <span className="font-mono text-[11px] text-muted-2">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${tabs.length} tabs`}
        </span>
      </div>

      <MarqueeArea enabled onMarquee={onMarquee} className="flex-1 min-h-[340px] rounded-[var(--radius-card)] border border-border bg-surface p-1.5 shadow-[var(--shadow-sm)]">
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {tabs.map((tab) => (
            <OpenTabSelectRow
              key={tab.id}
              chromeTab={tab}
              selected={tab.id != null && selectedIds.has(tab.id)}
              onToggle={onToggle}
            />
          ))}
        </ul>
      </MarqueeArea>
    </div>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-[var(--dur-fast)]",
        checked ? "border-accent bg-accent text-white" : "border-border-strong bg-surface",
      )}
    >
      <AnimatePresence>
        {checked && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex"
          >
            <Check size={12} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

const OpenTabSelectRow = memo(function OpenTabSelectRow({
  chromeTab, selected, onToggle,
}: {
  chromeTab: chrome.tabs.Tab;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
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

  return (
    <li
      data-marquee-id={chromeTab.id}
      onClick={() => chromeTab.id != null && onToggle(chromeTab.id)}
      className={cn(
        "flex w-full min-w-0 cursor-pointer select-none items-center gap-2.5 overflow-hidden rounded-[10px] px-2.5 py-2 text-left transition-colors duration-[var(--dur-fast)]",
        selected ? "bg-accent/[0.07]" : "hover:bg-surface-subtle",
      )}
    >
      <CheckBox checked={selected} />
      <Favicon tab={stashTab} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
        {stashTab.title}
      </span>
    </li>
  );
});

/* ── Sticky footer CTA shown while tabs are selected ───────────── */
function StashFooter({
  count, busy, reduceMotion, onStash,
}: {
  count: number;
  busy: boolean;
  reduceMotion: boolean;
  onStash: () => void;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { y: 64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: 64, opacity: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 34 }}
      className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-surface px-4 py-3 shadow-[0_-6px_16px_-8px_rgba(20,35,80,0.18)]"
    >
      <motion.button
        type="button"
        onClick={onStash}
        disabled={busy}
        whileHover={busy ? undefined : { scale: 1.015 }}
        whileTap={busy ? undefined : { scale: 0.98 }}
        transition={{ type: "spring", stiffness: 480, damping: 26 }}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[image:linear-gradient(180deg,var(--color-accent-hi)_0%,var(--color-accent)_55%,var(--color-accent-lo)_100%)] font-body text-[14px] font-semibold text-white shadow-[var(--shadow-primary)] transition-[box-shadow,filter] duration-[var(--dur-fast)] hover:shadow-[var(--shadow-primary-hover)] disabled:opacity-70"
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <PanelTopClose size={15} />
        )}
        {busy ? "Stashing…" : `Stash ${count} ${count === 1 ? "tab" : "tabs"}`}
      </motion.button>
    </motion.div>
  );
}

/* ── Bulk action bar shown while groups are selected ───────────── */
function BulkActionBar({
  count, inTrash, reduceMotion, onRestore, onRemove, onClear,
}: {
  count: number;
  inTrash: boolean;
  reduceMotion: boolean;
  onRestore: () => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { y: 64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { y: 64, opacity: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 34 }}
      className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-border bg-surface px-4 py-3 shadow-[0_-6px_16px_-8px_rgba(20,35,80,0.18)]"
    >
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-[var(--shadow-sm)] transition-[color,box-shadow] duration-[var(--dur-fast)] hover:text-ink hover:shadow-[var(--shadow-md)]"
      >
        <X size={15} />
      </button>
      <span className="shrink-0 font-mono text-[11px] text-muted-2">{count}</span>
      <div className="flex flex-1 items-center gap-2">
        <motion.button
          type="button"
          onClick={onRestore}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 480, damping: 26 }}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] font-body text-[13px] font-semibold text-accent-text shadow-[var(--shadow-raised)] transition-[box-shadow] duration-[var(--dur-fast)] hover:shadow-[var(--shadow-raised-hover)]"
        >
          {inTrash ? <Undo2 size={14} /> : <RotateCcw size={14} />}
          Restore
        </motion.button>
        <motion.button
          type="button"
          onClick={onRemove}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 480, damping: 26 }}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-danger-border bg-danger-soft font-body text-[13px] font-semibold text-danger-ink shadow-[var(--shadow-sm)] transition-[box-shadow,filter] duration-[var(--dur-fast)] hover:brightness-[0.99] hover:shadow-[var(--shadow-md)]"
        >
          <Trash2 size={14} />
          {inTrash ? "Delete" : "Trash"}
        </motion.button>
      </div>
    </motion.div>
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
      // Mirror storage: a group emptied by the move goes to trash, not left as ·0.
      return tabs.length === 0 && !session.deletedAt
        ? { ...session, tabs, deletedAt: Date.now() }
        : { ...session, tabs };
    }
    if (session.id === toSessionId) {
      if (session.tabs.some((t) => t.id === tabId)) return session;
      return { ...session, tabs: [...session.tabs, tab] };
    }
    return session;
  });
}

/* ── New-group drop zone ─────────────────────────────────────────── */
function NewGroupDropZone({ progress, instant }: { progress: number; instant?: boolean }) {
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
        {isOver
          ? instant ? "Release to create new group" : "Hold to create new group…"
          : "Drop here to create new group"}
      </span>
      {isOver && !instant && (
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-[image:linear-gradient(180deg,#FFFFFF_0%,var(--color-surface-subtle)_100%)] text-accent-text shadow-[var(--shadow-raised)] transition-[color,box-shadow,border-color] duration-[var(--dur-fast)] hover:border-accent hover:bg-accent hover:bg-none hover:text-[#FFF2BD] hover:shadow-[var(--shadow-primary)]"
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
  return <img className={cls} src={src} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
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
      className="w-[336px] overflow-hidden rounded-[var(--radius-card)] border border-accent/25 bg-surface shadow-[inset_4px_0_0_0_var(--color-accent),0_18px_36px_-10px_rgba(20,35,80,0.30),0_6px_14px_-4px_rgba(20,35,80,0.16)]"
      style={{ transform: "rotate(-1.2deg)" }}
    >
      <div className="flex items-center gap-2 py-2.5 pl-2.5 pr-2.5">
        <CheckBox checked={false} />
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-2">
          <ChevronRight size={15} />
        </span>
        {session.tabs.length > 0 && (
          <FaviconSpine tabs={session.tabs} isRestoring={false} reduceMotion={true} />
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate font-display display-title text-[14px] font-semibold leading-tight text-ink">
            {session.name}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] text-muted-2">· {session.tabs.length}</span>
        </span>
      </div>
    </div>
  );
}

/* ── Utils ─────────────────────────────────────────────────────── */
function formatUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}
