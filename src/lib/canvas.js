// Canvas & image helpers — outfit-export composition (pure Canvas API, no
// html2canvas dependency), client-side compression, auto-enhance,
// background removal, and share/download. Browser APIs only.
import { itemImages, itemColors } from "./items.js";
import { hexFromColorName } from "./color.js";
import { COLOR_SWATCHES } from "./taxonomy.js";

// Resolve a colour-family name to a SOLID, canvas-fillable hex. COLOR_SWATCHES
// may hold a CSS linear-gradient string (the metallics — Gold, Rose Gold, etc.)
// which ctx.fillStyle can't accept as a plain string, so those fall back to the
// approximate solid hex from hexFromColorName.
function solidSwatch(name) {
  const sw = COLOR_SWATCHES[name];
  if (typeof sw === 'string' && !sw.startsWith('linear') && !sw.startsWith('radial')) return sw;
  return hexFromColorName(name);
}

// ─── Editorial export ────────────────────────────────────────────────────
// Compose a saved outfit (or a free-form set of pieces) into a 1080×1920
// PNG suitable for Instagram Story / Pinterest / etc. Pure Canvas API —
// no html2canvas / html-to-image dependency. The composition mirrors the
// app's editorial language: F7F5F2 page bg, brass-rule + small-caps eyebrow,
// Playfair Display title, refined item grid, brand wordmark footer.
export function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function loadImageForCanvas(src) {
  if (!src) return Promise.resolve(null);

  // Data URLs are same-origin so no CORS attr needed and setting it
  // can actually break them in some browsers.
  const isData = src.startsWith('data:');

  const tryLoad = (url, useCors) => new Promise((res) => {
    const img = new Image();
    if (useCors && !isData) img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });

  return new Promise(async (resolve) => {
    // First try: direct load with CORS attr — works for Firebase Storage,
    // weserv-proxied URLs, and any CDN that sends ACAO headers.
    const direct = await tryLoad(src, true);
    if (direct) return resolve(direct);

    // For data URLs there's nothing else to try
    if (isData) return resolve(null);

    // Fallback: route through weserv.nl which re-emits the image with
    // permissive CORS headers. This unblocks third-party CDNs that
    // refuse to send ACAO themselves (Monica Vinader, etc).
    try {
      const u = new URL(src);
      const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(u.hostname + u.pathname + u.search)}`;
      const viaProxy = await tryLoad(proxied, true);
      if (viaProxy) return resolve(viaProxy);
    } catch {
      // bad URL — fall through to null
    }

    resolve(null);
  });
}
export function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      if (lines.length === maxLines) {
        // Truncate with ellipsis
        let truncated = word;
        while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        lines[lines.length - 1] = lines[lines.length - 1] + ' ' + truncated.trim() + '…';
        line = '';
        break;
      }
      line = word;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineHeight));
  return lines.length;
}

export async function composeOutfitExportImage(outfit, items) {
  const pieces = (outfit?.itemIds || [])
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean);
  if (pieces.length === 0) throw new Error('No pieces in this look to export.');

  // Wait for custom fonts to be ready so canvas renders Playfair / Jost,
  // not a fallback. document.fonts.ready resolves once @font-face loads
  // triggered by the page have completed.
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* non-blocking */ }
  }

  const W = 1080, H = 1920;
  const PAD = 88;
  const BRASS = '#C9A66B';
  const PAGE = '#F7F5F2';
  const INK = '#1c1917';
  const MUTED = '#78716c';

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, W, H);

  // === HEADER ===
  // brass-rule
  ctx.fillStyle = BRASS;
  ctx.fillRect(PAD, 142, 56, 3);
  // eyebrow
  ctx.font = '500 22px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textBaseline = 'middle';
  ctx.fillText('A LOOK · COMPOSED IN ATELIER', PAD + 76, 144);
  // title
  ctx.font = '500 76px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  wrapCanvasText(ctx, outfit?.name || 'A composed look', PAD, 248, W - PAD * 2, 88, 2);

  // === PALETTE STRIP ===
  // Computed across all outfit pieces, sorted by prevalence, capped at 6
  // so the row fits cleanly in one line at this resolution.
  const paletteY = 320;
  const paletteCounts = new Map();
  for (const p of pieces) {
    for (const c of (itemColors(p) || [])) {
      const key = (c || '').toLowerCase().trim();
      if (!key) continue;
      paletteCounts.set(key, (paletteCounts.get(key) || 0) + 1);
    }
  }
  const palette = [...paletteCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (palette.length > 0) {
    // brass-rule + "PALETTE" eyebrow
    ctx.fillStyle = BRASS;
    ctx.fillRect(PAD, paletteY, 36, 2);
    ctx.font = '500 18px Jost, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.textBaseline = 'middle';
    ctx.fillText('PALETTE', PAD + 52, paletteY + 1);

    // Swatches
    const swatchY = paletteY + 36;
    const swatchR = 22; // circle radius
    const labelGap = 12;
    const itemGap = 28;
    let cursorX = PAD;
    ctx.font = '500 18px Jost, sans-serif';
    ctx.textBaseline = 'middle';
    for (const [name, count] of palette) {
      const hex = hexFromColorName(name);
      // Circle
      ctx.beginPath();
      ctx.fillStyle = hex;
      ctx.arc(cursorX + swatchR, swatchY + swatchR, swatchR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.stroke();
      // Label
      const label = count > 1 ? `${name.toUpperCase()} × ${count}` : name.toUpperCase();
      const labelX = cursorX + swatchR * 2 + labelGap;
      const labelW = ctx.measureText(label).width;
      ctx.fillStyle = INK;
      ctx.fillText(label, labelX, swatchY + swatchR);
      cursorX = labelX + labelW + itemGap;
      // Wrap to next line if next swatch would overflow — simple guard
      if (cursorX > W - PAD - 200) break;
    }
  }

  // === ITEMS GRID ===
  const imgs = await Promise.all(pieces.map((p) => loadImageForCanvas(itemImages(p)[0])));
  // Smart grid: 1=full, 2=stack, 3-4=2col, 5-6=2col, 7-9=3col
  const cols = pieces.length === 1 ? 1
             : pieces.length === 2 ? 2
             : pieces.length <= 6 ? 2
             : 3;
  const rows = Math.ceil(pieces.length / cols);
  const GRID_TOP = 420;
  const GRID_BOTTOM = H - 400;
  const GUTTER = 36;
  const cellW = (W - PAD * 2 - GUTTER * (cols - 1)) / cols;
  const maxCellH = (GRID_BOTTOM - GRID_TOP - GUTTER * (rows - 1)) / rows;
  // Prefer 3:4 portrait but cap at the available row height
  const cellH = Math.min(cellW * (4 / 3), maxCellH);
  const totalH = cellH * rows + GUTTER * (rows - 1);
  const gridY0 = GRID_TOP + (GRID_BOTTOM - GRID_TOP - totalH) / 2;

  pieces.forEach((p, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = PAD + c * (cellW + GUTTER);
    const y = gridY0 + r * (cellH + GUTTER);
    // Card surface
    ctx.fillStyle = '#fff';
    drawRoundedRect(ctx, x, y, cellW, cellH, 24);
    ctx.fill();
    const img = imgs[i];
    if (img) {
      ctx.save();
      drawRoundedRect(ctx, x, y, cellW, cellH, 24);
      ctx.clip();
      // Cover-fit
      const ar = img.width / img.height;
      const ca = cellW / cellH;
      let sw, sh, sx, sy;
      if (ar > ca) { sh = img.height; sw = sh * ca; sx = (img.width - sw) / 2; sy = 0; }
      else         { sw = img.width;  sh = sw / ca; sx = 0; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, cellW, cellH);
      ctx.restore();
    } else {
      // Image failed to load (CORS-blocked, dead URL, or no image set).
      // Render a typographic placeholder so the cell still credits the
      // piece instead of going blank.
      const cx = x + cellW / 2;
      const cy = y + cellH / 2;
      // Small geometric mark — a brass-stroked circle
      ctx.beginPath();
      ctx.arc(cx, cy - 36, 18, 0, Math.PI * 2);
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Brand line (small caps tracked)
      if (p.brand) {
        ctx.font = '500 18px Jost, sans-serif';
        ctx.fillStyle = MUTED;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.brand.toUpperCase().slice(0, 22), cx, cy + 6);
      }
      // Item name (serif italic — editorial caption style)
      if (p.name) {
        ctx.font = 'italic 500 22px "Playfair Display", Georgia, serif';
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Wrap to 2 lines if needed; truncate if longer
        const nameMaxWidth = cellW - 40;
        const words = p.name.split(/\s+/);
        let line1 = '', line2 = '';
        for (const w of words) {
          const test = line1 ? `${line1} ${w}` : w;
          if (ctx.measureText(test).width <= nameMaxWidth) line1 = test;
          else { line2 = words.slice(words.indexOf(w)).join(' '); break; }
        }
        if (line2) {
          // Truncate line2 if too long
          while (ctx.measureText(line2 + '…').width > nameMaxWidth && line2.length > 0) {
            line2 = line2.slice(0, -1);
          }
          if (line2.length < words.slice(line1.split(' ').length).join(' ').length) line2 = line2 + '…';
          ctx.fillText(line1, cx, cy + 36);
          ctx.fillText(line2, cx, cy + 64);
        } else {
          ctx.fillText(line1, cx, cy + 36);
        }
      }
      // Reset text alignment for downstream drawing
      ctx.textAlign = 'left';
    }
    // Hairline frame (unchanged)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, x, y, cellW, cellH, 24);
    ctx.stroke();
  });

  // === STYLIST'S NOTE ===
  // Reasoning rendered as italic pull-quote with brass-rule eyebrow.
  // Wraps to 3 lines max; truncates with ellipsis if longer.
  if (outfit?.reasoning && outfit.reasoning.trim()) {
    const noteY = H - 340;
    // brass-rule + "STYLIST'S NOTE" eyebrow
    ctx.fillStyle = BRASS;
    ctx.fillRect(PAD, noteY, 36, 2);
    ctx.font = '500 18px Jost, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.textBaseline = 'middle';
    ctx.fillText("STYLIST'S NOTE", PAD + 52, noteY + 1);

    // Italic body, multi-line, max 3 lines
    ctx.font = 'italic 500 28px "Playfair Display", Georgia, serif';
    ctx.fillStyle = INK;
    ctx.textBaseline = 'alphabetic';
    const noteText = `"${outfit.reasoning.trim()}"`;
    wrapCanvasText(ctx, noteText, PAD, noteY + 70, W - PAD * 2, 38, 3);
  }

  // === FOOTER ===
  const footerY = H - 160;
  ctx.fillStyle = BRASS;
  ctx.fillRect(PAD, footerY, 56, 3);
  ctx.font = '500 22px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${pieces.length} PIECE${pieces.length === 1 ? '' : 'S'}`, PAD + 76, footerY + 2);
  ctx.font = '500 44px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('myatelier.style', PAD, footerY + 78);

  // Blob (PNG, ~95% quality)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not generate the image. Try again.');
  return blob;
}

// Compose the wardrobe "Style DNA" card — colour wheel + dominant pull-quote
// + palette legend — into a 1080×1920 share PNG. Mirrors the outfit export's
// chrome (PAGE bg, brass rule, Playfair title, myatelier.style footer) so the
// two share artifacts read as one family. The colour-wheel geometry is the
// Canvas port of FinanceView's <ColourWheel> donut.
export async function composeStyleDNAExportImage(items, measurements = {}) {
  const owned = (items || []).filter((i) => i.status === 'owned');
  const colorCounts = {};
  for (const it of owned) {
    for (const c of (itemColors(it) || [])) {
      const k = (c || '').trim();
      if (k) colorCounts[k] = (colorCounts[k] || 0) + 1;
    }
  }
  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  if (sorted.length === 0) throw new Error('Add a few pieces with colours to generate your Style DNA.');
  const taggedCount = owned.filter((i) => (itemColors(i) || []).length > 0).length;

  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* non-blocking */ }
  }

  const W = 1080, H = 1920, PAD = 88;
  const BRASS = '#C9A66B', PAGE = '#F7F5F2', INK = '#1c1917', MUTED = '#78716c';
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = PAGE;
  ctx.fillRect(0, 0, W, H);

  // === HEADER ===
  ctx.fillStyle = BRASS;
  ctx.fillRect(PAD, 150, 56, 3);
  ctx.font = '500 22px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textBaseline = 'middle';
  ctx.fillText('YOUR STYLE DNA · ATELIER', PAD + 76, 152);
  ctx.font = '500 76px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Your Style DNA', PAD, 256);

  // === COLOUR WHEEL (donut) ===
  // Start at 12 o'clock (-90°) and walk clockwise so the dominant colour leads.
  const cx = W / 2, cy = 760, rOuter = 348, rInner = 224;
  const gapDeg = sorted.length > 1 ? Math.min(3, 360 / (sorted.length * 6)) : 0;
  const usableDeg = Math.max(0, 360 - gapDeg * sorted.length);
  let cursor = -90;
  for (const [name, count] of sorted) {
    const pct = total > 0 ? count / total : 0;
    const arcDeg = usableDeg * pct;
    const a1 = (cursor * Math.PI) / 180;
    const a2 = ((cursor + arcDeg) * Math.PI) / 180;
    cursor += arcDeg + gapDeg;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, a1, a2, false);
    ctx.arc(cx, cy, rInner, a2, a1, true);
    ctx.closePath();
    ctx.fillStyle = solidSwatch(name);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PAGE;
    ctx.stroke();
  }
  // Centre well + dominant pull-quote
  ctx.beginPath();
  ctx.arc(cx, cy, rInner - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#F7F5F2';
  ctx.fill();
  const dominant = sorted[0];
  const domPct = total > 0 ? (dominant[1] / total) * 100 : 0;
  ctx.textAlign = 'center';
  ctx.font = '500 22px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textBaseline = 'middle';
  ctx.fillText('DOMINANT', cx, cy - 72);
  ctx.font = 'italic 500 72px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  ctx.fillText(dominant[0], cx, cy);
  ctx.font = '500 26px "Playfair Display", Georgia, serif';
  ctx.fillStyle = MUTED;
  ctx.fillText(`${domPct.toFixed(0)}% of palette`, cx, cy + 54);
  ctx.fillStyle = BRASS;
  ctx.fillRect(cx - 24, cy + 84, 48, 2);
  ctx.font = '500 20px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.fillText(`${taggedCount} OF ${owned.length} PIECES TAGGED`, cx, cy + 110);
  ctx.textAlign = 'left';

  // === PALETTE LEGEND (top 6 families) ===
  const legendTop = 1206;
  const rowH = 84;
  ctx.fillStyle = BRASS;
  ctx.fillRect(PAD, legendTop - 42, 36, 2);
  ctx.font = '500 18px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textBaseline = 'middle';
  ctx.fillText(`PALETTE · ${sorted.length} ${sorted.length === 1 ? 'FAMILY' : 'FAMILIES'}`, PAD + 52, legendTop - 41);
  sorted.slice(0, 6).forEach(([name, count], i) => {
    const y = legendTop + i * rowH;
    const pct = total > 0 ? (count / total) * 100 : 0;
    // swatch dot
    ctx.beginPath();
    ctx.arc(PAD + 16, y + 16, 16, 0, Math.PI * 2);
    ctx.fillStyle = solidSwatch(name);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.stroke();
    // name (serif)
    ctx.font = '500 30px "Playfair Display", Georgia, serif';
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.fillText(name, PAD + 52, y + 16);
    // count · pct (right-aligned)
    ctx.textAlign = 'right';
    ctx.font = '500 24px Jost, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText(`${count} · ${pct.toFixed(0)}%`, W - PAD, y + 16);
    ctx.textAlign = 'left';
    // hairline bar
    const barY = y + 40, barW = W - PAD * 2;
    ctx.fillStyle = '#ece9e4';
    drawRoundedRect(ctx, PAD, barY, barW, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = solidSwatch(name);
    drawRoundedRect(ctx, PAD, barY, Math.max(6, barW * (pct / 100)), 5, 2.5);
    ctx.fill();
  });

  // === FOOTER ===
  const footerY = H - 150;
  ctx.fillStyle = BRASS;
  ctx.fillRect(PAD, footerY, 56, 3);
  ctx.font = '500 22px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${owned.length} PIECES · ${sorted.length} COLOUR ${sorted.length === 1 ? 'FAMILY' : 'FAMILIES'}`, PAD + 76, footerY + 2);
  ctx.font = '500 44px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('myatelier.style', PAD, footerY + 78);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not generate the image. Try again.');
  return blob;
}

// Private text-wrap helper used by the manifesto composer.
// Draws `text` word-by-word at (x, y), wrapping at maxW, advancing y by
// lineHeight each time. Returns the new y after the last drawn line.
function wrapText(ctx, text, x, y, maxW, lineHeight) {
  const words = text.split(/\s+/);
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

// Private rounded-rect path helper (fills/strokes after caller sets style).
// Named `roundRect` (not `drawRoundedRect`) to avoid a name collision with the
// exported `drawRoundedRect` used elsewhere in this file.
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Render the Style Manifesto as a shareable 1080x1920 PNG (Instagram Story).
export async function composeManifestoExportImage(manifesto, measurements = {}) {
  const text = (manifesto || measurements?.styleManifesto || '').trim();
  if (!text) throw new Error('Generate your Style Manifesto first.');

  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* non-blocking */ }
  }

  const W = 1080, H = 1920, PAD = 96;
  const BRASS = '#C9A66B', PAGE = '#F7F5F2', INK = '#1c1917', MUTED = '#78716c';
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BRASS;
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillText('A PRIVATE BRIEF, BY THE CONCIERGE', PAD, PAD + 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = "italic 64px 'Playfair Display', Georgia, serif";
  ctx.fillText('Style Manifesto', PAD, PAD + 130);

  const panelX = PAD, panelY = PAD + 190, panelW = W - PAD * 2, panelH = H - panelY - PAD - 70;
  roundRect(ctx, panelX, panelY, panelW, panelH, 36);
  ctx.fillStyle = PAGE;
  ctx.fill();

  ctx.fillStyle = '#3f3a36';
  ctx.font = "italic 38px 'Playfair Display', Georgia, serif";
  const lineHeight = 60;
  const innerX = panelX + 56;
  let y = panelY + 90;
  const maxTextW = panelW - 112;
  for (const paragraph of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    y = wrapText(ctx, paragraph, innerX, y, maxTextW, lineHeight);
    y += lineHeight * 0.6;
  }

  ctx.fillStyle = MUTED;
  ctx.font = "italic 32px 'Playfair Display', Georgia, serif";
  ctx.textAlign = 'right';
  ctx.fillText('— Your Concierge', panelX + panelW - 56, panelY + panelH - 50);
  ctx.textAlign = 'left';

  ctx.fillStyle = BRASS;
  ctx.font = '600 30px Inter, system-ui, sans-serif';
  ctx.fillText('myatelier.style', PAD, H - PAD + 20);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not generate the image. Try again.');
  return blob;
}

// Share an image File via the Web Share API when supported, otherwise
// fall back to a download. Returns 'shared' | 'downloaded' | 'cancelled'.
export async function shareOrDownloadImage(blob, filename, shareText = {}) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  // Some browsers (Safari iOS, Chrome Android) support files in share.
  // navigator.canShare() can throw on null — guard it.
  let canShareFiles = false;
  try { canShareFiles = !!navigator.canShare?.({ files: [file] }); } catch { /* */ }
  if (canShareFiles && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: shareText.title || 'A look from Atelier',
        text: shareText.text || '',
      });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Otherwise fall through to download
    }
  }
  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

// Apply a subtle "auto-enhance" pass via CSS filters on canvas — slight contrast
// + saturation boost + tiny sharpen via brightness curve. Mimics what a phone
// photo would look like after a one-tap "auto" enhance in Photos.
export function autoEnhanceCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Soft contrast + saturation lift (subtle: ~6%)
  const contrast = 1.08;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast curve to each channel
    data[i]     = Math.max(0, Math.min(255, data[i]     * contrast + intercept));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * contrast + intercept));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * contrast + intercept));
    // Saturation boost: nudge each channel away from the luminance
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const sat = 1.1;
    data[i]     = Math.max(0, Math.min(255, lum + (data[i]     - lum) * sat));
    data[i + 1] = Math.max(0, Math.min(255, lum + (data[i + 1] - lum) * sat));
    data[i + 2] = Math.max(0, Math.min(255, lum + (data[i + 2] - lum) * sat));
  }
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
}

// Background removal via @imgly/background-removal. Lazy-imported (the model
// weights are ~5MB) so it only loads when the user has opted in AND added an
// image. Wrapped in try/catch with a hard fallback to the original data URL —
// the previous integration broke rendering, so failures must be silent.
export async function removeImageBackground(dataUrl) {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await (await fetch(dataUrl)).blob();
    const outBlob = await removeBackground(blob);

    // The raw output is a PNG with alpha — often ~3-5x the size of the source
    // JPEG. We composite onto a clean off-white background and re-encode as
    // JPEG so the saved image stays under Firestore's 1MiB doc budget. The
    // cream surface blends with the app's wardrobe cards (also cream) so the
    // visual difference vs. true transparency is invisible in context.
    const cutoutImg = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = (e) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = e.target.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(outBlob);
    });
    const maxW = 900;
    const scale = Math.min(1, maxW / cutoutImg.naturalWidth);
    const w = Math.round(cutoutImg.naturalWidth * scale);
    const h = Math.round(cutoutImg.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; // clean lookbook-flatlay background
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(cutoutImg, 0, 0, w, h);
    // Adaptive JPEG quality — keep under ~180KB to leave room in the doc.
    let q = 0.86;
    let cutoutUrl = c.toDataURL('image/jpeg', q);
    while (cutoutUrl.length > 220_000 && q > 0.45) {
      q -= 0.1;
      cutoutUrl = c.toDataURL('image/jpeg', q);
    }
    return { url: cutoutUrl, ok: true };
  } catch (e) {
    console.warn('[wardrobe] background removal failed, keeping original:', e?.message);
    return { url: dataUrl, ok: false, error: e?.message || 'unknown error' };
  }
}

// Adaptive image compression: tries decreasing quality until size budget is hit.
// Multi-photo items must fit under Firestore's ~1 MiB doc limit, so per-image
// budget is tight. Falls back through several quality levels before giving up.
// Optionally applies a subtle auto-enhance pass before compression.
export async function compressImageToDataUrl(file, { maxWidth = 800, maxBytes = 150_000, enhance = true } = {}) {
  const img = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = e.target.result; };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const canvas = document.createElement('canvas');
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (enhance) {
    try { autoEnhanceCanvas(canvas); } catch (e) { /* fall through to plain compression */ }
  }
  for (const quality of [0.75, 0.65, 0.55, 0.45, 0.35]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= maxBytes) return dataUrl;
  }
  throw new Error('Image is very complex — try a simpler shot or fewer photos.');
}

// Rehost a third-party image URL to an inline data URL, so:
// - Canvas exports work (the original CDN may block CORS)
// - The image survives if the brand removes the product page
// - All wardrobe images live in our data, not someone else's
//
// Delegates to imageUrlToCompressedDataUrl which uses the same fetchViaProxy
// chain as the normal import path (weserv + allorigins fallback). Returns the
// data URL on success, or null on failure (caller keeps the external URL as
// graceful degradation).
export async function rehostExternalImage(externalUrl) {
  if (!externalUrl) return null;
  if (externalUrl.startsWith('data:')) return externalUrl; // already inline
  try {
    const dataUrl = await imageUrlToCompressedDataUrl(externalUrl);
    return dataUrl; // null if proxy failed — caller handles gracefully
  } catch (err) {
    console.warn('[rehost] failed for', externalUrl, '—', err?.message);
    return null;
  }
}

// Detect if a string is just a URL (possibly with tracking parameters).
// Returns null if not a plain URL; { hostname, url } if it is. Used to
// render inspiration captions / notes that ARE URLs as a clean "Source ·
// hostname" link rather than a raw 200-character tracking URL.
export function parseSourceUrl(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (/\s/.test(trimmed)) return null; // contains spaces — it's prose, not a URL
  try {
    const u = new URL(trimmed);
    return { hostname: u.hostname.replace(/^www\./, ''), url: trimmed };
  } catch {
    return null;
  }
}

// Public CORS proxies — tried in order until one works.
// Some block in mobile/PWA contexts; the fallback chain keeps the feature alive.

// Resize an image File to a small JPEG data URL we can safely embed in a
// Firestore document (Spark plan has no Storage; the 1 MiB per-doc limit
// is the constraint). 800px max + quality 0.75 gives ~50–150 KB per image.
export function resizeImageToDataUrl(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Firestore doc size cap is 1,048,487 bytes; base64 inflates by ~33%.
        // Reject anything over 900 KB so we never hit that wall.
        if (dataUrl.length > 900_000) {
          reject(new Error('Image is too large after compression. Try a simpler photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
