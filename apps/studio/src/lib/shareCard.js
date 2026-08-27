// src/lib/shareCard.js
//
// The two pieces of geometry the share card gets wrong when they are written
// inline. Pure functions: no Canvas, no DOM, no images — so the maths that
// actually broke can be tested, and canvas.js is left as drawing code.

/**
 * Fit an image wholly inside a box, centred, keeping its proportions.
 *
 * The share card previously used cover-fit — a centred slice sized to FILL the
 * box. That is right for a landscape photograph, whose edges are expendable,
 * and wrong for a garment, where the hem and the shoulder are the subject. At
 * five pieces the cell inverted to landscape and a dress showed 43% of itself.
 *
 * @param {number} imgW  natural width
 * @param {number} imgH  natural height
 * @param {number} boxW
 * @param {number} boxH
 * @returns {{x: number, y: number, w: number, h: number}} offsets relative to
 *   the box's own origin, so a caller adds the box's x and y.
 */
export function fitContain(imgW, imgH, boxW, boxH) {
  const empty = { x: 0, y: 0, w: 0, h: 0 };
  if (!(imgW > 0) || !(imgH > 0) || !(boxW > 0) || !(boxH > 0)) return empty;

  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}
