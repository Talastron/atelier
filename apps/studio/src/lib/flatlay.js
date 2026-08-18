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
// front. The numbers are deliberate rather than derived — they were arrived at
// by composing a real five-piece look and adjusting until it read as worn.
const ZONES = {
  Outerwear:   { x: 0.02, y: 0.13, w: 0.46, h: 0.47, z: 1 },
  Dresses:     { x: 0.18, y: 0.12, w: 0.46, h: 0.60, z: 2 },
  Tops:        { x: 0.41, y: 0.11, w: 0.38, h: 0.38, z: 3 },
  Bottoms:     { x: 0.26, y: 0.44, w: 0.40, h: 0.46, z: 2 },
  Shoes:       { x: 0.60, y: 0.50, w: 0.36, h: 0.24, z: 4 },
  Bags:        { x: 0.64, y: 0.70, w: 0.31, h: 0.26, z: 4 },
  // Stacked, not nested. These two sat almost on top of each other (71% of the
  // jewellery box was inside the accessories box) because the zone numbers were
  // tuned on a five-piece look, and a five-piece look has no accessories AND
  // jewellery. They stay in the left margin: Bottoms starts at x 0.26, so the
  // strip below Outerwear is the only clear space in the frame.
  Accessories: { x: 0.04, y: 0.60, w: 0.17, h: 0.17, z: 5 },
  Jewellery:   { x: 0.04, y: 0.79, w: 0.15, h: 0.15, z: 5 },
};

// Anything uncategorised is treated as finishing rather than silhouette — it
// gets a small place at the edge instead of competing with the garments.
const FALLBACK_ZONE = { x: 0.04, y: 0.46, w: 0.16, h: 0.16, z: 5 };

// Silhouette before finishing. Matches the ordering used by the Lookbook card
// so the two agree about what a look "is".
const SLOT_PRIORITY = ['Dresses', 'Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

// Degrees. Small on purpose: enough to break the mechanical feel of a grid,
// not so much that a garment reads as fallen over.
const MAX_ROTATION = 3;

// How far each additional piece in an occupied zone steps away from the first,
// as a fraction of the container, and how much it shrinks.
const STACK_STEP = 0.055;
const STACK_SHRINK = 0.86;

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
  const list = Array.isArray(pieces) ? pieces.filter(Boolean) : [];
  if (list.length === 0) return [];

  const ordered = [...list].sort((a, b) => {
    const ai = SLOT_PRIORITY.indexOf(a?.category);
    const bi = SLOT_PRIORITY.indexOf(b?.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }).slice(0, max);

  // How many pieces have already claimed each zone, so a second necklace
  // steps away from the first rather than sitting exactly on top of it.
  const taken = new Map();

  return ordered.map((item) => {
    const zone = ZONES[item?.category] || FALLBACK_ZONE;
    const index = taken.get(item?.category) ?? 0;
    taken.set(item?.category, index + 1);

    const shrink = STACK_SHRINK ** index;
    const step = STACK_STEP * index;

    // Without overlap the whole composition is inset slightly, which opens a
    // gap between neighbouring zones that would otherwise touch. It is the
    // one geometric difference between the two modes.
    const inset = overlap ? 0 : 0.012;

    return {
      item,
      x: clamp01(zone.x + step + inset),
      y: clamp01(zone.y + step + inset),
      w: clamp01(zone.w * shrink - inset * 2),
      h: clamp01(zone.h * shrink - inset * 2),
      rotation: overlap ? rotationFor(item?.id) : 0,
      z: zone.z + index,
    };
  });
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
