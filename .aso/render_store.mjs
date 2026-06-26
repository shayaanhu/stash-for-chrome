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
    t("https://www.tripadvisor.com", "Tripadvisor"),
    t("https://en.wikipedia.org/wiki/Kyoto", "Kyoto - Wikipedia"),
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

// ── Shots: each drives a real state, then captions a branded frame ───────────
// Alternating backgrounds (cream / navy / cream / navy / cream), like the
// original set. The dark-theme popup sits on a CREAM frame so it pops.
const shots = [
  { file: "shot-1.jpg", theme: "light", state: "library", bg: "cream",
    kicker: "ONE-CLICK TAB MANAGER",
    head: "Save your tabs.\nGet them all back.",
    sub: "Stash every open tab into a tidy, named session, then reopen the whole set whenever you want." },
  { file: "shot-2.jpg", theme: "light", state: "expanded", bg: "navy",
    kicker: "RESTORE",
    head: "The whole set,\nor just one tab.",
    sub: "Open a session to see every page inside. Bring it all back, or pick out a single tab." },
  { file: "shot-3.jpg", theme: "dark", state: "library", bg: "cream",
    kicker: "LIGHT OR DARK",
    head: "Easy on the eyes,\nday or night.",
    sub: "A clean, modern interface that follows your system theme, or lock it light or dark." },
  { file: "shot-4.jpg", theme: "light", state: "search", bg: "navy",
    kicker: "SEARCH",
    head: "Find any tab\nin seconds.",
    sub: "Search across every session, page title, and URL. No more hunting through windows." },
  { file: "shot-5.jpg", theme: "light", state: "settings", bg: "cream",
    kicker: "PRIVATE BY DEFAULT",
    head: "Auto-saved.\nNever uploaded.",
    sub: "Stash snapshots your tabs automatically and keeps everything on your device. No account, no servers." },
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
  .pill{display:inline-flex;align-items:center;gap:9px;width:fit-content;margin-bottom:30px;
    padding:7px 16px 7px 8px;border-radius:999px;background:${pillBg};border:1px solid ${pillBorder};
    font-size:12.5px;font-weight:700;letter-spacing:.14em;color:${pillText};}
  .pdot{width:22px;height:22px;border-radius:7px;background:linear-gradient(180deg,#FFFDF6,#F2E9CF);position:relative;overflow:hidden;flex-shrink:0;
    border:1px solid rgba(20,35,80,0.12);box-shadow:0 1px 2px rgba(0,0,0,.2)}
  .pdot::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#285CCC}
  .pdot span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;
    font-weight:700;font-size:12px;color:#1C336B;font-variation-settings:'opsz' 9}
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
    <div class="pill"><span class="pdot"><span>S</span></span>${kicker}</div>
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

// Seed via a fresh service-worker handle BEFORE the popup opens (re-querying the
// target wakes an idle MV3 worker), so the app reads the library on first mount.
// Seeding then reloading the page instead desyncs React's delegated click
// handlers from automation, so the nav stops responding — avoid that path.
async function seedStorage(theme) {
  // The MV3 worker can be evicted between shots; retry against a fresh handle.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const swt = await browser.waitForTarget((x) => x.type() === "service_worker", { timeout: 20000 });
      const w = await swt.worker();
      await w.evaluate(async (s, settings, ord, th) => {
        await chrome.storage.local.set({
          "stash.sessions": s,
          "stash.settings": { ...settings, theme: th },
          "stash.session-order": ord,
          "stash.meta": { version: 1 },
        });
      }, sessions, baseSettings, order, theme);
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(500);
    }
  }
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

async function capture({ theme, state, file }) {
  await seedStorage(theme);
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("PAGEERR", file, e.message));
  await page.setViewport({ width: 400, height: 580, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((th) => { try { localStorage.setItem("stash.theme", th); } catch {} }, theme);
  await page.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: "networkidle0" });
  await sleep(800); // let React mount + the initial reload() load sessions

  if (state === "settings") {
    await ensureView(page,
      () => [...document.querySelectorAll("button")].find((b) => /settings/i.test(b.getAttribute("aria-label") || ""))?.click(),
      () => /Appearance|Save target/.test(document.body.innerText),
      "settings panel");
    await sleep(900);
  } else {
    await ensureView(page,
      () => [...document.querySelectorAll("button")].find((b) => /Stash/.test(b.textContent || ""))?.click(),
      () => document.querySelectorAll("[data-marquee-id]").length > 0,
      "library cards");
    await sleep(900);
    if (state === "expanded") {
      await page.evaluate(() => document.querySelector("[data-marquee-id] .cursor-pointer")?.click());
      await sleep(900);
    } else if (state === "search") {
      await page.type('input[placeholder*="Search"]', "github", { delay: 45 });
      await sleep(800);
    }
  }
  // let favicons settle
  await page.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  await sleep(600);
  const img = await page.screenshot({ type: "png", encoding: "base64" });
  await page.close();
  return img;
}

await warmFavicons(sessions.flatMap((s) => s.tabs.map((t) => t.url)));

for (const s of shots) {
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

await browser.close();
console.log("done");
