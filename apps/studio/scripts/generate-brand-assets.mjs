// Brand asset generator for Atelier.
//
// Renders two families of assets from the single source-of-truth wire-hanger
// "sentinel" mark + Playfair Display wordmark:
//
//   • Favicon set — public/apple-touch-icon.png (180), icon-192.png, icon-512.png
//     iOS Home Screen + Android PWA need raster PNGs; the SVG favicon alone
//     leaves those surfaces with a screenshot or blank tile.
//
//   • Brand logo  — brand/atelier-logo.png and atelier-logo@2x.png
//     Horizontal lockup, transparent background. The mark sits left, the
//     Playfair "Atelier." wordmark right, with a brass period.
//
// Run with `node scripts/generate-brand-assets.mjs`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INK    = '#1c1917';
const CREAM  = '#F7F5F2';
const BRASS  = '#D4B378';

// ---------------------------------------------------------------------------
// Sentinel — wire hanger mark.
// Mirrors public/icon.svg and src/App.jsx AtelierMark exactly. We re-emit it
// instead of reading the file so we can vary the colour scheme (favicon needs
// the ink rounded-square; the logo prefers the mark on a transparent ground
// with the ink-coloured wire so it sits on cream surfaces.)
// ---------------------------------------------------------------------------
function sentinelSvg({ bg = INK, wire = CREAM, brass = BRASS, rx = 56, size = 256 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
  <rect width="256" height="256" rx="${rx}" fill="${bg}"/>
  <g fill="none" stroke="${wire}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110"/>
    <path d="M 128 110 L 62 184 L 194 184 Z"/>
  </g>
  <line x1="128" y1="184" x2="128" y2="206" stroke="${brass}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
  <circle cx="128" cy="212" r="5" fill="${brass}"/>
</svg>`;
}

// ---------------------------------------------------------------------------
// Favicons. Pre-rendered PNGs at the canonical sizes browsers/OSes ask for.
// ---------------------------------------------------------------------------
async function buildFavicons() {
  const out = resolve(ROOT, 'public');
  mkdirSync(out, { recursive: true });

  const sizes = [
    { name: 'apple-touch-icon.png', px: 180 },
    { name: 'icon-192.png',         px: 192 },
    { name: 'icon-512.png',         px: 512 },
  ];

  for (const { name, px } of sizes) {
    const svg = sentinelSvg({ size: px });
    await sharp(Buffer.from(svg)).resize(px, px).png().toFile(resolve(out, name));
    console.log(`✓ public/${name}  (${px}×${px})`);
  }
}

// ---------------------------------------------------------------------------
// Logo. The hanger mark sits left of an outlined "Atelier." rendered in
// Playfair Display Medium. The trailing period is brass — a quiet brand
// signature that recurs throughout the app's editorial chrome.
//
// librsvg (used by sharp) does NOT honour @font-face inside SVG, so we use
// opentype.js to convert the text to a `<path>` ahead of time. That makes the
// render font-independent of whatever is installed on the host.
// ---------------------------------------------------------------------------
async function buildLogo() {
  const fontBuffer = readFileSync(resolve(__dirname, 'assets', 'PlayfairDisplay-Medium.ttf'));
  // opentype.parse expects an ArrayBuffer; Node Buffer.buffer hands us the
  // underlying one (sliced to the buffer's actual region).
  const font = opentype.parse(fontBuffer.buffer.slice(
    fontBuffer.byteOffset,
    fontBuffer.byteOffset + fontBuffer.byteLength,
  ));

  // Wordmark — period rendered separately so we can paint it brass.
  // Tracking is left at default; Playfair is already optically spaced.
  const FONT_SIZE = 220;     // logical px in the SVG coordinate space
  const MARK_SIZE = 240;     // sentinel rendered at 240×240 (matches cap height + lead)
  const GAP      = 44;       // gap between mark and wordmark
  const PAD_X    = 48;
  const PAD_Y    = 48;

  // Render "Atelier" and "." as separate paths so they can take different fills.
  const wordPath  = font.getPath('Atelier', 0, 0, FONT_SIZE);
  const dotPath   = font.getPath('.',       0, 0, FONT_SIZE);

  const wordBBox = wordPath.getBoundingBox();
  const dotBBox  = dotPath.getBoundingBox();

  // Width of the wordmark itself = advance of "Atelier" + advance of "."
  // opentype.js's getPath uses the font's horizontal advances under the hood,
  // so we measure by advancing the glyph run.
  const wordAdvance = font.getAdvanceWidth('Atelier', FONT_SIZE);
  const dotAdvance  = font.getAdvanceWidth('.',       FONT_SIZE);
  const wordmarkWidth = wordAdvance + dotAdvance;

  // Total canvas width: pad + mark + gap + wordmark + pad
  const canvasW = PAD_X + MARK_SIZE + GAP + wordmarkWidth + PAD_X;
  // Height keyed off the mark — wordmark is vertically centred against it.
  const canvasH = PAD_Y + MARK_SIZE + PAD_Y;

  // Vertical baseline placement: Playfair cap-height ≈ 0.72 * em.
  // Centre the cap-height region against the mark's vertical centre.
  const capHeight = FONT_SIZE * 0.72;
  const markCenterY = PAD_Y + MARK_SIZE / 2;
  const baselineY = markCenterY + capHeight / 2;

  // Re-emit paths with their true x/y positions baked in.
  const wordPathPositioned = font.getPath('Atelier', PAD_X + MARK_SIZE + GAP, baselineY, FONT_SIZE);
  const dotPathPositioned  = font.getPath('.',       PAD_X + MARK_SIZE + GAP + wordAdvance, baselineY, FONT_SIZE);

  const wordPathD = wordPathPositioned.toPathData(3);
  const dotPathD  = dotPathPositioned.toPathData(3);

  // Sentinel — rendered as an inline group so the whole logo is one SVG and
  // sharp can rasterize it in a single shot.
  const sentinelInline = `
    <g transform="translate(${PAD_X} ${PAD_Y}) scale(${MARK_SIZE / 256})">
      <rect width="256" height="256" rx="56" fill="${INK}"/>
      <g fill="none" stroke="${CREAM}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110"/>
        <path d="M 128 110 L 62 184 L 194 184 Z"/>
      </g>
      <line x1="128" y1="184" x2="128" y2="206" stroke="${BRASS}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
      <circle cx="128" cy="212" r="5" fill="${BRASS}"/>
    </g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}">
    ${sentinelInline}
    <path d="${wordPathD}" fill="${INK}"/>
    <path d="${dotPathD}"  fill="${BRASS}"/>
  </svg>`;

  // Also write the source SVG — useful for any vector consumer (print, slide
  // decks) and for regenerating raster sizes later.
  const outDir = resolve(ROOT, 'brand');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'atelier-logo.svg'), svg);
  console.log(`✓ brand/atelier-logo.svg  (${Math.round(canvasW)}×${Math.round(canvasH)} logical)`);

  // Two raster outputs:
  //   • atelier-logo.png    — fits within ~1600px wide (presentation, web header)
  //   • atelier-logo@2x.png — fits within ~3200px wide (print, retina hero)
  const targets = [
    { name: 'atelier-logo.png',    width: 1600 },
    { name: 'atelier-logo@2x.png', width: 3200 },
  ];

  for (const { name, width } of targets) {
    await sharp(Buffer.from(svg))
      .resize({ width })            // transparent background preserved by default
      .png({ compressionLevel: 9 })
      .toFile(resolve(outDir, name));
    console.log(`✓ brand/${name}  (${width}px wide, transparent)`);
  }
}

await buildFavicons();
await buildLogo();
console.log('\nDone.');
