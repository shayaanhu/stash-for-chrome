/**
 * Closing tabs is the promise the whole product rests on, so it is the one thing
 * that must not fail quietly.
 *
 * Two hazards this module exists to defuse:
 *
 * 1. `chrome.tabs.remove(ids)` is all-or-nothing. If a single id in the array has
 *    gone stale (the page self-closed, navigated into a crash, or the user closed
 *    it by hand), Chrome sets lastError and NONE of the tabs close. Content capture
 *    runs before closing, which opens a multi-second window for exactly that to
 *    happen. So: try the batch, and if it fails, close them one at a time so one
 *    dead id cannot hold the rest open.
 *
 * 2. Best-effort work (page text capture) must never be able to delay or block the
 *    close. `settleWithin` bounds it: the promise always settles, on time, whether
 *    the work resolved, rejected, or hung forever.
 */

/** Injected so this is testable without a live chrome.tabs. */
export type RemoveTabs = (tabIds: number[]) => Promise<void>;

export type CloseResult = {
  /** Tab ids Chrome accepted a close for. */
  closed: number[];
  /** Tab ids that could not be closed even individually (already gone, usually). */
  failed: number[];
};

/**
 * Close every tab we can, even if some ids are stale.
 *
 * Fast path is a single batched call, which is what Chrome is happiest with. Only
 * when that fails do we pay for the per-tab loop, so the common case costs nothing.
 */
export async function closeTabsResiliently(
  tabIds: number[],
  removeTabs: RemoveTabs,
): Promise<CloseResult> {
  if (tabIds.length === 0) return { closed: [], failed: [] };

  try {
    await removeTabs(tabIds);
    return { closed: [...tabIds], failed: [] };
  } catch {
    // The batch was poisoned by at least one bad id. Retry individually so the
    // healthy tabs still close -- the user asked for a clear window, and getting
    // most of the way there beats leaving everything open.
    const closed: number[] = [];
    const failed: number[] = [];
    for (const tabId of tabIds) {
      try {
        await removeTabs([tabId]);
        closed.push(tabId);
      } catch {
        failed.push(tabId);
      }
    }
    return { closed, failed };
  }
}

/**
 * Resolve with the work's value if it settles within `ms`, otherwise with
 * `fallback`. Never rejects and never outlives the deadline, so a hung caller
 * cannot stall whatever is waiting on it.
 *
 * The underlying work is not cancelled; it is simply no longer waited on. For
 * page capture that is exactly right, since a late capture still lands usefully.
 */
export function settleWithin<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const finish = (value: T) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), ms);
    work.then(
      (value) => finish(value),
      () => finish(fallback),
    );
  });
}
