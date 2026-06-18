import React from 'react';

export function BrassRule() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 'var(--atelier-brass-rule-width)',
        height: 'var(--atelier-brass-rule-height)',
        backgroundColor: 'var(--atelier-brass-300)',
      }}
    />
  );
}
