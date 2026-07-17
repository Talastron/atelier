import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, Bookmark, Calendar, ChevronRight, Share2, Sparkles, Star, TrendingDown } from "lucide-react";
import { fetchTodaysWeather, weatherLabel, firstName, getGreeting } from "../lib/weather.js";
import { summariseStyleProfile, todayISO, itemCareReminder, daysSinceLastWorn } from "../lib/items.js";
import { generateOutfitWithGemini } from "../lib/ai.js";
import { isCalendarConnected, fetchCalendarEvents, isAIEnabled } from "../firebase.js";
import { readDailyBrief, writeDailyBrief, clearDailyBrief, nextSlotIndex, registerInflightCompose, getInflightCompose, isComposingRecent, readRemoteDailyBrief, writeRemoteDailyBrief, readRecentBases, appendRecentBase, readRemoteRecentBases, writeRemoteRecentBases, mergeRecent } from "../dailyBrief";
import { bumpRegen, softNudgeActive } from "../lib/aiSession.js";
import { haptic } from "../lib/haptic.js";
import { useToast } from "../ui/toast.jsx";
import WeekStrip from "../components/WeekStrip.jsx";
import ItemTileImage from "../components/ItemTileImage.jsx";
import ConciergePrompt from "../components/ConciergePrompt.jsx";
import WhyThisPanel from "../components/WhyThisPanel.jsx";
import { renderTextWithChips } from "../components/ItemChip.jsx";
import EditorialHeader from "../ui/EditorialHeader.jsx";
import { hasClothingBase, isClothingBase } from "../lib/outfit.js";

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


// The freshness nudge tracks only a look's CLOTHING BASE — shoes, bags and
// jewellery are free to repeat day to day (and are what already vary).
// isClothingBase comes from lib/outfit.js, the same source the prompt's base
// block uses, so what we RECORD as a base can't drift from what the model is
// TOLD is a base.
function baseIdsOf(itemIds = [], items = []) {
  return (itemIds || []).filter((id) => isClothingBase(items.find((it) => it.id === id)));
}

// Flatten the stored history to the actual item objects the prompt names.
// ORDER IS LOAD-BEARING: the prompt renders these under a "most recent day
// first" header and tells the model to prefer the LEAST recent when it has to
// repeat. mergeRecent returns newest-first, and flatMap/Set/map all preserve
// that order — do NOT sort or group these. Ids that no longer resolve (piece
// deleted since) are dropped.
function resolveRecentItems(recent = [], items = []) {
  const ids = [...new Set(recent.flatMap((entry) => entry.baseIds || []))];
  return ids.map((id) => items.find((it) => it.id === id)).filter(Boolean);
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
  onOpenSavedLook = null,  // optional: after saving, jump to the saved look's
                            // detail page (OutfitDetailView) by id — distinct
                            // from onOpenOutfit, which seeds the Styling Studio.
  onOpenItem = null,  // optional: tap a chip → open that item's detail view
  onEditPreferences,  // optional: jumps to Profile → Style so the user can
                       // change palette / formality / temperament from the
                       // "What the Concierge saw" capsule.
  onExportOutfit = null,  // optional: opens the same editorial ShareLookModal
                           // used from the Lookbook/OutfitDetailView — works
                           // as-is on today's brief object even though it's
                           // not yet a saved outfit (no .id needed).
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
  // Id of the look once saved, so the confirmation button can jump straight to
  // its detail page instead of making the user hunt for it in the Lookbook.
  const [savedOutfitId, setSavedOutfitId] = useState(null);
  const [wearState, setWearState] = useState('idle'); // idle | wearing | done
  // Cross-device: has the Firestore-shared brief been checked yet? Gates the
  // auto-compose so a device doesn't compose locally before learning another
  // device already composed today's shared look.
  const [remoteChecked, setRemoteChecked] = useState(false);
  // Freshness history — the recent clothing bases, so the compose can steer off
  // them. Local first (instant), then merged with the Firestore copy so the
  // nudge is consistent whichever device composes. `historyChecked` gates the
  // auto-compose below for the same reason `remoteChecked`/`calendarReady` do:
  // composing before the shared history lands would nudge off an incomplete
  // picture and repeat a base another device already used today.
  const [recentBases, setRecentBases] = useState(() => readRecentBases(uid));
  const [historyChecked, setHistoryChecked] = useState(false);
  useEffect(() => {
    if (!user) { setHistoryChecked(true); return; }
    let alive = true;
    (async () => {
      try {
        const remote = await readRemoteRecentBases(uid);
        // Remote first — Firestore wins a same-day tie (see mergeRecent).
        if (alive && remote.length) setRecentBases((local) => mergeRecent(remote, local));
      } finally {
        if (alive) setHistoryChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [uid, user]);

  // Record a composed look's base so tomorrow steers away from it. Seeds from
  // `recentBases` (the Firestore-merged view), NOT this device's localStorage —
  // otherwise a device with a cold cache would rebuild the list from empty and
  // overwrite the shared history it just loaded. Local write is synchronous and
  // authoritative for this device; the Firestore push shares it with the rest.
  const recordBase = (out) => {
    const next = appendRecentBase(uid, baseIdsOf(out?.itemIds, items), undefined, recentBases);
    setRecentBases(next);
    // Only push once the shared history has landed. Before that, `next` is
    // seeded from this device's local view alone, so pushing it would overwrite
    // remote-only entries (a pre-feature user has NO local history, so a re-roll
    // during the loader's getDoc would clobber the shared list with today's base
    // alone). The local append still stands, and the next record — after the
    // loader merges remote into state — pushes the full list. Auto-compose is
    // unaffected: it's gated on historyChecked, so this is always true there.
    if (historyChecked) writeRemoteRecentBases(uid, next);
  };
  useEffect(() => { setSaveState('idle'); setWearState('idle'); setSavedOutfitId(null); }, [brief?.savedAt]);

  // One-time validation of the cached brief: if today's cached look has no
  // clothing base (e.g. it was composed before the clothing-base guarantee, or
  // is an accessories-only result), discard it so the day re-composes through
  // the current pipeline — which always injects a garment. Runs once so a
  // genuinely clothing-less wardrobe can't loop.
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current) return;
    if (!brief || !(items?.length)) return;
    validatedRef.current = true;
    if (!hasClothingBase(brief.itemIds, items)) {
      clearDailyBrief(uid);
      setBrief(null);
    }
  }, [brief, items, uid]);

  // Cross-device sync: if this device has no local brief for today, check the
  // Firestore-shared one. If another device already composed today's look,
  // adopt it (and cache locally) rather than composing a second, different one.
  useEffect(() => {
    if (!user) { setRemoteChecked(true); return; }
    if (readDailyBrief(uid)) { setRemoteChecked(true); return; } // already have today's locally
    let alive = true;
    (async () => {
      try {
        const remote = await readRemoteDailyBrief(uid);
        if (alive && remote) setBrief(writeDailyBrief(uid, remote));
      } catch { /* offline — fall through to a local compose */ }
      finally { if (alive) setRemoteChecked(true); }
    })();
    return () => { alive = false; };
  }, [uid, user]);

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
    // Wait until the Firestore-shared brief has been checked, so we don't
    // compose a second, different look when another device already composed
    // today's shared one.
    if (!remoteChecked) return;
    // Likewise wait for the shared freshness history: composing before it lands
    // would steer off an incomplete picture and could repeat a base another
    // device already used. This only ever DELAYS a compose — it sits after the
    // other readiness gates and before the dedup below, so it can't duplicate one.
    if (!historyChecked) return;
    // Reload backstop: a recent composing marker with NO in-memory in-flight
    // promise means a hard page reload interrupted a compose — skip so we don't
    // fire a duplicate paid call. (Same-session re-runs still hold the inflight
    // promise, so they fall through to the dedup below and set the brief.)
    if (isComposingRecent(uid) && !getInflightCompose(uid)) return;
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
        recentLooks: resolveRecentItems(recentBases, items),
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a considered look for today', slotIndex: 0 });
      writeRemoteDailyBrief(uid, saved); // publish to Firestore so other devices show the same look (best-effort)
      recordBase(out);
      return saved;
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
  }, [uid, isAiEnabled, items?.length, weatherSettled, calendarReady, remoteChecked, historyChecked]); // re-fires when weather, calendar, the shared-brief check AND the freshness history resolve

  // Not gated on `historyChecked` (unlike the auto-compose): we won't delay a
  // user-initiated action for a cosmetic nudge. A re-roll before the shared
  // history lands records locally and defers its push (see recordBase).
  async function composeAnother() {
    setLoading(true);
    setError(null);
    bumpRegen(); // counts re-rolls toward the gentle "save one you love" nudge
    try {
      const slot = nextSlotIndex(uid);
      const out = await onGenerateOutfit({
        intent: 'a different considered look for today',
        temperature: aiTemperature,
        slotIndex: slot,
        previous: brief,
        calendarEvents,
        recentLooks: resolveRecentItems(recentBases, items),
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a different considered look for today', slotIndex: slot });
      writeRemoteDailyBrief(uid, saved); // a re-roll becomes the new shared look across devices
      recordBase(out); // a re-roll replaces today's recorded base (same dateKey)
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

  // Lookbook tiles — ALL pieces shown at equal size on one aligned grid (the
  // marketing site's OutfitPreview language). Clothing leads (briefItems is already
  // clothing-first sorted), then accessories; jewellery collapses into one "stack"
  // tile when there are 2+ so it doesn't overrun the grid. Equal sizing is what
  // gives clean alignment with no ragged whitespace — emphasis comes from order +
  // the brass caption, not size.
  const GARMENT_CATS = new Set(['Dresses', 'Tops', 'Bottoms', 'Outerwear', 'Sportswear', 'Swimwear']);
  const imgOf = (it) => it?.images?.[0] || it?.imageUrl || null;
  // Jewellery gets its own full-width strip below the board — several small
  // pieces need room to be visible. The board shows garments + the other
  // accessories (shoes, bags, sunglasses…).
  const mainTiles = briefItems.filter((it) => it.category !== 'Jewellery').slice(0, 8);
  const jewelleryPieces = briefItems.filter((it) => it.category === 'Jewellery').slice(0, 10);

  const conf = brief.confidence;

  // A short, honest lead line from data we already hold — the dense rationale
  // moves behind "Why this".
  const leadLine = weather
    ? `A considered look for ${weather.temp}°, ${weatherLabel(weather.code, weather.precipProb)}${season ? ` · ${season.toLowerCase()}` : ''}.`
    : 'A considered look for today.';

  // Slim "on today" footer — ties the brief to the day's most demanding event.
  const leadEvent = (calendarEvents || [])[0] || null;
  const eventTime = leadEvent && !leadEvent.allDay
    ? new Date(leadEvent.startISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : leadEvent ? 'All day' : null;

  const openBrief = () => onOpenOutfit?.(brief);

  // One outfit tile (white flat-lay card + caption), extracted so the desktop
  // outfit-board and the mobile grid share exactly one implementation.
  const renderLookCard = (t, i, widthCls) => {
    const garment = GARMENT_CATS.has(t.category);
    const eyebrow = t.subCategory || t.category;
    return (
      <button
        key={t.id}
        type="button"
        onClick={openBrief}
        className={`animate-in group flex ${widthCls} flex-col gap-2 text-left`}
        style={{ animationDelay: `${i * 60}ms` }}
        aria-label={`Open ${t.name} in today's look`}
      >
        <div className="rounded-2xl bg-white smooth-shadow border border-stone-200/50 p-2.5 sm:p-3">
          <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white">
            {imgOf(t) ? (
              <ItemTileImage item={t} alt={t.name} zoomOnHover />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-stone-400">{t.category}</div>
            )}
          </div>
        </div>
        <div>
          <p className={`text-[9px] font-medium uppercase tracking-[0.18em] ${garment ? 'text-brass-600' : 'text-stone-500'}`}>{eyebrow}</p>
          <p className="mt-0.5 truncate font-display text-[13px] leading-snug text-stone-800">{t.name}</p>
        </div>
      </button>
    );
  };


  const handleWearThis = async () => {
    if (!brief.itemIds?.length) return;
    if (wearState !== 'idle') return; // already in flight or done — block double-tap
    haptic('tap');
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
      haptic('success');
      toast?.show?.(`Logged today's wear · ${briefItems.length} pieces`, { kind: 'success' });
      // Slight delay so the user sees confirmation before the card disappears
      setTimeout(() => {
        clearDailyBrief(uid);
        setBrief(null);
      }, 700);
    } catch (err) {
      setWearState('idle');
      haptic('error');
      toast?.show?.(err?.message || 'Could not log wear.', { kind: 'error' });
    }
  };

  const handleSaveAsLook = async () => {
    if (!brief.itemIds?.length) return;
    if (saveState !== 'idle') return; // already saved (or saving) — prevent dupes
    haptic('tap');
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
      setSavedOutfitId(outfit.id);
      setSaveState('saved');
      haptic('success');
      toast?.show?.('Saved to your Lookbook', { kind: 'success' });
    } catch (err) {
      setSaveState('idle');
      haptic('error');
      toast?.show?.(err?.message || 'Could not save.', { kind: 'error' });
    }
  };

  return (
    <div className="rounded-3xl border border-stone-200/60 bg-[#f4efe6] p-6 sm:p-8">
      {/* Section headline only — the page header above already carries the
          greeting + weather, so the card doesn't repeat an eyebrow or the
          weather line (that read as duplication). */}
      <h3 className="font-display text-2xl sm:text-3xl text-stone-900">Styled for today.</h3>

      {/* The look — equal tiles on one aligned grid, clothing first, captioned,
          LEFT-aligned with the headline. Flat tiles, object-cover (no seams). */}
      {/* Editorial flat-lay: white item cards lift off the card's own warm ivory
          surface — no nested panel (the card IS the ivory ground). Garments
          anchor as a hero row; jewellery gets its own strip below. */}
      <div className="mt-5">
        {/* Mobile: reliable 2-column grid (an odd last piece sits bottom-left —
            standard, and far better than the mis-sized flex that stacked
            everything one-per-row). */}
        <div className="grid grid-cols-2 gap-3 sm:hidden">
          {mainTiles.map((t, i) => renderLookCard(t, i, 'w-full'))}
        </div>
        {/* Desktop: one centred row on a common baseline — garments are the
            larger hero tier, the other accessories a medium supporting size.
            Jewellery has its own strip below, so the main row stays short enough
            to sit on one line without ragged wrapping. */}
        <div className="hidden sm:flex sm:flex-wrap sm:items-end sm:justify-center sm:gap-5">
          {mainTiles.map((t, i) => renderLookCard(
            t,
            i,
            GARMENT_CATS.has(t.category) ? 'w-[clamp(180px,20vw,244px)]' : 'w-[clamp(150px,16vw,200px)]',
          ))}
        </div>

        {/* Jewellery — its own full-width strip so several small pieces stay
            visible and grouped (labelled by count), rather than tiny or hidden
            inside a shared tile. */}
        {jewelleryPieces.length > 0 && (
          <div className="mt-4 border-t border-stone-200/60 pt-4">
            <p className="mb-2.5 px-0.5 text-[9px] font-medium uppercase tracking-[0.2em] text-brass-600">
              Jewellery · {jewelleryPieces.length} {jewelleryPieces.length === 1 ? 'piece' : 'pieces'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {jewelleryPieces.map((j, i) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={openBrief}
                  className="animate-in group w-[clamp(140px,15vw,180px)]"
                  style={{ animationDelay: `${i * 50}ms` }}
                  aria-label={`Open ${j.name} in today's look`}
                >
                  <div className="aspect-square overflow-hidden rounded-2xl bg-white smooth-shadow border border-stone-200/50 p-3">
                    {imgOf(j) ? <ItemTileImage item={j} alt={j.name} zoomOnHover /> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stylist's note — a warm, gently recessed panel (deeper than the ivory
          ground, no shadow) so it reads as a calm secondary reading block below
          the floating product tiles. Narrative on
          the left, the confidence figure on the right. */}
      <div className="mt-7 flex flex-col gap-4 rounded-2xl bg-[#efe8db] p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
        <Sparkles size={20} strokeWidth={1.4} className="hidden shrink-0 text-brass-500 sm:block" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">Stylist's note</p>
          <p className="mt-1.5 text-sm italic leading-relaxed text-stone-700">{renderTextWithChips(brief.reasoning, { items, onOpenItem })}</p>
          <button
            onClick={() => setWhyOpen(o => !o)}
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-stone-500 underline-offset-4 hover:text-stone-800"
          >
            <ChevronRight size={13} strokeWidth={1.5} className={`transition-transform ${whyOpen ? 'rotate-90' : ''}`} />
            {whyOpen ? 'Hide details' : 'What the Concierge saw'}
          </button>
          {whyOpen && (
            <div className="animate-in mt-3">
              <WhyThisPanel
                weather={weather}
                season={season}
                styleProfile={measurements}
                temperature={aiTemperature}
                itemCount={items?.length ?? 0}
                onEditPreferences={onEditPreferences}
              />
            </div>
          )}
        </div>
        {conf != null && (
          <div className="shrink-0 border-stone-200 sm:border-l sm:pl-6 sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">Confidence</p>
            <p className="mt-0.5 font-display text-3xl leading-none text-stone-900" style={{ fontFeatureSettings: '"onum" on' }}>
              {conf}<span className="text-base text-stone-400">%</span>
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleWearThis}
          disabled={wearState !== 'idle'}
          className="rounded-full bg-stone-900 px-5 py-2.5 text-sm text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {wearState === 'wearing' ? 'Logging…' : wearState === 'done' ? '✓ Logged' : 'Wear this'}
        </button>
        <button
          type="button"
          onClick={composeAnother}
          disabled={loading}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          {loading ? 'Composing…' : 'Compose another'}
        </button>
        {saveState === 'saved' && onOpenSavedLook && savedOutfitId ? (
          // Saved: the button turns into a one-tap jump to the look's detail
          // page, so the user never has to hunt for it in the Lookbook.
          <button
            type="button"
            onClick={() => onOpenSavedLook(savedOutfitId)}
            className="rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            ✓ Saved · View look →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSaveAsLook}
            disabled={saveState !== 'idle'}
            className={`rounded-full border px-5 py-2.5 text-sm transition-colors disabled:cursor-not-allowed ${
              saveState === 'saved'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-stone-300 hover:bg-stone-50 disabled:opacity-60'
            }`}
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved to Lookbook' : 'Save as a Look'}
          </button>
        )}
        {onExportOutfit && (
          <button
            type="button"
            onClick={() => onExportOutfit(brief)}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm transition-colors hover:bg-stone-50 inline-flex items-center gap-2"
            title="Preview, then share or save this look — Pinterest and Instagram ready"
          >
            <Share2 size={15} strokeWidth={1.5} />
            Share
          </button>
        )}
      </div>

      {softNudgeActive() && (
        <p className="mt-3 text-xs italic text-stone-400">
          You've composed a few looks today — when one feels right, save it to your Lookbook.
        </p>
      )}

      {/* On today — ties the brief to the day's calendar */}
      {leadEvent && (
        <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-stone-100 pt-4">
          <Calendar size={15} strokeWidth={1.5} className="text-brass-500" />
          <span className="text-xs uppercase tracking-[0.16em] text-stone-400">On today</span>
          <span className="text-sm text-stone-700">{eventTime} · {leadEvent.title}</span>
          {calendarEvents.length > 1 && (
            <span className="ml-auto text-[11px] text-stone-400">dressed for the day's most demanding moment</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Home-screen tile: at-a-glance weather summary + tomorrow's planned outfit.
// Compose functionality lives exclusively in the Daily Brief card above — this
// tile is a quiet information strip, not a second compose surface.

function DailyDigest({ items, schedules, inspirations = [], onOpenItem, onOpenInspiration, onOpenInspirationTab }) {
  const owned = items.filter((i) => i.status === 'owned');
  const todayKey = todayISO();
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

  // Care due
  const careDue = owned.map((i) => ({ i, r: itemCareReminder(i) })).filter((x) => x.r?.due).slice(0, 3);

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
  for (const { i, r } of careDue) cards.push({ kind: 'care', item: i, reminder: r });
  if (staleFav) cards.push({ kind: 'stale-fav', item: staleFav });
  for (const i of drops) cards.push({ kind: 'price-drop', item: i });
  for (const i of overdueLent) cards.push({ kind: 'overdue', item: i });
  if (showInspoNudge) cards.push({ kind: 'inspo-unanalysed', inspiration: unanalysedInspos[0], total: unanalysedInspos.length });

  if (cards.length === 0) return null;

  return (
    <div className="rounded-3xl border border-stone-200/70 bg-white p-6 sm:p-7 smooth-shadow">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg sm:text-xl text-stone-900">Needs attention</h3>
        <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{cards.length} item{cards.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="space-y-1">
        {cards.map((c, i) => {
          const Row = ({ icon, accent, title, sub, onClick }) => (
            <li>
              <button onClick={onClick}
                className="w-full flex items-center gap-3 text-left py-2 px-2 -mx-2 rounded-xl hover:bg-stone-100 transition-colors">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 truncate">{title}</p>
                  <p className="text-[11px] text-stone-500 truncate">{sub}</p>
                </div>
                <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0" />
              </button>
            </li>
          );
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

export default function TodayView({ user, items, measurements, schedules, outfits, inspirations, aiTemperature, onSaveOutfit, onLogOutfitWear, onOpenBrief, onOpenSavedLook, onItemClick, onEditPreferences, onOpenConcierge, onOpenInspiration, onOpenInspirationTab, onSelectCalendarDay, onExportOutfit }) {
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
  const todayStandfirst = weather
    ? `${weatherLabel(weather.code, weather.precipProb)} and ${weather.temp}° — your day, considered.`
    : 'Your day, considered.';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Editorial page header — uses the SAME shared component as Studio /
          Lookbook, so the title sizing and eyebrow are identical across pages.
          The greeting is the title; the weather rides the (small) standfirst. */}
      <EditorialHeader
        eyebrow="Today"
        title={`${getGreeting()}${firstName(user) ? `, ${firstName(user)}` : ''}.`}
        subtitle={todayStandfirst}
      />

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
        onGenerateOutfit={async ({ intent, temperature, previous, calendarEvents, recentLooks }) => {
          return generateOutfitWithGemini({
            // Owned pieces only — using the raw `items` (owned + wishlist)
            // let the model build "today's look" partly out of something
            // not yet bought. hasClothingBase/ensureClothingBase then saw a
            // valid top+bottom pair (because the wishlist item resolved fine
            // against the full list) and let it through — but DailyBriefCard
            // itself only ever renders against ownedAvailable, so the
            // wishlist piece silently failed to resolve and vanished from
            // the card, leaving what looked like a top with no bottom.
            items: ownedAvailable,
            intent,
            weather,
            season: currentSeason,
            styleProfile: summariseStyleProfile(measurements),
            temperature,
            previousOutfit: previous ? (previous.itemIds || []).map((id) => ownedAvailable.find((it) => it.id === id)).filter(Boolean) : null,
            calendarEvents,
            recentLooks,
          });
        }}
        onSaveOutfit={onSaveOutfit}
        onLogOutfitWear={onLogOutfitWear}
        onOpenOutfit={onOpenBrief}
        onOpenSavedLook={onOpenSavedLook}
        onOpenItem={onItemClick}
        onEditPreferences={onEditPreferences}
        onExportOutfit={onExportOutfit}
      />

      {/* Ask your stylist — a slim concierge bar directly under the hero (it only
          opens the stylist sidebar, so it's a line, not a panel). */}
      <ConciergePrompt events={weekEvents} onOpen={onOpenConcierge} />

      {/* Two-up: the week ahead beside what needs attention — content-sized columns
          rather than two ballooned full-width cards. Flex (not grid) so that if
          "Needs attention" renders nothing, the week strip grows to full width
          instead of leaving a dead column. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch [&>*]:min-w-0 lg:[&>*]:flex-1">
        <WeekStrip events={weekEvents} schedules={schedules} outfits={outfits} onSelectDay={onSelectCalendarDay} onOpenOutfit={onOpenBrief} />
        <DailyDigest
          items={items}
          schedules={schedules}
          inspirations={inspirations}
          onOpenItem={onItemClick}
          onOpenInspiration={onOpenInspiration}
          onOpenInspirationTab={onOpenInspirationTab}
        />
      </div>
    </div>
  );
}

