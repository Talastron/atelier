import { describe, it, expect } from 'vitest';
import { fitContain, shareCardLayout, SHARE_CARD } from './shareCard.js';

describe('fitContain', () => {
  // The bug this replaces: the share card used cover-fit, which takes a centred
  // slice sized to FILL the box. That suits a landscape photograph, where the
  // edges are expendable, and ruins a garment, where the hem and the shoulder
  // are the subject. At five pieces the cell inverted to landscape 1.27 and a
  // dress rendered with 43% of itself visible.
  it('shows a tall garment whole, letterboxed left and right', () => {
    // A dress at aspect 0.55 in a landscape box.
    const box = fitContain(550, 1000, 400, 300);
    expect(box.h).toBe(300);                 // limited by height
    expect(box.w).toBeCloseTo(165, 0);       // 300 * 0.55
    expect(box.x).toBeCloseTo(117.5, 0);     // centred: (400 - 165) / 2
    expect(box.y).toBe(0);
  });

  it('shows a wide garment whole, letterboxed top and bottom', () => {
    // A shoe at aspect 1.25 in a portrait box.
    const box = fitContain(1250, 1000, 400, 600);
    expect(box.w).toBe(400);                 // limited by width
    expect(box.h).toBeCloseTo(320, 0);       // 400 / 1.25
    expect(box.x).toBe(0);
    expect(box.y).toBeCloseTo(140, 0);       // (600 - 320) / 2
  });

  it('fills the box exactly when the aspects match', () => {
    const box = fitContain(800, 600, 400, 300);
    expect(box).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });

  // The whole point: nothing is ever cut off.
  it('never returns a box larger than the one it was given', () => {
    const aspects = [[550, 1000], [500, 1000], [1250, 1000], [780, 1000], [1000, 1000]];
    for (const [iw, ih] of aspects) {
      const box = fitContain(iw, ih, 400, 300);
      expect(box.w).toBeLessThanOrEqual(400 + 1e-9);
      expect(box.h).toBeLessThanOrEqual(300 + 1e-9);
      // and it keeps the image's own proportions
      expect(box.w / box.h).toBeCloseTo(iw / ih, 5);
    }
  });

  it('returns an empty box rather than NaN for degenerate input', () => {
    expect(fitContain(0, 100, 400, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitContain(100, 0, 400, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitContain(100, 100, 0, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('shareCardLayout', () => {
  // Asserted against the constants rather than against copies of their values.
  // An earlier version hard-coded 330 and 1520, so retuning the card broke the
  // tests without any behaviour being wrong — noise that trains you to edit
  // assertions, which is how a real failure gets edited away too.
  it('starts the panel below the title and palette', () => {
    const { panel } = shareCardLayout({ titleLines: 1, hasNote: true });
    expect(panel.y).toBe(SHARE_CARD.PANEL_TOP);
    expect(panel.x).toBe(SHARE_CARD.PAD);
    expect(panel.w).toBe(SHARE_CARD.W - SHARE_CARD.PAD * 2);
    // and it begins below the palette row, whatever those numbers become
    expect(panel.y).toBeGreaterThan(SHARE_CARD.PALETTE_Y);
    expect(SHARE_CARD.PALETTE_Y).toBeGreaterThan(SHARE_CARD.TITLE_BASELINE);
    expect(SHARE_CARD.TITLE_BASELINE).toBeGreaterThan(SHARE_CARD.EYEBROW_BASELINE);
  });

  // The card is composed at 1080px wide and read at roughly 400 on a phone — a
  // 2.7x downscale. Small caps at 18px arrived at 6.7px, below reading size on
  // the very device the card is made for. Nothing that carries words may be set
  // small enough to disappear there.
  it('sets no text too small to survive the downscale to a phone', () => {
    const DOWNSCALE = 1080 / 400;
    const FLOOR = 10; // px on screen, below which small caps stop being read
    const sizes = {
      eyebrow: SHARE_CARD.EYEBROW_SIZE,
      paletteLabel: SHARE_CARD.PALETTE_LABEL_SIZE,
    };
    for (const [what, size] of Object.entries(sizes)) {
      expect(size / DOWNSCALE, `${what} renders at ${(size / DOWNSCALE).toFixed(1)}px on a phone`)
        .toBeGreaterThanOrEqual(FLOOR);
    }
  });

  // A two-line title pushes everything under it down by one line height. The
  // old card did this too; it is retained because a long look name is common.
  it('drops the panel by one line when the title wraps', () => {
    const one = shareCardLayout({ titleLines: 1, hasNote: true });
    const two = shareCardLayout({ titleLines: 2, hasNote: true });
    expect(two.panel.y - one.panel.y).toBe(88);
    expect(two.paletteY - one.paletteY).toBe(88);
    expect(two.panel.h).toBe(one.panel.h - 88);  // the panel absorbs it
  });

  // The dead space: with no stylist's note the old card stopped the images at
  // 1520 and put the footer at 1760, leaving 240px empty.
  it('extends the panel into the space a stylist’s note would have used', () => {
    const withNote = shareCardLayout({ titleLines: 1, hasNote: true });
    const without = shareCardLayout({ titleLines: 1, hasNote: false });
    expect(withNote.panel.y + withNote.panel.h).toBe(SHARE_CARD.PANEL_BOTTOM_WITH_NOTE);
    expect(without.panel.y + without.panel.h).toBe(SHARE_CARD.PANEL_BOTTOM_NO_NOTE);
    expect(without.panel.h).toBeGreaterThan(withNote.panel.h);
  });

  // The fault this exists to prevent: the note was capped at three lines and
  // truncated mid-sentence — "while the Cartier…" — because nothing ever
  // checked whether it FIT. It simply cut. A cap that is never measured against
  // the space available is not a layout decision, it is a guess.
  it('leaves the stylist’s note room to finish above the footer', () => {
    const S = SHARE_CARD;
    const lastBaseline = S.NOTE_Y + S.NOTE_TEXT_OFFSET + (S.NOTE_LINES - 1) * S.NOTE_LINE_HEIGHT;
    const descender = 14; // Playfair italic at 28px, generously
    expect(lastBaseline + descender).toBeLessThan(S.FOOTER_Y);
    // and the note starts below the panel it sits under
    const { panel } = shareCardLayout({ titleLines: 1, hasNote: true });
    expect(S.NOTE_Y).toBeGreaterThan(panel.y + panel.h);
  });

  // A wrapped title shifts the panel down but must not push it into the note.
  it('keeps a two-line title clear of the note', () => {
    const { panel } = shareCardLayout({ titleLines: 2, hasNote: true });
    expect(panel.y + panel.h).toBeLessThanOrEqual(SHARE_CARD.NOTE_Y);
  });

  // The composition is drawn for a roughly square frame. Too wide and the
  // columns drift apart; too tall and the pieces stretch and thin. The Lookbook
  // card guarded only the wide side — this is the general form.
  it('keeps the composition inside the aspect band, centred in the panel', () => {
    const { panel, composition } = shareCardLayout({ titleLines: 1, hasNote: false });
    const aspect = composition.w / composition.h;
    expect(aspect).toBeGreaterThanOrEqual(SHARE_CARD.MIN_ASPECT - 1e-9);
    expect(aspect).toBeLessThanOrEqual(SHARE_CARD.MAX_ASPECT + 1e-9);
    // centred within the panel
    expect(composition.x + composition.w / 2).toBeCloseTo(panel.x + panel.w / 2, 6);
    expect(composition.y + composition.h / 2).toBeCloseTo(panel.y + panel.h / 2, 6);
    // and never larger than it
    expect(composition.w).toBeLessThanOrEqual(panel.w + 1e-9);
    expect(composition.h).toBeLessThanOrEqual(panel.h + 1e-9);
  });

  it('leaves a panel already inside the band untouched', () => {
    const { panel, composition } = shareCardLayout({ titleLines: 1, hasNote: true });
    // 968 x 1190 is 0.81 — inside the band, so it should fill the panel
    expect(composition.w).toBeCloseTo(panel.w, 6);
    expect(composition.h).toBeCloseTo(panel.h, 6);
  });

  it('never lets the panel reach the footer', () => {
    for (const titleLines of [1, 2]) {
      for (const hasNote of [true, false]) {
        const { panel } = shareCardLayout({ titleLines, hasNote });
        expect(panel.y + panel.h).toBeLessThan(SHARE_CARD.FOOTER_Y);
        expect(panel.h).toBeGreaterThan(0);
      }
    }
  });
});
