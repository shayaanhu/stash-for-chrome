import { getPageContent } from "../../src/shared/content-store";

// Reader for the offline "saved copy" of a stashed page. Reads ?id=<StashTab id>,
// loads the captured snapshot from IndexedDB, and renders it instantly from disk
// inside a fully sandboxed iframe (no scripts run) — works offline and even when
// the original page is dead. See BIGPIC.md.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

function timeAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "saved today";
  if (days === 1) return "saved yesterday";
  if (days < 30) return `saved ${days}d ago`;
  return `saved ${Math.floor(days / 30)}mo ago`;
}

/** Build a self-contained, script-free document for the sandboxed frame. */
function buildDoc(url: string, html: string): string {
  const base = url ? `<base href="${escapeAttr(url)}">` : "";
  return `<!doctype html><html><head><meta charset="utf-8">${base}<meta name="referrer" content="no-referrer">
<style>
  html { color-scheme: light dark; }
  body { max-width: 44rem; margin: 0 auto; padding: 28px 22px 80px;
         font: 16px/1.7 Georgia, "Times New Roman", ui-serif, serif; color: #1f1b16; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #efe9df; background: #17140f; } a { color: #e08a63; } }
  img, video, table { max-width: 100%; height: auto; }
  a { color: #c26847; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
  h1, h2, h3 { line-height: 1.25; }
</style></head><body>${html}</body></html>`;
}

async function main() {
  const id = new URLSearchParams(location.search).get("id");
  const frame = $<HTMLIFrameElement>("frame");
  const live = $<HTMLAnchorElement>("live");

  const content = id ? await getPageContent(id).catch(() => undefined) : undefined;

  if (content) {
    document.title = `${content.title} — Saved copy`;
    $("title").textContent = content.title || "Saved copy";
    $("url").textContent = content.url;
    $("badge").textContent = timeAgo(content.capturedAt);
    if (content.url) live.href = content.url;
  }

  if (content?.html) {
    frame.srcdoc = buildDoc(content.url, content.html);
    return;
  }

  // No snapshot (older capture, or a page that couldn't be read). Offer the live page.
  frame.remove();
  const fallback = document.createElement("div");
  fallback.id = "fallback";
  fallback.innerHTML = content
    ? `No saved copy was captured for this page. <a href="${escapeAttr(content.url)}">Open the live page</a> instead.`
    : `This saved copy could not be found.`;
  document.body.appendChild(fallback);
}

void main();
