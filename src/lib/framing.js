// Pure framing geometry. No DOM, no Firebase — the single tested source of
// truth for "which source-pixel rectangle does the crop show". The live
// preview in ImageFramer and the baked output in canvas.js both derive from
// computeCropRect, so what you see is exactly what gets saved.

// Frame aspect as width / height. Wardrobe cards are Tailwind aspect-[3/4].
export const FRAME_ASPECT = 3 / 4;

// The initial crop: whole image fit to the frame, centred, no zoom.
export function defaultFrame() {
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Largest FRAME_ASPECT rectangle that fits within the source (the zoom-1 crop).
function baseCrop(naturalW, naturalH, frameAspect) {
  const imgAspect = naturalW / naturalH;
  if (imgAspect > frameAspect) {
    // Image wider than the frame → the crop is limited by height.
    return { w: naturalH * frameAspect, h: naturalH };
  }
  // Image narrower/taller than the frame → limited by width.
  return { w: naturalW, h: naturalW / frameAspect };
}

// Given the source dimensions, the frame aspect, and a { zoom, offsetX, offsetY }
// frame, return the source-pixel crop rectangle { sx, sy, sw, sh }. zoom >= 1
// shrinks the crop (zooming in). offsetX/offsetY in [-1, 1] pan within the
// image; the result is always fully inside the image (full bleed, no gaps).
export function computeCropRect({
  naturalW,
  naturalH,
  frameAspect = FRAME_ASPECT,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const z = Math.max(1, zoom);
  const ox = clamp(offsetX, -1, 1);
  const oy = clamp(offsetY, -1, 1);
  const base = baseCrop(naturalW, naturalH, frameAspect);
  const sw = base.w / z;
  const sh = base.h / z;
  const sx = clamp((naturalW - sw) / 2 + (ox * (naturalW - sw)) / 2, 0, naturalW - sw);
  const sy = clamp((naturalH - sh) / 2 + (oy * (naturalH - sh)) / 2, 0, naturalH - sh);
  return { sx, sy, sw, sh };
}
