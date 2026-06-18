import React from 'react';

const ROMANS = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
];

export function RomanNumeral({ n, className = '' }) {
  const value = ROMANS[n] ?? String(n);
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--atelier-font-display)',
        fontStyle: 'italic',
        fontWeight: 400,
        color: 'var(--atelier-brass-600)',
        fontFeatureSettings: '"onum" on',
        letterSpacing: '0.02em',
      }}
    >
      {value}
    </span>
  );
}
