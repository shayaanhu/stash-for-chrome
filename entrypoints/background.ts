import { defineBackground } from "wxt/utils/define-background";
import {
  addAutoSaveSession,
  addSession,
  addSessions,
  addTabToSession,
  createGroupFromTab,
  deleteSessionForever,
  emptyTrash,
  ensureMeta,
  getSessions,
  getSessionOrder,
  getSettings,
  insertTabIntoSession,
  moveTab,
  purgeExpiredTrash,
  removeTabFromSession,
  restoreDeletedSession,
  setSessionOrder,
  softDeleteSession,
  updateSessionName,
  updateSettings,
} from "../src/shared/storage";
import type { RestoreSummary, SaveTarget, StashSession } from "../src/shared/types";
import {
  autoNameSession,
  createSessionFromChromeTabs,
  createStashTab,
  isSavableChromeTab,
} from "../src/shared/session-utils";
import type { BackgroundRequest, BackgroundResponse } from "../src/shared/messages";
import {
  putPageContent,
  deletePageContent,
  getAllContentIds,
  MAX_CONTENT_CHARS,
  MAX_SNAPSHOT_CHARS,
} from "../src/shared/content-store";
import { closeTabsResiliently, settleWithin } from "../src/shared/tab-close";

const TRASH_PURGE_ALARM = "stash-trash-purge";
const TRASH_PURGE_PERIOD_MINUTES = 6 * 60;

// Capture is best-effort and must never delay a close. A page whose main thread is
// blocked (modal dialog, heavy sync script) can leave executeScript pending forever,
// and every second we wait is another second a tab id can go stale.
const CAPTURE_TAB_TIMEOUT_MS = 2_000;
const CAPTURE_TOTAL_TIMEOUT_MS = 6_000;

const AUTO_SAVE_ALARM = "stash-autosave";
const AUTO_SAVE_PERIOD_MINUTES = 5;

export default defineBackground(() => {
  // Rebuild menus on every worker start too, not just install — so a reload or
  // an updated set of items always takes effect without a full reinstall.
  void setupContextMenus();

  // Rebuild context menus whenever sessions change so "Add to group" submenu stays fresh.
  let menuRebuildTimer: ReturnType<typeof setTimeout> | null = null;
  chrome.storage.onChanged.addListener(() => {
    if (menuRebuildTimer) clearTimeout(menuRebuildTimer);
    menuRebuildTimer = setTimeout(() => {
      menuRebuildTimer = null;
      void setupContextMenus();
    }, 1000);
  });

  chrome.runtime.onInstalled.addListener(async (details) => {
    void setupContextMenus();

    void ensureMeta();
    chrome.alarms.create(TRASH_PURGE_ALARM, { periodInMinutes: TRASH_PURGE_PERIOD_MINUTES });
    void reconcileContent();

    const settings = await getSettings();
    await syncAutoSaveAlarm(settings.autoSave);

    if (details.reason === "install") {
      void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }
  });

  chrome.runtime.onStartup.addListener(async () => {
    void purgeExpiredTrash();
    void reconcileContent();
    const settings = await getSettings();
    await syncAutoSaveAlarm(settings.autoSave);
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TRASH_PURGE_ALARM) { void purgeExpiredTrash(); void reconcileContent(); }
    if (alarm.name === AUTO_SAVE_ALARM) void runAutoSave();
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === "save-all-tabs") {
      void getSettings().then((settings) => saveTabs(settings.saveTarget));
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const itemId = String(info.menuItemId);
    if (itemId === "stash-current-tab") {
      void saveCurrentTab(tab?.id);
    } else if (itemId === "stash-all-tabs") {
      void getSettings().then((settings) => saveTabs(settings.saveTarget));
    } else if (itemId.startsWith("stash-tab-to-group-")) {
      const sessionId = itemId.slice("stash-tab-to-group-".length);
      void addCurrentTabToSession(tab?.id, sessionId);
    }
  });

  chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
    void handleRequest(request).then(sendResponse);
    return true; // keep the channel open for the async response
  });
});

// ── Context menus ───────────────────────────────────────────────────────────────
// Serialize all rebuild calls — concurrent calls (e.g. onInstalled + top-level
// startup) would otherwise both complete removeAll before either creates items,
// causing "duplicate id" errors.
let _menuChain: Promise<void> = Promise.resolve();

function setupContextMenus(): Promise<void> {
  _menuChain = _menuChain.then(doSetupContextMenus).catch(() => {});
  return _menuChain;
}

async function doSetupContextMenus(): Promise<void> {
  const sessions = await getSessions().catch(() => []);
  const active = sessions.filter((s) => !s.deletedAt && !s.autoSaved).slice(0, 15);

  await new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;
      resolve();
    });
  });

  // Don't combine "all" with "tab" — Chrome drops "tab" silently when mixed.
  // Explicit list covers every page context plus the tab-strip (Chrome 116+).
  // "tab" (the tab-strip context, Chrome 116+) isn't in this @types/chrome
  // version's ContextType union yet, so assert the whole list to the field type.
  const ctx = [
    "page", "frame", "selection", "link", "editable", "image", "video", "audio", "tab",
  ] as unknown as chrome.contextMenus.CreateProperties["contexts"];

  const ack = () => { void chrome.runtime.lastError; };

  chrome.contextMenus.create({ id: "stash-current-tab", title: "Stash this tab", contexts: ctx }, ack);

  if (active.length > 0) {
    chrome.contextMenus.create({ id: "stash-tab-to-group", title: "Add this tab to a group", contexts: ctx }, ack);
    for (const session of active) {
      const title = session.name.length > 40 ? `${session.name.slice(0, 37)}…` : session.name;
      chrome.contextMenus.create({
        id: `stash-tab-to-group-${session.id}`,
        parentId: "stash-tab-to-group",
        title,
        contexts: ctx,
      }, ack);
    }
  }

  chrome.contextMenus.create({ id: "stash-all-tabs", title: "Stash all tabs in this window", contexts: ctx }, ack);
}

async function handleRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  try {
    switch (request.type) {
      case "SAVE_TABS": {
        const { session, skipped } = await saveTabs(request.target);
        return { ok: true, session, skipped };
      }
      case "SAVE_CURRENT_TAB":
        return { ok: true, session: await saveCurrentTab(request.tabId) };
      case "RESTORE_SESSION": {
        const settings = await getSettings();
        const { session, restore } = await restoreSession(request.sessionId, settings.restoreInNewWindow);
        return { ok: true, session, restore };
      }
      case "RESTORE_TAB":
        await createTab(request.url);
        return { ok: true };
      case "ACTIVATE_TAB":
        await activateTab(request.tabId, request.windowId);
        return { ok: true };
      case "ADD_TAB_TO_SESSION":
        return { ok: true, session: await insertTabIntoSession(request.sessionId, request.tab, request.index) };
      case "RENAME_SESSION":
        return { ok: true, session: await updateSessionName(request.sessionId, request.name) };
      case "SOFT_DELETE_SESSION":
        return { ok: true, session: await softDeleteSession(request.sessionId) };
      case "RESTORE_DELETED_SESSION":
        return { ok: true, session: await restoreDeletedSession(request.sessionId) };
      case "DELETE_FOREVER": {
        const removed = await deleteSessionForever(request.sessionId);
        if (removed) void deletePageContent(removed.tabs.map((t) => t.id));
        return { ok: true, session: removed };
      }
      case "EMPTY_TRASH": {
        const removed = await emptyTrash();
        void deletePageContent(removed.flatMap((s) => s.tabs.map((t) => t.id)));
        return { ok: true, sessions: removed };
      }
      case "REMOVE_TAB":
        // Content is left for the reconcile sweep to reclaim, so Undo (which
        // re-adds the same tab id) keeps the page body searchable.
        return { ok: true, session: await removeTabFromSession(request.sessionId, request.tabId) };
      case "MOVE_TAB": {
        const { to } = await moveTab(request.fromSessionId, request.toSessionId, request.tabId);
        return { ok: true, session: to };
      }
      case "CREATE_GROUP_FROM_TAB": {
        const session = await createGroupFromTab(
          request.fromSessionId,
          request.tabId,
          request.newSession,
          request.order,
        );
        return { ok: true, session };
      }
      case "ADD_SESSIONS":
        return { ok: true, count: await addSessions(request.sessions) };
      case "UNDO_RESTORE_SESSION": {
        const count = await addSessions(request.sessions);
        await closeTabsByUrls(request.sessions.flatMap((s) => s.tabs.map((t) => t.url)));
        return { ok: true, count };
      }
      case "UPDATE_SETTINGS": {
        const settings = await updateSettings(request.settings);
        if ("autoSave" in request.settings) await syncAutoSaveAlarm(settings.autoSave);
        return { ok: true, settings };
      }
      case "CREATE_EMPTY_SESSION": {
        const session: StashSession = {
          id: crypto.randomUUID(),
          name: "New group",
          createdAt: Date.now(),
          tabs: [],
          manuallyCreated: true,
        };
        await addSession(session);
        const order = await getSessionOrder();
        await setSessionOrder([session.id, ...order]);
        return { ok: true, session };
      }
      case "REORDER_SESSIONS":
        await setSessionOrder(request.order);
        return { ok: true };
      case "ADD_OPEN_TAB_TO_SESSION": {
        const chromeTab = await getTab(request.tabId);
        if (!isSavableChromeTab(chromeTab)) throw new Error("This tab cannot be stashed.");
        const stashTab = createStashTab(chromeTab);
        const session = await addTabToSession(request.sessionId, stashTab);
        flashSavedBadge();
        void closeTabsSafely([chromeTab]).catch(() => undefined);
        return { ok: true, session };
      }
      case "STASH_SELECTED_TABS": {
        const chromeTabs = await getSavableTabs(request.tabIds);
        if (chromeTabs.length === 0) throw new Error("None of the selected tabs can be stashed.");
        const stashTabs = chromeTabs.map(createStashTab);
        const now = Date.now();
        const session: StashSession = {
          id: crypto.randomUUID(),
          name: request.name?.trim() || autoNameSession(stashTabs, now),
          createdAt: now,
          tabs: stashTabs,
        };
        await addSession(session);
        const order = await getSessionOrder();
        await setSessionOrder([session.id, ...order]);
        flashSavedBadge();
        captureThenMaybeClose(pairsFor(stashTabs, chromeTabs), chromeTabs, request.closeAfter);
        return { ok: true, session, skipped: request.tabIds.length - chromeTabs.length };
      }
      case "ADD_SELECTED_TABS_TO_SESSION": {
        const chromeTabs = await getSavableTabs(request.tabIds);
        if (chromeTabs.length === 0) throw new Error("None of the selected tabs can be stashed.");
        const stashTabs = chromeTabs.map(createStashTab);
        let session: StashSession | undefined;
        for (const stashTab of stashTabs) {
          session = await addTabToSession(request.sessionId, stashTab);
        }
        flashSavedBadge();
        captureThenMaybeClose(pairsFor(stashTabs, chromeTabs), chromeTabs, request.closeAfter);
        return { ok: true, session, skipped: request.tabIds.length - chromeTabs.length };
      }
      case "CREATE_GROUP_FROM_OPEN_TAB": {
        const chromeTab = await getTab(request.tabId);
        if (!isSavableChromeTab(chromeTab)) throw new Error("This tab cannot be stashed.");
        const stashTab = createStashTab(chromeTab);
        const session: StashSession = {
          id: request.sessionId,
          name: request.sessionName,
          createdAt: Date.now(),
          tabs: [stashTab],
          manuallyCreated: true,
        };
        await addSession(session);
        await setSessionOrder(request.order);
        flashSavedBadge();
        void closeTabsSafely([chromeTab]).catch(() => undefined);
        return { ok: true, session };
      }
      default:
        return { ok: false, error: "Unknown Stash request." };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

// ── Auto-save ─────────────────────────────────────────────────────────────────
async function syncAutoSaveAlarm(enabled: boolean): Promise<void> {
  if (enabled) {
    const existing = await new Promise<chrome.alarms.Alarm | undefined>((r) =>
      chrome.alarms.get(AUTO_SAVE_ALARM, r),
    );
    if (!existing) chrome.alarms.create(AUTO_SAVE_ALARM, { periodInMinutes: AUTO_SAVE_PERIOD_MINUTES });
  } else {
    await chrome.alarms.clear(AUTO_SAVE_ALARM);
  }
}

async function runAutoSave(): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoSave) {
    await chrome.alarms.clear(AUTO_SAVE_ALARM);
    return;
  }
  const tabs = await queryTabs({ lastFocusedWindow: true });
  // Pinned tabs included: this snapshot is crash insurance, so leaving them out
  // meant a crash could still cost you tabs. Auto-save never closes anything.
  const savable = tabs.filter((t) => isSavableChromeTab(t));
  if (savable.length === 0) return;
  const now = Date.now();
  const stashTabs = savable.map((t) => createStashTab(t, now));
  const session: StashSession = {
    id: crypto.randomUUID(),
    name: autoNameSession(stashTabs, now),
    createdAt: now,
    tabs: stashTabs,
    autoSaved: true,
    autoSaveKind: new Date(now).getHours() === 23 ? "daily" : "interval",
  };
  await addAutoSaveSession(session);
}

// ── Add single tab to an existing session (context menu) ─────────────────────
async function addCurrentTabToSession(tabId: number | undefined, sessionId: string) {
  if (!tabId) {
    const tabs = await queryTabs({ active: true, lastFocusedWindow: true });
    tabId = tabs[0]?.id;
  }
  if (!tabId) return;
  const chromeTab = await getTab(tabId);
  if (!isSavableChromeTab(chromeTab)) return;
  const stashTab = createStashTab(chromeTab);
  await addTabToSession(sessionId, stashTab);
  flashSavedBadge();
  void closeTabsSafely([chromeTab]).catch(() => undefined);
}

// ── Capture ───────────────────────────────────────────────────────────────────
// ── Page content capture (the "search inside the page" slice) ────────────────
// Pull the visible text of each tab BEFORE it closes and store it keyed by the
// StashTab id, so search can later match what was INSIDE a page, not just its
// title or URL. Best-effort: restricted pages (chrome://, the web store, a
// discarded tab) simply won't script, and we skip them without failing the stash.
type CapturePair = { tabId?: number; stashId: string; url: string; title: string };

async function captureContent(pairs: CapturePair[]): Promise<void> {
  // Each tab is bounded on its own so one blocked page cannot hold up the batch,
  // and the batch is bounded again by the caller as a backstop.
  await Promise.all(
    pairs.map((pair) => settleWithin(captureOne(pair), CAPTURE_TAB_TIMEOUT_MS, undefined)),
  );
}

async function captureOne({ tabId, stashId, url, title }: CapturePair): Promise<void> {
  if (typeof tabId !== "number") return;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractReadable,
    });
    const result = injection?.result as { text: string; html: string } | undefined;
    const text = (result?.text ?? "").slice(0, MAX_CONTENT_CHARS);
    const html = (result?.html ?? "").slice(0, MAX_SNAPSHOT_CHARS);
    if (text.trim().length > 0) {
      await putPageContent({ id: stashId, url, title, text, html: html || undefined, capturedAt: Date.now() });
    }
  } catch {
    // Not scriptable (restricted scheme, discarded tab, withheld host access) —
    // the tab is still saved, just link-only. Never a reason to fail the stash.
  }
}

/**
 * Runs IN the page (serialized by executeScript, so it must be fully
 * self-contained). A Readability-style pass: find the main content, strip
 * boilerplate and anything executable, and return clean text (for search) plus
 * a sanitized HTML snapshot (the offline "saved copy"). Deliberately dependency
 * free; @mozilla/readability can be swapped in later for higher fidelity.
 */
function extractReadable(): { text: string; html: string } {
  try {
    if (!document.body) return { text: "", html: "" };

    // Search text = the WHOLE body for maximum recall (this is what lets you find
    // a word buried in a comment or sidebar). innerText needs layout, so read live.
    const text = (document.body.innerText || document.body.textContent || "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Snapshot HTML = just the main content, cleaned — a readable "saved copy".
    const root =
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.body;
    const clone = root.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll(
        "script,style,noscript,iframe,object,embed,svg,canvas,form,nav,header,footer,aside," +
          '[role="navigation"],[role="banner"],[role="contentinfo"],[aria-hidden="true"]',
      )
      .forEach((el) => el.remove());
    clone.querySelectorAll("*").forEach((el) => {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        // Drop event handlers and javascript: URLs so the snapshot is inert.
        if (name.startsWith("on") || /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
      }
    });

    return { text, html: clone.innerHTML };
  } catch {
    return { text: "", html: "" };
  }
}

/**
 * Sweep away captured content whose tab no longer exists in any session — the
 * privacy + storage safety net. Runs on startup / install / purge, and catches
 * every removal path (delete, empty trash, expired purge, dedup) in one place.
 * getSessions() already excludes expired trash, so their content is reclaimed too.
 */
async function reconcileContent(): Promise<void> {
  try {
    const [sessions, ids] = await Promise.all([getSessions(), getAllContentIds()]);
    const live = new Set(sessions.flatMap((s) => s.tabs.map((t) => t.id)));
    const orphans = ids.filter((id) => !live.has(id));
    if (orphans.length > 0) await deletePageContent(orphans);
  } catch {
    // Best-effort; a failed sweep just retries next time.
  }
}

/** Pair a session's stored tabs with the live chrome tabs they came from (same order). */
function pairsFor(stashTabs: StashSession["tabs"], chromeTabs: chrome.tabs.Tab[]): CapturePair[] {
  return stashTabs.map((t, i) => ({ tabId: chromeTabs[i]?.id, stashId: t.id, url: t.url, title: t.title }));
}

/**
 * Capture text for the just-stashed tabs, then (optionally) close them.
 *
 * Capture is bounded twice over (per tab, then the whole batch) because closing is
 * the thing the user actually asked for. Waiting on capture indefinitely used to
 * mean tabs never closed at all, and the delay also let tab ids go stale, which
 * then poisoned the batched remove. Capture that misses the deadline keeps running
 * and still lands; it just stops holding the close hostage.
 */
function captureThenMaybeClose(pairs: CapturePair[], chromeTabs: chrome.tabs.Tab[], close: boolean) {
  const captured = settleWithin(captureContent(pairs), CAPTURE_TOTAL_TIMEOUT_MS, undefined);
  if (!close) return;
  void captured.then(() =>
    closeTabsSafely(chromeTabs).catch((error) => {
      console.warn("[Stash] Closing tabs after stash failed:", error);
    }),
  );
}

async function saveTabs(target: SaveTarget) {
  const tabs = await queryTabs(target === "all-windows" ? {} : { lastFocusedWindow: true });
  // Pinned tabs are stashed and closed like any other. Skipping them left tabs
  // behind after a stash, which reads as "it didn't work" no matter how deliberate.
  const tabsToSave = tabs.filter((tab) => isSavableChromeTab(tab));

  if (tabsToSave.length === 0) {
    throw new Error("No saveable tabs found.");
  }

  const session = createSessionFromChromeTabs(tabsToSave);
  await addSession(session);
  const order = await getSessionOrder();
  await setSessionOrder([session.id, ...order]);
  flashSavedBadge();
  // Capture each page's text, THEN close (as best-effort cleanup) AFTER the save
  // is safely stored: the popup gets its confirmation without waiting, and a
  // capture/close hiccup can never turn a successful save into an error.
  captureThenMaybeClose(pairsFor(session.tabs, tabsToSave), tabsToSave, true);
  // Anything Chrome won't let us touch stays open. Report it so the popup can say
  // why, rather than leaving the user to guess that the stash half-failed.
  return { session, skipped: tabs.length - tabsToSave.length };
}

async function saveCurrentTab(tabId?: number) {
  if (!tabId) {
    const tabs = await queryTabs({ active: true, lastFocusedWindow: true });
    tabId = tabs[0]?.id;
  }
  if (!tabId) {
    throw new Error("No active tab found.");
  }

  const tab = await getTab(tabId);
  if (!isSavableChromeTab(tab)) {
    throw new Error("This tab cannot be saved.");
  }

  const session = createSessionFromChromeTabs([tab]);
  await addSession(session);
  const order = await getSessionOrder();
  await setSessionOrder([session.id, ...order]);
  flashSavedBadge();
  captureThenMaybeClose(pairsFor(session.tabs, [tab]), [tab], true);
  return session;
}

// ── Save confirmation ──────────────────────────────────────────────────────────
/**
 * Flash a green ✓ on the toolbar icon after a save. This is the one indication
 * that survives every entry point — popup button, keyboard shortcut, context
 * menu — even when the popup has already closed with the window.
 */
const SAVED_BADGE_MS = 5000;
function flashSavedBadge() {
  void chrome.action.setBadgeBackgroundColor({ color: "#2E7D46" });
  chrome.action.setBadgeTextColor?.({ color: "#FFFFFF" });
  void chrome.action.setBadgeText({ text: "✓" });
  setTimeout(() => void chrome.action.setBadgeText({ text: "" }), SAVED_BADGE_MS);
}

// ── Restore (runs here so it survives the popup closing on focus change) ───────
async function restoreSession(sessionId: string, inNewWindow: boolean) {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Session not found.");

  const urls = session.tabs.map((tab) => tab.url).filter(Boolean);
  const restore =
    urls.length === 0
      ? { opened: 0, failed: 0, needsFileAccess: false }
      : inNewWindow
        ? await openUrlsInNewWindow(urls)
        : await openUrlsInCurrentWindow(urls);

  // Consume the stash entry only on a fully clean restore. If anything failed
  // (e.g. a file:// tab needs file access), keep the whole session so nothing is
  // lost — the user can enable access and restore again to get the rest.
  if (urls.length === 0 || (restore.opened > 0 && restore.failed === 0)) {
    await deleteSessionForever(sessionId);
  }
  // The removed session is returned for undo.
  return { session, restore };
}

// Above this many tabs, a restore parks each tab unloaded instead of letting them
// all load at once — loading dozens of pages simultaneously can exhaust memory and
// crash the browser. Smaller restores load eagerly so the tabs are ready to use.
const LAZY_RESTORE_THRESHOLD = 10;

/** Open URLs one at a time so a single failure can't abort the whole group. */
async function openUrlsIntoWindow(urls: string[], windowId?: number): Promise<RestoreSummary> {
  const fileAccess = await isAllowedFileSchemeAccess();
  // Big restores park tabs unloaded (create + discard) so we never have more than
  // ~one page loading at a time. Each parked tab reloads when the user focuses it.
  const lazy = urls.length > LAZY_RESTORE_THRESHOLD;
  let opened = 0;
  let failed = 0;
  let needsFileAccess = false;

  for (const url of urls) {
    // A file:// tab without file access would throw "Cannot navigate to a file
    // URL..." — skip it cleanly and flag the fixable cause instead.
    if (!fileAccess && url.startsWith("file:")) {
      failed++;
      needsFileAccess = true;
      continue;
    }
    try {
      await createTabInWindow(url, windowId, lazy);
      opened++;
    } catch {
      failed++;
    }
  }

  return { opened, failed, needsFileAccess };
}

async function openUrlsInCurrentWindow(urls: string[]): Promise<RestoreSummary> {
  const [activeTab] = await queryTabs({ active: true, lastFocusedWindow: true });
  return openUrlsIntoWindow(urls, activeTab?.windowId);
}

async function openUrlsInNewWindow(urls: string[]): Promise<RestoreSummary> {
  const windowId = await createEmptyWindow();
  // Chrome opens a blank New Tab with the window; remember it so we can drop it
  // once the real tabs are in.
  const blanks = windowId !== undefined ? await queryTabs({ windowId }) : [];
  const summary = await openUrlsIntoWindow(urls, windowId);

  if (summary.opened > 0) {
    const blankIds = blanks.flatMap((t) => (typeof t.id === "number" ? [t.id] : []));
    if (blankIds.length > 0) await removeTabs(blankIds).catch(() => undefined);
  }
  return summary;
}

async function closeTabsByUrls(urls: string[]) {
  const urlSet = new Set(urls.filter(Boolean));
  if (urlSet.size === 0) return;
  const allTabs = await queryTabs({});
  const toClose = allTabs
    .filter((tab) => tab.url && urlSet.has(tab.url) && typeof tab.id === "number")
    .map((tab) => tab.id as number);
  if (toClose.length > 0) await closeTabsSafely(allTabs.filter((t) => toClose.includes(t.id as number)));
}

// ── chrome.tabs / chrome.windows promise wrappers ──────────────────────────────
function isAllowedFileSchemeAccess(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.extension.isAllowedFileSchemeAccess((allowed) => resolve(Boolean(allowed)));
    } catch {
      resolve(false);
    }
  });
}
function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(tabs);
    });
  });
}

function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(tab);
    });
  });
}

// Resolve a list of tab ids to the subset that still exist and can be stashed,
// preserving the caller's order.
async function getSavableTabs(tabIds: number[]): Promise<chrome.tabs.Tab[]> {
  const resolved = await Promise.all(
    tabIds.map((id) => getTab(id).catch(() => null)),
  );
  return resolved.filter(
    (tab): tab is chrome.tabs.Tab => tab !== null && isSavableChromeTab(tab),
  );
}

// Focus an already-open tab (used by global search). Runs here so it survives
// the popup closing as focus moves to the target window.
async function activateTab(tabId: number, windowId?: number): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.tabs.update(tabId, { active: true }, () => { void chrome.runtime.lastError; resolve(); });
  });
  if (typeof windowId === "number") {
    await new Promise<void>((resolve) => {
      chrome.windows.update(windowId, { focused: true }, () => { void chrome.runtime.lastError; resolve(); });
    });
  }
}

async function createTab(url: string): Promise<void> {
  if (url.startsWith("file:") && !(await isAllowedFileSchemeAccess())) {
    throw new Error("Local files need “Allow access to file URLs” (chrome://extensions → Stash → Details).");
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: true }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

/**
 * Create one restored tab, inactive so it never steals focus. When `lazy`, the
 * tab is discarded immediately after creation: Chrome unloads the page, parking it
 * in the strip (title + favicon kept) and reloading it only when the user focuses
 * it. Because the caller awaits this sequentially, a parked restore keeps roughly
 * one page loading at a time, so even a huge session can't spike memory and crash
 * the browser. Discard is best-effort — if Chrome refuses, the tab stays loaded.
 */
function createTabInWindow(url: string, windowId: number | undefined, lazy: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, windowId, active: false }, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (lazy && typeof tab?.id === "number") {
        chrome.tabs.discard(tab.id, () => {
          void chrome.runtime.lastError; // ignore: a tab that won't discard just stays loaded
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

function createEmptyWindow(): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    chrome.windows.create({ focused: true }, (win) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(win?.id);
    });
  });
}

function createBlankTab(windowId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ windowId, active: true }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function removeTabs(tabIds: number[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabIds, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function closeTabsSafely(tabs: chrome.tabs.Tab[]) {
  const tabIds = tabs.flatMap((tab) => (typeof tab.id === "number" ? [tab.id] : []));
  if (tabIds.length === 0) return;

  // Keeping the window alive is a courtesy; failing at it must never cost the user
  // the close they actually asked for. Previously a throw here skipped removeTabs
  // entirely and nothing closed, silently.
  try {
    await keepAffectedWindowsOpen(tabs, tabIds);
  } catch (error) {
    console.warn("[Stash] Could not add a blank tab before closing:", error);
  }

  const { failed } = await closeTabsResiliently(tabIds, removeTabs);
  if (failed.length > 0) {
    // Almost always tabs that were already gone. Worth surfacing in the console
    // rather than swallowing, so a real regression is visible next time.
    console.warn(`[Stash] ${failed.length} tab(s) could not be closed:`, failed);
  }
}

async function keepAffectedWindowsOpen(tabsToClose: chrome.tabs.Tab[], tabIdsToClose: number[]) {
  const idsToClose = new Set(tabIdsToClose);
  const windowIds = [
    ...new Set(tabsToClose.flatMap((tab) => (typeof tab.windowId === "number" ? [tab.windowId] : []))),
  ];

  for (const windowId of windowIds) {
    const tabsInWindow = await queryTabs({ windowId });
    const hasRemainingTab = tabsInWindow.some(
      (tab) => typeof tab.id === "number" && !idsToClose.has(tab.id),
    );
    if (!hasRemainingTab) {
      await createBlankTab(windowId);
    }
  }
}
