// The Today "Needs attention" card reports on several unrelated concerns. It
// used to concatenate them into one flat list in source order, so a lent piece
// three days overdue rendered BELOW three "8 wears since care" nudges — the
// most urgent thing pushed down by the least urgent.
//
// Themes give the card the structure it lacked, and the RANK is what fixes the
// bug: a theme's position is fixed by its urgency, so an urgent card can never
// be buried by arriving late. Pure — no React, no Firebase — so the ordering is
// unit-testable, unlike anything left inside the component.
export const DIGEST_THEMES = [
  { id: 'loan',        label: 'On loan',     kinds: ['overdue'] },
  { id: 'care',        label: 'Care',        kinds: ['care'] },
  { id: 'wardrobe',    label: 'Wardrobe',    kinds: ['stale-fav'] },
  { id: 'wishlist',    label: 'Wishlist',    kinds: ['price-drop'] },
  { id: 'inspiration', label: 'Inspiration', kinds: ['inspo-unanalysed'] },
];

// Groups a flat card list into ranked, non-empty themes:
//   [{ id, label, cards }]
// Input order is preserved WITHIN a theme (the caller's per-kind caps and
// severity order already decide that). Cards matching no theme are dropped
// rather than thrown on, so an unknown or future kind can never crash Today.
export function groupDigestCards(cards) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  return DIGEST_THEMES
    .map(({ id, label, kinds }) => ({
      id,
      label,
      cards: list.filter((c) => kinds.includes(c.kind)),
    }))
    .filter((group) => group.cards.length > 0);
}
