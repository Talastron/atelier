// src/lib/encode.js
//
// Choosing an image encoding that fits a size budget, and finding out whether
// this browser can write WebP at all.
//
// WebP was measured against JPEG on 32 real garment cut-outs: at matched
// quality it comes out at 0.56x the size, with no visible difference, because
// both are flattened onto the same white background. That is the entire reason
// this exists — halving what every polished item costs, for a format change.
//
// (The same measurement found WebP WITH alpha at 1.64x JPEG. That is phase two
// of the flat-lay work and needs an image migration; this file is the half that
// needs none.)

// Quality ladders, descending. WebP reaches a given visual quality at a lower
// number than JPEG, so it can start lower and still look better.
export const WEBP_LADDER = [0.82, 0.72, 0.62, 0.52, 0.42];
export const JPEG_LADDER = [0.86, 0.76, 0.66, 0.56, 0.46];

// A cut-out may be stored inline in a Firestore document, beside the original
// photo it was made from. This is a data URL CHARACTER count, not a byte count
// — base64 inflates bytes by 4/3 — and the document limit is 1MiB for
// everything an item holds.
export const CUTOUT_BUDGET_CHARS = 220_000;

/**
 * The best encoding that fits, stepping quality down until one does.
 *
 * @param {(quality: number) => Promise<string|null>} encode
 * @param {number[]} ladder    descending qualities to try
 * @param {number}   maxChars  budget, in data URL characters
 * @returns {Promise<string|null>} the chosen data URL, the smallest attempt if
 *   none fit, or null if the encoder produced nothing at all. Returning the
 *   too-large one matters: the caller stores what it gets, and returning
 *   nothing would lose the cut-out entirely over a few kilobytes.
 */
export async function pickEncoding(encode, ladder, maxChars) {
  let smallest = null;
  for (const quality of ladder) {
    // eslint-disable-next-line no-await-in-loop -- each attempt informs the next
    const url = await encode(quality);
    if (!url) continue;
    if (url.length <= maxChars) return url;
    if (!smallest || url.length < smallest.length) smallest = url;
  }
  return smallest;
}

// Cached across calls: the answer cannot change within a session, and the probe
// allocates a canvas.
let webpSupport = null;

/**
 * Can this browser encode WebP from a canvas?
 *
 * This must be asked, never assumed. `toBlob`/`toDataURL` do NOT throw on a
 * MIME type they cannot write — per spec they silently fall back to image/png.
 * So an unguarded switch to WebP would, on a browser without it, quietly store
 * PNG instead: roughly ten times the size of the JPEG it replaced, with nothing
 * in the logs. The check is one 1x1 canvas.
 *
 * @returns {Promise<boolean>}
 */
export async function canEncodeWebp() {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const url = canvas.toDataURL('image/webp');
    webpSupport = url.startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}
