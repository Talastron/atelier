// Trim a white-background cut-out to its subject's bounding box (plus a uniform
// margin), so object-contain scales the subject up to fill its tile. Fixes the
// "delicate piece floats tiny in a big white tile" problem — after trimming, a
// small earring and a chunky bracelet both fill their tiles consistently.
//
// The subject is detected by COLOUR (non-white pixels), not the imgly alpha
// mask (which lives in canvas.js). A safeguard leaves genuinely white-on-white
// items — or already-tight cut-outs — untrimmed rather than guessing wrong.

// Pure: given raw RGBA pixels, return the bounding box of "content" (non-white)
// pixels as { x, y, w, h }, or null if there is none. `threshold` is how far the
// darkest channel must fall below 255 to count as subject — high enough to
// ignore off-white JPEG noise, low enough to catch cream/pale subjects.
export function contentBounds({ data, width, height }, threshold = 14) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dev = 255 - Math.min(data[i], data[i + 1], data[i + 2]);
      if (dev > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// DOM: load a white-bg cut-out data URL, find its subject, and return a tightly
// cropped data URL (subject + uniform margin, re-composited on white). Returns
// { url, ok }. ok:false — and the original url — when there's nothing safe to
// trim: no subject found, an already-tight cut-out (coverage >= maxCover), a
// tainted canvas, or a load error. Callers keep the original in that case.
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
  octx.fillStyle = '#FFFFFF';
  octx.fillRect(0, 0, cw, ch);
  octx.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);

  let q = 0.86;
  let url = out.toDataURL('image/jpeg', q);
  while (url.length > maxBytes && q > 0.45) {
    q -= 0.1;
    url = out.toDataURL('image/jpeg', q);
  }
  return { url, ok: true };
}
