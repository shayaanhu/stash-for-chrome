# Step 07 - WXT Foundation

Date: 2026-05-31

## What I Changed

- Migrated the extension build from hand-rolled Vite to WXT.
- Added `wxt.config.ts` as the generated manifest source.
- Added WXT entrypoints:
  - `entrypoints/background.ts`
  - `entrypoints/popup/index.html`
  - `entrypoints/popup/main.tsx`
  - `entrypoints/options/index.html`
  - `entrypoints/options/main.tsx`
- Removed the old root-level Vite entry files:
  - `popup.html`
  - `options.html`
  - `vite.config.ts`
  - `public/manifest.json`
- Updated package scripts:
  - `npm run dev` now runs WXT.
  - `npm run build` now runs `wxt build`.
  - Added `npm run typecheck`.
- Kept the existing shared storage/session logic intact.

## Dependencies Added

- WXT and React module.
- Tailwind v4 Vite plugin.
- Fontsource packages.
- Motion, Sonner, NumberFlow, Rive runtime.
- Radix/shadcn-style primitive support packages.

## Verification

- Ran `npm run build`.
- Result: passed.
- Ran `npm run typecheck`.
- Result: passed.
- Confirmed WXT generated:
  - `dist/chrome-mv3/manifest.json`
  - `dist/chrome-mv3/background.js`
  - `dist/chrome-mv3/popup.html`
  - `dist/chrome-mv3/options.html`

## Notes

- WXT outputs the loadable extension under `dist/chrome-mv3`.
- The built output now includes bundled font files from Fontsource.
- npm reports transitive audit warnings from the expanded toolchain; these do not currently block build or typecheck.

## Next Step

Replace the old CSS/component surface with the new Warm Library design system and owned UI primitives.
