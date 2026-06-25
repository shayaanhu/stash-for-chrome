# Stash — Feature Roadmap

Features ordered by priority. Each section covers what exists, what changes, and where in the codebase.

---

## 1. Session Timestamps

### Goal
Show when a session was saved. Format: **"June 30, 3pm"** — month + day + hour only. No minutes, no year unless it's a different year.

### What already exists
- `StashSession.createdAt: number` is already set on every session in `createSessionFromChromeTabs` and `createEmptyGroup`. The data is there, it's just not rendered.

### What to add

**Formatting helper** — add to `PopupApp.tsx` (or `session-utils.ts`):
```ts
function formatSessionDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    ...(!sameYear && { year: "numeric" }),
  }).format(d);
  // Output: "June 30, 3 PM" → trim to "June 30, 3pm" with a .replace(/\s?(AM|PM)/, m => m.trim().toLowerCase())
}
```

**Render location** — `SessionCard` in `PopupApp.tsx` around line 1396. The name `<div>` is currently a single flex row. Add a second line below the session name:

```tsx
// Before (line ~1396):
<div className="flex w-full items-center gap-1.5 text-left">
  {isFresh && <FreshDot />}
  <span className="truncate ... text-[14px] font-semibold">{session.name}</span>
  <span className="shrink-0 font-mono text-[10.5px] text-muted-2">· {session.tabs.length}</span>
</div>

// After:
<div className="flex w-full flex-col text-left">
  <div className="flex items-center gap-1.5">
    {isFresh && <FreshDot />}
    <span className="truncate ... text-[14px] font-semibold">{session.name}</span>
    <span className="shrink-0 font-mono text-[10.5px] text-muted-2">· {session.tabs.length}</span>
  </div>
  <span className="font-mono text-[10.5px] text-muted-2 leading-tight">
    {formatSessionDate(session.createdAt)}
  </span>
</div>
```

### No schema changes needed
`createdAt` already exists and is normalized in `storage.ts:normalizeSession`.

---

## 2. Sort Options

### Goal
Let users sort their stash by: manual (default), newest first, oldest first, A–Z name, most tabs.

### What already exists
- `applySessionOrder(sessions, order)` in `session-utils.ts` handles manual ordering via a persisted `stash.session-order` array. Unknown sessions fall back to newest-first.
- `getSessionOrder` / `setSessionOrder` in `storage.ts` read/write the order array.
- `StashSettings` in `types.ts` is the right place to persist the chosen sort.

### What to add

**1. Extend `StashSettings`** in `src/shared/types.ts`:
```ts
export type SessionSort = "manual" | "date-desc" | "date-asc" | "name-asc" | "size-desc";

export type StashSettings = {
  // ... existing fields ...
  sessionSort: SessionSort;
};
```

**2. Update `defaultSettings`** in `storage.ts`:
```ts
export const defaultSettings: StashSettings = {
  // ... existing ...
  sessionSort: "manual",
};
```

**3. Add sort logic** to `session-utils.ts` — a new `sortSessions` function:
```ts
export function sortSessions(sessions: StashSession[], sort: SessionSort, order: string[]): StashSession[] {
  if (sort === "manual") return applySessionOrder(sessions, order);
  const active = sessions.filter(s => !s.deletedAt);
  const trash = sessions.filter(s => s.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  const sorted = [...active].sort((a, b) => {
    switch (sort) {
      case "date-desc": return b.createdAt - a.createdAt;
      case "date-asc":  return a.createdAt - b.createdAt;
      case "name-asc":  return a.name.localeCompare(b.name);
      case "size-desc": return b.tabs.length - a.tabs.length;
    }
  });
  return [...sorted, ...trash];
}
```

**4. UI — sort control** in `PopupApp.tsx`, in the stash header row (the row that has "Saved / Trash" subtabs and the "New group" button, around line 987). Add a small sort button that cycles through options or opens a tiny dropdown.

When sort is not `"manual"`, disable `useSortable` on `SessionCard` — pass `disabled: viewMode !== "library" || sort !== "manual"` — otherwise drag reorder is confusing when order doesn't persist.

**5. Persist the choice** — wire `UPDATE_SETTINGS` message when the sort changes, same pattern as `closeAfterStash` (line 337).

---

## 3. Auto-save / Crash Recovery

### Goal
Automatically snapshot the current window's tabs every 5 minutes. Keep the last 12 snapshots (= 1 hour). Also keep 1 daily snapshot for the last 7 days. User can browse and restore any snapshot. Controlled by a toggle in Settings.

### What already exists
- `chrome.alarms` API is available in the background service worker (MV3).
- `SAVE_TABS` message already saves current-window tabs to a named session.
- `StashSession` has `manuallyCreated?: boolean` — same pattern can be used for auto-saved sessions.
- `storage.ts` mutation chain ensures safe concurrent writes.

### What to add

**1. Extend `StashSession`** in `types.ts`:
```ts
export type StashSession = {
  // ... existing ...
  autoSaved?: boolean;      // true if created by the auto-save alarm
  autoSaveKind?: "interval" | "daily";  // interval = 5-min, daily = end-of-day
};
```

**2. Extend `StashSettings`** in `types.ts`:
```ts
export type StashSettings = {
  // ... existing ...
  autoSave: boolean;   // default false
};
```

**3. Storage helpers** in `storage.ts`:
```ts
// Constants for retention
export const AUTO_SAVE_INTERVAL_KEEP = 12;  // last 12 interval snapshots
export const AUTO_SAVE_DAILY_KEEP    = 7;   // last 7 daily snapshots

export function pruneAutoSaves(sessions: StashSession[]): StashSession[] {
  const intervals = sessions
    .filter(s => s.autoSaved && s.autoSaveKind === "interval")
    .sort((a, b) => b.createdAt - a.createdAt);
  const dailies = sessions
    .filter(s => s.autoSaved && s.autoSaveKind === "daily")
    .sort((a, b) => b.createdAt - a.createdAt);

  const keepIds = new Set([
    ...intervals.slice(0, AUTO_SAVE_INTERVAL_KEEP).map(s => s.id),
    ...dailies.slice(0, AUTO_SAVE_DAILY_KEEP).map(s => s.id),
  ]);

  return sessions.filter(s => !s.autoSaved || keepIds.has(s.id));
}
```

**4. Background service worker** — register/clear alarm when the setting changes, and handle it:
```ts
// On setting update or install:
async function syncAutoSaveAlarm(enabled: boolean) {
  if (enabled) {
    await chrome.alarms.create("stash-autosave", { periodInMinutes: 5 });
  } else {
    await chrome.alarms.clear("stash-autosave");
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "stash-autosave") return;
  const settings = await getSettings();
  if (!settings.autoSave) return;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const savable = tabs.filter(t => isSavableChromeTabUrl(t.url));
  if (savable.length === 0) return;

  const now = Date.now();
  const session = createSessionFromChromeTabs(savable, now);
  const isEndOfDay = new Date(now).getHours() === 23;

  const autoSession: StashSession = {
    ...session,
    name: `Auto-save ${formatSessionDate(now)}`,
    autoSaved: true,
    autoSaveKind: isEndOfDay ? "daily" : "interval",
  };

  await mutate(sessions => {
    const pruned = pruneAutoSaves(sessions);
    return { next: [autoSession, ...pruned], result: autoSession };
  });
});
```

**5. UI** — auto-saves appear in a separate collapsible "Snapshots" section above or below the main stash list. They're read-only (no rename, no trash — just restore or discard). Alternatively: a dedicated "Snapshots" sub-tab alongside "Saved / Trash."

**6. Settings toggle** — add "Auto-save" row in `PopupSettings.tsx`, same toggle pattern as existing settings. When turned on, call `syncAutoSaveAlarm(true)`.

**7. Schema version bump** — increment `SCHEMA_VERSION` from `1` to `2` in `storage.ts`. Add a v1→v2 migration entry in `migrations` (no-op is fine since existing data is compatible).

---

## 4. Import from Other Extensions

### Goal
Let users bring in data from Session Buddy and OneTab (the two biggest competitors) so switching to Stash costs them nothing.

### What already exists
- `handleImportFile` in `PopupSettings.tsx` (lines 76-97) already reads a JSON file and calls `ADD_SESSIONS`. It only understands Stash's own format.
- `addSessions` in `storage.ts` deduplicates by `id`, so re-importing is safe.

### What to add

**1. Auto-detect the format** when a file is imported:
```ts
type ImportFormat = "stash" | "session-buddy" | "onetab";

function detectFormat(parsed: unknown): ImportFormat {
  if (isPlainObject(parsed) && Array.isArray((parsed as any).sessions)
      && (parsed as any).exportedAt) return "stash";
  if (isPlainObject(parsed) && Array.isArray((parsed as any).sessions)
      && (parsed as any).sessions[0]?.windows) return "session-buddy";
  return "onetab"; // fallback: try plain-text parsing
}
```

**2. Session Buddy JSON parser:**
```ts
// Session Buddy format: { sessions: [{ name, date, windows: [{ tabs: [{ url, title, favicon }] }] }] }
function parseSessionBuddy(parsed: unknown): StashSession[] {
  const raw = parsed as any;
  return (raw.sessions ?? []).map((s: any) => ({
    id: crypto.randomUUID(),
    name: s.name || "Imported session",
    createdAt: s.date ? new Date(s.date).getTime() : Date.now(),
    tabs: (s.windows ?? []).flatMap((w: any) =>
      (w.tabs ?? [])
        .filter((t: any) => isSavableUrl(t.url))
        .map((t: any): StashTab => ({
          id: crypto.randomUUID(),
          url: t.url,
          title: t.title || t.url,
          favicon: t.favicon || "",
          capturedAt: Date.now(),
        }))
    ),
  })).filter((s: StashSession) => s.tabs.length > 0);
}
```

**3. OneTab plain-text parser:**
```ts
// OneTab export format: groups separated by blank lines, each line is "url | title"
function parseOneTab(text: string): StashSession[] {
  return text
    .split(/\n{2,}/)
    .map((block, i) => {
      const tabs = block.trim().split("\n").map(line => {
        const [url, ...rest] = line.split(" | ");
        return { url: url?.trim() ?? "", title: rest.join(" | ").trim() || url?.trim() || "" };
      }).filter(t => isSavableUrl(t.url));
      return {
        id: crypto.randomUUID(),
        name: `OneTab import ${i + 1}`,
        createdAt: Date.now(),
        tabs: tabs.map(t => ({ id: crypto.randomUUID(), url: t.url, title: t.title, favicon: "", capturedAt: Date.now() })),
      };
    }).filter(s => s.tabs.length > 0);
}
```

**4. Update `handleImportFile`** in `PopupSettings.tsx` to try all three parsers:
```ts
async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = "";
  try {
    const text = await file.text();
    let sessions: StashSession[];

    if (file.name.endsWith(".json")) {
      const parsed = JSON.parse(text);
      const format = detectFormat(parsed);
      sessions = format === "stash"
        ? normalizeSessions(parsed.sessions)
        : parseSessionBuddy(parsed);
    } else {
      // .txt or unknown → try OneTab plain-text
      sessions = parseOneTab(text);
    }

    const response = await sendBackgroundRequest({ type: "ADD_SESSIONS", sessions });
    // ... flash toast with count ...
  } catch {
    flash("Couldn't read that file.");
  }
}
```

**5. UI hint** — update the import row in `PopupSettings.tsx` to show accepted formats: "Accepts Stash, Session Buddy, or OneTab exports."

---

## Summary

| # | Feature | Effort | Files touched |
|---|---------|--------|---------------|
| 1 | Timestamps | XS — add helper + 5 lines of JSX | `PopupApp.tsx` |
| 2 | Sort options | S — new state, sort fn, small UI control | `types.ts`, `storage.ts`, `session-utils.ts`, `PopupApp.tsx`, `PopupSettings.tsx` |
| 3 | Auto-save | M — alarm setup, prune logic, UI section | `types.ts`, `storage.ts`, background SW, `PopupApp.tsx`, `PopupSettings.tsx` |
| 4 | Competitor import | S — parsers + format detection | `PopupSettings.tsx`, `session-utils.ts` |
