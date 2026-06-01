import { defineBackground } from "wxt/utils/define-background";
import {
  addSession,
  addSessions,
  deleteSessionForever,
  emptyTrash,
  ensureMeta,
  getSessions,
  getSettings,
  purgeExpiredTrash,
  removeTabFromSession,
  restoreDeletedSession,
  softDeleteSession,
  updateSessionName,
  updateSettings,
} from "../src/shared/storage";
import type { SaveTarget } from "../src/shared/types";
import {
  createSessionFromChromeTabs,
  isSavableChromeTab,
  isTabPinned,
} from "../src/shared/session-utils";
import type { BackgroundRequest, BackgroundResponse } from "../src/shared/messages";

const TRASH_PURGE_ALARM = "stash-trash-purge";
const TRASH_PURGE_PERIOD_MINUTES = 6 * 60;

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.create({
      id: "stash-current-tab",
      title: "Save this tab to Stash",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: "stash-all-tabs",
      title: "Save all tabs in this window to Stash",
      contexts: ["page"],
    });

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
    if (info.menuItemId === "stash-current-tab" && tab?.id) {
      void saveCurrentTab(tab.id);
    } else if (info.menuItemId === "stash-all-tabs") {
      void getSettings().then((settings) => saveTabs(settings.saveTarget));
    }
  });

  chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
    void handleRequest(request).then(sendResponse);
    return true; // keep the channel open for the async response
  });
});

async function handleRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  try {
    switch (request.type) {
      case "SAVE_TABS":
        return { ok: true, session: await saveTabs(request.target) };
      case "SAVE_CURRENT_TAB":
        return { ok: true, session: await saveCurrentTab(request.tabId) };
      case "RESTORE_SESSION":
        return { ok: true, session: await restoreSession(request.sessionId) };
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
      case "ADD_SESSIONS":
        return { ok: true, count: await addSessions(request.sessions) };
      case "UPDATE_SETTINGS":
        return { ok: true, settings: await updateSettings(request.settings) };
      default:
        return { ok: false, error: "Unknown Stash request." };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
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
  await closeTabsSafely(tabsToSave);
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
  await closeTabsSafely([tab]);
  return session;
}

// ── Restore (runs here so it survives the popup closing on focus change) ───────
async function restoreSession(sessionId: string) {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }

  const urls = session.tabs.map((tab) => tab.url).filter(Boolean);
  if (urls.length > 0) {
    await createWindow(urls);
  }
  // Restoring consumes the stash entry; the removed session is returned for undo.
  await deleteSessionForever(sessionId);
  return session;
}

// ── chrome.tabs / chrome.windows promise wrappers ──────────────────────────────
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

function createTab(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: true }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function createWindow(urls: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.windows.create({ url: urls, focused: true }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
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
