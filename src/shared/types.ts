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
};
