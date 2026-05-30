# Step 09 - Delight Motion and Reduced Motion

Date: 2026-05-31

## What I Implemented

- Added the save choreography:
  - Button press scale.
  - Favicon stack gather/drop animation.
  - New card layout drop-in.
  - Freshly saved dot pulse.
  - Sonner save toast with Undo.
- Added the restore nod:
  - Favicon spine fans out briefly.
  - Restore success toast.
- Added the static mascot placeholder for empty states:
  - Idle empty library.
  - First-save reaction.
  - Empty-trash reaction.
  - Search-miss reaction.
- Added reduced-motion paths:
  - Save choreography is skipped.
  - Mascot uses static/reduced state.
  - List and view transitions fall back to opacity or instant state.

## Motion Discipline Audit

- Searched for spring usage.
- Result: explicit spring is limited to the save choreography favicon stack.
- Calm interactions use duration/easing tokens or short bezier transitions.

## Verification

- Ran `npm run typecheck`.
- Result: passed.
- Ran `npm run build`.
- Result: passed.

## Notes

- The real Rive `.riv` mascot asset is still not present. The code ships the required static SVG placeholder and keeps Rive as an installed dependency for the future asset integration.
- The mascot is only rendered in empty states, not in the working session list.
