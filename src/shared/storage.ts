import type { SaveTarget, StashSession, StashSettings, StashTab } from "./types";

const SESSIONS_KEY = "stash.sessions";
const SETTINGS_KEY = "stash.settings";
const META_KEY = "stash.meta";
const SESSION_ORDER_KEY = "stash.session-order";

/** Bump when the stored shape changes; add a matching entry to `migrations`. */
export const SCHEMA_VERSION = 1;

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Oversized data-URI favicons bloat storage; keep the letter fallback instead. */
const MAX_FAVICON_LENGTH = 2048;

const SAVABLE_PROTOCOLS = ["http:", "https:", "file:"];

export const defaultSettings: StashSettings = {
  saveTarget: "current-window",
  restoreInNewWindow: false,
};

type StoredMeta = { version: number };

// ── Low-level chrome.storage access ──────────────────────────────────────────
function getRaw(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(items ?? {});
    });
  });
}

function setRaw(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        // Most often QUOTA_BYTES — surface a friendly message to the toast layer.
        reject(new Error(error.message ?? "Could not save. Storage may be full."));
        return;
      }
      resolve();
    });
  });
}

// ── Validation / normalization ───────────────────────────────────────────────
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavableUrl(url: string): boolean {
  try {
    return SAVABLE_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function normalizeFavicon(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (value.startsWith("data:") && value.length > MAX_FAVICON_LENGTH) return "";
  return value;
}

function normalizeTab(raw: unknown): StashTab | null {
  if (!isPlainObject(raw)) return null;
  const url = typeof raw.url === "string" ? raw.url : "";
  if (!isSavableUrl(url)) return null;

  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title : url;
  const capturedAt = typeof raw.capturedAt === "number" ? raw.capturedAt : Date.now();
  const id = typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID();

  return { id, url, title, favicon: normalizeFavicon(raw.favicon), capturedAt };
}

function normalizeSession(raw: unknown): StashSession | null {
  if (!isPlainObject(raw)) return null;

  const tabs = Array.isArray(raw.tabs)
    ? raw.tabs.map(normalizeTab).filter((tab): tab is StashTab => tab !== null)
    : [];

  const deletedAt = typeof raw.deletedAt === "number" ? raw.deletedAt : undefined;
  const manuallyCreated = raw.manuallyCreated === true;

  // Only discard sessions that have no valid id — empty-tab sessions are kept
  // because the user may have moved all tabs out intentionally.
  if (typeof raw.id !== "string" || !raw.id) return null;

  const id = typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID();
  const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : Date.now();
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name : "Saved tabs";

  const session: StashSession = { id, name, createdAt, tabs };
  if (deletedAt !== undefined) session.deletedAt = deletedAt;
  if (manuallyCreated) session.manuallyCreated = true;
  if (Array.isArray(raw.tags)) session.tags = raw.tags.filter((t): t is string => typeof t === "string");
  return session;
}

export function normalizeSessions(raw: unknown): StashSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeSession).filter((s): s is StashSession => s !== null);
}

// ── Migrations ───────────────────────────────────────────────────────────────
/** version N migrates data produced by version N-1. Index 0 is the v0→v1 step. */
const migrations: Array<(sessions: StashSession[]) => StashSession[]> = [
  (sessions) => sessions, // v0 → v1: normalization above is sufficient
];

function runMigrations(sessions: StashSession[], fromVersion: number): StashSession[] {
  let next = sessions;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    next = migrations[v]?.(next) ?? next;
  }
  return next;
}

// ── State load / persist (the single read + write funnel) ─────────────────────
async function loadState(): Promise<StashSession[]> {
  const items = await getRaw([SESSIONS_KEY, META_KEY]);
  const version = (items[META_KEY] as StoredMeta | undefined)?.version ?? 0;
  const normalized = normalizeSessions(items[SESSIONS_KEY]);
  return version < SCHEMA_VERSION ? runMigrations(normalized, version) : normalized;
}

async function persistState(sessions: StashSession[]): Promise<void> {
  await setRaw({ [SESSIONS_KEY]: sessions, [META_KEY]: { version: SCHEMA_VERSION } satisfies StoredMeta });
}

/**
 * Serialized read-modify-write. Concurrent calls chain off one another so a
 * mutation always sees the previous one's result — no lost updates. Intended to
 * run in a single writer context (the background service worker).
 */
let writeChain: Promise<unknown> = Promise.resolve();
function mutate<T>(mutator: (sessions: StashSession[]) => { next: StashSession[]; result: T }): Promise<T> {
  const run = writeChain.then(async () => {
    const current = await loadState();
    const { next, result } = mutator(current);
    await persistState(next);
    return result;
  });
  // Keep the chain alive even if this link rejects, so later writes still run.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isExpiredTrash(session: StashSession, now: number) {
  return Boolean(session.deletedAt && now - session.deletedAt > TRASH_RETENTION_MS);
}

/**
 * A group that loses its last tab is sent to trash (recoverable for 30 days)
 * rather than left as an empty "·0" shell in the active list. Manually-created
 * empty groups never reach here — they have no tab to remove — so they're kept
 * until the user fills or explicitly deletes them.
 */
function trashIfEmpty(session: StashSession, now: number): StashSession {
  if (session.tabs.length === 0 && !session.deletedAt) {
    return { ...session, deletedAt: now };
  }
  return session;
}

// ── Reads (safe to call from any context) ─────────────────────────────────────
/** Pure read. Filters expired trash in memory; the actual purge is alarm-driven. */
export async function getSessions(): Promise<StashSession[]> {
  const sessions = await loadState();
  const now = Date.now();
  return sessions.filter((session) => !isExpiredTrash(session, now));
}

// ── Mutations (route through the background SW in production) ──────────────────
export function saveSessions(sessions: StashSession[]): Promise<void> {
  return mutate(() => ({ next: normalizeSessions(sessions), result: undefined }));
}

export function addSession(session: StashSession): Promise<StashSession> {
  return mutate((sessions) => ({ next: [session, ...sessions], result: session }));
}

export function addSessions(incoming: StashSession[]): Promise<number> {
  return mutate((sessions) => {
    const existingIds = new Set(sessions.map((s) => s.id));
    const fresh = normalizeSessions(incoming).filter((s) => !existingIds.has(s.id));
    return { next: [...fresh, ...sessions], result: fresh.length };
  });
}

export function updateSessionName(sessionId: string, name: string): Promise<StashSession | undefined> {
  const trimmed = name.trim();
  return mutate((sessions) => {
    if (!trimmed) return { next: sessions, result: sessions.find((s) => s.id === sessionId) };
    const next = sessions.map((s) => (s.id === sessionId ? { ...s, name: trimmed } : s));
    return { next, result: next.find((s) => s.id === sessionId) };
  });
}

export function removeTabFromSession(sessionId: string, tabId: string): Promise<StashSession | undefined> {
  const now = Date.now();
  return mutate((sessions) => {
    const next = sessions.map((session) => {
      if (session.id !== sessionId) return session;
      const tabs = session.tabs.filter((tab) => tab.id !== tabId);
      return trashIfEmpty({ ...session, tabs }, now);
    });
    return { next, result: next.find((s) => s.id === sessionId) };
  });
}

/** Move a tab from one session to another. Emptying the source trashes it (same
 *  rule as removeTabFromSession). No-op if the tab/source is missing or same group. */
export function moveTab(
  fromSessionId: string,
  toSessionId: string,
  tabId: string,
): Promise<{ from?: StashSession; to?: StashSession }> {
  const now = Date.now();
  return mutate<{ from?: StashSession; to?: StashSession }>((sessions) => {
    const source = sessions.find((s) => s.id === fromSessionId);
    const tab = source?.tabs.find((t) => t.id === tabId);
    if (!source || !tab || fromSessionId === toSessionId) {
      return { next: sessions, result: {} };
    }

    const next = sessions.map((session) => {
      if (session.id === fromSessionId) {
        const tabs = session.tabs.filter((t) => t.id !== tabId);
        return trashIfEmpty({ ...session, tabs }, now);
      }
      if (session.id === toSessionId) {
        if (session.tabs.some((t) => t.id === tabId)) return session; // guard against dup
        return { ...session, tabs: [...session.tabs, tab] };
      }
      return session;
    });

    return {
      next,
      result: { from: next.find((s) => s.id === fromSessionId), to: next.find((s) => s.id === toSessionId) },
    };
  });
}

/**
 * Pull a tab out of its group into a brand-new group placed right after the
 * source. Writes sessions, meta, and the display order in a SINGLE storage set
 * so the UI never observes an intermediate state (e.g. the tab momentarily
 * snapping back to the source group). `order` is the desired active-session
 * display order, already reflecting the new group's position.
 */
export function createGroupFromTab(
  fromSessionId: string,
  tabId: string,
  newSession: StashSession,
  order: string[],
): Promise<StashSession | undefined> {
  const run = writeChain.then(async () => {
    const current = await loadState();
    const source = current.find((s) => s.id === fromSessionId);
    const tab = source?.tabs.find((t) => t.id === tabId);
    if (!source || !tab) return undefined;

    const withoutTab = current.map((s) =>
      s.id === fromSessionId
        ? trashIfEmpty({ ...s, tabs: s.tabs.filter((t) => t.id !== tabId) }, Date.now())
        : s,
    );
    const idx = withoutTab.findIndex((s) => s.id === fromSessionId);
    const created: StashSession = { ...newSession, tabs: [tab] };
    const next =
      idx === -1
        ? [created, ...withoutTab]
        : [...withoutTab.slice(0, idx + 1), created, ...withoutTab.slice(idx + 1)];

    await setRaw({
      [SESSIONS_KEY]: next,
      [META_KEY]: { version: SCHEMA_VERSION } satisfies StoredMeta,
      [SESSION_ORDER_KEY]: order,
    });
    return created;
  });
  // Keep the chain alive even if this link rejects, so later writes still run.
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

export function addTabToSession(sessionId: string, tab: StashTab): Promise<StashSession | undefined> {
  return mutate((sessions) => {
    const next = sessions.map((s) => {
      if (s.id !== sessionId) return s;
      if (s.tabs.some((t) => t.url === tab.url)) return s; // dedup by URL
      return { ...s, tabs: [...s.tabs, tab] };
    });
    return { next, result: next.find((s) => s.id === sessionId) };
  });
}

export function softDeleteSession(sessionId: string): Promise<StashSession | undefined> {
  const now = Date.now();
  return mutate((sessions) => {
    const next = sessions.map((s) => (s.id === sessionId ? { ...s, deletedAt: now } : s));
    return { next, result: next.find((s) => s.id === sessionId) };
  });
}

export function restoreDeletedSession(sessionId: string): Promise<StashSession | undefined> {
  return mutate((sessions) => {
    const next = sessions.map((session) => {
      if (session.id !== sessionId) return session;
      const { deletedAt: _deletedAt, ...restored } = session;
      return restored;
    });
    return { next, result: next.find((s) => s.id === sessionId) };
  });
}

export function deleteSessionForever(sessionId: string): Promise<StashSession | undefined> {
  return mutate((sessions) => {
    const removed = sessions.find((s) => s.id === sessionId);
    return { next: sessions.filter((s) => s.id !== sessionId), result: removed };
  });
}

export function emptyTrash(): Promise<StashSession[]> {
  return mutate((sessions) => {
    const removed = sessions.filter((s) => s.deletedAt);
    return { next: sessions.filter((s) => !s.deletedAt), result: removed };
  });
}

/** Permanently drop trash whose retention window has elapsed. Alarm-driven. */
export function purgeExpiredTrash(): Promise<number> {
  const now = Date.now();
  return mutate((sessions) => {
    const next = sessions.filter((s) => !isExpiredTrash(s, now));
    return { next, result: sessions.length - next.length };
  });
}

// ── Session order ─────────────────────────────────────────────────────────────
export async function getSessionOrder(): Promise<string[]> {
  const items = await getRaw([SESSION_ORDER_KEY]);
  const order = items[SESSION_ORDER_KEY];
  return Array.isArray(order) ? order.filter((id): id is string => typeof id === "string") : [];
}

export async function setSessionOrder(ids: string[]): Promise<void> {
  await setRaw({ [SESSION_ORDER_KEY]: ids });
}

// ── Settings ──────────────────────────────────────────────────────────────────
export async function getSettings(): Promise<StashSettings> {
  const items = await getRaw([SETTINGS_KEY]);
  const stored = isPlainObject(items[SETTINGS_KEY]) ? items[SETTINGS_KEY] : {};
  return { ...defaultSettings, ...stored };
}

export async function updateSettings(settings: Partial<StashSettings>): Promise<StashSettings> {
  const current = await getSettings();
  const next: StashSettings = {
    ...current,
    ...settings,
    saveTarget: (settings.saveTarget ?? current.saveTarget) as SaveTarget,
  };
  await setRaw({ [SETTINGS_KEY]: next });
  return next;
}

/** Seed the schema-version marker on install so future migrations have a baseline. */
export async function ensureMeta(): Promise<void> {
  const items = await getRaw([META_KEY]);
  if (!isPlainObject(items[META_KEY])) {
    await setRaw({ [META_KEY]: { version: SCHEMA_VERSION } satisfies StoredMeta });
  }
}
