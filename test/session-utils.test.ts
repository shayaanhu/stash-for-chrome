import { describe, expect, it } from "vitest";
import {
  createSessionName,
  isSavableChromeTab,
  isTabPinned,
  matchesSession,
  sortSessionsNewestFirst,
} from "../src/shared/session-utils";
import type { StashSession, StashTab } from "../src/shared/types";

function tab(partial: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
  return { index: 0, pinned: false, highlighted: false, active: false, ...partial } as chrome.tabs.Tab;
}

function stashTab(partial: Partial<StashTab> = {}): StashTab {
  return { id: "t", url: "https://example.com", title: "Example", favicon: "", capturedAt: 0, ...partial };
}

function session(partial: Partial<StashSession> = {}): StashSession {
  return { id: "s", name: "Session", createdAt: 0, tabs: [stashTab()], ...partial };
}

describe("isSavableChromeTab", () => {
  it("accepts http, https and file URLs", () => {
    expect(isSavableChromeTab(tab({ url: "https://a.com" }))).toBe(true);
    expect(isSavableChromeTab(tab({ url: "http://a.com" }))).toBe(true);
    expect(isSavableChromeTab(tab({ url: "file:///tmp/x.html" }))).toBe(true);
  });

  it("rejects browser-internal and empty URLs", () => {
    expect(isSavableChromeTab(tab({ url: "chrome://extensions" }))).toBe(false);
    expect(isSavableChromeTab(tab({ url: "chrome-extension://abc/page.html" }))).toBe(false);
    expect(isSavableChromeTab(tab({ url: undefined }))).toBe(false);
    expect(isSavableChromeTab(tab({ url: "" }))).toBe(false);
  });
});

describe("isTabPinned", () => {
  it("reflects the pinned flag", () => {
    expect(isTabPinned(tab({ pinned: true }))).toBe(true);
    expect(isTabPinned(tab({ pinned: false }))).toBe(false);
  });
});

describe("createSessionName", () => {
  it("names by weekday and day period, without any tab title", () => {
    const morning = createSessionName([stashTab({ title: "Vite docs" })], new Date(2026, 0, 1, 9).getTime());
    expect(morning).toContain("Morning");
    expect(morning).not.toContain("Vite docs");
    expect(createSessionName([stashTab()], new Date(2026, 0, 1, 14).getTime())).toContain("Afternoon");
    expect(createSessionName([stashTab()], new Date(2026, 0, 1, 20).getTime())).toContain("Evening");
  });
});

describe("matchesSession", () => {
  const s = session({ name: "Research", tabs: [stashTab({ title: "Vite plugins", url: "https://vitejs.dev" })] });

  it("matches everything for an empty query", () => {
    expect(matchesSession(s, "")).toBe(true);
    expect(matchesSession(s, "   ")).toBe(true);
  });

  it("matches by name, tab title and URL, case-insensitively", () => {
    expect(matchesSession(s, "research")).toBe(true);
    expect(matchesSession(s, "VITE")).toBe(true);
    expect(matchesSession(s, "vitejs.dev")).toBe(true);
    expect(matchesSession(s, "nomatch")).toBe(false);
  });
});

describe("sortSessionsNewestFirst", () => {
  it("orders by createdAt descending without mutating the input", () => {
    const input = [session({ id: "a", createdAt: 1 }), session({ id: "b", createdAt: 3 }), session({ id: "c", createdAt: 2 })];
    const sorted = sortSessionsNewestFirst(input);
    expect(sorted.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(input[0].id).toBe("a"); // original untouched
  });
});
