// Public-share helpers: a pure Pinterest-URL builder + Storage/Firestore
// helpers for hosting a shareable card image. The URL builder is pure and
// unit-tested; the upload/createCardShare helpers touch Firebase and are
// verified by running the app.
//
// Note: Firebase imports are inside the async functions (lazy-loaded) to
// avoid import-time initialization in test environments where self is not defined.

const PIN_BASE = 'https://www.pinterest.com/pin/create/button/';

// Pure: assemble Pinterest's create-pin URL. `media` (a public image URL) is
// what makes Pinterest use the exact image instead of scraping the page.
// Encode each value with encodeURIComponent so spaces are %20 (not +).
export function buildPinterestUrl({ url, media, description = '' }) {
  if (!url) throw new Error('buildPinterestUrl: url is required');
  const parts = [`url=${encodeURIComponent(url)}`];
  if (media) parts.push(`media=${encodeURIComponent(media)}`);
  if (description) parts.push(`description=${encodeURIComponent(description)}`);
  return `${PIN_BASE}?${parts.join('&')}`;
}

// URL-safe share id (mirrors App.jsx newShareId): 11 chars base36.
export function newShareId() {
  return [...crypto.getRandomValues(new Uint32Array(2))].map((n) => n.toString(36)).join('').slice(0, 11);
}

// Upload a composed card PNG to public Storage; return its public download URL.
export async function uploadShareCardImage(shareId, blob) {
  const { storage } = await import('../firebase.js');
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const r = ref(storage, `public-shares/${shareId}.png`);
  await uploadBytes(r, blob, { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' });
  return getDownloadURL(r);
}

// Create a lightweight `kind:'card'` public share (Style DNA / Manifesto):
// upload the image, write the public doc, return { shareId, url, cardImageUrl }.
export async function createCardShare({ cardType, name, sharedByName, blob }) {
  const { db } = await import('../firebase.js');
  const { doc, setDoc } = await import('firebase/firestore');
  const shareId = newShareId();
  const cardImageUrl = await uploadShareCardImage(shareId, blob);
  const snapshot = {
    v: 1,
    kind: 'card',
    cardType,
    name: name || 'Atelier',
    cardImageUrl,
    sharedAt: new Date().toISOString(),
    sharedByName: sharedByName || 'Atelier',
  };
  await setDoc(doc(db, 'public', shareId), snapshot);
  const url = `${window.location.origin}/?share=${shareId}`;
  return { shareId, url, cardImageUrl };
}
