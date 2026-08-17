// Contract test for the chip parser against the PUBLIC-SHARE snapshot shape.
//
// PublicShareView renders stylist notes with renderTextWithChips using the
// share doc's own `pieces` array (id / name / images[0]) as the item source —
// not the full wardrobe. These tests pin that contract:
//   1. markers resolve to ItemChip elements carrying the piece (thumbnail case)
//   2. markers for ids missing from pieces degrade to the fallback name
//   3. no raw "<<item:" text ever survives parsing
// The page-level regression ("share page shows literal markers") is verified
// live — this file guards the resolution logic that fix relies on.
import { describe, it, expect } from 'vitest';
import { renderTextWithChips, stripItemChips, ItemChip } from './ItemChip.jsx';

// Shape produced by handleShareOutfit / handleShareLookbook in App.jsx.
const SNAPSHOT_PIECES = [
  { id: 'i_coat', name: 'Navy wool coat', brand: '', category: 'Outerwear', subCategory: 'Coat', images: ['data:image/jpeg;base64,xxx'], colors: [] },
  { id: 'i_vest', name: 'Champagne silk vest', brand: '', category: 'Tops', subCategory: 'Vest', images: [], colors: [] },
];

const NOTE = 'Start with the <<item:i_coat|Navy wool coat>> over the <<item:i_vest|Champagne silk vest>>, then gold.';

describe('renderTextWithChips against share-snapshot pieces', () => {
  it('resolves each marker to an ItemChip element bound to the snapshot piece', () => {
    const out = renderTextWithChips(NOTE, { items: SNAPSHOT_PIECES });
    const chips = out.filter((n) => n && n.type === ItemChip);
    expect(chips).toHaveLength(2);
    expect(chips[0].props.itemId).toBe('i_coat');
    expect(chips[0].props.items).toBe(SNAPSHOT_PIECES);
    expect(chips[1].props.itemId).toBe('i_vest');
  });

  it('preserves the surrounding prose as plain text', () => {
    const out = renderTextWithChips(NOTE, { items: SNAPSHOT_PIECES });
    const text = out.filter((n) => typeof n === 'string').join('');
    expect(text).toBe('Start with the  over the , then gold.');
  });

  it('never lets a raw marker survive into the output', () => {
    const out = renderTextWithChips(NOTE, { items: SNAPSHOT_PIECES });
    for (const n of out) {
      if (typeof n === 'string') expect(n).not.toContain('<<item:');
    }
  });

  it('marker for an id absent from pieces still parses (chip falls back to name)', () => {
    const out = renderTextWithChips('Try the <<item:i_gone|Old scarf>> tonight.', { items: SNAPSHOT_PIECES });
    const chips = out.filter((n) => n && n.type === ItemChip);
    expect(chips).toHaveLength(1);
    expect(chips[0].props.fallbackName).toBe('Old scarf');
  });

  it('stripItemChips (canvas path) reduces the same note to plain names', () => {
    expect(stripItemChips(NOTE)).toBe('Start with the Navy wool coat over the Champagne silk vest, then gold.');
  });
});

describe('variant', () => {
  it('defaults to the thumbnail chip, so existing surfaces are unchanged', () => {
    const out = renderTextWithChips(NOTE, { items: SNAPSHOT_PIECES });
    const chips = out.filter((n) => n && n.type === ItemChip);
    expect(chips[0].props.variant).toBe('chip');
  });

  // The Daily Brief's stylist note passes 'inline' so the prose keeps its
  // line rhythm; the pieces are already shown as tiles directly above it.
  it('passes the requested variant down to every chip', () => {
    const out = renderTextWithChips(NOTE, { items: SNAPSHOT_PIECES, variant: 'inline' });
    const chips = out.filter((n) => n && n.type === ItemChip);
    expect(chips).toHaveLength(2);
    for (const chip of chips) expect(chip.props.variant).toBe('inline');
  });

  it('parses identically whichever variant is asked for', () => {
    const asChips = renderTextWithChips(NOTE, { items: SNAPSHOT_PIECES });
    const asInline = renderTextWithChips(NOTE, { items: SNAPSHOT_PIECES, variant: 'inline' });
    const textOf = (out) => out.filter((n) => typeof n === 'string').join('');
    expect(textOf(asInline)).toBe(textOf(asChips));
  });
});
