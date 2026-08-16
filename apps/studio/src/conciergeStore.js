// src/conciergeStore.js
//
// Persistence for Concierge conversations. Each user has one or more threads.
// In v1 we maintain a single "current" thread per user — multi-thread is a
// nice-to-have that can ship later without a schema change (just write a new
// threadId doc).
//
// Schema:
//   /users/{uid}/concierge/{threadId} {
//     createdAt: serverTimestamp,
//     updatedAt: serverTimestamp,
//     messages: [
//       { role: 'user' | 'assistant', text: string, ts: ISO string }
//     ]
//   }
//
// The full transcript lives in an array on a single doc. Firestore caps a doc
// at 1 MiB; at ~500 chars/turn that is ~2000 turns — far more than any human
// conversation. If we ever approach the cap we'll move to a subcollection
// of message docs; for now array-on-doc is simpler and gives atomic snapshots.
//
// Firestore rules: the path /users/{uid}/concierge/{threadId} is covered by
// the existing wildcard rule `match /users/{uid}/{document=**}` (deployed
// version of firestore.rules — not in this open-source tree, see
// firestore.rules.example for the template). No new rule deploy needed.

import { db, auth } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { settleWhenLocallyWritten } from './lib/persist.js';

const CURRENT_THREAD_ID = 'current'; // v1: one active thread per user

function threadRef(uid) {
  return doc(db, 'users', uid, 'concierge', CURRENT_THREAD_ID);
}

export async function loadCurrentThread() {
  const uid = auth.currentUser?.uid;
  if (!uid) return { messages: [] };
  try {
    const snap = await getDoc(threadRef(uid));
    if (!snap.exists()) return { messages: [] };
    const data = snap.data();
    return { messages: Array.isArray(data.messages) ? data.messages : [] };
  } catch (err) {
    console.warn('[concierge] load failed:', err?.message || err);
    return { messages: [] };
  }
}

// Both writers are awaited inside the Concierge send flow — the user-message
// save runs BEFORE the AI call — so they must always settle. With offline
// persistence a bare setDoc await never resolves offline (it doesn't reject,
// so the catch is no protection), which froze the composer before the AI
// could even produce its "offline" error. settleWhenLocallyWritten caps the
// wait; the queued write still syncs on reconnect.
export async function saveCurrentThread(messages) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await settleWhenLocallyWritten(setDoc(
      threadRef(uid),
      {
        messages,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(), // setDoc with merge keeps the original if already set
      },
      { merge: true }
    ), {
      // A rejection after the grace window (doc over 1 MiB, rules change)
      // means the conversation silently never persisted — at least say so in
      // the console, since the catch below can't see a post-settle failure.
      onLateError: (err) => console.warn('[concierge] thread write rejected after settling:', err?.message || err),
    });
  } catch (err) {
    console.warn('[concierge] save failed:', err?.message || err);
  }
}

export async function clearCurrentThread() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await settleWhenLocallyWritten(setDoc(threadRef(uid), { messages: [], updatedAt: serverTimestamp() }, { merge: true }), {
      onLateError: (err) => console.warn('[concierge] clear rejected after settling:', err?.message || err),
    });
  } catch (err) {
    console.warn('[concierge] clear failed:', err?.message || err);
  }
}
