# Stash — UI/UX & Motion Spec

> Companion to `stash-prd.md`. The PRD defines *what* Stash is. This defines *how it should feel* — the craft, motion, and life that make someone go "wow," and the exact stack to build it on.
>
> **Status:** Plan (no code yet) · **Date:** May 2026 · **Author:** Shayaan + Claude
> **Doubles as:** the reference foundation for future extensions in the portfolio.

---

## 0. Decisions locked (read this first)

| Decision | Choice | Rationale |
|---|---|---|
| Build foundation | **WXT** (migrate off hand-rolled Vite) | 2026's leading extension framework; file-based entrypoints, auto-manifest, cross-browser (Chrome/Firefox/Edge per PRD §6.3), real HMR. Template-grade. |
| Styling base | **Tailwind v4 + shadcn/ui** | Modern default; accessible Radix-backed primitives you *own as code*. Ideal for a forkable template. |
| Design system | **Custom warm theme** via `@theme` | PRD palette + fonts mapped into shadcn's CSS variables so every component is born "Warm Library," not generic-shadcn-grey. |
| Core motion | **Motion** (`motion`, ex-Framer Motion v12+) | De-facto React standard. Springs, layout animations, gestures, `AnimatePresence`. |
| Mascot | **Rive** (`@rive-app/react-canvas`), *subtle reactive* | State-machine squirrel. Empty states + micro-reactions only. Never in the working list. |
| Toasts / undo | **Sonner** | Best-in-class; springy, stacking, swipe-to-dismiss. Replaces the hand-rolled toast. |
| Animated numbers | **NumberFlow** (`@number-flow/react`) | Counts roll instead of snapping. Cheap craft signal. |
| Fonts | **Fontsource** variable packages | Self-hosted, MV3-CSP-safe. Fixes the current silent fallback. |

---

## 1. The governing philosophy: restraint + a delight budget

The PRD says *subtle, no bounce, max 200ms.* The new brief says *alive, wow.* These only seem opposed.

**The resolution:** be calm 95% of the time, then spend the entire delight budget on **2–3 signature moments.** Linear, Things, and Raycast are austere almost everywhere and have one or two moments that make you smile. "Wow" comes from **craft everywhere + magic in a few places** — never from everything moving at once. If everything is alive, nothing is.

So this spec splits motion into two registers:

- **Calm register** (the 95%) — obeys the PRD: standard easing, ≤200ms, no overshoot. Lists, hovers, expands, button states.
- **Delight register** (the 3 hero moments) — *permitted* to use spring physics and run longer (up to ~650ms). This is a deliberate, bounded exception, not a license to make everything bouncy.

Every animation below is tagged **[calm]** or **[delight]** so the line never blurs.

---

## 2. Critical fix before any polish: the invisible typography

**The current build silently renders in the OS system font.** `popup.css` requests `Geist`, `Inter`, and `JetBrains Mono`, but **zero font files are bundled** and `popup.html` loads none. Under MV3's CSP you also can't pull from Google Fonts. So PRD §8.3's entire type identity is missing — the screenshots are Segoe UI cosplaying as Geist.

**Fix (do this first — it's the single highest visual ROI):**

```bash
npm i @fontsource-variable/geist @fontsource-variable/inter @fontsource/jetbrains-mono
```

Import once at the popup/options entry; Fontsource self-hosts as bundled woff2. Then bind in the theme (§3). Nothing else in this spec lands correctly until real Geist is on screen.

---

## 3. The design system — warm theme over shadcn

shadcn ships neutral grey. We override its tokens so the warmth is structural, not painted on top.

### 3.1 Theme tokens (`@theme`, Tailwind v4)

```css
@theme {
  /* Warm Library palette — PRD §8.2 */
  --color-bg:        #F8F6F1;  /* aged paper            */
  --color-surface:   #FFFFFF;  /* raised cards          */
  --color-ink:       #1F1B16;  /* warm near-black       */
  --color-muted:     #6B655A;  /* warm grey-brown       */
  --color-border:    #E5E0D7;  /* barely-there edge     */
  --color-accent:    #C26847;  /* terracotta — the moat */
  --color-accent-ink:#A95034;  /* accent border/pressed */
  --color-success:   #5B7548;  /* muted forest          */
  --color-danger:    #B85450;  /* muted brick           */

  /* Type — PRD §8.3, now actually loaded */
  --font-display: "Geist Variable", Inter, system-ui, sans-serif;
  --font-body:    "Inter Variable", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, monospace;

  /* Radius — PRD §8.4: restrained, not pill */
  --radius-card: 6px;
  --radius-btn:  4px;

  /* Motion tokens — see §4 */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);   /* calm UI            */
  --ease-entrance: cubic-bezier(0.22, 1, 0.36, 1); /* soft settle       */
  --dur-instant: 120ms;
  --dur-base:    180ms;
  --dur-entrance:240ms;
}
```

Map shadcn's semantic variables (`--background`, `--primary`, `--card`, `--destructive`, `--ring`, etc.) onto these so Button, Tabs, Card, Toast, etc. inherit the palette automatically. shadcn becomes invisible plumbing; the surface is 100% Stash.

### 3.2 Light mode only at launch (PRD §8.2)

Keep tokens in a single `:root` block. Dark mode is deferred — but structure the tokens so a future `.dark` block is a drop-in (don't hardcode hex anywhere but the theme).

---

## 4. Motion system

### 4.1 Tokens & rules

| Token | Value | Register | Use |
|---|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2,0,0,1)` | calm | hovers, color/border transitions |
| `--ease-entrance` | `cubic-bezier(0.22,1,0.36,1)` | calm | list/card entrances (soft settle, *no overshoot*) |
| `--dur-instant` | 120ms | calm | press feedback, hover |
| `--dur-base` | 180ms | calm | expand/collapse, view switches |
| `--dur-entrance` | 240ms | calm | entrances |
| Motion `spring` `{ stiffness: 420, damping: 34 }` | — | delight | hero choreography only |

**Hard rule:** the spring is allowed **only** in the three hero moments (§5). Everywhere else uses the bezier tokens. This is the whole discipline.

### 4.2 Accessibility — non-negotiable

Wrap all delight-register motion in `prefers-reduced-motion`. Reduced-motion users get instant state changes + opacity-only fades. Rive mascot drops to a static pose. This is also just correct craft.

```ts
const reduce = useReducedMotion(); // Motion hook
```

---

## 5. The three hero moments (the delight budget)

### 5.1 ⭐ The Save — the signature moment

This is the emotional core of the product: *"I closed 23 tabs and didn't lose them"* = relief + a small thrill. Today `handleSaveTabs` just reloads a list — the single biggest wasted opportunity in the app. **This is the moment people screenshot.**

**Beat sheet (~650ms total, [delight]):**

1. **0ms — Acknowledge.** Save button presses in (scale 0.96), terracotta deepens. Immediate.
2. **80ms — Collapse.** A lightweight "tab stack" motif (3–4 favicon chips of the captured tabs) animates *inward and down* toward the library — `layout` + spring. Reads as tabs being gathered.
3. **260ms — Drop-in.** The new session card materializes at the top of the list: translateY(−8px → 0) + scale(0.98 → 1) + opacity, spring settle. Existing cards slide down to make room (`layout` animation — Motion does this for free).
4. **380ms — The mascot beat.** Squirrel (if visible in an empty→first-save transition) pockets the stack. On a non-empty library, skip — card drop-in carries it.
5. **420ms — Freshly-saved pulse.** A terracotta dot on the new card pulses **once** (scale 1 → 1.4 → 1, fade). PRD §8.5's "freshly saved dot," now animated. One pulse only — restraint.
6. **520ms — Settle + Sonner toast.** `"Saved 23 tabs."` slides up, with **Undo**. Auto-dismiss 5s.

NumberFlow rolls the Library count up by however many you saved, concurrently.

### 5.2 Restore — the satisfying retrieval

Inverse of save, lighter. **[delight]**, ~300ms. On "Restore all": favicons in the card's spine briefly *fan out* (the squirrel "digging it back up"), card gives a subtle confirming lift, Sonner confirms `"Restored to a new window."` Don't over-egg it — restore happens often; save happens rarely. Restore is a *nod*, save is a *scene*.

### 5.3 Empty states — where the squirrel lives

The only place "alive" is free, because there's nothing to distract from. See §6.

---

## 6. The mascot — "the stash squirrel" (subtle reactive)

**Metaphor lock:** "Stash" *is* what a squirrel does — hoards things to retrieve later. It maps 1:1 onto the product verb, is warm/earthy/terracotta-native, and reads as "made by a human." It is brand metaphor made visible, not a cute blob bolted on. (Working codename: **Nutkin** — rename freely.)

**Built in Rive as one asset with a state machine.** One `.riv` file, multiple states triggered by app events — not a pile of Lottie clips.

### 6.1 States

| State | Trigger | Behavior |
|---|---|---|
| `idle` | Empty library visible | Gentle breathing, occasional blink + tail flick. Loops. Low amplitude — peripheral, not attention-grabbing. |
| `save` | First save from empty | Pockets the tab-stack, satisfied beat. Hands off to the card drop-in. |
| `trash-empty` | Empty-trash action | Brief sweep/dust-off, then back to idle. |
| `search-miss` | Search yields nothing | Looks around, shrugs. Tiny. |
| `reduced` | `prefers-reduced-motion` | Static friendly pose. No loop. |

### 6.2 The discipline — where it appears and where it NEVER does

- ✅ **Empty library** — the squirrel *is* the visual (replaces the three grey bars in `EmptyState`).
- ✅ **Empty trash** — smaller, in the trash empty state.
- ✅ **Micro-reactions** — the save pocket beat, search-miss shrug.
- ❌ **Never in the working list.** Once you have ≥1 session, the squirrel is gone. It's a **greeter, not a roommate.**
- ❌ **Never in the header/logo** as a persistent animated thing (that path reads as toy-like and undercuts the premium positioning — the reason we chose *subtle reactive* over *full character*).

This keeps the working UI exactly as clean as the PRD demands while the product still has a soul.

### 6.3 Asset production note

The `.riv` needs to be designed (Rive editor). Until it exists, ship a **static SVG squirrel** in the empty state as a placeholder so layout/identity land early; swap in the interactive `.riv` when ready. Style: single-weight line + warm flat fills, matching the Lucide icon weight and the terracotta accent. No gradients (PRD §8.1).

---

## 7. The other 90% — craft that reads as "wow" without moving much

These are mostly invisible individually; together they're the difference between "nice" and "wow."

| # | Detail | Today | Target | Register |
|---|---|---|---|---|
| 1 | **List entrance** | cards just appear | staggered rise+fade, 30ms apart, `--ease-entrance` | calm |
| 2 | **Expand/collapse** | `isExpanded` instantly mounts `<ul>` | height+opacity spring via Motion `AnimatePresence` | calm |
| 3 | **Favicon spine** | 3 flat favicons | overlapping spine w/ subtle depth + count overflow ("+5"), per PRD §8.5 | calm |
| 4 | **Button press** | none | scale 0.96 on press, spring restore (Motion `whileTap`) | calm |
| 5 | **Save loading** | text flips "Save tabs"→"Saving" | inline spinner / subtle shimmer; never a layout jump | calm |
| 6 | **Counts** | static numbers | NumberFlow roll on change | calm |
| 7 | **Tab row hover** | bg change | bg + 2px favicon nudge, `--dur-instant` | calm |
| 8 | **Card depth** | `0 1px 0` hairline | layered: hairline border + soft 1px ambient shadow (PRD §8.5 "offset shadow, paper texture") — real edges, not flat | static |
| 9 | **View switch (Library/Trash)** | instant | content cross-fade 120ms; the active pill slides (shadcn Tabs + `layoutId`) | calm |
| 10 | **Search empty** | text only | squirrel `search-miss` + copy | delight(tiny) |
| 11 | **Undo toast** | hand-rolled `toast` div | Sonner, springy, swipe-dismiss | calm |
| 12 | **Focus rings** | default | warm terracotta ring token, consistent across all shadcn comps | static |

---

## 8. Component-by-component notes

- **Header** — keep restrained. Eyebrow "Stash" terracotta, Geist h1. `Save tabs` is the only terracotta-filled button on screen (PRD §8.5 restraint). No mascot here.
- **Search** — autofocus stays (good). Add `Cmd/Ctrl+K` to focus (PRD §7.2). Border→terracotta on focus already correct.
- **Tabs (Library/Trash)** — port to shadcn `Tabs` for a11y; animate the active pill with a shared `layoutId` (Motion) so it *slides* between the two. Counts via NumberFlow.
- **Session card** — the workhorse. Motion `layout` so reorder/insert/remove all animate for free. Spine (§7.3). Freshly-saved dot (§5.1.5). Hover lifts 1px.
- **Tab list** — `AnimatePresence` for expand. Row delete animates out (height→0 + fade), not a snap.
- **Empty states** — squirrel + copy + single CTA (PRD §8.5). Three variants already exist (no sessions / empty trash / no search match) — give each the right squirrel state.
- **Toast → Sonner** — single `<Toaster position="bottom-center">`, warm-themed, terracotta action text for Undo.

---

## 9. Dependencies to add

```bash
# Foundation
npm i -D wxt                      # migrate build (see §10)
npm i tailwindcss @tailwindcss/vite tw-animate-css
npx shadcn@latest init            # Tailwind v4 + React 19 preset

# Motion & life
npm i motion                      # ex-Framer Motion v12+
npm i @rive-app/react-canvas      # mascot (v4.28+, React 19 OK)
npm i sonner                      # toasts/undo
npm i @number-flow/react          # animated counts

# Fonts (fixes §2)
npm i @fontsource-variable/geist @fontsource-variable/inter @fontsource/jetbrains-mono
```

Keep `lucide-react` (already in use; consistent single icon set per PRD §8.4).

---

## 10. Build order (phased — ship value at each step)

**Phase 0 — Foundation (no visible change, enables everything)**
1. Migrate to **WXT**: `entrypoints/popup`, `entrypoints/options`, `entrypoints/background.ts`. Port existing `src/shared/*` logic unchanged.
2. Add Tailwind v4 + shadcn init; wire the warm `@theme` (§3).
3. Bundle fonts (§2). **Verify real Geist renders** — this alone visibly upgrades the app.
4. Verify parity: save/restore/trash/search all still work. (Functionality identical; only scaffolding changed.)

**Phase 1 — Calm craft (the 90%)**
5. Port components to shadcn primitives (Button, Tabs, Card, Tooltip).
6. Add Motion: list stagger, expand/collapse, button press, card `layout`, view-switch pill.
7. Favicon spine, card depth, NumberFlow counts, Sonner toasts.
8. *Checkpoint: app should already feel premium with zero hero animations yet.*

**Phase 2 — The hero moment**
9. Build the Save choreography (§5.1) end-to-end. This is where the "wow" is earned.
10. Restore nod (§5.2).

**Phase 3 — Life**
11. Static SVG squirrel in empty states (identity lands).
12. Design + integrate the Rive `.riv` with its state machine (§6.1); wire app events → states.

**Phase 4 — Pass**
13. `prefers-reduced-motion` audit across every animation (§4.2).
14. Performance: popup open <100ms (PRD §9.4) — lazy-load Rive so the mascot never blocks first paint; ensure Motion isn't janking the list at 50+ cards.

---

## 11. Guardrails — what NOT to do

- **No second terracotta-filled element.** One primary CTA. The accent is the moat *because* it's rare.
- **No spring outside the 3 hero moments.** The bezier tokens everywhere else.
- **No mascot in the working list.** Greeter, not roommate.
- **No gradients, no glassmorphism, no AI-sparkle, no purple** (PRD §8.1). Modern stack, classic restraint.
- **Mascot must never block first paint.** Lazy-load Rive; static fallback first.
- **Every delight animation needs a reduced-motion path.** No exceptions.
- **Don't let shadcn's default grey leak through.** If something looks like generic shadcn, the theme mapping is incomplete.

---

## 12. The one-line test

> A designer opens Stash for the first time, sees the squirrel, hits Save, watches 23 tabs gather into a card, and screenshots it before they've read a single word of copy.

If a change doesn't serve that sentence or the calm craft underneath it, cut it.
