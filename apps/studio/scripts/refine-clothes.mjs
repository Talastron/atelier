#!/usr/bin/env node
// refine-clothes.mjs — transform a folder of retailer product photos into
// editorial-luxury, copyright-distanced assets for the atelier marketing site.
//
// Pipeline per image:
//   1. Read source (.jpg / .png / .webp / .avif — sharp handles all).
//   2. Pure-sharp chromakey: pixels where R, G, B all > THRESHOLD become
//      fully transparent. Works because retailer product shots have clean
//      near-white backgrounds — no AI segmentation needed.
//   3. Strong neutralisation: heavy desaturation + warm cream/stone tint.
//      The point isn't to mask logos — it's to push every garment into a
//      consistent "luxury hotel suite" colour cast that reads as one
//      curated capsule rather than scraped product images.
//   4. Resize-to-fit with padding inside a 832×1088 canvas (3:4 portrait,
//      matches the Flux-generated capsule's aspect).
//   5. Composite onto a cream→stone vertical gradient (#F4EFE6 → #D9D1C5).
//   6. Save as JPG quality 88.
//
// Branded items the user has flagged for replacement are written to a
// SKIPLIST near the top — they're skipped here and handled separately.
//
// Usage:
//   node scripts/refine-clothes.mjs                         # use defaults
//   node scripts/refine-clothes.mjs --in <dir> --out <dir>  # override
//   node scripts/refine-clothes.mjs <filename>              # one file
//   node scripts/refine-clothes.mjs --force                 # redo all
//   node scripts/refine-clothes.mjs --preview <file>        # generate one
//                                                            and print path
//
// Requires sharp (already a devDep).

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ───── Config ─────────────────────────────────────────────────────────
const DEFAULT_IN = path.resolve(ROOT, '..', 'atelier-website', 'apps', 'marketing', 'public', 'Clothes');
const DEFAULT_OUT = path.resolve(ROOT, '..', 'atelier-website', 'apps', 'marketing', 'public', 'Clothes-Refined');

const CANVAS_W = 832;
const CANVAS_H = 1088;
const INSET_PCT = 0.08;          // garment padding inside canvas (8% each side)

// Pure-sharp pipeline. Background detected by sampling the corner pixel and
// flood-filling from corners (preserves white garments). Halo around darker
// garments killed by N propagation passes of luminance-based alpha fade.
const BG_TOLERANCE = 8;          // flood-fill tolerance per channel
const HALO_BAND = 70;            // pixels within this colour distance of bg
                                 // get tapered alpha during propagation
const HALO_PASSES = 6;           // propagation depth — kills multi-pixel halos

const GRADIENT_TOP = '#F4EFE6';  // cream
const GRADIENT_BOT = '#D9D1C5';  // stone

const NEUTRALISE = {
  saturation: 0.15,              // strip ~85% of colour
  brightness: 1.02,              // tiny lift to compensate for desat
};
const WARM_TINT = { r: 230, g: 220, b: 205 };  // warm stone wash

// Files flagged to skip. Audit done 2026-06-19: 16 items fail because the
// source photo shows a heritage-brand logo embroidered/embossed on the
// garment itself, which this pipeline can't remove (it cleans backgrounds,
// not logos). 3 fail because the source has a non-white background that
// breaks the flood-fill. Replace via AI generation or a different source.
const SKIPLIST = new Set([
  // Logo-on-garment failures
  'belt.jpeg',                       // FAIRFAX & FAVOR buckle text
  'blazer.jpeg',                     // Ralph Lauren RL monogram embroidered
  'jeans shorts.jpeg',               // Holland Cooper waistband label
  'linen sleevless shirt.jpeg',      // Holland Cooper crest at collar
  'loafer driver.jpeg',              // Ralph Lauren RL plaque
  'loafers.jpeg',                    // Holland Cooper HC monogram
  'raincoat.jpeg',                   // Barbour T monograms at neck
  'shirt dress.jpeg',                // Ralph Lauren Polo pony
  'shirt short.jpeg',                // Ralph Lauren Polo pony
  'shopper.jpeg',                    // LONGCHAMP PARIS + marble bg
  'sneaker.jpeg',                    // Adidas Samba (trademarked design)
  'sunglasses.jpeg',                 // CHANEL temple logo
  'sweater.jpeg',                    // Holland Cooper chest embroidery
  'white top.jpeg',                  // HOBBS tag + flood-fill fragmented
  // Background-failure (non-uniform source bg)
  'cuff.webp',                       // gradient bg, photo box visible
  'pendant.jpeg',                    // gradient bg, photo box visible
]);

// ───── Arg parsing ────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : null;
};
const IN_DIR = flag('--in') || DEFAULT_IN;
const OUT_DIR = flag('--out') || DEFAULT_OUT;
const FORCE = !!flag('--force');
const PREVIEW = flag('--preview');
const SINGLE = argv.find((a) => !a.startsWith('--') && a !== IN_DIR && a !== OUT_DIR && a !== PREVIEW);

// ───── Pretty print ───────────────────────────────────────────────────
const c = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const dim = c(2), bold = c(1), green = c(32), yellow = c(33), red = c(31), cyan = c(36);

// ───── Core helpers ───────────────────────────────────────────────────

async function makeGradientBackground() {
  const svg = Buffer.from(
    `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="${GRADIENT_TOP}"/>
           <stop offset="100%" stop-color="${GRADIENT_BOT}"/>
         </linearGradient>
       </defs>
       <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#g)"/>
     </svg>`
  );
  return await sharp(svg).png().toBuffer();
}

async function chromakeyWhite(inputPath) {
  // Step 1: read raw RGBA.
  const { data, info } = await sharp(inputPath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // Step 2: sample background colour as the average of the 4 corners.
  const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]];
  let bR = 0, bG = 0, bB = 0;
  for (const [x, y] of corners) {
    const i = (y * W + x) * 4;
    bR += data[i]; bG += data[i + 1]; bB += data[i + 2];
  }
  bR = Math.round(bR / 4); bG = Math.round(bG / 4); bB = Math.round(bB / 4);

  const tol = BG_TOLERANCE;
  const isBg = (idx) =>
    Math.abs(data[idx] - bR) <= tol &&
    Math.abs(data[idx + 1] - bG) <= tol &&
    Math.abs(data[idx + 2] - bB) <= tol;
  const colourDist = (idx) =>
    Math.max(Math.abs(data[idx] - bR), Math.abs(data[idx + 1] - bG), Math.abs(data[idx + 2] - bB));

  // Step 3: flood-fill from ALL edge pixels (not just corners). Covers cases
  // where a garment touches an edge — e.g. trouser legs running to the bottom
  // of the frame enclose a V-shaped patch of background that corners alone
  // can't reach. Only background-CONNECTED pixels die, so a white garment
  // whose interior is +9 brighter than the grey bg survives.
  const visited = new Uint8Array(W * H);
  const qx = new Int32Array(W * H), qy = new Int32Array(W * H);
  let qHead = 0, qTail = 0;
  const seedIfBg = (x, y) => {
    const flat = y * W + x;
    if (visited[flat]) return;
    if (isBg(flat * 4)) {
      visited[flat] = 1;
      qx[qTail] = x; qy[qTail] = y; qTail++;
    }
  };
  for (let x = 0; x < W; x++) { seedIfBg(x, 0); seedIfBg(x, H - 1); }
  for (let y = 0; y < H; y++) { seedIfBg(0, y); seedIfBg(W - 1, y); }
  while (qHead < qTail) {
    const x = qx[qHead], y = qy[qHead]; qHead++;
    data[(y * W + x) * 4 + 3] = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const flat = ny * W + nx;
      if (visited[flat]) continue;
      const nIdx = flat * 4;
      if (isBg(nIdx)) {
        visited[flat] = 1;
        qx[qTail] = nx; qy[qTail] = ny; qTail++;
      }
    }
  }

  // Step 4: multi-pass halo killer. Each pass: for each still-opaque pixel
  // adjacent to a now-faded (alpha < 200) one, taper its alpha based on how
  // close its colour is to bg. Propagates inward until either the chain of
  // close-to-bg pixels ends (interior garment colour) or HALO_PASSES caps.
  // 6 passes ≈ 6px deep halo cleanup, more than enough for JPG edges.
  const snapshot = new Uint8Array(W * H);
  for (let pass = 0; pass < HALO_PASSES; pass++) {
    for (let i = 0, j = 0; j < W * H; i += 4, j++) snapshot[j] = data[i + 3];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const flat = y * W + x;
        const idx = flat * 4;
        if (data[idx + 3] === 0) continue;
        let neighbourFaded = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (snapshot[ny * W + nx] < 200) { neighbourFaded = true; break; }
        }
        if (!neighbourFaded) continue;
        const d = colourDist(idx);
        if (d < HALO_BAND) {
          const newAlpha = Math.round((d / HALO_BAND) * 255);
          if (newAlpha < data[idx + 3]) data[idx + 3] = newAlpha;
        }
      }
    }
  }

  return sharp(data, { raw: { width: W, height: H, channels: 4 } });
}

async function refineOne(inputPath, outputPath) {
  // 1. White-bg chromakey.
  const cutout = await chromakeyWhite(inputPath);

  // 2. Strong neutralisation: heavy desat + warm stone wash. Tint affects
  //    visible (non-transparent) pixels of the garment only; alpha is preserved.
  const neutralised = await cutout
    .modulate(NEUTRALISE)
    .tint(WARM_TINT)
    .png()
    .toBuffer();

  // 3. Resize to fit inside the canvas with INSET_PCT padding on each side.
  const insetW = Math.round(CANVAS_W * (1 - 2 * INSET_PCT));
  const insetH = Math.round(CANVAS_H * (1 - 2 * INSET_PCT));
  const padded = await sharp(neutralised)
    .resize({ width: insetW, height: insetH, fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 4. Composite onto gradient.
  const bg = await makeGradientBackground();
  await sharp(bg)
    .composite([{ input: padded, gravity: 'center' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outputPath);
}

// ───── Driver ─────────────────────────────────────────────────────────

async function listImages(dir) {
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
  const entries = await fs.readdir(dir);
  return entries
    .filter((e) => exts.has(path.extname(e).toLowerCase()))
    .sort();
}

function outName(srcName) {
  const ext = path.extname(srcName);
  const base = srcName.slice(0, -ext.length);
  // Normalise: spaces → dashes, lowercase, .jpg
  return base.toLowerCase().replace(/\s+/g, '-') + '.jpg';
}

async function main() {
  console.log(`${bold(cyan('refine-clothes'))}`);
  console.log(`  ${dim('in :')} ${IN_DIR}`);
  console.log(`  ${dim('out:')} ${OUT_DIR}\n`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const files = await listImages(IN_DIR);
  const queue = SINGLE ? files.filter((f) => f === SINGLE || outName(f) === SINGLE) : files;
  if (queue.length === 0) {
    console.log(red('no files matched.'));
    process.exit(1);
  }

  const summary = { ok: 0, skipped: 0, failed: 0 };
  for (const fname of queue) {
    const out = path.join(OUT_DIR, outName(fname));
    if (SKIPLIST.has(fname)) {
      console.log(`  ${yellow('skip')}  ${fname} ${dim('(branded, replace separately)')}`);
      summary.skipped++;
      continue;
    }
    if (!FORCE) {
      try { await fs.access(out); console.log(`  ${dim('skip')}  ${fname} ${dim('(exists; --force to redo)')}`); summary.skipped++; continue; } catch {}
    }
    try {
      const t0 = Date.now();
      await refineOne(path.join(IN_DIR, fname), out);
      const ms = Date.now() - t0;
      const kb = ((await fs.stat(out)).size / 1024).toFixed(0);
      console.log(`  ${green('ok')}    ${fname} ${dim(`→ ${path.basename(out)} (${kb}KB, ${ms}ms)`)}`);
      summary.ok++;
    } catch (err) {
      console.log(`  ${red('fail')}  ${fname} — ${err.message}`);
      summary.failed++;
    }
  }

  const parts = [];
  if (summary.ok) parts.push(green(`${summary.ok} refined`));
  if (summary.skipped) parts.push(dim(`${summary.skipped} skipped`));
  if (summary.failed) parts.push(red(`${summary.failed} failed`));
  console.log(`\n${bold('done')} · ${parts.join(' · ') || dim('no work')}`);
  if (summary.failed) process.exit(1);
}

main().catch((err) => { console.error(red('\nfatal:'), err); process.exit(1); });
