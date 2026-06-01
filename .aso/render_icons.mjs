import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/icons/stash-logo.svg"));

// Manifest / toolbar / store icon sizes (Chrome consumes up to 128).
for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(join(root, `public/icons/icon-${size}.png`), png);
  console.log(`icon-${size}.png  (${png.length} bytes)`);
}

// High-res masters for the store listing graphic, promo tiles, and marketing.
for (const size of [256, 512, 1024]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(join(root, `public/icons/stash-icon-${size}.png`), png);
  console.log(`stash-icon-${size}.png  (${png.length} bytes)`);
}
