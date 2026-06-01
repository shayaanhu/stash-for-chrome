"""Outlines the Fraunces 'S' to a vector path and writes a font-independent
finalized logo SVG. No live <text>, so it rasterizes identically everywhere."""

import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.join(os.path.dirname(__file__), "..")
# Playfair Display: upright, vertical-stress serif S (matches the reference).
# Fraunces' old-style angled stress read as "tilted", so the icon mark uses Playfair.
FONT = os.path.join(ROOT, "node_modules", "@fontsource-variable", "playfair-display", "files", "playfair-display-latin-wght-normal.woff2")
AXES = {"wght": 700}
OUT = os.path.join(ROOT, "store-assets", "stash-logo.svg")

# Colours + geometry sampled directly from the reference image (Gemini render).
TILE = "#F6EBCF"      # warm cream
SPINE = "#2A55B1"     # royal blue spine
INK = "#1D3261"       # deep navy S
SIZE = 128
SPINE_W = round(SIZE * 0.095)   # spine is ~9.5% of tile width in the reference
RADIUS = 30                      # ~23% squircle corner

font = TTFont(FONT)
instantiateVariableFont(font, AXES, inplace=True)
upm = font["head"].unitsPerEm
glyph_name = font.getBestCmap()[ord("S")]
glyph_set = font.getGlyphSet()

bounds = BoundsPen(glyph_set)
glyph_set[glyph_name].draw(bounds)
xmin, ymin, xmax, ymax = bounds.bounds

pen = SVGPathPen(glyph_set)
glyph_set[glyph_name].draw(pen)
d = pen.getCommands()

# Fit: cap the glyph height, centre it in the card area (right of the spine)
target_h = 64.0
S = target_h / (ymax - ymin)
region_center_x = (SPINE_W + SIZE) / 2          # centre of the area right of the spine
center_y = 63.0                                  # optical centre (slightly above geometric)
TX = region_center_x - S * (xmin + xmax) / 2
TY = center_y + S * (ymin + ymax) / 2

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">
  <defs>
    <clipPath id="tile"><rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" ry="{RADIUS}"/></clipPath>
  </defs>
  <g clip-path="url(#tile)">
    <rect width="{SIZE}" height="{SIZE}" fill="{TILE}"/>
    <rect x="0" y="0" width="{SPINE_W}" height="{SIZE}" fill="{SPINE}"/>
    <path transform="translate({TX:.3f} {TY:.3f}) scale({S:.5f} {-S:.5f})" d="{d}" fill="{INK}"/>
  </g>
</svg>
'''

with open(OUT, "w", encoding="utf-8") as f:
    f.write(svg)

print(f"upm={upm} glyph={glyph_name} bbox=({xmin},{ymin},{xmax},{ymax})")
print(f"scale={S:.5f} TX={TX:.2f} TY={TY:.2f}")
print(f"wrote {OUT} ({len(svg)} bytes)")
