// Evidence for a delay nobody has been able to explain.
//
// Adding an item showed the "still syncing" note, which fires when the server
// has not acknowledged a write within six seconds. The obvious suspect was
// document size — an item carrying base64 photos genuinely does take that long
// — but the item that prompted the report had NO photos at all, so the
// explanation was wrong and there is currently no other.
//
// Guessing again is not a plan. This records what a slow write actually looked
// like, so the next occurrence leaves facts behind instead of a memory:
//
//   ms            how long the server really took, not just "over six seconds".
//                 The grace period resolves the UI early; the write keeps going,
//                 and until now nobody was watching where it ended up.
//   bytes         the size theory, kept so it can be ruled out with a number
//                 rather than an argument.
//   queuedBehind  how many writes were already in flight when this one started.
//                 Firestore commits a connection's mutations in order, so a
//                 small document can wait out a large one queued ahead of it.
//                 This is the leading hypothesis for a photo-less item taking
//                 six seconds, and nothing currently measures it.
//   hidden        a backgrounded tab is throttled by the browser, which looks
//                 identical to a slow network from inside the app.
//
// Deliberately not a logger. Records are kept only for writes slow enough to
// need explaining, capped, and survive a reload — a phone is where this
// happens, and a console she cannot open is no use.

const MAX_RECORDS = 25;

// Only writes worth explaining. Well under the six-second grace period, so a
// write that merely approached the threshold is still captured — the question
// is what makes writes slow, and only sampling the ones that crossed the line
// would hide the shape of the distribution.
export const SLOW_WRITE_MS = 2000;

const STORAGE_KEY = 'atelier:write-timings:v1';

let records = null;              // lazily loaded from storage
const inFlight = new Map();      // ticket -> { label, startedAt, bytes }
let nextTicket = 1;

function readStore() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];   // private mode, blocked storage, corrupt JSON — never throw
  }
}

function writeStore(next) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* diagnostics must never break the write they are measuring */ }
}

function ensureLoaded() {
  if (records === null) records = readStore();
  return records;
}

/**
 * Start timing a write. Returns a ticket to hand back to endWrite.
 *
 * @param {string} label   the same human label the toast uses
 * @param {number|null} bytes  serialised size, when the caller knows it
 */
export function beginWrite(label, bytes = null) {
  const ticket = nextTicket++;
  inFlight.set(ticket, {
    label: label || 'write',
    bytes: typeof bytes === 'number' ? bytes : null,
    startedAt: Date.now(),
    // Excludes this write, which has not been added yet.
    queuedBehind: inFlight.size,
  });
  return ticket;
}

/**
 * Finish timing. Keeps a record only when the write was slow enough to need
 * explaining. Unknown tickets are ignored rather than throwing: a caller that
 * ends twice, or ends after a reload, is not worth crashing a save over.
 */
export function endWrite(ticket, { outcome = 'ok' } = {}) {
  const started = inFlight.get(ticket);
  if (!started) return null;
  inFlight.delete(ticket);

  const ms = Date.now() - started.startedAt;
  if (ms < SLOW_WRITE_MS) return null;

  const record = {
    label: started.label,
    ms,
    bytes: started.bytes,
    queuedBehind: started.queuedBehind,
    outcome,
    // A throttled background tab is indistinguishable from a slow network
    // unless you write down which one it was.
    hidden: globalThis.document?.visibilityState === 'hidden',
    // Recorded, not interpreted. navigator.onLine is only trustworthy when
    // false — see looksOffline in persist.js.
    offline: globalThis.navigator?.onLine === false,
    at: new Date().toISOString(),
  };

  const next = [record, ...ensureLoaded()].slice(0, MAX_RECORDS);
  records = next;
  writeStore(next);
  return record;
}

/** Recorded slow writes, newest first. */
export function writeTimings() {
  return [...ensureLoaded()];
}

/** How many writes are in flight right now. */
export function pendingWrites() {
  return inFlight.size;
}

export function clearWriteTimings() {
  records = [];
  inFlight.clear();
  writeStore([]);
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

/**
 * One line describing a slow write, for a screen rather than a console.
 *
 * Says what was measured and nothing about what it means — the whole point is
 * that the cause is unknown, and a summary that guessed would be the same
 * mistake as the base64 theory.
 */
export function describeWriteTiming(record) {
  if (!record) return '';
  const parts = [`${(record.ms / 1000).toFixed(1)}s`, record.label];
  if (record.bytes != null) parts.push(kb(record.bytes));
  if (record.queuedBehind > 0) parts.push(`behind ${record.queuedBehind}`);
  if (record.hidden) parts.push('tab hidden');
  if (record.offline) parts.push('offline');
  if (record.outcome !== 'ok') parts.push(record.outcome);
  return parts.join(' · ');
}
