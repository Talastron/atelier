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

// Given weather, suggest which item seasons fit.
export function weatherToSeasons(weather) {
  if (!weather) return null;
  const t = weather.temp;
  if (t < 5) return ['Winter'];
  if (t < 14) return ['Autumn', 'Winter'];
  if (t < 22) return ['Spring', 'Autumn'];
  return ['Summer'];
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
  const text = `${cat} ${sub} ${styles.join(' ')}`;

  // Buckets:
  //   hot:  tempC >= 26  — sleeveless / shorts / dresses ideal; knits/coats penalised
  //   warm: 18-25        — light layers / chinos / t-shirts ideal
  //   cool: 10-17        — sweaters / long sleeves / jeans ideal
  //   cold: < 10         — coats / boots / wool / layers ideal
  const HEAVY_PATTERNS = ['coat', 'jacket', 'blazer', 'sweater', 'jumper', 'knit', 'wool', 'cashmere', 'puffer', 'parka', 'trench', 'leather jacket', 'turtleneck'];
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

// Smart recommendation: prefers items you OWN + haven't worn recently +
// are appropriate for today's actual temperature band. Picks one item.
// Returns null if nothing eligible.
//
// tempC should be the day's HIGH (weather.temp from Open-Meteo daily max).
// Pass null when geolocation is unavailable — falls back to season-only scoring.
export function pickTodaysRecommendation(items, tempC = null) {
  const owned = live(items).filter((i) => i.status === 'owned');
  if (owned.length === 0) return null;
  const month = new Date().getMonth();
  const season = month >= 2 && month <= 4 ? 'Spring'
    : month >= 5 && month <= 7 ? 'Summer'
    : month >= 8 && month <= 10 ? 'Autumn'
    : 'Winter';
  const scored = owned.map((item) => {
    const days = daysSinceLastWorn(item);
    const seasonFit = itemSeasons(item).length === 0 ? 0.4 : itemSeasons(item).includes(season) ? 1 : 0;
    const recency = days === null ? 1 : Math.min(days / 60, 1);
    // Favourites get a meaningful boost — pieces the user has explicitly
    // starred should surface more often as Today's Pick than equally-suitable
    // unstarred items.
    const favouriteBoost = item.favorite ? 0.25 : 0;
    const weatherFit = weatherAppropriatenessScore(item, tempC);
    // Weather is the dominant signal when known (0.45 weight); season is
    // secondary (0.25); recency + favourite remain meaningful tie-breakers.
    const score = weatherFit * 0.45 + seasonFit * 0.25 + recency * 0.15 + favouriteBoost * 0.15;
    return { item, score, weatherFit };
  });
  scored.sort((a, b) => b.score - a.score);
  // Hard filter: anything with weatherFit < 0.2 is too inappropriate for
  // today's weather to ever be Today's Pick, no matter how favourited or
  // unworn. (Wool jumper on a 34°C day = never Today's Pick.)
  const eligible = scored.filter((s) => s.weatherFit >= 0.2);
  const top = (eligible.length > 0 ? eligible : scored).slice(0, Math.max(3, Math.floor(scored.length * 0.2)));
  if (top.length === 0) return null;
  // Seed pick by today's date so it stays stable through the day, then rotates.
  const todayKey = new Date().toISOString().slice(0, 10);
  let h = 0; for (let i = 0; i < todayKey.length; i++) h = ((h << 5) - h + todayKey.charCodeAt(i)) | 0;
  return top[Math.abs(h) % top.length].item;
}
