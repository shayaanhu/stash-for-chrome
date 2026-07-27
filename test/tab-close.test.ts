import { describe, expect, it, vi } from "vitest";
import { closeTabsResiliently, settleWithin } from "../src/shared/tab-close";

/**
 * Fake chrome.tabs.remove: rejects for the whole call if ANY requested id is in
 * `deadIds`, which is exactly how the real API behaves.
 */
function fakeRemove(deadIds: number[] = []) {
  const closed: number[] = [];
  const dead = new Set(deadIds);
  const remove = vi.fn(async (tabIds: number[]) => {
    if (tabIds.some((id) => dead.has(id))) {
      throw new Error("No tab with id.");
    }
    closed.push(...tabIds);
  });
  return { remove, closed };
}

describe("closeTabsResiliently", () => {
  it("closes everything in one batched call when no ids are stale", async () => {
    const { remove, closed } = fakeRemove();

    const result = await closeTabsResiliently([1, 2, 3], remove);

    expect(result).toEqual({ closed: [1, 2, 3], failed: [] });
    expect(closed).toEqual([1, 2, 3]);
    // The happy path must not pay for the per-tab fallback.
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([1, 2, 3]);
  });

  // The regression this module exists for: one dead tab used to leave every other
  // tab open, because chrome.tabs.remove is all-or-nothing on a batch.
  it("still closes the healthy tabs when one id is already gone", async () => {
    const { remove, closed } = fakeRemove([2]);

    const result = await closeTabsResiliently([1, 2, 3], remove);

    expect(closed).toEqual([1, 3]);
    expect(result.closed).toEqual([1, 3]);
    expect(result.failed).toEqual([2]);
  });

  it("reports every id as failed when they are all gone", async () => {
    const { remove, closed } = fakeRemove([1, 2]);

    const result = await closeTabsResiliently([1, 2], remove);

    expect(closed).toEqual([]);
    expect(result.closed).toEqual([]);
    expect(result.failed).toEqual([1, 2]);
  });

  it("does nothing, and calls nothing, for an empty list", async () => {
    const { remove } = fakeRemove();

    const result = await closeTabsResiliently([], remove);

    expect(result).toEqual({ closed: [], failed: [] });
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("settleWithin", () => {
  it("passes through a value that arrives in time", async () => {
    await expect(settleWithin(Promise.resolve("captured"), 50, "gave up")).resolves.toBe("captured");
  });

  it("falls back instead of rejecting when the work fails", async () => {
    await expect(settleWithin(Promise.reject(new Error("no access")), 50, "gave up")).resolves.toBe(
      "gave up",
    );
  });

  // The bug: a page with a blocked main thread leaves executeScript pending
  // forever, so anything awaiting it waits forever too.
  it("falls back on the deadline when the work never settles", async () => {
    const neverSettles = new Promise<string>(() => {});

    await expect(settleWithin(neverSettles, 20, "gave up")).resolves.toBe("gave up");
  });

  it("resolves once, keeping the first outcome, even if the work settles later", async () => {
    let resolveLate: (value: string) => void = () => {};
    const late = new Promise<string>((resolve) => {
      resolveLate = resolve;
    });

    const settled = settleWithin(late, 20, "gave up");
    await expect(settled).resolves.toBe("gave up");

    resolveLate("captured");
    await expect(settled).resolves.toBe("gave up");
  });
});
