// Firestore write helpers that keep the saving UI honest when the network isn't.
//
// The SDK is initialised with persistentLocalCache (see firebase.js), which
// changes what a write promise means: setDoc() applies the change to the local
// cache immediately, but the promise it returns resolves only when the SERVER
// acknowledges the write. Offline — or on a connection poor enough that the
// stream can't reconnect — that promise never settles at all. It does not
// reject; it stays pending indefinitely while the write sits safely in the
// local mutation queue.
//
// So any caller shaped like
//
//   setLoading(true);
//   try { await setDoc(...) } finally { setLoading(false) }
//
// sits on its spinner forever, with no error to show, even though the user's
// change is saved and will sync on its own. That is what leaves the Add Item
// modal stuck on "Saving…".

// How long we give the server to acknowledge before we accept the write as
// locally committed and let the UI move on. Long enough that a merely slow
// connection still reports a true "synced", short enough that a stuck spinner
// never outlasts the user's patience.
export const LOCAL_WRITE_GRACE_MS = 6000;

/**
 * Wrap a Firestore write so it always settles.
 *
 * Resolves `{ synced: true }` when the server acknowledges within the grace
 * window, or `{ synced: false }` when it doesn't — the write is still queued
 * locally, so callers should report "saved, syncing later" rather than failure.
 * Rejects only when the write genuinely fails inside the window (permission
 * denied, invalid document), which is the case a caller should surface as an
 * error.
 *
 * A failure that arrives AFTER we've already resolved can't be thrown at the
 * caller — the modal has closed by then — so it's handed to `onLateError`
 * instead of becoming an unhandled rejection.
 */
export function settleWhenLocallyWritten(writePromise, options = {}) {
  const { graceMs = LOCAL_WRITE_GRACE_MS, onLateError = null } = options;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ synced: false });
    }, graceMs);

    Promise.resolve(writePromise).then(
      () => {
        clearTimeout(timer);
        if (settled) return; // already reported as unsynced — the sync landing is not news
        settled = true;
        resolve({ synced: true });
      },
      (err) => {
        clearTimeout(timer);
        if (settled) {
          // We told the caller this was queued; it turned out to be rejected.
          try { onLateError?.(err); } catch { /* a reporter must never mask the error */ }
          return;
        }
        settled = true;
        reject(err);
      }
    );
  });
}

// Firestore's hard ceiling is 1,048,576 bytes per document. Item docs carry
// base64 photos inline (Spark plan has no Storage), so this is a real edge for
// a multi-photo piece, not a theoretical one.
export const FIRESTORE_DOC_LIMIT_BYTES = 1_048_576;

// We measure the JSON form, which under-counts the on-the-wire encoding
// slightly (field names, type tags). Warn ~10% early so the guard fires before
// the server does.
export const DOC_SIZE_WARN_BYTES = 940_000;

/** Serialised size of a document payload, in bytes. Unserialisable → 0. */
export function docSizeBytes(value) {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return 0;
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(json).length : json.length;
  } catch {
    return 0; // circular / unserialisable — let Firestore be the judge
  }
}

/**
 * A user-facing reason this document can't be saved, or null when it fits.
 *
 * Without this check an oversized write is accepted locally and rejected only
 * when it reaches the server — which, on a slow connection, is long after the
 * user has been told their item was saved.
 */
export function docTooLargeMessage(value, noun = 'item') {
  const bytes = docSizeBytes(value);
  if (bytes <= DOC_SIZE_WARN_BYTES) return null;
  const mb = (bytes / 1_048_576).toFixed(1);
  return `This ${noun} is ${mb} MB — over the 1 MB a single ${noun} can hold. ` +
    `Remove a photo (or re-add it at a lower quality) and save again.`;
}
