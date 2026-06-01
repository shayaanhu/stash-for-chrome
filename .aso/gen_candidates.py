"""Generate candidate icon SVGs from different serif faces so we can compare the
'S' against the reference (upright, vertical-stress)."""

import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.join(os.path.dirname(__file__), "..")
ASO = os.path.dirname(__file__)
FILES = os.path.join(ROOT, "node_modules")

TILE, SPINE, INK = "#FFF2BD", "#285CCC", "#1C336B"
SPINE_W, RADIUS, SIZE = 22, 30, 128

def s_path(font_path, axes, target_h=58.0, center_y=60.0):
    font = TTFont(font_path)
    instantiateVariableFont(font, axes, inplace=True)
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord("S")]
    b = BoundsPen(gs); gs[name].draw(b)
    xmin, ymin, xmax, ymax = b.bounds
    pen = SVGPathPen(gs); gs[name].draw(pen)
    S = target_h / (ymax - ymin)
    TX = (SPINE_W + SIZE) / 2 - S * (xmin + xmax) / 2
    TY = center_y + S * (ymin + ymax) / 2
    return f'<path transform="translate({TX:.3f} {TY:.3f}) scale({S:.5f} {-S:.5f})" d="{pen.getCommands()}" fill="{INK}"/>'

def icon(path_el):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">'
            f'<defs><clipPath id="t"><rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" ry="{RADIUS}"/></clipPath></defs>'
            f'<g clip-path="url(#t)"><rect width="{SIZE}" height="{SIZE}" fill="{TILE}"/>'
            f'<rect width="{SPINE_W}" height="{SIZE}" fill="{SPINE}"/>{path_el}</g></svg>')

PLAYFAIR = os.path.join(FILES, "@fontsource-variable", "playfair-display", "files", "playfair-display-latin-wght-normal.woff2")
FRAUNCES = os.path.join(FILES, "@fontsource-variable", "fraunces", "files", "fraunces-latin-opsz-normal.woff2")

candidates = {
    "playfair700": s_path(PLAYFAIR, {"wght": 700}),
    "playfair600": s_path(PLAYFAIR, {"wght": 600}),
    "fraunces_upright": s_path(FRAUNCES, {"wght": 650, "opsz": 144}),
}
for name, el in candidates.items():
    with open(os.path.join(ASO, f"cand_{name}.svg"), "w", encoding="utf-8") as f:
        f.write(icon(el))
    print("wrote", name)
