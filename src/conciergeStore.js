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
//       { role: 'client' | 'stylist', text: string, ts: ISO string }
//     ]
//   }
//
// The full transcript lives in an array on a single doc. Firestore caps a doc
// at 1 MiB; at ~500 chars/turn that is ~2000 turns — far more than any human
// conversation. If we ever approach the cap we'll move to a subcollection
// of message docs; for now array-on-doc is simpler and gives atomic snapshots.

import { db, auth } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

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

export async function saveCurrentThread(messages) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(
      threadRef(uid),
      {
        messages,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(), // setDoc with merge keeps the original if already set
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[concierge] save failed:', err?.message || err);
  }
}

export async function clearCurrentThread() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(threadRef(uid), { messages: [], updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[concierge] clear failed:', err?.message || err);
  }
}
