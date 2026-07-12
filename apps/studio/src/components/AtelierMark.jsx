import React from 'react';

// The Atelier logo mark — a hanger silhouette with a brass charm.
// Mirrors /public/icon.svg exactly so the brand reads the same everywhere
// (favicon, sidebar, sign-in, public share viewer). Pure SVG, zero deps.
export default function AtelierMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="256" height="256" fill="#1c1917" rx="56" />
      <g fill="none" stroke="#F7F5F2" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110" />
        <path d="M 128 110 L 62 184 L 194 184 Z" />
      </g>
      <line x1="128" y1="184" x2="128" y2="206" stroke="#D4B378" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="128" cy="212" r="5" fill="#D4B378" />
    </svg>
  );
}
