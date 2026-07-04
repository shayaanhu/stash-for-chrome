/**
 * Store screenshots from the REAL extension.
 * Loads dist/chrome-mv3 in Chrome, seeds realistic sessions, drives the actual
 * popup into each state, screenshots the genuine UI, and composites it into a
 * branded 1280x800 frame. No mockups — every pixel of the app is the real build.
 *
 * Usage: npm run build && node .aso/render_store.mjs
 */
import puppeteer from "puppeteer";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "dist", "chrome-mv3");
const outDir = join(root, "store-assets", "screenshots");
mkdirSync(outDir, { recursive: true });

const fontFraunces = join(root, "node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2");
const fontJakarta = join(root, "node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2");
const b64 = (p) => readFileSync(p).toString("base64");
const frauncesB64 = b64(fontFraunces);
const jakartaB64 = b64(fontJakarta);

// ── Sample library (realistic, current) ─────────────────────────────────────
const now = Date.now();
const H = 3600e3, D = 86400e3;
const t = (url, title) => ({ id: crypto.randomUUID(), url, title, favicon: "", capturedAt: now });
const sessions = [
  { id: "s1", name: "Frontend", createdAt: now - 2 * H, tabs: [
    t("https://react.dev/learn", "Quick Start – React"),
    t("https://developer.mozilla.org/en-US/docs/Web/CSS", "CSS reference | MDN"),
    t("https://tailwindcss.com/docs", "Documentation - Tailwind CSS"),
    t("https://github.com/facebook/react", "facebook/react"),
    t("https://news.ycombinator.com", "Hacker News"),
  ]},
  { id: "s2", name: "Japan trip", createdAt: now - 6 * H, tabs: [
    t("https://www.google.com/maps", "Google Maps"),
    t("https://www.booking.com", "Booking.com"),
    { id: "trip-kyoto", url: "https://www.tripadvisor.com/Tourism-Kyoto", title: "Tripadvisor", favicon: "", capturedAt: now },
    { id: "kyoto", url: "https://en.wikipedia.org/wiki/Kyoto", title: "Kyoto - Wikipedia", favicon: "", capturedAt: now },
  ]},
  { id: "s3", name: "Design ideas", createdAt: now - D, tabs: [
    t("https://dribbble.com", "Dribbble"),
    t("https://www.behance.net", "Behance"),
    t("https://www.awwwards.com", "Awwwards"),
    t("https://www.figma.com/community", "Figma Community"),
  ]},
  { id: "s4", name: "Reading list", createdAt: now - 2 * D, tabs: [
    t("https://www.theatlantic.com", "The Atlantic"),
    t("https://www.newyorker.com", "The New Yorker"),
    t("https://longreads.com", "Longreads"),
  ]},
  { id: "s5", name: "Learning Rust", createdAt: now - 3 * D, tabs: [
    t("https://doc.rust-lang.org/book/", "The Rust Programming Language"),
    t("https://github.com/rust-lang/rust", "rust-lang/rust"),
    t("https://www.reddit.com/r/rust/", "r/rust"),
  ]},
  { id: "s6", name: "Invoices", createdAt: now - 5 * D, tabs: [
    t("https://mail.google.com", "Gmail"),
    t("https://www.notion.so", "Notion"),
  ]},
];
const baseSettings = { saveTarget: "current-window", restoreInNewWindow: false, stickySelection: false, closeAfterStash: true, sessionSort: "manual", autoSave: true };
const order = sessions.map((s) => s.id);

// Captured page content (IndexedDB "stash-content") so the SEARCH shot can show
// the headline feature: matching a phrase that lives INSIDE a page, not in its
// title or URL. Two travel pages that both mention "cherry blossom" in the body.
const seedPages = [
  { id: "kyoto", url: "https://en.wikipedia.org/wiki/Kyoto", title: "Kyoto - Wikipedia", capturedAt: now,
    html: "<h1>Kyoto</h1><p>Kyoto served as the capital of Japan for over a thousand years.</p><p>Maruyama Park is the city's most popular spot for cherry blossom viewing, its giant weeping cherry tree lit up after dark in early April.</p>",
    text: "Kyoto served as the capital of Japan for over a thousand years and remains its cultural heart. Maruyama Park is the city's most popular spot for cherry blossom viewing, its giant weeping cherry tree lit up after dark in early April. The Philosopher's Path, a stone walkway lined with hundreds of cherry trees, draws crowds during hanami season." },
  { id: "trip-kyoto", url: "https://www.tripadvisor.com/Tourism-Kyoto", title: "Tripadvisor", capturedAt: now,
    html: "<h1>Kyoto travel guide</h1><p>The best time to visit is late March to early April, when the cherry blossom season peaks and the temple gardens turn pink.</p>",
    text: "Planning a trip to Kyoto. The best time to visit is late March to early April, when the cherry blossom season peaks and the temple gardens turn pink. Book accommodation months ahead, as hotels near Gion and Arashiyama fill quickly during peak bloom." },
];

// ── Shots: each drives a real state, then captions a branded frame ───────────
// Alternating backgrounds (cream / navy / cream / navy / cream), like the
// original set. The dark-theme popup sits on a CREAM frame so it pops.
const shots = [
  { file: "shot-1.jpg", theme: "light", state: "library", bg: "cream",
    kicker: "ONE-CLICK TAB MANAGER",
    head: "Save every tab.\nGet them all back.",
    sub: "Stash tucks every open tab into a tidy, named group, then brings the whole set back whenever you want." },
  { file: "shot-2.jpg", theme: "light", state: "search-all", bg: "navy", query: "react",
    kicker: "ONE SEARCH FOR EVERYTHING",
    head: "Find any tab,\nopen or saved.",
    sub: "One search spans every tab you have open and everything you've stashed. Type a word and jump straight to it." },
  { file: "shot-3.jpg", theme: "light", state: "search", bg: "cream", query: "cherry blossom",
    kicker: "SEARCH INSIDE YOUR PAGES",
    head: "Find it by what\nwas on the page.",
    sub: "Stash remembers the words inside every page you save, so you can find one by a phrase you read, even when it was never in the title." },
  { file: "shot-4.jpg", theme: "light", state: "settings", bg: "navy",
    kicker: "PRIVATE, AND AUTOMATIC",
    head: "Auto-saved.\nNever uploaded.",
    sub: "Stash snapshots your tabs on a timer and keeps everything, including the page text it saves, on your device. No account, no servers." },
  { file: "shot-5.jpg", theme: "dark", state: "library", bg: "cream",
    kicker: "LIGHT OR DARK",
    head: "Easy on the eyes,\nday or night.",
    sub: "A clean, modern interface that follows your system theme, or lock it to light or dark whenever you like." },
];

function frame({ kicker, head, sub, imgB64, bg, popupDark }) {
  const cream = bg === "cream";
  const headHtml = head.split("\n").map((l) => `<span>${l}</span>`).join("");
  const body = cream ? "#EFE7D6" : "#0E1A38";
  const glow = cream
    ? `radial-gradient(ellipse 55% 60% at 6% 0%, rgba(255,255,255,0.8) 0%, transparent 62%),
       radial-gradient(ellipse 60% 60% at 100% 100%, rgba(40,92,204,0.12) 0%, transparent 55%),
       radial-gradient(ellipse 52% 52% at 82% 14%, rgba(255,253,246,0.95) 0%, transparent 60%)`
    : `radial-gradient(ellipse 50% 55% at 8% 0%, rgba(63,112,224,0.40) 0%, transparent 60%),
       radial-gradient(ellipse 60% 60% at 100% 100%, rgba(20,32,70,0.9) 0%, transparent 55%),
       radial-gradient(ellipse 40% 45% at 78% 18%, rgba(99,140,240,0.22) 0%, transparent 60%)`;
  const gridColor = cream ? "rgba(20,35,80,0.055)" : "rgba(255,255,255,0.05)";
  const headColor = cream ? "#1C336B" : "#FFFDF6";
  const subColor = cream ? "#4A5E92" : "#AFC0E6";
  const pillBg = cream ? "rgba(28,51,107,0.06)" : "rgba(255,247,224,0.08)";
  const pillBorder = cream ? "rgba(28,51,107,0.16)" : "rgba(255,247,224,0.16)";
  const pillText = cream ? "#2353BD" : "#CFE0FF";
  const deviceBorder = popupDark
    ? (cream ? "rgba(20,35,80,0.16)" : "rgba(150,180,255,0.22)")
    : (cream ? "rgba(20,35,80,0.10)" : "rgba(255,255,255,0.5)");
  const deviceShadow = cream
    ? "0 36px 72px -22px rgba(20,35,80,0.34), 0 12px 28px -10px rgba(20,35,80,0.20)"
    : "0 40px 80px -20px rgba(0,0,0,.55), 0 12px 26px -8px rgba(0,0,0,.4)" + (popupDark ? ", 0 0 70px -8px rgba(80,134,242,0.35)" : "");
  const reflect = cream ? "rgba(40,92,204,0.10)" : "rgba(63,112,224,0.18)";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Fraunces';src:url(data:font/woff2;base64,${frauncesB64}) format('woff2');font-weight:100 900;}
  @font-face{font-family:'Jakarta';src:url(data:font/woff2;base64,${jakartaB64}) format('woff2');font-weight:200 800;}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1280px;height:800px;overflow:hidden;position:relative;font-family:'Jakarta',system-ui,sans-serif;background:${body};}
  .glow{position:absolute;inset:0;background:${glow};}
  .grid{position:absolute;inset:0;opacity:.55;
    background-image:radial-gradient(circle, ${gridColor} 1px, transparent 1px);background-size:30px 30px;
    -webkit-mask-image:linear-gradient(80deg,#000 35%,transparent 72%);}
  .left{position:absolute;left:92px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;z-index:5}
  .eyebrow{display:flex;align-items:center;gap:15px;width:fit-content;margin-bottom:24px;
    font-family:'Jakarta',sans-serif;font-size:19px;font-weight:800;letter-spacing:.10em;color:${pillText};text-transform:uppercase;}
  .eyebrow::before{content:'';width:32px;height:3px;border-radius:2px;background:${pillText};opacity:.9;flex-shrink:0;}
  h1{font-family:'Fraunces',Georgia,serif;color:${headColor};font-weight:600;font-size:62px;line-height:1.04;letter-spacing:-.02em;
    font-variation-settings:'opsz' 60;margin-bottom:24px;display:flex;flex-direction:column}
  h1 span{display:block}
  .sub{color:${subColor};font-size:21px;line-height:1.5;font-weight:400;max-width:430px}
  .device{position:absolute;right:118px;top:50%;transform:translateY(-50%) rotate(-1deg);z-index:4;
    width:402px;border-radius:22px;overflow:hidden;border:1px solid ${deviceBorder};box-shadow:${deviceShadow};}
  .device img{display:block;width:100%}
  .reflect{position:absolute;right:0;bottom:0;width:520px;height:520px;z-index:1;
    background:radial-gradient(circle at 70% 70%, ${reflect}, transparent 60%)}
  </style></head><body>
  <div class="glow"></div><div class="grid"></div><div class="reflect"></div>
  <div class="left">
    <div class="eyebrow">${kicker}</div>
    <h1>${headHtml}</h1>
    <p class="sub">${sub}</p>
  </div>
  <div class="device"><img src="data:image/png;base64,${imgB64}"/></div>
  </body></html>`;
}

// ── Drive the real popup ─────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  headless: "new",
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--font-render-hinting=none"],
});
const sw = await browser.waitForTarget((x) => x.type() === "service_worker", { timeout: 20000 });
const extId = new URL(sw.url()).host;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Visit each sample URL once so Chrome caches the real site favicons; the popup's
// chrome://favicon then renders genuine icons instead of the gray fallback.
async function warmFavicons(urls) {
  const uniq = [...new Set(urls)];
  const conc = 5;
  for (let i = 0; i < uniq.length; i += conc) {
    await Promise.all(uniq.slice(i, i + conc).map(async (u) => {
      const pg = await browser.newPage();
      try { await pg.goto(u, { waitUntil: "domcontentloaded", timeout: 9000 }); await sleep(1600); } catch {}
      await pg.close().catch(() => {});
    }));
  }
  await sleep(800);
}

// Seed sessions + captured page content from the popup's OWN extension context
// (it has full chrome + IndexedDB access). Done AFTER mount: the app's
// storage.onChanged listener re-renders in place, with no page reload — a reload
// desyncs React's delegated click handlers from automation. This also sidesteps
// the evictable MV3 service worker entirely (waiting on its target flakes).
async function seedInPage(page, theme, contentPages) {
  await page.evaluate(async (s, settings, ord, th, pages) => {
    // Content first, so the sessions-triggered reload finds it in IndexedDB.
    if (pages.length) {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open("stash-content", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("pages")) db.createObjectStore("pages", { keyPath: "id" });
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("pages", "readwrite");
          for (const r of pages) tx.objectStore("pages").put(r);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }
    await chrome.storage.local.set({
      "stash.sessions": s,
      "stash.settings": { ...settings, theme: th },
      "stash.session-order": ord,
      "stash.meta": { version: 1 },
    });
  }, sessions, baseSettings, order, theme, contentPages);
}

// Clicks, waits for the target state, and re-clicks at a calm cadence if needed
// (rapid re-clicking interferes with the view transition).
async function ensureView(page, clickFn, checkFn, label) {
  for (let round = 0; round < 8; round++) {
    await page.evaluate(clickFn);
    for (let j = 0; j < 6; j++) {
      await sleep(260);
      if (await page.evaluate(checkFn)) return;
    }
  }
  throw new Error("timeout waiting for " + label);
}

async function capture({ theme, state, file, query }) {
  // For "any tab, open or saved": open real tabs FIRST so the popup's "Open now"
  // section has genuine live matches next to the stashed ones.
  let extraPages = [];
  if (state === "search-all") {
    const urls = ["https://react.dev/reference/react/useState", "https://react.dev/blog"];
    extraPages = await Promise.all(urls.map(async (u) => {
      const pg = await browser.newPage();
      try { await pg.goto(u, { waitUntil: "domcontentloaded", timeout: 12000 }); } catch {}
      return pg;
    }));
    await sleep(1400);
  }

  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGEERR", file, e.message));
  await page.setViewport({ width: 400, height: 580, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((th) => { try { localStorage.setItem("stash.theme", th); } catch {} }, theme);
  await page.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: "networkidle0" });
  await sleep(500); // let React mount
  await seedInPage(page, theme, state === "search" ? seedPages : []);

  if (state === "search") {
    // Reload so the fresh mount deterministically reads the seeded content index
    // AND sessions from storage — avoids racing the in-place onChanged reload,
    // which can leave the content index empty when we type ("No tabs match").
    // Search overlays the view, so we only type here (no nav clicks to desync).
    await page.reload({ waitUntil: "networkidle0" });
    await sleep(1400);
    await page.waitForSelector('input[placeholder*="Search"]');
    await page.type('input[placeholder*="Search"]', query || "github", { delay: 45 });
    await sleep(1100);
  } else if (state === "search-all") {
    // Stay in the default Open Tabs view; the search overlays results from
    // open tabs AND the stash, which is exactly the story for this shot.
    await sleep(1000);
    await page.waitForSelector('input[placeholder*="Search"]');
    await page.type('input[placeholder*="Search"]', query || "react", { delay: 45 });
    await sleep(1100);
  } else if (state === "settings") {
    await sleep(1000);
    await ensureView(page,
      () => [...document.querySelectorAll("button")].find((b) => /settings/i.test(b.getAttribute("aria-label") || ""))?.click(),
      () => /Appearance|Save target/.test(document.body.innerText),
      "settings panel");
    await sleep(900);
  } else {
    await sleep(1000);
    await ensureView(page,
      () => [...document.querySelectorAll("button")].find((b) => /Stash/.test(b.textContent || ""))?.click(),
      () => document.querySelectorAll("[data-marquee-id]").length > 0,
      "library cards");
    await sleep(900);
  }
  // let favicons settle
  await page.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  await sleep(600);
  const img = await page.screenshot({ type: "png", encoding: "base64" });
  await page.close();
  for (const p of extraPages) await p.close().catch(() => {});
  return img;
}

// ── Promo tiles (regenerated from the REAL app, not old mockups) ─────────────
// Shared navy backdrop bits so the promos match the screenshot frames.
const promoBg = `
  .glow{position:absolute;inset:0;background:
    radial-gradient(ellipse 50% 60% at 6% 0%, rgba(63,112,224,0.42) 0%, transparent 60%),
    radial-gradient(ellipse 60% 60% at 100% 100%, rgba(20,32,70,0.9) 0%, transparent 55%),
    radial-gradient(ellipse 42% 46% at 80% 16%, rgba(99,140,240,0.22) 0%, transparent 60%);}
  .grid{position:absolute;inset:0;opacity:.5;background-image:radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px);background-size:30px 30px;-webkit-mask-image:linear-gradient(80deg,#000 35%,transparent 74%);}
  .logo{border-radius:14px;background:linear-gradient(180deg,#FFFDF6,#F2E9CF);position:relative;overflow:hidden;flex-shrink:0;border:1px solid rgba(20,35,80,0.12);box-shadow:0 2px 6px rgba(0,0,0,.3)}
  .logo::before{content:'';position:absolute;left:0;top:0;bottom:0;width:14%;background:#285CCC}
  .logo span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:700;color:#1C336B;font-variation-settings:'opsz' 20}
  .brandname{font-family:'Fraunces',serif;font-weight:600;color:#FFFDF6;font-variation-settings:'opsz' 30}`;
const fontFaces = `
  @font-face{font-family:'Fraunces';src:url(data:font/woff2;base64,${frauncesB64}) format('woff2');font-weight:100 900;}
  @font-face{font-family:'Jakarta';src:url(data:font/woff2;base64,${jakartaB64}) format('woff2');font-weight:200 800;}`;

function marqueeFrame({ head, sub, imgB64 }) {
  const headHtml = head.split("\n").map((l) => `<span>${l}</span>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1400px;height:560px;overflow:hidden;position:relative;font-family:'Jakarta',sans-serif;background:#0E1A38;}
  ${promoBg}
  .left{position:absolute;left:96px;top:0;bottom:0;width:660px;display:flex;flex-direction:column;justify-content:center;z-index:5}
  .brand{display:flex;align-items:center;gap:15px;margin-bottom:30px}
  .brand .logo{width:52px;height:52px}.brand .logo span{font-size:30px}
  .brandname{font-size:34px}
  h1{font-family:'Fraunces',Georgia,serif;color:#FFFDF6;font-weight:600;font-size:56px;line-height:1.05;letter-spacing:-.02em;font-variation-settings:'opsz' 56;margin-bottom:22px;display:flex;flex-direction:column}
  .sub{color:#AFC0E6;font-size:21px;line-height:1.5;max-width:500px}
  .device{position:absolute;right:104px;top:52px;z-index:4;width:406px;transform:rotate(-1deg);border-radius:22px 22px 0 0;overflow:hidden;border:1px solid rgba(150,180,255,0.22);border-bottom:0;box-shadow:0 40px 80px -20px rgba(0,0,0,.55),0 0 70px -8px rgba(80,134,242,0.30);}
  .device img{display:block;width:100%}
  </style></head><body>
  <div class="glow"></div><div class="grid"></div>
  <div class="left">
    <div class="brand"><span class="logo"><span>S</span></span><span class="brandname">Stash</span></div>
    <h1>${headHtml}</h1><p class="sub">${sub}</p>
  </div>
  <div class="device"><img src="data:image/png;base64,${imgB64}"/></div>
  </body></html>`;
}

function smallFrame({ head, tag }) {
  const headHtml = head.split("\n").map((l) => `<span>${l}</span>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:440px;height:280px;overflow:hidden;position:relative;font-family:'Jakarta',sans-serif;background:#0E1A38;}
  ${promoBg}
  .wrap{position:absolute;inset:0;padding:30px 34px 28px;display:flex;flex-direction:column;justify-content:space-between;z-index:5}
  .brand{display:flex;align-items:center;gap:12px}
  .brand .logo{width:40px;height:40px}.brand .logo span{font-size:23px}
  .brandname{font-size:27px}
  h1{font-family:'Fraunces',Georgia,serif;color:#FFFDF6;font-weight:600;font-size:35px;line-height:1.08;letter-spacing:-.02em;font-variation-settings:'opsz' 35;display:flex;flex-direction:column}
  .tag{color:#AFC0E6;font-size:14.5px;font-weight:600;letter-spacing:.01em}
  </style></head><body>
  <div class="glow"></div><div class="grid"></div>
  <div class="wrap">
    <div class="brand"><span class="logo"><span>S</span></span><span class="brandname">Stash</span></div>
    <h1>${headHtml}</h1>
    <div class="tag">${tag}</div>
  </div>
  </body></html>`;
}

async function renderHtml(html, { w, h, out }) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: out, type: "jpeg", quality: 95 });
  await page.close();
}

await warmFavicons([
  ...sessions.flatMap((s) => s.tabs.map((t) => t.url)),
  "https://react.dev/reference/react/useState", "https://react.dev/blog",
]);

// Optional arg renders a subset (e.g. `node render_store.mjs shot-4`, or `promo`).
const only = process.argv[2];
const shotsToRender = only ? shots.filter((s) => s.file.includes(only)) : shots;

for (const s of shotsToRender) {
  const imgB64 = await capture(s);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.setContent(frame({ ...s, imgB64, popupDark: s.theme === "dark" }), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: join(outDir, s.file), type: "jpeg", quality: 95 });
  await page.close();
  console.log("wrote", s.file);
}

if (!only || only.startsWith("promo")) {
  // Marquee shows a real "search inside pages" popup — the strongest flex.
  const marqueePopup = await capture({ theme: "light", state: "search", query: "cherry blossom", file: "_marquee" });
  await renderHtml(marqueeFrame({
    head: "Save your tabs.\nFind them by what's inside.",
    sub: "A private tab manager that remembers the text on every page you save, so you can search for one later by a phrase you read.",
    imgB64: marqueePopup,
  }), { w: 1400, h: 560, out: join(outDir, "promo-marquee.jpg") });
  console.log("wrote promo-marquee.jpg");

  await renderHtml(smallFrame({
    head: "Find any tab by\nwhat's inside it.",
    tag: "Private, on-device tab manager",
  }), { w: 440, h: 280, out: join(outDir, "promo-small.jpg") });
  console.log("wrote promo-small.jpg");
}

await browser.close();
console.log("done");
