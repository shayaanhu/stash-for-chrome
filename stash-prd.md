# Stash — Product Requirements Document

> A beautifully designed tab manager Chrome extension. Save the tabs you don't need now, restore them when you do. Built for people drowning in 50+ open tabs.

**Version:** 0.1 (draft)
**Author:** Shayaan Qazi
**Date:** May 2026
**Status:** Pre-build

---

## 1. Overview

### 1.1 What this is

A Chrome extension that lets users capture all currently open tabs into a named session, close them, and restore them later. Replaces the messy reality of "150 open tabs because I'm afraid to close anything" with a clean library of saved sessions.

### 1.2 Why this exists

The tab manager category has 3M+ users on OneTab alone. The category leaders are either visually outdated (OneTab, 2014 UI) or over-engineered productivity suites at $8–19/mo (Workona, Toby). The gap between "free and ugly" and "expensive and bloated" is empty.

Stash fills that gap: free for the basics, $3/mo for power users, with the visual polish of a 2026 indie product.

### 1.3 The one-line pitch

> OneTab, if it didn't look like a SharePoint page from 2014.

---

## 2. The opportunity

### 2.1 Problem

Knowledge workers, students, and researchers accumulate tabs throughout a workday across multiple parallel projects. The result:

- **Memory degradation** — Chrome eats 200+ MB per active tab; 50 open tabs is a noticeable slowdown
- **Mental overload** — visible tab strip becomes unreadable beyond ~15 tabs
- **Loss aversion** — closing a tab feels like losing the context behind it
- **Context bleed** — work tabs, side-project tabs, research tabs, and personal tabs intermix

People want to close tabs without losing them. That's the job.

### 2.2 Market data

| Metric | Value | Source |
|---|---|---|
| OneTab weekly active users | 3M+ | Chrome Web Store |
| Workona users | hundreds of thousands | Their site |
| Average Chrome extension revenue (top performers) | $862K ARR, 83% margin | Chrome Goldmine 2026 |
| Realistic indie extension at 10–50k users | $500–2,500/mo freemium, $500–7,500/mo subscription | Chrome Goldmine 2026 |
| Freemium conversion rate (good extensions) | 2–5% of WAU | Industry benchmark |

A realistic 12-month outcome at sub-1% conversion of 50k WAU = ~$1,500/mo. With good ASO and one viral moment, materially more.

### 2.3 Why now

- Chrome built-in Tab Groups exist but are session-bound (lost on browser restart); they solve a different problem
- AI auto-naming is now cheap enough to be a paid-tier feature (~$0.001 per session via gpt-4o-mini)
- Manifest V3 has stabilised — new extensions can be built without rework concerns
- The category leader hasn't redesigned in ~10 years

---

## 3. Target users

### 3.1 Primary persona — "The Researcher"

Sarah, 31, product manager. Has 4 parallel projects running. By 3pm she has:
- 12 tabs for the launch plan
- 8 tabs for the data analysis
- 6 tabs for the hiring review
- 14 tabs of articles she opened "to read later" three weeks ago

She knows she should close them but worries about losing the trail. Uses OneTab grudgingly because the saved list is "an unreadable wall of links."

**What she values:** order, recoverability, looking at her tools without flinching.

### 3.2 Secondary persona — "The Developer"

Marcus, 27, senior engineer. Each ticket spawns 10+ tabs (Jira, Confluence, GitHub PRs, docs, Stack Overflow). Wants to close everything when the ticket merges but keep it findable for 2 weeks in case of regression.

**What he values:** keyboard shortcuts, search, integrations.

### 3.3 Tertiary persona — "The Student"

Lily, 22, master's student. 40+ tabs per essay. Loses citations regularly.

**What she values:** simple capture, fast restore, "save the chaos before I lose it."

### 3.4 Non-target

- Power productivity geeks who want a Notion-replacement workspace (use Workona)
- People who never have more than 10 tabs (don't need this)
- People who prefer paying $0 forever (will use OneTab)

---

## 4. Competitive landscape

| Product | Users | Price | Strength | Weakness |
|---|---|---|---|---|
| **OneTab** | 3M+ | Free | Trusted, simple, fast | UI unchanged since 2014; no search, no tags, no themes |
| **Workona** | 500k+ | $8–19/mo | Full workspace, browser-replacement ambition | Bloated; opinionated workflow; high price for what most people need |
| **Toby** | 1M+ | Free with paid teams | Visual grid layout | Acquired, then deprecated and revived; trust issue |
| **Session Buddy** | 1M+ | Free | Session save/restore | Looks like 1999; abandoned-feeling |
| **Tabli** | 200k+ | Free | Keyboard-driven | Power-user only; UX is harsh |
| **Chrome Tab Groups** (native) | — | Free | Built-in, no install | Session-only; lost on restart |

**Where Stash sits:** between OneTab and Workona. More than OneTab's flat list; less than Workona's whole-OS ambition. Distinguishable on aesthetics first, modest power-user features second.

---

## 5. Product principles

These are the non-negotiables that govern every design decision.

1. **It is a beautiful object.** Most tab managers feel like accounting software. Stash is the first one a designer would happily install.
2. **Defaults beat configurability.** Power users get keyboard shortcuts, but the default UI is opinionated and clean. No 30-row settings page.
3. **Privacy is the default.** Tabs and sessions live locally in `chrome.storage.local`. Cloud sync is opt-in and paid.
4. **Restore is one click, always.** From any view, restoring a session or tab is one action. Never a confirm dialog.
5. **Don't grow into a workspace.** Resist feature requests that turn this into a project management app. The job is: save tabs, restore tabs, find tabs.
6. **Free tier is genuinely useful forever.** Paid is for power users and supporters, not gated essentials.

---

## 6. Feature scope

### 6.1 MVP (V1.0 — 2 weeks)

**Capture**
- Toolbar icon: one-click "Save all tabs in this window"
- Right-click on page: "Save just this tab"
- Keyboard shortcut: `Cmd+Shift+S` to save all
- Auto-generated session name (date + first tab title)

**Browse**
- Popup view: list of recent sessions (newest first)
- Each session row: name, count of tabs, date saved, hover preview of first 3 favicons
- Click session to expand → see all tabs
- Search bar across all sessions (matches session name + tab titles + URLs)

**Restore**
- "Restore all" button per session (opens all tabs in new window)
- Click any individual tab title to open just that one
- Restored sessions stay in the library unless explicitly deleted

**Manage**
- Rename session (inline edit)
- Delete session (with subtle undo toast for 5s)
- Delete individual tab from session
- "Empty trash" view for 30 days

**Settings (minimal)**
- Default save target: all-tabs-in-window vs all-tabs-in-all-windows
- Keyboard shortcut customisation
- Theme: light, dark, system

### 6.2 V1.1 (week 3–4)

**Paid tier launches** ($3/mo or $24/yr)

- **AI session naming** — gpt-4o-mini call generates meaningful name from tab titles ("Research on Vite plugins" instead of "Tuesday 3pm session")
- **Tags** — manual tags on sessions, filter by tag
- **Themes** — 3 premium themes beyond light/dark
- **Cloud sync** — sessions sync across Chrome installs (Supabase backend)
- **Session export** — JSON, Markdown, or shareable link

### 6.3 Future (V2+)

- Firefox and Edge support
- Native menubar app (macOS first)
- Auto-archive (sessions untouched for N days become archived)
- Tab content snapshot (capture page text, not just URL — for finding "that article I had about X")
- Browser-wide search across all sessions from the address bar
- Team sessions (shared collections, $9/mo team tier)

### 6.4 Explicitly out of scope

- A full project management workspace (Workona's territory)
- Browser replacement
- A web app (extension only for V1)
- Social features
- AI summarisation of articles in tabs (different product)

---

## 7. User flows

### 7.1 First-time save

1. User installs Stash → onboarding popup explains the value in 3 lines, single CTA "Save my tabs now"
2. User clicks → all current-window tabs are captured, named "Friday Afternoon · 23 tabs"
3. Toast confirms: "Saved. Tabs closed. Restore anytime from the toolbar."
4. Tabs close, popup shows the new session at the top of the library

### 7.2 Recurring use

1. User opens popup → sees library, newest sessions first
2. Search bar focused by default (`Cmd+K` from anywhere opens popup with search)
3. User types "vite" → matches a session from 3 days ago containing Vite plugin docs
4. Clicks session → preview expands inline
5. Clicks "Restore all" → opens in new window
6. Session stays in library

### 7.3 Manage clutter

1. User scrolls library → sees sessions 4+ weeks old
2. Right-clicks a session → "Delete" or "Archive"
3. Deleted sessions sit in trash 30 days
4. Trash view accessible from settings

### 7.4 Paid upgrade prompt

Trigger: user has saved 5+ sessions AND has been an active user for 7+ days.

Prompt appears mid-task (e.g., when naming a session): "AI can name this for you. Try Stash Pro free for 7 days."

---

## 8. Visual design direction

### 8.1 Aesthetic

Codename: **Warm Library**. Closer to **Things.app**, **Linear**, **Raycast** than to existing tab managers. Restrained typography, real spacing, deliberate use of colour. No gradients. No glass-morphism. No "AI sparkle" icons. No purple.

The deliberate move: every AI/productivity tool in 2026 converges on cool blues, purple gradients, and electric accents. Going warm-earthy with a single confident terracotta accent makes the product instantly recognisable on a crowded Chrome Web Store listing page.

### 8.2 Locked palette

**Light mode only at launch.** Dark mode deferred (table-stakes but a real design effort; ship the warm vision first, add dark later).

| Role | Hex | Notes |
|---|---|---|
| Background | `#F8F6F1` | Warm off-white, like aged paper |
| Surface | `#FFFFFF` | Pure white for raised cards / popovers |
| Text primary | `#1F1B16` | Warm near-black, not pure black |
| Text muted | `#6B655A` | Warm grey-brown for secondary text |
| Border | `#E5E0D7` | Pale warm grey, barely visible |
| **Accent** | `#C26847` | **Terracotta — the moat** |
| Success | `#5B7548` | Muted forest green |
| Danger | `#B85450` | Muted brick red |

Every colour is warm-spectrum. Nothing fights. The terracotta accent is the only colour that "speaks"; everything else sits down.

### 8.3 Typography

| Use | Font | Notes |
|---|---|---|
| UI body, controls, lists | **Inter** | Workhorse. Familiar. Free. |
| Session names, headers | **Geist** | Free Söhne-alternative. Vercel-designed. Warmth without coldness. |
| Numerics (tab counts, dates) | **JetBrains Mono** | Tabular alignment |

### 8.4 Other specifics

- **Density**: Spacious by default. Settings option for compact view.
- **Animations**: Subtle, Apple-style cubic-bezier easing. No bouncy, no overshoot. Maximum 200ms per transition.
- **Iconography**: Single icon set throughout (Lucide or Phosphor). Consistent weight.
- **Borders**: 1px solid warm grey, never shadow-only. Real edges.
- **Radius**: 6px on cards, 4px on buttons. Restrained, not pill-shaped.

### 8.5 Differentiation moves

- A subtle but real "card" treatment for sessions (offset shadow, paper texture maybe). Not flat.
- Sessions have a small "spine" showing dominant favicons across a horizontal strip — visual recognition aid.
- Empty state isn't a blank screen. It has copy, a visual, and one CTA.
- The terracotta accent appears sparingly — only on the primary CTA and a small "freshly saved" dot. Restraint reinforces the design language.

### 8.6 Reference points

- [Things.app](https://culturedcode.com/things/) — typography, density, restraint
- [Linear](https://linear.app) — speed, keyboard-first, beautiful empty states
- [Raycast](https://raycast.com) — keyboard shortcuts integrated visually
- [Arc Browser](https://arc.net) — modern aesthetic without being trendy

---

## 9. Technical architecture

### 9.1 Stack

| Layer | Tech | Reason |
|---|---|---|
| Build | Vite + React + TypeScript | Familiar from MWM, fast HMR |
| Extension framework | Manifest V3 (no choice — V2 deprecated) | Required by Chrome |
| Storage (free tier) | `chrome.storage.local` | Local, free, no backend |
| Backend (paid tier) | Supabase | Cheap, fast to wire up, scales to thousands of users on free tier |
| Auth (paid tier) | Supabase Auth (email magic link) | Standard, no password reset support burden |
| Payments | Stripe Checkout + customer portal | Boring, reliable, low overhead |
| AI calls | OpenAI gpt-4o-mini (server-proxied so user keys aren't exposed) | Cheap, paid-tier only |
| Landing page | Next.js on Vercel | Same stack, fast SEO |

### 9.2 Extension architecture

```
[Service Worker (background.js)]
  ↕ chrome.storage.local
[Popup (React app)]    [Options page]
  ↕ message passing
[Content scripts (minimal — only for keyboard shortcuts on pages)]
```

Critical: **service worker must persist session state** between Chrome restarts. Use `chrome.storage.local` (survives restarts) not `chrome.storage.session` (lost on browser close).

### 9.3 Data model

```typescript
type Session = {
  id: string                  // uuid
  name: string                 // user-set or auto
  createdAt: number            // ms epoch
  tabs: Tab[]
  tags?: string[]              // paid feature
  archived?: boolean
  deletedAt?: number           // soft-delete (30d trash)
}

type Tab = {
  id: string
  url: string
  title: string
  favicon: string              // dataURL or favicon URL
  capturedAt: number
}
```

### 9.4 Performance constraints

- Saving 100+ tabs must complete in <500ms (chrome.tabs.query + chrome.storage.local.set)
- Search across 50k tab titles must respond in <100ms (in-memory index, no DB call)
- Popup open time must be <100ms (preload data on service worker boot)

### 9.5 Privacy posture

- Free tier: no telemetry, no analytics, nothing leaves the user's machine
- Paid tier: only session metadata syncs (tab URLs + titles, no page contents). User can opt out of sync entirely.
- Privacy policy on the landing page, written in plain language, not lawyer-speak.
- No third-party analytics in the extension itself. (Vercel Analytics on the landing page only.)

---

## 10. Monetization

### 10.1 Pricing

| Tier | Price | Limits |
|---|---|---|
| **Free** | $0 | Unlimited sessions, all core features, local-only |
| **Pro Monthly** | $3/mo | AI naming, themes, tags, cloud sync, export |
| **Pro Annual** | $24/yr (33% off) | Same as monthly |
| **Lifetime** | $49 one-time | Same as Pro, no recurring |

Lifetime tier is a deliberate trust signal — many users are burned by subscription fatigue. It also produces a one-time revenue burst at launch.

### 10.2 Conversion plan

- Free tier is fully functional. No "create account to use" wall.
- Upgrade prompts appear contextually (when user would benefit), not aggressively.
- Free trial of Pro: 7 days, no card required, auto-reverts to free.
- Lifetime tier prominently shown on day 7+ if user hasn't converted to monthly.

### 10.3 Revenue projections

| Month | Installs (cumulative) | WAU | Paid users (target 1%) | MRR |
|---|---|---|---|---|
| 1 | 500 | 200 | 2 | $6 |
| 3 | 5,000 | 1,500 | 15 | $45 |
| 6 | 20,000 | 6,000 | 60 | $180 |
| 12 | 80,000 | 20,000 | 200 | $600 |
| 18 | 200,000 | 50,000 | 500 | $1,500 |

Conservative. Hitting 2% conversion (genuinely possible with good upgrade UX) doubles these. One viral moment (Show HN front page, decent TikTok) compresses the timeline by 6+ months.

---

## 11. Go-to-market

### 11.1 Distribution channels (passive, no grinding)

1. **Chrome Web Store SEO** — title formatted as "Stash — Beautiful Tab Manager", description front-loaded with keywords. Target keywords: `tab manager`, `tab organizer`, `save tabs`, `onetab alternative`.
2. **Landing page SEO** — pages for each long-tail query: `/onetab-alternative`, `/best-tab-manager-2026`, `/save-chrome-tabs`.
3. **Show HN** — once, at v1 launch. Title: "Stash — A beautiful tab manager (because OneTab still looks like 2014)". The honest framing performs well.
4. **Product Hunt** — once at launch. Schedule for a Tuesday-Thursday in a quiet week.
5. **Reddit** — single posts in r/chrome_extensions, r/productivity, r/ChromeOS. Honest framing, not promo-speak.
6. **X / Twitter** — one launch thread + occasional design progress posts. "Build in public" energy.

### 11.2 What to NOT do

- No paid ads (no math yet)
- No Reddit grind (one-shot, not a campaign)
- No Discord servers
- No partnerships
- No newsletters

### 11.3 Marketing assets needed at launch

- Landing page (desk.app or similar — domain check needed)
- Chrome Web Store listing (icon, 1280×800 screenshots × 5, promotional 440×280 tile)
- 30-second screencast / GIF showing capture → close → restore flow
- One static "before/after" image: OneTab UI next to Stash UI

---

## 12. Success metrics

### 12.1 North star

**Weekly Active Users.** This is also the metric Chrome Web Store now ranks by, so it doubles as a SEO signal.

### 12.2 Leading indicators

- **Install → first save rate** — target >70% (anything lower means onboarding is broken)
- **Day 7 retention** — target >40% (industry good)
- **Day 30 retention** — target >25%
- **Free → paid conversion** — target 1% of WAU at month 6, 2% at month 12

### 12.3 Failure thresholds

If by month 3:
- <3,000 total installs → ASO is failing or category is wrong
- <40% day-7 retention → product is failing (people install, try, abandon)
- <0.5% conversion → pricing or upgrade UX is failing

Each failure mode has different fixes; threshold-based diagnostics prevent over-iterating on the wrong thing.

---

## 13. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Chrome's built-in Tab Groups improves to match | Medium | High | Differentiate on persistence (across restarts), search, restore (not Chrome's strengths) |
| OneTab releases a redesign | Low | High | They haven't in 10 years, unlikely to start now |
| Manifest V3 changes break the extension | Medium | High | Use only stable APIs; subscribe to Chrome Extensions dev mailing list |
| ASO doesn't work | Medium | High | Have a Show HN / Product Hunt backup plan |
| Conversion ceiling is <1% | High | Medium | Lifetime tier captures users who don't subscribe but will buy |
| Building well takes longer than 2 weeks | High | Low | Acceptable; ship at 3 weeks if needed |
| Someone clones it visually | Low (initially) | Low | Speed of iteration beats clones |
| Burnout from solo dev grind | Medium | Medium | Hard cap: if no traction in 3 months, ship a few more extensions in the portfolio instead of grinding this one |

---

## 14. Timeline

### Week 1 (build core)
- Day 1: Manifest V3 setup, popup React app skeleton
- Day 2: chrome.tabs and chrome.storage integration; save all tabs
- Day 3: Session list view, restore all/single
- Day 4: Rename, delete, soft-delete (trash)
- Day 5: Search across sessions
- Day 6: Keyboard shortcuts; settings page

### Week 2 (UI polish + assets)
- Day 7-8: Design pass — typography, spacing, locked palette implementation
- Day 9: Empty states, error states, onboarding popup
- Day 10: Performance audit (100+ tabs, search speed)
- Day 11: Landing page (Next.js)
- Day 12: Chrome Web Store listing assets (screenshots, GIF, description)
- Day 13: QA on 3 different real-world use patterns
- Day 14: Submit to Chrome Web Store (review: 1-3 days)

### Week 3 (paid tier prep)
- Stripe integration
- Supabase backend for cloud sync
- AI session naming via gpt-4o-mini (server-proxied)
- Pro upgrade UI
- Free trial logic

### Week 4 (launch)
- Soft launch: tell ~5 people, get bug reports
- Hard launch: Show HN, Product Hunt, X thread
- Monitor reviews and respond to every one in first 30 days

### Month 2-3
- Iterate based on real usage data
- Build extension #2 in the portfolio using the same template

---

## 15. Open questions

These need answers before or during build:

1. **Domain**: `stash.app` and `getstash.com` need to be checked. Realistic fallbacks: `trystash.com`, `stash.cc`, `stashtabs.com`.
2. **Logo / brand identity**: needs a 30-min design sprint. Terracotta accent + warm tones already locked, so direction is partly set.
3. **Cloud sync architecture**: Supabase row per session, or single JSON blob per user? Trade-off is sync granularity vs simplicity.
4. **Cross-window save behaviour**: by default, save all-tabs-in-current-window or all-tabs-in-all-windows? Different mental models for different users.
5. **AI naming prompt**: needs iteration. Should it produce 4-word summaries? Project names? Tags? Tested with real session data.
6. **Onboarding length**: single popup or 3-step walkthrough? A/B unclear.
7. **Pricing — $3 vs $5**: $3 is psychologically free-feeling; $5 doubles revenue. Test against equivalent extensions.
8. **Lifetime tier — $39 vs $49 vs $79**: depends on how lifetime is positioned (supporter perk vs main offer).

---

## 16. Appendix: Reference research

- [Max Artemov's 30-app portfolio strategy — Indie Hackers](https://www.indiehackers.com/post/tech/from-failed-app-to-30-app-portfolio-making-22k-mo-in-less-than-a-year-myy3U7K9evxGOVOHti8s)
- [Chrome Extension Revenue Benchmarks 2026 — ChromeGoldmine](https://chromegoldmine.com/blog/chrome-extension-monetization/chrome-extension-revenue-benchmarks/)
- [Chrome Extensions With Impressive Revenue — ExtensionPay](https://extensionpay.com/articles/browser-extensions-make-money)
- [Chrome Extension Launch Checklist 2026 — WeekHack](https://www.weekhack.com/blog/chrome-extension-launch-checklist)
- [How to Promote a Chrome Extension: 12 Channels 2026](https://launchdirectories.com/how-to-promote/chrome-extension)
- [OneTab Chrome Web Store listing](https://chromewebstore.google.com/detail/onetab/chphlpgkkbolifaimnlloiipkdnihall) — primary competitor
- [Workona](https://workona.com) — secondary competitor

---

## 17. Decision log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-05-30 | Build a tab manager rather than AI email tool (Quill) or negotiation tool (Counter) | Tab managers have validated 3M+ user demand; competitors all have outdated UI; UI/UX differentiation is concrete and demoable |
| 2026-05-30 | Free tier fully functional, not gated | Trust signal + organic discovery; conversion happens on power features |
| 2026-05-30 | Include lifetime tier at launch | Counter subscription fatigue; produces revenue burst |
| 2026-05-30 | Skip AI in V1 MVP | Adds Stripe/backend complexity; better to ship core and add as paid hook in v1.1 |
| 2026-05-30 | Manifest V3 only | V2 deprecated; no reason to build legacy |
| 2026-05-30 | Name: **Stash** | Verb people actually use ("let me stash these"); casual, confident, doesn't sound like productivity software; not techy |
| 2026-05-30 | Accent colour: **terracotta `#C26847`** | Every competitor and every AI tool uses cool blues, purples, gradients. Warm terracotta is unclaimed in this category — instantly recognisable, reads as "designed by a human" |
| 2026-05-30 | **No dark mode at launch** | Ship the warm-paper vision first. Dark mode is table-stakes in 2026 but a real design effort to do well; add in v1.1 once light mode is dialled in |
