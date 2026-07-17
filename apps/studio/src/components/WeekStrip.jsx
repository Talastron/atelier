import React from 'react';

// Builds an array of the next 7 local days as YYYY-MM-DD.
function nextSevenDays() {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d.toLocaleDateString('en-CA')); // YYYY-MM-DD, local
  }
  return out;
}

// events: array of { startISO, allDay, ... } for the coming week (may be []).
// schedules: { 'YYYY-MM-DD': { outfitId, eventName } }
// outfits: the live outfit list, so a planned day can NAME its look. The strip
// has always known a day has a plan, but only rendered it as an anonymous dash;
// "Needs attention" carried the name, which is a schedule rather than something
// needing attention. The name belongs here, beside the day it happens on.
export default function WeekStrip({ events = [], schedules = {}, outfits = [], onSelectDay, onOpenOutfit }) {
  const days = nextSevenDays();
  const today = days[0];
  const tomorrow = days[1];
  // Which days have at least one event (group events by local date).
  const eventDays = new Set(
    events.map((e) => (e.allDay ? String(e.startISO).slice(0, 10) : new Date(e.startISO).toLocaleDateString('en-CA')))
  );

  const first = new Date(days[0] + 'T00:00:00');
  const last = new Date(days[6] + 'T00:00:00');
  const range = `${first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

  // Resolve defensively: a schedule can outlive the outfit it points at.
  const planFor = (iso, label) => {
    const outfitId = schedules[iso]?.outfitId;
    if (!outfitId) return null;
    const outfit = outfits.find((o) => o.id === outfitId);
    if (!outfit) return null;
    const eventName = schedules[iso]?.eventName;
    return { outfit, label: eventName ? `${label} · ${eventName}` : label };
  };
  const plans = [planFor(today, 'Today'), planFor(tomorrow, 'Tomorrow')].filter(Boolean);

  return (
    <div className="rounded-3xl border border-stone-200/70 bg-white p-6 sm:p-7 smooth-shadow">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="font-display text-lg sm:text-xl text-stone-900">Your week</h3>
        <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{range}</span>
      </div>
      <div className="flex gap-1.5">
        {days.map((iso) => {
          const isToday = iso === today;
          const hasEvent = eventDays.has(iso);
          const hasPlan = !!schedules[iso];
          const d = new Date(iso + 'T00:00:00');
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay?.(iso)}
              className="flex-1 min-w-0 flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-stone-100 transition-colors"
              aria-label={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            >
              <span className="text-[10px] tracking-wide uppercase text-stone-400">
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm tabular-nums ${isToday ? 'bg-stone-900 text-white' : 'text-stone-800'}`}>
                {d.getDate()}
              </span>
              <span className="flex items-center gap-1 h-2">
                {hasEvent && <span className="w-1.5 h-1.5 rounded-full bg-brass-400" aria-hidden="true" />}
                {hasPlan && <span className="w-2 h-px bg-stone-400" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
      {plans.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-stone-200/60 pt-3">
          {plans.map(({ outfit, label }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => onOpenOutfit?.(outfit.id)}
                className="w-full flex items-center gap-2 text-left py-1 px-2 -mx-2 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400 shrink-0">{label}</span>
                <span className="text-sm text-stone-900 truncate">{outfit.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
