// Pre-build image optimizer.
//
// Walks every JPG/PNG in `public/seed-wardrobe/` and emits a WebP sibling
// (e.g. silk-blouse-ivory.jpg → silk-blouse-ivory.webp) at a width capped
// for editorial use. WebP is ~30-40% smaller than equivalent-quality JPEG
// and is supported by every browser shipped since 2020 (~97% global).
//
// The React components reference both source paths inside <picture>, so
// the browser picks the smaller WebP when it can and falls back to the
// JPEG when it can't. This means a future image swap is zero-friction:
// drop a new .jpg into seed-wardrobe/, run `npm run build`, the prebuild
// hook regenerates the matching .webp.
//
// Idempotent — skips any image whose .webp is newer than the source, so
// re-running on every build doesn't waste cycles on unchanged files.

import { readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, extname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Directories under public/ whose JPG/PNG images get a WebP sibling.
// Add a folder here so a future image swap stays zero-friction.
const SOURCE_DIRS = ['seed-wardrobe', 'wardrobe'].map((d) => resolve(__dirname, '..', 'public', d));

// Max width for editorial product photos. The StudioFrame slot displays
// these at ~200px CSS pixels; 1024px gives ~5x density headroom for 4-5K
// displays without blowing up file size. Aspect ratio is preserved.
const MAX_WIDTH = 1024;

// WebP encoder quality. 80 is the sweet spot — visually indistinguishable
// from the JPEG source on photographic content while saving meaningful
// bytes. Drop to 75 for further savings; 85+ kills the whole point.
const WEBP_QUALITY = 80;

// Small JPEG variant for the CSS background-image tiles (Concierge Reel,
// What-Atelier-does). Two reasons it is JPEG, not WebP: (1) the tiles never
// render larger than ~230 CSS px, so a 480px source is ample even at 2x; and
// (2) WebP decoded onto a GPU-composited layer (the reel's scaled + blurred
// cards) fringes green on some renderers, whereas JPEG does not. A 480px JPEG
// (~20KB) is already smaller than the full-size WebP, so we keep the perf win.
const SM_WIDTH = 480;
const SM_QUALITY = 74;
const SM_SUFFIX = '-sm';

const SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png']);

// True when `outPath` already exists and is newer than its source.
const upToDate = (outPath, srcMtime) => existsSync(outPath) && statSync(outPath).mtimeMs >= srcMtime;

let processed = 0;
let skipped = 0;
let saved = 0;

for (const SOURCE_DIR of SOURCE_DIRS) {
  if (!existsSync(SOURCE_DIR)) {
    console.log(`No ${SOURCE_DIR} — skipping.`);
    continue;
  }

  const files = readdirSync(SOURCE_DIR)
    .filter((f) => SOURCE_EXTS.has(extname(f).toLowerCase()))
    // Never treat a generated small variant as a source (would spawn
    // name-sm-sm.jpg and name-sm.webp on the next run).
    .filter((f) => !basename(f, extname(f)).endsWith(SM_SUFFIX));

  for (const file of files) {
    const sourcePath = join(SOURCE_DIR, file);
    const baseName = basename(file, extname(file));
    const srcMtime = statSync(sourcePath).mtimeMs;
    const sourceBytes = statSync(sourcePath).size;

    // 1) Full-size WebP sibling, for <picture> / <Pic> usages.
    const webpPath = join(SOURCE_DIR, `${baseName}.webp`);
    if (upToDate(webpPath, srcMtime)) {
      skipped += 1;
    } else {
      await sharp(sourcePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(webpPath);
      saved += sourceBytes - statSync(webpPath).size;
      processed += 1;
      console.log(`  ✓ ${baseName}.webp  (${Math.round(sourceBytes / 1024)} KB → ${Math.round(statSync(webpPath).size / 1024)} KB)`);
    }

    // 2) Small JPEG variant, for the CSS background-image tiles.
    const smPath = join(SOURCE_DIR, `${baseName}${SM_SUFFIX}.jpg`);
    if (upToDate(smPath, srcMtime)) {
      skipped += 1;
    } else {
      await sharp(sourcePath)
        .resize({ width: SM_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: SM_QUALITY, mozjpeg: true })
        .toFile(smPath);
      processed += 1;
      console.log(`  ✓ ${baseName}${SM_SUFFIX}.jpg  (${Math.round(statSync(smPath).size / 1024)} KB)`);
    }
  }
}

if (processed > 0) {
  console.log(`\nOptimized ${processed} image${processed === 1 ? '' : 's'}, saved ${Math.round(saved / 1024)} KB.`);
}
if (skipped > 0) {
  console.log(`Skipped ${skipped} (already up to date).`);
}
