import React from 'react';

export function PrimaryCTA({ href, children, className = '', icon = null }) {
  return (
    <a
      href={href}
      className={`bg-stone-900 text-white px-8 py-4 rounded-full text-base font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-95 inline-flex items-center gap-2 ${className}`}
    >
      {children}
      {icon}
    </a>
  );
}
