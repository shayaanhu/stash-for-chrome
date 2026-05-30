import type { SaveTarget, StashSession } from "./types";

export type BackgroundRequest =
  | {
      type: "SAVE_TABS";
      target: SaveTarget;
    }
  | {
      type: "SAVE_CURRENT_TAB";
      tabId?: number;
    };

export type BackgroundResponse =
  | {
      ok: true;
      session: StashSession;
    }
  | {
      ok: false;
      error: string;
    };

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
