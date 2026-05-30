import {
  ArchiveRestore,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  PanelTopClose,
  Pencil,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendBackgroundRequest } from "../shared/messages";
import {
  deleteSessionForever,
  emptyTrash,
  getSessions,
  getSettings,
  removeTabFromSession,
  restoreDeletedSession,
  softDeleteSession,
  updateSessionName
} from "../shared/storage";
import { matchesSession, sortSessionsNewestFirst } from "../shared/session-utils";
import type { SaveTarget, StashSession, StashTab } from "../shared/types";

type ViewMode = "library" | "trash";

type ToastState = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function PopupApp() {
  const [sessions, setSessions] = useState<StashSession[]>([]);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>("current-window");
  const [compactMode, setCompactMode] = useState(false);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("library");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const [nextSessions, nextSettings] = await Promise.all([getSessions(), getSettings()]);
    setSessions(sortSessionsNewestFirst(nextSessions));
    setSaveTarget(nextSettings.saveTarget);
    setCompactMode(nextSettings.compactMode);
  }, []);

  useEffect(() => {
    void reload();

    const handleStorageChange = () => {
      void reload();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [reload]);

  const visibleSessions = useMemo(() => {
    const isTrash = viewMode === "trash";

    return sessions
      .filter((session) => (isTrash ? Boolean(session.deletedAt) : !session.deletedAt))
      .filter((session) => matchesSession(session, query));
  }, [query, sessions, viewMode]);

  const activeCount = sessions.filter((session) => !session.deletedAt).length;
  const trashCount = sessions.filter((session) => session.deletedAt).length;

  async function handleSaveTabs() {
    setIsSaving(true);
    setStatus(null);

    const response = await sendBackgroundRequest({
      type: "SAVE_TABS",
      target: saveTarget
    });

    setIsSaving(false);

    if (!response.ok) {
      setStatus(response.error);
      return;
    }

    await reload();
    setExpandedIds((current) => new Set(current).add(response.session.id));
    showToast(`Saved ${response.session.tabs.length} ${response.session.tabs.length === 1 ? "tab" : "tabs"}.`);
  }

  async function handleRestoreAll(session: StashSession) {
    if (session.tabs.length === 0) {
      return;
    }

    await createWindow(session.tabs.map((tab) => tab.url));
  }

  async function handleRestoreTab(tab: StashTab) {
    await createTab(tab.url);
  }

  async function handleDeleteSession(session: StashSession) {
    await softDeleteSession(session.id);
    await reload();
    showToast("Moved to trash.", "Undo", async () => {
      await restoreDeletedSession(session.id);
      await reload();
    });
  }

  async function handleDeleteForever(sessionId: string) {
    await deleteSessionForever(sessionId);
    await reload();
    showToast("Deleted forever.");
  }

  async function handleEmptyTrash() {
    await emptyTrash();
    await reload();
    showToast("Trash emptied.");
  }

  async function handleRemoveTab(sessionId: string, tabId: string) {
    await removeTabFromSession(sessionId, tabId);
    await reload();
  }

  function toggleExpanded(sessionId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }

      return next;
    });
  }

  function startRename(session: StashSession) {
    setEditingId(session.id);
    setDraftName(session.name);
  }

  async function submitRename(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!editingId) {
      return;
    }

    await updateSessionName(editingId, draftName);
    setEditingId(null);
    setDraftName("");
    await reload();
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setEditingId(null);
      setDraftName("");
    }
  }

  function openOptionsPage() {
    chrome.runtime.openOptionsPage();
  }

  function showToast(message: string, actionLabel?: string, onAction?: () => void) {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast({ message, actionLabel, onAction });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5000);
  }

  return (
    <main className={compactMode ? "popup-shell is-compact" : "popup-shell"}>
      <header className="popup-header">
        <div>
          <p className="eyebrow">Stash</p>
          <h1>{viewMode === "trash" ? "Trash" : "Saved sessions"}</h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button"
            title="Settings"
            aria-label="Settings"
            onClick={openOptionsPage}
          >
            <Settings size={16} />
          </button>
          <button type="button" className="primary-button" onClick={handleSaveTabs} disabled={isSaving}>
            <PanelTopClose size={16} />
            {isSaving ? "Saving" : "Save tabs"}
          </button>
        </div>
      </header>

      <div className="search-row">
        <Search size={16} />
        <input
          type="search"
          placeholder="Search sessions, tabs, URLs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
      </div>

      <div className="view-tabs" role="tablist" aria-label="Session views">
        <button
          type="button"
          className={viewMode === "library" ? "active" : ""}
          onClick={() => setViewMode("library")}
        >
          Library
          <span>{activeCount}</span>
        </button>
        <button
          type="button"
          className={viewMode === "trash" ? "active" : ""}
          onClick={() => setViewMode("trash")}
        >
          Trash
          <span>{trashCount}</span>
        </button>
      </div>

      {status ? <p className="status-message">{status}</p> : null}

      {viewMode === "trash" && trashCount > 0 ? (
        <div className="trash-toolbar">
          <span>30-day trash</span>
          <button type="button" className="quiet-button" onClick={handleEmptyTrash}>
            Empty trash
          </button>
        </div>
      ) : null}

      {visibleSessions.length > 0 ? (
        <section className="session-list" aria-label={viewMode === "trash" ? "Deleted sessions" : "Saved sessions"}>
          {visibleSessions.map((session) => {
            const isExpanded = expandedIds.has(session.id);
            const isEditing = editingId === session.id;

            return (
              <article className="session-card" key={session.id}>
                <div className="session-summary">
                  <button
                    type="button"
                    className="session-toggle"
                    aria-label={isExpanded ? "Collapse session" : "Expand session"}
                    onClick={() => toggleExpanded(session.id)}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div className="session-main">
                    {isEditing ? (
                      <form className="rename-form" onSubmit={submitRename}>
                        <input
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          onBlur={() => void submitRename()}
                          autoFocus
                        />
                        <button type="submit" title="Save name" aria-label="Save name">
                          <Check size={15} />
                        </button>
                      </form>
                    ) : (
                      <button type="button" className="session-title-button" onClick={() => toggleExpanded(session.id)}>
                        <span className="session-title">{session.name}</span>
                        <span className="session-meta">
                          {session.tabs.length} {session.tabs.length === 1 ? "tab" : "tabs"} ·{" "}
                          {formatDate(session.createdAt)}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="favicon-strip" aria-hidden="true">
                    {session.tabs.slice(0, 3).map((tab) => (
                      <Favicon key={tab.id} tab={tab} />
                    ))}
                  </div>

                  <div className="session-actions">
                    {viewMode === "trash" ? (
                      <>
                        <button
                          type="button"
                          className="icon-button"
                          title="Restore session"
                          aria-label="Restore session"
                          onClick={async () => {
                            await restoreDeletedSession(session.id);
                            await reload();
                          }}
                        >
                          <Undo2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          title="Delete forever"
                          aria-label="Delete forever"
                          onClick={() => void handleDeleteForever(session.id)}
                        >
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="icon-button"
                          title="Restore all"
                          aria-label="Restore all"
                          onClick={() => void handleRestoreAll(session)}
                        >
                          <ArchiveRestore size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Rename"
                          aria-label="Rename"
                          onClick={() => startRename(session)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          title="Move to trash"
                          aria-label="Move to trash"
                          onClick={() => void handleDeleteSession(session)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <ul className="tab-list">
                    {session.tabs.map((tab) => (
                      <li key={tab.id} className="tab-row">
                        <button type="button" className="tab-link" onClick={() => void handleRestoreTab(tab)}>
                          <Favicon tab={tab} />
                          <span>
                            <span className="tab-title">{tab.title}</span>
                            <span className="tab-url">{formatUrl(tab.url)}</span>
                          </span>
                          <ExternalLink size={14} />
                        </button>
                        {viewMode === "library" ? (
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Delete tab"
                            aria-label="Delete tab"
                            onClick={() => void handleRemoveTab(session.id, tab.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState viewMode={viewMode} query={query} onSave={handleSaveTabs} isSaving={isSaving} />
      )}

      {toast ? (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.onAction && toast.actionLabel ? (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function EmptyState({
  viewMode,
  query,
  onSave,
  isSaving
}: {
  viewMode: ViewMode;
  query: string;
  onSave: () => void;
  isSaving: boolean;
}) {
  const isSearchEmpty = query.trim().length > 0;

  if (isSearchEmpty) {
    return (
      <section className="empty-state">
        <p className="empty-title">No matches</p>
        <p className="empty-copy">Try a session name, tab title, or URL.</p>
      </section>
    );
  }

  if (viewMode === "trash") {
    return (
      <section className="empty-state">
        <p className="empty-title">Trash is empty</p>
        <p className="empty-copy">Deleted sessions will wait here for 30 days.</p>
      </section>
    );
  }

  return (
    <section className="empty-state">
      <div className="empty-visual" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="empty-title">No saved sessions yet</p>
      <p className="empty-copy">Clear the tab strip without losing the trail.</p>
      <button type="button" className="primary-button" onClick={onSave} disabled={isSaving}>
        <PanelTopClose size={16} />
        {isSaving ? "Saving" : "Save tabs"}
      </button>
    </section>
  );
}

function Favicon({ tab }: { tab: StashTab }) {
  if (!tab.favicon) {
    return <span className="favicon-fallback">{getFallbackLetter(tab.title)}</span>;
  }

  return <img className="favicon" src={tab.favicon} alt="" />;
}

function createTab(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: true }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function createWindow(urls: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.windows.create({ url: urls, focused: true }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getFallbackLetter(title: string) {
  return title.trim().charAt(0).toUpperCase() || "S";
}
