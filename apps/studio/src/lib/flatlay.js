// src/lib/flatlay.js
//
// Where each garment sits when a look is composed as a flat-lay.
//
// Pure geometry: takes the pieces of a look, returns a placement per piece in
// normalised 0–1 coordinates. It draws nothing and knows nothing about the
// DOM, canvas or images — which is the point. The same placements drive the
// Lookbook card, the look detail, and the exported share image, so a look is
// composed identically wherever it appears, and the arrangement can be tested
// without rendering anything.
//
// The arrangement is anatomical: pieces sit roughly where they are worn.
// Outerwear behind and to the left, the top upper-centre, bottoms below and
// overlapping, shoes at the foot, bag to one side, jewellery small and
// clustered. That reads as an outfit at a glance, where a uniform grid reads
// as an inventory.

// Zones are expressed as fractions of the container, so the layout is
// resolution- and aspect-independent. `z` orders the stack: higher sits in
// front.
//
// While `overlap` is false these zones DO NOT INTERSECT, and that is a hard
// requirement rather than a nicety. Every cut-out stored today is an opaque
// white rectangle, so a pale garment placed over a coloured one paints a white
// box across it — visible on any ground, and the single ugliest thing the
// composition can do. The earlier numbers let Outerwear and Bottoms share 16%,
// on the theory that contain-fitted images would not actually touch. They did:
// white shorts sat in a white box over a tan blazer.
//
// Column structure, left to right: outerwear down the left, the top-and-bottom
// (or a dress) up the centre, shoes and bag in the right margin, and the
// finishing pieces side by side below the coat.
//
// Finishing is smaller than silhouette, but only about three times smaller by
// area. An earlier arrangement squeezed shoes and bags into a right margin only
// 0.19 wide to buy the no-overlap guarantee, which made them a third the size of
// the originals and left jewellery a speck once two pieces had to share a zone.
// The guarantee was worth keeping; paying for it out of the finishing pieces
// was not. The centre column gave up the width instead.
const ZONES = {
  Outerwear:   { x: 0.010, y: 0.080, w: 0.350, h: 0.500, z: 1 },
  Dresses:     { x: 0.390, y: 0.060, w: 0.300, h: 0.760, z: 2 },
  Tops:        { x: 0.390, y: 0.060, w: 0.300, h: 0.370, z: 3 },
  Bottoms:     { x: 0.390, y: 0.450, w: 0.300, h: 0.440, z: 2 },
  Shoes:       { x: 0.710, y: 0.460, w: 0.280, h: 0.230, z: 4 },
  Bags:        { x: 0.710, y: 0.710, w: 0.280, h: 0.260, z: 4 },
  Accessories: { x: 0.020, y: 0.610, w: 0.165, h: 0.330, z: 5 },
  Jewellery:   { x: 0.200, y: 0.610, w: 0.165, h: 0.330, z: 5 },
};

// Anything uncategorised is treated as finishing rather than silhouette — it
// gets a small place at the edge instead of competing with the garments. Sits
// above the shoes, the one pocket of the frame no zone claims.
const FALLBACK_ZONE = { x: 0.720, y: 0.100, w: 0.170, h: 0.170, z: 5 };

// Silhouette before finishing. Matches the ordering used by the Lookbook card
// so the two agree about what a look "is".
const SLOT_PRIORITY = ['Dresses', 'Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

// Degrees. Small on purpose: enough to break the mechanical feel of a grid,
// not so much that a garment reads as fallen over.
const MAX_ROTATION = 3;

// Half the space between pieces sharing a zone, as a fraction of the container
// — taken off each side of a cell, so neighbours end up twice this apart.
const ZONE_GUTTER = 0.003;

/**
 * A small deterministic hash, used only to vary rotation per piece.
 *
 * Deterministic on purpose: Math.random would reshuffle the composition on
 * every render, so a look would never sit still. Keyed on the item id, the
 * same garment tilts the same way for as long as it exists.
 */
function hashCode(value) {
  const str = String(value ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Rotation in degrees for a piece, within ±MAX_ROTATION.
 * @param {string} id
 * @returns {number} one decimal place, stable for a given id
 */
export function rotationFor(id) {
  const span = MAX_ROTATION * 20; // tenths of a degree across the full range
  const raw = hashCode(id) % (span + 1);
  return Math.round((raw / 10 - MAX_ROTATION) * 10) / 10;
}

/**
 * The pieces of a look, silhouette first, capped.
 *
 * Exported because the Lookbook card offers a grid alternative to the
 * composition, and both readings must agree about what a look *is* — the
 * jacket, shirt, trouser and shoe define it; the cuff and sunglasses finish it.
 * Sharing this is what stops a second copy of the priority order drifting.
 *
 * @param {object[]} pieces  Resolved wardrobe items, any order.
 * @param {number}   [max]   Cap. Finishing pieces drop first.
 * @returns {object[]}
 */
export function orderForFlatlay(pieces, max = 8) {
  const list = Array.isArray(pieces) ? pieces.filter(Boolean) : [];
  if (list.length === 0) return [];
  return [...list].sort((a, b) => {
    const ai = SLOT_PRIORITY.indexOf(a?.category);
    const bi = SLOT_PRIORITY.indexOf(b?.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }).slice(0, max);
}

/**
 * Compose a look into placements.
 *
 * @param {object[]} pieces            Resolved wardrobe items, any order.
 * @param {object}   [options]
 * @param {boolean}  [options.overlap] Allow pieces to overlap and tilt.
 *   True needs cut-outs with transparency: overlapping opaque images means a
 *   white rectangle covering the garment beneath, which is worse than a grid.
 *   False keeps every piece upright and stops any piece sitting on top of
 *   another — the honest arrangement for the images stored today. Garments may
 *   still share an edge; see the no-stacking test for the exact bound.
 * @param {number}   [options.max]     Cap on pieces placed. Silhouette wins.
 * @returns {Array<{item: object, x: number, y: number, w: number, h: number, rotation: number, z: number}>}
 */
export function composeFlatlay(pieces, { overlap = false, max = 8 } = {}) {
  const ordered = orderForFlatlay(pieces, max);
  if (ordered.length === 0) return [];

  // Pieces sharing a zone TILE it. Counting them up front is what makes that
  // possible — a placement needs to know how many siblings it has, not just how
  // many came before it. The previous approach stepped each duplicate 0.055
  // aside, which is a twentieth of the frame: a second top covered 96% of the
  // first, and a five-piece jewellery stack rendered as one blob.
  const totals = new Map();
  for (const item of ordered) {
    const key = item?.category;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  const taken = new Map();

  return ordered.map((item) => {
    const zone = ZONES[item?.category] || FALLBACK_ZONE;
    const total = totals.get(item?.category) ?? 1;
    const index = taken.get(item?.category) ?? 0;
    taken.set(item?.category, index + 1);

    // The grid that makes each cell as square as it can be, given the zone's own
    // shape. A plain ceil(sqrt(n)) always splits by column, which halves the
    // WIDTH of two necklaces sharing a tall zone — the worst axis to lose, since
    // a contained image is already width-limited there.
    const cols = Math.max(1, Math.min(total, Math.round(Math.sqrt(total * (zone.w / zone.h)))));
    const rows = Math.ceil(total / cols);

    // Without overlap the whole composition is inset slightly, which opens a
    // little air between neighbouring zones. It is the one geometric difference
    // between the two modes.
    //
    // The inset applies to the ZONE, once — not to every cell. Taking it per
    // cell cost a fixed 0.024 of width however small the cell was, which is 29%
    // of a cell holding one of five necklaces.
    const inset = overlap ? 0 : 0.012;
    const cellW = (zone.w - inset * 2) / cols;
    const cellH = (zone.h - inset * 2) / rows;
    const gutter = total > 1 ? ZONE_GUTTER : 0;

    return {
      item,
      x: clamp01(zone.x + inset + (index % cols) * cellW + gutter),
      y: clamp01(zone.y + inset + Math.floor(index / cols) * cellH + gutter),
      w: clamp01(cellW - gutter * 2),
      h: clamp01(cellH - gutter * 2),
      rotation: overlap ? rotationFor(item?.id) : 0,
      z: zone.z + index,
    };
  });
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
