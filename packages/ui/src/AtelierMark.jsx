import React from 'react';
import { colors } from '@atelier/design-tokens';

export function AtelierMark({ size = 40, light = false }) {
  const bg = light ? colors.stone[800] : colors.stone[900];
  const line = light ? colors.stone[400] : colors.cream;
  const brass = colors.brass[300];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="256" height="256" fill={bg} rx="56" />
      <g
        fill="none"
        stroke={line}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110" />
        <path d="M 128 110 L 62 184 L 194 184 Z" />
      </g>
      <line
        x1="128" y1="184" x2="128" y2="206"
        stroke={brass} strokeWidth="1.5" strokeLinecap="round" opacity="0.8"
      />
      <circle cx="128" cy="212" r="5" fill={brass} />
    </svg>
  );
}
