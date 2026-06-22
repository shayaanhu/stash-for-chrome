# Stash — UX Redesign Plan

## The one sentence this product exists for

> **"I've got a pile of open tabs. Let me pick the ones that matter, drop them into a named group, and clear them out — without fear of losing them."**

The emotional core (borrowed from Toby's pitch, validated across the market): **close your tabs without fear.** People don't want a filing cabinet — they want *permission to hit close*.

---

## What the market taught us

Research across OneTab, Session Buddy, Toby, and Tab Manager reviews:

**Universally loved**
- **Instant search** — the #1 praised feature everywhere, and the #1 complaint when it has friction (Session Buddy users hate clicking the box first).
- **Lightweight & simple** — Tab Manager beats Toby here. Toby is powerful but heavy; it hijacks the new-tab page. A fast popup is a real edge.

**Universally broken (our opportunities)**
- **"Add to existing collection"** is bad everywhere — Session Buddy literally makes users copy-paste. Nobody does it well.
- **No cloud sync** → data-loss fear. (Big lift; premium tier later.)
- **Group names lost on export.** (Easy to get right.)

---

## The core insight: two jobs, not one

The current popup's flaw is mashing two jobs together — open tabs are buried in a collapsible panel inside the Library.

| Job | Frequency | Mindset | Works with |
|-----|-----------|---------|-----------|
| **Open Tabs** (curate & stash) | Many times a day | "Clear my desk" | My **live** tabs |
| **Stash** (retrieve) | Occasionally | "Get that back" | My **saved** collection |

Different jobs → different views. That split is the whole redesign.

---

## Navigation

Two top-level modes. The naming reads as plain English — *you're on Open Tabs, you select some, you hit Stash, they go into your Stash.* The verb and the noun reinforce each other.

```
[ Open Tabs ]   Stash
```

- **Open Tabs** = what's open right now. Select and hit the **Stash** button. *Default view* (the daily action).
- **Stash** = your saved collection. Where stashed tabs live. Find and restore. (Replaces "Library.")
- **Trash** moves *inside* Stash (a sub-filter of saved stuff, not a top-level peer).

---

## View 1 — OPEN TABS (default / home screen)

Where people live. Optimized for **pick → name → clear**.

```
┌─────────────────────────────────┐
│  [Open Tabs]   Stash       ⚙     │
├─────────────────────────────────┤
│  🔍 Filter tabs…      ☐ All (7)  │  ← search autofocused
├─────────────────────────────────┤
│  ☐ ◯  Extensions                 │
│  ☑ 🔴 developersPak               │
│  ☑ ◯  Banao: builder community    │
│  ☐ 🛒 Laptop Sleeve…              │
│  ☑ 💬 WhatsApp                    │
├─────────────────────────────────┤
│        [ Stash 3 tabs → ]        │  ← sticky CTA
└─────────────────────────────────┘
```

- **Search autofocused** the instant the popup opens — type immediately, zero clicks.
- **Checkboxes** with a one-tap **"All"**.
- **Default selection = none.** Selecting-all-then-closing-everything by accident is the scary path; "All" is one click away when wanted.
- **Sticky "Stash N tabs" CTA** — count updates live, disabled at 0.

### The Stash sheet (slides up on the CTA)

Our edge — the thing nobody does well.

```
┌─────────────────────────────────┐
│  [ New session ] Add to existing │
│  ┌─────────────────────────────┐ │
│  │ developersPak · Banao  ✎    │ │  ← smart auto-name, pre-filled
│  └─────────────────────────────┘ │
│  ☑ Close these tabs after saving │  ← the "without fear" toggle
│         [ Cancel ]  [ Stash ]    │
└─────────────────────────────────┘
```

- **New session**: name pre-filled by the existing auto-naming engine, fully editable, text pre-selected.
- **Add to existing**: fuzzy-search existing sessions. Solves the Session Buddy pain.
- **"Close tabs after saving"** toggle — *this is the memory-management feature.* Remembers the last choice. Literally "close without fear."

---

## View 2 — STASH (the saved collection)

Today's Library, with two fixes:

1. **Search autofocused** on entering the view.
2. **Collapsed cards become single-row** — finally kills the density problem:

```
›  ◉◉◉ Project Planning · 5 tabs · Mon       ↺
›  ◉◉  Shopping · 2 tabs · Jun 22            ↺
```

Expand for the tab list + per-tab restore/remove. Trash is a toggle/filter up top.

---

## Principles that make people *love* it

1. **The 3-second loop**: open → (search) → select → Stash → gone.
2. **Keyboard-first**: autofocused search, `Space` to toggle a tab, `Cmd+Enter` to stash.
3. **No fear**: close-toggle + 30-day trash + undo on everything.
4. **Add-to-existing done right** — our one clear win over every competitor.
5. **Stay lightweight** — a fast popup, not a new-tab takeover. Our edge over Toby.

---

## Build phases

1. **Restructure nav** → `Open Tabs` / `Stash`; move Trash inside Stash. Default to Open Tabs.
2. **Build Open Tabs view** → open-tabs list, checkboxes, select-all, filter, sticky CTA.
3. **Build Stash sheet** → new/existing toggle, auto-name, close toggle.
   - Needs one new batch message type (save selected tab ids).
   - Auto-naming + close-tabs logic already exist — reuse them.
4. **Compress Stash cards** to single-row collapsed.
5. **Polish**: autofocus, keyboard shortcuts, undo everywhere.

---

## Decisions locked

- **Labels**: `Open Tabs` (live tabs view) / `Stash` (saved collection). The **Stash** button is the verb that connects them.
- **Default view**: Open Tabs (the daily action).
- **Drag-to-group**: keep the existing drag-tab-into-group as a power-user bonus, de-emphasized; checkbox + sheet is the main path.
- **Default selection** in Open Tabs: none, with a prominent "All".

## Open / later

- Cloud sync (premium tier).
- Export keeps group names (quick win).
