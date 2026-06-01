# Stash — Chrome Web Store ASO Playbook

Top-tier ASO is the primary discovery channel (no ad budget). The Chrome Web Store
ranks on relevance + quality + usage, and it extracts keywords from the **name**,
**summary**, and **detailed description** (there is no separate keyword field). So
every field below is engineered to (a) win the head term *tab manager*, (b) own the
low-competition long-tail, and (c) convert the impression into an install.

Keyword scoring was run through the ASO skill's analyzer (`.aso/run_keywords.py`,
re-runnable) over a category-grounded dataset. Re-run it quarterly — keyword trends move.

---

## 1. Keyword strategy

Ranked by opportunity (potential = volume + low competition + relevance). Difficulty
is low across the board because the tab-manager long-tail is under-contested.

| Tier | Keywords | Where to place |
|---|---|---|
| **Head (must win)** | `tab manager` | Name + summary + description H1 + repeated naturally |
| **Core (high relevance, low difficulty)** | `save tabs`, `tab organizer`, `save all tabs`, `save chrome tabs`, `tab saver`, `restore tabs`, `organize tabs` | Summary + first 3 lines of description + feature bullets |
| **Long-tail (cheap, high-intent)** | `onetab alternative`, `tab session manager`, `save browser session`, `too many tabs`, `declutter tabs` | Description body + a "why Stash" / comparison section |
| **Adjacent (use sparingly, lower relevance)** | `session manager`, `tab groups`, `close tabs` | Description body once each, only where honest |
| **Avoid (low relevance — dilutes ranking)** | `bookmark manager`, `tab memory saver`/suspender terms | Do **not** target; Stash does not suspend or bookmark |

Why avoid `bookmark manager` and `tab suspender`: the analyzer flagged them low-relevance.
Ranking for terms the product does not satisfy tanks conversion and the Store's quality
signal. Stay honest to "save / restore / organize tabs."

---

## 2. Store listing copy (paste-ready)

### Name (75 max; ~32 visible in search) — 40 chars
```
Stash - Tab Manager, Save & Restore Tabs
```
Brand first for recall, head keyword "Tab Manager" inside the visible truncation, plus
"Save & Restore Tabs" capturing the two core intents. (Note: hyphen, never an em dash.)

### Summary / short description (132 max) — 119 chars
```
Save and restore browser tabs in one click. A beautiful tab manager and OneTab alternative that declutters your window.
```
Leads with the action + benefit, lands the head term and the highest-value long-tail
("OneTab alternative") in the one field users actually read.

### Detailed description (16,000 max)
First three lines matter most — they show before "Read more" and carry the most ranking
weight. Keywords are woven naturally, never stuffed.

```
Stash is the tab manager for anyone drowning in open tabs. Save every tab in one click, close the clutter, and restore the whole set whenever you need it — nothing is ever lost.

If you keep 30, 50, 100 tabs open because closing them feels like losing the trail, Stash is built for you. It is a beautiful, fast OneTab alternative that turns tab chaos into a clean, searchable library.

WHAT STASH DOES
• Save tabs in one click. Capture every tab in the current window (or all windows) into one named session, and close them to free up memory.
• Restore in one click. Bring a whole session back as a new window, or reopen a single tab. Restoring clears it from your stash so your library stays tidy.
• Save all tabs with a shortcut. Press Ctrl+Shift+S (Cmd+Shift+S on Mac) to stash everything without lifting your hand off the keyboard.
• Save just one tab. Right-click any page to stash it on its own.
• Search everything. Find any session, tab title, or URL instantly across your whole library.
• Organize tabs your way. Rename sessions, remove single tabs, and keep the newest at the top.
• 30-day trash. Deleted sessions wait in trash for 30 days, so an accidental delete is never permanent.
• Backup and restore. Export every session to a JSON file and import it back anytime.

HOW IT WORKS
1. Click the Stash icon (or press Ctrl+Shift+S) to save and close your tabs.
2. Your tabs become a tidy session in your library.
3. Click Restore to bring them all back. Done.

WHY STASH INSTEAD OF ONETAB
Most tab managers and session savers look like they were built in 2014. Stash does the same job — save tabs, restore tabs, find tabs — but it is genuinely pleasant to use, with fast search, keyboard shortcuts, and a design you will not flinch at.

PRIVATE BY DEFAULT
Everything stays on your device. Stash has no account, no servers, and no analytics, and it never sends your tabs or browsing anywhere. Your sessions are yours.

FREE
All core tab-management features are free, forever.

Stash. Save your tabs. Clear your head.
```

### Category
- **Primary:** Productivity (Workflow & Planning if prompted for a sub-type).

---

## 3. Visual assets (conversion)

Most installs are decided by the icon + first 2 screenshots; few users scroll.

### Icon
- Already shipped (16/32/48/128). Must read at 16px in the toolbar and 128px in the store.
  Verify the mark is recognizable at 16px and the buttermilk/blue contrast holds on both
  light and dark store backgrounds.

### Screenshots (1280×800, up to 5) — caption each with a benefit, in priority order
1. **The library, full of sessions.** Caption: "Every tab, saved and one click from coming back."
2. **One-click save (popup + Save tabs).** Caption: "Save a whole window of tabs instantly."
3. **Restore a session.** Caption: "Restore the entire set, or just one tab."
4. **Search.** Caption: "Find any tab by name, title, or URL."
5. **Empty/onboarding or trash.** Caption: "Private by default. Nothing leaves your device."

Captions do the selling — bake the keyword + benefit into the image text, not just the alt.

### Promo tiles
- Small tile (440×280): wordmark "Stash" + "Save & restore your tabs" on the buttermilk canvas.
- Marquee (1400×560, optional but boosts featuring odds): the library screenshot + "The beautiful tab manager."

---

## 4. "What's new" (release notes template)
Re-engages users and signals active development (a ranking input). Keep it benefit-led:
```
v1.0 — Stash is here. Save your open tabs in one click, restore them whenever you need
them, search your whole library, and back everything up to a file. Private, local, free.
```

---

## 5. Reviews & ratings (post-launch, biggest long-term ASO lever)
- Respond to every review in the first 30 days, within 24–48h, courteous always.
- Negative-review template: "Sorry that tripped you up — that is not the experience we
  want. Could you tell me what happened at [email]? I will fix it fast." Then actually ship the fix and reply again.
- Positive-review template: "Thank you. If Stash saves you a few tabs a day, that is exactly the point."
- Ask for a rating only after a positive moment (e.g. after a successful restore), never on install.

---

## 6. Ongoing cadence
- Ship a small update every 2–4 weeks early on; each refreshes the listing and signals activity.
- Re-run `.aso/run_keywords.py` quarterly and rotate fresh long-tail into the description.
- Track install→active and the listing conversion rate; A/B the first screenshot and the
  summary's opening clause (action-first vs. benefit-first) once there is enough traffic.

---

## 7. Off-store ASO support (drives the ranking inputs)
The PRD's GTM plan feeds the Store's usage signal: Show HN, Product Hunt, the
`/onetab-alternative` and `/best-tab-manager-2026` landing pages, and r/chrome_extensions.
Each backlinks the listing with the head keyword in the anchor text.
```
