import React, { useState, useEffect } from "react";
import { AlertCircle, Bookmark, Calendar, ChevronRight, Sparkles, Star, TrendingDown } from "lucide-react";
import { fetchTodaysWeather, weatherLabel, firstName, getGreeting } from "../lib/weather.js";
import { summariseStyleProfile, todayISO, itemCareReminder, daysSinceLastWorn } from "../lib/items.js";
import { generateOutfitWithGemini } from "../lib/ai.js";
import { isCalendarConnected, fetchCalendarEvents, isAIEnabled } from "../firebase.js";
import { readDailyBrief, writeDailyBrief, clearDailyBrief, nextSlotIndex, registerInflightCompose } from "../dailyBrief";
import { useToast } from "../ui/toast.jsx";
import WeekStrip from "../components/WeekStrip.jsx";
import ConciergePrompt from "../components/ConciergePrompt.jsx";
import WhyThisPanel from "../components/WhyThisPanel.jsx";
import { renderTextWithChips } from "../components/ItemChip.jsx";

const COMPOSE_STAGES = [
  'Reading your wardrobe…',
  'Checking the weather…',
  'Weighing colour & cohesion…',
  'Balancing the silhouette…',
  'Layering the finishing touches…',
  'Composing the look…',
];
function useComposingStage(active) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active) { setStage(0); return; }
    let i = 0;
    // ~2.2s per line, and more lines, so the narration moves at a calm,
    // readable pace and only parks on the final line if compose runs long.
    const id = setInterval(() => {
      i = Math.min(i + 1, COMPOSE_STAGES.length - 1);
      setStage(i);
      if (i === COMPOSE_STAGES.length - 1) clearInterval(id);
    }, 2200);
    return () => clearInterval(id);
  }, [active]);
  return COMPOSE_STAGES[stage];
}

function ComposingPlaceholder({ title = 'The Daily Brief', stage }) {
  // Calm, editorial wait: a slow soft sheen sweeps across refined skeleton
  // cells (gently staggered into a wave), with the narration in the display
  // serif. Deliberately quiet — no flickering, no shuffling images.
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-6 sm:p-8 smooth-shadow">
      <style>{`@keyframes atelierSheen{0%{background-position:-150% 0}100%{background-position:250% 0}}`}</style>
      <p className="text-[10px] tracking-[0.28em] uppercase text-stone-400">{title}</p>
      <div className="mt-5 flex items-center gap-3">
        <span className="brass-rule" aria-hidden="true" />
        <p className="font-display italic text-lg sm:text-xl text-stone-700">{stage}</p>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-xl"
            aria-hidden="true"
            style={{
              backgroundImage: 'linear-gradient(110deg, #efece7 25%, #f7f5f2 45%, #efece7 65%)',
              backgroundSize: '250% 100%',
              animation: 'atelierSheen 2.6s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
      <p className="mt-5 text-xs text-stone-400 tracking-wide">A considered look takes a moment.</p>
    </div>
  );
}


function DailyBriefCard({
  user,
  items,
  measurements,
  weather,
  weatherSettled = true,  // default true so callers that don't pass it (e.g. demo)
                          // still render — only gates the live auto-compose path
  season,
  aiTemperature,
  onGenerateOutfit,
  onSaveOutfit,
  onLogOutfitWear,
  onOpenOutfit,
  onOpenItem = null,  // optional: tap a chip → open that item's detail view
  onEditPreferences,  // optional: jumps to Profile → Style so the user can
                       // change palette / formality / temperament from the
                       // "What the Concierge saw" capsule.
  isAiEnabled,
}) {
  const uid = user?.uid || 'anon';
  const toast = useToast();
  const [brief, setBrief] = useState(() => readDailyBrief(uid));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [whyOpen, setWhyOpen] = useState(false);
  // autoFailed: true when auto-compose hit a config error (App Check, rate
  // limit, AI Logic disabled). When true, render a manual-trigger empty state
  // instead of returning null. The manual click goes through composeAnother
  // which surfaces errors loudly via the error state.
  const [autoFailed, setAutoFailed] = useState(false);
  // Action busy/done states. Both buttons fire async writes to Firestore — we
  // need to disable them while in flight AND show confirmation after success,
  // otherwise users double-tap and end up with duplicate outfits. Reset
  // whenever the brief itself changes (compose another), since the new brief
  // hasn't been saved/worn yet.
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const [wearState, setWearState] = useState('idle'); // idle | wearing | done
  useEffect(() => { setSaveState('idle'); setWearState('idle'); }, [brief?.savedAt]);

  // Best-effort: pull today's calendar events so the brief can dress for
  // what's on. Guarded so non-connected users never fire the callable.
  // `calendarReady` gates the auto-compose below: we must NOT compose the
  // day's brief before this resolves, or the events arrive too late and the
  // headline "dress for what's on today" feature silently no-ops on the very
  // brief most users see. Mirrors the existing `weatherSettled` gate.
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarReady, setCalendarReady] = useState(false);
  useEffect(() => {
    if (!user) { setCalendarReady(true); return; }
    let alive = true;
    (async () => {
      try {
        const connected = await isCalendarConnected(user);
        if (!alive) return;
        if (!connected) return;
        const startISO = new Date(todayISO() + 'T00:00:00').toISOString();
        const endISO = new Date(todayISO() + 'T23:59:59').toISOString();
        const { events = [], reason } = await fetchCalendarEvents(startISO, endISO);
        if (alive && reason !== 'revoked') setCalendarEvents(events);
      } catch (err) {
        // Calendar context is best-effort — never block styling on it.
        console.warn('[calendar] event fetch for AI context failed:', err?.message);
      } finally {
        if (alive) setCalendarReady(true);
      }
    })();
    return () => { alive = false; };
  }, [user]);

  // Auto-compose on first mount of the day if we have enough items and AI is on.
  // Errors here are quietly swallowed (no scary banner on every page load) —
  // but we flip autoFailed so the card stays visible with a manual-trigger
  // empty state instead of disappearing.
  useEffect(() => {
    if (brief) return;
    if (!isAiEnabled) return;
    if ((items?.length ?? 0) < 5) return;
    // Wait until weather fetch has settled before composing — otherwise the
    // Concierge sees null weather and writes "weather is unknown" even though
    // the Today tile (rendering just below) has it. weatherSettled flips true
    // once fetchTodaysWeather resolves (with data OR null on geo-denied),
    // so an honest unavailable still proceeds rather than blocking forever.
    if (!weatherSettled) return;
    // Likewise wait for the calendar check to resolve, so a connected user's
    // first brief of the day is composed WITH today's events rather than
    // racing ahead with an empty list. Non-connected users flip this true
    // almost immediately, so they're not delayed.
    if (!calendarReady) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAutoFailed(false);

    // Use module-level inflight dedup. If another mount of this card is
    // already composing (user tab-navigated mid-compose), await its
    // promise instead of firing a second API call.
    registerInflightCompose(uid, async () => {
      const out = await onGenerateOutfit({
        intent: 'a considered look for today',
        temperature: aiTemperature,
        slotIndex: 0,
        calendarEvents,
      });
      return writeDailyBrief(uid, { ...out, intent: 'a considered look for today', slotIndex: 0 });
    })
      .then((saved) => {
        if (cancelled) return;
        if (saved) setBrief(saved);
      })
      .catch((err) => {
        console.warn('[daily-brief] auto-compose skipped:', err?.message || err);
        if (!cancelled) setAutoFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [uid, isAiEnabled, items?.length, weatherSettled, calendarReady]); // re-fires when weather AND calendar resolve so the brief is composed with both

  async function composeAnother() {
    setLoading(true);
    setError(null);
    try {
      const slot = nextSlotIndex(uid);
      const out = await onGenerateOutfit({
        intent: 'a different considered look for today',
        temperature: aiTemperature,
        slotIndex: slot,
        previous: brief,
        calendarEvents,
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a different considered look for today', slotIndex: slot });
      setBrief(saved);
    } catch (err) {
      setError(err?.message || 'Could not compose another brief.');
    } finally {
      setLoading(false);
    }
  }

  // Empty state — wardrobe too small to compose
  if ((items?.length ?? 0) < 5) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-stone-700">
        <p className="text-sm uppercase tracking-widest text-stone-500">The Daily Brief</p>
        <h3 className="mt-2 text-xl font-serif">Add a few more pieces, and the brief begins.</h3>
        <p className="mt-2 text-sm text-stone-600">
          The Concierge composes today's outfit once your wardrobe has at least five pieces.
        </p>
      </div>
    );
  }

  // Loading state — shown for BOTH first-compose and "Compose another".
  // Previously this only fired when !brief, so a re-compose would leave the
  // old card visible with just a button-text change ("Composing…") — no
  // visible feedback that anything was happening. Now we always swap to the
  // composing placeholder with progressive status messages.
  const composingStage = useComposingStage(loading);
  if (loading) {
    return <ComposingPlaceholder title="The Daily Brief" stage={composingStage} />;
  }

  // Error state
  if (error && !brief) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-sm uppercase tracking-widest text-stone-500">The Daily Brief</p>
        <p className="mt-2 text-sm text-stone-700">{error}</p>
        <button
          onClick={composeAnother}
          className="mt-3 rounded-full border border-stone-300 px-4 py-1.5 text-sm hover:bg-stone-50"
        >
          Try again
        </button>
      </div>
    );
  }

  // Auto-fire failed silently (e.g. App Check misconfigured). Show a friendly
  // empty state with a manual trigger — the manual click goes through
  // composeAnother which surfaces any error loudly via the error state above.
  if (!brief && autoFailed) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-sm uppercase tracking-widest text-stone-500">The Daily Brief</p>
        <h3 className="mt-2 text-xl font-serif text-stone-900">Ready when you are.</h3>
        <p className="mt-2 text-sm text-stone-600">
          Tap below to compose today's outfit from your wardrobe.
        </p>
        <button
          type="button"
          onClick={composeAnother}
          className="mt-3 rounded-full bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
        >
          Compose today's brief
        </button>
      </div>
    );
  }

  if (!brief) return null;

  // Order the brief thumbnails clothing-first so the actual garments lead the
  // eye, not the jewellery stack: dress/top/bottom/outerwear → shoes → bags →
  // accessories → jewellery. Stable sort keeps Gemini's order within a tier.
  const BRIEF_CATEGORY_ORDER = { Dresses: 0, Tops: 0, Bottoms: 0, Outerwear: 0, Sportswear: 0, Swimwear: 0, Shoes: 1, Bags: 2, Accessories: 3, Jewellery: 4 };
  const briefItems = (brief.itemIds || [])
    .map(id => items.find(it => it.id === id))
    .filter(Boolean)
    .sort((a, b) => (BRIEF_CATEGORY_ORDER[a.category] ?? 2.5) - (BRIEF_CATEGORY_ORDER[b.category] ?? 2.5));

  const handleWearThis = async () => {
    if (!brief.itemIds?.length) return;
    if (wearState !== 'idle') return; // already in flight or done — block double-tap
    setWearState('wearing');
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const outfit = {
      id: `db-${uid}-${Date.now()}`,
      name: `Daily Brief · ${today}`,
      itemIds: brief.itemIds,
      createdAt: new Date().toISOString(),
      reasoning: brief.reasoning || '',
      intent: brief.intent || 'today',
    };
    try {
      if (onSaveOutfit) await onSaveOutfit(outfit);
      if (onLogOutfitWear) await onLogOutfitWear(outfit, todayISO(), '');
      setWearState('done');
      toast?.show?.(`Logged today's wear · ${briefItems.length} pieces`, { kind: 'success' });
      // Slight delay so the user sees confirmation before the card disappears
      setTimeout(() => {
        clearDailyBrief(uid);
        setBrief(null);
      }, 700);
    } catch (err) {
      setWearState('idle');
      toast?.show?.(err?.message || 'Could not log wear.', { kind: 'error' });
    }
  };

  const handleSaveAsLook = async () => {
    if (!brief.itemIds?.length) return;
    if (saveState !== 'idle') return; // already saved (or saving) — prevent dupes
    setSaveState('saving');
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const outfit = {
      id: `db-${uid}-${Date.now()}`,
      name: `Daily Brief · ${today}`,
      itemIds: brief.itemIds,
      createdAt: new Date().toISOString(),
      reasoning: brief.reasoning || '',
      intent: brief.intent || 'today',
      confidence: brief.confidence,
    };
    try {
      if (onSaveOutfit) await onSaveOutfit(outfit);
      setSaveState('saved');
      toast?.show?.('Saved to your Lookbook', { kind: 'success' });
    } catch (err) {
      setSaveState('idle');
      toast?.show?.(err?.message || 'Could not save.', { kind: 'error' });
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <p className="text-sm uppercase tracking-widest text-stone-500">The Daily Brief</p>
        <p className="text-xs text-stone-400">{brief.confidence ?? '—'}% confidence</p>
      </div>
      <h3 className="mt-2 text-2xl font-serif text-stone-900">
        Styled for today.
      </h3>
      <p className="mt-2 text-sm italic text-stone-700">{renderTextWithChips(brief.reasoning, { items, onOpenItem })}</p>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
        {briefItems.map(it => (
          <button
            key={it.id}
            type="button"
            onClick={() => onOpenOutfit?.(brief)}
            className="aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-50 hover:border-stone-400 transition-colors"
            aria-label={`Open ${it.name} in Studio`}
          >
            {(it.images?.[0] || it.imageUrl) ? (
              <img src={it.images?.[0] || it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">{it.category}</div>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => setWhyOpen(o => !o)}
        className="mt-3 text-xs uppercase tracking-widest text-stone-500 underline-offset-4 hover:underline"
      >
        {whyOpen ? 'Hide reasoning' : 'Why this?'}
      </button>
      {whyOpen && (
        <WhyThisPanel
          weather={weather}
          season={season}
          styleProfile={measurements}
          temperature={aiTemperature}
          itemCount={items?.length ?? 0}
          onEditPreferences={onEditPreferences}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleWearThis}
          disabled={wearState !== 'idle'}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {wearState === 'wearing' ? 'Logging…' : wearState === 'done' ? '✓ Logged' : 'Wear this'}
        </button>
        <button
          type="button"
          onClick={composeAnother}
          disabled={loading}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50 disabled:opacity-50"
        >
          {loading ? 'Composing…' : 'Compose another'}
        </button>
        <button
          type="button"
          onClick={handleSaveAsLook}
          disabled={saveState !== 'idle'}
          className={`rounded-full border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed ${
            saveState === 'saved'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-stone-300 hover:bg-stone-50 disabled:opacity-60'
          }`}
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved to Lookbook' : 'Save as a Look'}
        </button>
      </div>
    </div>
  );
}

// ─── Home-screen tile: at-a-glance weather summary + tomorrow's planned outfit.
// Compose functionality lives exclusively in the Daily Brief card above — this
// tile is a quiet information strip, not a second compose surface.

function DailyDigest({ items, outfits, schedules, inspirations = [], onOpenItem, onOpenOutfit, onOpenInspiration, onOpenInspirationTab }) {
  const owned = items.filter((i) => i.status === 'owned');
  const todayKey = todayISO();
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

  // Care due
  const careDue = owned.map((i) => ({ i, r: itemCareReminder(i) })).filter((x) => x.r?.due).slice(0, 3);

  // Tomorrow's planned outfit (today's, if not yet logged)
  const todaySched = schedules?.[todayKey];
  const tomorrowSched = schedules?.[tomorrow];
  const todayOutfit = todaySched?.outfitId ? outfits.find((o) => o.id === todaySched.outfitId) : null;
  const tomorrowOutfit = tomorrowSched?.outfitId ? outfits.find((o) => o.id === tomorrowSched.outfitId) : null;

  // Stale favourite (worn 30+ days ago, or never)
  const staleFav = owned.find((i) => i.favorite && (daysSinceLastWorn(i) === null || daysSinceLastWorn(i) >= 30));

  // Recent price drops (last 7 days)
  const weekAgo = Date.now() - 7 * 86_400_000;
  const drops = items.filter((i) => {
    if (i.status !== 'wishlist' || !Array.isArray(i.priceHistory) || i.priceHistory.length < 2) return false;
    const last = i.priceHistory[i.priceHistory.length - 1];
    const prev = i.priceHistory[i.priceHistory.length - 2];
    return last.price < prev.price && new Date(last.date).getTime() > weekAgo;
  }).slice(0, 3);

  // Lent out & overdue
  const overdueLent = owned.filter((i) => i.lentTo && i.lentReturnBy && i.lentReturnBy < todayKey).slice(0, 3);

  // Unanalysed inspirations — surface once you've collected 3+ raw images
  // sitting in the board without an AI cross-reference yet.
  const unanalysedInspos = (inspirations || []).filter((i) => !i.analysis);
  const showInspoNudge = unanalysedInspos.length >= 3;

  const cards = [];
  if (todayOutfit) cards.push({ kind: 'planned-today', outfit: todayOutfit, label: todaySched?.eventName ? `Today · ${todaySched.eventName}` : "Today's plan", eventName: todaySched?.eventName });
  if (tomorrowOutfit) cards.push({ kind: 'planned-tomorrow', outfit: tomorrowOutfit, label: tomorrowSched?.eventName ? `Tomorrow · ${tomorrowSched.eventName}` : 'Planned tomorrow', eventName: tomorrowSched?.eventName });
  for (const { i, r } of careDue) cards.push({ kind: 'care', item: i, reminder: r });
  if (staleFav) cards.push({ kind: 'stale-fav', item: staleFav });
  for (const i of drops) cards.push({ kind: 'price-drop', item: i });
  for (const i of overdueLent) cards.push({ kind: 'overdue', item: i });
  if (showInspoNudge) cards.push({ kind: 'inspo-unanalysed', inspiration: unanalysedInspos[0], total: unanalysedInspos.length });

  if (cards.length === 0) return null;

  return (
    <div className="bg-white border border-stone-200/60 rounded-3xl p-4 sm:p-5 smooth-shadow">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display text-base sm:text-lg text-stone-900">Needs attention</h3>
        <span className="text-[10px] tracking-widest uppercase text-stone-500">{cards.length} item{cards.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="space-y-1">
        {cards.map((c, i) => {
          const Row = ({ icon, accent, title, sub, onClick }) => (
            <li>
              <button onClick={onClick}
                className="w-full flex items-center gap-3 text-left py-2 px-2 -mx-2 rounded-xl hover:bg-stone-100transition-colors">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 truncate">{title}</p>
                  <p className="text-[11px] text-stone-500 truncate">{sub}</p>
                </div>
                <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0" />
              </button>
            </li>
          );
          if (c.kind === 'planned-today' || c.kind === 'planned-tomorrow') {
            return <Row key={i} icon={<Calendar size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.outfit.name} sub={c.label} onClick={() => onOpenOutfit?.(c.outfit.id)} />;
          }
          if (c.kind === 'care') {
            return <Row key={i} icon={<Sparkles size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.item.name} sub={`${c.reminder.material} care · ${c.reminder.wearsSince} wears`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'stale-fav') {
            const d = daysSinceLastWorn(c.item);
            return <Row key={i} icon={<Star size={16} strokeWidth={1.5} />} accent="bg-stone-100 text-stone-700"
              title={c.item.name} sub={d === null ? 'Favourite · never worn' : `Favourite · ${d} days since last wear`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'price-drop') {
            const h = c.item.priceHistory;
            const drop = Math.round((1 - h[h.length - 1].price / h[h.length - 2].price) * 100);
            return <Row key={i} icon={<TrendingDown size={16} strokeWidth={1.5} />} accent="bg-emerald-100 text-emerald-800"
              title={c.item.name} sub={`Price dropped ${drop}% · now £${h[h.length - 1].price}`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'overdue') {
            const daysOver = Math.floor((new Date(todayKey) - new Date(c.item.lentReturnBy)) / 86_400_000);
            return <Row key={i} icon={<AlertCircle size={16} strokeWidth={1.5} />} accent="bg-red-100 text-red-700"
              title={c.item.name} sub={`Lent to ${c.item.lentTo} · ${daysOver} day${daysOver === 1 ? '' : 's'} overdue`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'inspo-unanalysed') {
            return <Row key={i} icon={<Bookmark size={16} strokeWidth={1.5} />} accent="bg-stone-100 text-stone-700"
              title={`${c.total} inspiration${c.total === 1 ? '' : 's'} waiting`} sub="Open the board to analyse them with the Concierge"
              onClick={() => onOpenInspirationTab ? onOpenInspirationTab() : onOpenInspiration?.(c.inspiration.id)} />;
          }
          return null;
        })}
      </ul>
    </div>
  );
}

// Wardrobe sort options. Each defines a stable comparator over items.
// Default "recent" surfaces newly-added pieces first — the psychological
// reward of seeing your latest acquisitions when you open the app, also how
// Indyx, Whering and Stylebook default. Other modes are chosen via a sort menu.
// Favourites always float to the top within whichever mode is active — a small
// curated touch that mirrors how most native gallery apps treat starred items.

export default function TodayView({ user, items, measurements, schedules, outfits, inspirations, aiTemperature, onSaveOutfit, onLogOutfitWear, onOpenBrief, onItemClick, onEditPreferences, onOpenConcierge, onOpenInspiration, onOpenInspirationTab, onSelectCalendarDay }) {
  const [weather, setWeather] = useState(null);
  const [weatherSettled, setWeatherSettled] = useState(false);
  useEffect(() => {
    fetchTodaysWeather().then((data) => { setWeather(data); setWeatherSettled(true); });
  }, []);

  // Season (same computation WardrobeView used).
  const month = new Date().getMonth();
  const currentSeason = month <= 1 || month === 11 ? 'Winter' : month <= 4 ? 'Spring' : month <= 7 ? 'Summer' : 'Autumn';

  // The coming week's calendar events — powers the Week-strip markers and the
  // Concierge prompt's suggestion. Best-effort; silent when not connected.
  const [weekEvents, setWeekEvents] = useState([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const connected = await isCalendarConnected(user);
        if (!connected || !alive) return;
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999);
        const { events = [], reason } = await fetchCalendarEvents(start.toISOString(), end.toISOString());
        if (alive && reason !== 'revoked') setWeekEvents(events);
      } catch { /* best-effort */ }
    })();
    return () => { alive = false; };
  }, [user]);

  const ownedAvailable = items.filter((it) => it.status === 'owned' && !it.deletedAt && it.condition !== 'in_wash' && it.condition !== 'damaged');
  const weatherLabelStr = weather ? `${weather.temp}°` + (weather.precipProb != null ? ` · ${weatherLabel(weather.code, weather.precipProb)}` : '') : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Greeting + weather — weather sits beside the greeting, not stranded
          across the full width. */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="brass-rule" aria-hidden="true"></span>
        <p className="text-stone-500 text-[10px] sm:text-xs tracking-[0.28em] uppercase font-medium">
          {getGreeting()}{firstName(user) ? `, ${firstName(user)}` : ''}
        </p>
        {weatherSettled && weather && (
          <span className="text-stone-400 text-[10px] sm:text-xs tracking-[0.2em] uppercase">· {weatherLabelStr}</span>
        )}
      </div>

      {/* Daily Brief — the centrepiece */}
      <DailyBriefCard
        user={user}
        items={ownedAvailable}
        measurements={measurements}
        weather={weather}
        weatherSettled={weatherSettled}
        season={currentSeason}
        aiTemperature={aiTemperature}
        isAiEnabled={isAIEnabled()}
        onGenerateOutfit={async ({ intent, temperature, previous, calendarEvents }) => {
          return generateOutfitWithGemini({
            items,
            intent,
            weather,
            season: currentSeason,
            styleProfile: summariseStyleProfile(measurements),
            temperature,
            previousOutfit: previous ? (previous.itemIds || []).map((id) => items.find((it) => it.id === id)).filter(Boolean) : null,
            calendarEvents,
          });
        }}
        onSaveOutfit={onSaveOutfit}
        onLogOutfitWear={onLogOutfitWear}
        onOpenOutfit={onOpenBrief}
        onOpenItem={onItemClick}
        onEditPreferences={onEditPreferences}
      />

      {/* Your week */}
      <WeekStrip events={weekEvents} schedules={schedules} onSelectDay={onSelectCalendarDay} />

      {/* Ask your stylist */}
      <ConciergePrompt events={weekEvents} onOpen={onOpenConcierge} />

      {/* Daily digest — nudges (care-due, price drops, etc.) */}
      <DailyDigest
        items={items}
        outfits={outfits}
        schedules={schedules}
        inspirations={inspirations}
        onOpenItem={onItemClick}
        onOpenOutfit={onOpenBrief}
        onOpenInspiration={onOpenInspiration}
        onOpenInspirationTab={onOpenInspirationTab}
      />
    </div>
  );
}

