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
