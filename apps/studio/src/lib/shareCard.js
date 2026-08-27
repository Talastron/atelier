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

// The card's fixed geometry. 1080x1920 is the Instagram Story frame; every
// other number is expressed against it.
export const SHARE_CARD = {
  W: 1080,
  H: 1920,
  PAD: 56,              // was 88 — the composition is width-limited, so the
                        // side margin is the one lever that grows the garments
  RULE_Y: 140,
  TITLE_BASELINE: 210,
  TITLE_LINE_HEIGHT: 88,
  PALETTE_Y: 250,       // swatch row; no label above it
  PANEL_TOP: 330,
  PANEL_BOTTOM_WITH_NOTE: 1520,
  PANEL_BOTTOM_NO_NOTE: 1700,
  PANEL_RADIUS: 32,
  NOTE_Y: 1580,
  FOOTER_Y: 1760,
  // The composition is drawn for a roughly square frame. Outside this band it
  // distorts: too wide and the columns drift apart, too tall and the pieces
  // stretch and thin.
  MIN_ASPECT: 0.8,
  MAX_ASPECT: 1.2,
};

/**
 * Where everything sits on the share card.
 *
 * Exported and tested because two faults lived here: a look with no stylist's
 * note left 240px of dead space above the footer, and the composition's frame
 * was never checked against the aspect its layout assumes.
 *
 * @param {object}  options
 * @param {number}  options.titleLines  1 or 2 — a wrapped title shifts what follows
 * @param {boolean} options.hasNote     whether a stylist's note will be drawn
 * @returns {{paletteY: number, panel: {x,y,w,h}, composition: {x,y,w,h}, noteY: number|null}}
 */
export function shareCardLayout({ titleLines = 1, hasNote = false } = {}) {
  const S = SHARE_CARD;
  const offset = titleLines > 1 ? S.TITLE_LINE_HEIGHT : 0;

  const panel = {
    x: S.PAD,
    y: S.PANEL_TOP + offset,
    w: S.W - S.PAD * 2,
    h: (hasNote ? S.PANEL_BOTTOM_WITH_NOTE : S.PANEL_BOTTOM_NO_NOTE) - (S.PANEL_TOP + offset),
  };

  // Clamp the composition into the aspect band and centre it in the panel. The
  // panel keeps its full size — what is reclaimed is breathing room around the
  // composition, not empty page.
  const aspect = panel.w / panel.h;
  let cw = panel.w;
  let ch = panel.h;
  if (aspect < S.MIN_ASPECT) ch = panel.w / S.MIN_ASPECT;
  else if (aspect > S.MAX_ASPECT) cw = panel.h * S.MAX_ASPECT;

  return {
    paletteY: S.PALETTE_Y + offset,
    panel,
    composition: {
      x: panel.x + (panel.w - cw) / 2,
      y: panel.y + (panel.h - ch) / 2,
      w: cw,
      h: ch,
    },
    noteY: hasNote ? S.NOTE_Y : null,
  };
}
