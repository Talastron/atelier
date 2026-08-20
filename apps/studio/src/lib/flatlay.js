// src/lib/flatlay.js
//
// Where each garment sits when a look is composed as a flat-lay.
//
// Pure geometry: takes the pieces of a look, returns a placement per piece in
// normalised 0–1 coordinates. It draws nothing and knows nothing about the
// DOM, canvas or images — which is the point. The same placements drive the
// Lookbook card and the look detail, so a look is composed identically
// wherever it appears, and the arrangement can be tested without rendering
// anything.
//
// The arrangement is anatomical: pieces sit roughly where they are worn.
// Outerwear down the left, the top-and-bottom (or a dress) up the centre,
// shoes and bag in the right margin, finishing pieces below the coat.
//
// It is expressed as a TREE OF WEIGHTS rather than a table of rectangles, and
// that is the whole design. Fixed rectangles are addresses: `Outerwear` owned
// the left third of every frame whether or not the look had a coat, so a dress
// look reserved three zones for garments it did not contain and left them
// blank — 27% of the frame as garment, against 46% for a full look. Weights
// are shares: a slot with no pieces is pruned and its siblings renormalise
// over the space it would have held.

// Slot for anything uncategorised — finishing rather than silhouette, so it
// gets a small capped place instead of competing with the garments.
const FALLBACK_SLOT = '*';

// Columns left to right; rows top to bottom within each. `weight` is relative
// to siblings only, so the numbers need not sum to anything. `cap` is the
// largest share of the frame a slot may take on either axis. `z` orders the
// stack when pieces overlap.
//
// The weights are tuned, not guessed: a sweep over the plausible range found
// this the best average ink subject to neither silhouette column being
// narrower than the finishing column. Unconstrained, the sweep makes the
// shoes-and-bag column the widest thing in the frame — landscape photography
// fills a wide box efficiently — which reads as a catalogue of objects rather
// than an outfit. Holding the hierarchy costs about 5 points of ink.
const LAYOUT = {
  dir: 'row',
  children: [
    { weight: 36, dir: 'col', children: [
      { slot: 'Outerwear',   weight: 46, z: 1 },
      { slot: 'Accessories', weight: 18, z: 5, cap: 0.20 },
      { slot: 'Jewellery',   weight: 18, z: 5, cap: 0.20 },
    ] },
    { weight: 40, dir: 'col', children: [
      { slot: 'Dresses', weight: 84, z: 2 },
      { slot: 'Tops',    weight: 38, z: 3 },
      { slot: 'Bottoms', weight: 46, z: 2 },
    ] },
    { weight: 36, dir: 'col', children: [
      { slot: 'Shoes',        weight: 40, z: 4 },
      { slot: 'Bags',         weight: 60, z: 4 },
      { slot: FALLBACK_SLOT,  weight: 30, z: 5, cap: 0.20 },
    ] },
  ],
};

// Every slot the tree knows by name. Anything else falls to FALLBACK_SLOT.
const SLOT_KEYS = new Set(
  LAYOUT.children.flatMap((column) => column.children.map((row) => row.slot))
);

// Silhouette before finishing. Shared with the Lookbook's grid view so the two
// readings of a look agree about which pieces make the cut.
const SLOT_PRIORITY = ['Dresses', 'Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

// Degrees. Small on purpose: enough to break the mechanical feel of a grid,
// not so much that a garment reads as fallen over.
const MAX_ROTATION = 3;

// Space between neighbouring slots, and between pieces sharing one slot.
const GUTTER = 0.012;
const INNER_GUTTER = 0.006;

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
 * Does this branch of the tree hold any pieces?
 * @param {object} node
 * @param {Map<string, number>} counts
 * @returns {boolean}
 */
function hasContent(node, counts) {
  return node.slot
    ? (counts.get(node.slot) ?? 0) > 0
    : node.children.some((child) => hasContent(child, counts));
}

/**
 * Shrink a box to its slot's ceiling, centred in the space it was given.
 *
 * The slack stays empty rather than passing to a neighbour. That is deliberate:
 * a necklace given a whole freed column would render coat-sized, which inverts
 * silhouette-large-finishing-small.
 */
function applyCap(node, box) {
  if (!node.cap) return box;
  let { x, y, w, h } = box;
  if (w > node.cap) { x += (w - node.cap) / 2; w = node.cap; }
  if (h > node.cap) { y += (h - node.cap) / 2; h = node.cap; }
  return { x, y, w, h };
}

/**
 * Walk the tree, dividing `box` among the children that hold pieces.
 *
 * Because columns and rows partition the frame, two slots cannot overlap and
 * nothing can leave the frame. Those stop being properties to test for and
 * become properties the structure cannot violate.
 */
function allocate(node, counts, box, gutter, out) {
  if (node.slot) {
    out.set(node.slot, { box: applyCap(node, box), z: node.z });
    return;
  }
  const live = node.children.filter((child) => hasContent(child, counts));
  if (live.length === 0) return;

  const totalWeight = live.reduce((total, child) => total + child.weight, 0);
  const along = node.dir === 'row' ? box.w : box.h;
  const available = along - gutter * (live.length - 1);
  let cursor = node.dir === 'row' ? box.x : box.y;

  for (const child of live) {
    const size = (child.weight / totalWeight) * available;
    allocate(child, counts, node.dir === 'row'
      ? { x: cursor, y: box.y, w: size, h: box.h }
      : { x: box.x, y: cursor, w: box.w, h: size }, gutter, out);
    cursor += size + gutter;
  }
}

/**
 * One cell of a slot shared by several pieces.
 *
 * Orientation-aware: splitting purely by column would halve the WIDTH of two
 * necklaces in a tall slot, and width is what a contained image is already
 * limited by there. Factoring in the slot's own shape keeps each cell as
 * square as it can be.
 */
function tile(box, index, total, gutter) {
  const cols = Math.max(1, Math.min(total, Math.round(Math.sqrt(total * (box.w / box.h)))));
  const rows = Math.ceil(total / cols);
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const g = total > 1 ? gutter / 2 : 0;
  return {
    x: box.x + (index % cols) * cellW + g,
    y: box.y + Math.floor(index / cols) * cellH + g,
    w: cellW - g * 2,
    h: cellH - g * 2,
  };
}

/** Which slot a piece belongs to. */
const slotFor = (item) => (SLOT_KEYS.has(item?.category) ? item.category : FALLBACK_SLOT);

/**
 * Compose a look into placements.
 *
 * @param {object[]} pieces            Resolved wardrobe items, any order.
 * @param {object}   [options]
 * @param {boolean}  [options.overlap] Allow pieces to overlap and tilt.
 *   True needs cut-outs with transparency: overlapping opaque images means a
 *   white rectangle covering the garment beneath, which is worse than a grid.
 *   False keeps every piece upright and stops any piece touching another — the
 *   honest arrangement for the images stored today.
 * @param {number}   [options.max]     Cap on pieces placed. Silhouette wins.
 * @returns {Array<{item: object, x: number, y: number, w: number, h: number, rotation: number, z: number}>}
 */
export function composeFlatlay(pieces, { overlap = false, max = 8 } = {}) {
  const ordered = orderForFlatlay(pieces, max);
  if (ordered.length === 0) return [];

  const counts = new Map();
  for (const item of ordered) {
    const slot = slotFor(item);
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }

  // Overlap closes the gaps: the gutters are the one geometric difference
  // between the two modes, alongside rotation.
  const gutter = overlap ? 0 : GUTTER;
  const innerGutter = overlap ? 0 : INNER_GUTTER;

  const allocations = new Map();
  allocate(LAYOUT, counts, { x: 0, y: 0, w: 1, h: 1 }, gutter, allocations);

  const taken = new Map();
  return ordered.map((item) => {
    const slot = slotFor(item);
    const allocation = allocations.get(slot);
    const total = counts.get(slot) ?? 1;
    const index = taken.get(slot) ?? 0;
    taken.set(slot, index + 1);

    const cell = tile(allocation.box, index, total, innerGutter);
    return {
      item,
      x: clamp01(cell.x),
      y: clamp01(cell.y),
      w: clamp01(cell.w),
      h: clamp01(cell.h),
      rotation: overlap ? rotationFor(item?.id) : 0,
      z: allocation.z + index,
    };
  });
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
