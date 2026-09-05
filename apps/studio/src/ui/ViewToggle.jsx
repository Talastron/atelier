import React from 'react';
import { Shapes, LayoutGrid } from 'lucide-react';

// The flat-lay / grid pill, in one place.
//
// There were two of these, hand-written, and the Lookbook's carried the
// comment "Mirrors the pill on the look detail so the same choice looks like
// the same choice in both places." It did not: the Lookbook had icons,
// role="group", aria-pressed and a tooltip; the look detail had none of them
// and forgot the choice on every visit. Two implementations of one control
// drift, and these already had.
//
// Adding a third for the Daily Brief would have repeated the mistake the
// flat-lay work exists to undo — "a second way of drawing a look, written
// when there was only one". So there is one component, and the comment is
// true now rather than aspirational.
const VIEWS = [
  ['flatlay', 'Flat-lay', Shapes],
  ['grid', 'Grid', LayoutGrid],
];

export default function ViewToggle({ value, onChange, label = 'View style', className = '' }) {
  return (
    <div className={`flex bg-stone-200/50 p-1 rounded-full ${className}`} role="group" aria-label={label}>
      {VIEWS.map(([view, text, Icon]) => (
        <button
          key={view}
          type="button"
          onClick={() => onChange(view)}
          aria-pressed={value === view}
          title={`Show as ${text.toLowerCase()}`}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs tracking-meta uppercase transition-colors duration-200 ${
            value === view
              ? 'bg-white text-stone-900 font-medium'
              : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <Icon size={12} strokeWidth={1.5} />
          {text}
        </button>
      ))}
    </div>
  );
}
