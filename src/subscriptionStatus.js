// src/subscriptionStatus.js
//
// Reads /subscriberAccess/{uid} (written by the Lemon Squeezy webhook in the
// atelier-website repo) and exposes a small reactive hook so the app can
// render trial/subscription state inline.
//
// Owners (sibylle, martin) bypass — they have permanent access via firestore
// rules' isOwner() and don't have a /subscriberAccess doc.
//
// Schema of /subscriberAccess/{uid} (authoritative source: the webhook in the
// atelier-website monorepo, functions/lib/firestore.ts → upsertSubscriberAccess):
//   {
//     status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'paused',
//     currentPeriodEnd: Timestamp,    // renewal date (= trial end while on trial)
//     trialEndsAt?: Timestamp,        // present ONLY during the free trial
//     cancelledAt?: Timestamp,
//     subscriptionId, email, updatedAt,
//   }
// NOTE: Lemon Squeezy 'on_trial' is normalised to status:'active' by the
// webhook — there is no 'trialing' status. A trial is detected purely by a
// future `trialEndsAt`. There is currently no `plan` field on this doc.

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
        // The webhook normalises Lemon Squeezy 'on_trial' to status:'active'
        // and writes trial_ends_at, so a future trialEndsAt is the ONLY trial
        // signal. Once the trial converts, the webhook clears the field and
        // this flips to false on its own.
        const isTrial = !!trialEnd && trialEnd.getTime() > now.getTime();
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
