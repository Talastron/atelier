import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Heart, Shirt, TrendingDown, Wand2, Sparkles, Share2, Download, X } from "lucide-react";
import { daysSinceLastWorn, itemColors, itemCostPerWear, itemImages, itemSeasons, itemWearCount, itemWearHistory, itemWearNotes, todayISO } from "../lib/items.js";
import { itemImageDisplay } from "../lib/polish.js";
import ItemTileImage from "../components/ItemTileImage.jsx";
import { analyzeWardrobeGapsWithGemini, generateStyleManifestoWithGemini } from "../lib/ai.js";
import { composeStyleDNAExportImage, composeManifestoExportImage, shareOrDownloadImage } from "../lib/canvas.js";
import { isAIEnabled } from "../firebase.js";
import EditorialHeader from "../ui/EditorialHeader.jsx";
import { useToast } from "../ui/toast.jsx";
import { COLOR_SWATCHES } from "../lib/taxonomy.js";
import { splitManifestoParagraphs } from '../lib/manifesto.js';
import { buildPinterestUrl, createCardShare } from '../lib/publicShare.js';
import { PinterestGlyph } from '../components/BrandGlyphs.jsx';

function PinToPinterestButton({ imageBlob, busy, setBusy, cardType, name, sharedByName, description }) {
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={!imageBlob || busy}
      onClick={async () => {
        if (!imageBlob || busy) return;
        setBusy(true);
        try {
          const { url, cardImageUrl } = await createCardShare({ cardType, name, sharedByName, blob: imageBlob });
          const pin = buildPinterestUrl({ url, media: cardImageUrl, description });
          window.open(pin, '_blank', 'noopener,noreferrer,width=750,height=600');
        } catch (e) {
          toast.show('Could not open Pinterest. Try "Save image" and pin it manually.', { kind: 'error' });
        } finally {
          setBusy(false);
        }
      }}
      className="w-full h-11 bg-white border border-stone-300 text-stone-700 rounded-full text-[10px] tracking-widest uppercase font-medium hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
    >
      <PinterestGlyph size={16} />
      Pin to Pinterest
    </button>
  );
}

// Share-your-Style-DNA modal. Composes the 1080×1920 colour-wheel card on mount,
// previews it, then offers the native share sheet (with download fallback) via
// the same shareOrDownloadImage used by the outfit export. This is the primary
// share artifact of the GTM growth loop — it renders day one, no wear data.
function StyleDNAShareModal({ items, measurements, onClose }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [composing, setComposing] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setComposing(true); setError(null);
    composeStyleDNAExportImage(items, measurements)
      .then((blob) => {
        if (cancelled) return;
        setImageBlob(blob);
        setImageUrl(URL.createObjectURL(blob));
        setComposing(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Could not compose your Style DNA.');
        setComposing(false);
      });
    return () => { cancelled = true; };
  }, [items, measurements]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const filename = 'style-dna-atelier.png';
  const handleShare = async () => {
    if (!imageBlob || busy) return;
    setBusy(true);
    try {
      const r = await shareOrDownloadImage(imageBlob, filename, { title: 'My Style DNA', text: 'My Style DNA — read by Atelier.' });
      if (r === 'shared') { toast.show('Shared', { kind: 'success' }); onClose(); }
      else if (r === 'downloaded') { toast.show('Saved to downloads', { kind: 'success' }); }
    } catch (e) {
      toast.show(e?.message || 'Could not share', { kind: 'error' });
    } finally { setBusy(false); }
  };
  const handleDownload = () => {
    if (!imageBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(imageBlob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.show('Saved to downloads', { kind: 'success' });
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200/60 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-block w-5 h-px bg-brass-300" aria-hidden="true" />
            <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Share your Style DNA</span>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors" aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-6 pt-6 pb-4 overflow-y-auto flex-1">
          <div className="relative rounded-2xl overflow-hidden bg-white border border-stone-200/60 smooth-shadow" style={{ aspectRatio: '9 / 16' }}>
            {composing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-400">
                <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
                <p className="text-[10px] tracking-[0.28em] uppercase">Composing</p>
              </div>
            )}
            {error && !composing && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-stone-500 text-sm italic">{error}</div>
            )}
            {imageUrl && !composing && !error && (
              <img src={imageUrl} alt="Your Style DNA card" className="w-full h-full object-contain" />
            )}
          </div>
          <p className="text-[10px] tracking-widest uppercase text-stone-400 text-center mt-3">1080 × 1920 · Instagram Story · Pinterest</p>
        </div>
        <div className="px-6 py-5 border-t border-stone-200/60 bg-white space-y-3 shrink-0"
             style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
          <button onClick={handleShare} disabled={!imageBlob || busy || !!error}
            className="w-full h-12 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-700 transition-colors duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <Share2 size={16} strokeWidth={1.5} className={busy ? 'animate-pulse' : ''} />
            {busy ? 'Opening share…' : 'Share'}
          </button>
          <button onClick={handleDownload} disabled={!imageBlob || busy}
            className="w-full h-11 bg-white border border-stone-300 text-stone-700 rounded-full text-[10px] tracking-widest uppercase font-medium hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Download size={13} strokeWidth={1.5} /> Save image
          </button>
          <PinToPinterestButton
            imageBlob={imageBlob} busy={busy} setBusy={setBusy}
            cardType="styleDNA" name="My Style DNA"
            sharedByName={measurements?.displayName || ''}
            description="My Style DNA — read by Atelier"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

// Heuristic gap analysis: counts owned items per category and flags the
// underrepresented ones plus missing season coverage. Returns up to 5 gaps.
function computeWardrobeGaps(ownedItems) {
  const desiredCategories = ['Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Bags', 'Accessories'];
  const counts = Object.fromEntries(desiredCategories.map((c) => [c, 0]));
  for (const item of ownedItems) if (counts[item.category] !== undefined) counts[item.category]++;
  const gaps = [];
  for (const cat of desiredCategories) {
    if (counts[cat] === 0) gaps.push({ kind: 'missing-category', label: `No ${cat.toLowerCase()} yet`, detail: `Even a single piece anchors the rest of the wardrobe.`, priority: 3 });
    else if (counts[cat] < 3) gaps.push({ kind: 'sparse-category', label: `Only ${counts[cat]} ${cat.toLowerCase()}`, detail: `Common rule of thumb is 3+ to give yourself outfit choice.`, priority: 1 });
  }
  // Seasonal coverage of owned outerwear
  const outerwearBySeason = { Spring: 0, Summer: 0, Autumn: 0, Winter: 0 };
  for (const item of ownedItems.filter((i) => i.category === 'Outerwear')) {
    const seasons = itemSeasons(item);
    if (seasons.length === 0) ['Spring', 'Summer', 'Autumn', 'Winter'].forEach((s) => outerwearBySeason[s]++);
    else for (const s of seasons) if (outerwearBySeason[s] !== undefined) outerwearBySeason[s]++;
  }
  for (const [season, n] of Object.entries(outerwearBySeason)) {
    if (n === 0) gaps.push({ kind: 'season-gap', label: `No outerwear for ${season}`, detail: `Wishlist a layer suited to ${season.toLowerCase()} weather.`, priority: 2 });
  }
  return gaps.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

// Gemini-driven gap audit panel. Idle until the user taps Analyse — keeps the
// Insights tab fast on load and avoids a Gemini call every time it mounts.
// Caches the result in component state; the user can re-analyse anytime.
function GapAnalysisPanel({ items, inspirations = [] }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const toast = useToast();

  const run = async () => {
    if (!isAIEnabled()) { setState({ status: 'error', data: null, error: 'Concierge is not yet set up — add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic.' }); return; }
    setState({ status: 'running', data: null, error: null });
    try {
      const data = await analyzeWardrobeGapsWithGemini({ items, inspirations });
      setState({ status: 'done', data, error: null });
    } catch (e) {
      setState({ status: 'error', data: null, error: e?.message || 'Analysis failed' });
      toast.show('Gap analysis failed', { kind: 'error' });
    }
  };

  return (
    <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-600 font-medium">Concierge audit</span>
          </div>
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Gap analysis &amp; recommendations</h3>
          <p className="text-stone-500 text-sm mt-2 leading-relaxed max-w-xl">
            The Concierge reviews the shape of your wardrobe — categories, colours, styles, seasons — and tells you what's strong, what's missing, and what would unlock the most outfits.
          </p>
        </div>
        {state.status !== 'running' && (
          <button onClick={run}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors flex items-center gap-2 shrink-0">
            <Wand2 size={14} strokeWidth={1.5} /> {state.status === 'done' ? 'Re-analyse' : 'Analyse my wardrobe'}
          </button>
        )}
      </div>

      {state.status === 'running' && (
        <div className="mt-6 flex items-center gap-3 text-sm text-stone-600">
          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          Reviewing balance across {items.length} pieces…
        </div>
      )}
      {state.status === 'error' && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{state.error}</p>
      )}

      {state.status === 'done' && state.data && (
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-emerald-800 font-bold mb-3">Strengths</h4>
            <ul className="space-y-3">
              {(state.data.strengths || []).map((s, i) => (
                <li key={i} className="border-l-2 border-emerald-300 pl-3">
                  <p className="text-sm font-medium text-stone-900">{s.title}</p>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{s.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-brass-700 font-bold mb-3">Gaps</h4>
            <ul className="space-y-3">
              {(state.data.gaps || []).map((g, i) => (
                <li key={i} className="border-l-2 border-amber-300 pl-3">
                  <p className="text-sm font-medium text-stone-900">{g.title}</p>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{g.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-stone-700 font-bold mb-3">Buy next</h4>
            <ul className="space-y-3">
              {(state.data.recommendations || []).map((r, i) => (
                <li key={i} className="border-l-2 border-stone-400 pl-3">
                  <p className="text-sm font-medium text-stone-900">{r.piece}</p>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{r.why}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Editorial bar primitives — the two canonical treatments for Insights.
// HairlineBar: thin (3-4px) brass/colour hairline for "part of a whole"
// (category composition, colour profile). Looks like a printer's rule.
// DialBar: medium (6-8px) stone/accent fill for "progress toward a target"
// (spending vs budget, season coverage). Reads like a fuel gauge.
// Both accept a custom fill style (color OR CSS background gradient string)
// so colour-profile swatches and brass-tinted alerts share the same chrome.
function HairlineBar({ value, fill = 'var(--color-stone-900, #1c1917)', track = 'rgb(245 245 244 / 1)', height = 3, className = '' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const fillStyle = typeof fill === 'string' && (fill.startsWith('linear') || fill.startsWith('radial'))
    ? { background: fill }
    : { backgroundColor: fill };
  return (
    <div
      className={`w-full rounded-full overflow-hidden ${className}`}
      style={{ height: `${height}px`, backgroundColor: track }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${pct}%`, ...fillStyle }} />
    </div>
  );
}

function DialBar({ value, fill = 'var(--color-stone-900, #1c1917)', track = 'rgb(255 255 255 / 0.6)', height = 8, capped = true, className = '' }) {
  const raw = Number(value) || 0;
  const pct = capped ? Math.max(0, Math.min(100, raw)) : Math.max(0, raw);
  const fillStyle = typeof fill === 'string' && (fill.startsWith('linear') || fill.startsWith('radial'))
    ? { background: fill }
    : { backgroundColor: fill };
  return (
    <div
      className={`w-full rounded-full overflow-hidden border border-stone-200/60 ${className}`}
      style={{ height: `${height}px`, backgroundColor: track }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${pct}%`, ...fillStyle }} />
    </div>
  );
}

// Squarified-treemap layout. Given items {value, ...} sorted desc and a
// container rect, returns each item with {x, y, w, h} packed to minimise
// aspect-ratio distortion. Classic Bruls/Huijsen/van Wijk algorithm.
function squarifyTreemap(items, x, y, w, h) {
  if (items.length === 0 || w <= 0 || h <= 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];

  const totalValue = items.reduce((s, i) => s + (Number(i.value) || 0), 0);
  if (totalValue <= 0) return [];

  // Area each value unit occupies in the current sub-rect.
  const scale = (w * h) / totalValue;

  const worstAspect = (row, shortSide) => {
    if (row.length === 0) return Infinity;
    const rowSum = row.reduce((s, it) => s + it.value, 0);
    const rowArea = rowSum * scale;
    const rowLen = rowArea / shortSide;
    const max = Math.max(...row.map((it) => (it.value * scale) / rowLen));
    const min = Math.min(...row.map((it) => (it.value * scale) / rowLen));
    return Math.max((shortSide * shortSide * max) / (rowSum * rowSum * scale * scale), (rowSum * rowSum * scale * scale) / (shortSide * shortSide * min));
  };

  const shortSide = Math.min(w, h);
  const horizontal = w <= h; // row runs along the SHORT side
  let row = [];
  let i = 0;
  while (i < items.length) {
    const candidate = [...row, items[i]];
    const currentWorst = worstAspect(row, shortSide);
    const candidateWorst = worstAspect(candidate, shortSide);
    if (row.length === 0 || candidateWorst <= currentWorst) {
      row = candidate;
      i++;
    } else {
      break;
    }
  }

  // Lay out the chosen row along the short side.
  const rowSum = row.reduce((s, it) => s + it.value, 0);
  const rowArea = rowSum * scale;
  const placed = [];
  if (horizontal) {
    const rowH = rowArea / w;
    let cx = x;
    for (const it of row) {
      const itW = (it.value / rowSum) * w;
      placed.push({ ...it, x: cx, y, w: itW, h: rowH });
      cx += itW;
    }
    const rest = items.slice(row.length);
    return [...placed, ...squarifyTreemap(rest, x, y + rowH, w, h - rowH)];
  } else {
    const rowW = rowArea / h;
    let cy = y;
    for (const it of row) {
      const itH = (it.value / rowSum) * h;
      placed.push({ ...it, x, y: cy, w: rowW, h: itH });
      cy += itH;
    }
    const rest = items.slice(row.length);
    return [...placed, ...squarifyTreemap(rest, x + rowW, y, w - rowW, h)];
  }
}

// CategoryTreemap — the photo-tiled composition view.
// Each tile is sized by category spend and backed by the user's MOST-WORN
// piece in that category (the signature piece), with most-expensive as a
// fallback. The hero tile gets a brass-thread inset frame, a brass corner
// mark, and a museum-label brand line above the eyebrow.
function CategoryTreemap({ categoryBreakdown, ownedItems, onJumpToWardrobe }) {
  // Pre-bake per-category meta so we don't re-scan ownedItems every render.
  // Representative item picks, in order of preference: (1) an item with a clean
  // cut-out / framed image — background removed onto white, trimmed to subject —
  // so the plate shows an intentional still-life, not a badly-cropped lifestyle
  // shot; then (2) most-worn (the signature, not the splurge); then (3) priciest.
  // `contain` records whether that rep is a whole-subject cut-out (show it
  // object-contain on a warm ground) vs. a full-bleed lifestyle photo (cover).
  const catMeta = useMemo(() => {
    const map = {};
    for (const cat of Object.keys(categoryBreakdown)) {
      const inCat = ownedItems.filter((i) => i.category === cat);
      const withPhoto = inCat.filter((i) => itemImageDisplay(i, 0).src);
      const sorted = [...withPhoto].sort((a, b) => {
        const ca = itemImageDisplay(a, 0).forceContain ? 1 : 0;
        const cb = itemImageDisplay(b, 0).forceContain ? 1 : 0;
        if (cb !== ca) return cb - ca; // clean cut-outs lead
        const wa = itemWearCount(a) || 0;
        const wb = itemWearCount(b) || 0;
        if (wb !== wa) return wb - wa;
        return (b.price || 0) - (a.price || 0);
      });
      const rep = sorted[0] || null;
      const disp = rep ? itemImageDisplay(rep, 0) : { src: null, forceContain: false };
      map[cat] = {
        photo: disp.src || (rep ? itemImages(rep)[0] : null),
        contain: !!disp.forceContain,
        brand: rep?.brand || '',
        count: inCat.length,
      };
    }
    return map;
  }, [categoryBreakdown, ownedItems]);

  // Cap-and-fold: a magazine never prints an unreadable sliver. Show the top
  // CAP categories as full plates and fold the long tail into one closing
  // "+ N more" type-tile. Only fold when it actually removes slivers (more than
  // CAP + 1 categories) — with exactly CAP + 1 we just show them all.
  const CAP = 6;
  const { entries, total, moreMeta } = useMemo(() => {
    const all = Object.entries(categoryBreakdown)
      .map(([category, value]) => ({ category, value }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    const sum = all.reduce((s, e) => s + e.value, 0);
    if (all.length <= CAP + 1) return { entries: all, total: sum, moreMeta: null };
    const shown = all.slice(0, CAP);
    const folded = all.slice(CAP);
    const moreValue = folded.reduce((s, e) => s + e.value, 0);
    const merged = [...shown, { category: '__more__', value: moreValue }]
      .sort((a, b) => b.value - a.value);
    return { entries: merged, total: sum, moreMeta: { count: folded.length, value: moreValue, categories: folded.map((f) => f.category) } };
  }, [categoryBreakdown]);

  // Layout in a virtual 100×56 unit box (≈16:9). CSS turns it back into
  // percentages so the treemap is fluid at any container width.
  const layout = useMemo(() => squarifyTreemap(entries, 0, 0, 100, 56), [entries]);

  // One-shot staggered reveal so the spread "develops" like a print. Starts
  // hidden, flips visible after mount; `motion-reduce:` classes force the tiles
  // visible immediately for users who prefer no motion.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (entries.length === 0) return <p className="text-stone-400 italic">No items owned yet.</p>;

  return (
    <div className="relative w-full" style={{ aspectRatio: '100 / 56' }}>
      {layout.map((tile, idx) => {
        const isMore = tile.category === '__more__';
        const meta = catMeta[tile.category] || { photo: null, contain: false, brand: '', count: 0 };
        const pct = total > 0 ? (tile.value / total) * 100 : 0;
        const clickable = !!onJumpToWardrobe;
        const Wrap = clickable ? 'button' : 'div';
        // A folded "+ N more" tile opens the whole wardrobe (no category); a
        // category plate deep-links to that category.
        const tileProps = clickable
          ? {
              type: 'button',
              onClick: () => onJumpToWardrobe(isMore ? { filter: 'all' } : { filter: 'all', category: tile.category }),
              'aria-label': isMore ? 'View all categories in wardrobe' : `View ${tile.category} in wardrobe`,
            }
          : {};
        // Tile typography scales with tile area so a sliver gets small caps
        // and the dominant tile gets a real display heading.
        const area = tile.w * tile.h;
        const heroish = !isMore && area >= 900;
        const big = area >= 450;
        // Staggered reveal — hidden→visible in scan order; motion-reduce forces
        // it visible instantly regardless of the `revealed` flag.
        const revealCls = `transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`;
        return (
          <Wrap
            key={tile.category}
            {...tileProps}
            className={`group absolute overflow-hidden ${revealCls} ${clickable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-300' : ''}`}
            style={{
              left: `${tile.x}%`,
              top: `${(tile.y / 56) * 100}%`,
              width: `${tile.w}%`,
              height: `${(tile.h / 56) * 100}%`,
              padding: '3px', // hairline gutter between tiles
              transitionDelay: `${Math.min(idx * 60, 420)}ms`,
            }}
          >
            {(() => {
              // Three tile registers, each with the legibility treatment its
              // imagery needs:
              //   • card  — a cut-out (subject on white). Cream ground blends the
              //     white edge; DARK-INK museum caption below the product.
              //   • photo — a full-bleed lifestyle shot. Dark scrim + WHITE caption.
              //   • more  — the folded tail. Brass-on-ink type plate.
              const asCard = !isMore && meta.photo && meta.contain;
              const asPhoto = !isMore && meta.photo && !meta.contain;
              const light = asCard || (!isMore && !meta.photo); // cut-out or empty → dark ink
              const catCls = heroish ? 'text-xs sm:text-sm' : 'text-[9px] sm:text-[10px]';
              const pctCls = heroish ? 'text-[10px] sm:text-xs' : 'text-[9px]';
              const priceCls = `font-display ${heroish ? 'text-2xl md:text-3xl' : big ? 'text-lg md:text-xl' : 'text-sm'}`;
              const pieceCls = heroish ? 'text-[10px] sm:text-xs' : 'text-[9px]';

              if (isMore) {
                // Folded tail — a warm taupe summary plate that belongs to the
                // cream family rather than punching a dark hole in the spread.
                return (
                  <div className="relative w-full h-full rounded-xl overflow-hidden ring-1 ring-stone-300/60 flex flex-col items-center justify-center text-center px-3"
                       style={{ background: 'linear-gradient(160deg, #EBE4D9, #DCD2C3)' }}>
                    <span className="w-6 h-px bg-brass-500/70 mb-3" aria-hidden="true" />
                    <p className={`font-display text-stone-900 ${big ? 'text-xl md:text-2xl' : 'text-base'}`}>
                      £{tile.value.toLocaleString()}
                    </p>
                    <p className="text-[9px] sm:text-[10px] tracking-[0.22em] uppercase text-stone-500 font-medium mt-1.5">
                      + {moreMeta?.count ?? 0} more {moreMeta?.count === 1 ? 'category' : 'categories'}
                    </p>
                    {moreMeta?.categories?.length > 0 && (
                      <p className="text-[9px] sm:text-[10px] tracking-[0.14em] uppercase text-stone-400 mt-2 leading-relaxed max-w-[85%]">
                        {moreMeta.categories.join(' · ')}
                      </p>
                    )}
                  </div>
                );
              }

              // LIGHT register — cut-out card (or empty). flex-col so the caption
              // sits below the product on the cream, never over it.
              if (light) {
                // Luggage-tag split: a PURE-WHITE product zone (top) so the
                // cut-out's baked-white background dissolves seamlessly — no box
                // edge, whatever the item's colour — over a cream caption footer.
                return (
                  <div className="relative w-full h-full rounded-xl overflow-hidden ring-1 ring-stone-200/70 flex flex-col"
                       style={{ background: '#F4EFE7' }}>
                    <div className={`relative flex-1 min-h-0 ${asCard ? '' : 'bg-gradient-to-br from-stone-100 to-stone-200'}`}
                         style={asCard ? { background: 'radial-gradient(ellipse 78% 68% at 50% 44%, #FFFFFF 0%, #FFFFFF 58%, #F6F2EB 100%)' } : undefined}>
                      {meta.photo && (
                        <img
                          src={meta.photo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-contain p-2 md:p-3 transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      )}
                    </div>
                    <div className={`relative px-3 pb-3 md:px-4 md:pb-4 pt-2 ${asCard ? 'border-t border-stone-200/60' : ''}`}>
                      {heroish && meta.brand && (
                        <p className="text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-brass-600 font-medium mb-1 truncate">
                          {meta.brand}
                        </p>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={`${catCls} tracking-[0.22em] uppercase font-semibold text-stone-800`}>{tile.category}</p>
                        <p className={`${pctCls} tracking-widest uppercase text-stone-400 tabular-nums`}>{pct.toFixed(0)}%</p>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 mt-0.5">
                        <p className={`${priceCls} text-stone-900`}>£{tile.value.toLocaleString()}</p>
                        {(big || heroish) && meta.count > 0 && (
                          <p className={`${pieceCls} tracking-widest uppercase text-stone-400 tabular-nums`}>
                            × {meta.count} {meta.count === 1 ? 'piece' : 'pieces'}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Matte frame — quiet stone hairline; gilded brass on the hero. */}
                    <div className={`absolute rounded-lg pointer-events-none ${heroish ? 'inset-2 ring-1 ring-inset ring-brass-300/50' : 'inset-1.5 ring-[0.5px] ring-inset ring-stone-300/60'}`} />
                    {heroish && (
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <span className="w-5 h-px bg-brass-400/70" />
                        <span className="text-[9px] tracking-[0.3em] uppercase text-brass-500 font-medium">Largest</span>
                      </div>
                    )}
                  </div>
                );
              }

              // DARK register — full-bleed lifestyle photo, white caption on scrim.
              return (
                <div className="relative w-full h-full rounded-xl overflow-hidden ring-1 ring-stone-200/60 bg-stone-200">
                  <img
                    src={meta.photo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    style={{ filter: 'contrast(1.03) saturate(0.97)' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/92 via-stone-900/25 to-stone-900/10 pointer-events-none" />
                  <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 60px rgba(28,25,23,0.28)' }} />
                  <div className={`absolute rounded-lg pointer-events-none ${heroish ? 'inset-2 ring-1 ring-inset ring-brass-200/40' : 'inset-1.5 ring-[0.5px] ring-inset ring-white/15'}`} />
                  {heroish && (
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span className="w-5 h-px bg-brass-300/70" />
                      <span className="text-[9px] tracking-[0.3em] uppercase text-brass-200/90 font-medium">Largest</span>
                    </div>
                  )}
                  <div className="absolute left-0 right-0 bottom-0 p-3 md:p-4 text-white">
                    {heroish && meta.brand && (
                      <p className="text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-brass-200/90 font-medium mb-1 truncate">
                        {meta.brand}
                      </p>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`${catCls} tracking-[0.22em] uppercase font-semibold opacity-90`}>{tile.category}</p>
                      <p className={`${pctCls} tracking-widest uppercase opacity-70 tabular-nums`}>{pct.toFixed(0)}%</p>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 mt-0.5">
                      <p className={priceCls}>£{tile.value.toLocaleString()}</p>
                      {(big || heroish) && meta.count > 0 && (
                        <p className={`${pieceCls} tracking-widest uppercase opacity-60 tabular-nums`}>
                          × {meta.count} {meta.count === 1 ? 'piece' : 'pieces'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </Wrap>
        );
      })}
    </div>
  );
}

// Extracts hex colours from a CSS linear-gradient string so we can rebuild
// the same gradient inside an SVG <linearGradient> def. Used by ColourWheel
// to render the metallic swatches (Gold, Silver, Rose Gold, Multicolor) as
// real radial arcs rather than falling back to a flat fill.
function parseGradientStops(str) {
  if (!str || typeof str !== 'string' || !str.startsWith('linear-gradient')) return null;
  const hexes = str.match(/#[0-9a-fA-F]{3,8}/g);
  if (!hexes || hexes.length < 2) return null;
  return hexes;
}

// ColourWheel — the radial heart of the gold-standard colour profile.
// One donut, one arc per colour family, arc length proportional to item count,
// arc fill = the actual swatch (solid OR parsed linear-gradient). Centre cell
// surfaces the dominant colour as an editorial pull-quote.
function ColourWheel({ sortedColors, colorTotal, ownedCount, taggedCount }) {
  // Donut geometry. cx/cy at 160, outer radius 142, inner 92 → 50px ring
  // thickness with a hairline gap (3°) between arcs so each colour gets its
  // own breathing room. viewBox is square; CSS makes it fluid.
  const cx = 160, cy = 160, rOuter = 142, rInner = 92;
  const gapDeg = sortedColors.length > 1 ? Math.min(3, 360 / (sortedColors.length * 6)) : 0;
  const totalGap = gapDeg * sortedColors.length;
  const usableDeg = Math.max(0, 360 - totalGap);

  // Build slice paths. Start at -90° (12 o'clock) and walk clockwise so the
  // dominant colour leads at the top — reads like a watch dial.
  let cursorDeg = -90;
  const slices = sortedColors.map(([color, count], idx) => {
    const pct = colorTotal > 0 ? count / colorTotal : 0;
    const arcDeg = usableDeg * pct;
    const a1 = (cursorDeg * Math.PI) / 180;
    const a2 = ((cursorDeg + arcDeg) * Math.PI) / 180;
    cursorDeg += arcDeg + gapDeg;
    const swatch = COLOR_SWATCHES[color];
    const gradient = parseGradientStops(swatch);
    const ox1 = cx + rOuter * Math.cos(a1);
    const oy1 = cy + rOuter * Math.sin(a1);
    const ox2 = cx + rOuter * Math.cos(a2);
    const oy2 = cy + rOuter * Math.sin(a2);
    const ix1 = cx + rInner * Math.cos(a1);
    const iy1 = cy + rInner * Math.sin(a1);
    const ix2 = cx + rInner * Math.cos(a2);
    const iy2 = cy + rInner * Math.sin(a2);
    const large = arcDeg > 180 ? 1 : 0;
    const d = `M ${ox1.toFixed(2)} ${oy1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${rInner} ${rInner} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z`;
    return { color, count, pct, d, swatch, gradient, idx };
  });

  const dominant = sortedColors[0] || ['—', 0];
  const dominantPct = colorTotal > 0 ? (dominant[1] / colorTotal) * 100 : 0;

  return (
    <div className="relative w-full max-w-[340px] mx-auto" style={{ aspectRatio: '1 / 1' }}>
      <svg viewBox="0 0 320 320" className="w-full h-full" role="img" aria-label={`Colour wheel: ${sortedColors.length} colour families across ${taggedCount} tagged pieces`}>
        <defs>
          {/* Per-arc SVG linearGradient for metallic swatches. Direction
              matches the original CSS 135deg (top-left to bottom-right). */}
          {slices.map((s) => s.gradient ? (
            <linearGradient key={`g-${s.color}`} id={`wheel-grad-${s.idx}`} x1="0" y1="0" x2="1" y2="1">
              {s.gradient.map((hex, gi) => (
                <stop key={gi} offset={`${(gi / Math.max(1, s.gradient.length - 1)) * 100}%`} stopColor={hex} />
              ))}
            </linearGradient>
          ) : null)}
          {/* Soft inner-shadow rim on the centre well — gives the donut a
              jeweller's bezel look instead of a flat washer. */}
          <radialGradient id="wheel-rim" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {slices.map((s) => {
          const fill = s.gradient ? `url(#wheel-grad-${s.idx})` : (s.swatch || '#a8a29e');
          return (
            <path
              key={s.color}
              d={s.d}
              fill={fill}
              stroke="#FAFAF9"
              strokeWidth="0.75"
            >
              <title>{s.color} · {s.count} {s.count === 1 ? 'piece' : 'pieces'} · {(s.pct * 100).toFixed(0)}%</title>
            </path>
          );
        })}

        {/* Centre well — cream rim + dominant-colour pull-quote */}
        <circle cx={cx} cy={cy} r={rInner - 1} fill="#F7F5F2" />
        <circle cx={cx} cy={cy} r={rInner - 1} fill="url(#wheel-rim)" />
        <text x={cx} y={cy - 22} textAnchor="middle" fontSize="9" letterSpacing="0.28em" fill="#a8a29e" fontFamily="Jost, sans-serif">
          DOMINANT
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="22" fill="#1c1917" fontFamily="Playfair Display, serif" fontStyle="italic">
          {dominant[0]}
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontSize="11" fill="#78716c" fontFamily="Playfair Display, serif">
          {dominantPct.toFixed(0)}% of palette
        </text>
        <line x1={cx - 18} x2={cx + 18} y1={cy + 42} y2={cy + 42} stroke="var(--color-brass-400, #c19a5b)" strokeWidth="0.75" opacity="0.7" />
        <text x={cx} y={cy + 56} textAnchor="middle" fontSize="9" letterSpacing="0.22em" fill="#a8a29e" fontFamily="Jost, sans-serif">
          {taggedCount} OF {ownedCount} TAGGED
        </text>
      </svg>
    </div>
  );
}

// Wears-over-time — replaces the 12 grey rectangles with two editorial graphics:
//   (a) an annotated smooth-area chart with brass-tinted fill, a faint dashed
//       12-month-average baseline, and a callout label hanging from the peak;
//   (b) a 52-week calendar heatmap below — the year-at-a-glance ribbon.
// Both render as inline SVG so the chrome (strokes, fills, dashes) inherits
// the editorial palette without depending on a charting library.
function WearTimelineCard({ ownedItems, timeline }) {
  // Build a daily wear count Map keyed by ISO date (yyyy-mm-dd) for the last
  // 53 weeks anchored on today's Sunday — gives the heatmap a clean weekly grid.
  const { heatmap, weekHeaders, peakIdx, avgY, areaPath, linePath, axisPoints, totalThisYear } = useMemo(() => {
    const dailyCounts = new Map();
    for (const it of ownedItems) {
      for (const d of itemWearHistory(it)) {
        dailyCounts.set(d, (dailyCounts.get(d) || 0) + 1);
      }
    }
    // Anchor the heatmap to the most recent Sunday (column 52) and step back
    // 52 weeks. Each column = a week, each row = a weekday (Sun→Sat top→bottom).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Saturday
    const heat = [];
    const headers = []; // month labels at column boundaries
    let lastMonthLabel = '';
    for (let col = 0; col < 53; col++) {
      const week = [];
      for (let row = 0; row < 7; row++) {
        const cellDate = new Date(endOfWeek);
        cellDate.setDate(endOfWeek.getDate() - ((52 - col) * 7) - (6 - row));
        if (cellDate > today) { week.push(null); continue; } // future days hidden
        const iso = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
        week.push({ iso, date: cellDate, count: dailyCounts.get(iso) || 0 });
      }
      heat.push(week);
      const firstValid = week.find((c) => c);
      if (firstValid) {
        const label = firstValid.date.toLocaleDateString('en-GB', { month: 'short' });
        if (label !== lastMonthLabel && firstValid.date.getDate() <= 7) {
          headers.push({ col, label });
          lastMonthLabel = label;
        }
      }
    }
    // Area chart geometry — viewBox 720 × 180, padded for the peak callout.
    const counts = timeline.map((t) => t.count);
    const maxY = Math.max(1, ...counts);
    const padL = 8, padR = 8, padT = 28, padB = 28;
    const W = 720, H = 180;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const stepX = counts.length > 1 ? innerW / (counts.length - 1) : 0;
    const pts = counts.map((c, i) => ({
      x: padL + i * stepX,
      y: padT + (1 - c / maxY) * innerH,
      v: c,
    }));
    // Catmull-Rom → cubic bezier smoothing (tension 0.2) so the curve breathes
    // without looping past the data. Keeps the line editorial-soft, not jagged.
    const toBezier = (P, tension = 0.2) => {
      if (P.length < 2) return '';
      let d = `M ${P[0].x.toFixed(2)} ${P[0].y.toFixed(2)}`;
      for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[i - 1] || P[i];
        const p1 = P[i];
        const p2 = P[i + 1];
        const p3 = P[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
      }
      return d;
    };
    const stroke = toBezier(pts);
    const baseY = padT + innerH;
    const area = `${stroke} L ${pts[pts.length - 1].x.toFixed(2)} ${baseY} L ${pts[0].x.toFixed(2)} ${baseY} Z`;
    // Peak = first occurrence of max (most recent peak wins on tie).
    let peakI = 0;
    counts.forEach((c, i) => { if (c >= counts[peakI]) peakI = i; });
    // Average across months with non-zero activity — a "real" baseline that
    // doesn't get dragged down by months before the user started logging.
    const active = counts.filter((c) => c > 0);
    const avg = active.length > 0 ? active.reduce((s, c) => s + c, 0) / active.length : 0;
    const avgYpx = padT + (1 - avg / maxY) * innerH;
    // Year-to-date wear total — surfaced as the editorial headline.
    const nowYear = new Date().getFullYear();
    let ytd = 0;
    for (const [iso, n] of dailyCounts) {
      if (iso.startsWith(String(nowYear))) ytd += n;
    }
    return {
      heatmap: heat,
      weekHeaders: headers,
      peakIdx: peakI,
      avgY: avgYpx,
      areaPath: area,
      linePath: stroke,
      axisPoints: pts,
      totalThisYear: ytd,
    };
  }, [ownedItems, timeline]);

  const peak = axisPoints[peakIdx];
  const peakLabel = timeline[peakIdx]?.label;
  const peakCount = timeline[peakIdx]?.count || 0;
  // Heat scale — five tonal steps inside the brass family. Zero stays
  // near-invisible so the calendar reads as paper, not a wall of squares.
  const heatColor = (n) => {
    if (!n) return '#f5f5f4'; // stone-100
    if (n === 1) return 'var(--color-brass-100, #f3e9d0)';
    if (n === 2) return 'var(--color-brass-200, #e6d2a3)';
    if (n <= 4) return 'var(--color-brass-300, #d4b378)';
    return 'var(--color-brass-500, #b08349)';
  };

  return (
    <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block w-5 h-px bg-brass-300" aria-hidden="true" />
            <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-semibold">Wear rhythm · last 12 months</p>
          </div>
          <h3 className="font-display text-2xl md:text-3xl text-stone-900">
            {totalThisYear} <span className="text-stone-400 text-lg font-normal">wears in {new Date().getFullYear()}</span>
          </h3>
        </div>
        <span className="text-[10px] tracking-widest uppercase text-stone-400 italic font-display">
          {peakCount > 0 ? `Peak · ${peakLabel} (${peakCount})` : 'Awaiting wear data'}
        </span>
      </div>

      {/* Annotated area chart. SVG inherits its strokes from the editorial
          palette via CSS vars; no library, no axes — captions do the work. */}
      <svg viewBox="0 0 720 180" preserveAspectRatio="none" className="w-full h-40 sm:h-48 mt-4" role="img" aria-label="Monthly wears area chart">
        <defs>
          <linearGradient id="wearAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brass-300, #d4b378)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-brass-100, #f3e9d0)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Dashed average baseline — quiet hairline, not a chart gridline. */}
        {peakCount > 0 && (
          <g>
            <line x1="8" x2="712" y1={avgY} y2={avgY} stroke="#a8a29e" strokeWidth="0.75" strokeDasharray="2 4" opacity="0.6" />
            <text x="712" y={avgY - 4} textAnchor="end" fontSize="9" fill="#78716c" fontStyle="italic" fontFamily="Playfair Display, serif">avg</text>
          </g>
        )}
        <path d={areaPath} fill="url(#wearAreaFill)" />
        <path d={linePath} fill="none" stroke="var(--color-stone-900, #1c1917)" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
        {/* Peak callout: brass dot + caption hanging above the curve. */}
        {peakCount > 0 && (
          <g>
            <circle cx={peak.x} cy={peak.y} r="3.5" fill="var(--color-brass-500, #b08349)" stroke="#fff" strokeWidth="1.5" />
            <text x={peak.x} y={Math.max(peak.y - 12, 14)} textAnchor="middle" fontSize="10" fill="#1c1917" fontFamily="Playfair Display, serif" fontStyle="italic">
              {peakLabel} · {peakCount}
            </text>
          </g>
        )}
        {/* Month axis — single faint baseline + tracked-out labels. */}
        <line x1="8" x2="712" y1="152" y2="152" stroke="#e7e5e4" strokeWidth="0.75" />
        {axisPoints.map((p, i) => (
          <text key={i} x={p.x} y={170} textAnchor="middle" fontSize="9" fill="#a8a29e" letterSpacing="0.08em">
            {timeline[i].label.toUpperCase()}
          </text>
        ))}
      </svg>

      {/* 52-week calendar heatmap. Cells 10×10 with 2px gap. Months labeled
          along the top as a hairline scale. Quiet on empty days so the page
          doesn't feel like a contributions wall — present, never demanding. */}
      <div className="mt-8 pt-6 border-t border-stone-100">
        <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
          <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-semibold">A year in days</p>
          <div className="flex items-center gap-1.5 text-[9px] tracking-widest uppercase text-stone-400">
            <span>less</span>
            {[0, 1, 2, 4, 6].map((n) => (
              <span key={n} className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: heatColor(n) }} />
            ))}
            <span>more</span>
          </div>
        </div>
        <div className="overflow-x-auto hide-scrollbar -mx-2 px-2">
          <svg viewBox="0 0 636 96" preserveAspectRatio="xMinYMid meet" className="w-full min-w-[520px] h-24" role="img" aria-label="Calendar heatmap of wears over the last 52 weeks">
            {/* Month headers — small caps along the top */}
            {weekHeaders.map((h, i) => (
              <text key={i} x={h.col * 12} y="10" fontSize="8" fill="#a8a29e" letterSpacing="0.12em">
                {h.label.toUpperCase()}
              </text>
            ))}
            <g transform="translate(0, 16)">
              {heatmap.map((week, ci) =>
                week.map((cell, ri) => {
                  if (!cell) return null;
                  return (
                    <rect
                      key={`${ci}-${ri}`}
                      x={ci * 12}
                      y={ri * 11}
                      width="10"
                      height="10"
                      rx="2"
                      fill={heatColor(cell.count)}
                      stroke={cell.count > 0 ? 'rgba(0,0,0,0.05)' : 'transparent'}
                      strokeWidth="0.5"
                    >
                      <title>{cell.iso} · {cell.count} {cell.count === 1 ? 'wear' : 'wears'}</title>
                    </rect>
                  );
                })
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function ManifestoBody({ text }) {
  const parts = splitManifestoParagraphs(text);
  if (!parts) {
    return <div className="whitespace-pre-line">{text}</div>;
  }
  const Label = ({ children }) => (
    <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#9a7b4f] mb-1.5">{children}</div>
  );
  return (
    <div className="not-italic">
      <Label>Your signature</Label>
      <p className="italic mb-5">{parts.signature}</p>
      <Label>Colour and texture</Label>
      <p className="italic mb-5">{parts.colour}</p>
      <Label>What you're reaching for</Label>
      <p className="italic text-[17px] leading-relaxed pl-4 border-l-2 border-[#c9a85f] text-stone-900 mb-4">{parts.aspiration}</p>
      <div className="font-display italic text-stone-500 text-right">— Your Concierge</div>
    </div>
  );
}

// Style manifesto — an AI-written three-paragraph reading of the user's taste,
// generated from most-worn pieces, outfit pairings, and saved inspirations.
// Lives on Insights (it's a reflective wardrobe *output*, not a setting). The
// generated text persists onto measurements.styleManifesto via saveMeasurements.
function ManifestoShareModal({ manifesto, measurements, onClose }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    composeManifestoExportImage(manifesto, measurements)
      .then((blob) => {
        if (cancelled) return;
        setImageBlob(blob);
        setImageUrl(URL.createObjectURL(blob));
      })
      .catch((e) => setError(e?.message || 'Could not compose your manifesto card.'));
    return () => { cancelled = true; };
  }, [manifesto, measurements]);

  // Free the object URL when it changes or the modal unmounts (mirrors StyleDNAShareModal).
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const handleShare = async () => {
    if (!imageBlob) return;
    await shareOrDownloadImage(imageBlob, 'style-manifesto-atelier.png', {
      title: 'My Style Manifesto',
      text: 'My Style Manifesto — written by Atelier.',
    });
  };

  // Portal to <body> so position:fixed is viewport-relative — the card it's
  // launched from sits inside a transformed/blurred ancestor that would
  // otherwise become the containing block and push the modal off-screen.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-stone-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] p-5 shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-y-auto min-h-0">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : imageUrl ? (
            <img src={imageUrl} alt="Style Manifesto card" className="w-full rounded-lg" />
          ) : (
            <p className="text-sm text-stone-500 py-10 text-center">Composing your card…</p>
          )}
        </div>
        <div className="mt-4">
          <PinToPinterestButton
            imageBlob={imageBlob} busy={busy} setBusy={setBusy}
            cardType="manifesto" name="My Style Manifesto"
            sharedByName="" description="My Style Manifesto — written by Atelier"
          />
        </div>
        <div className="flex gap-2 mt-4 shrink-0">
          <button onClick={handleShare} disabled={!imageBlob} className="flex-1 bg-stone-900 text-white rounded-full py-2.5 text-sm disabled:opacity-40">Share</button>
          <button onClick={onClose} className="px-5 rounded-full border border-stone-300 text-sm">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function StyleManifestoCard({ measurements, saveMeasurements, items = [], outfits = [], inspirations = [] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const cancelledRef = useRef(false);
  const toast = useToast();
  const manifesto = measurements?.styleManifesto || '';
  const generatedAt = measurements?.styleManifestoAt || null;

  useEffect(() => () => { cancelledRef.current = true; }, []);

  // 90-day seasonal nudge: compute age of the current manifesto so we can
  // show a quiet inline prompt to refresh when it's been more than a season.
  const manifestoAgeDays = generatedAt
    ? Math.floor((Date.now() - new Date(generatedAt).getTime()) / (24 * 3600 * 1000))
    : null;
  const manifestoStale = manifesto && manifestoAgeDays !== null && manifestoAgeDays >= 90;

  const run = async () => {
    if (busy) return;
    setBusy(true); setError(null); setStreamingText(''); setIsStreaming(true);
    let accumulated = '';
    try {
      const text = await generateStyleManifestoWithGemini({
        items,
        outfits,
        inspirations,
        onChunk: (chunk) => {
          if (cancelledRef.current) return;
          accumulated += chunk;
          setStreamingText(accumulated);
        },
      });
      if (cancelledRef.current) return;
      await saveMeasurements({ ...measurements, styleManifesto: text, styleManifestoAt: new Date().toISOString() });
      toast.show('Manifesto refreshed', { kind: 'success' });
    } catch (e) {
      if (cancelledRef.current) return;
      setError(e?.message || 'Failed.');
    } finally {
      setIsStreaming(false);
      setBusy(false);
    }
  };

  const WEARS_THRESHOLD = 30;
  const totalWears = items.reduce((sum, it) => sum + itemWearCount(it), 0);

  return (
    <div className="bg-stone-900 text-white rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 opacity-[0.04] pointer-events-none">
        <Sparkles size={220} strokeWidth={0.8} />
      </div>
      <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-medium">A private brief, by the Concierge</span>
          </div>
          <h3 className="font-display text-2xl md:text-3xl text-white">Style manifesto</h3>
          <p className="text-stone-400 text-sm leading-relaxed max-w-xl mt-3">
            The Concierge reads your most-worn pieces, outfit pairings, and saved inspirations — and writes a private three-paragraph brief of your aesthetic. Refresh when your taste shifts.
          </p>
          {!manifesto && !isStreaming && totalWears < WEARS_THRESHOLD && (
            <div className="mt-4 flex items-center gap-3 max-w-xs">
              <div className="flex-1 h-1 rounded-full bg-stone-700 overflow-hidden">
                <div
                  className="h-full bg-brass-400 transition-[width] duration-700"
                  style={{ width: `${Math.min(100, (totalWears / WEARS_THRESHOLD) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] tracking-wide tabular-nums text-stone-400 shrink-0">
                {totalWears} / {WEARS_THRESHOLD} wears
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {manifesto && !isStreaming && (
            <button onClick={() => setShowShare(true)} className="text-xs tracking-wider uppercase px-4 py-2.5 rounded-full border border-stone-600 text-stone-200 inline-flex items-center gap-1.5">
              Share
            </button>
          )}
          <button onClick={run} disabled={busy} className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 flex items-center gap-2 font-medium">
            <Wand2 size={14} strokeWidth={1.5} /> {busy ? 'Writing…' : (manifesto ? 'Refresh' : 'Generate')}
          </button>
        </div>
      </div>

      {error && <p className="relative z-10 mt-4 text-sm text-red-200 bg-red-950/40 border border-red-900/40 px-4 py-3 rounded-xl">{error}</p>}

      {manifestoStale && (
        <div className="relative z-10 mt-5 mb-1 rounded-lg border border-stone-600 bg-stone-800 px-4 py-2 text-sm text-stone-300">
          Your manifesto is {Math.floor(manifestoAgeDays / 30)} months old. A fresh reading?{' '}
          <button
            type="button"
            onClick={run}
            className="font-medium underline hover:no-underline"
          >
            Refresh it
          </button>
        </div>
      )}

      {(manifesto || isStreaming) && (
        <div className="relative z-10 mt-6 bg-cream text-stone-800 rounded-2xl p-6 sm:p-8 text-sm sm:text-[15px] leading-[1.8] font-display">
          {isStreaming ? (
            <div className="whitespace-pre-line italic">{streamingText}<span className="inline-block w-0.5 h-4 align-middle ml-0.5 bg-stone-700 animate-pulse" /></div>
          ) : (
            <ManifestoBody text={manifesto} />
          )}
          {!isStreaming && generatedAt && (
            <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-5 font-sans not-italic flex items-center gap-3">
              <span className="brass-rule" aria-hidden="true"></span>
              Written {new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
      {showShare && (
        <ManifestoShareModal manifesto={manifesto} measurements={measurements} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}

export default function InsightsView({ items, inspirations = [], onJumpToWardrobe, measurements, saveMeasurements, onOpenProfile, onOpenItem, outfits = [], schedules = {}, onOpenOutfit, onOpenDiary }) {
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [dnaShareOpen, setDnaShareOpen] = useState(false);
  const ownedItems = items.filter(i => i.status === 'owned');
  const wishlistItems = items.filter(i => i.status === 'wishlist');
  const ownedTotal = ownedItems.reduce((sum, i) => sum + i.price, 0);
  const wishlistTotal = wishlistItems.reduce((sum, i) => sum + i.price, 0);
  const categoryBreakdown = ownedItems.reduce((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.price; return acc; }, {});

  // Spending this month — counts owned items added (purchasedDate || createdAt)
  // in the current calendar month. The "spend date" preference: explicit
  // purchasedDate wins because it reflects when money actually left the user;
  // createdAt is the fallback for items entered without a purchase date.
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const monthSpendItems = ownedItems.filter((i) => {
    const dateStr = i.purchasedDate || i.createdAt || '';
    return typeof dateStr === 'string' && dateStr.slice(0, 7) === currentYM;
  });
  const monthSpend = monthSpendItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const monthlyBudget = Number(measurements?.monthlyBudget) || 0;
  const budgetPct = monthlyBudget > 0 ? (monthSpend / monthlyBudget) * 100 : 0;
  const budgetTone = budgetPct <= 70 ? 'green' : budgetPct <= 100 ? 'amber' : 'red';

  // Cost-per-wear leaderboard: best value (lowest CPW), only items actually worn
  const bestCpw = ownedItems
    .map((i) => ({ ...i, _cpw: itemCostPerWear(i), _wears: itemWearCount(i) }))
    .filter((i) => i._cpw !== null && i._wears > 0)
    .sort((a, b) => a._cpw - b._cpw)
    .slice(0, 5);

  // Most worn
  const mostWorn = ownedItems
    .map((i) => ({ ...i, _wears: itemWearCount(i) }))
    .filter((i) => i._wears > 0)
    .sort((a, b) => b._wears - a._wears)
    .slice(0, 5);

  // Season name — moved up from further below (it's also used there, for
  // season-coverage tracking) so the "stale" filter immediately below can
  // exclude out-of-season pieces. Same computation, single definition.
  const seasonName = now.getMonth() >= 2 && now.getMonth() <= 4 ? 'Spring'
    : now.getMonth() >= 5 && now.getMonth() <= 7 ? 'Summer'
    : now.getMonth() >= 8 && now.getMonth() <= 10 ? 'Autumn'
    : 'Winter';

  // Stale items: owned 90+ days, currently in-season, not worn in 90+ days
  // (or never). The ownership and season guards stop a brand-new purchase
  // or an out-of-season piece (a winter coat in July) from reading as
  // "neglected" — it would be incoherent to call something "not worn in 90
  // days" when it hasn't even been owned that long, or to flag it when it
  // isn't wearable right now anyway.
  const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
  const stale = ownedItems
    .map((i) => ({ ...i, _days: daysSinceLastWorn(i) }))
    .filter((i) => i._days === null || i._days >= 90)
    .filter((i) => i.createdAt && new Date(i.createdAt).getTime() < ninetyDaysAgo)
    .filter((i) => {
      const s = itemSeasons(i);
      return s.length === 0 || s.includes(seasonName);
    })
    .sort((a, b) => (b._days ?? Infinity) - (a._days ?? Infinity))
    .slice(0, 6);

  // Worst value: owned 6+ months, priced > £50, low or zero wear. Sorted by
  // "wasted spend" (price ÷ max(wears, 1)) so a £400 unworn coat beats a
  // £60 dress worn twice. Cap the surface to 5 — this is sensitive feedback.
  const sixMonthsAgo = Date.now() - 180 * 86_400_000;
  const worstValue = ownedItems
    .map((i) => ({ ...i, _wears: itemWearCount(i), _cpw: itemCostPerWear(i) }))
    .filter((i) => i.price > 50 && i.createdAt && new Date(i.createdAt).getTime() < sixMonthsAgo)
    .map((i) => ({ ...i, _waste: i.price / Math.max(i._wears, 1) }))
    .sort((a, b) => b._waste - a._waste)
    .slice(0, 5);

  const totalWears = ownedItems.reduce((sum, i) => sum + itemWearCount(i), 0);
  const wornPieces = ownedItems.filter((i) => itemWearCount(i) > 0).length;
  const gaps = computeWardrobeGaps(ownedItems);

  // Wear diary — every wear, grouped by date, newest first. Joins in
  // scheduled-outfit context (event name, worn photo) so the diary reads
  // as a real record of what was actually worn day-to-day, not just a
  // flat list of wear events.
  const wearDiary = useMemo(() => {
    const byDate = {};
    for (const it of ownedItems) {
      const hist = itemWearHistory(it);
      const notes = itemWearNotes(it);
      for (const d of hist) {
        if (!byDate[d]) byDate[d] = { date: d, items: [], notes: [] };
        byDate[d].items.push(it);
        if (notes[d]) byDate[d].notes.push({ itemId: it.id, itemName: it.name, note: notes[d] });
      }
    }
    for (const group of Object.values(byDate)) {
      const sched = schedules?.[group.date];
      if (sched?.outfitId) {
        const out = outfits.find((o) => o.id === sched.outfitId);
        if (out) {
          group.outfit = out;
          if (sched.eventName) group.eventName = sched.eventName;
          const photo = (out.wornPhotos || []).find((p) => p.date === group.date);
          if (photo) group.photo = photo.image;
        }
      }
    }
    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  }, [ownedItems, outfits, schedules]);
  const recentDiary = wearDiary.slice(0, 5);

  const friendlyDay = (iso) => {
    const t = todayISO();
    if (iso === t) return 'Today';
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (iso === y.toISOString().slice(0, 10)) return 'Yesterday';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Season coverage — % of in-season owned pieces worn at least once in
  // the current season window. Behavioural nudge to actually wear what
  // you own; surfaces forgotten pieces in the right time of year.
  // (seasonName itself is now defined earlier, alongside the "stale" filter
  // that also needs it — see above.)
  const seasonStart = (() => {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (m >= 2 && m <= 4) return `${y}-03-01`;
    if (m >= 5 && m <= 7) return `${y}-06-01`;
    if (m >= 8 && m <= 10) return `${y}-09-01`;
    // Winter spans the year boundary — Dec last year, Jan/Feb this year.
    return m === 11 ? `${y}-12-01` : `${y - 1}-12-01`;
  })();
  const inSeasonItems = ownedItems.filter((i) => {
    const s = itemSeasons(i);
    return s.length === 0 || s.includes(seasonName);
  });
  const wornThisSeason = inSeasonItems.filter((i) => {
    const hist = itemWearHistory(i);
    return hist.some((d) => d >= seasonStart);
  });
  const seasonCoveragePct = inSeasonItems.length > 0 ? (wornThisSeason.length / inSeasonItems.length) * 100 : 0;
  const seasonUnworn = inSeasonItems
    .filter((i) => !wornThisSeason.find((w) => w.id === i.id))
    .sort((a, b) => {
      // Surface items unworn for the longest first.
      const da = daysSinceLastWorn(a); const db = daysSinceLastWorn(b);
      return (db === null ? Infinity : db) - (da === null ? Infinity : da);
    })
    .slice(0, 6);
  const coverageTone = seasonCoveragePct >= 60 ? 'high' : seasonCoveragePct >= 30 ? 'mid' : 'low';
  const coverageMessage = coverageTone === 'high'
    ? `You're wearing your ${seasonName.toLowerCase()} wardrobe well — ${wornThisSeason.length} of ${inSeasonItems.length} pieces seen so far.`
    : coverageTone === 'mid'
    ? `${wornThisSeason.length} of ${inSeasonItems.length} ${seasonName.toLowerCase()} pieces worn this season — plenty of rotation room.`
    : `Plenty of ${seasonName.toLowerCase()} pieces are gathering dust — ${inSeasonItems.length - wornThisSeason.length} unworn this season.`;

  // Wear timeline: counts per month for the last 12 months. Reuses the `now`
  // already declared above for the spending-meter window.
  const timeline = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    timeline.push({ ym, label: d.toLocaleDateString('en-GB', { month: 'short' }), count: 0 });
  }
  for (const item of ownedItems) {
    for (const d of itemWearHistory(item)) {
      const ym = d.slice(0, 7);
      const entry = timeline.find((t) => t.ym === ym);
      if (entry) entry.count++;
    }
  }
  const maxBar = Math.max(1, ...timeline.map((t) => t.count));

  // Wardrobe colour profile — count colour-family occurrences across owned items.
  const colorCounts = {};
  for (const item of ownedItems) {
    for (const c of itemColors(item)) colorCounts[c] = (colorCounts[c] || 0) + 1;
  }
  const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  const colorTotal = sortedColors.reduce((s, [, n]) => s + n, 0);
  const taggedItemsCount = ownedItems.filter((i) => itemColors(i).length > 0).length;

  // Sub-section anchors so the sticky nav below the header can jump
  // straight to a section without a 4000px scroll. Each major section
  // sets its id={anchor.X.id}; the nav <a> hrefs target #{id}.
  // Four numbered groups, matching the Profile page's header system. Order is
  // a stylist's read: who you are → how you wear it → standout pieces → money.
  const SECTIONS = [
    { id: 'group-signature', label: 'Signature' },
    { id: 'group-wear', label: 'How You Wear It' },
    { id: 'group-standout', label: 'Standout Pieces' },
    { id: 'group-ledger', label: 'The Ledger' },
  ];

  return (
    <div className="space-y-10 md:space-y-12 max-w-5xl">
      <EditorialHeader eyebrow="The Dossier" title="Insights" subtitle="Your aesthetic, how you wear it, and what it's worth." />
      {dnaShareOpen && <StyleDNAShareModal items={items} measurements={measurements} onClose={() => setDnaShareOpen(false)} />}

      {/* Sticky sub-section nav. Long page; without this the user
          scrolls forever to find e.g. the colour profile or the wear
          timeline. Same bg + bleed pattern as the wardrobe toolbar so
          it reads as page chrome, not a content card.
          IMPORTANT: NO negative margins here — earlier version had
          -mb-2 which pulled the hero cards up by 8px AND the nav sits
          at z-20, so the top of the cards was visually clipped behind
          the bar. Natural space-y spacing from the parent does the job. */}
      {/* top-0 only — <main> supplies the safe-area inset; re-adding
          top:inset double-offsets this bar in standalone/PWA. */}
      <nav className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 py-3 bg-cream/95 backdrop-blur-md border-b border-stone-200/60">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className="text-[10px] sm:text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors duration-200">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <section id="group-signature" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">01</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">Signature</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      <div id="insights-manifesto" className="scroll-mt-24">
        <StyleManifestoCard measurements={measurements} saveMeasurements={saveMeasurements} items={items} outfits={outfits} inspirations={inspirations} />
      </div>

      <div id="insights-composition" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-baseline justify-between gap-3 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-block w-5 h-px bg-brass-300" aria-hidden="true" />
              <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-semibold">Composition</p>
            </div>
            <h3 className="font-display text-2xl text-stone-900">Investment by category</h3>
          </div>
          {Object.keys(categoryBreakdown).length > 0 && onJumpToWardrobe && (
            <span className="text-[10px] tracking-widest uppercase text-stone-400 italic font-display">Tap a tile to open in your wardrobe</span>
          )}
        </div>
        <CategoryTreemap
          categoryBreakdown={categoryBreakdown}
          ownedItems={ownedItems}
          onJumpToWardrobe={onJumpToWardrobe}
        />
      </div>

      {sortedColors.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="inline-block w-5 h-px bg-brass-300" aria-hidden="true" />
                <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-semibold">Palette</p>
              </div>
              <h3 className="font-display text-xl md:text-2xl text-stone-900">Colour profile</h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] tracking-widest uppercase text-stone-400 italic font-display">
                {sortedColors.length} colour {sortedColors.length === 1 ? 'family' : 'families'}
              </span>
              <button onClick={() => setDnaShareOpen(true)}
                className="text-[10px] tracking-widest uppercase px-4 py-2 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors inline-flex items-center gap-1.5">
                <Share2 size={12} strokeWidth={1.5} /> Share my Style DNA
              </button>
            </div>
          </div>

          {/* Wheel + legend: side-by-side at md+, stacked on mobile. The wheel
              is the icon; the legend is the index — together they read like
              a Pantone fan opened across two pages. */}
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 md:gap-10 items-center">
            <ColourWheel
              sortedColors={sortedColors}
              colorTotal={colorTotal}
              ownedCount={ownedItems.length}
              taggedCount={taggedItemsCount}
            />
            <div className="space-y-3.5">
              {sortedColors.slice(0, 8).map(([color, count]) => {
                const pct = colorTotal > 0 ? (count / colorTotal) * 100 : 0;
                const swatch = COLOR_SWATCHES[color];
                return (
                  <div key={color}>
                    <div className="flex justify-between items-center text-sm mb-1.5 gap-3">
                      <span className="flex items-center gap-2.5 font-medium text-stone-800 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-stone-300/60 shrink-0"
                          style={swatch?.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }}
                        />
                        <span className="truncate">{color}</span>
                      </span>
                      <span className="text-stone-500 text-xs shrink-0 tabular-nums">
                        {count} <span className="text-stone-300 ml-1.5">{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <HairlineBar
                      value={pct}
                      height={4}
                      track="#f5f5f4"
                      fill={swatch || 'var(--color-stone-900, #1c1917)'}
                    />
                  </div>
                );
              })}
              {sortedColors.length > 8 && (
                <p className="text-[10px] tracking-widest uppercase text-stone-400 italic pt-1">
                  + {sortedColors.length - 8} more in your palette
                </p>
              )}
            </div>
          </div>

          {taggedItemsCount < ownedItems.length && (
            <button
              type="button"
              onClick={() => onJumpToWardrobe?.({ filter: 'untagged' })}
              disabled={!onJumpToWardrobe}
              className="group mt-8 inline-flex items-center gap-1.5 text-[11px] text-stone-500 italic font-display enabled:hover:text-stone-900 transition-colors disabled:cursor-default"
            >
              <span className="not-italic font-sans tabular-nums font-semibold text-stone-700 group-enabled:group-hover:text-stone-900">{ownedItems.length - taggedItemsCount}</span>
              item{ownedItems.length - taggedItemsCount === 1 ? '' : 's'} without colour tags — review &amp; fix
              <ChevronRight size={13} strokeWidth={1.5} className="opacity-0 -translate-x-1 transition-all group-enabled:group-hover:opacity-100 group-enabled:group-hover:translate-x-0" />
            </button>
          )}
        </div>
      )}

      </section>

      <section id="group-wear" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">02</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">How You Wear It</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      {/* Season coverage — % of in-season pieces actually worn this season,
          plus a curated row of unworn-but-in-season items as a nudge to
          surface them. The anti-overconsumption companion to the spending
          meter: 'before you buy, wear what you already own'. */}
      {inSeasonItems.length >= 3 && (
        <div id="insights-behaviour" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-semibold mb-1">Season coverage · {seasonName} {now.getFullYear()}</p>
              <h3 className="font-display text-3xl sm:text-4xl text-stone-900">
                {seasonCoveragePct.toFixed(0)}%
                <span className="text-base sm:text-lg text-stone-400 font-normal ml-2">of your {seasonName.toLowerCase()} wardrobe</span>
              </h3>
            </div>
            <div className="text-right">
              <p className={`text-xl sm:text-2xl font-display ${
                coverageTone === 'high' ? 'text-emerald-700'
                : coverageTone === 'mid' ? 'text-stone-900'
                : 'text-brass-700'
              }`}>{wornThisSeason.length}/{inSeasonItems.length}</p>
              <p className="text-[10px] tracking-widest uppercase text-stone-500">pieces worn</p>
            </div>
          </div>
          <DialBar
            value={seasonCoveragePct}
            height={6}
            track="#f5f5f4"
            fill={coverageTone === 'high' ? 'var(--color-stone-900, #1c1917)'
              : coverageTone === 'mid' ? 'var(--color-stone-900, #1c1917)'
              : 'var(--color-brass-400, #c19a5b)'}
          />
          <p className="text-xs text-stone-500 mt-4 leading-relaxed">{coverageMessage}</p>

          {seasonUnworn.length > 0 && (
            <div className="mt-6 pt-6 border-t border-stone-100">
              <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
                <p className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold">Unworn this {seasonName.toLowerCase()} · try one</p>
                {inSeasonItems.length - wornThisSeason.length > seasonUnworn.length && onJumpToWardrobe && (
                  <button onClick={() => onJumpToWardrobe({ filter: 'stale' })} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 inline-flex items-center gap-1">
                    See all → <ChevronRight size={11} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {seasonUnworn.map((it) => {
                  const clickable = !!onOpenItem;
                  const Wrap = clickable ? 'button' : 'div';
                  return (
                    <Wrap
                      key={it.id}
                      {...(clickable ? { type: 'button', onClick: () => onOpenItem(it.id), 'aria-label': `Open ${it.name}` } : {})}
                      className={`text-left ${clickable ? 'group cursor-pointer' : ''}`}
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 mb-2 border border-stone-200/60">
                        {itemImages(it)[0] ? (
                          <ItemTileImage item={it} alt={it.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={28} strokeWidth={1} /></div>
                        )}
                      </div>
                      <p className={`text-[11px] truncate ${clickable ? 'text-stone-700 group-hover:text-stone-900' : 'text-stone-700'}`}>{it.name}</p>
                      <p className="text-[10px] text-stone-500 truncate uppercase tracking-wider">{it.brand}</p>
                    </Wrap>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DIARY HAND-OFF CARD — the full wear journal + calendar lives in
          its own Diary destination now. This card is a portal: shows the
          stats at a glance + the most recent day's photo (if any), and
          hands the user off to the dedicated destination. Insights keeps
          its analytical role; the journal/keepsake lives in The Diary. */}
      {wearDiary.length > 0 && onOpenDiary && (
        <button
          type="button"
          onClick={onOpenDiary}
          id="insights-diary"
          className="scroll-mt-24 block w-full text-left bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow hover:border-brass-300/70 transition-colors group"
        >
          <div className="flex items-start gap-6 flex-wrap sm:flex-nowrap">
            {recentDiary[0]?.photo && (
              <div className="shrink-0 w-full sm:w-44 aspect-[4/5] rounded-2xl overflow-hidden bg-stone-100 ring-1 ring-stone-200/60">
                <img src={recentDiary[0].photo} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <span className="brass-rule" aria-hidden="true" />
                <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">The Diary</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl text-stone-900 leading-tight group-hover:text-brass-700 transition-colors">
                What you've actually worn
              </h3>
              <p className="text-sm text-stone-500 mt-2 font-display italic leading-relaxed">
                Every wear, every plan — your keepsake of how you actually dress.
              </p>
              <div className="flex items-baseline gap-6 mt-5 text-sm text-stone-600 flex-wrap">
                <span><strong className="text-stone-900 font-display text-lg">{wearDiary.length}</strong> day{wearDiary.length === 1 ? '' : 's'}</span>
                <span><strong className="text-stone-900 font-display text-lg">{wearDiary.reduce((s, e) => s + e.items.length, 0)}</strong> wears</span>
                {recentDiary[0] && (
                  <span className="text-stone-500">last logged <strong className="text-stone-900 font-medium">{friendlyDay(recentDiary[0].date).toLowerCase()}</strong></span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 mt-5 text-[11px] tracking-widest uppercase text-stone-700 group-hover:text-brass-700 transition-colors">
                Open the Diary <ChevronRight size={12} strokeWidth={1.5} className="opacity-60 group-hover:translate-x-0.5 group-hover:opacity-100 transition-all" />
              </span>
            </div>
          </div>
        </button>
      )}

      {totalWears > 0 && (
        <WearTimelineCard ownedItems={ownedItems} timeline={timeline} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white border border-stone-200/60 rounded-2xl p-5 smooth-shadow">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Total wears</p>
          <p className="font-display text-3xl md:text-4xl text-stone-900 mt-2">{totalWears}</p>
          <p className="text-xs text-stone-500 mt-1">across all owned items</p>
        </div>
        <div className="bg-white border border-stone-200/60 rounded-2xl p-5 smooth-shadow">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Items in rotation</p>
          <p className="font-display text-3xl md:text-4xl text-stone-900 mt-2">{wornPieces}<span className="text-stone-300 text-xl"> / {ownedItems.length}</span></p>
          <p className="text-xs text-stone-500 mt-1">pieces worn at least once</p>
        </div>
        <div className="bg-white border border-stone-200/60 rounded-2xl p-5 smooth-shadow">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Stale (90+ days)</p>
          <p className="font-display text-3xl md:text-4xl text-stone-900 mt-2">{stale.length}</p>
          <p className="text-xs text-stone-500 mt-1">filterable in the wardrobe</p>
        </div>
      </div>

      </section>

      {(bestCpw.length > 0 || worstValue.length > 0 || mostWorn.length > 0 || gaps.length > 0 || stale.length > 0) && (
      <section id="group-standout" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">03</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">Standout Pieces</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      {bestCpw.length > 0 && (
        <div id="insights-leaders" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Best value · cost per wear</h3>
            <TrendingDown size={18} className="text-stone-400" />
          </div>
          <div className="space-y-4">
            {bestCpw.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4">
                <span className="font-display text-stone-300 text-xl w-6 text-right">{idx + 1}</span>
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  <ItemTileImage item={item} alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5 truncate">{item.brand} · {item._wears} {item._wears === 1 ? 'wear' : 'wears'}</p>
                </div>
                <p className="font-display text-lg text-stone-900 whitespace-nowrap">£{item._cpw < 10 ? item._cpw.toFixed(2) : Math.round(item._cpw)}<span className="text-stone-400 text-xs">/wear</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {worstValue.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Worst value · still paying for these</h3>
            <span className="text-[10px] uppercase tracking-widest text-stone-400">Owned 6+ months</span>
          </div>
          <p className="text-stone-500 text-xs mb-6">High-spend pieces with little wear so far — fair game for restyling, re-selling, or returning to rotation.</p>
          <div className="space-y-4">
            {worstValue.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4">
                <span className="font-display text-stone-300 text-xl w-6 text-right">{idx + 1}</span>
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  <ItemTileImage item={item} alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5 truncate">
                    {item.brand} · {item._wears === 0 ? 'never worn' : `${item._wears} ${item._wears === 1 ? 'wear' : 'wears'}`} · £{item.price}
                  </p>
                </div>
                <p className="font-display text-lg text-stone-900 whitespace-nowrap">
                  {item._cpw === null
                    ? <span className="text-stone-400">unworn</span>
                    : <>£{item._cpw < 10 ? item._cpw.toFixed(2) : Math.round(item._cpw)}<span className="text-stone-400 text-xs">/wear</span></>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostWorn.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-6">Most worn</h3>
          <div className="space-y-4">
            {mostWorn.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4">
                <span className="font-display text-stone-300 text-xl w-6 text-right">{idx + 1}</span>
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  <ItemTileImage item={item} alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5 truncate">{item.brand}</p>
                </div>
                <p className="font-display text-lg text-stone-900 whitespace-nowrap">{item._wears}<span className="text-stone-400 text-xs"> wears</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      <GapAnalysisPanel items={ownedItems} inspirations={inspirations} />

      {gaps.length > 0 && (
        <div className="bg-stone-900 text-white rounded-[2rem] p-6 md:p-10">
          <h3 className="font-display text-xl md:text-2xl mb-2">Wardrobe gaps</h3>
          <p className="text-stone-400 text-sm mb-6">Where your collection is thin. Grounded in your data, not Instagram's.</p>
          <ul className="space-y-4">
            {gaps.map((gap, i) => (
              <li key={i} className="flex gap-4 border-t border-stone-800 pt-4 first:border-t-0 first:pt-0">
                <span className="font-display text-stone-500 text-xl w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-stone-100">{gap.label}</p>
                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">{gap.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stale.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
          <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-2">Stale — wear or part with?</h3>
          <p className="text-stone-500 text-sm mb-6">Owned items not worn in 90+ days. Wear deliberately this week, or move on.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stale.map((item) => {
              const clickable = !!onOpenItem;
              const Wrap = clickable ? 'button' : 'div';
              return (
                <Wrap
                  key={item.id}
                  {...(clickable ? { type: 'button', onClick: () => onOpenItem(item.id), 'aria-label': `Open ${item.name}` } : {})}
                  className={`flex flex-col gap-2 text-left ${clickable ? 'group cursor-pointer' : ''}`}
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100">
                    <ItemTileImage item={item} alt={item.name} />
                  </div>
                  <p className={`text-xs truncate ${clickable ? 'text-stone-900 group-hover:text-stone-700' : 'text-stone-900'}`}>{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400">
                    {item._days === null ? 'Never worn' : `${item._days}d ago`}
                  </p>
                </Wrap>
              );
            })}
          </div>
        </div>
      )}

      </section>
      )}

      <section id="group-ledger" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">04</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">The Ledger</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      <div id="insights-value" className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 scroll-mt-24">
        {/* Hero value cards. Two design notes:
            • Dark card uses NO shadow — a dark surface against the light
              page already reads as elevated; smooth-shadow on dark is
              redundant decoration. Light card keeps smooth-shadow because
              it needs the depth cue against the same-tone page.
            • Both cards lead with the brass-rule + eyebrow editorial
              pattern used in every main-column header so the page speaks
              one typographic language. */}
        <div className="bg-stone-900 text-white p-7 md:p-9 rounded-[2rem] relative overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-block w-5 h-px bg-brass-300" aria-hidden="true"></span>
            <p className="text-stone-400 text-[10px] font-semibold tracking-[0.28em] uppercase">Current Archive Value</p>
          </div>
          <h3 className="text-5xl md:text-6xl font-display font-medium tracking-tight">£{ownedTotal.toLocaleString()}</h3>
          <p className="text-xs text-stone-400 mt-6 tracking-widest uppercase">
            Across {ownedItems.length} curated pieces
          </p>
        </div>

        {/* Wishlist Target — clickable, jumps to Wardrobe filtered to wishlist.
            No wrapper transforms (anti-pattern fixed elsewhere). */}
        <button
          onClick={() => onJumpToWardrobe?.({ filter: 'wishlist' })}
          disabled={!onJumpToWardrobe || wishlistItems.length === 0}
          className="text-left bg-white border border-stone-200/60 p-7 md:p-9 rounded-[2rem] smooth-shadow transition-colors duration-200 enabled:hover:border-stone-500 disabled:cursor-default group"
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <span className="inline-block w-5 h-px bg-brass-300" aria-hidden="true"></span>
              <p className="text-stone-500 text-[10px] font-semibold tracking-[0.28em] uppercase">Wishlist Target</p>
            </div>
            {wishlistItems.length > 0 && (
              <span className="text-[10px] tracking-widest uppercase text-stone-400 group-hover:text-stone-900 transition-colors inline-flex items-center gap-1">
                View <ChevronRight size={12} strokeWidth={1.5} />
              </span>
            )}
          </div>
          <h3 className="text-5xl md:text-6xl font-display text-stone-900 font-medium tracking-tight">£{wishlistTotal.toLocaleString()}</h3>
          <p className="text-xs text-stone-500 mt-6 tracking-widest uppercase inline-flex items-center gap-1.5">
            <Heart size={11} strokeWidth={1.5} className="text-stone-400" />
            {wishlistItems.length} pieces desired
          </p>
        </button>
      </div>

      {/* Spending meter — shows month-to-date spend against the user's
          monthly budget. Hidden entirely if no budget set; a soft prompt
          card with a link to Profile if there's no budget but they have
          purchases this month. */}
      {monthlyBudget > 0 ? (
        <div id="insights-spending" className="scroll-mt-24 rounded-[2rem] p-6 md:p-8 smooth-shadow relative overflow-hidden border bg-white border-stone-200/60">
          {/* Editorial alert: NO tonal-flip backgrounds. The whole card stays
              cream/white; the warning lives in one bar fill colour + one italic
              caption. Stone → brass → claret, the three editorial steps. */}
          {(() => {
            const accent = budgetTone === 'green' ? 'var(--color-stone-900, #1c1917)'
              : budgetTone === 'amber' ? 'var(--color-brass-500, #b08349)'
              : 'var(--color-claret-700, #56241f)';
            const accentClass = budgetTone === 'green' ? 'text-stone-900'
              : budgetTone === 'amber' ? 'text-brass-700'
              : 'text-claret-700';
            const eyebrow = budgetTone === 'green' ? 'Spending'
              : budgetTone === 'amber' ? 'Spending · approaching budget'
              : 'Spending · over budget';
            return (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-block w-5 h-px" style={{ backgroundColor: accent, opacity: 0.7 }} aria-hidden="true" />
                  <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-semibold">{eyebrow} · {monthName}</p>
                </div>
                <div className="flex items-baseline justify-between gap-3 mb-5 flex-wrap">
                  <div>
                    <h3 className="font-display text-3xl sm:text-4xl text-stone-900">
                      £{monthSpend.toLocaleString()}
                      <span className="text-base sm:text-lg text-stone-400 font-normal ml-2">of £{monthlyBudget.toLocaleString()}</span>
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl sm:text-2xl font-display ${accentClass}`}>{budgetPct.toFixed(0)}%</p>
                    <p className="text-[10px] tracking-widest uppercase text-stone-500">{monthSpendItems.length} item{monthSpendItems.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <DialBar value={budgetPct} fill={accent} height={6} />
                <p className={`text-xs mt-4 leading-relaxed ${budgetTone === 'red' ? 'italic text-claret-700' : 'text-stone-500'}`}>
                  {budgetTone === 'green' && monthSpend === 0 && `No purchases this month yet — you have £${monthlyBudget.toLocaleString()} of headroom.`}
                  {budgetTone === 'green' && monthSpend > 0 && `£${(monthlyBudget - monthSpend).toLocaleString()} left until you hit your budget for ${monthName.split(' ')[0]}.`}
                  {budgetTone === 'amber' && `Approaching your budget — £${(monthlyBudget - monthSpend).toLocaleString()} of headroom before you tip over.`}
                  {budgetTone === 'red' && `Over by £${(monthSpend - monthlyBudget).toLocaleString()} — worth a quiet look at what you've added this month.`}
                </p>
              </>
            );
          })()}
          {monthSpendItems.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {monthSpendItems.slice(0, 8).map((i) => (
                <span key={i.id} className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600">
                  {i.name}{i.price ? ` · £${Number(i.price).toLocaleString()}` : ''}
                </span>
              ))}
              {monthSpendItems.length > 8 && (
                <span className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full text-stone-500">+ {monthSpendItems.length - 8} more</span>
              )}
            </div>
          )}
        </div>
      ) : monthSpendItems.length > 0 && onOpenProfile ? (
        <button onClick={onOpenProfile}
          id="insights-spending"
          className="scroll-mt-24 w-full text-left bg-white border border-dashed border-stone-300 rounded-[2rem] p-6 md:p-8 hover:border-stone-500 transition-colors group">
          <p className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-semibold mb-2">Spending · {monthName}</p>
          <h3 className="font-display text-2xl text-stone-900">£{monthSpend.toLocaleString()} added this month</h3>
          <p className="text-sm text-stone-500 mt-3 leading-relaxed">
            Set a monthly budget in Profile → Settings to track headroom and get alerts when you approach the limit.
            <span className="block mt-2 text-stone-900 group-hover:underline text-xs tracking-widest uppercase">Open Profile →</span>
          </p>
        </button>
      ) : null}

      </section>
    </div>
  );
}
