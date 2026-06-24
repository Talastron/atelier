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
export function renderTextWithChips(raw, { items = [], onOpenItem = null } = {}) {
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
      />
    );
    lastIdx = re.lastIndex;
  }
  if (lastIdx < raw.length) {
    out.push(raw.slice(lastIdx));
  }
  return out;
}

export function ItemChip({ itemId, fallbackName, items, onOpenItem }) {
  const item = items.find((i) => i.id === itemId);
  if (!item) {
    return <span>{fallbackName}</span>;
  }
  const thumb = item.images?.[0] || item.imageUrl || '';
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
