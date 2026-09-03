// Non-destructive cut-out polish. The original photo stays in item.images[i];
// the polished cut-out (if any) lives in Firebase Storage and its URL is held
// on item.imageMeta[i].cutoutUrl. `itemImageDisplay` is the single source of
// truth for what a tile shows and how it should be fitted. Firebase helpers are
// lazy-imported so this module's pure parts stay unit-testable.

// Pure: pick the display src + whether to force object-contain (a cut-out sits
// on a white card and must be shown whole). Returns { src, forceContain }.
export function itemImageDisplay(item, index = 0) {
  const images = Array.isArray(item?.images) ? item.images : [];
  const meta = Array.isArray(item?.imageMeta) ? item.imageMeta : [];
  const m = meta[index] || {};
  if (m.framedUrl) return { src: m.framedUrl, forceContain: true };
  if (m.cutoutUrl) return { src: m.cutoutUrl, forceContain: true };
  if (m.cutout === true) return { src: images[index] ?? null, forceContain: true };
  return { src: images[index] ?? null, forceContain: false };
}

// How a piece is drawn in a flat-lay composition. A cut-out or a framed crop is
// white-backed, so on the composition's white ground it is indistinguishable
// from a transparent one and can float. A raw photograph carries its own
// background and cannot — it gets a plate behind it, exactly as the grid gives
// it today. This is what lets a part-migrated wardrobe compose without ever
// showing a photograph's background floating loose on the ground.
export function flatlayTreatment(item) {
  return itemImageDisplay(item, 0).forceContain ? 'bare' : 'plate';
}

// Whether this item's cut-out carries real transparency, and so may overlap its
// neighbours in a flat-lay. Written by the migration and by every new polish;
// absent on everything cut out before phase two.
//
// The test is for `true` and not merely truthiness because this flag doubles as
// the migration's resume checkpoint — "done" means "has alpha: true", and there
// is no separate progress record to drift out of step with it. A half-written
// value must read as not-done so the next run retries the item.
export function hasAlphaCutout(item) {
  const meta = Array.isArray(item?.imageMeta) ? item.imageMeta : [];
  return meta[0]?.alpha === true;
}

// Move a photo to the front, so it becomes the one the wardrobe shows.
//
// `images` and `imageMeta` are parallel arrays, and keeping them in step is
// the whole job. imageMeta is written lazily — polishing pads it only to
// length 1, and an item imported before it existed may have none at all — so
// it is routinely SHORTER than images. An earlier version spliced imageMeta
// without padding first and guarded the result with `if (movedMeta !==
// undefined)`, which meant an out-of-range index silently left imageMeta
// describing the OLD order while images had moved. itemImageDisplay reads
// imageMeta[0] in preference to images[0], so the wardrobe and the detail page
// went on showing the previous photo while the editor — which renders
// images[i] raw — showed the new one. It looked like the change had failed to
// save.
//
// Returns the item unchanged (same reference) when there is nothing to do, so
// a caller can skip a re-render.
export function promoteImageToMain(item, index) {
  const images = Array.isArray(item?.images) ? item.images : [];
  if (!Number.isInteger(index) || index <= 0 || index >= images.length) return item;

  const nextImages = [...images];
  const nextMeta = Array.isArray(item?.imageMeta) ? [...item.imageMeta] : [];
  // Pad first: only then does a splice at `index` refer to the same photo in
  // both arrays.
  while (nextMeta.length < nextImages.length) nextMeta.push({});

  const [movedImage] = nextImages.splice(index, 1);
  const [movedMeta] = nextMeta.splice(index, 1);
  nextImages.unshift(movedImage);
  nextMeta.unshift(movedMeta ?? {});

  return { ...item, images: nextImages, imageMeta: nextMeta };
}

// URL-safe id for the Storage object.
function safeId(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'x'; }

// Polish item.images[0]: remove its background (onto white, or keeping the
// alpha when asked), upload the cut-out to Storage, and return
// { imageMeta, ok } — the updated imageMeta array with cutoutUrl set on index
// 0. The original images[0] is left untouched. On failure returns
// { ok:false } and leaves imageMeta unchanged.
export async function polishItemPrimary(item, uid, { alpha = false } = {}) {
  let original = (Array.isArray(item.images) ? item.images : [])[0];
  if (!original || !uid) return { ok: false };
  const { removeImageBackground } = await import('./canvas.js');
  // External retailer URLs (e.g. cdn.endource.com) display fine but can't be
  // fetched cross-origin for background removal — pull the bytes through the
  // proxy chain in net.js into a local data URL first, then cut out. (We call
  // net.js directly rather than via canvas.js's rehostExternalImage wrapper —
  // one fewer hop for this hot path.)
  if (!original.startsWith('data:')) {
    const { imageUrlToCompressedDataUrl } = await import('./net.js');
    const rehosted = await imageUrlToCompressedDataUrl(original);
    if (rehosted && rehosted.startsWith('data:')) original = rehosted;
  }
  // Note on the `.jpg` in the Storage paths below: it is now a lie for most
  // items, since cut-outs are encoded WebP where the browser can write it. The
  // names are deliberately left alone — uploadString reads the MIME from the
  // data URL, so each object is stored and served with the correct contentType,
  // and nothing anywhere reads the extension. Renaming would orphan every
  // existing object and risk putting polishItemPrimary and retrimItemPrimary on
  // different paths, for a cosmetic gain no user ever sees.
  const out = await removeImageBackground(original, { alpha }); // { url, ok, alpha }
  if (!out.ok) return { ok: false, error: out.error };
  // Trim to the subject so it fills its tile (a delicate piece shouldn't float
  // tiny in a big white frame). Best-effort — keeps the untrimmed cut-out on
  // failure or when there's nothing safe to trim (white-on-white, already tight).
  let cutout = out.url;
  try {
    const { trimCutoutDataUrl } = await import('./trimCutout.js');
    const trimmed = await trimCutoutDataUrl(cutout);
    if (trimmed.ok) cutout = trimmed.url;
  } catch { /* keep the untrimmed cut-out */ }
  const { storage } = await import('../firebase.js');
  const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
  const path = `polish/${uid}/${safeId(item.id)}-0.jpg`;
  const r = ref(storage, path);
  await uploadString(r, cutout, 'data_url', { cacheControl: 'public, max-age=31536000' });
  const cutoutUrl = await getDownloadURL(r);
  const meta = Array.isArray(item.imageMeta) ? [...item.imageMeta] : [];
  while (meta.length < 1) meta.push({});
  // The alpha flag is also the migration's resume checkpoint. `out.alpha` is
  // the requested option echoed back, not a measured property of the encoded
  // bytes — what makes it trustworthy is that removeImageBackground FAILS
  // rather than silently falling back to a format without alpha (see the
  // WebP-support guard there), so "alpha requested and out.ok" really does
  // mean the upload below carries transparency.
  meta[0] = { ...(meta[0] || {}), cutoutUrl };
  if (out.alpha === true) meta[0].alpha = true;
  else delete meta[0].alpha;
  // A fresh cut-out invalidates any earlier manual frame (that crop was taken
  // from the pre-cut-out image). Drop the stale framedUrl/frame — otherwise the
  // old crop would display over the new cut-out and the editor would open a
  // mismatched base.
  delete meta[0].framedUrl;
  delete meta[0].frame;
  return { ok: true, imageMeta: meta };
}

// Revert: drop the cut-out (the original in images[0] shows again). Returns the
// updated imageMeta array. (We leave the Storage object; it's small and a
// re-polish overwrites it.)
export function revertItemPrimary(item) {
  const meta = Array.isArray(item.imageMeta) ? item.imageMeta.map((m) => ({ ...m })) : [];
  // `alpha` describes the cut-out being removed here, not the original photo
  // that replaces it. Leaving it set would both let hasAlphaCutout keep
  // reporting an opaque photograph as bleedable, and — because the migration
  // filters on this same flag — mark the item permanently migrated so it is
  // never retried.
  if (meta[0]) { delete meta[0].cutoutUrl; delete meta[0].alpha; }
  return meta;
}

// Frame item.images[0]: upload the already-baked crop data URL to Storage and
// record framedUrl + the frame params (so re-opening restores the crop). The
// original images[0] is untouched. Returns { ok, imageMeta } or { ok:false }.
// The canvas bake happens in the caller (ImageFramer via renderFramedDataUrl)
// so this stays a thin persistence seam, exactly like polishItemPrimary.
export async function frameItemPrimary(item, uid, dataUrl, frame) {
  if (!uid || !dataUrl || !dataUrl.startsWith('data:')) return { ok: false };
  const { storage } = await import('../firebase.js');
  const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
  const path = `framed/${uid}/${safeId(item.id)}-0.jpg`;
  const r = ref(storage, path);
  await uploadString(r, dataUrl, 'data_url', { cacheControl: 'public, max-age=31536000' });
  const framedUrl = await getDownloadURL(r);
  const meta = Array.isArray(item.imageMeta) ? [...item.imageMeta] : [];
  while (meta.length < 1) meta.push({});
  meta[0] = { ...(meta[0] || {}), framedUrl, frame };
  // A framed crop is deliberately opaque — renderFramedDataUrl fills white and
  // encodes JPEG, which has no alpha channel — so a framed item must not
  // bleed. Clear the flag the same way polishItemPrimary clears framedUrl/frame
  // for the inverse ordering: each new image kind invalidates what the other
  // kind claimed about the pixels.
  delete meta[0].alpha;
  return { ok: true, imageMeta: meta };
}

// Revert: drop the framed crop (framedUrl + frame). The original shows again.
// Pure — returns the updated imageMeta array. (We leave the Storage object; a
// re-frame overwrites it.)
export function revertFramePrimary(item) {
  const meta = Array.isArray(item.imageMeta) ? item.imageMeta.map((m) => ({ ...m })) : [];
  if (meta[0]) { delete meta[0].framedUrl; delete meta[0].frame; }
  return meta;
}

// Re-trim an ALREADY-polished item's cut-out to its subject (for the "Tighten
// cut-outs" batch on existing wardrobes). Loads the current cutoutUrl as a
// canvas-clean data URL (Storage URLs aren't canvas-safe — go through the image
// proxy, like the framer), trims it, and re-uploads to the same path. Returns
// { ok, imageMeta } on success; { ok:false, skipped } when there was nothing
// safe to trim (leaves the cut-out as-is). The original images[0] is untouched.
export async function retrimItemPrimary(item, uid) {
  const cutoutUrl = item?.imageMeta?.[0]?.cutoutUrl;
  if (!uid || !cutoutUrl) return { ok: false };
  let dataUrl = cutoutUrl;
  if (!dataUrl.startsWith('data:')) {
    // Raw, not compressed: the cut-out may carry alpha, and the compressed
    // route ends in toDataURL('image/jpeg') — JPEG has no alpha channel, so a
    // migrated item would come back with its transparent pixels composited
    // onto black. trimCutoutDataUrl would then read that black ground as the
    // subject and decline the trim on every migrated item.
    const { imageUrlToRawDataUrl } = await import('./net.js');
    dataUrl = await imageUrlToRawDataUrl(cutoutUrl);
  }
  if (!dataUrl || !dataUrl.startsWith('data:')) return { ok: false };
  const { trimCutoutDataUrl } = await import('./trimCutout.js');
  const trimmed = await trimCutoutDataUrl(dataUrl);
  if (!trimmed.ok) return { ok: false, skipped: true }; // nothing safe to trim
  const { storage } = await import('../firebase.js');
  const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
  const path = `polish/${uid}/${safeId(item.id)}-0.jpg`;
  const r = ref(storage, path);
  await uploadString(r, trimmed.url, 'data_url', { cacheControl: 'public, max-age=31536000' });
  const newUrl = await getDownloadURL(r);
  const meta = Array.isArray(item.imageMeta) ? [...item.imageMeta] : [];
  while (meta.length < 1) meta.push({});
  meta[0] = { ...(meta[0] || {}), cutoutUrl: newUrl };
  return { ok: true, imageMeta: meta };
}
