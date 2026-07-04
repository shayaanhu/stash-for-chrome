# Stash — Big Picture

The north-star vision. Read this when you forget why we're building what we're building.

## The pivot

We are NOT going the ADHD route. That meant out-building Skipper/Skeema on features (auto-close stale tabs, auto-grouping) and competing in a crowded, feature-arms-race lane. Dropped.

We are also NOT just "a prettier OneTab." That job is a free commodity. Beautiful and reliable are reasons to STAY, not reasons to ARRIVE. They are retention, not acquisition. Not a wedge on their own.

## The wedge

Stop selling the parking lot. Own what accumulates in it.

A feature is not a moat. **Accumulation is.** The longer someone uses Stash, the more valuable it gets and the more painful it is to leave. Nothing about "beautiful" or "reliable" compounds. A growing pile of every page they ever thought was worth keeping DOES compound.

So the product is not "save tabs better." It is:

> **Stash quietly becomes your private, searchable memory of every page you ever cared about. You find any of it by what was IN it, not just what it was called. And it opens instantly, from local disk, even if the real page is now dead or paywalled.**

## The one moment that proves it

> You closed a tab three weeks ago. You don't remember the site. You type two words that were INSIDE the page. It's back on screen in under 100ms, rendered instantly from local disk, and it still works even though the real page is gone.

Nobody can do this today. Not browser history (title/URL only). Not bookmarks (no content). Not OneTab. Not Google (can't refind YOUR exact thing). If this moment feels like magic, we have a product.

## Why it's a real moat (not just a feature)

1. **It compounds.** Month one it's a nicer OneTab. Month six it's an archive of thousands of pages of full text that exist nowhere else = switching cost = defensibility. OneTab has been a flat link list for 10+ years and won't build this; it's a different product.
2. **Our "weakness" becomes the pitch.** Local-only was a mild privacy nicety for a parking lot. For "a searchable memory of everything I read," local + private is the entire reason to trust it. Nobody wants their reading history in someone's cloud.
3. **It's already half-built.** We have global search UI, favicon rendering, a robust local store, smart auto-naming. The delta is content capture + a content index.
4. **It monetizes, with proof.** mymind proves people pay real yearly money for a private, no-folders, "just save it and search it later" second memory. Our edge over mymind: born from the tab-hoarding flow, one click, extension-native, cheaper.

## The two strengths we already have (that this weaponizes)

- **Trust (the real moat, currently invisible):** the codebase is obsessive about never losing data. Save commits before closing tabs; restore only consumes a session on a fully clean restore; the window never closes out from under you; serialized read-modify-write; schema versioning + migrations; undo on every destructive action; 30-day trash; restore runs in the service worker so it survives popup close. Skipper reviews are full of "held my data hostage" and "lost all my tabs." The thing they fail at is the thing we're built for.
- **Taste:** locked warm-paper aesthetic, Fraunces display, terracotta accent, grain canvas, spring motion, designed empty states. Gets the install.
- **Craft:** drag between groups, marquee select, pull-tab-into-new-group, bulk actions, keyboard shortcut, context menus, global search across open + stashed. Makes them stay and tell someone.

## "Super fast to open" — the differentiator we almost missed

Two ways to open a stash:
- **Open live:** reopens the URL. Network-bound, normal.
- **Open the saved copy:** renders the local snapshot instantly from disk. No spinner, works offline, works when the page is GONE. That "click and it's just there" feeling is cache-like speed OneTab literally cannot produce. Lead with this in demos.

## Architecture (the Apple-Spotlight-not-Windows-search version)

- **Capture:** content script runs Mozilla Readability.js on stash to pull clean main text + a lightweight readable HTML snapshot. Snapshot doubles as anti-link-rot copy AND instant-open copy.
- **Storage tier:** NOT chrome.storage.local for this (small JSON KV). Use IndexedDB / OPFS with the `unlimitedStorage` permission (drops the quota cap, uses real disk). 5GB target is feasible. Snapshots stored as blobs.
- **Index, staged:**
  - v1: **FlexSearch** (in-memory inverted index, sub-ms, serializes to disk). Fine up to tens of thousands of pages. Ships fast.
  - v2: **SQLite compiled to WASM with FTS5**, backed by OPFS so the index lives on disk not RAM. Real ranked full-text engine, scales to GBs. This is our Spotlight.
- **MV3 gotcha:** the background service worker is killed after ~30s idle, so the heavy SQLite/OPFS worker can't live there. Use a `chrome.offscreen` document to host the index worker. That's the one non-obvious piece.

## Indexing is NOT the moat

FlexSearch / FTS5 is a weekend of work; anyone can add it. The durable assets the index only ENABLES are:
1. the accumulating private corpus (switching cost), and
2. capture + open quality (pages actually extract cleanly, opening is instant).
Fall in love with "it always caught the page and always hands it back instantly," not with the search algorithm.

## Guardrails (so we ship, not spiral)

- Capture won't be 100%. SPAs, auth-walled pages, PDFs, videos extract poorly. Fall back to title/URL, mark it "link only," move on. Don't chase 100%.
- We're now in "private web memory" (near mymind/Heptabase). Our angle stays distinct: tab-flow-native, one click, local, beautiful, cheap.
- Scope discipline. This dies if we build FTS5 + OPFS + 5GB + snapshots for two months and never feel the magic moment.

## THE THIN SLICE (build this first)

Smallest thing that produces the magic moment. NOT the 5GB Spotlight engine.

1. On stash, a content script grabs the page's readable text via Readability, store it (IndexedDB).
2. Global search (already built) also matches that stored text, with a snippet showing the matching line.
3. Optional stretch: store the readable snapshot and add "open saved copy" for instant offline render.

FlexSearch, no SQLite yet, no offscreen doc yet. A day or two. Then type a word you know was INSIDE a page you closed. Either it feels like magic or it doesn't. If it does, build the real Spotlight underneath. If not, we spent two days, not two months.

## Platform decision: extension, local-first

The core wedge REQUIRES reading the content of the user's open tabs. A pure web app / SaaS cannot do that. So a browser extension is mandatory; a web app alone is impossible for the capture flow.

Decision: **local-first extension now.** Zero backend, no accounts, no server cost, preserves the local/private moat, ships fast, matches our strengths. The rich "second brain" browsing/search UI lives in a full-page extension view (chrome-extension:// app page) — app-like UX with no server.

Recurring revenue does NOT require a web app: ExtensionPay/Stripe can run a subscription inside an extension, or a one-time/lifetime license unlocks Pro (5GB, FTS5, snapshots).

Future (only if traction): optional, opt-in cloud sync as the paid tier for cross-device + backup + sharing (the Obsidian/mymind playbook). Local stays the default so the privacy moat survives. Accept the tradeoff for now: the archive is device-bound until sync exists.

## Positioning line

Not "OneTab but pretty." **"Close a tab and never lose what was in it. Stash remembers the page, not just the link, and it's yours, private, forever."**
