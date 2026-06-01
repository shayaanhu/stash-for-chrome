/**
 * Renders store screenshots + promo tiles to JPEG.
 * All outputs: 24-bit, no alpha — Chrome Web Store compliant.
 *
 * Usage: node .aso/render_screenshots.mjs
 */
import puppeteer from "puppeteer";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotsDir = join(root, ".aso", "shots");
const outDir = join(root, "store-assets", "screenshots");

mkdirSync(outDir, { recursive: true });

function resolveLocalPaths(html, htmlFilePath) {
  const htmlDir = dirname(htmlFilePath);
  return html.replace(/url\(['"]?(\.\.\/[^'")]+)['"]?\)/g, (match, relPath) => {
    const abs = resolve(htmlDir, relPath).replace(/\\/g, "/");
    return `url('file:///${abs}')`;
  });
}

const renders = [
  // Screenshots — 1280×800
  { file: "shot-1.html",        out: "shot-1.jpg",        w: 1280, h: 800,  label: "Save" },
  { file: "shot-2.html",        out: "shot-2.jpg",        w: 1280, h: 800,  label: "Library" },
  { file: "shot-3.html",        out: "shot-3.jpg",        w: 1280, h: 800,  label: "Restore" },
  { file: "shot-4.html",        out: "shot-4.jpg",        w: 1280, h: 800,  label: "Trash" },
  { file: "shot-5.html",        out: "shot-5.jpg",        w: 1280, h: 800,  label: "Shortcut" },
  // Promo tiles
  { file: "promo-small.html",   out: "promo-small.jpg",   w: 440,  h: 280,  label: "Promo 440×280" },
  { file: "promo-marquee.html", out: "promo-marquee.jpg", w: 1400, h: 560,  label: "Marquee 1400×560" },
];

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
});

try {
  for (let i = 0; i < renders.length; i++) {
    const { file, out, w, h, label } = renders[i];
    const htmlPath = join(shotsDir, file);
    const raw = readFileSync(htmlPath, "utf8");
    const html = resolveLocalPaths(raw, htmlPath);

    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 600));

    const outPath = join(outDir, out);
    await page.screenshot({ path: outPath, type: "jpeg", quality: 96 });
    await page.close();

    const stat = readFileSync(outPath);
    console.log(`  ${label.padEnd(18)} → ${out}  (${(stat.length / 1024).toFixed(0)} KB)`);
  }
} finally {
  await browser.close();
}

console.log("\nDone. Files in store-assets/screenshots/");
