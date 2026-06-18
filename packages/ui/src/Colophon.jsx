import React from 'react';
import { BrassRule } from './BrassRule.jsx';

/**
 * Closing ornament for journal entries.
 * Brass rule — ornamental glyph (default § ) — brass rule, centred.
 */
export function Colophon({ mark = '§' }) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center gap-5 mt-20 mb-2"
    >
      <BrassRule />
      <span
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontStyle: 'italic',
          fontSize: '1.5rem',
          lineHeight: 1,
          color: 'var(--atelier-brass-600)',
        }}
      >
        {mark}
      </span>
      <BrassRule />
    </div>
  );
}
