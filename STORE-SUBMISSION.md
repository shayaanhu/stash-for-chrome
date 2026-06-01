# Chrome Web Store submission notes

Copy-paste material for the Web Store developer dashboard. Stash is local-only: no
servers, no accounts, no analytics, no remote code. Nothing leaves the user's machine.

## Listing

Full keyword strategy + paste-ready copy (name, summary, detailed description, screenshot
captions) live in [ASO.md](ASO.md). Summary:

- **Name:** Stash - Tab Manager, Save & Restore Tabs
- **Summary (132 char max):** Save and restore browser tabs in one click. A beautiful tab manager and OneTab alternative that declutters your window.
- **Detailed description:** see ASO.md §2.
- **Category:** Productivity
- **Single purpose:** Save the user's open browser tabs into named sessions and restore them later.

## Permission justifications

Paste these into the "Permission justification" fields during review.

- **tabs** — Required to read the URL and title of the user's open tabs when they choose to save a session, and to reopen those tabs on restore. URLs/titles are stored only in local extension storage.
- **storage** — Stores saved sessions and the user's settings locally via `chrome.storage.local`.
- **unlimitedStorage** — Heavy users accumulate many sessions; this lifts the default storage cap so saved tabs are never silently dropped.
- **contextMenus** — Adds "Save this tab" / "Save all tabs in this window" right-click entries.
- **alarms** — Runs a periodic background task that permanently removes trashed sessions after their 30-day retention window.
- **Host permissions:** none requested. No content scripts, no page access. Tab data is only read through the `tabs` API when the user explicitly saves.

## Data usage disclosures (Privacy practices tab)

- Does this item collect or use personal/sensitive user data? **It is handled locally and never transmitted.**
- Web history (tab URLs/titles): collected and stored **locally only**, to provide the save/restore feature. **Not sold, not transferred, not used for anything unrelated.**
- Remote code: **No.** All code ships in the package.
- Certify compliance with the Developer Program Policies: **Yes.**

## Privacy policy

> **Stash Privacy Policy**
>
> Stash stores everything on your own device. When you save a session, the URLs and
> titles of the tabs you choose to save, plus your settings, are written to your
> browser's local extension storage (`chrome.storage.local`). This data never leaves
> your machine: Stash has no servers, no account system, no analytics, and makes no
> network requests. Deleted sessions sit in a local trash for 30 days and are then
> permanently removed. You can export your data to a JSON file or delete it at any
> time from the extension. Because nothing is transmitted, there is nothing for us to
> see, store, or share.
>
> Contact: <add your email>.

Host this text at a public URL (e.g. the landing page `/privacy`) and link it in the dashboard.

## Pre-submit checklist

- [ ] `npm run typecheck` clean
- [ ] `npm test` green
- [ ] `npm run zip` produces the upload artifact (WXT writes it under `dist/`)
- [ ] Fill the email in the privacy policy + dashboard contact
- [ ] 5 screenshots at 1280×800 and a 440×280 promo tile
- [ ] Privacy policy URL is live and linked
