# Step 06 - Design Spec Intake

Date: 2026-05-31

## What I Read

- Read `stash-design-spec.md` end to end.
- Treated it as the new implementation direction for Stash.

## New Locked Direction

- Migrate from hand-rolled Vite to WXT.
- Add Tailwind v4 and a Warm Library token system.
- Use shadcn-style owned primitives instead of generic custom controls.
- Bundle real fonts with Fontsource:
  - Geist Variable
  - Inter Variable
  - JetBrains Mono
- Add Motion for calm craft and bounded delight moments.
- Replace the hand-rolled toast with Sonner.
- Use NumberFlow for animated counts.
- Add a static squirrel mascot placeholder in empty states until a `.riv` asset exists.
- Keep the working tab/session behavior intact during the migration.

## Implementation Phases

1. Foundation migration to WXT.
2. Warm theme, Tailwind, fonts, and primitives.
3. Popup and options refactor.
4. Motion craft and save/restore choreography.
5. Reduced-motion and build verification.

## Known Constraint

The spec calls for a designed Rive `.riv` state-machine asset. That cannot be fully authored from code here without an actual Rive design asset, so this pass will implement the integration-ready structure and ship the required static SVG squirrel fallback.
