import { useState, useEffect } from 'react';

// Decide how to fit an item image in its tile. Product/studio shots sit on a
// uniform light background, so they look best shown WHOLE (object-contain) on a
// tile painted that SAME background colour — nothing cropped, and the contain
// margins blend invisibly (no white strips). Photos on a dark, busy or coloured
// background keep object-cover (a sensible crop beats an ugly letterbox).
//
// Retailer imports aren't flagged, so we infer this by sampling the image's
// border: a uniform, light border ⇒ it's a studio background we can match.

// src -> { contain:boolean, color:string|null }. Sampled at most once per src.
const cache = new Map();

function sampleBg(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const S = 24;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, S, S);
        const { data } = ctx.getImageData(0, 0, S, S);
        let r = 0, g = 0, b = 0, n = 0;
        const lums = [];
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            if (!(x < 2 || y < 2 || x >= S - 2 || y >= S - 2)) continue; // border ring
            const i = (y * S + x) * 4;
            r += data[i]; g += data[i + 1]; b += data[i + 2];
            lums.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            n++;
          }
        }
        if (!n) { resolve({ contain: false, color: null }); return; }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        const avgLum = lums.reduce((s, v) => s + v, 0) / n;
        const variance = lums.reduce((s, v) => s + (v - avgLum) ** 2, 0) / n;
        const std = Math.sqrt(variance);
        // Uniform (low spread) AND light ⇒ a studio background we can match.
        const contain = std <= 20 && avgLum >= 210;
        resolve({ contain, color: contain ? `rgb(${r}, ${g}, ${b})` : null });
      } catch {
        resolve({ contain: false, color: null }); // CORS-tainted / error → cover
      }
    };
    img.onerror = () => resolve({ contain: false, color: null });
    img.src = src;
  });
}

// Returns { contain, color } — or null while still sampling. Cached by src.
export function useImageBg(src) {
  const [bg, setBg] = useState(() => (src && cache.has(src) ? cache.get(src) : null));
  useEffect(() => {
    if (!src) { setBg(null); return; }
    if (cache.has(src)) { setBg(cache.get(src)); return; }
    let cancelled = false;
    sampleBg(src).then((v) => { cache.set(src, v); if (!cancelled) setBg(v); });
    return () => { cancelled = true; };
  }, [src]);
  return bg;
}
