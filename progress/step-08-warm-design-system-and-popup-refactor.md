# Step 08 - Warm Design System and Popup Refactor

Date: 2026-05-31

## What I Changed

- Added the shared Tailwind v4 theme in `src/styles/app.css`.
- Added real bundled fonts through Fontsource:
  - Geist Variable
  - Inter Variable
  - JetBrains Mono
- Added shadcn-style owned primitives:
  - `Button`
  - `Card`
  - `Input`
  - `Tabs`
  - `Tooltip`
  - `Toaster`
- Added `cn` utility with `clsx` and `tailwind-merge`.
- Refactored the popup UI away from one-off CSS and into the shared theme/components.
- Refactored the options UI into the same theme/components.
- Removed the old popup/options CSS files.

## Craft Added

- Radix-backed accessible tabs with animated active pill.
- Warm focus rings and tokenized component states.
- Motion list entrances and layout animation.
- Animated expand/collapse for tab lists.
- Animated tab row removal.
- Favicon spine with overlap, depth, and overflow count.
- NumberFlow animated counts.
- Sonner toasts for save, restore, delete, and undo.
- Tooltip labels for icon-only controls.
- `Cmd/Ctrl+K` focuses popup search.

## Theme Guardrail

- Moved warm variants into theme tokens.
- Checked source for hard-coded hex values.
- Hex colors now only live in `src/styles/app.css`.

## Verification

- Ran `npm run typecheck`.
- Result: passed.
- Ran `npm run build`.
- Result: passed.

## Next Step

Finish the delight layer and audit reduced-motion behavior against the design spec.
