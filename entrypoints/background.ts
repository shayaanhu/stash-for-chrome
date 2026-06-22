import { defineBackground } from "wxt/utils/define-background";
import {
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
  createSessionFromChromeTabs,
  createStashTab,
  isSavableChromeTab,
  isTabPinned,
} from "../src/shared/session-utils";
import type { BackgroundRequest, BackgroundResponse } from "../src/shared/messages";

const TRASH_PURGE_ALARM = "stash-trash-purge";
const TRASH_PURGE_PERIOD_MINUTES = 6 * 60;

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

  chrome.runtime.onInstalled.addListener((details) => {
    void setupContextMenus();

    void ensureMeta();
    chrome.alarms.create(TRASH_PURGE_ALARM, { periodInMinutes: TRASH_PURGE_PERIOD_MINUTES });

    if (details.reason === "install") {
      void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    void purgeExpiredTrash();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TRASH_PURGE_ALARM) void purgeExpiredTrash();
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
  const active = sessions.filter((s) => !s.deletedAt).slice(0, 15);

  await new Promise<void>((resolve) => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;
      resolve();
    });
  });

  // Don't combine "all" with "tab" — Chrome drops "tab" silently when mixed.
  // Explicit list covers every page context plus the tab-strip (Chrome 116+).
  const ctx: chrome.contextMenus.ContextType[] = [
    "page", "frame", "selection", "link", "editable", "image", "video", "audio", "tab",
  ];

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
      case "SAVE_TABS":
        return { ok: true, session: await saveTabs(request.target) };
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
      case "RENAME_SESSION":
        return { ok: true, session: await updateSessionName(request.sessionId, request.name) };
      case "SOFT_DELETE_SESSION":
        return { ok: true, session: await softDeleteSession(request.sessionId) };
      case "RESTORE_DELETED_SESSION":
        return { ok: true, session: await restoreDeletedSession(request.sessionId) };
      case "DELETE_FOREVER":
        return { ok: true, session: await deleteSessionForever(request.sessionId) };
      case "EMPTY_TRASH":
        return { ok: true, sessions: await emptyTrash() };
      case "REMOVE_TAB":
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
      case "UPDATE_SETTINGS":
        return { ok: true, settings: await updateSettings(request.settings) };
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
async function saveTabs(target: SaveTarget) {
  const tabs = await queryTabs(target === "all-windows" ? {} : { lastFocusedWindow: true });
  const tabsToSave = tabs.filter((tab) => isSavableChromeTab(tab) && !isTabPinned(tab));

  if (tabsToSave.length === 0) {
    throw new Error("No saveable tabs found.");
  }

  const session = createSessionFromChromeTabs(tabsToSave);
  await addSession(session);
  const order = await getSessionOrder();
  await setSessionOrder([session.id, ...order]);
  flashSavedBadge();
  // Close tabs as best-effort cleanup AFTER the save is safely stored: the popup
  // gets its confirmation without waiting on the window to clear, and a close
  // hiccup can never turn a successful save into an error.
  void closeTabsSafely(tabsToSave).catch(() => undefined);
  return session;
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
  void closeTabsSafely([tab]).catch(() => undefined);
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

/** Open URLs one at a time so a single failure can't abort the whole group. */
async function openUrlsIntoWindow(urls: string[], windowId?: number): Promise<RestoreSummary> {
  const fileAccess = await isAllowedFileSchemeAccess();
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
      await createTabInWindow(url, windowId);
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

function createTabInWindow(url: string, windowId?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, windowId, active: false }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
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
  await keepAffectedWindowsOpen(tabs, tabIds);
  await removeTabs(tabIds);
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
