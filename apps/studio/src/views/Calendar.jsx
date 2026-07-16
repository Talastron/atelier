import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Calendar, ChevronRight, Copy, Download, Plus, Printer, Shirt, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { itemImages, itemWearHistory, itemWearNotes, resolveOutfitItems, todayISO, newId } from "../lib/items.js";
import { itemImageDisplay } from "../lib/polish.js";
import ItemTileImage from "../components/ItemTileImage.jsx";
import { weatherLabel, fetchTravelForecast } from "../lib/weather.js";
import { generateTravelCapsuleWithGemini, regenerateTravelDayWithGemini } from "../lib/ai.js";
import { fetchCalendarEvents, isAIEnabled } from "../firebase.js";
import { useToast } from "../ui/toast.jsx";
import { useEscapeKey, useCountUp } from "../ui/hooks.js";
import { renderTextWithChips } from "../components/ItemChip.jsx";

// One stat tile inside the Diary header strip — number counts up from 0
// on mount via useCountUp(). Suffix is the "days" / "wears" qualifier
// rendered small + grey beside the number. Extracted as its own
// component so each useCountUp() call has its own animation lifecycle
// and the parent doesn't re-render on every animation frame.
function DiaryStatTile({ eyebrow, value, suffix, tone = 'default', children }) {
  const animated = useCountUp(value);
  const numberClass = tone === 'brass' && value > 0 ? 'text-brass-600' : tone === 'dim' ? 'text-stone-300' : 'text-stone-900';
  return (
    <div>
      <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-2">{eyebrow}</p>
      {children || (
        <p className={`font-display text-3xl sm:text-4xl leading-none ${numberClass}`}>
          {animated}
          {suffix && <span className="text-xs text-stone-500 font-sans ml-1.5 align-middle">{suffix}</span>}
        </p>
      )}
    </div>
  );
}

function buildPackingListHtml({ startLabel, endLabel, totalDays, totalPieces, categorySections }) {
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Packing list · ${esc(startLabel)} → ${esc(endLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 24mm 18mm; }
    body { margin: 0; background: #fff; color: #1c1917; font-family: 'Playfair Display', Georgia, serif; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 0 12mm; }
    .header { border-bottom: 1px solid #e7e5e4; padding-bottom: 24px; margin-bottom: 32px; }
    .header .brass { display: inline-block; width: 36px; height: 3px; background-color: #C9A66B; vertical-align: middle; margin-right: 14px; }
    .header .eyebrow { font-family: Jost, sans-serif; font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: #57534e; vertical-align: middle; }
    .header h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 36px; line-height: 1.1; margin: 16px 0 8px; font-weight: 500; }
    .header .dates { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 16px; color: #78716c; margin: 0; }
    .header .meta { font-family: Jost, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #a8a29e; margin-top: 14px; }
    .footer { border-top: 1px solid #e7e5e4; padding-top: 16px; margin-top: 40px; display: flex; justify-content: space-between; align-items: baseline; }
    .footer .brand { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 16px; color: #1c1917; }
    .footer .note { font-family: Jost, sans-serif; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #a8a29e; }
    @media print { .no-print { display: none !important; } }
    .no-print { position: fixed; top: 16px; right: 16px; background: #1c1917; color: white; padding: 10px 18px; border-radius: 999px; font-family: Jost, sans-serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; border: none; }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Print or save as PDF</button>
  <div class="wrap">
    <header class="header">
      <div>
        <span class="brass"></span>
        <span class="eyebrow">Packing list</span>
      </div>
      <h1>${esc(startLabel)} → ${esc(endLabel)}</h1>
      <p class="dates">${totalDays} day${totalDays === 1 ? '' : 's'} away</p>
      <p class="meta">${totalPieces} piece${totalPieces === 1 ? '' : 's'} to pack</p>
    </header>
    ${categorySections}
    <footer class="footer">
      <span class="brand">myatelier.style</span>
      <span class="note">Generated ${esc(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
    </footer>
  </div>
  <script>
    (function() {
      var print = function() { try { window.print(); } catch (e) {} };
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() { setTimeout(print, 150); });
      } else {
        setTimeout(print, 600);
      }
    })();
  </script>
</body>
</html>`;
}

function downloadIcs(filename, schedules, outfits, items) {
  const events = [];
  for (const [date, sched] of Object.entries(schedules || {})) {
    if (!sched?.outfitId) continue;
    const outfit = outfits.find((o) => o.id === sched.outfitId);
    if (!outfit) continue;
    const pieces = resolveOutfitItems(outfit, items).map((p) => `${p.name} (${p.brand || '?'})`).join('\\, ');
    const d = date.replace(/-/g, '');
    const next = new Date(date + 'T00:00:00'); next.setDate(next.getDate() + 1);
    const dEnd = next.toISOString().slice(0, 10).replace(/-/g, '');
    const uid = `atelier-${sched.outfitId}-${date}@my-digital-wardrobe`;
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    events.push([
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${dEnd}`,
      `SUMMARY:👗 ${outfit.name}`,
      `DESCRIPTION:${pieces || 'Planned outfit'}\\n— from Atelier`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    ].join('\r\n'));
  }
  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atelier//Digital Wardrobe//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Atelier · Planned outfits',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([cal], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

const TRAVEL_ACTIVITIES = [
  { id: 'sightseeing', label: 'Sightseeing / walking', hint: 'comfortable shoes, layerable' },
  { id: 'dinner', label: 'Dinner / restaurants', hint: 'at least one polished evening look' },
  { id: 'beach', label: 'Beach / pool', hint: 'swimwear, cover-ups, sandals' },
  { id: 'cocktails', label: 'Cocktails / nightlife', hint: 'evening dress or smart separates' },
  { id: 'business', label: 'Business meetings', hint: 'blazer, smart trousers, polished shoes' },
  { id: 'gallery', label: 'Gallery / museum', hint: 'considered, easy-on-feet' },
  { id: 'hiking', label: 'Hiking / outdoors', hint: 'sturdy shoes, weather-appropriate outerwear' },
  { id: 'formal', label: 'Wedding / formal event', hint: 'one occasion look' },
  { id: 'sport', label: 'Sport / gym', hint: 'sportswear' },
  { id: 'family', label: 'Family time / casual', hint: 'easy, machine-washable' },
];

function TripDetailView({ trip, outfits, items, schedules, onClose, onOpenOutfit, onDeleteTrip = null }) {
  useEscapeKey(onClose);
  const [packingOpen, setPackingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tripOutfits = trip.days
    .map((d) => ({ dateISO: d.dateISO, outfit: outfits.find((o) => o.id === d.outfitId) }))
    .filter((d) => d.outfit);

  const totalDays = trip.days.length;
  const totalPieces = new Set(tripOutfits.flatMap((d) => d.outfit.itemIds || [])).size;

  const startLabel = new Date(trip.startISO + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const endLabel = new Date(trip.endISO + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return createPortal(
    <div className="fixed inset-0 bg-[#F7F5F2] z-50 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      {/* Sticky top bar. This overlay is its own scroll container with no top
          padding, so — unlike the in-<main> views — the safe-area inset belongs
          HERE, via pt-safe (matches the item-detail overlay pattern). Keeps the
          bar clear of the translucent status bar in standalone/PWA. */}
      <div className="sticky top-0 z-10 bg-[#F7F5F2]/85 backdrop-blur-md border-b border-stone-200/60 pt-safe">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-3 sm:p-4 lg:p-6 gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 pl-2 pr-3 sm:pl-3 sm:pr-4 py-2 rounded-full text-xs sm:text-sm tracking-wide text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 transition-colors"
          >
            <ChevronRight size={16} strokeWidth={1.5} className="rotate-180" />
            <span className="hidden sm:inline">Back to Trips</span>
            <span className="sm:hidden">Back</span>
          </button>
          <div className="flex items-center gap-2">
            {onDeleteTrip && (
              <button
                type="button"
                onClick={() => { if (confirmDelete) { onDeleteTrip(); } else { setConfirmDelete(true); } }}
                onBlur={() => setConfirmDelete(false)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] tracking-wide transition-colors ${confirmDelete ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-stone-200 text-stone-500 hover:border-red-300 hover:text-red-600'}`}
                title={`${trip.days?.length || 0} planned day${(trip.days?.length || 0) === 1 ? '' : 's'} will be removed`}
              >
                <Trash2 size={14} strokeWidth={1.5} />
                {confirmDelete ? 'Confirm delete' : 'Delete trip'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPackingOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-white text-[12px] tracking-wide hover:bg-stone-700 transition-colors"
            >
              <Download size={14} strokeWidth={1.5} />
              View packing list
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-12">
        {/* Editorial header */}
        <header className="mb-10 sm:mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">
              {trip.status === 'active' ? 'Active trip' : trip.status === 'upcoming' ? 'Upcoming trip' : 'Past trip'}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display text-stone-900 tracking-tight leading-[1.05]">
            {trip.name}
          </h1>
          {trip.location && (
            <p className="font-display italic text-stone-500 text-base sm:text-lg mt-3">{trip.location}</p>
          )}
          <p className="text-[11px] text-stone-500 mt-3 tracking-[0.18em] uppercase">
            {startLabel} → {endLabel}
          </p>
          <p className="text-[10px] text-stone-400 mt-1 tracking-wide">
            {totalDays} day{totalDays === 1 ? '' : 's'} · {totalPieces} piece{totalPieces === 1 ? '' : 's'} packed · {tripOutfits.length} outfit{tripOutfits.length === 1 ? '' : 's'}
          </p>
        </header>

        {/* Day-by-day section header */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <span className="brass-rule" aria-hidden="true"></span>
          <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Day by day</span>
        </div>

        {tripOutfits.length === 0 ? (
          <p className="text-stone-400 text-sm italic">No outfits planned for this trip yet.</p>
        ) : (
          <div className="space-y-5">
            {tripOutfits.map(({ dateISO, outfit }) => {
              const pieces = resolveOutfitItems(outfit, items);
              const dayLabel = new Date(dateISO + 'T00:00:00').toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              });
              return (
                <button
                  key={dateISO}
                  type="button"
                  onClick={() => onOpenOutfit?.(outfit.id)}
                  className="w-full text-left bg-white border border-stone-200/60 rounded-2xl p-4 sm:p-5 hover:border-stone-500 transition-colors flex items-center gap-4 group"
                >
                  <div className="flex gap-1.5 shrink-0">
                    {pieces.slice(0, 4).map((it) => {
                      return (
                        <div key={it.id} className="w-12 h-14 sm:w-14 sm:h-16 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                          <ItemTileImage item={it} alt="" />
                        </div>
                      );
                    })}
                    {pieces.length > 4 && (
                      <div className="w-12 h-14 sm:w-14 sm:h-16 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-[10px] tracking-wide text-stone-500">
                        +{pieces.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] tracking-widest uppercase text-stone-400">{dayLabel}</p>
                    <p className="font-display text-stone-900 text-base sm:text-lg leading-tight truncate group-hover:text-brass-700 transition-colors mt-0.5">
                      {outfit.name}
                    </p>
                    <p className="text-[10px] tracking-wide uppercase text-stone-500 mt-1">
                      {pieces.length} piece{pieces.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-stone-400 shrink-0 group-hover:text-stone-700 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {packingOpen && (
        <PackingListModal
          startISO={trip.startISO}
          endISO={trip.endISO}
          schedules={schedules}
          outfits={outfits}
          items={items}
          onPlanWithConcierge={null}
          onClose={() => setPackingOpen(false)}
        />
      )}
    </div>,
    document.body
  );
}

function WearCalendar({ items, outfits = [], schedules = {}, onScheduleOutfit, onOpenOutfit, onSaveOutfit, styleProfile = '', onOpenItem = null, autoActivateRangeMode = false, initialSelectedDate = null, planTripNonce = 0 }) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    initialSelectedDate
      ? { year: Number(initialSelectedDate.slice(0, 4)), month: Number(initialSelectedDate.slice(5, 7)) - 1 }
      : { year: today.getFullYear(), month: today.getMonth() }
  );
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate || null);
  useEffect(() => {
    // Deep-link: re-select when the parent hands us a new date (Week strip).
    if (initialSelectedDate) {
      setSelectedDate(initialSelectedDate);
      setCursor({ year: Number(initialSelectedDate.slice(0, 4)), month: Number(initialSelectedDate.slice(5, 7)) - 1 });
    }
  }, [initialSelectedDate]);
  const [schedulingDate, setSchedulingDate] = useState(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [packingOpen, setPackingOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);
  const [showRangeHint, setShowRangeHint] = useState(false);
  const toast = useToast();

  const [dayEvents, setDayEvents] = useState([]);
  const [calendarOff, setCalendarOff] = useState(false); // true once we learn calendar isn't connected/available — stops retrying this session
  const eventCacheRef = useRef({}); // { 'YYYY-MM-DD': [events] } — per-session cache so re-selecting a day doesn't refetch

  useEffect(() => {
    if (!selectedDate || calendarOff) { setDayEvents([]); return; }
    const cached = eventCacheRef.current[selectedDate];
    if (cached) { setDayEvents(cached); return; }
    let alive = true;
    (async () => {
      try {
        const startISO = new Date(selectedDate + 'T00:00:00').toISOString();
        const endISO = new Date(selectedDate + 'T23:59:59').toISOString();
        const { events = [], reason } = await fetchCalendarEvents(startISO, endISO);
        if (!alive) return;
        if (reason === 'revoked') { setCalendarOff(true); setDayEvents([]); return; }
        eventCacheRef.current[selectedDate] = events;
        setDayEvents(events);
      } catch (err) {
        if (!alive) return;
        // 'failed-precondition' = not connected. Any error → stop trying this session, hide the block.
        setCalendarOff(true);
        setDayEvents([]);
      }
    })();
    return () => { alive = false; };
  }, [selectedDate, calendarOff]);

  useEffect(() => {
    if (autoActivateRangeMode) {
      setRangeMode(true);
      setRangeStart(null);
      setRangeEnd(null);
      setSelectedDate(null);
      setShowRangeHint(true);
      setTimeout(() => {
        const el = document.querySelector('[data-calendar-root]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      // Auto-dismiss the hint after 8s
      setTimeout(() => setShowRangeHint(false), 8000);
    }
  }, [autoActivateRangeMode]);

  // Re-fires each time the parent's "Plan a trip" is tapped (nonce changes),
  // so range-select reopens even if the calendar is already showing.
  useEffect(() => {
    if (planTripNonce > 0) {
      setRangeMode(true);
      setRangeStart(null);
      setRangeEnd(null);
      setSelectedDate(null);
      setShowRangeHint(true);
      const t = setTimeout(() => setShowRangeHint(false), 8000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [planTripNonce]);

  const toggleRangeMode = () => {
    setRangeMode((on) => !on);
    setRangeStart(null); setRangeEnd(null);
    setSelectedDate(null);
  };
  const pickRangeDate = (iso) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(iso); setRangeEnd(null);
    } else if (iso < rangeStart) {
      setRangeStart(iso);
    } else {
      setRangeEnd(iso);
    }
  };
  const inRange = (iso) => rangeStart && (iso === rangeStart || (rangeEnd && iso >= rangeStart && iso <= rangeEnd));

  const handleCopyPrev = async () => {
    if (!selectedDate) return;
    const prev = new Date(selectedDate + 'T00:00:00');
    prev.setDate(prev.getDate() - 1);
    const prevISO = prev.toISOString().slice(0, 10);
    const prevSched = schedules[prevISO];
    if (!prevSched?.outfitId) { toast.show('Nothing planned yesterday', { kind: 'default' }); return; }
    await onScheduleOutfit(selectedDate, prevSched.outfitId);
  };
  const handleRepeatWeek = async () => {
    if (!selectedDate) return;
    const base = new Date(selectedDate + 'T00:00:00');
    const sched = schedules[selectedDate];
    if (!sched?.outfitId) { toast.show('Plan a look for this day first', { kind: 'default' }); return; }
    for (let i = 1; i <= 6; i++) {
      const next = new Date(base);
      next.setDate(next.getDate() + i);
      const iso = next.toISOString().slice(0, 10);
      if (!schedules[iso]) await onScheduleOutfit(iso, sched.outfitId);
    }
    toast.show('Repeated for the week', { kind: 'success' });
  };

  // Map each ISO date → items worn that day.
  const wearsByDate = {};
  for (const item of items) {
    for (const d of itemWearHistory(item)) {
      (wearsByDate[d] = wearsByDate[d] || []).push(item);
    }
  }

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const firstWeekday = (monthStart.getDay() + 6) % 7; // shift so Monday=0
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const monthLabel = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const goPrev = () => setCursor((c) => ({ year: c.month === 0 ? c.year - 1 : c.year, month: c.month === 0 ? 11 : c.month - 1 }));
  const goNext = () => setCursor((c) => ({ year: c.month === 11 ? c.year + 1 : c.year, month: c.month === 11 ? 0 : c.month + 1 }));

  const selectedISO = selectedDate;
  const selectedWears = selectedISO ? wearsByDate[selectedISO] || [] : [];
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const totalWearsInMonth = Object.entries(wearsByDate).filter(([d]) => d.startsWith(monthPrefix)).reduce((sum, [, list]) => sum + list.length, 0);
  const plannedInMonth = Object.keys(schedules).filter((d) => d.startsWith(monthPrefix) && schedules[d]?.outfitId).length;

  return (
    <div className="space-y-6" data-calendar-root>
      {showRangeHint && rangeMode && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-stone-700 text-sm flex items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <Calendar size={16} strokeWidth={1.5} className="text-amber-700 shrink-0" />
            <span className="leading-snug">Pick your trip's <span className="font-medium">start date</span>, then the <span className="font-medium">end date</span>. The Concierge will compose a capsule.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowRangeHint(false)}
            aria-label="Dismiss hint"
            className="text-stone-500 hover:text-stone-900 shrink-0"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      )}
      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-4 sm:p-6 smooth-shadow">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button onClick={goPrev} className="p-2.5 rounded-full text-stone-500 hover:bg-stone-100 transition-colors" aria-label="Previous month">
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
          </button>
          <div className="text-center">
            <p className="font-display text-xl sm:text-2xl text-stone-900">{monthLabel}</p>
            <p className="text-[10px] tracking-widest uppercase text-stone-500 mt-1">
              {totalWearsInMonth} wears · {plannedInMonth} planned
            </p>
          </div>
          <button onClick={goNext} className="p-2.5 rounded-full text-stone-500 hover:bg-stone-100 transition-colors" aria-label="Next month">
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center justify-end mb-3 gap-2 flex-wrap">
          <button onClick={() => downloadIcs(`atelier-calendar-${todayISO()}.ics`, schedules, outfits, items)}
            disabled={Object.values(schedules || {}).filter((s) => s?.outfitId).length === 0}
            className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-500 transition-all disabled:opacity-40 inline-flex items-center gap-1.5">
            <Download size={12} strokeWidth={1.5} /> Export .ics
          </button>
          <button onClick={toggleRangeMode}
            className={`text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full transition-all border ${
              rangeMode ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-500'
            }`}>
            {rangeMode ? '× Cancel range' : '✦ Pack for trip'}
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] tracking-widest uppercase text-stone-400 mb-2">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const list = wearsByDate[iso] || [];
            const scheduled = schedules[iso];
            const isToday = iso === todayISO();
            const isSelected = iso === selectedISO;
            const isFuture = iso > todayISO();
            const inRng = inRange(iso);
            const isRangeStart = iso === rangeStart;
            const isRangeEnd = iso === rangeEnd;
            return (
              <button key={iso}
                onClick={() => rangeMode ? pickRangeDate(iso) : setSelectedDate(iso)}
                className={`aspect-square rounded-xl p-1 sm:p-2 flex flex-col items-center justify-center transition-all border relative ${
                  isRangeStart || isRangeEnd ? 'bg-stone-900 text-white border-stone-900'
                  : inRng ? 'bg-stone-200 border-stone-300 text-stone-900'
                  : isSelected ? 'bg-stone-900 text-white border-stone-900'
                  : isToday ? 'bg-stone-100 border-stone-300 text-stone-900'
                  : scheduled ? 'bg-amber-50 border-amber-200 hover:border-amber-400 text-stone-900'
                  : list.length > 0 ? 'bg-stone-50 border-stone-200 hover:border-stone-500 text-stone-900'
                  : 'bg-white border-stone-100 text-stone-400 hover:border-stone-300'
                }`}>
                <span className="text-xs sm:text-sm">{day}</span>
                {list.length > 0 && (
                  <span className={`text-[8px] sm:text-[10px] mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                    {list.length} wear{list.length === 1 ? '' : 's'}
                  </span>
                )}
                {scheduled && !list.length && (
                  <span className={`text-[8px] sm:text-[10px] mt-0.5 ${isSelected ? 'text-amber-200' : 'text-brass-600'}`}>
                    ✦ planned
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {rangeMode && rangeStart && (() => {
        const startLabel = new Date(rangeStart + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const endLabel = rangeEnd ? new Date(rangeEnd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
        const days = rangeEnd
          ? Math.floor((new Date(rangeEnd) - new Date(rangeStart)) / 86_400_000) + 1
          : 1;
        const plannedDays = Object.keys(schedules).filter((d) => d >= rangeStart && d <= (rangeEnd || rangeStart) && schedules[d]?.outfitId).length;
        return (
          <div className="bg-stone-900 text-white rounded-[2rem] p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest uppercase text-stone-400">Trip range</p>
              <p className="font-display text-lg sm:text-xl mt-1">
                {startLabel}{endLabel ? ` → ${endLabel}` : ' — tap end date'}
              </p>
              <p className="text-[10px] tracking-wider uppercase text-stone-400 mt-1">{days} day{days === 1 ? '' : 's'} · {plannedDays} planned</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {/* ONE button. Outfits + packing list + iteration + export all
                  live inside this flow now. The old standalone "Generate
                  packing list" was redundant for the common case (most users
                  want the Concierge to plan, not to aggregate manually-
                  scheduled outfits). For the rare aggregate-from-schedule
                  case, the planner's empty-state still surfaces it. */}
              {onSaveOutfit && isAIEnabled() ? (
                <button
                  disabled={!rangeEnd}
                  onClick={() => setTravelOpen(true)}
                  className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Wand2 size={14} strokeWidth={1.5} /> Plan this trip
                </button>
              ) : (
                // AI disabled: only the manual packing-list path is available.
                <button
                  disabled={!rangeEnd || plannedDays === 0}
                  onClick={() => setPackingOpen(true)}
                  title={plannedDays === 0 ? 'Schedule outfits to these dates first' : `Aggregate ${plannedDays} planned outfit${plannedDays === 1 ? '' : 's'} into a packing list`}
                  className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-white text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Generate packing list
                </button>
              )}
              {/* Quiet secondary affordance — preserves the "I already
                  scheduled outfits, just show me the packing list" path
                  without competing with the primary action. */}
              {onSaveOutfit && isAIEnabled() && plannedDays > 0 && (
                <button
                  onClick={() => setPackingOpen(true)}
                  className="text-[10px] tracking-widest uppercase text-stone-400 hover:text-stone-100 underline-offset-4 hover:underline"
                  title={`View packing list from ${plannedDays} already-scheduled outfit${plannedDays === 1 ? '' : 's'}`}
                >
                  Or view list from existing schedule
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {selectedDate && (() => {
        const scheduled = schedules[selectedDate];
        const scheduledOutfit = scheduled ? outfits.find((o) => o.id === scheduled.outfitId) : null;
        const scheduledPieces = scheduledOutfit ? resolveOutfitItems(scheduledOutfit, items) : [];
        const isFutureOrToday = selectedDate >= todayISO();
        const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const tripInfo = scheduled?.trip ?? null;
        return (
          <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 smooth-shadow space-y-5">
            {/* Trip overview eyebrow — only renders when this scheduled day
                has trip metadata (written by TravelPlannerModal.apply()).
                Existing scheduled outfits without trip metadata are
                unaffected (optional chaining). */}
            {tripInfo && (
              <div className="-mt-1 mb-1 px-3 py-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block w-3 h-px bg-amber-400 shrink-0" aria-hidden="true" />
                    <span className="text-[10px] tracking-[0.28em] uppercase text-amber-800 font-medium shrink-0">Trip</span>
                    <span className="text-[12px] text-stone-700 font-display truncate">{tripInfo.name}</span>
                  </div>
                  <span className="text-[10px] tracking-wide text-stone-500 shrink-0">
                    {new Date(tripInfo.startISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' → '}
                    {new Date(tripInfo.endISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {tripInfo.location && tripInfo.location !== tripInfo.name && (
                  <p className="text-[10px] tracking-wide text-stone-500 mt-1">{tripInfo.location}</p>
                )}
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRangeStart(tripInfo.startISO);
                      setRangeEnd(tripInfo.endISO);
                      setPackingOpen(true);
                    }}
                    className="text-[10px] tracking-widest uppercase text-stone-700 hover:text-stone-900 underline-offset-4 hover:underline"
                  >
                    View packing list
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-3 flex-wrap min-w-0">
                <h3 className="font-display text-xl sm:text-2xl text-stone-900">{formattedDate}</h3>
                {scheduledOutfit && (
                  <span className="text-[10px] tracking-widest uppercase text-brass-600 bg-brass-50 px-2 py-0.5 rounded-full shrink-0">Planned</span>
                )}
                {!scheduledOutfit && selectedWears.length > 0 && (
                  <span className="text-[10px] tracking-widest uppercase text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full shrink-0">{selectedWears.length} worn</span>
                )}
              </div>
              {isFutureOrToday && onScheduleOutfit && (
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button onClick={() => setSchedulingDate(selectedDate)}
                    className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors px-3 py-1.5 border border-stone-200 rounded-full hover:border-stone-500">
                    {scheduled ? 'Change look' : '＋ Plan a look'}
                  </button>
                  {!scheduled && (
                    <button onClick={handleCopyPrev}
                      className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors px-3 py-1.5 border border-stone-200 rounded-full hover:border-stone-500">
                      ↩ Copy yesterday
                    </button>
                  )}
                  {scheduled && (
                    <button onClick={handleRepeatWeek}
                      className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors px-3 py-1.5 border border-stone-200 rounded-full hover:border-stone-500">
                      ↪ Repeat all week
                    </button>
                  )}
                </div>
              )}
            </div>

            {dayEvents.length > 0 && (
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
                  <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500">On your calendar</span>
                </div>
                <ul className="space-y-1">
                  {dayEvents.map((e) => (
                    <li key={e.id} className="text-[12px] text-stone-700 flex items-baseline gap-2">
                      <span className="text-stone-400 tabular-nums tracking-wide shrink-0">
                        {e.allDay ? 'All day' : new Date(e.startISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="truncate">{e.title}</span>
                      {e.location && <span className="text-stone-400 italic truncate">· {e.location}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scheduledOutfit && (
              <div className="rounded-2xl border border-amber-200 overflow-hidden">
                {/* Tappable header area — opens the look detail */}
                <button
                  type="button"
                  onClick={() => onOpenOutfit?.(scheduledOutfit.id)}
                  className="w-full text-left bg-amber-50 hover:bg-amber-100/70 transition-colors px-4 pt-4 pb-3"
                >
                  <div className="text-[10px] tracking-widest uppercase text-brass-600 mb-1">Planned look</div>
                  <div className="font-display text-stone-900 text-lg sm:text-xl leading-tight">{scheduledOutfit.name}</div>
                  {scheduledOutfit.tags && scheduledOutfit.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scheduledOutfit.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="text-[9px] tracking-wide uppercase text-stone-600 bg-white/70 border border-stone-200 px-1.5 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
                {/* Item thumbnail row */}
                <div className="bg-amber-50/50 px-4 pb-4 pt-3">
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    {scheduledPieces.map((p) => (
                      <div key={p.id} className="flex-none w-14 aspect-[3/4] rounded-lg overflow-hidden bg-white border border-amber-200/60">
                        <ItemTileImage item={p} alt={p.name} />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Action row */}
                <div className="bg-white border-t border-amber-200 px-4 py-2 flex justify-end">
                  <button onClick={() => onScheduleOutfit(selectedDate, null)} className="text-[10px] tracking-widest uppercase text-stone-400 hover:text-red-600 transition-colors">Unschedule</button>
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] tracking-widest uppercase text-stone-500 mb-3">{selectedWears.length > 0 ? 'Actually worn' : 'Wear log'}</p>
              {selectedWears.length === 0 ? (
                <p className="text-stone-400 italic text-sm">{isFutureOrToday ? 'Nothing logged yet — log wears from any item\'s detail view.' : 'Nothing was logged for this day.'}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {selectedWears.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2">
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100">
                        <ItemTileImage item={item} alt={item.name} />
                      </div>
                      <p className="text-xs text-stone-900 truncate">{item.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Persistent packing-list download — always visible, defaults to
          the next 14 days (typical upcoming-trip window). The explicit
          range-mode UI still exists for users who want to pick a specific
          trip window. */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => {
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 14);
            setRangeStart(start.toISOString().slice(0, 10));
            setRangeEnd(end.toISOString().slice(0, 10));
            setPackingOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-300 text-stone-700 text-[12px] tracking-wide hover:border-stone-900 hover:text-stone-900 transition-colors"
        >
          <Download size={14} strokeWidth={1.5} />
          Download packing list
        </button>
      </div>

      {schedulingDate && (
        <SchedulePickerModal
          date={schedulingDate}
          outfits={outfits}
          items={items}
          onClose={() => setSchedulingDate(null)}
          onPick={async (outfitId) => { await onScheduleOutfit(schedulingDate, outfitId); setSchedulingDate(null); }}
        />
      )}
      {packingOpen && rangeStart && rangeEnd && (
        <PackingListModal
          startISO={rangeStart}
          endISO={rangeEnd}
          schedules={schedules}
          outfits={outfits}
          items={items}
          onPlanWithConcierge={isAIEnabled() ? () => { setPackingOpen(false); setTravelOpen(true); } : null}
          onClose={() => setPackingOpen(false)}
        />
      )}
      {travelOpen && rangeStart && rangeEnd && (
        <TravelPlannerModal
          startISO={rangeStart}
          endISO={rangeEnd}
          items={items}
          onSaveOutfit={onSaveOutfit}
          onScheduleOutfit={onScheduleOutfit}
          styleProfile={styleProfile}
          onOpenItem={onOpenItem}
          onClose={() => setTravelOpen(false)}
        />
      )}
    </div>
  );
}

function TravelPlannerModal({ startISO, endISO, items, onSaveOutfit, onScheduleOutfit, styleProfile, onOpenItem = null, onClose }) {
  useEscapeKey(onClose);
  const [destination, setDestination] = useState('');
  const [tripType, setTripType] = useState('vacation'); // vacation | business | mixed
  const [activities, setActivities] = useState(() => new Set());
  // Free-text "specific places, events, or occasions" — passed verbatim into
  // the Concierge prompt. Powerful because it lets the user be destination-
  // specific in a way generic chips can't (e.g. "Vatican visit, wedding in
  // Trastevere, beach day at Sperlonga"). Goes alongside the cultural-
  // awareness instruction in the prompt itself.
  const [specificPlaces, setSpecificPlaces] = useState('');
  const [stage, setStage] = useState('input'); // input | forecasting | generating | done | error
  const [forecast, setForecast] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  // Per-day reroll state — { 'YYYY-MM-DD': true } while a single day is being
  // regenerated. Keeps the rest of the plan interactive during the call.
  const [rerollingDay, setRerollingDay] = useState({});
  const [exportToast, setExportToast] = useState(null);
  // Per-day amend state. When non-null, the WardrobePicker opens for that
  // day. Selecting a piece adds it to the day's itemIds; clicking the X on
  // any thumbnail removes that piece. Packing list updates automatically
  // because buildPackingList() reads from `plan`.
  const [addingToDay, setAddingToDay] = useState(null);
  const [pickerCategory, setPickerCategory] = useState('All');
  const toast = useToast();
  const days = Math.floor((new Date(endISO) - new Date(startISO)) / 86_400_000) + 1;

  const run = async (e) => {
    e?.preventDefault?.();
    if (!destination.trim()) return;
    setError(null);
    setStage('forecasting');
    try {
      const fc = await fetchTravelForecast(destination.trim(), startISO, endISO);
      setForecast(fc);
      setStage('generating');
      const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
      const result = await generateTravelCapsuleWithGemini({
        items: owned,
        destination: `${fc.name}${fc.country ? ', ' + fc.country : ''}`,
        daily: fc.daily,
        styleProfile,
        tripType,
        activities: [...activities].map((id) => TRAVEL_ACTIVITIES.find((a) => a.id === id)).filter(Boolean),
        specificPlaces: specificPlaces.trim(),
      });
      setPlan(result);
      setStage('done');
    } catch (e) {
      setError(e?.message || 'Failed.');
      setStage('error');
    }
  };

  // Reroll a single day's outfit. Calls the partial-regen helper, then merges
  // the new day back into the plan in-place. Other days untouched. Keeps the
  // user from waiting for a full ~10s recompose when only one day is off.
  const rerollDay = async (dayIso) => {
    if (!plan || rerollingDay[dayIso]) return;
    const dayInfo = forecast?.daily?.find((d) => d.date === dayIso);
    if (!dayInfo) return;
    // Collect itemIds used on OTHER days so the prompt encourages reuse.
    const otherIds = new Set();
    for (const d of plan.days) {
      if (d.date === dayIso) continue;
      for (const id of (d.itemIds || [])) otherIds.add(id);
    }
    setRerollingDay((m) => ({ ...m, [dayIso]: true }));
    try {
      const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
      const fresh = await regenerateTravelDayWithGemini({
        items: owned,
        destination: `${forecast.name}${forecast.country ? ', ' + forecast.country : ''}`,
        dayInfo,
        otherDayPieceIds: Array.from(otherIds),
        styleProfile,
        tripType,
        activities: [...activities].map((id) => TRAVEL_ACTIVITIES.find((a) => a.id === id)).filter(Boolean),
        specificPlaces: specificPlaces.trim(),
      });
      setPlan((prev) => ({
        ...prev,
        days: prev.days.map((d) => d.date === dayIso ? { ...d, itemIds: fresh.itemIds, reasoning: fresh.reasoning } : d),
      }));
    } catch (err) {
      toast.show(err?.message || 'Reroll failed.', { kind: 'error' });
    } finally {
      setRerollingDay((m) => {
        const next = { ...m };
        delete next[dayIso];
        return next;
      });
    }
  };

  // Add or remove a piece from one day in the plan. Both update `plan` in
  // place, which automatically rebuilds the packing list (counts + sort) on
  // the next render. addPieceToDay deduplicates so repeated clicks are safe.
  const addPieceToDay = (dayIso, itemId) => {
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) => d.date === dayIso
        ? { ...d, itemIds: Array.from(new Set([...(d.itemIds || []), itemId])) }
        : d
      ),
    }));
    setAddingToDay(null);
  };
  const removePieceFromDay = (dayIso, itemId) => {
    setPlan((prev) => ({
      ...prev,
      days: prev.days.map((d) => d.date === dayIso
        ? { ...d, itemIds: (d.itemIds || []).filter((id) => id !== itemId) }
        : d
      ),
    }));
  };

  // Build packing list with usage counts. Used by the result UI AND by the
  // export functions. Returns { items: [{piece, dayCount}], totalPieces }.
  const buildPackingList = () => {
    if (!plan?.days?.length) return { entries: [], totalPieces: 0 };
    const counts = new Map(); // id → { piece, dayCount, firstDayIndex }
    plan.days.forEach((day, dayIdx) => {
      for (const id of (day.itemIds || [])) {
        const piece = items.find((i) => i.id === id);
        if (!piece) continue;
        if (!counts.has(id)) counts.set(id, { piece, dayCount: 0, firstDayIndex: dayIdx });
        counts.get(id).dayCount += 1;
      }
    });
    // Sort by dayCount desc (backbone pieces first), then first-appearance,
    // then category for stable grouping.
    const entries = [...counts.values()].sort((a, b) => {
      if (b.dayCount !== a.dayCount) return b.dayCount - a.dayCount;
      return a.firstDayIndex - b.firstDayIndex;
    });
    return { entries, totalPieces: entries.length };
  };

  // Format the packing list as plain text suitable for Notes / email / SMS.
  // Grouped by category, with usage counts. The user said: "where do I then
  // EXPORT the actual travel list" — this is one of two export paths.
  const formatPackingListAsText = () => {
    if (!plan?.days?.length) return '';
    const { entries } = buildPackingList();
    if (entries.length === 0) return '';
    const destName = `${forecast?.name || ''}${forecast?.country ? ', ' + forecast.country : ''}`.trim();
    const startLabel = new Date(startISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endLabel = new Date(endISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const header = `Packing list — ${destName || 'trip'}\n${startLabel} → ${endLabel} (${plan.days.length} day${plan.days.length === 1 ? '' : 's'}, ${entries.length} piece${entries.length === 1 ? '' : 's'})\n`;
    const CATEGORY_ORDER = ['Outerwear', 'Tops', 'Bottoms', 'Dresses', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
    const byCat = new Map();
    for (const e of entries) {
      const cat = e.piece.category || 'Other';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(e);
    }
    const orderedCats = [
      ...CATEGORY_ORDER.filter((c) => byCat.has(c)),
      ...[...byCat.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
    ];
    const body = orderedCats.map((cat) => {
      const list = byCat.get(cat);
      const lines = list.map((e) => {
        const label = `${e.piece.brand ? e.piece.brand + ' · ' : ''}${e.piece.name || e.piece.category}`;
        const usage = e.dayCount > 1 ? ` (× ${e.dayCount} days)` : '';
        return `  [ ] ${label}${usage}`;
      });
      return `\n${cat} (${list.length})\n${lines.join('\n')}`;
    }).join('\n');
    return `${header}${body}\n`;
  };

  const handleCopyAsText = async () => {
    const text = formatPackingListAsText();
    if (!text) { toast.show('Nothing to copy yet.', { kind: 'error' }); return; }
    try {
      await navigator.clipboard.writeText(text);
      setExportToast('Packing list copied to clipboard');
      setTimeout(() => setExportToast(null), 2500);
    } catch {
      toast.show('Could not copy — your browser blocked clipboard access.', { kind: 'error' });
    }
  };

  // Print just the packing list. Opens a new browser window containing a
  // self-contained HTML document with ONLY the packing list — no app chrome,
  // no Tailwind classes, no sidebar. The new window auto-triggers
  // window.print() once web fonts have loaded (document.fonts.ready).
  // Replaces the previous @media print CSS approach, which was fragile and
  // would sometimes show the entire app in the print dialog.
  const handlePrint = () => {
    const { entries } = buildPackingList();
    if (!entries || entries.length === 0) {
      toast.show('No items to pack — schedule outfits first', { kind: 'default' });
      return;
    }

    // Group by category for the printable layout
    const grouped = new Map();
    for (const e of entries) {
      const cat = e.piece?.category || 'Other';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat).push(e);
    }

    const CATEGORY_ORDER = ['Outerwear', 'Dresses', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Belts', 'Jewellery', 'Swimwear', 'Sportswear', 'Other'];
    const orderedCategories = [...grouped.keys()].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });

    const startLabel = new Date(startISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const endLabel = new Date(endISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const totalDays = Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 86400000) + 1;
    const totalPieces = entries.length;

    const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const categorySections = orderedCategories.map((cat) => {
      const rows = grouped.get(cat).map((e) => {
        const brand = e.piece?.brand || '';
        const name = e.piece?.name || e.piece?.category || 'Item';
        const days = e.dayCount || 1;
        const imgs = itemImages(e.piece);
        const thumb = imgs[0] || '';
        const thumbCell = thumb
          ? `<td style="width:60px;padding:0 12px 0 0;"><div style="width:48px;height:48px;border-radius:8px;background-color:#f5f5f4;border:1px solid #e7e5e4;overflow:hidden;"><img src="${esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" /></div></td>`
          : `<td style="width:60px;padding:0 12px 0 0;"><div style="width:48px;height:48px;border-radius:8px;background-color:#f5f5f4;border:1px solid #e7e5e4;"></div></td>`;
        return `<tr style="border-bottom:1px solid #e7e5e4;">
          ${thumbCell}
          <td style="padding:8px 0;vertical-align:middle;">
            <div style="font-family:'Playfair Display',Georgia,serif;font-size:14px;color:#1c1917;line-height:1.3;">${esc(name)}</div>
            ${brand ? `<div style="font-family:Jost,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#78716c;margin-top:2px;">${esc(brand)}</div>` : ''}
          </td>
          <td style="padding:8px 0;text-align:right;vertical-align:middle;font-family:Jost,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#a8a29e;white-space:nowrap;">
            ${days} day${days === 1 ? '' : 's'}
          </td>
        </tr>`;
      }).join('');
      return `<section style="break-inside:avoid;margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="display:inline-block;width:18px;height:2px;background-color:#C9A66B;"></span>
          <span style="font-family:Jost,sans-serif;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#57534e;font-weight:500;">${esc(cat)}</span>
          <span style="font-family:Jost,sans-serif;font-size:10px;color:#a8a29e;">· ${grouped.get(cat).length}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </section>`;
    }).join('');

    const html = buildPackingListHtml({ startLabel, endLabel, totalDays, totalPieces, categorySections });

    // NOTE: no 'noopener' here — with noopener, window.open returns null, so
    // we could never write the HTML and the tab stayed at about:blank.
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) {
      toast.show('Pop-up blocked — allow pop-ups for this site and try again', { kind: 'error', duration: 6000 });
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const apply = async () => {
    if (!plan?.days?.length) return;
    // Trip metadata stamped onto every scheduled day so the calendar can
    // surface a trip-overview eyebrow without a separate trips collection.
    const tripId = newId();
    const destName = forecast?.name
      ? `${forecast.name}${forecast.country ? ', ' + forecast.country : ''}`
      : null;
    const tripMeta = {
      trip: {
        id: tripId,
        name: destName || destination.trim() || 'Trip',
        startISO,
        endISO,
        location: destName || null,
      },
    };
    for (const day of plan.days) {
      const itemIds = (day.itemIds || []).filter((id) => items.some((i) => i.id === id));
      if (itemIds.length === 0) continue;
      const outfit = {
        id: newId(),
        name: `Trip · ${new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`,
        itemIds,
        createdAt: new Date().toISOString(),
        reasoning: day.reasoning || '',
        intent: forecast?.name ? `travel · ${forecast.name}` : 'travel',
      };
      await onSaveOutfit?.(outfit);
      // Pass '' as eventName (positional) so the trip meta goes in the 4th arg.
      await onScheduleOutfit?.(day.date, outfit.id, '', tripMeta);
    }
    toast.show(`Travel capsule saved · ${plan.days.length} days scheduled`, { kind: 'success' });
    onClose?.();
  };

  // Guard the backdrop close — three states that should NOT silently dismiss:
  //   - forecasting / generating: a Concierge call is in flight, dismissing
  //     would burn tokens and confuse the user when the result lands "nowhere".
  //   - done with a plan: the user spent ~10s waiting for a travel capsule;
  //     a stray tap outside the modal shouldn't erase it. Require confirm.
  // Closing via the explicit X / Discard / Save buttons always works.
  const handleBackdropClick = () => {
    if (stage === 'forecasting' || stage === 'generating') return; // in-flight — ignore
    if (stage === 'done' && plan) {
      if (!window.confirm('Discard this travel capsule?')) return;
    }
    onClose?.();
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={handleBackdropClick}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-6 py-5 border-b border-stone-200/60 bg-white shrink-0">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Travel capsule</p>
            <h3 className="text-xl font-display text-stone-900 mt-1">Plan {days} day{days === 1 ? '' : 's'} with Concierge</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
          {stage === 'input' && (
            <form onSubmit={run} className="space-y-5">
              <p className="text-stone-500 text-sm leading-relaxed">
                Type a destination — anywhere in the world. Atelier will fetch the forecast for {new Date(startISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {new Date(endISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} and let the Concierge build a per-day capsule from your wardrobe — tailored to where you're going and what you'll be doing there.
              </p>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-medium">Destination</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Lisbon, Edinburgh, Marrakech…"
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none"
                  autoFocus
                />
              </div>

              {/* Trip type — three mutually-exclusive chips. */}
              <div className="space-y-2">
                <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-medium">Trip type</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'vacation', label: 'Vacation' },
                    { id: 'business', label: 'Business' },
                    { id: 'mixed', label: 'Mixed' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTripType(t.id)}
                      className={`px-4 py-2 rounded-full text-xs transition-colors border ${
                        tripType === t.id
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activities — multi-select chips. The selected set is read at
                  submit time and passed into the Concierge prompt so the
                  composition honours them (e.g. beach → swimwear in capsule). */}
              <div className="space-y-2">
                <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-medium">
                  Activities <span className="text-stone-400 normal-case tracking-normal">(optional — pick any that apply)</span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {TRAVEL_ACTIVITIES.map((a) => {
                    const selected = activities.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setActivities((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.id)) next.delete(a.id);
                            else next.add(a.id);
                            return next;
                          });
                        }}
                        title={a.hint}
                        className={`px-3 py-1.5 rounded-full text-[11px] transition-colors border ${
                          selected
                            ? 'bg-brass-300 text-stone-900 border-brass-400'
                            : 'bg-white text-stone-600 border-stone-300 hover:border-stone-500'
                        }`}
                      >
                        {selected && <span className="mr-1">✓</span>}{a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specific places / events — free-text. Goes verbatim into the
                  Concierge prompt. Far more powerful than generic chips
                  because it lets the user be destination-specific (Vatican,
                  Trastevere wedding, Tate Modern, Sperlonga beach day). */}
              <div className="space-y-1.5">
                <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-medium">
                  Specific places or events <span className="text-stone-400 normal-case tracking-normal">(optional — be as concrete as you like)</span>
                </label>
                <textarea
                  value={specificPlaces}
                  onChange={(e) => setSpecificPlaces(e.target.value)}
                  rows={2}
                  placeholder="e.g. Vatican visit, wedding in Trastevere, cocktails at La Vincianella, hike to Sperlonga…"
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none resize-none"
                  style={{ fontSize: '16px' /* avoid iOS auto-zoom */ }}
                />
                <p className="text-[10px] text-stone-400 italic leading-relaxed">
                  Atelier also factors in cultural dress norms for the destination — covered shoulders for religious sites, modest hemlines where appropriate, climate-specific cover-ups.
                </p>
              </div>

              <button type="submit" disabled={!destination.trim()}
                className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-700 disabled:opacity-50">
                Compose this trip
              </button>
              <p className="text-[10px] text-stone-400 leading-relaxed">
                Forecast via Open-Meteo for the first ~14 days. Days beyond use seasonal climate. The Concierge composes outfits + a packing list from your wardrobe and the activities you selected — iterate per day, export, or save & schedule.
              </p>
            </form>
          )}

          {(stage === 'forecasting' || stage === 'generating') && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-stone-700 text-sm">
                <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin shrink-0" />
                <p className="italic">
                  {stage === 'forecasting'
                    ? `Fetching forecast for ${destination}…`
                    : `The Concierge is composing ${days} day${days === 1 ? '' : 's'} from your wardrobe…`}
                </p>
              </div>
              {/* Skeleton day cards — gives the user a sense of the shape of
                  the result that's coming, not just a blank spinner. */}
              <div className="space-y-3">
                {Array.from({ length: Math.min(days, 5) }).map((_, idx) => (
                  <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-4 animate-pulse">
                    <div className="flex items-baseline justify-between mb-3">
                      <div className="h-3 w-24 rounded bg-stone-200" />
                      <div className="h-3 w-16 rounded bg-stone-100" />
                    </div>
                    <div className="flex gap-2">
                      {[0,1,2,3,4].map((j) => (
                        <div key={j} className="flex-none w-20 aspect-[3/4] rounded-lg bg-stone-200" />
                      ))}
                    </div>
                    <div className="mt-3 h-2 w-3/4 rounded bg-stone-100" />
                  </div>
                ))}
                {days > 5 && (
                  <p className="text-center text-[10px] tracking-widest uppercase text-stone-400">
                    +{days - 5} more day{days - 5 === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>
          )}

          {stage === 'error' && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              {error}
              <button onClick={() => setStage('input')} className="block mt-3 text-xs tracking-wider uppercase text-stone-500 hover:text-stone-900">
                Try again
              </button>
            </div>
          )}

          {stage === 'done' && plan && (
            <>
              <div className="bg-stone-900 text-white rounded-2xl p-4">
                <p className="text-[10px] tracking-widest uppercase text-stone-400 mb-1">{forecast?.name}{forecast?.country ? `, ${forecast.country}` : ''}</p>
                <p className="text-sm italic text-stone-200">{plan.summary}</p>
              </div>
              <div className="space-y-3">
                {plan.days.map((d, idx) => {
                  const fcDay = forecast?.daily?.find((f) => f.date === d.date);
                  const pieces = (d.itemIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
                  const isRerolling = !!rerollingDay[d.date];
                  const isEmpty = pieces.length === 0;
                  const isSparse = pieces.length > 0 && pieces.length < 3;
                  return (
                    <div key={idx} className={`bg-white border rounded-2xl p-4 ${isEmpty ? 'border-amber-200 bg-amber-50/30' : 'border-stone-200'}`}>
                      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                        <p className="text-sm font-medium text-stone-900">
                          {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <div className="flex items-center gap-2">
                          {fcDay && !fcDay.estimated && (
                            <span className="text-[10px] tracking-wider uppercase text-stone-500">
                              {fcDay.tmin}-{fcDay.tmax}°C · {weatherLabel(fcDay.code)}
                            </span>
                          )}
                          {fcDay?.estimated && (
                            <span className="text-[10px] tracking-wider uppercase text-stone-400 italic">
                              Seasonal estimate
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => rerollDay(d.date)}
                            disabled={isRerolling}
                            className="text-[10px] tracking-wider uppercase text-stone-500 hover:text-stone-900 border border-stone-300 hover:border-stone-500 rounded-full px-2 py-0.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Compose this day again"
                          >
                            {isRerolling ? 'Rerolling…' : '↻ Reroll'}
                          </button>
                        </div>
                      </div>

                      {isRerolling ? (
                        <div className="flex flex-wrap gap-2 mb-3 animate-pulse">
                          {[0,1,2,3,4].map((j) => (
                            <div key={j} className="flex-none w-20 aspect-[3/4] rounded-lg bg-stone-200" />
                          ))}
                        </div>
                      ) : isEmpty ? (
                        <div className="py-4 text-center">
                          <p className="text-sm text-amber-900 font-medium">Couldn't compose this day.</p>
                          <p className="text-xs text-amber-800/70 mt-1 mb-3">
                            The Concierge didn't return enough matching pieces — try the Reroll button above.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {pieces.map((p) => (
                              <div key={p.id} className="relative flex-none w-20 aspect-[3/4] rounded-lg overflow-hidden bg-stone-100 ring-1 ring-stone-200 group" title={`${p.brand ? p.brand + ' · ' : ''}${p.name || p.category}`}>
                                {itemImages(p)[0] ? (
                                  <ItemTileImage item={p} alt={p.name || p.category} />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wider text-stone-400 text-center px-1">{p.category}</div>
                                )}
                                {/* Remove button — always visible on mobile (tap target),
                                    opacity-on-hover on desktop. Small X badge in top-left. */}
                                <button
                                  type="button"
                                  onClick={() => removePieceFromDay(d.date, p.id)}
                                  aria-label={`Remove ${p.name || p.category} from ${d.date}`}
                                  className="absolute top-1 left-1 w-5 h-5 rounded-full bg-stone-900/85 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                                >
                                  <X size={12} strokeWidth={2.5} />
                                </button>
                              </div>
                            ))}
                            {/* Add-piece tile — opens the wardrobe picker scoped to this day. */}
                            <button
                              type="button"
                              onClick={() => { setAddingToDay(d.date); setPickerCategory('All'); }}
                              className="flex-none w-20 aspect-[3/4] rounded-lg border-2 border-dashed border-stone-300 hover:border-stone-700 hover:bg-stone-50 flex flex-col items-center justify-center gap-1 text-stone-500 hover:text-stone-900 transition-colors"
                              title="Add a piece from your wardrobe to this day"
                            >
                              <Plus size={20} strokeWidth={1.5} />
                              <span className="text-[9px] uppercase tracking-wider">Add</span>
                            </button>
                          </div>
                          {isSparse && (
                            <p className="text-[10px] text-amber-700 italic mb-2">
                              Sparse outfit ({pieces.length} piece{pieces.length === 1 ? '' : 's'}) — Reroll for a fuller composition.
                            </p>
                          )}
                          {d.reasoning && <p className="text-xs text-stone-600 italic leading-relaxed">{renderTextWithChips(d.reasoning, { items, onOpenItem })}</p>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* PACKING LIST — deduped union of every piece across every day,
                  with usage counts so the user sees which pieces are the
                  capsule backbone (× 4-5 days) vs supporting one-offs.
                  Sorted by usage descending — backbone first. */}
              {(() => {
                const { entries } = buildPackingList();
                if (entries.length === 0) return null;
                // Group by category in this order so the list reads like a
                // packing routine: clothes first, then shoes, then carry-ons.
                const CATEGORY_ORDER = ['Outerwear', 'Tops', 'Bottoms', 'Dresses', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
                const byCategory = new Map();
                for (const e of entries) {
                  const cat = e.piece.category || 'Other';
                  if (!byCategory.has(cat)) byCategory.set(cat, []);
                  // Within each category, entries are already sorted by usage
                  // desc because we iterate the pre-sorted entries list.
                  byCategory.get(cat).push(e);
                }
                const orderedCats = [
                  ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
                  ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
                ];
                const backbone = entries.filter((e) => e.dayCount >= 3).length;
                return (
                  <div className="bg-white border border-stone-200 rounded-2xl p-5">
                    <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-stone-500">The Packing List</p>
                        <h3 className="text-lg font-display text-stone-900 mt-0.5">{entries.length} piece{entries.length === 1 ? '' : 's'} for {plan.days.length} day{plan.days.length === 1 ? '' : 's'}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] tracking-wider uppercase text-stone-400">
                          {(entries.length / Math.max(plan.days.length, 1)).toFixed(1)}× per day
                        </p>
                        {backbone > 0 && (
                          <p className="text-[10px] tracking-wider uppercase text-emerald-700 mt-0.5">
                            {backbone} backbone piece{backbone === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {orderedCats.map((cat) => {
                        const list = byCategory.get(cat);
                        return (
                          <div key={cat}>
                            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-2">
                              {cat} <span className="text-stone-300">·</span> <span className="text-stone-400">{list.length}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {list.map(({ piece: p, dayCount }) => (
                                <div key={p.id} className="flex flex-col items-center w-20" title={`${p.brand ? p.brand + ' · ' : ''}${p.name || p.category} — worn ${dayCount} day${dayCount === 1 ? '' : 's'}`}>
                                  <div className="relative w-20 aspect-[3/4] rounded-lg overflow-hidden bg-stone-100 ring-1 ring-stone-200">
                                    {itemImages(p)[0] ? (
                                      <ItemTileImage item={p} alt={p.name || p.category} />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-wider text-stone-400 text-center px-1">{p.category}</div>
                                    )}
                                    {/* Usage badge — backbone pieces (3+) get emerald;
                                        supporting pieces (1-2) get neutral. */}
                                    <span className={`absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${dayCount >= 3 ? 'bg-emerald-600 text-white' : 'bg-stone-800/85 text-white'}`}>
                                      × {dayCount}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-stone-600 text-center truncate w-full leading-tight">{p.name || p.brand || p.category}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-4 text-[10px] text-stone-400 italic">
                      Green badges mark backbone pieces (worn 3+ days). Use Copy or Print below to take this list with you.
                    </p>
                  </div>
                );
              })()}
            </>
          )}
          {exportToast && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] bg-emerald-700 text-white px-4 py-2 rounded-full text-sm shadow-lg">
              ✓ {exportToast}
            </div>
          )}

          {/* PRINT-ONLY rendering. Normally display:none. The @media print
              block below hides every other element on the page (sidebar,
              modal chrome, the page behind, the modal itself) and only
              shows this clean packing-list block, full-width on a white
              page. The user's previous Print attempt captured the whole
              app UI — this isolates the output to just the list, with
              checkboxes, usage counts and category grouping. */}
          {stage === 'done' && plan?.days?.length > 0 && (() => {
            const { entries } = buildPackingList();
            if (entries.length === 0) return null;
            const CATEGORY_ORDER = ['Outerwear', 'Tops', 'Bottoms', 'Dresses', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
            const byCat = new Map();
            for (const e of entries) {
              const cat = e.piece.category || 'Other';
              if (!byCat.has(cat)) byCat.set(cat, []);
              byCat.get(cat).push(e);
            }
            const orderedCats = [
              ...CATEGORY_ORDER.filter((c) => byCat.has(c)),
              ...[...byCat.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
            ];
            const destName = `${forecast?.name || ''}${forecast?.country ? ', ' + forecast.country : ''}`.trim();
            const startLabel = new Date(startISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const endLabel = new Date(endISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <>
                <style>{`
                  @media print {
                    body * { visibility: hidden !important; }
                    .travel-print-target, .travel-print-target * { visibility: visible !important; }
                    .travel-print-target {
                      position: fixed !important;
                      top: 0 !important;
                      left: 0 !important;
                      right: 0 !important;
                      width: 100% !important;
                      background: white !important;
                      color: black !important;
                      padding: 2rem !important;
                      font-family: Georgia, 'Times New Roman', serif !important;
                      z-index: 999999 !important;
                    }
                    @page { margin: 1.5cm; size: A4; }
                  }
                `}</style>
                <div className="travel-print-target" style={{ display: 'none' }} aria-hidden="true">
                  <h1 style={{ fontSize: '24pt', marginBottom: '0.25rem' }}>Packing List</h1>
                  {destName && <p style={{ fontSize: '14pt', color: '#555', marginBottom: '0.25rem' }}>{destName}</p>}
                  <p style={{ fontSize: '11pt', color: '#666', marginBottom: '1.5rem' }}>
                    {startLabel} &rarr; {endLabel} &middot; {plan.days.length} day{plan.days.length === 1 ? '' : 's'} &middot; {entries.length} piece{entries.length === 1 ? '' : 's'}
                  </p>
                  {orderedCats.map((cat) => {
                    const list = byCat.get(cat);
                    return (
                      <section key={cat} style={{ marginBottom: '1.25rem', breakInside: 'avoid' }}>
                        <h2 style={{ fontSize: '12pt', textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid #999', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>
                          {cat} <span style={{ color: '#888', fontWeight: 'normal' }}>&middot; {list.length}</span>
                        </h2>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {list.map(({ piece: p, dayCount }) => (
                            <li key={p.id} style={{ padding: '4pt 0', display: 'flex', alignItems: 'baseline', borderBottom: '1px dotted #ddd' }}>
                              <span style={{ display: 'inline-block', width: '12pt', height: '12pt', border: '1pt solid #333', marginRight: '8pt', flexShrink: 0 }} aria-hidden="true"></span>
                              <span style={{ flex: 1, fontSize: '11pt' }}>
                                {p.brand && <span style={{ color: '#666', marginRight: '4pt' }}>{p.brand}</span>}
                                <span style={{ color: '#000' }}>{p.name || p.category}</span>
                              </span>
                              {dayCount > 1 && (
                                <span style={{ color: '#666', fontSize: '9pt', fontStyle: 'italic', marginLeft: '8pt' }}>
                                  &times; {dayCount} days
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                  <p style={{ marginTop: '2rem', fontSize: '8pt', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                    Composed by Atelier &middot; printed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </>
            );
          })()}

          {/* WARDROBE PICKER — opens when the user taps "+ Add" on a day card.
              Shows owned items grouped by category. Tapping an item adds it
              to that day's itemIds + closes the picker. The pieces already on
              that day are dimmed so the user doesn't double-add. */}
          {addingToDay && (() => {
            const currentDayIds = new Set((plan?.days?.find((dd) => dd.date === addingToDay)?.itemIds) || []);
            const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
            const PICKER_CATS = ['All', 'Outerwear', 'Tops', 'Bottoms', 'Dresses', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
            const filtered = pickerCategory === 'All' ? owned : owned.filter((i) => (i.category || 'Other') === pickerCategory);
            return (
              <div className="fixed inset-0 z-[105] bg-stone-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6" onClick={() => setAddingToDay(null)}>
                <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                  <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-start shrink-0">
                    <div>
                      <p className="text-[10px] tracking-widest uppercase text-stone-500">Add a piece</p>
                      <h3 className="text-base font-medium text-stone-900 mt-0.5">
                        to {new Date(addingToDay + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </h3>
                    </div>
                    <button onClick={() => setAddingToDay(null)} className="p-1.5 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="px-5 py-3 border-b border-stone-200 shrink-0 overflow-x-auto">
                    <div className="flex gap-1.5 min-w-max">
                      {PICKER_CATS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPickerCategory(c)}
                          className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-colors border ${
                            pickerCategory === c
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white text-stone-600 border-stone-300 hover:border-stone-500'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-5">
                    {filtered.length === 0 ? (
                      <p className="text-center text-sm text-stone-500 italic py-8">No items in this category yet.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {filtered.map((p) => {
                          const alreadyAdded = currentDayIds.has(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => addPieceToDay(addingToDay, p.id)}
                              className={`group text-left rounded-lg overflow-hidden ring-1 transition-all ${
                                alreadyAdded
                                  ? 'ring-emerald-300 opacity-50 cursor-not-allowed'
                                  : 'ring-stone-200 hover:ring-stone-900 hover:scale-[1.02] cursor-pointer'
                              }`}
                              title={alreadyAdded ? 'Already added to this day' : `Add ${p.name || p.category}`}
                            >
                              <div className="relative aspect-[3/4] bg-stone-100">
                                {itemImages(p)[0] ? (
                                  <ItemTileImage item={p} alt={p.name || p.category} />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wider text-stone-400 text-center px-1">{p.category}</div>
                                )}
                                {alreadyAdded && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-700/20">
                                    <span className="bg-emerald-700 text-white text-[10px] uppercase tracking-widest px-2 py-1 rounded-full">✓ Added</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-1.5">
                                <p className="text-[10px] text-stone-900 truncate leading-tight">{p.name || p.brand || p.category}</p>
                                {p.brand && p.name && <p className="text-[9px] text-stone-500 truncate leading-tight">{p.brand}</p>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 shrink-0 flex justify-between items-center">
                    <p className="text-[10px] text-stone-500">{filtered.length} piece{filtered.length === 1 ? '' : 's'} · {currentDayIds.size} already on this day</p>
                    <button onClick={() => setAddingToDay(null)} type="button" className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 px-3 py-1">Done</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {stage === 'done' && (
          <div className="px-6 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-2 justify-between flex-wrap">
            <div className="flex gap-2">
              <button onClick={handleCopyAsText} type="button"
                className="text-[10px] tracking-wider uppercase px-3 py-2 rounded-full border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors flex items-center gap-1.5"
                title="Copy the packing list as plain text — paste into Notes, email, or SMS">
                <Copy size={12} strokeWidth={1.5} /> Copy list
              </button>
              <button onClick={handlePrint} type="button"
                className="text-[10px] tracking-wider uppercase px-3 py-2 rounded-full border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors flex items-center gap-1.5"
                title="Open the browser print dialog — save as PDF or print on paper">
                <Printer size={12} strokeWidth={1.5} /> Print / PDF
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPlan(null); setStage('input'); }} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
                Discard
              </button>
              <button onClick={apply} className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 flex items-center gap-2">
                <Calendar size={14} strokeWidth={1.5} /> Save & schedule all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function PackingListModal({ startISO, endISO, schedules, outfits, items, onPlanWithConcierge, onClose }) {
  useEscapeKey(onClose);
  const startLabel = new Date(startISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const endLabel = new Date(endISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const dayCount = Math.floor((new Date(endISO) - new Date(startISO)) / 86_400_000) + 1;

  // Walk every day in range, collect scheduled outfits, expand to pieces,
  // dedupe by item id, group by category. Date math note: read local
  // year/month/day instead of toISOString().slice(0, 10) — see
  // fetchTravelForecast for the same fix; toISOString shifts to UTC and
  // BST dates would round down to the previous day.
  const localISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayList = [];
  const seen = new Map();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startISO + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const iso = localISODate(d);
    const sched = schedules[iso];
    const outfit = sched ? outfits.find((o) => o.id === sched.outfitId) : null;
    const pieces = outfit ? resolveOutfitItems(outfit, items) : [];
    dayList.push({ iso, label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), outfit, pieces });
    for (const p of pieces) {
      if (!seen.has(p.id)) seen.set(p.id, { item: p, days: [] });
      seen.get(p.id).days.push(iso);
    }
  }
  const byCategory = {};
  for (const { item, days } of seen.values()) {
    const cat = item.category || 'Other';
    (byCategory[cat] = byCategory[cat] || []).push({ item, days });
  }
  const categoryOrder = ['Tops', 'Dresses', 'Bottoms', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery', 'Other'];
  const orderedCategories = Object.keys(byCategory).sort((a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b));
  const totalPieces = seen.size;

  // Open a new browser window containing only the packing list as a clean
  // printable HTML document. No app chrome, no Tailwind — the print dialog
  // shows just the list. Same editorial styling as TravelPlannerModal's print.
  const handlePrintPackingList = () => {
    if (totalPieces === 0) return;

    const CATEGORY_ORDER = ['Outerwear', 'Dresses', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Belts', 'Jewellery', 'Swimwear', 'Sportswear', 'Other'];
    const orderedCats = Object.keys(byCategory).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });

    const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const categorySections = orderedCats.map((cat) => {
      const rows = byCategory[cat].map(({ item, days }) => {
        const brand = item.brand || '';
        const name = item.name || item.category || 'Item';
        const dayCount = days.length;
        const imgs = itemImages(item);
        const thumb = imgs[0] || '';
        const thumbCell = thumb
          ? `<td style="width:60px;padding:0 12px 0 0;"><div style="width:48px;height:48px;border-radius:8px;background-color:#f5f5f4;border:1px solid #e7e5e4;overflow:hidden;"><img src="${esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" /></div></td>`
          : `<td style="width:60px;padding:0 12px 0 0;"><div style="width:48px;height:48px;border-radius:8px;background-color:#f5f5f4;border:1px solid #e7e5e4;"></div></td>`;
        return `<tr style="border-bottom:1px solid #e7e5e4;">
          ${thumbCell}
          <td style="padding:8px 0;vertical-align:middle;">
            <div style="font-family:'Playfair Display',Georgia,serif;font-size:14px;color:#1c1917;line-height:1.3;">${esc(name)}</div>
            ${brand ? `<div style="font-family:Jost,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#78716c;margin-top:2px;">${esc(brand)}</div>` : ''}
          </td>
          <td style="padding:8px 0;text-align:right;vertical-align:middle;font-family:Jost,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#a8a29e;white-space:nowrap;">
            ${dayCount} day${dayCount === 1 ? '' : 's'}
          </td>
        </tr>`;
      }).join('');
      return `<section style="break-inside:avoid;margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="display:inline-block;width:18px;height:2px;background-color:#C9A66B;"></span>
          <span style="font-family:Jost,sans-serif;font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#57534e;font-weight:500;">${esc(cat)}</span>
          <span style="font-family:Jost,sans-serif;font-size:10px;color:#a8a29e;">· ${byCategory[cat].length}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </section>`;
    }).join('');

    const html = buildPackingListHtml({ startLabel, endLabel, totalDays: dayCount, totalPieces, categorySections });

    // NOTE: no 'noopener' here — with noopener, window.open returns null, so
    // we could never write the HTML and the tab stayed at about:blank.
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) {
      alert('Pop-up blocked — please allow pop-ups for this site and try again.');
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6 print:bg-white print:relative print:p-0" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:rounded-none print:shadow-none print:bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-5 sm:px-8 py-5 border-b border-stone-200/60 bg-white shrink-0 print:border-0">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Packing list</p>
            <h3 className="font-display text-xl sm:text-2xl text-stone-900 mt-1">{startLabel} → {endLabel}</h3>
            <p className="text-xs text-stone-500 mt-1">{dayCount} day{dayCount === 1 ? '' : 's'} · {totalPieces} piece{totalPieces === 1 ? '' : 's'} to pack</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors print:hidden">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 sm:p-8 flex-1 min-h-0 overflow-y-auto print:overflow-visible print:flex-none">
          {totalPieces === 0 ? (
            <div className="text-center py-8">
              <p className="font-display text-2xl text-stone-900 mb-2">No outfits planned for this trip yet.</p>
              <p className="text-sm text-stone-600 mb-6 max-w-md mx-auto">
                The packing list aggregates every piece across every day of your trip. To get one, plan the outfits first — either with the Concierge in one go, or by scheduling looks day by day.
              </p>
              {onPlanWithConcierge && (
                <button
                  onClick={onPlanWithConcierge}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-stone-900 text-white text-sm hover:bg-stone-700 transition-colors"
                >
                  <Wand2 size={14} strokeWidth={1.5} /> Plan {dayCount} day{dayCount === 1 ? '' : 's'} with Concierge
                </button>
              )}
              <p className="text-xs text-stone-400 mt-4">
                Or close this, tap a day in the calendar above, and assign a saved look.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {orderedCategories.map((cat) => (
                <div key={cat}>
                  <h4 className="text-[10px] tracking-widest uppercase text-stone-500 mb-3 font-bold">{cat} · {byCategory[cat].length}</h4>
                  <ul className="space-y-2">
                    {byCategory[cat].map(({ item, days }) => (
                      <li key={item.id} className="flex items-center gap-3 py-2 border-b border-stone-200/50 last:border-0">
                        <span className="w-5 h-5 rounded border border-stone-400 shrink-0 print:border-stone-600" aria-hidden></span>
                        <div className="w-10 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 print:hidden">
                          <ItemTileImage item={item} alt="" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-900 truncate">{item.name}</p>
                          <p className="text-[10px] uppercase tracking-wider text-stone-500 truncate">
                            {item.brand}{days.length > 1 ? ` · for ${days.length} days` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="pt-6 border-t border-stone-200">
                <h4 className="text-[10px] tracking-widest uppercase text-stone-500 mb-3 font-bold">Day by day</h4>
                <ul className="space-y-2">
                  {dayList.map((d) => (
                    <li key={d.iso} className="flex items-baseline gap-3 text-sm">
                      <span className="text-stone-500 w-20 text-[11px] tracking-wider uppercase shrink-0">{d.label}</span>
                      <span className="text-stone-900">{d.outfit ? d.outfit.name : <span className="text-stone-400 italic">— not planned —</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-8 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-3 justify-end print:hidden">
          <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
            Close
          </button>
          <button onClick={handlePrintPackingList} disabled={totalPieces === 0}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40 flex items-center gap-2">
            <Download size={14} strokeWidth={1.5} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SchedulePickerModal({ date, outfits, items, onClose, onPick }) {
  useEscapeKey(onClose);
  const formatted = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  if (outfits.length === 0) {
    return createPortal(
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
        <div className="bg-[#F7F5F2] rounded-[2rem] max-w-sm w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-stone-500 text-sm">No saved looks yet — go to <span className="font-medium">Styling Studio → Create</span> to save one, then come back to schedule it.</p>
          <button onClick={onClose} className="mt-6 bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-medium">Got it</button>
        </div>
      </div>,
      document.body
    );
  }
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Schedule for</p>
            <h3 className="text-xl font-display font-medium text-stone-900">{formatted}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {outfits.map((outfit) => {
              const pieces = resolveOutfitItems(outfit, items);
              const previewImages = pieces.slice(0, 4).map((it) => itemImageDisplay(it, 0).src || itemImages(it)[0]).filter(Boolean);
              return (
                <button key={outfit.id} onClick={() => onPick(outfit.id)} className="text-left group active:scale-[0.97] transition-transform">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-stone-100 smooth-shadow grid grid-cols-2 grid-rows-2 gap-0.5 mb-2 group-hover:smooth-shadow-lg">
                    {previewImages.length === 0 && <div className="col-span-2 row-span-2 flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>}
                    {previewImages.map((src, i) => (
                      <div key={i} className={previewImages.length === 1 ? 'col-span-2 row-span-2' : previewImages.length === 2 ? 'col-span-1 row-span-2' : (previewImages.length === 3 && i === 0 ? 'col-span-2 row-span-1' : '')}>
                        <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-stone-900 truncate px-1">{outfit.name}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider px-1">{pieces.length} pieces</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// DiaryStatsRow — the four-up stats grid inside the Diary header card.
// Wraps four DiaryStatTile children so each gets its own useCountUp
// animation and the Most Worn tile (a tap-through button) renders as
// children rather than the default animated number.
function DiaryStatsRow({ daysCount, wears, streak, mostWorn, onOpenItem }) {
  // min-w-0 on every grid item: CSS Grid items default to min-width:auto,
  // which lets a long item name (e.g. "MV Siren Mini Nugget Huggie Earrings")
  // expand the Most-Worn track past the card edge. min-w-0 lets the inner
  // truncate clamp the text to the column instead.
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
      <div className="min-w-0"><DiaryStatTile eyebrow="Days logged" value={daysCount} /></div>
      <div className="min-w-0"><DiaryStatTile eyebrow="Total wears" value={wears} /></div>
      <div className="min-w-0"><DiaryStatTile eyebrow="Current streak" value={streak} suffix={`day${streak === 1 ? '' : 's'}`} tone={streak > 0 ? 'brass' : 'dim'} /></div>
      {mostWorn && (
        <div className="col-span-2 md:col-span-1 min-w-0">
          <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-2">Most worn</p>
          <button onClick={() => onOpenItem?.(mostWorn.item.id)} className="text-left group block w-full max-w-full min-w-0">
            <p className="font-display text-base sm:text-lg text-stone-900 leading-tight group-hover:text-brass-700 transition-colors truncate">{mostWorn.item.name}</p>
            <p className="text-[10px] tracking-wider uppercase text-stone-500 mt-1">× {mostWorn.count} wear{mostWorn.count === 1 ? '' : 's'}</p>
          </button>
        </div>
      )}
    </div>
  );
}

// THE DIARY — top-level destination that merges the wear journal AND
// the planning calendar into one coherent product.
//
// Two tabs share a single editorial header + stats panel:
//   JOURNAL  — editorial scroll of what's been worn (past)
//   CALENDAR — month grid for planning + at-a-glance review (future + past)
//
// Same visual vocabulary across both: brass-rule eyebrows, display-serif
// numerals, polaroid item thumbnails, italic pull-quote notes, photo
// lightbox. The diary is now a SINGLE keepsake destination, not a feature
// fractured across Studio + Insights.
export default function DiaryView({ items = [], outfits = [], schedules = {}, onScheduleOutfit, onOpenOutfit, onSaveOutfit, onOpenItem, styleProfile = '', autoActivateRangeMode = false, initialSelectedDate = null, onDeleteTrip = null }) {
  const [tab, setTab] = useState(initialSelectedDate ? 'calendar' : 'journal');
  const [openTripId, setOpenTripId] = useState(null);
  // "Plan a trip" hand-off: switch to the Month lens and pulse WearCalendar
  // into range-select mode. (Was handlePlanTripFromTrips in OutfitBuilder.)
  const [planTripNonce, setPlanTripNonce] = useState(0);
  const handlePlanTrip = () => { setTab('calendar'); setPlanTripNonce((n) => n + 1); };
  // Trips are derived from scheduled days sharing a trip.id. Owned here now
  // (was in OutfitBuilder) so Trips live on the Calendar surface.
  const trips = useMemo(() => {
    const map = new Map();
    for (const [dateISO, entry] of Object.entries(schedules || {})) {
      if (!entry || !entry.trip || !entry.trip.id) continue;
      if (!map.has(entry.trip.id)) {
        map.set(entry.trip.id, { id: entry.trip.id, name: entry.trip.name || 'Trip', startISO: entry.trip.startISO, endISO: entry.trip.endISO, location: entry.trip.location || null, days: [] });
      }
      map.get(entry.trip.id).days.push({ dateISO, outfitId: entry.outfitId });
    }
    const today = todayISO();
    return [...map.values()].map((t) => {
      t.days.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      let status = 'upcoming';
      if (t.startISO <= today && t.endISO >= today) status = 'active';
      else if (t.endISO < today) status = 'past';
      return { ...t, status };
    }).sort((a, b) => {
      const order = { active: 0, upcoming: 1, past: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      if (a.status === 'past') return b.startISO.localeCompare(a.startISO);
      return a.startISO.localeCompare(b.startISO);
    });
  }, [schedules]);
  const [filter, setFilter] = useState('all');

  // When a "Plan a trip" CTA fires from TripsListView, switch to the
  // Calendar sub-tab so WearCalendar is visible before auto-activating range mode.
  useEffect(() => {
    if (autoActivateRangeMode) setTab('calendar');
  }, [autoActivateRangeMode]);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  // Compute wearDiary entries — every day with a logged wear, newest
  // first. Joins schedule context (event name, worn photo) so the diary
  // reads as a real record of what was worn day-to-day. Logic extracted
  // from InsightsView's inline preview and consolidated here.
  const wearDiary = useMemo(() => {
    const byDate = {};
    for (const it of items) {
      const hist = itemWearHistory(it);
      const notes = itemWearNotes(it);
      for (const d of hist) {
        if (!byDate[d]) byDate[d] = { date: d, items: [], notes: [] };
        byDate[d].items.push(it);
        if (notes[d]) byDate[d].notes.push({ itemId: it.id, itemName: it.name, note: notes[d] });
      }
    }
    for (const group of Object.values(byDate)) {
      const sched = schedules?.[group.date];
      if (sched?.outfitId) {
        const out = outfits.find((o) => o.id === sched.outfitId);
        if (out) {
          group.outfit = out;
          if (sched.eventName) group.eventName = sched.eventName;
          const photo = (out.wornPhotos || []).find((p) => p.date === group.date);
          if (photo) {
            group.photo = photo.image;
            // AI wear narration — italic pull quote rendered next to the
            // photo in the Diary. Generated when the photo is uploaded.
            if (photo.caption) group.photoCaption = photo.caption;
          }
        }
      }
    }
    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  }, [items, outfits, schedules]);

  const stats = useMemo(() => {
    const wears = wearDiary.reduce((s, e) => s + e.items.length, 0);
    const itemCounts = {};
    for (const e of wearDiary) {
      for (const it of e.items) {
        if (!itemCounts[it.id]) itemCounts[it.id] = { item: it, count: 0 };
        itemCounts[it.id].count++;
      }
    }
    const mostWorn = Object.values(itemCounts).sort((a, b) => b.count - a.count)[0] || null;
    let streak = 0;
    if (wearDiary.length > 0) {
      const dateSet = new Set(wearDiary.map((e) => e.date));
      const cursorISO = (c) => c.toISOString().slice(0, 10);
      const cursor = new Date(todayISO() + 'T00:00:00');
      if (!dateSet.has(cursorISO(cursor))) cursor.setDate(cursor.getDate() - 1);
      if (dateSet.has(cursorISO(cursor))) {
        while (dateSet.has(cursorISO(cursor))) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
      }
    }
    return { wears, mostWorn, streak };
  }, [wearDiary]);

  const filtered = useMemo(() => {
    if (filter === 'all') return wearDiary;
    return wearDiary.filter((e) => {
      if (filter === 'photos') return !!e.photo;
      if (filter === 'notes') return e.notes && e.notes.length > 0;
      if (filter === 'outfits') return !!e.outfit;
      if (filter === 'events') return !!e.eventName;
      return true;
    });
  }, [wearDiary, filter]);

  const byMonth = useMemo(() => {
    const groups = {};
    for (const e of filtered) {
      const ym = e.date.slice(0, 7);
      if (!groups[ym]) groups[ym] = { ym, days: [], wears: 0, itemCounts: {} };
      groups[ym].days.push(e);
      groups[ym].wears += e.items.length;
      for (const it of e.items) {
        if (!groups[ym].itemCounts[it.id]) groups[ym].itemCounts[it.id] = { item: it, count: 0 };
        groups[ym].itemCounts[it.id].count++;
      }
    }
    for (const g of Object.values(groups)) {
      g.days.sort((a, b) => b.date.localeCompare(a.date));
      g.mostWorn = Object.values(g.itemCounts).sort((a, b) => b.count - a.count)[0] || null;
    }
    return Object.values(groups).sort((a, b) => b.ym.localeCompare(a.ym));
  }, [filtered]);

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'photos', label: 'With photos' },
    { id: 'notes', label: 'With notes' },
    { id: 'outfits', label: 'Saved outfits' },
    { id: 'events', label: 'Events' },
  ];

  return (
    <div>
      {/* EDITORIAL HEADER — the cover of the destination */}
      <header className="mb-8 sm:mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="brass-rule" aria-hidden="true" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-stone-500 font-medium">Calendar</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-stone-900 tracking-tight leading-[0.95]">
          Every wear, every plan
        </h1>
        <p className="font-display italic text-stone-500 text-lg sm:text-xl mt-5 max-w-xl leading-relaxed">
          Your calendar and your journal — one keepsake of how you actually dress.
        </p>
      </header>

      {/* STATS PANEL — shared by both tabs. Numbers count up on mount
          via useCountUp() for the luxury "this was carefully calculated"
          feel. Reduced-motion users get the final value instantly. */}
      {wearDiary.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 sm:p-8 mb-8 smooth-shadow">
          <DiaryStatsRow daysCount={wearDiary.length} wears={stats.wears} streak={stats.streak} mostWorn={stats.mostWorn} onOpenItem={onOpenItem} />
        </div>
      )}

      {/* UPCOMING TRIPS — Trips now live on the Calendar (was a Lookbook tab).
          A slim strip of active/upcoming trips + a Plan-a-trip entry. */}
      {trips.filter((t) => t.status !== 'past').length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <span className="brass-rule" aria-hidden="true" />
              <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Upcoming trips</span>
            </div>
            <button type="button" onClick={handlePlanTrip} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 px-3 py-1.5 border border-stone-200 rounded-full hover:border-stone-500 transition-colors">＋ Plan a trip</button>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
            {trips.filter((t) => t.status !== 'past').map((t) => (
              <button key={t.id} type="button" onClick={() => setOpenTripId(t.id)} className="shrink-0 text-left bg-white border border-stone-200/60 rounded-2xl p-4 smooth-shadow hover:border-brass-300 transition-colors min-w-[220px]">
                <p className="text-[9px] tracking-[0.25em] uppercase text-brass-600 mb-1">{t.status === 'active' ? 'Active' : 'Upcoming'}</p>
                <p className="font-display text-stone-900 text-lg leading-tight truncate">{t.name}</p>
                {t.location && <p className="text-[11px] text-stone-500 truncate">{t.location}</p>}
                <p className="text-[10px] text-stone-400 mt-1 tracking-wide">
                  {new Date(t.startISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {new Date(t.endISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {t.days.length} day{t.days.length === 1 ? '' : 's'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB TOGGLE — segmented control matching the app's tab convention */}
      <div className="flex justify-center mb-8 sm:mb-10">
        <div className="flex bg-stone-200/50 p-1.5 rounded-full">
          {[
            { id: 'journal', label: 'Journal' },
            { id: 'calendar', label: 'Month' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-6 sm:px-8 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-colors duration-200 ${
                tab === t.id ? 'bg-white text-stone-900 font-medium shadow-sm' : 'text-stone-500 hover:text-stone-900'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT */}
      {tab === 'calendar' ? (
        <div>
          {/* CALENDAR — wrapped in the same visual vocabulary so it
              feels like the diary's second face, not a different product. */}
          <WearCalendar
            items={items}
            outfits={outfits}
            schedules={schedules}
            onScheduleOutfit={onScheduleOutfit}
            onOpenOutfit={onOpenOutfit}
            onSaveOutfit={onSaveOutfit}
            styleProfile={styleProfile}
            onOpenItem={onOpenItem}
            autoActivateRangeMode={autoActivateRangeMode}
            initialSelectedDate={initialSelectedDate}
            planTripNonce={planTripNonce}
          />
        </div>
      ) : (
        <div>
          {/* FILTER CHIPS — only shown in Journal tab */}
          {wearDiary.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              {FILTERS.map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={`px-4 py-2 text-[11px] tracking-widest uppercase rounded-full transition-colors duration-200 ${
                    filter === f.id
                      ? 'bg-stone-900 text-white'
                      : 'bg-white text-stone-600 border border-stone-300 hover:border-stone-500 hover:text-stone-900'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* EMPTY STATES */}
          {wearDiary.length === 0 ? (
            <div className="bg-white border border-stone-200/60 rounded-[2rem] p-12 sm:p-16 text-center smooth-shadow">
              <p className="font-display italic text-stone-400 text-xl sm:text-2xl mb-3">No wears logged yet.</p>
              <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">Log a wear from any item or outfit and it will begin to appear here — the start of your style record.</p>
              <button onClick={() => setTab('calendar')}
                className="mt-6 inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-stone-700 hover:text-brass-700 transition-colors">
                <Calendar size={14} strokeWidth={1.5} />
                Open the calendar
              </button>
            </div>
          ) : byMonth.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-display italic text-stone-400 text-lg mb-3">No entries match this filter.</p>
              <button onClick={() => setFilter('all')}
                className="text-[11px] tracking-widest uppercase text-brass-600 hover:text-brass-700 transition-colors">
                Show all
              </button>
            </div>
          ) : (
            <>
              {byMonth.map((month) => {
                const monthDate = new Date(month.ym + '-01');
                const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long' });
                const monthYear = monthDate.toLocaleDateString('en-GB', { year: 'numeric' });
                return (
                  <section key={month.ym} className="mb-16 sm:mb-20">
                    <div className="mb-10 pb-6 border-b border-stone-200">
                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="inline-block w-6 h-px bg-brass-400" aria-hidden="true" />
                        <span className="text-[10px] tracking-[0.3em] uppercase text-stone-500">{monthYear}</span>
                      </div>
                      <h2 className="font-display text-3xl sm:text-4xl text-stone-900 mb-3 tracking-tight">{monthName}</h2>
                      <div className="flex items-baseline gap-5 text-sm text-stone-500 flex-wrap">
                        <span><strong className="text-stone-900 font-display text-base">{month.days.length}</strong> day{month.days.length === 1 ? '' : 's'}</span>
                        <span><strong className="text-stone-900 font-display text-base">{month.wears}</strong> wear{month.wears === 1 ? '' : 's'}</span>
                        {month.mostWorn && (
                          <span className="text-stone-500">
                            Most worn:{' '}
                            <button onClick={() => onOpenItem?.(month.mostWorn.item.id)}
                              className="text-stone-900 font-medium hover:text-brass-700 transition-colors">
                              {month.mostWorn.item.name}
                            </button>{' '}
                            <span className="text-stone-400">× {month.mostWorn.count}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-10 sm:space-y-14">
                      {month.days.map((day) => {
                        const d = new Date(day.date + 'T00:00:00');
                        const dayNum = d.getDate();
                        const dayWeek = d.toLocaleDateString('en-GB', { weekday: 'short' });
                        const today = todayISO();
                        const isToday = day.date === today;
                        const yest = new Date(); yest.setDate(yest.getDate() - 1);
                        const isYesterday = day.date === yest.toISOString().slice(0, 10);
                        const relativeLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : null;
                        return (
                          <li key={day.date} className="grid grid-cols-[auto_1fr] gap-5 sm:gap-8 items-start">
                            <div className="shrink-0 w-16 sm:w-24 text-right" style={{ position: 'sticky', top: '6rem' }}>
                              <p className={`font-display text-4xl sm:text-6xl leading-none ${isToday ? 'text-brass-600' : 'text-stone-900'}`}>{dayNum}</p>
                              <p className="text-[9px] tracking-[0.25em] uppercase text-stone-500 mt-2">{dayWeek}</p>
                              {relativeLabel && (
                                <p className="font-display italic text-xs text-brass-600 mt-1.5">{relativeLabel}</p>
                              )}
                              {day.eventName && (
                                <p className="font-display italic text-[11px] text-stone-500 mt-2 leading-tight">{day.eventName}</p>
                              )}
                            </div>

                            <div className="min-w-0 space-y-3 pt-2">
                              {day.photo && (
                                <div className="max-w-2xl">
                                  <button
                                    type="button"
                                    onClick={() => setLightboxPhoto({ src: day.photo, date: day.date, caption: day.photoCaption })}
                                    className="block w-full group"
                                    aria-label="View larger"
                                  >
                                    <div className="aspect-[4/5] sm:aspect-[3/2] rounded-2xl overflow-hidden bg-stone-100 ring-1 ring-stone-200/60 shadow-[0_2px_8px_rgba(28,25,23,0.06),0_12px_32px_-12px_rgba(28,25,23,0.18)] group-hover:shadow-[0_4px_12px_rgba(28,25,23,0.08),0_20px_44px_-12px_rgba(28,25,23,0.24)] transition-shadow duration-300">
                                      <img src={day.photo} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                    </div>
                                  </button>
                                  {/* AI WEAR NARRATION — italic memory line
                                      generated when the photo was uploaded.
                                      Brass-rule eyebrow signals 'stylist's
                                      note' so the user reads it as voice,
                                      not auto-summary. */}
                                  {day.photoCaption && (
                                    <div className="mt-3 flex items-baseline gap-2.5">
                                      <span className="inline-block w-4 h-px bg-brass-400 shrink-0 translate-y-2" aria-hidden="true" />
                                      <p className="font-display italic text-stone-700 leading-relaxed text-sm sm:text-base">
                                        {day.photoCaption}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-2 sm:gap-2.5 flex-wrap">
                                {day.items.map((it) => (
                                  <button key={it.id} onClick={() => onOpenItem?.(it.id)}
                                    className="w-14 sm:w-16 aspect-[3/4] rounded-lg overflow-hidden bg-white ring-1 ring-stone-200/70 shadow-sm hover:ring-brass-400 hover:shadow-md transition-all"
                                    title={`${it.name}${it.brand ? ' · ' + it.brand : ''}`}
                                  >
                                    {itemImages(it)[0] ? (
                                      <ItemTileImage item={it} alt={it.name} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={20} strokeWidth={1} /></div>
                                    )}
                                  </button>
                                ))}
                              </div>

                              {day.outfit && onOpenOutfit && (
                                <button onClick={() => onOpenOutfit(day.outfit.id)}
                                  className="inline-flex items-center gap-1.5 text-xs tracking-wide text-stone-700 hover:text-brass-700 mt-1 group transition-colors">
                                  <span className="border-b border-stone-300 group-hover:border-brass-500 pb-0.5 transition-colors">{day.outfit.name}</span>
                                  <ChevronRight size={12} strokeWidth={1.5} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                                </button>
                              )}

                              {day.notes.length > 0 && (
                                <div className="mt-3 space-y-3 max-w-2xl">
                                  {day.notes.map((n, i) => (
                                    <blockquote key={i} className="relative pl-5 border-l-2 border-brass-300">
                                      <span className="absolute -left-1 -top-2 font-display text-2xl text-brass-400 leading-none select-none" aria-hidden="true">&ldquo;</span>
                                      <p className="font-display italic text-stone-700 leading-relaxed text-sm sm:text-base">{n.note}</p>
                                    </blockquote>
                                  ))}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* PHOTO LIGHTBOX */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-[80] bg-stone-950/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setLightboxPhoto(null)}>
          <button onClick={(e) => { e.stopPropagation(); setLightboxPhoto(null); }}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur"
            aria-label="Close photo">
            <X size={20} strokeWidth={1.5} />
          </button>
          <img src={lightboxPhoto.src} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-6 left-0 right-0 text-center px-6 space-y-2">
            {lightboxPhoto.caption && (
              <p className="font-display italic text-white/90 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
                {lightboxPhoto.caption}
              </p>
            )}
            <p className="text-[10px] tracking-[0.3em] uppercase text-white/60">
              {new Date(lightboxPhoto.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Trip detail — opened from the Upcoming-trips strip. Lives on the
          Calendar surface now (was in OutfitBuilder / Lookbook). */}
      {openTripId && (() => {
        const trip = trips.find((t) => t.id === openTripId);
        if (!trip) return null;
        return (
          <TripDetailView
            trip={trip}
            outfits={outfits}
            items={items}
            schedules={schedules}
            onClose={() => setOpenTripId(null)}
            onOpenOutfit={(id) => { setOpenTripId(null); onOpenOutfit?.(id); }}
            onDeleteTrip={onDeleteTrip ? async () => { await onDeleteTrip(trip); setOpenTripId(null); } : null}
          />
        );
      })()}
    </div>
  );
}
