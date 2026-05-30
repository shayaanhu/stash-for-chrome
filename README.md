# Stash for Chrome

A WXT-powered Manifest V3 Chrome extension for saving open tabs into named local sessions and restoring them later.

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

Run WXT dev mode:

```sh
npm run dev
```

Load it in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the generated `dist/chrome-mv3` folder.

In dev mode, WXT also writes a development build under `dist/chrome-mv3`. Reload the unpacked extension after code changes if Chrome does not refresh it automatically.

## Project Structure

- `wxt.config.ts` - WXT config and generated manifest source.
- `entrypoints/background.ts` - keyboard command, context menu, and save orchestration.
- `entrypoints/popup` - popup entrypoint.
- `entrypoints/options` - options entrypoint.
- `src/popup` - main session library UI.
- `src/options` - extension settings page.
- `src/components` - owned UI and mascot components.
- `src/styles/app.css` - Tailwind v4 theme, tokens, and font imports.
- `src/shared` - storage, message, type, and session helpers.
- `progress` - step-by-step implementation logs.
