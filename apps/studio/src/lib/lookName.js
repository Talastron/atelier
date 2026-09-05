// A name for a look, derived from the look itself.
//
// The Daily Brief used to save as `Daily Brief · Thu, 4 Sep`, which records
// when you pressed the button and nothing about what you saved. A Lookbook of
// those is a list of dates. The Concierge already has an editorial namer
// (generateOutfitNameWithGemini, used by the Styling Studio), so the Brief now
// asks for one of those — and this is what it falls back to when the Concierge
// is unavailable or the call fails.
//
// The rule is simply what a person would say: a dress is the whole look, so it
// stands alone or with the coat over it; otherwise a look is its top and its
// bottom. Accessories name nothing on their own unless there is nothing else.
const named = (p) => (p && typeof p.name === 'string' && p.name.trim()) ? p.name.trim() : null;
const firstIn = (pieces, category) => pieces.find((p) => p.category === category && named(p)) || null;

export function deriveLookName(pieces) {
  const list = (Array.isArray(pieces) ? pieces : []).filter(named);

  const dress = firstIn(list, 'Dresses');
  const outerwear = firstIn(list, 'Outerwear');
  const top = firstIn(list, 'Tops');
  const bottom = firstIn(list, 'Bottoms');

  let chosen = dress
    ? [dress, outerwear]
    : [top || outerwear, bottom];

  chosen = chosen.filter(Boolean);
  // Nothing structural in the look — a bag and a necklace still deserve a
  // better name than a timestamp.
  if (chosen.length === 0) chosen = list.slice(0, 2);

  const parts = chosen.map(named).filter(Boolean);
  if (parts.length === 0) return 'A saved look';
  return parts.join(' & ');
}
