import { defineBackground } from "wxt/utils/define-background";
import { addSession, getSettings } from "../src/shared/storage";
import type { SaveTarget } from "../src/shared/types";
import {
  createSessionFromChromeTabs,
  isSavableChromeTab,
  isTabPinned
} from "../src/shared/session-utils";
import type { BackgroundRequest, BackgroundResponse } from "../src/shared/messages";

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "stash-current-tab",
      title: "Save this tab to Stash",
      contexts: ["page"]
    });
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === "save-all-tabs") {
      void getSettings().then((settings) => saveTabs(settings.saveTarget));
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "stash-current-tab" && tab?.id) {
      void saveCurrentTab(tab.id);
    }
  });

  chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
    void handleRequest(request).then(sendResponse);
    return true;
  });
});

async function handleRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  try {
    if (request.type === "SAVE_TABS") {
      const session = await saveTabs(request.target);
      return { ok: true, session };
    }

    if (request.type === "SAVE_CURRENT_TAB") {
      const session = await saveCurrentTab(request.tabId);
      return { ok: true, session };
    }

    return { ok: false, error: "Unknown Stash request." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong."
    };
  }
}

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

function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(tabs);
    });
  });
}

function getTab(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(tab);
    });
  });
}

function createBlankTab(windowId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ windowId, active: true }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function removeTabs(tabIds: number[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabIds, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

async function closeTabsSafely(tabs: chrome.tabs.Tab[]) {
  const tabIds = tabs.flatMap((tab) => (typeof tab.id === "number" ? [tab.id] : []));

  if (tabIds.length === 0) {
    return;
  }

  await keepAffectedWindowsOpen(tabs, tabIds);
  await removeTabs(tabIds);
}

async function keepAffectedWindowsOpen(tabsToClose: chrome.tabs.Tab[], tabIdsToClose: number[]) {
  const idsToClose = new Set(tabIdsToClose);
  const windowIds = [
    ...new Set(tabsToClose.flatMap((tab) => (typeof tab.windowId === "number" ? [tab.windowId] : [])))
  ];

  for (const windowId of windowIds) {
    const tabsInWindow = await queryTabs({ windowId });
    const hasRemainingTab = tabsInWindow.some((tab) => typeof tab.id === "number" && !idsToClose.has(tab.id));

    if (!hasRemainingTab) {
      await createBlankTab(windowId);
    }
  }
}
