# Stash — Growth Plan

> Written 2026-07-08. The goal: get real users for Stash (Chrome tab manager +
> local full-text web archive). Everything below is grounded in what's actually
> shipped in v1.3.0.

---

## TL;DR — the one idea

**Stop marketing Stash as a tab manager. Market it as a private, local, searchable
memory of everything you read.**

"Save tabs + free RAM + restore" is a dead-red-ocean category — Session Buddy owns
it with 1M free users. You cannot win that pitch or that search term.

But Stash does something none of the competitors do (verified in code, v1.3):
- Captures the **real text on each saved page** and lets you **search inside it**
  weeks later — even if the words were never in the title/URL.
  (`entrypoints/background.ts`, `src/shared/content-store.ts`)
- Keeps an **offline saved copy** you can open and read from disk, even if the
  original is 404 or you're offline. (`entrypoints/reader/main.ts`)
- 100% local, no account, no server, no analytics.

That's not "OneTab #16." That's a **local-first personal web archive with full-text
search.** Different shelf, far less competition, stronger emotional hook. RAM-freeing
becomes a *supporting* benefit, not the headline.

---

## Why the first Reddit post failed (300 views, 0 installs)

1. **Wrong audience.** r/chrome_extensions is mostly other extension developers, not
   tab-drowning users. Great for feedback, terrible for user acquisition.
2. **You told them not to install.** "Feedback more than installs" → people obeyed.
3. **Buried the lede.** The unique feature (full-text search of saved page content +
   offline copies) was paragraph 4. The saturated feature (tab parking) was the
   headline. Backwards.

---

## The plan, in priority order

### 1. Reposition the Chrome Web Store listing (do first — passive, compounding)
CWS search is where free extensions actually grow long-term.

- Rewrite title/summary/description around the **search-inside-pages / offline
  archive** wedge, not "tab manager" (a term you can't win).
- Add a keyword cluster: `search inside pages`, `offline article saver`,
  `read later`, `web page archive`, `save articles offline`, `full-text search`.
- Keep the RAM/tab-parking copy, but demote it to a supporting section.
- Source of truth for the listing: `ASO-current-live.md` + strategy in `ASO.md`.

### 2. Localize the listing to 15–20 languages (highest-ROI passive move)
Your own competitor notes prove it:
- "Tabs in One" — 2K users, **55 languages**
- "Tab Manager" — 1K users, **52 languages**
- Session Buddy — 1M users but **English only** ← the gap to exploit

Machine-translate title + summary + description into ~15–20 languages. A few hours
of work, multiplies your searchable surface area. Claude can generate the full set.

### 3. Fix the funnel before pouring people in
- **Fill Support URL + Homepage URL** (currently empty per `ASO-current-live.md`).
  Dead links hurt trust and store ranking. A one-page site is enough.
- **Add an in-app review prompt.** Rating count is the biggest CWS ranking +
  conversion factor and Stash is at a cold start. Trigger a gentle
  "enjoying Stash? ⭐ rate it" after a happy moment (e.g. 5th session restored).

### 4. Post where the PAIN lives, not where extensions are discussed
Lead with the *problem* ("I kept losing articles I knew I'd read"), demo the search,
put the install link at the TOP. Never say "feedback > installs."

Target communities (heavy readers/researchers who hoard tabs and fear losing them):
- **Hacker News — "Show HN"**: local-first + privacy + offline + full-text search is
  HN catnip. One front-page hit ≈ thousands of exactly-right users. Best single shot.
- **r/DataHoarder**: "local, offline, full-text-searchable saved copies" is their
  religion. Frame around the offline archive.
- **r/ObsidianMD, r/Zettelkasten**: "never lose a source you've read."
- **r/productivity, r/GetStudying, r/GradSchool, r/PhD**: tab hoarders who fear loss.
- **r/SideProject, r/coolgithubprojects**: allow self-promo directly.
- **Lobsters + the local-first web community** (localfirstweb): small but perfect fit,
  they amplify.

Rule: match each sub's vibe in the first line. DataHoarder = "local + offline
archive." Obsidian = "never lose a source." Always check self-promo rules first.

---

## This-week checklist
- [ ] Rewrite CWS listing around the search/archive wedge
- [ ] Localize listing to 15–20 languages
- [ ] Fill Support + Homepage URLs (ship a one-page site)
- [ ] Add in-app review prompt after a happy moment
- [ ] Post 1 "Show HN" + 1 r/DataHoarder post (problem-first, link at top)
- [ ] Reuse the r/SideProject / r/coolgithubprojects post (draft saved separately)

---

## Positioning cheat-sheet (reuse everywhere)
**One-liner:** "Stash remembers everything you read and lets you search it later — by
the words that were on the page, not just the title. Local, private, offline."

**Order to pitch benefits:**
1. Search inside pages you've already closed (the hook)
2. Offline saved copies — read it even if the original's gone
3. 100% local & private, no account
4. Save tabs in one click / free up RAM (supporting)
5. Restore whole sessions, auto-save crash protection (table stakes)

**Never lead with:** "tab manager," "free up memory," "save and restore tabs."
Those put you next to Session Buddy, where you lose.
