// Does this wardrobe want backgrounds removed from new photos?
//
// One exported answer because there were two, and they disagreed. Profile
// rendered the toggle as `measurements?.removeBackground !== false` — so an
// untouched setting showed "On" — while App.jsx passed
// `!!measurements?.removeBackground`, which is false for undefined. Anyone who
// had never opened that toggle saw "On" and got background removal off, and
// the feature was inert for them.
//
// The default is ON, which is what the toggle has always claimed. Someone who
// wants it off has stored `false`, and that still reads as off.
export function prefersBackgroundRemoval(measurements) {
  return measurements?.removeBackground !== false;
}

// The state of one photo in the Add Item modal.
//
// This exists because a single `cutoutBusy` boolean was standing in for a
// per-photo operation: one photo failing left the flag set, the spinner
// running and the Add control disabled for good. Status per photo makes a
// failure local to the photo it happened to.
//
// 'original' is not an error state. Removal declined, removal failed and
// removal never requested all land there, and the photo is perfectly usable —
// it simply still has its background.
export function imageStatus(meta) {
  if (!meta) return 'original';
  if (meta.cutout === true) return 'cutout';
  if (meta.processing) return 'processing';
  return 'original';
}

// Apply a finished job to the imageMeta array, returning a new array.
//
// A result for an index that no longer exists is dropped rather than throwing:
// the user can delete a photo while its cut-out is still running, and a
// background job must never resurrect it.
export function applyCutoutResult(meta, index, result) {
  const list = Array.isArray(meta) ? meta : [];
  if (index < 0 || index >= list.length) return list;
  const next = [...list];
  next[index] = result?.ok
    ? {
        cutout: true,
        original: result.original,
        ...(result.alpha === true ? { alpha: true } : {}),
      }
    : { cutout: false };
  return next;
}
