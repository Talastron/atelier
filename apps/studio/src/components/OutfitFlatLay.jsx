import React from 'react';
import { Shirt, ChevronRight } from 'lucide-react';
import Flatlay from './Flatlay.jsx';
import ItemTileImage from './ItemTileImage.jsx';
import { itemColors, itemImages } from '../lib/items.js';

// The look, composed as a flat-lay, with its credits beneath.
//
// The composition itself belongs to <Flatlay>, which places pieces anatomically
// from the shared geometry engine — so a look is arranged identically here and
// on the Lookbook card. This component's remaining job is the credits: grouping
// the pieces by category and keeping both halves in step with the palette
// filter, so clicking a colour dims the same garments in the composition and in
// the list.
export default function OutfitFlatLay({ pieces, onOpenItem, paletteFilter = null }) {
  // Helper: does this piece have a colour matching the active palette filter?
  const pieceMatchesFilter = (piece) => {
    if (!paletteFilter) return true;
    const colours = (itemColors(piece) || []).map((c) => (c || '').toLowerCase().trim());
    return colours.includes(paletteFilter);
  };
  const ORDER = ['Outerwear', 'Dresses', 'Tops', 'Swimwear', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
  const sortByOrder = (a, b) => {
    const ai = ORDER.indexOf(a.category); const bi = ORDER.indexOf(b.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  };

  // Ordering for the credits list below the composition. (The composition
  // itself is ordered by composeFlatlay, which applies the same
  // silhouette-before-finishing rule.)
  const orderedAll = [...pieces].sort(sortByOrder);

  return (
    <div>
      <div className="relative rounded-[2rem] border border-stone-200/60 overflow-hidden">
        <Flatlay
          pieces={pieces}
          max={8}
          aspect="1 / 1"
          onOpenItem={onOpenItem}
          paletteFilter={paletteFilter}
        />
      </div>

      {/* Credits list — items grouped by category, each group a self-contained
          editorial block. Thumbnails make it scan-able; single eyebrow per
          category eliminates the repetition that read as a flat database table.
          On desktop the groups still flow into two columns via columns-2 css
          (each group is a single column-break-inside unit so it never splits
          mid-group). */}
      {(() => {
        // Group by category, preserve the orderedAll sort within each group.
        const grouped = new Map();
        for (const p of orderedAll) {
          const cat = p.category || 'Other';
          if (!grouped.has(cat)) grouped.set(cat, []);
          grouped.get(cat).push(p);
        }
        return (
          <div className="mt-8 sm:columns-2 sm:gap-x-10 space-y-6 sm:space-y-0">
            {[...grouped.entries()].map(([category, items]) => (
              <div key={category} className="break-inside-avoid mb-6 sm:mb-8">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
                  <span className="text-xs tracking-eyebrow uppercase font-medium text-stone-600">{category}</span>
                  <span className="text-xs text-stone-300">·</span>
                  <span className="text-xs tracking-meta text-stone-400">{items.length}</span>
                </div>
                <ul className="space-y-0">
                  {items.map((p, i) => {
                    const openable = !!(onOpenItem && p.id);
                    const thumb = itemImages(p)[0];
                    const Tag = openable ? 'button' : 'div';
                    const creditsDimmed = !pieceMatchesFilter(p);
                    return (
                      <li key={p.id || i} className={`border-b border-stone-200/50 last:border-0 transition-opacity duration-300 ${creditsDimmed ? 'opacity-30' : 'opacity-100'}`}>
                        <Tag
                          {...(openable ? { type: 'button', onClick: () => onOpenItem(p.id), 'aria-label': `Open ${p.name}` } : {})}
                          className={`w-full flex items-center gap-3 py-2.5 text-left ${openable ? 'group cursor-pointer hover:bg-stone-100/50 -mx-2 px-2 rounded-lg transition-colors' : ''}`}
                        >
                          {/* Thumbnail */}
                          {/* 64px, not 44. The composition above shows these
                              same garments at 185-333px, so a 44px chip named
                              the piece at a twelfth of the size it had been
                              drawn at four rows earlier - a drop big enough to
                              read as a broken thumbnail rather than an index. */}
                          <div className="w-16 h-16 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden shrink-0">
                            {thumb ? (
                              <ItemTileImage item={p} alt={p.name || ""} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <Shirt size={18} strokeWidth={1} />
                              </div>
                            )}
                          </div>
                          {/* Name + brand */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm text-stone-900 truncate leading-tight ${openable ? 'group-hover:text-brass-700 transition-colors' : ''}`}>
                              {p.name}
                            </p>
                            <p className="text-xs tracking-meta uppercase text-stone-500 truncate mt-0.5">
                              {p.brand || ' '}
                            </p>
                          </div>
                          {/* Price */}
                          <span className="text-xs tabular-nums text-stone-500 shrink-0">
                            £{Number(p.price || 0).toLocaleString()}
                          </span>
                          {openable && (
                            <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0 group-hover:text-brass-500 transition-colors" />
                          )}
                        </Tag>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
