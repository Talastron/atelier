// Dev-only, like alpha-check.html and reprocess-timing.html — Vite builds
// index.html only, so nothing here reaches production.
//
// Counts how many garments are eligible for Today's Pick on a given day.
//
// The veto added alongside this makes an item's own `seasons` declaration
// decisive: a piece tagged Autumn/Winter is never suggested at 24C. That is
// correct, and it has a failure mode worth measuring rather than assuming — a
// British wardrobe skews cold, so if almost nothing qualifies on a warm day the
// card shows its empty state most days and the feature reads as broken rather
// than careful.
//
// This cannot be done from the browser console: bare specifiers like
// 'firebase/firestore' only resolve inside Vite's module graph, and the console
// is not in it. A page is.
import { db } from '../src/firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { seasonsForTemp, pickVeto } from '../src/lib/weather.js';

const els = {
  temp: document.getElementById('temp'),
  run: document.getElementById('run'),
  status: document.getElementById('status'),
  out: document.getElementById('out'),
  verdict: document.getElementById('verdict'),
};

const row = (label, n, total, note) => {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return `<tr><td>${label}</td><td>${n}</td><td>${pct}%</td><td class="note">${note}</td></tr>`;
};

els.run.addEventListener('click', async () => {
  const tempC = Number(els.temp.value);
  els.status.textContent = 'Reading your wardrobe…';
  els.run.disabled = true;
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error('Not signed in — open the app at localhost:5173 first, then reload this page.');

    const snap = await getDocs(collection(db, 'users', uid, 'items'));
    const items = [];
    snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));

    // Owned garments only — the same set Today's Pick draws from.
    const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
    const garments = owned.filter((i) => pickVeto(i, tempC) !== 'not-a-garment');

    const seasonsOf = (d) => (Array.isArray(d.seasons) ? d.seasons : (d.season ? [d.season] : []));
    let untagged = 0, eligibleTagged = 0, vetoed = 0;
    const vetoedNames = [];
    for (const item of garments) {
      const declared = seasonsOf(item);
      if (declared.length === 0) untagged += 1;
      else if (pickVeto(item, tempC) === null) eligibleTagged += 1;
      else { vetoed += 1; if (vetoedNames.length < 12) vetoedNames.push(item.name || item.id); }
    }
    const eligible = untagged + eligibleTagged;

    els.out.innerHTML = `
      <p class="sub">At <b>${tempC}°C</b>, which feels like <b>${(seasonsForTemp(tempC) || []).join(' / ') || 'nothing in particular'}</b>.
      ${owned.length} owned pieces, of which ${garments.length} are garments (tops, bottoms, dresses, outerwear).</p>
      <table>
        <thead><tr><th>Bucket</th><th>Count</th><th>Share</th><th>Meaning</th></tr></thead>
        <tbody>
          ${row('Eligible — declared, and it matches', eligibleTagged, garments.length, 'suggested on merit')}
          ${row('Eligible — declares nothing', untagged, garments.length, 'passes on silence, not agreement')}
          ${row('Vetoed — declared for other seasons', vetoed, garments.length, 'never suggested today')}
        </tbody>
        <tfoot><tr><td><b>Eligible in total</b></td><td><b>${eligible}</b></td><td><b>${garments.length ? Math.round((eligible / garments.length) * 100) : 0}%</b></td><td></td></tr></tfoot>
      </table>
      ${vetoedNames.length ? `<p class="sub">Vetoed, for example: ${vetoedNames.join(' · ')}</p>` : ''}
    `;

    // The two numbers point at different fixes, so say which one applies.
    let verdict;
    if (eligible === 0) {
      verdict = `<b>Nothing is eligible.</b> The card would show its empty state every day at this temperature.
        Either the season tags are wrong across the wardrobe — a data problem with its own fix — or the bands
        badly mismatch the climate. Do not ship the veto on this.`;
    } else if (eligible < 10) {
      verdict = `<b>Only ${eligible} eligible.</b> The empty state will dominate a warm spell, and the pick will
        barely rotate — it chooses from the top three, so with this few you would see the same garment for days.
        The lever is <code>seasonsForTemp</code>'s bands rather than the veto: ${tempC}°C currently reads as
        ${(seasonsForTemp(tempC) || []).join('/')}, and widening the Spring/Autumn band upward admits more of the
        wardrobe without weakening the rule.`;
    } else {
      verdict = `<b>${eligible} eligible.</b> Comfortably enough to pick from and to rotate. The veto ships as designed.`;
    }
    if (untagged > eligibleTagged) {
      verdict += `<br><br><b>But most eligible pieces declare nothing.</b> ${untagged} of ${eligible} pass the veto
        on silence rather than agreement — they are suggested on trust, not because they suit the day. That is a
        data-quality gap, and widening the temperature bands would not touch it.`;
    }
    els.verdict.innerHTML = verdict;
    els.verdict.hidden = false;
    els.status.textContent = 'Done.';
  } catch (err) {
    els.status.textContent = `Failed — ${err.message}`;
  } finally {
    els.run.disabled = false;
  }
});
