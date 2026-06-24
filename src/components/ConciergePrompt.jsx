import React from 'react';
import { Sparkles } from 'lucide-react';

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

export default function ConciergePrompt({ events = [], onOpen }) {
  const { text, hint } = suggestQuestion(events);
  return (
    <button
      type="button"
      onClick={() => onOpen?.()}
      className="w-full text-left bg-stone-900 rounded-2xl p-5 hover:bg-stone-800 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-brass-300" strokeWidth={1.5} />
        <span className="text-[10px] tracking-[0.28em] uppercase text-brass-300">Ask your stylist</span>
      </div>
      <div className="inline-block bg-stone-800 group-hover:bg-stone-700 rounded-full px-4 py-2 text-stone-100 text-sm italic transition-colors">
        “{text}”
      </div>
      <p className="text-stone-400 text-[11px] mt-3">{hint}</p>
    </button>
  );
}
