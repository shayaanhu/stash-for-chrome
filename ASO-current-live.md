# Stash - Live Store Listing (v1.3.1)

> The current source of truth for the published Chrome Web Store listing.
> Title and summary ship from the package (`wxt.config.ts`); the description is
> pasted into the dashboard. Strategy and keyword rationale live in [ASO.md](ASO.md).
> No competitor names, anywhere. No "forever" claims.

## The rule this rewrite is built on

**Discovery terms and differentiation terms are different jobs, and the title is a
discovery field.**

The previous title led with "Search Inside Saved Tabs". That is the correct *pitch*
and a terrible *query*: nobody types it into the store box, so we ranked first for
zero volume. The wedge sells the install once someone is looking at the listing. It
cannot be what makes them look.

So: the title leads with a phrase people actually type, then carries the wedge, then
the two category words. The wedge moves to the summary, the first line of the
description, and screenshot 1, where it does its real job of converting.

## Title
```
Save Tabs, Search Inside Them - Stash Tab & Session Manager
```
59 / 75 characters. Every segment is doing work:
- `Save Tabs` - a real, moderate-competition query, and the literal action a user
  wants. Prime position, where the store weights title matches hardest.
- `Search Inside Them` - the wedge, and it makes the title read as a sentence rather
  than keyword soup. Survives the ~45-character truncation in search results, so the
  differentiator is still visible in the list view.
- `Tab & Session Manager` - both category terms in one phrase. We will never rank on
  the head of either, but they qualify us for the long tail ("session manager for
  chrome", "tab manager save tabs") where the incumbents are not optimizing.

Brand sits mid-string on purpose. Convention in this category is brand-first, but a
brand nobody searches earns nothing in the highest-weighted position on the listing.

## Summary
```
Save all your tabs in one click to free up memory. Later, find any page by the words that were inside it. Local and private.
```
124 / 132 characters. Picks up `free up memory`, the highest-volume phrase we could
not fit in the title, then delivers the wedge in plain language.

## Description
```
You saved that page. Weeks later you cannot remember the site or the title, only a phrase that was written on it. Type that phrase into Stash and the page comes back.

That is the difference. Every other tab manager saves a link. Stash saves the words on the page too, so you can find anything you kept by what you actually read, not by what it happened to be called.

SAVE YOUR TABS IN ONE CLICK
One click saves every tab in your window into a named group, then closes them. Your window is clear, your memory and CPU go back to the tabs you are actually using, and nothing is lost. Bring the whole group back whenever you want, or reopen a single tab.

FREE UP MEMORY
Every open tab is a live page holding RAM. Save a group and Stash hands that memory back. Restoring is just as light: tabs come back unloaded and load only when you click them, so even hundreds of tabs will not choke your browser.

SEARCH INSIDE THE PAGES YOU SAVED
One search box covers group names, tab titles, addresses, and the full text of the pages you saved. The matching line is shown in the result, so you can see it is the right page before you open it. This is the part nothing else does.

OPEN A SAVED COPY, OFFLINE
Stash keeps a readable copy of every page you save. Open it instantly from your own disk with no network, and read it even if the original has changed, gone behind a paywall, or disappeared.

NEVER LOSE A SESSION
- Press Ctrl+Shift+S (Cmd+Shift+S on Mac) to save everything without opening the popup.
- Save a single tab from the right-click menu.
- Auto-save snapshots your tabs every few minutes, so a crash or an accidental close never sets you back.
- Deleted groups sit in the trash for 30 days.
- Undo on every destructive action.
- Export or import your whole library as JSON whenever you want.

MADE TO LIVE IN
Rename groups, reorder them, drag tabs between them, select many at once, and sort however you like. Light and dark themes built in. It stays quick when your library gets big.

PRIVATE BY DEFAULT
Stash reads a page only at the moment you choose to save that tab. It does not read, watch, or capture the tabs you have open, and it never runs in the background.

Everything then stays on your device, including the page text that makes search work. No account, no servers, no analytics, no tracking. Nothing is ever uploaded or sold.

Free to use. Install it, press Ctrl+Shift+S, and get your window back.
```

Keyword coverage in the body, all placed in sentences a human would actually write:
`tab manager`, `save tabs`, `free up memory`, `session`, `restore`, `search inside
pages`, `offline`, `crash recovery`, `auto-save`, `export import`, `dark mode`,
`private`, `local`.

## Other listing fields
- **Category:** Tools
- **Language:** English. Localizing is a real lever but it multiplies impressions, and
  at a cold start there are almost none to multiply. Revisit after the first few
  hundred installs (see ASO.md §6).
- **Screenshots:** `store-assets/screenshots/shot-1..5` (+ `promo-small`,
  `promo-marquee`). Shot 1 must carry the wedge, since the title now leads with the
  discovery term instead. Regenerate with `node .aso/render_store.mjs`.
- **Homepage URL:** `https://stashyourtabs.com/`
- **Support URL:** `https://stashyourtabs.com/support`

Both URL fields were empty in the dashboard. Fill them. They are a trust signal in the
listing, a ranking input, and the only route a confused user has to reach you instead
of leaving a one-star review.

## Permissions justification (required for the v1.3 review)
v1.3 adds the `scripting` permission and host access (`<all_urls>`). Chrome flags host
access for an in-depth review, which delays publishing. This is expected and
approvable. Paste the text below into the matching dashboard fields.

**scripting:**
> Stash uses the scripting API to read the visible text of a tab at the moment the user chooses to save (stash) that tab. It injects a one-time script that returns the page's readable text, which Stash stores locally on the user's device so the user can later search inside the pages they saved and open an offline readable copy. The script runs only in response to an explicit save action, never in the background, and the extracted text is never sent to any server.

**Host permission (`<all_urls>`):**
> Stash lets the user save any open tab, from any website, into a local group and search inside the saved page's text. To read the page text of whatever tab the user saves, Stash needs host access to the site that tab is on. Because a user can save a tab from any website, this access must cover all sites. It is used only at the moment the user saves a tab, solely to read that page's text for the extension's core save-and-search feature. No page content is transmitted, sold, or shared; everything is stored locally on the user's device.

**Data safety form:** data type "Website content"; used only for the app's core feature; stored locally on the device; not sold or transferred.

Note: the in-depth review is triggered by the broad host access. If you ever want to avoid it, the alternative is `optional_host_permissions` (request access at runtime the first time content capture runs). That is a code change and adds a one-time grant prompt, so it is only worth doing if the review delay becomes a real problem.
