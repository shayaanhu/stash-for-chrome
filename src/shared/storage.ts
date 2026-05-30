import type { SaveTarget, StashSession, StashSettings } from "./types";

const SESSIONS_KEY = "stash.sessions";
const SETTINGS_KEY = "stash.settings";

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const defaultSettings: StashSettings = {
  saveTarget: "current-window",
  compactMode: false
};

type StorageShape = {
  [SESSIONS_KEY]?: StashSession[];
  [SETTINGS_KEY]?: Partial<StashSettings>;
};

function getFromStorage(keys: string[]): Promise<StorageShape> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (items) => {
      resolve(items as StorageShape);
    });
  });
}

function setInStorage(items: StorageShape): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function isExpiredTrashSession(session: StashSession, now = Date.now()) {
  return Boolean(session.deletedAt && now - session.deletedAt > TRASH_RETENTION_MS);
}

export async function getSessions() {
  const items = await getFromStorage([SESSIONS_KEY]);
  const sessions = items[SESSIONS_KEY] ?? [];
  const activeSessions = sessions.filter((session) => !isExpiredTrashSession(session));

  if (activeSessions.length !== sessions.length) {
    await saveSessions(activeSessions);
  }

  return activeSessions;
}

export async function saveSessions(sessions: StashSession[]) {
  await setInStorage({ [SESSIONS_KEY]: sessions });
}

export async function addSession(session: StashSession) {
  const sessions = await getSessions();
  await saveSessions([session, ...sessions]);
  return session;
}

export async function updateSessionName(sessionId: string, name: string) {
  const sessions = await getSessions();
  const trimmedName = name.trim();

  if (!trimmedName) {
    return sessions.find((session) => session.id === sessionId);
  }

  const updatedSessions = sessions.map((session) =>
    session.id === sessionId ? { ...session, name: trimmedName } : session
  );

  await saveSessions(updatedSessions);
  return updatedSessions.find((session) => session.id === sessionId);
}

export async function removeTabFromSession(sessionId: string, tabId: string) {
  const sessions = await getSessions();
  const now = Date.now();
  const updatedSessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    const tabs = session.tabs.filter((tab) => tab.id !== tabId);

    if (tabs.length === 0) {
      return { ...session, tabs, deletedAt: now };
    }

    return { ...session, tabs };
  });

  await saveSessions(updatedSessions);
  return updatedSessions.find((session) => session.id === sessionId);
}

export async function softDeleteSession(sessionId: string) {
  const sessions = await getSessions();
  const now = Date.now();
  const updatedSessions = sessions.map((session) =>
    session.id === sessionId ? { ...session, deletedAt: now } : session
  );

  await saveSessions(updatedSessions);
  return updatedSessions.find((session) => session.id === sessionId);
}

export async function restoreDeletedSession(sessionId: string) {
  const sessions = await getSessions();
  const updatedSessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    const { deletedAt, ...restoredSession } = session;
    return restoredSession;
  });

  await saveSessions(updatedSessions);
  return updatedSessions.find((session) => session.id === sessionId);
}

export async function deleteSessionForever(sessionId: string) {
  const sessions = await getSessions();
  await saveSessions(sessions.filter((session) => session.id !== sessionId));
}

export async function emptyTrash() {
  const sessions = await getSessions();
  await saveSessions(sessions.filter((session) => !session.deletedAt));
}

export async function getSettings(): Promise<StashSettings> {
  const items = await getFromStorage([SETTINGS_KEY]);
  return {
    ...defaultSettings,
    ...(items[SETTINGS_KEY] ?? {})
  };
}

export async function updateSettings(settings: Partial<StashSettings>) {
  const currentSettings = await getSettings();
  const nextSettings: StashSettings = {
    ...currentSettings,
    ...settings,
    saveTarget: (settings.saveTarget ?? currentSettings.saveTarget) as SaveTarget
  };

  await setInStorage({ [SETTINGS_KEY]: nextSettings });
  return nextSettings;
}
