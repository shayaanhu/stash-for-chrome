import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  TRASH_RETENTION_MS,
  addSession,
  addSessions,
  deleteSessionForever,
  emptyTrash,
  getSessions,
  moveTab,
  normalizeSessions,
  purgeExpiredTrash,
  removeTabFromSession,
  restoreDeletedSession,
  softDeleteSession,
  updateSessionName,
} from "../src/shared/storage";
import type { StashSession } from "../src/shared/types";

function makeSession(overrides: Partial<StashSession> = {}): StashSession {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Session",
    createdAt: overrides.createdAt ?? Date.now(),
    tabs: overrides.tabs ?? [
      { id: crypto.randomUUID(), url: "https://example.com", title: "Example", favicon: "", capturedAt: Date.now() },
    ],
    ...overrides,
  };
}

/** Read the raw stored array, bypassing the in-memory expired-trash filter. */
function readRaw(): Promise<StashSession[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["stash.sessions"], (items) => resolve((items["stash.sessions"] as StashSession[]) ?? []));
  });
}

describe("save / read round-trip", () => {
  it("persists and returns a saved session", async () => {
    const s = makeSession({ name: "First" });
    await addSession(s);
    const sessions = await getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].name).toBe("First");
  });

  it("stamps the schema version on write", async () => {
    await addSession(makeSession());
    const meta = await new Promise<{ version: number }>((resolve) =>
      chrome.storage.local.get(["stash.meta"], (items) => resolve(items["stash.meta"] as { version: number })),
    );
    expect(meta.version).toBe(SCHEMA_VERSION);
  });
});

describe("trash lifecycle", () => {
  it("soft-deletes, restores, and deletes forever", async () => {
    const s = makeSession();
    await addSession(s);

    await softDeleteSession(s.id);
    expect((await getSessions()).find((x) => x.id === s.id)?.deletedAt).toBeTypeOf("number");

    await restoreDeletedSession(s.id);
    expect((await getSessions()).find((x) => x.id === s.id)?.deletedAt).toBeUndefined();

    await deleteSessionForever(s.id);
    expect(await getSessions()).toHaveLength(0);
  });

  it("moves a session to trash when its last tab is removed", async () => {
    const tabId = crypto.randomUUID();
    const s = makeSession({ tabs: [{ id: tabId, url: "https://a.com", title: "A", favicon: "", capturedAt: 0 }] });
    await addSession(s);
    await removeTabFromSession(s.id, tabId);
    const found = (await getSessions()).find((x) => x.id === s.id);
    expect(found?.tabs).toHaveLength(0);
    expect(found?.deletedAt).toBeTypeOf("number");
  });

  it("empties trash but keeps active sessions", async () => {
    const active = makeSession({ name: "Active" });
    const trashed = makeSession({ name: "Trashed", deletedAt: Date.now() });
    await addSession(active);
    await addSession(trashed);
    await emptyTrash();
    const sessions = await getSessions();
    expect(sessions.map((s) => s.name)).toEqual(["Active"]);
  });
});

describe("expired trash", () => {
  it("hides expired trash on read and purges it from storage", async () => {
    const expired = makeSession({ name: "Old", deletedAt: Date.now() - TRASH_RETENTION_MS - 1000 });
    const fresh = makeSession({ name: "Recent", deletedAt: Date.now() });
    await addSession(expired);
    await addSession(fresh);

    // Read filters it out, but it is still on disk until purged.
    expect((await getSessions()).map((s) => s.name).sort()).toEqual(["Recent"]);
    expect(await readRaw()).toHaveLength(2);

    const purged = await purgeExpiredTrash();
    expect(purged).toBe(1);
    expect(await readRaw()).toHaveLength(1);
  });
});

describe("rename", () => {
  it("renames and ignores blank names", async () => {
    const s = makeSession({ name: "Before" });
    await addSession(s);
    await updateSessionName(s.id, "  After  ");
    expect((await getSessions())[0].name).toBe("After");
    await updateSessionName(s.id, "   ");
    expect((await getSessions())[0].name).toBe("After");
  });
});

describe("normalization", () => {
  it("drops malformed tabs but keeps empty (manually-created) groups", () => {
    const cleaned = normalizeSessions([
      { id: "ok", name: "Good", createdAt: 1, tabs: [{ url: "https://a.com", title: "A" }, { url: "chrome://x" }, { foo: 1 }] },
      { id: "empty", name: "Empty", createdAt: 1, tabs: [{ url: "chrome://internal" }] },
      "garbage",
      null,
    ]);
    // "ok" keeps its one valid tab; "empty" survives as a 0-tab group — the user
    // may have created it empty to fill later. Only garbage/null are discarded.
    expect(cleaned.map((s) => s.id)).toEqual(["ok", "empty"]);
    expect(cleaned[0].tabs.map((t) => t.url)).toEqual(["https://a.com"]);
    expect(cleaned[1].tabs).toHaveLength(0);
  });

  it("coerces missing fields and mints tab ids", () => {
    const [s] = normalizeSessions([{ id: "s1", tabs: [{ url: "https://a.com" }] }]);
    expect(s.id).toBe("s1");
    expect(s.name).toBeTypeOf("string");
    expect(s.name.length).toBeGreaterThan(0);
    expect(s.tabs[0].id).toBeTypeOf("string");
    expect(s.tabs[0].id.length).toBeGreaterThan(0);
  });
});

describe("moveTab", () => {
  function tab(id: string) {
    return { id, url: `https://${id}.com`, title: id, favicon: "", capturedAt: 0 };
  }

  it("moves a tab from one session to another", async () => {
    const from = makeSession({ id: "from", tabs: [tab("a"), tab("b")] });
    const to = makeSession({ id: "to", tabs: [tab("c")] });
    await addSession(from);
    await addSession(to);

    await moveTab("from", "to", "a");

    const sessions = await getSessions();
    expect(sessions.find((s) => s.id === "from")?.tabs.map((t) => t.id)).toEqual(["b"]);
    expect(sessions.find((s) => s.id === "to")?.tabs.map((t) => t.id)).toEqual(["c", "a"]);
  });

  it("trashes the source when its last tab leaves", async () => {
    const from = makeSession({ id: "from", tabs: [tab("only")] });
    const to = makeSession({ id: "to", tabs: [tab("c")] });
    await addSession(from);
    await addSession(to);

    await moveTab("from", "to", "only");

    const found = (await getSessions()).find((s) => s.id === "from");
    expect(found?.tabs).toHaveLength(0);
    expect(found?.deletedAt).toBeTypeOf("number");
  });

  it("is a no-op for same-group or missing tab, with no duplication", async () => {
    const from = makeSession({ id: "from", tabs: [tab("a")] });
    const to = makeSession({ id: "to", tabs: [tab("c")] });
    await addSession(from);
    await addSession(to);

    await moveTab("from", "from", "a"); // same group
    await moveTab("from", "to", "nope"); // missing tab

    const sessions = await getSessions();
    expect(sessions.find((s) => s.id === "from")?.tabs.map((t) => t.id)).toEqual(["a"]);
    expect(sessions.find((s) => s.id === "to")?.tabs.map((t) => t.id)).toEqual(["c"]);
  });
});

describe("import (addSessions)", () => {
  it("adds new sessions and skips duplicate ids", async () => {
    const a = makeSession({ id: "dup" });
    await addSession(a);
    const added = await addSessions([makeSession({ id: "dup" }), makeSession({ id: "new" })]);
    expect(added).toBe(1);
    expect(await getSessions()).toHaveLength(2);
  });
});

describe("serialized writes", () => {
  it("does not lose updates under concurrent mutations", async () => {
    await Promise.all([
      addSession(makeSession({ id: "1" })),
      addSession(makeSession({ id: "2" })),
      addSession(makeSession({ id: "3" })),
      addSession(makeSession({ id: "4" })),
      addSession(makeSession({ id: "5" })),
    ]);
    expect(await getSessions()).toHaveLength(5);
  });
});
