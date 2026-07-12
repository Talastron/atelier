import React from 'react';
import { useImageBg } from '../lib/imageBg.js';
import { itemImageDisplay } from '../lib/polish.js';

// Single-image, cut-out-aware tile that matches the Wardrobe grid's white-card
// treatment (the same decision as WardrobeCardImage, minus the carousel):
//   • cut-outs / framed images (forceContain) sit contained on a white card
//   • other photos get their sampled border colour (contain), or object-cover
//     for busy shots where no clean border colour is detected
// Used anywhere we show one item thumbnail (e.g. the Today outfit tiles) so the
// look stays consistent with the wardrobe once items are polished.
export default function ItemTileImage({ item, alt, zoomOnHover = false }) {
  const disp = itemImageDisplay(item, 0);
  const src = disp.src
    || (Array.isArray(item?.images) ? item.images[0] : null)
    || item?.imageUrl
    || null;
  // Only sample the border when we might contain-on-colour; cut-outs go white,
  // so skip the (potentially CORS-blocked) canvas read for them.
  const bg = useImageBg(!disp.forceContain ? src : null);
  const detected = (!disp.forceContain && bg?.contain) ? bg.color : null;
  const contain = disp.forceContain || !!detected;
  const tileBg = disp.forceContain ? '#FFFFFF' : detected;

  if (!src) return null;

  return (
    <div className="w-full h-full" style={tileBg ? { background: tileBg } : undefined}>
      <img
        src={src}
        alt={alt || item?.name || ''}
        loading="lazy"
        decoding="async"
        className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}${zoomOnHover ? ' transition-transform duration-700 ease-out group-hover:scale-105' : ''}`}
      />
    </div>
  );
}
