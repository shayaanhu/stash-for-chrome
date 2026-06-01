import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aso = dirname(fileURLToPath(import.meta.url));
for (const file of readdirSync(aso).filter((f) => f.startsWith("cand_") && f.endsWith(".svg"))) {
  const svg = readFileSync(join(aso, file));
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 128 } }).render().asPng();
  const out = file.replace(/\.svg$/, ".png");
  writeFileSync(join(aso, out), png);
  console.log(out);
}
