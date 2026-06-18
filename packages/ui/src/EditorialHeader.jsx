import React from 'react';
import { BrassRule } from './BrassRule.jsx';

export function EditorialHeader({ eyebrow, title, subtitle, className = '', align = 'left' }) {
  const isCenter = align === 'center';
  return (
    <header className={`flex flex-col gap-4 ${isCenter ? 'items-center text-center' : ''} ${className}`}>
      {eyebrow && (
        <div className="flex items-center gap-3 mb-1">
          <BrassRule />
          <span
            className="text-[10px] font-medium text-stone-500 uppercase"
            style={{ letterSpacing: 'var(--atelier-tracking-eyebrow)' }}
          >
            {eyebrow}
          </span>
          {isCenter && <BrassRule />}
        </div>
      )}
      <h2
        className="text-3xl sm:text-4xl md:text-5xl tracking-tight text-stone-900"
        style={{
          fontFamily: 'var(--atelier-font-display)',
          lineHeight: 'var(--atelier-leading-display)',
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="text-stone-500 text-base md:text-lg max-w-xl"
          style={{ lineHeight: 'var(--atelier-leading-body)' }}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}
