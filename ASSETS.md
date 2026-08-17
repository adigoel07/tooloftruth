# Brand Asset Generation Guide

Generate the assets below and place them at the paths indicated.
PNG preferred (1024×1024 for emblems, 2048×512 for horizontal logotype).
SVG preferred where the generator supports it.

---

## Primary Emblem — Dark (for light backgrounds, GitHub avatar, favicon)

**Save to:** `assets/brand/emblem-dark.png`

```
Flat vector emblem, app icon style, centered on a solid pure-black (#000000) circular
background. Inside the circle: a single ultra-bold white needle line — the classic
polygraph lie-detector needle — sharply deflected 45 degrees to the right. It rises
from bottom-center and points up toward the upper-right, terminating in a bold white
dot at the tip. A thin, elegant white semicircular gauge arc hugs the bottom interior
of the circle, anchoring the needle as a "truth dial." Monochrome. High contrast.
Chunky silhouettes. Generous negative space. Optically centered. Perfectly legible
at 16×16 pixels. No text, no letters, no numbers, no gradients, no glow, no shadows,
flat matte finish. Style: retro-modern noir detective brand mark — bold, iconic,
authoritative, instantly recognizable, vaguely 1950s spy-film instrumental panel.
```

---

## Primary Emblem — Light (for dark mode, docs, dark UIs)

**Save to:** `assets/brand/emblem-light.png`

```
Identical composition to a minimal flat vector emblem: a circular badge on a solid
pure-white (#FFFFFF) background. A single ultra-bold black needle line — the classic
polygraph lie-detector needle — sharply deflected 45 degrees to the right, rising
from bottom-center to upper-right, ending in a bold black dot at the tip. A thin
black semicircular gauge arc hugs the bottom interior of the circle. Monochrome,
flat matte, high contrast, chunky silhouette, generous negative space, optically
centered, legible at 16×16 pixels. No text, no gradients, no glow, no shadows.
Style: retro-modern noir detective mark, bold and iconic.
```

---

## Logotype — Horizontal (README hero, website header)

**Save to:** `assets/brand/logotype-horizontal.png`

```
Minimal logo wordmark, custom drawn lettering — NOT a stock font — spelling
"TOOL OF TRUTH" in a single horizontal line, all uppercase, heavy expanded
geometric grotesque style. "TOOL OF" in a medium-bold weight, "TRUTH" in an
extra-bold heavier weight. Pure black (#0A0A0A) lettering centered on a pure
white (#FFFFFF) background. The only decorative detail: the horizontal crossbar
of the letter "T" in "TRUTH" extends beyond the stem and sharpens into a
needle-like point angled up and to the right — echoing the lie-detector needle
of the emblem. Tight letter-spacing, crisp edges, flat vector, no gradients,
no glow, no shadows, no other elements. Style: a precision instrument brand —
authoritative, geometric, subtly noir — the wordmark of a 1950s detective's
door sign reimagined as a modern AI developer tool. Generous transparent
padding around the letterforms.
```

---

## Logotype — Stacked (avatar lockups, square contexts)

**Save to:** `assets/brand/logotype-stacked.png`

```
Minimal logo wordmark, custom drawn lettering — NOT a stock font — spelling
"TOOL OF TRUTH" stacked vertically, all uppercase, heavy expanded geometric
grotesque style. "TOOL" and "OF" in medium-bold weight on two lines, then
"TRUTH" below them in a significantly larger, extra-bold weight. Pure black
(#0A0A0A) lettering centered on a pure white (#FFFFFF) background. The
horizontal crossbar of the "T" in "TRUTH" extends beyond the stem and
sharpens into a needle-like point angled up and to the right. Tight
letter-spacing, centered alignment, crisp flat vector edges, no gradients,
no glow, no shadows, no other elements. Style: authoritative, geometric,
subtly noir, precision-instrument brand. Generous transparent padding.
```

---

## Social / Open Graph Preview (GitHub social preview)

**Save to:** `assets/brand/og-preview.png` (1280×640)

```
Social preview image, 1280×640 pixels, landscape. Bone white (#F6F4EF)
background. Left-aligned: the dark-mode Tool of Truth emblem (black circle,
white needle) at roughly 300×300 pixels. Center-aligned vertically: to the
right of the emblem, the horizontal wordmark "TOOL OF TRUTH" in black heavy
expanded grotesque, and below it in lighter weight: "Every tool call, proven."
Clean, minimal, generous whitespace, no decorative elements, no gradients,
flat matte. Style: a book jacket cover for a spy thriller meets a precision
tool brand.
```

---

## Favicon Sizes (derived from emblem-dark.png)

After generating `emblem-dark.png`, create these crops (center-cropped circles):

- `assets/brand/favicon-16.png` — 16×16
- `assets/brand/favicon-32.png` — 32×32
- `assets/brand/favicon-192.png` — 192×192

---

## File Structure When Done

```
01_Projects/ToolOfTruth/assets/brand/
├── emblem-dark.png
├── emblem-light.png
├── logotype-horizontal.png
├── logotype-stacked.png
├── og-preview.png
├── favicon-16.png
├── favicon-32.png
└── favicon-192.png
```

Once these are placed, I'll wire the repo README, social preview, and favicons automatically.
