import type { RestoreSummary, SaveTarget, StashSession, StashSettings } from "./types";

export type BackgroundRequest =
  | { type: "SAVE_TABS"; target: SaveTarget }
  | { type: "SAVE_CURRENT_TAB"; tabId?: number }
  | { type: "RESTORE_SESSION"; sessionId: string }
  | { type: "RESTORE_TAB"; url: string }
  | { type: "RENAME_SESSION"; sessionId: string; name: string }
  | { type: "SOFT_DELETE_SESSION"; sessionId: string }
  | { type: "RESTORE_DELETED_SESSION"; sessionId: string }
  | { type: "DELETE_FOREVER"; sessionId: string }
  | { type: "EMPTY_TRASH" }
  | { type: "REMOVE_TAB"; sessionId: string; tabId: string }
  | { type: "MOVE_TAB"; fromSessionId: string; toSessionId: string; tabId: string }
  | { type: "CREATE_GROUP_FROM_TAB"; fromSessionId: string; tabId: string; newSession: StashSession; order: string[] }
  | { type: "ADD_SESSIONS"; sessions: StashSession[] }
  | { type: "UNDO_RESTORE_SESSION"; sessions: StashSession[] }
  | { type: "UPDATE_SETTINGS"; settings: Partial<StashSettings> }
  | { type: "CREATE_EMPTY_SESSION" }
  | { type: "REORDER_SESSIONS"; order: string[] }
  | { type: "ADD_OPEN_TAB_TO_SESSION"; sessionId: string; tabId: number };

export type BackgroundResponse =
  | {
      ok: true;
      /** The primary session a request acted on (saved, removed, renamed, ...). */
      session?: StashSession;
      /** Multiple sessions a request acted on (e.g. emptied trash). */
      sessions?: StashSession[];
      /** Generic count payload (e.g. number of sessions imported). */
      count?: number;
      /** Per-tab outcome of a RESTORE_SESSION request. */
      restore?: RestoreSummary;
      /** Updated settings after an UPDATE_SETTINGS request. */
      settings?: StashSettings;
    }
  | { ok: false; error: string };

export function sendBackgroundRequest(request: BackgroundRequest): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, (response: BackgroundResponse | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve({ ok: false, error: error.message ?? "Could not reach the Stash service worker." });
        return;
      }
      resolve(response ?? { ok: false, error: "No response from Stash." });
    });
  });
}
