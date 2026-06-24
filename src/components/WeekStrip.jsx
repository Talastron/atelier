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
// schedules: { 'YYYY-MM-DD': { outfitId } }
export default function WeekStrip({ events = [], schedules = {}, onSelectDay }) {
  const days = nextSevenDays();
  const today = days[0];
  // Which days have at least one event (group events by local date).
  const eventDays = new Set(
    events.map((e) => (e.allDay ? String(e.startISO).slice(0, 10) : new Date(e.startISO).toLocaleDateString('en-CA')))
  );

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-2">
        <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
        <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500">Your week</span>
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
    </div>
  );
}
