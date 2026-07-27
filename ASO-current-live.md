# Stash - Live Store Listing (v1.3.3)

> The current source of truth for the published Chrome Web Store listing.
> Title and summary ship from the package (`wxt.config.ts`); the description is
> pasted into the dashboard. Strategy and keyword rationale live in [ASO.md](ASO.md).
>
> **No competitor talk of any kind. Not names, and not unnamed swipes either.**
> "Every other tab manager only saves a link", "this is the part nothing else does",
> "unlike other extensions" are all the same violation wearing a disguise. The listing
> describes what Stash does and stops there. If a sentence only lands because the
> reader pictures someone else's product, cut it and say the thing straight.
> No "forever" claims.

## The positioning

> **Closing a tab should never feel like losing it.**

The feeling we sell is **relief**. You can close the lot, right now, and nothing bad
happens. Your tabs are safe, they are yours, and one click brings them back.

Two things changed from the previous listing:

- **Search-inside is no longer the hook.** Good feature, wrong job. It is a reason to
  stay, not a reason to arrive, because a user who has never had it does not know to
  want it. Tab guilt is a feeling people already have today and recognise in one line.
  Search now sits in a supporting section.
- **The title got short.** Everything established in this category runs 30 to 45
  characters, brand first. A 59-character keyword sentence reads as try-hard beside
  them and gets truncated in search results anyway. The length was buying keywords we
  could not rank on regardless.

## Title
```
Stash - Close Tabs Without Losing Them
```
38 characters, inside the band the category occupies.

It states the promise as plainly as it can be stated. `Close Tabs` is the action that
causes the anxiety, `Without Losing Them` is the answer, and there is nothing clever
in the way. It reads like a person talking rather than a listing competing, which is
the point of dropping the keyword sentence in the first place.

**The trade, made deliberately:** this title does not contain `Tab Manager`, so the
title alone is not eligible for the long tail hanging off the category term. That is
paid for in two places. `Tab Manager` now opens the summary, and the description body
still carries it. Title matches weigh most, so this is a real cost, accepted in
exchange for a line that actually lands on a human being.

`Close Tabs` and `Tabs` are still in the title, so the closing-related queries are
covered directly.

Alternates held in reserve:
- `Stash Tab Manager - Save Tabs for Later` (39) - keyword and feeling in the same words
- `Stash - Save Your Tabs, Clear Your Head` (39) - best purely emotional, buys no search
- `Stash - Save and Restore Tabs in One Click` (42) - best for discovery, says nothing about feel
- `Stash - Close Tabs, Keep Them All` (33)

## Summary
```
A tab manager that saves every open tab in one click and frees your memory. They stay safe on your device until you want them back.
```
130 / 132. Opens with `tab manager` to recover the category term the title gives up,
then `saves every open tab`, `one click` and `frees your memory` (the highest-volume
phrase that will not fit in a 38-character title), and closes on the safety promise.

Deliberately does **not** repeat the title. The old summary opened "Close your tabs
without losing them", which is now the title verbatim, and a summary that echoes the
title wastes the only other 132 characters the store gives us.

## Description
```
You know the feeling. Twenty tabs open, all of them "important", and you cannot close any of them in case you need one later. So they sit there, slowing everything down.

Stash is a tab manager built around that one problem. One click saves every tab in the window and closes them. They are safe in a named group on your own machine, and one click puts them all back.

Close everything. Nothing bad happens.

SAVE EVERYTHING, OR ONLY WHAT YOU PICK
Click the toolbar icon to save every open tab at once. Or pick the exact ones you want, by clicking them or dragging a box across a run of them, and save only those. What you pick can start a new group or drop straight into a group you already have. Right-click any page to save just that tab. There is a keyboard shortcut too, and you can change it to whatever you like.

CLOSING IS YOUR CALL
Save and close in one move when you want the window clear. Or save and leave everything open, when you only want a copy of where you are. Stash remembers which way you prefer and does that next time.

BRING THEM BACK
Restore a whole group, or click a single tab to take only that one. Tabs come back unloaded and load when you click them, so hundreds reopen without stalling your browser.

FREE UP MEMORY
Every open tab is a live page holding RAM. Saving a group hands it straight back.

BUILT SO YOU DO NOT LOSE TABS
- Auto-save snapshots your tabs every few minutes, so a crash costs you nothing.
- Undo on every destructive action.
- Deleted groups sit in the trash for 30 days.
- Saving commits before a single tab closes, so a save never half-happens.
- Export or import your whole library as JSON. Nothing is locked in.

FIND ANY TAB
Search group names, titles and addresses. It also searches the text of the pages you saved, so a half-remembered phrase is enough to get one back. Every saved page keeps a readable offline copy that opens instantly from your disk.

MADE TO LIVE IN
Rename, reorder, drag tabs between groups, select several at once, sort how you like. Light and dark themes.

PRIVATE BY DEFAULT
Stash reads a page only at the moment you save that tab, never in the background. Everything then stays on your device. No account, no servers, no analytics, nothing sold.

Free to use. Install it, save your first group, and let the tabs go.
```

Roughly 40% shorter than the previous version. Keyword coverage held: `tab manager`,
`save tabs`, `close tabs`, `save tabs for later`, `free up memory`, `restore`, `group`,
`auto-save`, `crash`, `export import`, `dark mode`, `offline`, `private`, `local`.

## Other listing fields
- **Category:** Tools
- **Language:** English.
- **Screenshots:** `store-assets/screenshots/shot-1..5` (+ `promo-small`,
  `promo-marquee`). Shot 1 now has to carry **relief**, not the search feature. The
  strongest single frame is a crowded window collapsing to a clean one with the group
  saved beside it. Regenerate with `node .aso/render_store.mjs`.
- **Homepage URL:** `https://stashyourtabs.com/`
- **Support URL:** `https://stashyourtabs.com/support`

## Permissions justification
`scripting` + `<all_urls>` trigger an in-depth review. Expected and approvable.

**scripting:**
> Stash uses the scripting API to read the visible text of a tab at the moment the user chooses to save (stash) that tab. It injects a one-time script that returns the page's readable text, which Stash stores locally on the user's device so the user can later search inside the pages they saved and open an offline readable copy. The script runs only in response to an explicit save action, never in the background, and the extracted text is never sent to any server.

**Host permission (`<all_urls>`):**
> Stash lets the user save any open tab, from any website, into a local group and search inside the saved page's text. To read the page text of whatever tab the user saves, Stash needs host access to the site that tab is on. Because a user can save a tab from any website, this access must cover all sites. It is used only at the moment the user saves a tab, solely to read that page's text for the extension's core save-and-search feature. No page content is transmitted, sold, or shared; everything is stored locally on the user's device.

**Data safety form:** data type "Website content"; used only for the app's core feature; stored locally on the device; not sold or transferred.
