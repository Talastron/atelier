import React from 'react';
import { Star } from 'lucide-react';

/**
 * ItemCardPreview — replica of the studio app's wardrobe grid card
 * (src/App.jsx:5216 region). 3:4 photo with smooth-shadow → shadow-xl on
 * hover, image zoom on hover, brand eyebrow + price row, Playfair title,
 * category line with colour swatches, optional brass favourite star.
 *
 * Renders with sample data only — no state.
 */

const COLOR_SWATCHES = {
  camel: '#C4A47A',
  ivory: '#F4EFE6',
  navy: '#1F2A44',
  charcoal: '#36373A',
  black: '#1B1B1C',
  stone: '#A8A29E',
  champagne: '#E8D9BC',
  pewter: '#9BA1A6',
  cream: '#F4EFE6',
  brass: '#C7A26A',
  white: '#FAFAF9',
  tan: '#B58761',
};

export function ItemCardPreview({
  imageSrc,
  brand,
  name,
  category,
  subCategory,
  price,
  seasons = [],
  colors = [],
  favourite = false,
}) {
  return (
    <article className="group relative flex flex-col gap-4 cursor-pointer">
      {/* Photo surface — 3:4 aspect, soft shadow, lifts on hover */}
      <div
        className="aspect-[3/4] rounded-2xl bg-stone-100 relative overflow-hidden transition-shadow duration-500"
        style={{
          boxShadow: 'var(--atelier-shadow-smooth)',
        }}
      >
        {/* Favourite star — top right */}
        <button
          type="button"
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full transition-all shadow-sm"
          style={{
            backgroundColor: favourite ? 'var(--atelier-brass-300)' : 'rgba(255,255,255,0.85)',
            color: favourite ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-400)',
            backdropFilter: 'blur(6px)',
          }}
          aria-label={favourite ? 'Marked favourite' : 'Mark as favourite'}
        >
          <Star
            size={16}
            strokeWidth={1.5}
            style={favourite ? { fill: 'currentColor' } : undefined}
          />
        </button>

        <img
          src={imageSrc}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>

      {/* Caption block */}
      <div className="px-1">
        <div className="flex justify-between items-start mb-1.5 gap-4">
          <p
            className="text-[10px] uppercase truncate font-semibold"
            style={{
              letterSpacing: '0.2em',
              color: 'var(--atelier-stone-500)',
            }}
          >
            {brand}
            {seasons.length > 0 && ` • ${seasons.join(' · ')}`}
          </p>
          <p className="text-sm font-medium shrink-0" style={{ color: 'var(--atelier-stone-900)' }}>
            £{price}
          </p>
        </div>
        <h3
          className="text-lg leading-snug"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            color: 'var(--atelier-stone-800)',
          }}
        >
          {name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {(category || subCategory) && (
            <p className="text-xs" style={{ color: 'var(--atelier-stone-500)' }}>
              {category}{subCategory ? ` • ${subCategory}` : ''}
            </p>
          )}
          {colors.length > 0 && (
            <div className="flex gap-1">
              {colors.slice(0, 3).map((c) => (
                <span
                  key={c}
                  title={c}
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: COLOR_SWATCHES[c] || '#D6D3D1',
                    border: '1px solid rgba(168,162,158,0.4)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
