/**
 * Renders store screenshots, promo tiles, and the landing page popup PNG.
 * Usage: node .aso/render_screenshots.mjs
 */
import puppeteer from "puppeteer";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotsDir = join(root, ".aso", "shots");

mkdirSync(join(root, "store-assets", "screenshots"), { recursive: true });
mkdirSync(join(root, "docs", "img"), { recursive: true });

function resolveLocalPaths(html, htmlFilePath) {
  const htmlDir = dirname(htmlFilePath);
  return html.replace(/url\(['"]?(\.\.\/[^'")]+)['"]?\)/g, (_, relPath) => {
    const abs = resolve(htmlDir, relPath).replace(/\\/g, "/");
    return `url('file:///${abs}')`;
  });
}

const renders = [
  // Store screenshots — 1280×800 JPEG (no alpha, CWS compliant)
  { file: "shot-1.html",        out: join(root, "store-assets/screenshots/shot-1.jpg"),        w: 1280, h: 800,  jpeg: true,  label: "Save" },
  { file: "shot-2.html",        out: join(root, "store-assets/screenshots/shot-2.jpg"),        w: 1280, h: 800,  jpeg: true,  label: "Library" },
  { file: "shot-3.html",        out: join(root, "store-assets/screenshots/shot-3.jpg"),        w: 1280, h: 800,  jpeg: true,  label: "Restore" },
  { file: "shot-4.html",        out: join(root, "store-assets/screenshots/shot-4.jpg"),        w: 1280, h: 800,  jpeg: true,  label: "Trash" },
  { file: "shot-5.html",        out: join(root, "store-assets/screenshots/shot-5.jpg"),        w: 1280, h: 800,  jpeg: true,  label: "Shortcut" },
  // Promo tiles — JPEG
  { file: "promo-small.html",   out: join(root, "store-assets/screenshots/promo-small.jpg"),   w: 440,  h: 280,  jpeg: true,  label: "Promo 440×280" },
  { file: "promo-marquee.html", out: join(root, "store-assets/screenshots/promo-marquee.jpg"), w: 1400, h: 560,  jpeg: true,  label: "Marquee 1400×560" },
  // Landing page popup — transparent PNG (2x for crispness)
  { file: "landing-popup.html", out: join(root, "docs/img/popup.png"),                         w: 432,  h: 548,  jpeg: false, scale: 2, label: "Landing popup" },
];

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
});

try {
  for (const { file, out, w, h, jpeg, scale = 1, label } of renders) {
    const htmlPath = join(shotsDir, file);
    const html = resolveLocalPaths(readFileSync(htmlPath, "utf8"), htmlPath);

    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 600));

    if (jpeg) {
      await page.screenshot({ path: out, type: "jpeg", quality: 96 });
    } else {
      await page.screenshot({ path: out, type: "png", omitBackground: true });
    }
    await page.close();

    const size = readFileSync(out).length;
    console.log(`  ${label.padEnd(18)} → ${out.split(/[/\\]/).slice(-2).join("/")}  (${(size / 1024).toFixed(0)} KB)`);
  }
} finally {
  await browser.close();
}

console.log("\nDone.");
