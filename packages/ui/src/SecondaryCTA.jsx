import React from 'react';

export function SecondaryCTA({ href, children, className = '' }) {
  return (
    <a
      href={href}
      className={`bg-[var(--atelier-brass-300)] text-stone-900 px-8 py-4 rounded-full text-base font-medium hover:bg-[var(--atelier-brass-200)] transition-all shadow-lg active:scale-95 inline-flex items-center gap-2 ${className}`}
    >
      {children}
    </a>
  );
}
