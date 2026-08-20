import React from 'react';
import { Shirt } from 'lucide-react';
import { composeFlatlay } from '../lib/flatlay.js';
import { flatlayTreatment, itemImageDisplay } from '../lib/polish.js';
import { itemColors, itemImages } from '../lib/items.js';
import ItemTileImage from './ItemTileImage.jsx';

// How much wider than tall the composition may go before it stops stretching
// and centres instead. The zones are drawn for a square; a fifth of widening is
// imperceptible, and past that the columns visibly drift apart.
const MAX_STAGE_ASPECT = 1.2;

// A look composed as a flat-lay: pieces sit roughly where they are worn, rather
// than in a grid of equal plates that reads as an inventory. The arrangement
// comes from composeFlatlay, so a look composes identically wherever it appears.
//
// The ground is WHITE, and that is load-bearing. Every cut-out stored today is
// a JPEG flattened onto #FFFFFF, so on white it is indistinguishable from a
// transparent one and the garments appear to float — with no image migration at
// all. Phase two changes `ground` to cream and flips `overlap`; nothing else.
//
// Sizing has two modes because the two surfaces size differently. Pass `aspect`
// and the composition declares its own height (the look detail, which places it
// in normal flow). Omit it and the composition fills its container absolutely
// (the Lookbook card, whose image area is a flex-1 region sized by what the
// caption strip leaves over, and which cannot declare an aspect without
// fighting the card's own proportions).
export default function Flatlay({
  pieces = [],
  max = 8,
  overlap = false,
  aspect,
  padding,
  ground = '#FFFFFF',
  onOpenItem,
  paletteFilter = null,
}) {
  const placements = composeFlatlay(pieces, { overlap, max });

  const matchesFilter = (item) => {
    if (!paletteFilter) return true;
    const colours = (itemColors(item) || []).map((c) => (c || '').toLowerCase().trim());
    return colours.includes(paletteFilter);
  };

  // The engine returns fractions, which are aspect-independent as NUMBERS but
  // not as a composition: the zones were tuned against a square frame, so
  // stretching them into a 16:10 hero widens every horizontal gap by 60% while
  // leaving vertical ones alone. The columns drift apart and each contained
  // image shrinks to its box height, surrounded by air. Secondary cards hid this
  // because their image area is near enough square to make it invisible.
  //
  // So the composition is allowed to widen only a little before it stops and
  // centres itself, leaving margins rather than a pulled-apart arrangement.
  // MAX_STAGE_ASPECT is the judgement: a fifth wider than tall passes unnoticed,
  // while the hero's old 1.6 pulled the columns apart. `100cqh` is the
  // container's own height, so this is "the shorter side, plus a fifth".
  // `padding` keeps the composition clear of chrome drawn over the same box —
  // the Lookbook card's N° label and piece count sit top-left, and a garment
  // reaching the top edge would sit under the text. The old grid reserved this
  // space with pt-10; filling the box edge to edge quietly took it back.
  //
  // Padding works here because the stage is a flex CHILD, not an absolutely
  // positioned one: an abs-pos child resolves `inset: 0` against the padding
  // box and would ignore it entirely. Container query units follow the content
  // box too, so the square shrinks to match rather than overflowing.
  const outer = aspect
    ? { position: 'relative', aspectRatio: aspect, background: ground, padding }
    : { position: 'absolute', inset: 0, background: ground, containerType: 'size', padding };
  const stage = aspect
    ? { position: 'absolute', inset: 0 }
    : {
        position: 'relative',
        width: `min(100%, calc(100cqh * ${MAX_STAGE_ASPECT}))`,
        aspectRatio: `${MAX_STAGE_ASPECT} / 1`,
      };

  if (placements.length === 0) {
    return (
      <div style={outer} className="flex items-center justify-center text-stone-300">
        <Shirt size={56} strokeWidth={0.8} />
      </div>
    );
  }

  return (
    <div style={outer} className="flex items-center justify-center overflow-hidden">
      <div style={stage} className="overflow-hidden">
      {placements.map((placement) => {
        const item = placement.item;
        const plated = flatlayTreatment(item) === 'plate';
        const src = itemImageDisplay(item, 0).src || itemImages(item)[0] || null;
        const openable = !!(onOpenItem && item?.id);
        const Tag = openable ? 'button' : 'div';
        return (
          <Tag
            key={item?.id}
            {...(openable
              ? { type: 'button', onClick: () => onOpenItem(item.id), 'aria-label': `Open ${item.name}` }
              : {})}
            className={[
              'absolute transition-opacity duration-300',
              // A plated piece gets no ring and no shadow. Those were what made
              // it read as a box: on a white ground a hairline ring is the only
              // thing you see. Rounding plus the photo's own sampled background
              // (see below) lets it settle rather than announce itself.
              plated ? 'rounded-xl overflow-hidden' : '',
              matchesFilter(item) ? 'opacity-100' : 'opacity-30',
              openable
                ? 'cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-500'
                : '',
            ].filter(Boolean).join(' ')}
            style={{
              left: `${(placement.x * 100).toFixed(2)}%`,
              top: `${(placement.y * 100).toFixed(2)}%`,
              width: `${(placement.w * 100).toFixed(2)}%`,
              height: `${(placement.h * 100).toFixed(2)}%`,
              zIndex: placement.z,
              transform: placement.rotation ? `rotate(${placement.rotation}deg)` : undefined,
            }}
          >
            {src && plated ? (
              // A raw photograph carries its own background and cannot float.
              // ItemTileImage samples that background's colour and paints it
              // behind the photo, so the plate matches the picture instead of
              // being a white card behind it — the difference between a
              // photograph resting on the surface and a cut-out that failed.
              <ItemTileImage item={item} alt={item?.name || ''} />
            ) : src ? (
              <img
                src={src}
                alt={item?.name || ''}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-stone-300">
                <Shirt size={20} strokeWidth={1} />
              </span>
            )}
          </Tag>
        );
      })}
      </div>
    </div>
  );
}
