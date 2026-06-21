// src/subscriptionStatus.js
//
// Reads /subscriberAccess/{uid} (written by the Lemon Squeezy webhook in the
// atelier-website repo) and exposes a small reactive hook so the app can
// render trial/subscription state inline.
//
// Owners (sibylle, martin) bypass — they have permanent access via firestore
// rules' isOwner() and don't have a /subscriberAccess doc.
//
// Schema of /subscriberAccess/{uid}:
//   {
//     status: 'trialing' | 'active' | 'cancelled' | 'expired' | 'past_due',
//     currentPeriodEnd: Timestamp,    // when the current paid period ends
//     trialEndsAt?: Timestamp,        // present while status === 'trialing'
//     plan?: 'monthly' | 'annual' | 'founding',
//   }
//
// If the schema in subscriberAccess is different from the above (the webhook
// is authoritative — read it from the atelier-website repo's functions/
// directory), adjust the field names here. The hook structure stays the same.

import { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const OWNER_EMAILS = (import.meta.env.VITE_OWNER_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function daysBetween(future, now) {
  if (!future) return null;
  const ms = future.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
}

export function useSubscriptionStatus(user) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!user?.uid) {
      setState({ loading: false, kind: 'signed-out' });
      return;
    }
    if (OWNER_EMAILS.includes(user.email?.toLowerCase())) {
      setState({ loading: false, kind: 'owner' });
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'subscriberAccess', user.uid),
      (snap) => {
        if (!snap.exists()) {
          // No subscriber doc → must be an invited friend (isInvited rule path)
          setState({ loading: false, kind: 'invited' });
          return;
        }
        const data = snap.data();
        const periodEnd = data.currentPeriodEnd?.toDate?.() || null;
        const trialEnd = data.trialEndsAt?.toDate?.() || null;
        const now = new Date();
        const isTrial = data.status === 'trialing';
        const relevantEnd = isTrial ? trialEnd : periodEnd;
        setState({
          loading: false,
          kind: 'subscriber',
          status: data.status,
          plan: data.plan,
          isTrial,
          trialEndsAt: trialEnd,
          currentPeriodEnd: periodEnd,
          daysRemaining: daysBetween(relevantEnd, now),
        });
      },
      (err) => {
        console.warn('[subscriptionStatus] subscribe failed:', err?.message || err);
        setState({ loading: false, kind: 'unknown' });
      }
    );
    return () => unsub();
  }, [user?.uid, user?.email]);

  return state;
}
