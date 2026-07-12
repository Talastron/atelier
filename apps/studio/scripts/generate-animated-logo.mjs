// Animated Atelier logo for email signatures.
//
// Format: animated GIF — the only animation format supported across Gmail,
// Outlook (all versions), Apple Mail, iOS Mail, Android Gmail. CSS, SMIL,
// APNG, WebP-anim, and MP4 are all stripped or ignored by major clients.
//
// Behaviour: plays ONCE on email open, then settles on the final composed
// frame forever. Not an infinite loop — looping animations in signatures
// feel cheap; a one-shot reveal feels editorial.
//
// Background: opaque CREAM (not transparent). GIF only supports 1-bit
// alpha, so anti-aliased edges on a transparent background look ragged.
// Rendering against cream produces clean anti-aliasing and looks correct
// on white/cream email canvases (95%+ of real signature contexts).
//
// Sequence:
//   0.00 - 0.30  Wire hook + descending stem draw themselves
//   0.20 - 0.45  Triangle frame draws (overlaps with hook tail)
//   0.42 - 0.55  Brass charm line drops down from the bar
//   0.50 - 0.62  Brass charm dot fades in at the tip
//   0.55 - 0.85  Playfair "Atelier" wordmark reveals left-to-right
//   0.82 - 0.92  Brass period fades in
//   0.92 - 1.00  Settle (final 3 frames identical)
//
// Run with `npm run build:logo-animated`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';
// gifenc is published as CommonJS — the default-import dance below is the
// only shape Node ESM accepts without a dedicated wrapper module.
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INK   = '#1c1917';
const CREAM = '#F7F5F2';
const BRASS = '#D4B378';
const CREAM_RGB = { r: 247, g: 245, b: 242 };

// Canvas: 480×160 → sharp enough to look good in a Gmail signature without
// pushing the file size past ~600KB (anything bigger gets clipped by Gmail's
// 102KB message-quote threshold and is shown as "[Message clipped]").
const WIDTH  = 480;
const HEIGHT = 160;
const FPS    = 12;
const TOTAL_FRAMES = 60;   // 5 seconds; final settle frames identical
const DELAY_MS = Math.round(1000 / FPS);

// Mark placement
const MARK_SIZE     = 128;
const MARK_X        = 16;
const MARK_Y        = 16;
const MARK_VIEWBOX  = 256;
const MARK_SCALE    = MARK_SIZE / MARK_VIEWBOX;

// Wordmark placement — Playfair Display Medium, baseline aligned to the
// mark's vertical centre using cap-height arithmetic (cap ≈ 0.72 × em).
const FONT_SIZE  = 90;
const WORD_GAP   = 24;
const WORD_START = MARK_X + MARK_SIZE + WORD_GAP;
const capHeight  = FONT_SIZE * 0.72;
const baselineY  = MARK_Y + MARK_SIZE / 2 + capHeight / 2;

// Load Playfair Display and pre-compute the wordmark + period as outlined
// SVG path data. Outlining once (vs per-frame) means we never re-parse the
// font and the per-frame SVG is just two static path strings + animated
// clip-path / opacity.
const fontBuffer = readFileSync(resolve(__dirname, 'assets', 'PlayfairDisplay-Medium.ttf'));
const font = opentype.parse(fontBuffer.buffer.slice(
  fontBuffer.byteOffset,
  fontBuffer.byteOffset + fontBuffer.byteLength,
));
// Per-letter wordmark — each letter is outlined as its own path so it can
// fade in independently for the typewriter sequence. We MUST manually
// advance the cursor with kerning between adjacent pairs, otherwise
// "Atelier" reads with the wrong spacing (Playfair has tight A-t and t-e
// pairs that disappear if you just sum getAdvanceWidth per character).
const LETTERS = 'Atelier'.split('');
const unitsPerEm = font.unitsPerEm;
let cursor = WORD_START;
const letterData = LETTERS.map((ch, i) => {
  const x = cursor;
  const path = font.getPath(ch, x, baselineY, FONT_SIZE).toPathData(2);
  let advance = font.getAdvanceWidth(ch, FONT_SIZE);
  // Apply kerning toward the next character.
  if (i < LETTERS.length - 1) {
    const left  = font.charToGlyph(ch);
    const right = font.charToGlyph(LETTERS[i + 1]);
    advance += font.getKerningValue(left, right) * FONT_SIZE / unitsPerEm;
  }
  cursor += advance;
  return { ch, x, path };
});
// Kerning from the last letter ('r') into the period — Playfair's r-period
// pair is near-zero but apply it for correctness.
const rGlyph      = font.charToGlyph('r');
const periodGlyph = font.charToGlyph('.');
cursor += font.getKerningValue(rGlyph, periodGlyph) * FONT_SIZE / unitsPerEm;
const dotPathD = font.getPath('.', cursor, baselineY, FONT_SIZE).toPathData(2);

// --- Timing helpers ---------------------------------------------------------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const segment = (t, start, end) => easeOutCubic(clamp01((t - start) / (end - start)));

// Wordmark timing — typewriter rhythm. Each letter "lands" on its own
// beat, staggered by LETTER_STRIDE; the fade-in for each letter takes
// LETTER_FADE (kept short so the letter "pops" rather than ghosts in).
// 7 letters × 0.05 stride = 0.35 of the animation (≈ 1.75s at 5s total)
// — slower than a real typewriter, deliberately, so each serif lands.
const WORD_PHASE_START = 0.55;
const LETTER_STRIDE    = 0.050;
const LETTER_FADE      = 0.035;
const PERIOD_START     = WORD_PHASE_START + LETTERS.length * LETTER_STRIDE; // ≈ 0.90

// --- Frame builder ----------------------------------------------------------
function buildFrameSvg(t /* 0..1 across the animation */) {
  const hookP   = segment(t, 0.00, 0.28);
  const triP    = segment(t, 0.20, 0.44);
  const lineP   = segment(t, 0.42, 0.50);
  const dotP    = segment(t, 0.48, 0.56);
  const periodP = segment(t, PERIOD_START, PERIOD_START + 0.05);

  // Per-letter opacity — letter i starts at WORD_PHASE_START + i·stride
  // and fades to full over LETTER_FADE. At 12fps, LETTER_FADE ≈ 2 frames
  // so each letter pops rather than ghosts. The stride between letters
  // (~3 frames at 12fps ≈ 250ms) is a deliberate, sub-typewriter pace —
  // we're not racing; we're setting type.
  const letterP = letterData.map((_, i) =>
    segment(t, WORD_PHASE_START + i * LETTER_STRIDE,
                WORD_PHASE_START + i * LETTER_STRIDE + LETTER_FADE)
  );

  // Stroke-dasharray > path length means the dash never repeats; offset
  // animates from dashLen → 0 to draw the stroke from start to end.
  // Hook+stem path ≈ 84 units; triangle perimeter ≈ 330 units. Pad both.
  const HOOK_LEN = 120;
  const TRI_LEN  = 400;
  const LINE_LEN = 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
    <!-- Sentinel mark: rounded ink ground (visible from frame 0 — it's the
         canvas on which the wire and charm get drawn). -->
    <g transform="translate(${MARK_X} ${MARK_Y}) scale(${MARK_SCALE})">
      <rect width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}" rx="56" fill="${INK}"/>
      <g fill="none" stroke="${CREAM}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110"
              stroke-dasharray="${HOOK_LEN} ${HOOK_LEN}"
              stroke-dashoffset="${HOOK_LEN * (1 - hookP)}" />
        <path d="M 128 110 L 62 184 L 194 184 Z"
              stroke-dasharray="${TRI_LEN} ${TRI_LEN}"
              stroke-dashoffset="${TRI_LEN * (1 - triP)}" />
      </g>
      <!-- Brass maker's tag — the workshop's signature dangling on a thread. -->
      <line x1="128" y1="184" x2="128" y2="206"
            stroke="${BRASS}" stroke-width="1.5" stroke-linecap="round"
            stroke-dasharray="${LINE_LEN} ${LINE_LEN}"
            stroke-dashoffset="${LINE_LEN * (1 - lineP)}" />
      <circle cx="128" cy="212" r="5" fill="${BRASS}" opacity="${dotP}" />
    </g>

    <!-- Wordmark — letters set one at a time, like ink under a pen. -->
    ${letterData.map((ld, i) =>
      `<path d="${ld.path}" fill="${INK}" opacity="${letterP[i]}" />`
    ).join('\n    ')}

    <!-- Brass period — appears last, the workshop's full stop. -->
    <path d="${dotPathD}" fill="${BRASS}" opacity="${periodP}" />
  </svg>`;
}

// --- Render pipeline --------------------------------------------------------
async function svgToFlatRgba(svg) {
  // flatten() composites against opaque cream — kills the alpha channel so
  // anti-aliased edges look clean in the binary-alpha GIF. ensureAlpha()
  // re-adds an all-255 channel so gifenc receives RGBA as expected.
  const buf = await sharp(Buffer.from(svg))
    .flatten({ background: CREAM_RGB })
    .ensureAlpha()
    .raw()
    .toBuffer();
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

async function main() {
  console.log(`Rendering ${TOTAL_FRAMES} frames at ${WIDTH}×${HEIGHT}, ${FPS} fps…`);

  // Render frames serially — sharp's libvips is single-threaded per call,
  // and parallel SVG rasterization on this small a job adds no real win
  // while making the progress log unreadable.
  const frames = [];
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const t = i / (TOTAL_FRAMES - 1);
    const svg = buildFrameSvg(t);
    frames.push(await svgToFlatRgba(svg));
    process.stdout.write(`\r  ${i + 1}/${TOTAL_FRAMES}`);
  }
  process.stdout.write('\n');

  // Build a SHARED palette from sample frames (empty, mid-animation, full).
  // Per-frame palettes drift across frames and inflate file size. A single
  // global palette gives stable colour rendering AND a smaller GIF — every
  // frame after the first just references the global table.
  console.log('Building shared palette…');
  const samples = [frames[0], frames[Math.floor(TOTAL_FRAMES / 2)], frames[TOTAL_FRAMES - 1]];
  const merged = new Uint8Array(samples.length * frames[0].length);
  samples.forEach((s, i) => merged.set(s, i * s.length));
  // 64 colours: cream + ink + brass + ~30 anti-alias intermediates leaves
  // plenty of headroom. 256 would bloat the file with palette entries
  // that never get used; 32 starts to posterize the curved edges.
  const palette = quantize(merged, 64);

  console.log('Encoding GIF…');
  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const indexed = applyPalette(frames[i], palette);
    gif.writeFrame(indexed, WIDTH, HEIGHT, {
      palette: i === 0 ? palette : undefined,  // global palette: only emit on first frame
      delay: DELAY_MS,
      // First frame carries the loop control. -1 = play once and settle on
      // the final frame forever. The sophisticated alternative to the
      // standard infinite loop.
      repeat: i === 0 ? -1 : undefined,
    });
  }
  gif.finish();

  const outDir = resolve(ROOT, 'brand');
  mkdirSync(outDir, { recursive: true });

  const gifBytes = gif.bytes();
  writeFileSync(resolve(outDir, 'atelier-logo-animated.gif'), gifBytes);
  const sizeKB = (gifBytes.length / 1024).toFixed(0);
  console.log(`✓ brand/atelier-logo-animated.gif  (${WIDTH}×${HEIGHT}, ${TOTAL_FRAMES} frames, ${sizeKB} KB, plays once)`);

  // Still-frame PNG: the same final composition, for any client that strips
  // animated GIFs entirely or for use as a fallback poster image.
  const finalSvg = buildFrameSvg(1);
  await sharp(Buffer.from(finalSvg))
    .flatten({ background: CREAM_RGB })
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, 'atelier-logo-animated-still.png'));
  console.log(`✓ brand/atelier-logo-animated-still.png  (fallback final-frame poster)`);
}

await main();
