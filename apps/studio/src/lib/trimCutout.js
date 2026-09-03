// Trim a cut-out to its subject's bounding box (plus a uniform margin), so
// object-contain scales the subject up to fill its tile. Fixes the "delicate
// piece floats tiny in a big white tile" problem — after trimming, a small
// earring and a chunky bracelet both fill their tiles consistently.
//
// The subject is detected by ALPHA where the image has any, and by COLOUR
// (non-white pixels) where it does not. This header used to say colour only,
// and that was load-bearing until phase two: a transparent pixel reads from
// getImageData as (0,0,0,0) — black — so a colour test counts the whole
// transparent ground as subject, concludes the cut-out is already tight, and
// silently declines to trim it.
//
// Order matters more than it looks. polishItemPrimary removes the background
// and THEN trims, so whatever this function writes is what gets stored. #78
// caught it re-encoding every WebP cut-out back to JPEG here; the same position
// in the pipeline is why it could have flattened away every alpha cut-out too.
//
// A safeguard leaves genuinely white-on-white items — or already-tight cut-outs
// — untrimmed rather than guessing wrong.
import { canEncodeWebp, pickEncoding, WEBP_LADDER, JPEG_LADDER } from './encode.js';

// What fraction of the frame must be translucent before we believe this image
// has a transparent GROUND, rather than a few soft edge pixels.
//
// Deciding on "any pixel is translucent" was too brittle: one anti-aliased pixel
// at alpha 254 in an otherwise opaque cut-out flipped the whole image into alpha
// mode, where the opaque white ground scores as subject, the box becomes the
// whole frame, and the trim silently declines as "already tight" — the exact
// failure this function was fixed for, arriving by a different door.
//
// A real cut-out's ground is 40-70% of the frame and stray edge pixels are a
// fraction of one per cent, so this separates them with two orders of magnitude
// to spare. The 250 rather than 255 ignores near-opaque encoder noise.
const TRANSLUCENT_FRACTION = 0.01;

export function hasAlphaGround({ data }) {
  const total = data.length / 4;
  let translucent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) translucent += 1;
  }
  return translucent >= total * TRANSLUCENT_FRACTION;
}

// Pure: given raw RGBA pixels, return the bounding box of "content" pixels as
// { x, y, w, h }, or null if there is none. Two detection modes, because the
// input can be either kind of cut-out. When the image has a transparent ground,
// ALPHA is the truth and colour is irrelevant — a white shirt on a transparent
// ground is entirely subject. When it does not, the subject is what is not
// white, and `threshold` is how far the darkest channel must fall below 255 to
// count: high enough to ignore off-white JPEG noise, low enough to catch cream
// and pale subjects. The comparison is strict — a deviation of exactly the
// threshold is background, which is how it was tuned.
//
// Getting the mode wrong is silent and total. getImageData returns a fully
// transparent pixel as (0, 0, 0, 0), so a colour test reads it as BLACK and
// therefore as subject — the box becomes the whole frame, coverage hits 1.0,
// and the caller concludes the cut-out is already tight and leaves it alone.
export function contentBounds({ data, width, height }, threshold = 14) {
  const hasAlpha = hasAlphaGround({ data });

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Alpha 8 of 255 discards the near-invisible matte fringe imgly leaves
      // around a cut edge. Anything it excludes sits 1-2px outside the subject,
      // far inside the 6% margin the crop adds back, so nothing visible is lost.
      const isContent = hasAlpha
        ? data[i + 3] > 8
        : 255 - Math.min(data[i], data[i + 1], data[i + 2]) > threshold;
      if (!isContent) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// DOM: load a cut-out data URL — on either a white or a transparent ground —
// find its subject, and return a tightly cropped data URL (subject + uniform
// margin). The output keeps a transparent ground where the input had one, and
// is re-composited on white where it did not. Returns { url, ok }. ok:false —
// and the original url — when there's nothing safe to trim: no subject found,
// an already-tight cut-out (coverage >= maxCover), a tainted canvas, a load
// error, or an alpha cut-out on a browser that cannot encode WebP. Callers
// keep the original in that case.
export async function trimCutoutDataUrl(dataUrl, {
  threshold = 14,
  marginPct = 0.06,
  maxCover = 0.92,
  maxBytes = 220_000,
} = {}) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return { url: dataUrl, ok: false };
  const img = await new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
  if (!img) return { url: dataUrl, ok: false };
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const src = document.createElement('canvas');
  src.width = nw;
  src.height = nh;
  const sctx = src.getContext('2d');
  sctx.drawImage(img, 0, 0);
  let pixels;
  try {
    pixels = sctx.getImageData(0, 0, nw, nh);
  } catch {
    return { url: dataUrl, ok: false }; // tainted canvas — leave as-is
  }
  const bounds = contentBounds(pixels, threshold);
  if (!bounds) return { url: dataUrl, ok: false }; // all white / no subject
  const coverage = (bounds.w * bounds.h) / (nw * nh);
  if (coverage >= maxCover) return { url: dataUrl, ok: false }; // already tight

  // Expand by a uniform margin (fraction of the larger side), clamped to bounds.
  const m = Math.round(Math.max(bounds.w, bounds.h) * marginPct);
  const x0 = Math.max(0, bounds.x - m);
  const y0 = Math.max(0, bounds.y - m);
  const x1 = Math.min(nw, bounds.x + bounds.w + m);
  const y1 = Math.min(nh, bounds.y + bounds.h + m);
  const cw = x1 - x0;
  const ch = y1 - y0;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  // Only paint a ground under a cut-out that HAS one. polishItemPrimary removes
  // the background and then trims the result, so this function is what actually
  // gets stored on the polish path — filling white here would flatten the alpha
  // one line after removal produced it, and the migration would be a silent
  // no-op on the path most items use. (#78 caught the same shape of bug when
  // this function re-encoded WebP straight back to JPEG.)
  const keepAlpha = hasAlphaGround(pixels);
  if (!keepAlpha) {
    octx.fillStyle = '#FFFFFF';
    octx.fillRect(0, 0, cw, ch);
  }
  octx.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);

  // Same encoding choice as removeImageBackground, and for a load-bearing
  // reason: polishItemPrimary removes the background and then trims the result,
  // so whatever format this writes is what actually gets stored. Left encoding
  // JPEG, it would have converted every WebP cut-out straight back and undone
  // the saving completely on the polish path — the one most items use.
  const webp = await canEncodeWebp();
  // JPEG has no alpha. Trimming an alpha cut-out on a browser that cannot write
  // WebP would flatten it silently, so we return the input untrimmed instead —
  // a slightly loose cut-out is a far better outcome than a destroyed one.
  if (keepAlpha && !webp) return { url: dataUrl, ok: false };
  const url = await pickEncoding(
    async (quality) => out.toDataURL(webp ? 'image/webp' : 'image/jpeg', quality),
    webp ? WEBP_LADDER : JPEG_LADDER,
    maxBytes,
  );
  // Match every other failure path here: hand the original back, so a caller
  // doing `if (trimmed.ok) cutout = trimmed.url` still has something to keep.
  if (!url) return { url: dataUrl, ok: false };
  // `keepAlpha` is a measured property of the pixels this function just
  // encoded — not an option echoed back — so a caller like polishItemPrimary
  // can trust it more than whatever alpha was originally requested.
  return { url, ok: true, keepAlpha };
}
