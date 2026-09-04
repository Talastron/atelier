// Weather fetch + labelling, garment weather-appropriateness scoring, and the
// "today's pick" selector. Plus small greeting/name helpers used alongside.
import { itemStyles, itemSeasons, daysSinceLastWorn, live } from "./items.js";

// Weather: fetched via browser geolocation + Open-Meteo (no API key needed).
// Cached for 1 hour in localStorage so subsequent visits don't re-prompt.
export async function fetchTodaysWeather() {
  // Cache-key version bump — v2 cache held data without precipProb. Bumping
  // to v3 forces a fresh fetch with the new precipitation probability field
  // (previously caused "Rain" labels to persist even when probability was 0%).
  const CACHE_KEY = 'atelier-weather-v3';
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < 3600_000) return cached.data;
  } catch { /* ignore */ }
  if (!navigator.geolocation) return null;
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, maximumAge: 600_000 })
    );
    const { latitude, longitude } = pos.coords;
    // Daily MAX drives dressing decisions. The previous current_weather
    // call returned the temp at the moment of fetch — misleading at 7am
    // when the high won't hit for another 6 hours, or at 9pm when the
    // sun's gone. Daily endpoint gives the day's high and the dominant
    // weather code (e.g. "Partly cloudy" reflects the overall day, not
    // the current sky). timezone=auto pins the daily window to the
    // user's local day boundary.
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      // precipitation_probability_max is the daily maximum precipitation
      // probability — far more honest than the weather_code alone, which
      // returns the day's DOMINANT condition. A 20-min light drizzle at 7am
      // makes weather_code=51 ("Light drizzle"), which we used to label
      // "Rain" even when actual rain probability is sub-10%. Cross-checking
      // the probability lets us say "Mostly dry" instead.
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
      `&current_weather=true&temperature_unit=celsius&timezone=auto&forecast_days=1`
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    const d = json.daily;
    const cw = json.current_weather;
    if (!d || !d.temperature_2m_max?.length) return null;
    const data = {
      // `temp` is now the day's HIGH — keeping the field name so all
      // downstream consumers (AI prompts, badges, Today card) just keep
      // working but with a more useful number.
      temp: Math.round(d.temperature_2m_max[0]),
      tempMin: Math.round(d.temperature_2m_min[0]),
      // Daily weather_code is the dominant condition for the day.
      code: d.weather_code[0],
      // Max precipitation probability (%) — used to suppress "Rain" labels
      // when probability is low even if the dominant code is rain-ish.
      precipProb: d.precipitation_probability_max?.[0] ?? null,
      // Keep the current reading too for any consumer that wants it.
      tempNow: cw ? Math.round(cw.temperature) : null,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch { return null; }
}

// Travel forecast: geocode a place name + fetch a daily forecast window via
// Open-Meteo (no API key). Returns { lat, lon, name, country, daily[] } where
// each daily entry is { date, tmax, tmin, code }. Used by the travel-packing
// generator. Both endpoints are free + don't require auth.
export async function fetchTravelForecast(query, startISO, endISO) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`
  );
  if (!geo.ok) throw new Error('Could not look up that place.');
  const g = await geo.json();
  const loc = g.results?.[0];
  if (!loc) throw new Error('Place not found — try a different name.');

  // Open-Meteo's forecast endpoint covers today + ~16 days. Trips planned more
  // than two weeks ahead are common, so instead of failing the whole call,
  // fetch real forecast for the portion inside the window and synthesize
  // "seasonal estimate" placeholders for the rest. The capsule generator below
  // tells Gemini to fall back to typical climate for those days.
  //
  // Date math note: use local-date components, NEVER toISOString().slice(0,10).
  // Date#toISOString returns UTC, so in any timezone west of UTC (or east
  // during DST), local-midnight converts to "the previous day, 23:00 UTC" and
  // slicing yields the wrong calendar date. This caused trips starting Friday
  // to render as starting Thursday for UK summer (BST = UTC+1) users.
  const localISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const FORECAST_WINDOW_DAYS = 14; // conservative; Open-Meteo nominally serves 16
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + FORECAST_WINDOW_DAYS);
  const horizonISO = localISODate(horizon);

  const startD = new Date(startISO + 'T00:00:00');
  const endD = new Date(endISO + 'T00:00:00');
  if (endD < startD) throw new Error('End date is before start date.');

  const tripStartsBeyondHorizon = startD > horizon;
  const fetchEndISO = endD <= horizon ? endISO : horizonISO;

  let realDaily = [];
  if (!tripStartsBeyondHorizon) {
    const fc = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto` +
      `&start_date=${startISO}&end_date=${fetchEndISO}`
    );
    if (fc.ok) {
      const j = await fc.json();
      const d = j.daily;
      if (d?.time?.length) {
        realDaily = d.time.map((date, i) => ({
          date,
          tmax: Math.round(d.temperature_2m_max[i]),
          tmin: Math.round(d.temperature_2m_min[i]),
          code: d.weathercode[i],
          estimated: false,
        }));
      }
    }
    // Soft failure: if Open-Meteo errors for the in-window portion, fall back
    // to all-estimated rather than blocking the user. The capsule still works.
  }

  // Build the full trip-day array, mixing real forecast with estimates.
  // Use localISODate (see note above) — toISOString here would shift each
  // day to the previous calendar date in UTC+N timezones.
  const daily = [];
  for (let cur = new Date(startD); cur <= endD; cur.setDate(cur.getDate() + 1)) {
    const iso = localISODate(cur);
    const real = realDaily.find((r) => r.date === iso);
    daily.push(real || { date: iso, estimated: true });
  }
  if (daily.length === 0) throw new Error('No dates in the selected range.');

  return { lat: loc.latitude, lon: loc.longitude, name: loc.name, country: loc.country, daily };
}

// Translate Open-Meteo weather codes to friendly labels.
export function weatherLabel(code, precipProb = null) {
  // Sky-only conditions first — these don't depend on precip probability.
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  // For rain-family codes (51-67, drizzle through rain) and shower-family
  // codes (80-82), cross-check the daily precipitation probability. Open-
  // Meteo's weather_code is the day's DOMINANT condition — a 30-minute
  // morning drizzle still maps to code 51, even if it's clear the rest of
  // the day. precipProb < 30% means most of the day will be dry; switch
  // the label to reflect that honestly.
  const lowChance = precipProb !== null && precipProb < 30;
  if (code <= 67) {
    if (lowChance) return 'Mostly dry';
    if (code <= 55) return 'Drizzle';      // codes 51-55: drizzle, not rain
    if (code <= 57) return 'Freezing drizzle';
    return 'Rain';                          // codes 61-67: real rain
  }
  if (code <= 77) return 'Snow';
  if (code <= 82) {
    if (lowChance) return 'Mostly dry';
    return 'Showers';
  }
  if (code <= 86) return 'Snow showers';
  return 'Stormy';
}

// Which seasons a temperature FEELS like. The bands live here once, with two
// entry points onto them, because there used to be two competing notions of
// season in this file: this one, and a calendar month inside
// pickTodaysRecommendation. On 3 September at 24C they disagreed — calendar
// Autumn, thermometer Summer — and the picker consulted the calendar, so an
// Autumn/Winter fleece was offered on a warm day.
//
// If the veto in pickVeto proves too strict for a British autumn, THIS is the
// lever rather than the veto: 22C currently reads as Summer-only, which is a
// warm reading of September. Widening the Spring/Autumn band upward admits more
// of the wardrobe without weakening the rule.
export function seasonsForTemp(tempC) {
  if (tempC == null || Number.isNaN(tempC)) return null;
  if (tempC < 5) return ['Winter'];
  if (tempC < 14) return ['Autumn', 'Winter'];
  if (tempC < 22) return ['Spring', 'Autumn'];
  return ['Summer'];
}

// Given weather, suggest which item seasons fit. Unchanged signature — several
// callers pass the weather object — now delegating so there is one set of bands.
export function weatherToSeasons(weather) {
  return weather ? seasonsForTemp(weather.temp) : null;
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night styling';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Burning the midnight oil';
}

export function firstName(user) {
  if (!user) return '';
  // Best: Firebase Auth displayName (set by Google OAuth, or by the LS webhook
  // for paid subscribers). Take the first word.
  if (user.displayName) return user.displayName.split(' ')[0];
  // Fallback for users without displayName (older subscribers, or anyone
  // signed in via magic link before the webhook started writing displayName).
  // Extract a sensible first name from the email local-part:
  //   sibylle.moeller@gmail.com  → "Sibylle"
  //   john_doe@example.com       → "John"
  //   chris-smith@example.com    → "Chris"
  //   jane@example.com           → "Jane"
  if (user.email) {
    const local = user.email.split('@')[0];
    const firstChunk = local.split(/[._-]/)[0];
    if (!firstChunk) return '';
    return firstChunk.charAt(0).toUpperCase() + firstChunk.slice(1).toLowerCase();
  }
  return '';
}


// Which categories Today's Pick may suggest.
//
// Sportswear and Swimwear are garments and are deliberately absent: both are
// driven by an activity rather than the weather, so suggesting a swimsuit
// because it is 24C is wrong even when the temperature agrees. Shoes are absent
// pending the rain question — sandals and boots are genuinely useful picks, but
// including footwear without considering precipitation would suggest suede on a
// wet day. None of these omissions is an oversight.
const PICKABLE_CATEGORIES = new Set(['Tops', 'Bottoms', 'Dresses', 'Outerwear']);

/**
 * Why this item may not be Today's Pick, or null if it may.
 *
 * A veto, evaluated before any scoring, because a score term can be outvoted
 * and was: season contributed a flat 0.25 while weather contributed at most
 * 0.225, so an Autumn/Winter fleece beat the thermometer on a 24C day.
 *
 * Returns a reason rather than a boolean so the card's empty state can say
 * something true instead of guessing.
 *
 * @returns {'not-a-garment'|'wrong-season'|null}
 */
export function pickVeto(item, tempC) {
  if (!PICKABLE_CATEGORIES.has(item?.category)) return 'not-a-garment';
  const felt = seasonsForTemp(tempC);
  if (!felt) return null;                   // no temperature known — veto nothing
  const declared = itemSeasons(item);
  // Silence is not a declaration. Vetoing on absent data would punish an item
  // that was never scanned, which is a data gap and not a wrong garment.
  if (declared.length === 0) return null;
  return declared.some((s) => felt.includes(s)) ? null : 'wrong-season';
}

// Defined in terms of pickVeto, deliberately, so the two can never disagree
// about the same item.
export function isPickableToday(item, tempC) {
  return pickVeto(item, tempC) === null;
}

// Score an item's weather appropriateness against today's temperature.
// Returns 0..1 (1 = ideal, 0 = strongly inappropriate). Used by
// pickTodaysRecommendation to avoid suggesting a wool sweater in 30°C heat
// or a tank top in 5°C cold.
//
// Reads category, subCategory, and styles for signals. Defaults to 0.5
// (neutral) when there's no signal to penalise or reward — so unflagged
// items still surface, just not over a clearly-appropriate piece.
export function weatherAppropriatenessScore(item, tempC) {
  if (tempC == null || Number.isNaN(tempC)) return 0.5; // no temp info → neutral
  const cat = (item.category || '').toLowerCase();
  const sub = (item.subCategory || '').toLowerCase();
  const styles = (itemStyles(item) || []).map((s) => (s || '').toLowerCase());
  // The NAME is in here for a reason. It used to be category + subCategory +
  // styles only, and "Ladies Country Fleece Quarter Zip" carries the decisive
  // word in its name — so the function returned a neutral 0.5 and Today's Pick
  // offered it on a 24C day. Brand names occasionally collide with a pattern
  // (a "Wool & The Gang" cardigan), which costs a little ranking accuracy and
  // is worth it: the alternative is having no opinion at all about most items.
  const name = (item.name || '').toLowerCase();
  const text = `${name} ${cat} ${sub} ${styles.join(' ')}`;

  // Buckets:
  //   hot:  tempC >= 26  — sleeveless / shorts / dresses ideal; knits/coats penalised
  //   warm: 18-25        — light layers / chinos / t-shirts ideal
  //   cool: 10-17        — sweaters / long sleeves / jeans ideal
  //   cold: < 10         — coats / boots / wool / layers ideal
  // The second group was missing entirely, which is why a fleece scored neutral
  // even once the name was read. All of them are cold-weather constructions.
  const HEAVY_PATTERNS = [
    'coat', 'jacket', 'blazer', 'sweater', 'jumper', 'knit', 'wool', 'cashmere',
    'puffer', 'parka', 'trench', 'leather jacket', 'turtleneck',
    'fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel',
  ];
  const LIGHT_PATTERNS = ['tank', 'sleeveless', 'camisole', 'cami', 't-shirt', 'tee', 'shorts', 'sundress', 'sandal', 'flip', 'linen', 'cotton'];
  const LONG_SLEEVE_PATTERNS = ['long sleeve', 'long-sleeve', 'long sleeved'];
  const LAYER_PATTERNS = ['cardigan', 'cardi', 'gilet', 'vest'];

  const hasAny = (patterns) => patterns.some((p) => text.includes(p));

  let score = 0.5;
  if (tempC >= 26) {
    // Hot day
    if (hasAny(HEAVY_PATTERNS)) score -= 0.45;          // wool jumper on 28°C day = bad
    if (hasAny(LONG_SLEEVE_PATTERNS)) score -= 0.25;    // long-sleeve top on a hot day = also bad
    if (hasAny(LIGHT_PATTERNS)) score += 0.35;
    if (cat === 'dresses' && sub.includes('summer')) score += 0.2;
    if (cat === 'shoes' && (sub.includes('sandal') || text.includes('open'))) score += 0.15;
  } else if (tempC >= 18) {
    // Warm day
    if (hasAny(HEAVY_PATTERNS) && !hasAny(LAYER_PATTERNS)) score -= 0.25;
    if (hasAny(LIGHT_PATTERNS)) score += 0.2;
    if (cat === 'outerwear' && (sub.includes('coat') || sub.includes('parka') || sub.includes('puffer'))) score -= 0.3;
  } else if (tempC >= 10) {
    // Cool day
    if (hasAny(LIGHT_PATTERNS) && !hasAny(LAYER_PATTERNS)) score -= 0.2;
    if (hasAny(HEAVY_PATTERNS) || hasAny(LAYER_PATTERNS)) score += 0.15;
  } else {
    // Cold day
    if (hasAny(LIGHT_PATTERNS)) score -= 0.45;
    if (cat === 'outerwear' && (sub.includes('coat') || sub.includes('parka') || sub.includes('puffer'))) score += 0.35;
    if (hasAny(HEAVY_PATTERNS)) score += 0.25;
    if (cat === 'shoes' && (sub.includes('boot') || sub.includes('ankle'))) score += 0.15;
  }
  return Math.max(0, Math.min(1, score));
}

// Smart recommendation: prefers items you OWN + haven't worn recently, from
// the garments that suit today's temperature. Season appropriateness is a
// VETO applied before scoring, not a preference — see pickVeto. Returns null
// when nothing is eligible, which the caller must render as an honest empty
// state rather than falling back to a poor pick.
export function pickTodaysRecommendation(items, tempC = null) {
  // The veto runs first, and season is part of it rather than part of the
  // score. That is the fix: a score term can be outvoted, and this one was.
  const eligible = live(items)
    .filter((i) => i.status === 'owned')
    .filter((i) => isPickableToday(i, tempC));
  if (eligible.length === 0) return null;

  const scored = eligible.map((item) => {
    const days = daysSinceLastWorn(item);
    const recency = days === null ? 1 : Math.min(days / 60, 1);
    const favouriteBoost = item.favorite ? 1 : 0;
    const weatherFit = weatherAppropriatenessScore(item, tempC);
    // Weather keeps the majority share. The other two are tie-breakers among
    // pieces that already suit the day — they are not competing signals, which
    // is what the removed seasonFit term had become. Sums to 1.0, so these
    // numbers stay comparable with the old scale.
    const score = weatherFit * 0.60 + recency * 0.20 + favouriteBoost * 0.20;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Seed the pick by today's date so it stays stable through the day, then
  // rotates. This is the ONLY remaining use of the current date, and it must
  // not influence WHICH items are eligible — the calendar month used to decide
  // that, and disagreed with the thermometer.
  const top = scored.slice(0, Math.max(3, Math.floor(scored.length * 0.2)));
  const todayKey = new Date().toISOString().slice(0, 10);
  let h = 0; for (let i = 0; i < todayKey.length; i++) h = ((h << 5) - h + todayKey.charCodeAt(i)) | 0;
  return top[Math.abs(h) % top.length].item;
}
