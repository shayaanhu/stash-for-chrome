import type { StashSession, StashTab } from "./types";

export function formatSessionDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    ...(!sameYear && { year: "numeric" }),
  }).format(d).replace(/\s?(AM|PM)/gi, (_, m: string) => m.toLowerCase());
}

export function isSavableChromeTab(tab: chrome.tabs.Tab) {
  if (!tab.url) {
    return false;
  }

  try {
    const url = new URL(tab.url);
    return ["http:", "https:", "file:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isTabPinned(tab: chrome.tabs.Tab) {
  return Boolean(tab.pinned);
}

export function createStashTab(tab: chrome.tabs.Tab, capturedAt = Date.now()): StashTab {
  return {
    id: crypto.randomUUID(),
    url: tab.url ?? "",
    title: tab.title?.trim() || tab.url || "Untitled tab",
    favicon: tab.favIconUrl ?? "",
    capturedAt
  };
}

export function createSessionFromChromeTabs(tabs: chrome.tabs.Tab[], now = Date.now()): StashSession {
  const stashedTabs = tabs.map((tab) => createStashTab(tab, now));

  return {
    id: crypto.randomUUID(),
    name: autoNameSession(stashedTabs, now),
    createdAt: now,
    tabs: stashedTabs
  };
}

export function createSessionName(_tabs: StashTab[], now = Date.now()) {
  const date = new Date(now);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  return `${weekday} ${getDayPeriod(date)}`;
}

export function sortSessionsNewestFirst(sessions: StashSession[]) {
  return [...sessions].sort((a, b) => b.createdAt - a.createdAt);
}

/** Sort sessions by a persisted order array. Sessions not in the array fall back
 *  to newest-first. Trash sessions always sort by deletion time regardless of order. */
export function applySessionOrder(sessions: StashSession[], order: string[]): StashSession[] {
  const orderMap = new Map(order.map((id, i) => [id, i]));
  return [...sessions].sort((a, b) => {
    if (a.deletedAt && b.deletedAt) return b.deletedAt - a.deletedAt;
    if (a.deletedAt) return 1;
    if (b.deletedAt) return -1;
    const aIdx = orderMap.get(a.id);
    const bIdx = orderMap.get(b.id);
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    return b.createdAt - a.createdAt;
  });
}

export function matchesSession(session: StashSession, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return (
    session.name.toLowerCase().includes(normalizedQuery) ||
    session.tabs.some((tab) =>
      `${tab.title} ${tab.url}`.toLowerCase().includes(normalizedQuery)
    )
  );
}

function getDayPeriod(date: Date) {
  const hour = date.getHours();

  if (hour < 12) {
    return "Morning";
  }

  if (hour < 17) {
    return "Afternoon";
  }

  return "Evening";
}

// ── Auto-naming ───────────────────────────────────────────────────────────────

const KNOWN_DOMAINS: Record<string, string> = {
  "youtube.com": "YouTube", "youtu.be": "YouTube",
  "github.com": "GitHub", "gist.github.com": "GitHub",
  "reddit.com": "Reddit", "old.reddit.com": "Reddit",
  "twitter.com": "Twitter", "x.com": "X",
  "stackoverflow.com": "Stack Overflow", "stackexchange.com": "Stack Exchange",
  "google.com": "Google", "mail.google.com": "Gmail", "gmail.com": "Gmail",
  "docs.google.com": "Google Docs", "drive.google.com": "Google Drive",
  "calendar.google.com": "Google Calendar", "meet.google.com": "Google Meet",
  "notion.so": "Notion", "figma.com": "Figma", "slack.com": "Slack",
  "linkedin.com": "LinkedIn", "amazon.com": "Amazon",
  "netflix.com": "Netflix", "spotify.com": "Spotify",
  "wikipedia.org": "Wikipedia", "en.wikipedia.org": "Wikipedia",
  "medium.com": "Medium", "dev.to": "Dev.to", "npmjs.com": "npm",
  "developer.mozilla.org": "MDN", "news.ycombinator.com": "Hacker News",
  "producthunt.com": "Product Hunt", "discord.com": "Discord",
  "twitch.tv": "Twitch", "instagram.com": "Instagram",
  "facebook.com": "Facebook", "tiktok.com": "TikTok",
  "openai.com": "OpenAI", "anthropic.com": "Anthropic",
  "vercel.com": "Vercel", "netlify.com": "Netlify",
  "gitlab.com": "GitLab", "linear.app": "Linear",
  "trello.com": "Trello", "airtable.com": "Airtable",
  "asana.com": "Asana", "miro.com": "Miro",
};

const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","have","has","do","does",
  "did","will","would","could","should","may","might","this","that","these",
  "those","it","its","what","which","who","how","when","where","why","all",
  "any","not","no","up","out","as","if","so","into","than","then","about",
  "over","after","before","between","home","page","site","web","login","sign",
  "account","profile","settings","dashboard","help","support","search",
  "privacy","terms","best","top","guide","review","tutorial","free","online",
  "official","using","use","get","make","my","your","more","most","just",
  "now","new","can","also","here","like","need","want","vs","via","per",
]);

function tabDomain(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return null; }
}

function domainLabel(domain: string): string {
  if (KNOWN_DOMAINS[domain]) return KNOWN_DOMAINS[domain];
  const parts = domain.split(".");
  if (parts.length > 2) {
    const base = parts.slice(-2).join(".");
    if (KNOWN_DOMAINS[base]) return KNOWN_DOMAINS[base];
  }
  const brand = parts.at(-2) ?? parts[0] ?? domain;
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

function titleWords(title: string): string[] {
  return title
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*[–—|]\s*[^–—|]+$/, "")
    .replace(/\s*-\s*[^-]+$/, "")
    .replace(/[^\w\s]/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function extractKeywords(tabs: StashTab[], blocked: Set<string>, limit: number): string[] {
  const total = tabs.length;
  const score = new Map<string, number>();
  const docCount = new Map<string, number>();

  for (const tab of tabs) {
    const words = titleWords(tab.title).filter(w => !blocked.has(w));
    const seen = new Set<string>();
    words.forEach((word, pos) => {
      if (seen.has(word)) return;
      seen.add(word);
      // Words earlier in the title carry more signal — later words are often site names
      // that survived suffix-stripping. Score decays from 3.0 to 0.6.
      const posWeight = Math.max(3.0 - pos * 0.5, 0.6);
      score.set(word, (score.get(word) ?? 0) + posWeight);
      docCount.set(word, (docCount.get(word) ?? 0) + 1);
    });
  }

  // Words appearing in ≥85% of tabs are brand names flooding every listing title.
  // Only kick in when we have enough tabs for this to be meaningful.
  const ubiqLimit = total >= 4 ? total * 0.85 : Infinity;

  return [...score.entries()]
    .filter(([w]) => (docCount.get(w) ?? 0) < ubiqLimit)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w[0].toUpperCase() + w.slice(1));
}

/** 2-word phrase that appears across multiple tabs beats separate unigrams. */
function topBigram(tabs: StashTab[], blocked: Set<string>): string | null {
  const counts = new Map<string, number>();
  for (const tab of tabs) {
    const words = titleWords(tab.title).filter(w => !blocked.has(w));
    for (let i = 0; i < words.length - 1; i++) {
      const bg = `${words[i]} ${words[i + 1]}`;
      counts.set(bg, (counts.get(bg) ?? 0) + 1);
    }
  }
  if (!counts.size) return null;
  const [best, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!best || count < Math.min(2, tabs.length)) return null;
  return best.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Brand/domain terms to block so they never leak into keyword output. */
function brandTerms(domainFreq: Map<string, number>): Set<string> {
  const terms = new Set<string>();
  for (const [domain] of domainFreq) {
    terms.add(domain);
    const base = domain.split(".").at(-2) ?? "";
    if (base) terms.add(base);
    for (const part of domainLabel(domain).toLowerCase().split(/\s+/)) terms.add(part);
  }
  return terms;
}

// Generic platforms where the domain name tells you nothing about the content.
// For these, skip domain-led naming and go straight to keywords.
const KEYWORD_PREFERRED = new Set([
  "amazon.com", "amazon.co.uk", "amazon.ca",
  "google.com", "google.co.uk",
  "ebay.com", "etsy.com", "walmart.com", "target.com",
  "bing.com", "yahoo.com", "duckduckgo.com", "aliexpress.com",
  "pinterest.com",
]);

export function autoNameSession(tabs: StashTab[], now = Date.now()): string {
  if (tabs.length === 0) return createSessionName([], now);

  const domainFreq = new Map<string, number>();
  for (const tab of tabs) {
    const d = tabDomain(tab.url);
    if (d) domainFreq.set(d, (domainFreq.get(d) ?? 0) + 1);
  }

  const total = tabs.length;
  const byFreq = [...domainFreq.entries()].sort((a, b) => b[1] - a[1]);
  const topDomain = byFreq[0]?.[0] ?? "";
  const topCount  = byFreq[0]?.[1] ?? 0;

  // Collect all domain brand terms once — used to block brand words from keyword output
  const brands = brandTerms(domainFreq);

  // One domain dominates (>50%) and it's a distinctive destination → "YouTube Music"
  // Shopping/search platforms skip this — "Amazon" alone tells you nothing.
  if (topCount / total > 0.5 && !KEYWORD_PREFERRED.has(topDomain)) {
    const label = domainLabel(topDomain);
    const blocked = new Set([...brands]);
    const bigram = topBigram(tabs, blocked);
    if (bigram) return `${label} ${bigram}`;
    const kws = extractKeywords(tabs, blocked, 2);
    return kws.length > 0 ? `${label} ${kws.join(" ")}` : label;
  }

  // Top domains together cover ≥65% → "GitHub · Reddit · YouTube"
  let covered = 0;
  const topGroup: string[] = [];
  for (const [d, c] of byFreq) {
    if (!KEYWORD_PREFERRED.has(d)) {
      covered += c;
      topGroup.push(d);
    }
    if (topGroup.length >= 3) break;
  }
  if (covered / total >= 0.65 && topGroup.length >= 2) {
    return topGroup.map(domainLabel).join(" · ");
  }

  // No clear domain signal → bigram first, then unigrams
  // Block ALL domain brand names so they never bleed into keyword output
  const bigram = topBigram(tabs, brands);
  if (bigram) return bigram;

  const keywords = extractKeywords(tabs, brands, 3);
  if (keywords.length > 0) return keywords.join(" ");

  return createSessionName([], now);
}
