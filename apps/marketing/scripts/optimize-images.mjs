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
const SOURCE_DIR = resolve(__dirname, '..', 'public', 'seed-wardrobe');

// Max width for editorial product photos. The StudioFrame slot displays
// these at ~200px CSS pixels; 1024px gives ~5x density headroom for 4-5K
// displays without blowing up file size. Aspect ratio is preserved.
const MAX_WIDTH = 1024;

// WebP encoder quality. 80 is the sweet spot — visually indistinguishable
// from the JPEG source on photographic content while saving meaningful
// bytes. Drop to 75 for further savings; 85+ kills the whole point.
const WEBP_QUALITY = 80;

const SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png']);

if (!existsSync(SOURCE_DIR)) {
  console.log(`No ${SOURCE_DIR} — nothing to optimize, skipping.`);
  process.exit(0);
}

const files = readdirSync(SOURCE_DIR).filter((f) => SOURCE_EXTS.has(extname(f).toLowerCase()));

let processed = 0;
let skipped = 0;
let saved = 0;

for (const file of files) {
  const sourcePath = join(SOURCE_DIR, file);
  const baseName = basename(file, extname(file));
  const webpPath = join(SOURCE_DIR, `${baseName}.webp`);

  // Idempotency: if the .webp exists and is newer than the source, leave
  // it alone. mtimeMs comparison is cheap and accurate for build caches.
  if (existsSync(webpPath)) {
    const srcMtime = statSync(sourcePath).mtimeMs;
    const webpMtime = statSync(webpPath).mtimeMs;
    if (webpMtime >= srcMtime) {
      skipped += 1;
      continue;
    }
  }

  const sourceBytes = statSync(sourcePath).size;
  await sharp(sourcePath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toFile(webpPath);
  const outputBytes = statSync(webpPath).size;
  saved += sourceBytes - outputBytes;
  processed += 1;
  console.log(`  ✓ ${file} → ${baseName}.webp  (${Math.round(sourceBytes / 1024)} KB → ${Math.round(outputBytes / 1024)} KB)`);
}

if (processed > 0) {
  console.log(`\nOptimized ${processed} image${processed === 1 ? '' : 's'}, saved ${Math.round(saved / 1024)} KB.`);
}
if (skipped > 0) {
  console.log(`Skipped ${skipped} (already up to date).`);
}
