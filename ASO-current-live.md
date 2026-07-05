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

## Permissions justification (required for the v1.3 review)
v1.3 adds the `scripting` permission and host access (`<all_urls>`). Chrome flags host access for an in-depth review, which delays publishing. This is expected and approvable. Paste the text below into the matching dashboard fields.

**scripting:**
> Stash uses the scripting API to read the visible text of a tab at the moment the user chooses to save (stash) that tab. It injects a one-time script that returns the page's readable text, which Stash stores locally on the user's device so the user can later search inside the pages they saved and open an offline readable copy. The script runs only in response to an explicit save action, never in the background, and the extracted text is never sent to any server.

**Host permission (`<all_urls>`):**
> Stash lets the user save any open tab, from any website, into a local group and search inside the saved page's text. To read the page text of whatever tab the user saves, Stash needs host access to the site that tab is on. Because a user can save a tab from any website, this access must cover all sites. It is used only at the moment the user saves a tab, solely to read that page's text for the extension's core save-and-search feature. No page content is transmitted, sold, or shared; everything is stored locally on the user's device.

**Data safety form:** data type "Website content"; used only for the app's core feature; stored locally on the device; not sold or transferred.

Note: the in-depth review is triggered by the broad host access. If you ever want to avoid it, the alternative is `optional_host_permissions` (request access at runtime the first time content capture runs). That is a code change and adds a one-time grant prompt, so it is only worth doing if the review delay becomes a real problem.
