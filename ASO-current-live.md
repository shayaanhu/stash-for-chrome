# Stash — Live Store Listing (v1.3)

> The current source of truth for the published Chrome Web Store listing.
> Title and summary ship from the package (`wxt.config.ts`); the description is
> pasted into the dashboard. Strategy and keyword rationale live in [ASO.md](ASO.md).
> No competitor names, anywhere. No "forever" claims.

## Title
```
Stash - Tab Manager, Save & Restore Tabs
```

## Summary
```
Save your open tabs in one click, then find any page later by the words inside it, not just the title. Private, all on your device.
```

## Description
```
Open tabs pile up. They slow your browser and eat memory, but you don't want to close them and lose your place, or lose the thing you were reading.

Stash fixes both. One click saves every tab in your window into a named, searchable session, then closes them so your memory and CPU go back to the tabs you're actually using. Bring the whole set back whenever you want. Nothing gets lost.

SEARCH INSIDE YOUR PAGES
This is what makes Stash different. When you save a tab, Stash remembers the text on the page, not just its title and address. Weeks later, search a phrase you remember reading and Stash finds the page, even when those words were never in the title. It also keeps a readable copy you can open in an instant, straight from your device, so you can still read it if the original page changes or disappears.

FREE UP MEMORY
Every open tab is a live page using RAM. Save a session and Stash closes those tabs and hands the memory back. Restoring is just as safe: tabs come back unloaded and load only when you click them, so even hundreds of tabs won't choke your browser.

THE BASICS
- Save all your tabs in one click, or save a single tab from the right-click menu.
- Restore a full session or just one tab. Press Ctrl+Shift+S (Cmd+Shift+S on Mac) to save without opening the popup.
- Search across every session, title, URL, and the text inside your saved pages.
- Open a saved copy of any page, instantly and offline.
- Auto-save snapshots your tabs every few minutes, so a crash never sets you back.
- Rename, reorder, and sort sessions. Light and dark themes built in.
- Deleted sessions stay in trash for 30 days. Export or import your whole library as JSON anytime.

PRIVATE BY DEFAULT
Everything stays on your device, including the page text Stash saves so you can search it. No account, no servers, no analytics. Stash never sends your tabs or your browsing anywhere.

Free to use. Install it and start saving tabs.
```

## Other listing fields
- **Category:** Tools
- **Language:** English (localizing is the top growth lever — see ASO.md §6)
- **Screenshots:** `store-assets/screenshots/shot-1..5` (+ `promo-small`, `promo-marquee`). shot-4 refreshed for v1.3 to lead on "search inside pages"; shots 1-3, 5 still reflect the live UI (regenerate all with `node .aso/render_store.mjs` if the popup chrome changes).
- **Support URL / Homepage URL:** still empty in the dashboard — worth filling.

## Permissions justification (NEW in v1.3 — required for review)
v1.3 adds `scripting` + `host_permissions: <all_urls>`. The dashboard will require a justification. Suggested text:
> Stash reads the text of a page only at the moment you choose to save that tab, so it can build a private, on-device search index and a readable offline copy of pages you save. Page content is stored locally in your browser and is never transmitted, sold, or shared. The broad host match is needed because a user may save a tab from any site.

Also update the **privacy practices** form: data type "Website content", used only for the extension's core feature, stored locally, not sold or transferred.
