# Stash — Chrome Web Store ASO Playbook

Top-tier ASO is the primary discovery channel (no ad budget). The Chrome Web Store
ranks on relevance + quality + usage, and it extracts keywords from the **name**,
**summary**, and **detailed description** (there is no separate keyword field). So
every field below is engineered to (a) win the head term *tab manager*, (b) own the
low-competition long-tail, and (c) convert the impression into an install.

Keyword scoring was run through the ASO skill's analyzer (`.aso/run_keywords.py`,
re-runnable) over a category-grounded dataset. Re-run it quarterly — keyword trends move.

The current live listing (pre-optimization baseline) is snapshotted in
[ASO-current-live.md](ASO-current-live.md). Competitor data is in
[reviews.md](reviews.md).

---

## 0. Competitor teardown — why the top listings win

Read the four rivals in `reviews.md`, then borrow what works and exploit what doesn't.

| Rival | Why it ranks / converts | The opening it leaves us |
|---|---|---|
| **Session Buddy** — 4.7★, **1M users** | Owns the word *session*; privacy-first + fully local (their headline differentiator); import/export in 15+ formats; brags it "handles thousands of tabs." Proven that privacy + reliability-at-scale sell. | Dated 2014-era UI, **English-only**, **no dark mode**. Match its reliability and privacy, then beat it on looks + dark mode. |
| **Tab Manager** (dev.mariserge) — 5.0★, 1K | Name is the **exact head term**. Auto-save every 5 min + daily backups (crash recovery), **import from Session Buddy** (migration path), light/dark, **52 languages**. | Tiny install base. It proves the levers — auto-save, dark mode, a switch-from-X hook, localization — all of which we can do as well or better. |
| **Tabs in One** — 4.9★, 2K | Name appends a **benefit**: "Tab Manager **to Free Up Memory**." 55 languages, 90 KB. Captures the high-volume RAM/memory intent. | It only consolidates live tabs (no named sessions). We own the actual *save & restore* job it lacks — while still honestly claiming "free up memory" (we close tabs). |
| **Toast** — 4.0★, 10K | Cross-device cloud sync + sharing; ProductHunt "Product of the Day." | Lowest rating of the set (sync/paywall friction, 6 MB). Sync is a support burden and a rating drag — **don't chase it**; frame our local-only simplicity as the feature. |

**Six lessons baked into the copy below:**
1. **Localization is the biggest untapped lever.** The small rivals punch above their weight with 52–55 languages; we're English-only. Translating the listing (and ideally the UI) into the top ~10–15 locales multiplies impressions. Highest-ROI growth task — see §6.
2. **Auto-save / crash recovery is table stakes** among the top performers — and we now ship it. Surface it.
3. **Dark mode is expected** — now shipped. Add it (and it's a searched term).
4. **"Free up memory" is high-volume and honest for us** — we close tabs on save, reclaiming RAM. Claim it. (Still avoid *suspender* terms — we don't keep tabs alive-but-frozen.)
5. **Reliability at scale is a real differentiator.** Session Buddy brags "thousands of tabs"; rivals get crash complaints. Our lazy restore reopens huge sessions without choking — say so.
6. **A migration hook converts switchers.** "Coming from OneTab or Session Buddy?" + JSON import lowers the switch cost. (A dedicated Session Buddy import shim is a strong follow-up.)

---

## 1. Keyword strategy

Ranked by opportunity (potential = volume + low competition + relevance). Difficulty
is low across the board because the tab-manager long-tail is under-contested.

| Tier | Keywords | Where to place |
|---|---|---|
| **Head (must win)** | `tab manager` | Name + summary + description H1 + repeated naturally |
| **Core (high relevance, low difficulty)** | `save tabs`, `tab organizer`, `save all tabs`, `save chrome tabs`, `tab saver`, `restore tabs`, `organize tabs` | Summary + first 3 lines of description + feature bullets |
| **Long-tail (cheap, high-intent)** | `tab session manager`, `save browser session`, `too many tabs`, `declutter tabs`, `free up memory chrome` | Description body + the memory section |
| **New-feature intents (now honest — we ship these)** | `auto save tabs`, `tab crash recovery`, `dark mode tab manager`, `free up memory`, `reduce ram chrome tabs` | Feature bullets + the memory section + summary; tie "free up memory" to *closing* saved tabs |
| **Adjacent (use sparingly, lower relevance)** | `session manager`, `tab groups`, `close tabs` | Description body once each, only where honest |
| **Off-STORE only — brand comparison (never in the listing)** | `onetab alternative`, `session buddy alternative`, `toby alternative` | Landing pages, Show HN, Reddit, blog — **never** name a competitor in the Store name/summary/description |
| **Avoid entirely (off-product — dilutes ranking)** | `bookmark manager`, `tab suspender`, `auto tab discard`, `the great suspender` | Do **not** target; Stash saves/restores, it does not bookmark or freeze live tabs |

Honesty notes:
- `free up memory` / `reduce ram` are now **fair game**: saving a session *closes* the tabs, which genuinely reclaims RAM and CPU. Frame it as "close to free memory," never as background suspension.
- Keep avoiding *suspender / discard* terms — Stash doesn't keep tabs alive-but-frozen, so ranking there tanks conversion and the Store quality signal.
- `bookmark manager` stays on the avoid list — different job, low relevance.

---

## 2. Store listing copy (paste-ready)

> **Hard rule: never name a competitor in the listing.** Chrome Web Store policy says
> focus on what *your* item does and why to install it — so any rival product name is
> off-limits in the name, summary, and description. Capture brand-comparison search
> intent **off-store only** (landing pages, Reddit, Show HN), never in the listing.
> All copy below is competitor-free by design. (The competitor names in §0/§1 are
> internal strategy notes and off-store targets — not listing copy.)

### Name (75 max; ~32 visible in search) — 40 chars
```
Stash - Tab Manager, Save & Restore Tabs
```
Keep this. Brand first for recall, head keyword "Tab Manager" inside the visible
truncation (`Stash - Tab Manager, Save & Re…`), plus "Save & Restore Tabs" capturing
the two core intents. (Note: hyphen, never an em dash.)

- **A/B variant** (test once there's traffic; the benefit-suffix grabs the high-volume
  memory intent): `Stash - Tab Manager: Save Tabs & Free Memory` (44). Only swap if it lifts
  install rate — the current name already reads cleaner and keeps "Restore."

### Summary / short description (132 max) — 130 chars
```
Save your open tabs in one click to free up memory, then restore them any time. A fast, private tab manager that ends tab clutter.
```
Memory-forward and competitor-free. Lands the action (*save in one click*), the highest-value
honest benefit (*free up memory* — saving closes the tabs), the restore promise, and the head
term (*tab manager*), in the one field users actually read. This is live in the package
(`wxt.config.ts` → `manifest.description`).

- **A/B variant** (keyword-max, no competitors): `Too many tabs? Save them in one click to free up memory, restore any time. A fast, private tab manager with auto-save and dark mode.`
  Denser on new-feature terms; test against the primary for conversion.

### Detailed description (16,000 max)
First three lines matter most — they show before "Read more" and carry the most ranking
weight. Keywords are woven naturally, never stuffed.

Concise, human, no em dashes, no competitor names, no "forever." This is the live copy
(kept in sync with [ASO-current-live.md](ASO-current-live.md)).
```
Open tabs pile up. They slow your browser and eat memory, but you don't want to close them and lose your place.

Stash fixes that. One click saves every tab in your window into a named, searchable session, then closes them so your memory and CPU go back to the tabs you're actually using. Bring the whole set back whenever you want. Nothing gets lost.

FREE UP MEMORY
Every open tab is a live page using RAM. Save a session and Stash closes those tabs and hands the memory back. Restoring is just as safe: tabs come back unloaded and load only when you click them, so even hundreds of tabs won't choke your browser.

THE BASICS
- Save all your tabs in one click, or save a single tab from the right-click menu.
- Restore a full session or just one tab. Press Ctrl+Shift+S (Cmd+Shift+S on Mac) to save without opening the popup.
- Auto-save snapshots your tabs every few minutes, so a crash never sets you back.
- Search every session, title, and URL to find any tab fast.
- Rename, reorder, and sort sessions. Light and dark themes built in.
- Deleted sessions stay in trash for 30 days. Export or import your whole library as JSON anytime.

PRIVATE BY DEFAULT
Everything stays on your device. No account, no servers, no analytics. Stash never sends your tabs or browsing anywhere.

Free to use. Install it and start saving tabs.
```

### Category
- **Currently set:** Tools (matches the live listing). Fine — most tab managers sit here.
- If you ever re-evaluate, Productivity is the alternative; don't churn it without a reason.

### Language
- **Currently:** English only. Set the listing language so users find it — and see §6:
  localizing into more languages is the single biggest untapped ranking lever.

---

## 3. Visual assets (conversion)

Most installs are decided by the icon + first 2 screenshots; few users scroll.

### Icon
- Already shipped (16/32/48/128). Must read at 16px in the toolbar and 128px in the store.
  Verify the mark is recognizable at 16px and the buttermilk/blue contrast holds on both
  light and dark store backgrounds.

### Screenshots (1280×800, up to 5) — caption each with a benefit, in priority order
Shots 1–2 decide most installs; lead with the strongest. Show the **dark theme** in at
least one shot — it's a freshly-shipped, frequently-searched feature and signals "modern."
1. **The library, full of sessions.** Caption: "Every tab, saved and one click from coming back."
2. **One-click save (popup + Save tabs).** Caption: "Save a whole window of tabs instantly."
3. **Restore a big session — dark mode.** Caption: "Reopen hundreds of tabs without crashing your browser." (Doubles as the dark-theme shot.)
4. **Search.** Caption: "Find any tab by name, title, or URL."
5. **Auto-save snapshots / trash.** Caption: "Auto-saves every few minutes — and 30-day trash. Private by default; nothing leaves your device."

Captions do the selling — bake the keyword + benefit into the image text, not just the alt.

### Promo tiles
- Small tile (440×280): wordmark "Stash" + "Save & restore your tabs" on the buttermilk canvas.
- Marquee (1400×560, optional but boosts featuring odds): the library screenshot + "The beautiful tab manager." Consider a light/dark split to show the new theme.

---

## 4. "What's new" (release notes template)
Re-engages users and signals active development (a ranking input). Keep it benefit-led:
```
v1.2 — Dark mode is here. Stash now follows your system theme (or lock it light/dark in
Settings), reopens even huge sessions without choking your browser, and auto-saves a
snapshot of your tabs every few minutes so a crash never costs you your work. Private,
local, free.

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
- Track install→active and the listing conversion rate; A/B the first screenshot, the name,
  and the summary (primary vs. keyword-max variant) once there is enough traffic.

### Localization — the #1 untapped growth lever
The small rivals that out-rank their install base (Tab Manager: 52 langs, Tabs in One: 55)
do it through translation: the Store ranks you in every locale you localize for, so each
language is a fresh pool of impressions with almost no added competition. We're English-only.
- **Phase 1 (cheap, high ROI):** translate the listing *copy* (name optional, summary,
  description, screenshot captions) into the top locales — es, pt-BR, de, fr, ru, ja, zh-CN,
  it, tr, id. Listing localization alone lifts ranking in those stores without touching code.
- **Phase 2:** localize the UI. The app is tiny and has little text, so this is far less
  work than for most extensions — a strong moat the bloated competitors won't bother with.
- Keep it honest: only ship a locale once its copy is human-checked, not raw machine output.

---

## 7. Off-store ASO support (drives the ranking inputs)
The PRD's GTM plan feeds the Store's usage signal: Show HN, Product Hunt, the
`/onetab-alternative` and `/best-tab-manager-2026` landing pages, and r/chrome_extensions.
Each backlinks the listing with the head keyword in the anchor text.
```
