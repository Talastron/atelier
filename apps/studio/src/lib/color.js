// Colour science — rgb/hsl conversion, family classification, hex lookup,
// palette derivation, dominant-colour sampling. Pure (browser canvas APIs only).
import { COLOR_FAMILIES, NEUTRAL_COLORS, COLOUR_HEX_MAP } from './taxonomy.js';

// Fuzzy-map a free-text colour name to the closest COLOR_FAMILIES entry.
// Handles "navy blue", "off-white", "dusty rose", etc.
export function matchColorFamily(raw) {
  const c = (raw || '').toLowerCase().trim();
  if (!c) return null;
  // Quick passthrough for exact matches
  const direct = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : []).find((x) => x.toLowerCase() === c);
  if (direct) return direct;
  const map = [
    ['navy', 'Navy'], ['midnight', 'Navy'], ['marine', 'Navy'],
    ['off-white', 'White'], ['off white', 'White'], ['ivory', 'Cream'], ['ecru', 'Cream'],
    ['stone', 'Beige'], ['sand', 'Beige'], ['camel', 'Tan'], ['nude', 'Beige'], ['taupe', 'Beige'],
    ['charcoal', 'Grey'], ['slate', 'Grey'], ['silver', 'Silver'],
    ['mustard', 'Yellow'], ['ochre', 'Yellow'],
    ['olive', 'Green'], ['forest', 'Green'], ['emerald', 'Green'], ['sage', 'Green'], ['mint', 'Green'],
    ['sky', 'Blue'], ['cobalt', 'Blue'], ['azure', 'Blue'], ['denim', 'Blue'], ['teal', 'Blue'],
    ['burgundy', 'Red'], ['wine', 'Red'], ['maroon', 'Red'], ['crimson', 'Red'], ['scarlet', 'Red'],
    ['fuchsia', 'Pink'], ['rose', 'Pink'], ['blush', 'Pink'], ['coral', 'Pink'], ['salmon', 'Pink'],
    ['plum', 'Purple'], ['lilac', 'Purple'], ['lavender', 'Purple'], ['violet', 'Purple'],
    ['chocolate', 'Brown'], ['cocoa', 'Brown'], ['espresso', 'Brown'], ['mocha', 'Brown'],
    ['tangerine', 'Orange'], ['peach', 'Orange'], ['rust', 'Orange'], ['terracotta', 'Orange'],
  ];
  for (const [needle, family] of map) {
    if (c.includes(needle)) return family;
  }
  // Last-resort: substring match against the canonical list
  const canon = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : [])
    .find((x) => c.includes(x.toLowerCase()) || x.toLowerCase().includes(c));
  return canon || null;
}
// Pragmatic colour-harmony check used by the Studio's smart generator.
// Returns true if two items' colour sets visually work together.
export function colorsHarmonize(colorsA, colorsB) {
  if (!colorsA?.length || !colorsB?.length) return true;
  // Neutrals harmonise with anything
  if (colorsA.some((c) => NEUTRAL_COLORS.includes(c))) return true;
  if (colorsB.some((c) => NEUTRAL_COLORS.includes(c))) return true;
  // Same colour = always works (monochromatic)
  if (colorsA.some((c) => colorsB.includes(c))) return true;
  // Common clashes to avoid
  const clashes = [['Red', 'Pink'], ['Red', 'Orange'], ['Pink', 'Orange'], ['Green', 'Red'], ['Red', 'Purple'], ['Yellow', 'Pink']];
  for (const [a, b] of clashes) {
    if ((colorsA.includes(a) && colorsB.includes(b)) || (colorsA.includes(b) && colorsB.includes(a))) return false;
  }
  return true;
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

export function classifyColorFromRgb(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l < 0.12) return 'Black';
  if (l > 0.94 && s < 0.08) return 'White';
  if (l > 0.82 && s < 0.18) return 'Cream';
  if (l > 0.7 && s < 0.28 && h > 25 && h < 60) return 'Beige';
  if (s < 0.12) return 'Grey';
  if (h < 15 || h >= 345) return 'Red';
  if (h < 30) return l < 0.35 ? 'Brown' : 'Orange';
  if (h < 45) return l < 0.4 ? 'Brown' : (s < 0.4 ? 'Tan' : 'Orange');
  if (h < 65) return l < 0.45 && s > 0.35 ? 'Olive' : 'Yellow';
  if (h < 85) return l < 0.45 ? 'Olive' : 'Yellow';
  if (h < 165) return 'Green';
  if (h < 200) return 'Teal';
  if (h < 240 && l < 0.32) return 'Navy';
  if (h < 255) return 'Blue';
  if (h < 295) return 'Purple';
  if (h < 335) return 'Pink';
  return 'Red';
}

export async function extractDominantColors(dataUrl, maxResults = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 80;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = {};
        let totalCounted = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          const family = classifyColorFromRgb(data[i], data[i + 1], data[i + 2]);
          buckets[family] = (buckets[family] || 0) + 1;
          totalCounted++;
        }
        const sorted = Object.entries(buckets)
          .filter(([, n]) => n / totalCounted > 0.06)
          .sort((a, b) => b[1] - a[1]);
        const colors = sorted.slice(0, maxResults).map(([f]) => f);
        // If 4+ distinct significant families, tag as Multicolor
        if (sorted.length >= 4 && sorted[3][1] / totalCounted > 0.1) {
          resolve(['Multicolor']);
        } else {
          resolve(colors);
        }
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Build a palette from analysed garment colours rather than pixel-sampling
// the image. The Vision-identified colours are semantically correct (they
// describe what each garment IS) whereas pixel sampling is fooled by:
//   - soft pastels (pale pink → Tan/Orange in HSL bucket)
//   - solid backdrops dominating the sample (cream studio = lots of tan)
//   - thin saturated accents missed because they're a small pixel %
//
// Each garment carries `color` (e.g. "white", "navy"). We normalise the
// string via matchColorFamily, dedupe by family, count occurrences,
// sort by prevalence, cap to keep the strip visually clean.
export function derivePaletteFromGarments(garments) {
  if (!Array.isArray(garments)) return [];
  const counts = new Map();
  for (const g of garments) {
    if (!g?.color) continue;
    const family = matchColorFamily(g.color);
    if (!family) continue;
    counts.set(family, (counts.get(family) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);
}

// Colour name → approximate hex for the outfit palette strip.
// ~30 common wardrobe tones; unmapped names fall back to stone-300
// so a mis-typed colour doesn't render as transparent.
export function hexFromColorName(name) {
  if (!name) return '#d6d3d1';
  return COLOUR_HEX_MAP[name.toLowerCase().trim()] ?? '#d6d3d1'; // stone-300 fallback
}
