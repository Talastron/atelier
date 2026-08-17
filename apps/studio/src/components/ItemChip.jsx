import React from 'react';

// Parse <<item:id|name>> markers in text and render each as an ItemChip,
// preserving the surrounding prose as plain text. Returns an array of
// React children safe to drop into a <p>.
//
// Streaming-safe: a partial marker like "<<item:i_abc|ivory" still in
// flight will not match the regex (no closing >>), so it stays as raw
// text until the next chunk completes the marker.
//
// Shared by ConciergeMessage, the Daily Brief card and the calendar day
// reasoning. Pass items + onOpenItem explicitly (no closure capture).
// Plain-text counterpart to renderTextWithChips: replaces each
// <<item:id|name>> marker with just its display name. Use on non-React
// surfaces that cannot render chip components — e.g. the canvas share-image
// export or any string headed for a plain text/alt attribute. Keeps the
// marker regex defined in this one file so it cannot drift out of sync.
export function stripItemChips(raw) {
  if (!raw) return '';
  return raw.replace(/<<item:[^|>]+\|([^>]+)>>/g, '$1');
}

// Longest a piece may be named inside running prose.
const INLINE_LABEL_MAX = 34;

/**
 * Reduce a wardrobe item's name to something a stylist would actually say.
 *
 * Item names arrive as retailer listings — "Molten Snow Triple Small Hoop
 * Earrings | 18ct Gold Plated/Cubic Zirconia" — which is fine on a product
 * tile and unreadable mid-sentence. The chip variant hid this behind a
 * max-width and `truncate`; prose has nowhere to hide it, so it has to be
 * shortened rather than clipped.
 *
 * Everything after a pipe is retailer metadata (brand, material, finish) and
 * goes first. What remains is cut at a word boundary, never mid-word, and
 * without an ellipsis — a trailing "…" inside a sentence reads as damage.
 *
 * @param {string} name  The item's stored name.
 * @returns {string}     A label safe to set in running text.
 */
export function shortItemLabel(name) {
  const full = String(name ?? '').trim();
  if (!full) return '';

  const beforePipe = full.split('|')[0].trim();
  const base = beforePipe || full;
  if (base.length <= INLINE_LABEL_MAX) return base;

  const cutAt = base.lastIndexOf(' ', INLINE_LABEL_MAX);
  // A single word longer than the limit has no boundary to cut on; leave it
  // whole rather than mangling it.
  if (cutAt <= 0) return base;
  return base.slice(0, cutAt).replace(/[\s,;:.\-–—]+$/, '');
}

// `variant` controls how a referenced piece interrupts the prose around it.
//
//   'chip'   — pill with a thumbnail. Right where the text is a list of
//              pieces and the images are the point.
//   'inline' — the name set as running text with a fine brass underline.
//              Right where the text is *prose*: a pill carrying a 20px
//              round image and a truncated name mid-sentence breaks the
//              baseline, boxes a fragment of the line, and reads as a
//              mail-merge rather than a stylist's note. The name stays
//              tappable; it simply stops shouting.
export function renderTextWithChips(raw, { items = [], onOpenItem = null, variant = 'chip' } = {}) {
  if (!raw) return null;
  const re = /<<item:([^|>]+)\|([^>]+)>>/g;
  const out = [];
  let lastIdx = 0;
  let match;
  let key = 0;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIdx) {
      out.push(raw.slice(lastIdx, match.index));
    }
    out.push(
      <ItemChip
        key={`chip-${key++}-${match[1]}`}
        itemId={match[1]}
        fallbackName={match[2]}
        items={items}
        onOpenItem={onOpenItem}
        variant={variant}
      />
    );
    lastIdx = re.lastIndex;
  }
  if (lastIdx < raw.length) {
    out.push(raw.slice(lastIdx));
  }
  return out;
}

export function ItemChip({ itemId, fallbackName, items, onOpenItem, variant = 'chip' }) {
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return <span>{fallbackName}</span>;
  }
  const thumb = item.images?.[0] || item.imageUrl || '';

  if (variant === 'inline') {
    const full = item.name || fallbackName;
    // A <span>, deliberately, not a <button>. A button is inline-block with a
    // UA default of text-align:center, so a name long enough to wrap forms its
    // own box and centres its lines mid-paragraph instead of flowing with the
    // prose. A span is genuinely inline: it breaks across lines like the words
    // either side of it and inherits the paragraph's alignment and italics.
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => onOpenItem?.(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenItem?.(item.id);
          }
        }}
        className="cursor-pointer underline decoration-brass-400/70 decoration-1 underline-offset-[3px] hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400 transition-colors"
        title={full}
      >
        {shortItemLabel(full)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenItem?.(item.id)}
      className="inline-flex items-center gap-1.5 mx-0.5 align-middle px-1.5 py-0.5 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-900 transition-colors max-w-[14rem]"
      title={item.name || fallbackName}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          aria-hidden="true"
          className="w-5 h-5 rounded-full object-cover border border-stone-300 shrink-0"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-stone-300 shrink-0" aria-hidden="true" />
      )}
      <span className="text-[13px] truncate">{item.name || fallbackName}</span>
    </button>
  );
}
