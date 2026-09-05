import React from 'react';
import { Shirt } from 'lucide-react';
import ItemTileImage from './ItemTileImage.jsx';
import { itemImages } from '../lib/items.js';

// A look as a grid of plates — the alternative reading to the composition.
//
// Lifted unchanged from the look detail, where it lived inline, so the Daily
// Brief can offer the same choice without a second copy. The flat-lay was
// built to replace grids like this as the DEFAULT; kept as a deliberate
// option it is a different thing, because a grid names every piece at an
// equal size and that is genuinely easier to scan when you want the list
// rather than the outfit.
export default function OutfitGrid({ pieces = [], onOpenItem }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 md:gap-6">
      {pieces.map((piece, i) => {
        const openable = !!(onOpenItem && piece.id);
        const Tag = openable ? 'button' : 'div';
        return (
          <Tag
            key={piece.id || i}
            {...(openable ? { type: 'button', onClick: () => onOpenItem(piece.id), 'aria-label': `Open ${piece.name}` } : {})}
            className={`flex flex-col gap-3 text-left ${openable ? 'group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded-2xl' : ''}`}
          >
            <div className={`aspect-[3/4] rounded-2xl overflow-hidden bg-white border border-stone-200/60 transition-colors duration-300 ${openable ? 'lg:group-hover:border-brass-300/70' : ''}`}>
              {itemImages(piece)[0] ? (
                <ItemTileImage item={piece} alt={piece.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={40} strokeWidth={1} /></div>
              )}
            </div>
            <div className="px-1">
              <p className="text-xs font-semibold text-stone-500 uppercase truncate">{piece.brand}</p>
              <p className={`font-display text-base text-stone-800 leading-snug truncate ${openable ? 'group-hover:text-stone-700 transition-colors' : ''}`}>{piece.name}</p>
              <p className="text-xs text-stone-500 mt-1">£{Number(piece.price || 0).toLocaleString()}</p>
            </div>
          </Tag>
        );
      })}
    </div>
  );
}
