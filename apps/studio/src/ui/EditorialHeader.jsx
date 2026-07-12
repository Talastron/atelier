import React from 'react';

// Editorial section header. Pattern: brass rule + small-caps eyebrow + Playfair
// title + optional muted subtitle. Used at the top of every primary tab view
// to give the app a unified printed-magazine voice.
export default function EditorialHeader({ eyebrow, title, subtitle, right, className = '' }) {
  return (
    <header className={`flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-3 mb-3">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">{eyebrow}</span>
          </div>
        )}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display text-stone-900 tracking-tight leading-[1.05]">{title}</h2>
        {subtitle && <p className="text-stone-500 mt-3 text-sm tracking-wide max-w-xl leading-relaxed truncate min-w-0">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 self-start md:self-auto">{right}</div>}
    </header>
  );
}
