import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

// Picks a suggested question from the coming week's events. If an event exists
// beyond today, suggest that weekday; else default to "today".
function suggestQuestion(events = []) {
  const todayISO = new Date().toLocaleDateString('en-CA');
  const upcoming = events
    .filter((e) => {
      const day = e.allDay ? String(e.startISO).slice(0, 10) : new Date(e.startISO).toLocaleDateString('en-CA');
      return day > todayISO;
    })
    .sort((a, b) => String(a.startISO).localeCompare(String(b.startISO)));
  if (upcoming.length > 0) {
    const day = new Date(upcoming[0].startISO);
    const weekday = day.toLocaleDateString('en-GB', { weekday: 'long' });
    return { text: `What should I wear ${weekday}?`, hint: `You have ${upcoming[0].title}` };
  }
  return { text: 'What should I wear today?', hint: 'Your stylist is one tap away' };
}

// A slim concierge command bar — this only opens the stylist sidebar, so it's a
// single elegant line, not a full panel. The one deliberate dark accent on the
// page; its brevity is the point (no ballooned whitespace).
export default function ConciergePrompt({ events = [], onOpen }) {
  const { text, hint } = suggestQuestion(events);
  return (
    <button
      type="button"
      onClick={() => onOpen?.()}
      className="group flex w-full items-center gap-4 rounded-2xl bg-stone-900 px-5 py-4 text-left transition-colors hover:bg-stone-800 sm:px-6"
    >
      <Sparkles size={18} strokeWidth={1.4} className="shrink-0 text-brass-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.22em] text-brass-300">Ask your stylist</p>
        {/* Question + hint on their own lines so neither is clipped on narrow
            mobile widths (there's ample vertical room). On wider screens the
            hint tucks back inline after the question. */}
        <p className="mt-0.5 text-sm text-stone-100">
          <span className="font-display italic">“{text}”</span>
          <span className="block text-stone-500 sm:inline"><span className="hidden sm:inline"> · </span>{hint}</span>
        </p>
      </div>
      <ArrowRight size={16} strokeWidth={1.5} className="shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}
