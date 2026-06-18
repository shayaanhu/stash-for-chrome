import type { StashSession, StashTab } from "./types";

export function isSavableChromeTab(tab: chrome.tabs.Tab) {
  if (!tab.url) {
    return false;
  }

  try {
    const url = new URL(tab.url);
    return ["http:", "https:", "file:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isTabPinned(tab: chrome.tabs.Tab) {
  return Boolean(tab.pinned);
}

export function createStashTab(tab: chrome.tabs.Tab, capturedAt = Date.now()): StashTab {
  return {
    id: crypto.randomUUID(),
    url: tab.url ?? "",
    title: tab.title?.trim() || tab.url || "Untitled tab",
    favicon: tab.favIconUrl ?? "",
    capturedAt
  };
}

export function createSessionFromChromeTabs(tabs: chrome.tabs.Tab[], now = Date.now()): StashSession {
  const stashedTabs = tabs.map((tab) => createStashTab(tab, now));

  return {
    id: crypto.randomUUID(),
    name: createSessionName(stashedTabs, now),
    createdAt: now,
    tabs: stashedTabs
  };
}

export function createSessionName(_tabs: StashTab[], now = Date.now()) {
  const date = new Date(now);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  return `${weekday} ${getDayPeriod(date)}`;
}

export function sortSessionsNewestFirst(sessions: StashSession[]) {
  return [...sessions].sort((a, b) => b.createdAt - a.createdAt);
}

export function matchesSession(session: StashSession, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return (
    session.name.toLowerCase().includes(normalizedQuery) ||
    session.tabs.some((tab) =>
      `${tab.title} ${tab.url}`.toLowerCase().includes(normalizedQuery)
    )
  );
}

function getDayPeriod(date: Date) {
  const hour = date.getHours();

  if (hour < 12) {
    return "Morning";
  }

  if (hour < 17) {
    return "Afternoon";
  }

  return "Evening";
}
