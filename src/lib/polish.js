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

// URL-safe id for the Storage object.
function safeId(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'x'; }

// Polish item.images[0]: remove its background (onto white), upload the cut-out
// to Storage, and return { imageMeta, ok } — the updated imageMeta array with
// cutoutUrl set on index 0. The original images[0] is left untouched. On
// failure returns { ok:false } and leaves imageMeta unchanged.
export async function polishItemPrimary(item, uid) {
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
  const out = await removeImageBackground(original); // { url, ok }
  if (!out.ok) return { ok: false, error: out.error };
  const { storage } = await import('../firebase.js');
  const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
  const path = `polish/${uid}/${safeId(item.id)}-0.jpg`;
  const r = ref(storage, path);
  await uploadString(r, out.url, 'data_url', { cacheControl: 'public, max-age=31536000' });
  const cutoutUrl = await getDownloadURL(r);
  const meta = Array.isArray(item.imageMeta) ? [...item.imageMeta] : [];
  while (meta.length < 1) meta.push({});
  meta[0] = { ...(meta[0] || {}), cutoutUrl };
  return { ok: true, imageMeta: meta };
}

// Revert: drop the cut-out (the original in images[0] shows again). Returns the
// updated imageMeta array. (We leave the Storage object; it's small and a
// re-polish overwrites it.)
export function revertItemPrimary(item) {
  const meta = Array.isArray(item.imageMeta) ? item.imageMeta.map((m) => ({ ...m })) : [];
  if (meta[0]) { delete meta[0].cutoutUrl; }
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
