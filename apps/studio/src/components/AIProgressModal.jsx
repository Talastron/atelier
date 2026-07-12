import React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';

// Full-screen "Atelier is composing…" overlay shown while a Gemini call is in
// flight. Shared by the Styling Studio (outfit compose) and the Inspiration
// analyser. `stage` is a rotating status line; `title` labels the task.
export default function AIProgressModal({ open, stage, title = 'Putting together your outfit' }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-[#F7F5F2] rounded-[2rem] max-w-md w-full p-8 sm:p-12 shadow-2xl text-center animate-in slide-in-from-bottom-4 zoom-in-95 duration-300">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <span className="absolute inset-0 rounded-full bg-amber-300/40 animate-ping" />
          <span className="absolute inset-2 rounded-full bg-amber-200/40 animate-ping" style={{ animationDelay: '0.4s' }} />
          <div className="relative w-full h-full rounded-full bg-stone-900 flex items-center justify-center shadow-2xl">
            <Sparkles size={32} strokeWidth={1.5} className="text-brass-300" />
          </div>
        </div>
        <h3 className="font-display text-2xl text-stone-900 mb-3">{title}</h3>
        <p className="text-stone-500 text-sm leading-relaxed min-h-[2rem] transition-opacity duration-500" key={stage}>
          {stage || 'Just a moment…'}
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-stone-900 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-stone-700 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-[10px] text-stone-400 tracking-widest uppercase mt-6">Composed by Atelier</p>
      </div>
    </div>,
    document.body
  );
}
