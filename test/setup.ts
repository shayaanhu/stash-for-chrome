import { beforeEach, vi } from "vitest";

/**
 * Minimal in-memory chrome.storage.local + chrome.runtime mock, enough to
 * exercise the storage layer. Reset before every test.
 */
type Listener = (changes: unknown, area: string) => void;

let store: Record<string, unknown> = {};
const listeners = new Set<Listener>();

const chromeMock = {
  runtime: { lastError: undefined as { message: string } | undefined },
  storage: {
    local: {
      get: (keys: string[] | string, cb: (items: Record<string, unknown>) => void) => {
        const list = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of list) {
          if (key in store) result[key] = structuredClone(store[key]);
        }
        cb(result);
      },
      set: (items: Record<string, unknown>, cb: () => void) => {
        store = { ...store, ...structuredClone(items) };
        cb();
        for (const listener of listeners) listener(items, "local");
      },
    },
    onChanged: {
      addListener: (fn: Listener) => listeners.add(fn),
      removeListener: (fn: Listener) => listeners.delete(fn),
    },
  },
};

// @ts-expect-error - assigning a partial chrome mock to the global for tests
globalThis.chrome = chromeMock;

export function resetStorage() {
  store = {};
  listeners.clear();
  chromeMock.runtime.lastError = undefined;
}

beforeEach(() => {
  resetStorage();
  vi.restoreAllMocks();
});
