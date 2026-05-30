# Step 03 - Core Session Workflows

Date: 2026-05-31

## What I Built

- Added shared local storage helpers backed by `chrome.storage.local`.
- Added shared session utilities for:
  - Filtering saveable tabs.
  - Creating session names.
  - Normalizing Chrome tabs into Stash tabs.
  - Sorting and searching sessions.
- Added service-worker actions for:
  - Keyboard shortcut save.
  - Context-menu save current tab.
  - Popup-triggered save current window or all windows.
- Added popup workflows for:
  - Saving tabs.
  - Listing sessions newest-first.
  - Searching session names, tab titles, and URLs.
  - Expanding sessions to show tabs.
  - Restoring all tabs in a new window.
  - Restoring one tab.
  - Renaming sessions inline.
  - Deleting sessions with a 5-second undo toast.
  - Deleting individual tabs from a session.
  - Viewing trash.
  - Emptying trash.
  - Restoring deleted sessions.
- Added options workflows for:
  - Default save target: current window or all windows.
  - Compact popup density.
  - Opening Chrome extension shortcut settings.

## Behavior Notes

- Bulk saves skip pinned tabs to avoid unexpectedly closing permanent app tabs.
- Single-tab context-menu saves can save the selected page directly.
- If a save would close every tab in a window, Stash opens a blank replacement tab first so the browser window survives.
- Deleted sessions are soft-deleted and kept in trash for 30 days.

## Verification

- Ran `npm run build`.
- Result: passed.

## Next Step

Do the design and asset pass:

- Tighten popup visual polish against the Warm Library direction.
- Add extension icons so the manifest loads cleanly in Chrome.
- Update README with build/load instructions.
