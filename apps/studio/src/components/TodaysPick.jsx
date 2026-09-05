import React from 'react';
import { daysSinceLastWorn, itemImages, itemSeasons } from '../lib/items.js';
import { pickTodaysRecommendation, pickVeto, WET_DAY_PROBABILITY } from '../lib/weather.js';

// One piece from your own wardrobe, worth wearing today.
//
// It lived in the Wardrobe rail, which is where it was born and the wrong place
// for it: a card called "Today's pick" that did not appear on Today, inside an
// aside marked `hidden lg:grid` so a phone never showed it at all. A
// weather-aware nudge is most useful on the screen you open in the morning, on
// the device you open it on.
//
// It sits beneath the Daily Brief, which composes a whole outfit, so it earns
// its place by answering a DIFFERENT question. The Brief says what to wear;
// this says what you are forgetting you own. That is why the reason line leads
// with neglect and mentions the weather second — the weather is a constraint
// here, not the headline, because pickVeto has already guaranteed it.
//
// It is also free and instant where the Brief costs an AI call and can rate
// limit, so on a day the Brief fails this still says something true.
export default function TodaysPick({ items = [], weather, onItemClick, className = '' }) {
  const tempC = weather?.temp ?? null;
  // Already on the weather object this card is handed — the forecast has
  // carried precipProb since the "Mostly dry" label needed it. Footwear is
  // pickable now, and it is the reason this line exists: the veto needs to
  // know whether the pavement will be wet.
  const precipProb = weather?.precipProb ?? null;
  const owned = items.filter((i) => i.status === 'owned');
  const recommendation = pickTodaysRecommendation(owned, tempC, precipProb);

  if (recommendation) {
    // Neglect first. The ranking already favours the least-worn eligible piece,
    // and the copy should say so rather than opening with a weather note that
    // is true of every candidate.
    const reasons = [];
    const days = daysSinceLastWorn(recommendation);
    if (days === null) reasons.push('never worn');
    else if (days >= 30) reasons.push(`not worn in ${Math.floor(days / 30)} month${days < 60 ? '' : 's'}`);
    else if (days >= 14) reasons.push(`not worn in ${days} days`);
    if (tempC != null) reasons.push(`fits today's ${Math.round(tempC)}°C`);
    // On a wet day the footwear veto has done real work — it removed the suede
    // and the sandals — so say so. Only for shoes, and only when it rained:
    // otherwise this is a line about weather that is true of every candidate,
    // which is precisely what the comment above says not to lead with.
    if (recommendation.category === 'Shoes' && precipProb != null && precipProb >= WET_DAY_PROBABILITY) {
      reasons.push('copes with the rain');
    }

    const seasons = itemSeasons(recommendation);
    return (
      <button
        onClick={() => onItemClick?.(recommendation.id)}
        className={`text-left w-full bg-stone-900 text-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 flex items-center gap-4 group hover:bg-stone-700 transition-all smooth-shadow active:scale-[0.98] ${className}`}
      >
        <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden bg-stone-800 shrink-0">
          {itemImages(recommendation)[0] && (
            <img src={itemImages(recommendation)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs tracking-eyebrow uppercase text-stone-400 mb-1.5 flex items-center gap-2">
            <span className="brass-rule" aria-hidden="true"></span> Today's pick
          </p>
          <p className="font-display text-base sm:text-lg text-white leading-tight truncate">{recommendation.name}</p>
          <p className="text-sm text-stone-400 mt-1 truncate">
            {recommendation.brand}
            {seasons.length > 0 && ` · ${seasons.join(' · ')}`}
          </p>
          {reasons.length > 0 && (
            // Not italic, and not stone-400 on near-black. This is the line that
            // explains WHY the app is suggesting this garment, and it used to be
            // the least legible thing on the card: 11px, sentence case, muted
            // and slanted all at once.
            <p className="text-sm text-emerald-300 mt-2 truncate" title={reasons.join(' · ')}>
              {reasons.join(' · ')}
            </p>
          )}
        </div>
      </button>
    );
  }

  // Nothing eligible is a real answer, not a gap. Rendered only when there IS a
  // wardrobe and a temperature: a brand-new account should see the
  // empty-collection state, and an unknown temperature vetoes nothing so a null
  // pick then means something else entirely.
  if (items.length === 0 || tempC == null) return null;

  // Which of the two empty states this is. pickVeto returns a reason rather than
  // a boolean precisely so this sentence can be true: a collection of jewellery
  // and bags has nothing to suggest for a different reason than one full of
  // winter coats in July.
  const ownsAGarment = owned.some((i) => pickVeto(i, tempC, precipProb) !== 'not-a-garment');
  return (
    <div className={`text-left w-full bg-stone-100 text-stone-600 rounded-2xl lg:rounded-3xl p-4 sm:p-5 ${className}`}>
      <p className="text-xs tracking-eyebrow uppercase text-stone-400 mb-1.5 flex items-center gap-2">
        <span className="brass-rule" aria-hidden="true"></span> Today's pick
      </p>
      <p className="font-display text-base sm:text-lg text-stone-800 leading-tight">
        {ownsAGarment
          ? `Nothing in your collection suits ${Math.round(tempC)}°C.`
          : 'No clothes in your collection yet.'}
      </p>
      <p className="text-sm text-stone-500 mt-1">
        {ownsAGarment
          ? 'Your pieces are tagged for other seasons — add a warm-weather piece, or check the season tags on what you own.'
          : "Today's pick suggests something to wear, so it needs a top, a dress, trousers, a coat or a pair of shoes."}
      </p>
    </div>
  );
}
