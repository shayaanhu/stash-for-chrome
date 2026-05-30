# Stash for Chrome

A Manifest V3 Chrome extension for saving open tabs into named local sessions and restoring them later.

## Current Scope

- Save all non-pinned tabs from the current window.
- Optionally save tabs from all windows.
- Save the current page from the right-click context menu.
- Restore a whole session into a new window.
- Restore an individual tab.
- Search session names, tab titles, and URLs.
- Rename sessions.
- Delete sessions with undo.
- Keep deleted sessions in 30-day trash.
- Store everything locally in `chrome.storage.local`.

## Development

Install dependencies:

```sh
npm install
```

Build the extension:

```sh
npm run build
```

Load it in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the generated `dist` folder.

## Project Structure

- `public/manifest.json` - Chrome extension manifest.
- `src/background/service-worker.ts` - keyboard command, context menu, and save orchestration.
- `src/popup` - main session library UI.
- `src/options` - extension settings page.
- `src/shared` - storage, message, type, and session helpers.
- `progress` - step-by-step implementation logs.
