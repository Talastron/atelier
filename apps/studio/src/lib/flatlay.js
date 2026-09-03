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
    // Bag above, shoes at the foot. The old fixed zones had this the other way
    // round and the ordering was carried over unexamined; a shoe sitting above
    // a handbag reads wrong for the same reason the whole layout is anatomical.
    // The uncategorised slot goes between them rather than last, so shoes stay
    // the lowest thing in the frame whatever else the look contains.
    { weight: 36, dir: 'col', children: [
      { slot: 'Bags',         weight: 60, z: 4 },
      { slot: FALLBACK_SLOT,  weight: 30, z: 5, cap: 0.20 },
      { slot: 'Shoes',        weight: 40, z: 4 },
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

// How far a piece grows into its neighbours when it is allowed to bleed. Scaled
// about the piece's own centre, so the anatomy and the layout tree are
// untouched. A per-piece cap is a ceiling on the ALLOCATION, not on the bled
// result — a capped piece may end up a few per cent over it. Measured on a
// six-piece look with the gutters retained:
// 1.08 gives a 15.7% worst pairwise overlap across 8 overlapping pairs, with
// nothing leaving the frame. This is the visual dial — 1.12 gives 24.1%.
//
// That 15.7% is a BETWEEN-slot figure. Pieces sharing one slot are separated
// only by INNER_GUTTER, half of GUTTER, so they overlap roughly twice as hard:
// three necklaces sharing the Jewellery slot ("layered jewellery" in the test
// fixtures) reach about 32.8% at 1.08. A visual call, not a bug — but see the
// 'keeps the worst same-slot overlap within a third of a piece' test, which
// bounds it so it does not drift unnoticed.
export const BLEED = 1.08;

// Whether pieces overlap and tilt at all, across every surface. One constant so
// the app and the share card cannot drift apart, and so this is a one-line
// decision rather than three.
//
// OFF after visual review, 2026-09-03. The effect turned out subtle beside what
// phase one's arrangement already achieved — a look read as an outfit rather
// than an inventory before any of this — and the adjacency it created mostly
// served to expose a larger problem: a piece is sized by its CATEGORY, not by
// its silhouette, so `object-contain` scales a tall garment small and a wide one
// large. Trousers came out narrow and shorts came out full-width from the same
// box.
//
// The mechanism stays. It is tested, it costs nothing switched off, and it is
// worth switching on once a piece's size reflects the garment rather than the
// slot — at which point overlapping pieces will be comparing like with like.
// Everything else phase two brought is independent of this flag: the alpha
// cut-outs, the cream ground, and the shadow that traces the garment.
export const FLATLAY_OVERLAP = false;

// Every accepted piece is lifted above every rejected one. Promoting rather
// than demoting matters: when nothing bleeds — the whole wardrobe until the
// migration runs — this term is zero for every piece, so z is exactly what it
// was before phase two. Demoting instead pushed every z negative, and a
// negative CSS z-index can paint a piece behind its own ground.
//
// The guarantee holds while a slot's within-slot index cannot reach this: an
// accepted z is at least 1 + Z_PROMOTE and a rejected one at most 5 + (n - 1)
// for n pieces in one slot, so any `max` up to and including 96 is safe. Call
// sites use 6 and 8.
const Z_PROMOTE = 100;

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
 * How several pieces divide one slot.
 *
 * Orientation-aware: splitting purely by column would halve the WIDTH of two
 * necklaces in a tall slot, and width is what a contained image is already
 * limited by there. Factoring in the slot's own shape keeps each cell as square
 * as it can be.
 *
 * Computed once per slot and shared by the cap and the tiling, so the two can
 * never disagree about how many cells there are.
 */
function gridFor(total, aspect) {
  const cols = Math.max(1, Math.min(total, Math.round(Math.sqrt(total * aspect))));
  return { cols, rows: Math.ceil(total / cols) };
}

/**
 * Shrink a box to its slot's ceiling, centred in the space it was given.
 *
 * The ceiling is per PIECE, not per category — so the slot may be as large as
 * `cap` multiplied by the grid it will be divided into. Capping the slot itself
 * made the limit a budget the category shared out: one necklace reached 4% of
 * the frame, two managed 1.8% each and three 0.9%, which is not what a rule
 * about a necklace not rendering coat-sized was ever meant to say.
 *
 * The slack stays empty rather than passing to a neighbour within the slot;
 * `allocate` is what hands unused width back to the siblings outside it.
 */
function applyCap(node, box, grid) {
  if (!node.cap) return box;
  const maxW = node.cap * grid.cols;
  const maxH = node.cap * grid.rows;
  let { x, y, w, h } = box;
  if (w > maxW) { x += (w - maxW) / 2; w = maxW; }
  if (h > maxH) { y += (h - maxH) / 2; h = maxH; }
  return { x, y, w, h };
}

/**
 * The widest a branch can usefully be, or Infinity when nothing limits it.
 *
 * This is what stops a column being sized for a coat and filled by a pair of
 * earrings. Column widths are decided from weights, and caps used to be applied
 * only afterwards — so a look with no outerwear gave its left column a third of
 * the frame, put two capped jewellery pieces in it, and left 88% of that column
 * empty. Asking the branch what it can use BEFORE dividing the space is the
 * difference.
 */
function usableWidth(node, counts, aspectHint) {
  if (node.slot) {
    const total = counts.get(node.slot) ?? 0;
    if (total === 0) return 0;
    if (!node.cap) return Infinity;
    return node.cap * gridFor(total, aspectHint).cols;
  }
  const live = node.children.filter((child) => hasContent(child, counts));
  if (live.length === 0) return 0;
  const widths = live.map((child) => usableWidth(child, counts, aspectHint));
  // Stacked children each span the full width, so the branch needs the widest
  // of them; children laid side by side need the sum.
  return node.dir === 'col'
    ? Math.max(...widths)
    : widths.reduce((total, w) => total + w, 0);
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
    const total = counts.get(node.slot) ?? 0;
    const grid = gridFor(total, box.w / box.h);
    out.set(node.slot, { box: applyCap(node, box, grid), z: node.z, grid });
    return;
  }
  const live = node.children.filter((child) => hasContent(child, counts));
  if (live.length === 0) return;

  const totalWeight = live.reduce((total, child) => total + child.weight, 0);
  const along = node.dir === 'row' ? box.w : box.h;
  const available = along - gutter * (live.length - 1);

  let sizes = live.map((child) => (child.weight / totalWeight) * available);

  // Hand back width a branch cannot use, and give it to the siblings that can.
  //
  // Only along the row axis: a column's height is filled by stacking, so an
  // unused remainder there is just air inside the column, not width stolen from
  // a neighbour. Two passes — the first releases the surplus, the second lets a
  // second branch release what the redistribution pushed it past.
  if (node.dir === 'row') {
    const limits = live.map((child) => usableWidth(child, counts, box.w / box.h));
    for (let pass = 0; pass < 2; pass += 1) {
      let surplus = 0;
      const growable = [];
      sizes = sizes.map((size, i) => {
        if (size > limits[i]) { surplus += size - limits[i]; return limits[i]; }
        if (limits[i] > size) growable.push(i);
        return size;
      });
      if (surplus <= 1e-9 || growable.length === 0) break;
      const share = growable.reduce((t, i) => t + live[i].weight, 0);
      for (const i of growable) sizes[i] += surplus * (live[i].weight / share);
    }
  }

  let cursor = node.dir === 'row' ? box.x : box.y;
  live.forEach((child, i) => {
    const size = sizes[i];
    allocate(child, counts, node.dir === 'row'
      ? { x: cursor, y: box.y, w: size, h: box.h }
      : { x: box.x, y: cursor, w: box.w, h: size }, gutter, out);
    cursor += size + gutter;
  });
}

/**
 * One cell of a slot shared by several pieces.
 *
 * Orientation-aware: splitting purely by column would halve the WIDTH of two
 * necklaces in a tall slot, and width is what a contained image is already
 * limited by there. Factoring in the slot's own shape keeps each cell as
 * square as it can be.
 */
function tile(box, index, total, gutter, grid) {
  const { cols, rows } = grid;
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

// Grow a cell about its own centre, then SLIDE it back inside the frame — never
// resize it to fit. Resizing would change the piece's shape, and because both
// renderers fit `contain`, a squashed box shows as a smaller image rather than a
// distorted one: the growth would simply vanish, and vanish worst on the biggest
// pieces, which are the ones most worth overlapping.
//
// So the scale is UNIFORM and capped to whatever still fits. A piece already
// spanning an axis therefore bleeds less than one floating in the middle of the
// frame, and a piece spanning both bleeds not at all. That is the honest
// outcome: there is nowhere for it to grow into that is not off-screen.
function bleedCell(cell, factor) {
  const f = Math.max(1, Math.min(factor, 1 / cell.w, 1 / cell.h));
  const w = cell.w * f;
  const h = cell.h * f;
  return {
    x: Math.min(Math.max(cell.x - cell.w * (f - 1) / 2, 0), 1 - w),
    y: Math.min(Math.max(cell.y - cell.h * (f - 1) / 2, 0), 1 - h),
    w,
    h,
  };
}

/**
 * Compose a look into placements.
 *
 * @param {object[]} pieces            Resolved wardrobe items, any order.
 * @param {object}   [options]
 * @param {boolean}  [options.overlap] Allow pieces to overlap and tilt.
 *   True permits bleeding and tilting, but decides neither: `bleed` does, per
 *   piece. With no piece accepted, true and false produce identical geometry,
 *   which is what lets it be switched on before any image has been migrated.
 *   False keeps every piece upright and stops any piece touching another — the
 *   honest arrangement for the images stored today.
 * @param {number}   [options.max]     Cap on pieces placed. Silhouette wins.
 * @param {(item: object) => boolean} [options.bleed] Which pieces may grow into
 *   their neighbours. Defaults to () => false, which is the safe answer: a piece
 *   without transparency that grew would paint a white box over the garment
 *   beneath. Only consulted when `overlap` is true. Anything but a literal true
 *   is treated as a rejection, so a predicate returning a truthy non-boolean
 *   silently disables bleeding rather than half-enabling it.
 * @returns {Array<{item: object, x: number, y: number, w: number, h: number, rotation: number, z: number}>}
 */
export function composeFlatlay(pieces, { overlap = false, max = 8, bleed = () => false } = {}) {
  const ordered = orderForFlatlay(pieces, max);
  if (ordered.length === 0) return [];

  const counts = new Map();
  for (const item of ordered) {
    const slot = slotFor(item);
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }

  // The gutters no longer depend on `overlap`. Closing them was how the old
  // design made pieces touch; bleeding produces the overlap directly, so closing
  // them as well is redundant — and harmful, because it would shift every piece
  // in a look where nothing has alpha (measured: 6 of 6). Keeping them costs
  // 15.7% worst pairwise overlap instead of 18.5%, which buys the far more
  // valuable property that an unmigrated look renders exactly as it does today.
  const gutter = GUTTER;
  const innerGutter = INNER_GUTTER;

  const allocations = new Map();
  allocate(LAYOUT, counts, { x: 0, y: 0, w: 1, h: 1 }, gutter, allocations);

  const taken = new Map();
  return ordered.map((item) => {
    const slot = slotFor(item);
    const allocation = allocations.get(slot);
    const total = counts.get(slot) ?? 1;
    const index = taken.get(slot) ?? 0;
    taken.set(slot, index + 1);

    const cell = tile(allocation.box, index, total, innerGutter, allocation.grid);
    // Only a piece with real transparency may grow into its neighbours. An
    // opaque one that grew would paint a white rectangle across the garment
    // beneath — worse than the grid this replaced. A piece that cannot bleed
    // keeps its exact box, and every piece that CAN bleed is lifted above it
    // with Z_PROMOTE, so nothing which grew can ever be covered by one.
    // Promoting the accepted pieces rather than demoting the rejected ones is
    // what keeps this safe by default: with nothing bled, this term is zero
    // for every piece and z is exactly what it was before phase two (see
    // Z_PROMOTE above for why demoting instead would not have been).
    const mayBleed = overlap && bleed(item) === true;
    const box = mayBleed ? bleedCell(cell, BLEED) : cell;
    return {
      item,
      x: clamp01(box.x),
      y: clamp01(box.y),
      w: clamp01(box.w),
      h: clamp01(box.h),
      // Tilt follows the same per-piece rule. A tilted opaque cut-out shows a
      // slanted white edge against the cream ground — worse than upright.
      rotation: mayBleed ? rotationFor(item?.id) : 0,
      z: allocation.z + index + (mayBleed ? Z_PROMOTE : 0),
    };
  });
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
