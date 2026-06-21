export type SaveTarget = "current-window" | "all-windows";

export type StashSettings = {
  saveTarget: SaveTarget;
  compactMode: boolean;
  restoreInNewWindow: boolean;
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
};

/** Outcome of a restore: how many tabs opened, how many failed, and why. */
export type RestoreSummary = {
  opened: number;
  failed: number;
  /** A failure was a local file:// tab and file access is off (a fixable cause). */
  needsFileAccess: boolean;
};
