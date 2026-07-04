/**
 * Local full-text content store for stashed tabs — the first slice of the
 * "second brain" vision (see BIGPIC.md). When a tab is stashed we capture its
 * readable text and keep it here, keyed by the StashTab id, so search can match
 * what was INSIDE a page, not just its title or URL.
 *
 * Lives in IndexedDB (shared across the extension's popup and service worker,
 * same origin) rather than chrome.storage.local, which is a small JSON KV store
 * unsuited to large text. With the `unlimitedStorage` permission this scales to
 * disk. A proper inverted index (FlexSearch, then SQLite FTS5) comes later; for
 * now search is a linear scan, which is fine at this corpus size.
 */

export type PageContent = {
  /** Matches the StashTab id it was captured for. */
  id: string;
  url: string;
  title: string;
  /** Extracted visible text of the page (capped) — what search matches against. */
  text: string;
  /** Cleaned readable HTML of the main content — the offline "saved copy". */
  html?: string;
  capturedAt: number;
};

const DB_NAME = "stash-content";
const DB_VERSION = 1;
const STORE = "pages";

/** Cap stored text so a single monster page can't blow up the store. */
export const MAX_CONTENT_CHARS = 200_000;
/** Cap the readable HTML snapshot separately (markup is heavier than text). */
export const MAX_SNAPSHOT_CHARS = 600_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open content store."));
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Store (or replace) the captured content for one stashed tab. */
export async function putPageContent(content: PageContent): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, "readwrite").put(content);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Load one captured page by its StashTab id (used by the reader). */
export async function getPageContent(id: string): Promise<PageContent | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").get(id);
    req.onsuccess = () => resolve((req.result as PageContent | undefined) ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Lean projection the popup searches over — text only, no heavy HTML snapshot. */
export type SearchDoc = { id: string; text: string; hasSnapshot: boolean };

/**
 * Load the search index: id + text + a has-snapshot flag for every captured
 * page. Uses a cursor and copies only these fields so the (potentially huge)
 * HTML snapshots are read transiently and never retained in the popup — the
 * snapshot itself is fetched lazily by the reader via getPageContent().
 */
export async function getSearchDocs(): Promise<SearchDoc[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const docs: SearchDoc[] = [];
    const req = tx(db, "readonly").openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(docs);
        return;
      }
      const value = cursor.value as PageContent;
      docs.push({ id: value.id, text: value.text, hasSnapshot: Boolean(value.html) });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Load every captured page in full (includes HTML). Prefer getSearchDocs for search. */
export async function getAllPageContent(): Promise<PageContent[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").getAll();
    req.onsuccess = () => resolve((req.result as PageContent[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** All stored content ids (keys only — cheap). Used to reconcile orphans. */
export async function getAllContentIds(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").getAllKeys();
    req.onsuccess = () => resolve((req.result as string[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Drop captured content for tabs that no longer exist (best-effort cleanup). */
export async function deletePageContent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const store = tx(db, "readwrite");
    for (const id of ids) store.delete(id);
    store.transaction.oncomplete = () => resolve();
    store.transaction.onerror = () => reject(store.transaction.error);
  });
}
