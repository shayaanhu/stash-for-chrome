export type SaveTarget = "current-window" | "all-windows";

export type SessionSort = "manual" | "date-desc" | "date-asc" | "name-asc" | "size-desc";

export type StashSettings = {
  saveTarget: SaveTarget;
  restoreInNewWindow: boolean;
  /** When false (default), clicking empty space clears the current selection. */
  stickySelection: boolean;
  /** Remembered choice in the Stash sheet: close the tabs after stashing them. */
  closeAfterStash: boolean;
  /** Sort order for the stash list. "manual" means user drag order. */
  sessionSort: SessionSort;
  /** Whether to auto-snapshot the current window every 5 minutes. */
  autoSave: boolean;
};

export type StashTab = {
  id: string;
  url: string;
  title: string;
  favicon: string;
  capturedAt: number;
};

export type StashSession = {
  id: string;
  name: string;
  createdAt: number;
  tabs: StashTab[];
  tags?: string[];
  archived?: boolean;
  deletedAt?: number;
  manuallyCreated?: boolean;
  /** Created automatically by the auto-save alarm, not by the user. */
  autoSaved?: boolean;
  autoSaveKind?: "interval" | "daily";
};

/** Outcome of a restore: how many tabs opened, how many failed, and why. */
export type RestoreSummary = {
  opened: number;
  failed: number;
  /** A failure was a local file:// tab and file access is off (a fixable cause). */
  needsFileAccess: boolean;
};
