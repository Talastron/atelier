import { describe, it, expect } from 'vitest';
import { groupDigestCards, DIGEST_THEMES } from './digest.js';

const card = (kind) => ({ kind });
const labels = (groups) => groups.map((g) => g.label);
const kinds = (groups) => groups.map((g) => g.cards.map((c) => c.kind));

describe('groupDigestCards', () => {
  it('returns [] when there are no cards', () => {
    expect(groupDigestCards([])).toEqual([]);
    expect(groupDigestCards(undefined)).toEqual([]);
  });

  // The reported bug: an overdue lent piece rendered BELOW three care nudges
  // because cards were concatenated in source order. Its theme must rank first
  // however late the card arrives.
  it('ranks On loan first even when the overdue card comes last', () => {
    const groups = groupDigestCards([card('care'), card('care'), card('care'), card('overdue')]);
    expect(labels(groups)).toEqual(['On loan', 'Care']);
  });

  it('ranks every theme by urgency regardless of input order', () => {
    const groups = groupDigestCards([
      card('inspo-unanalysed'), card('price-drop'), card('stale-fav'), card('care'), card('overdue'),
    ]);
    expect(labels(groups)).toEqual(['On loan', 'Care', 'Wardrobe', 'Wishlist', 'Inspiration']);
  });

  it('omits themes with no cards', () => {
    const groups = groupDigestCards([card('price-drop')]);
    expect(labels(groups)).toEqual(['Wishlist']);
  });

  it('groups multiple cards of the same kind together', () => {
    const groups = groupDigestCards([card('care'), card('price-drop'), card('care')]);
    expect(labels(groups)).toEqual(['Care', 'Wishlist']);
    expect(kinds(groups)).toEqual([['care', 'care'], ['price-drop']]);
  });

  it('preserves input order within a theme', () => {
    const a = { kind: 'care', id: 'a' };
    const b = { kind: 'care', id: 'b' };
    expect(groupDigestCards([a, b])[0].cards.map((c) => c.id)).toEqual(['a', 'b']);
  });

  // An unknown kind must never crash Today.
  it('drops cards whose kind matches no theme', () => {
    const groups = groupDigestCards([card('care'), card('not-a-real-kind'), null]);
    expect(labels(groups)).toEqual(['Care']);
    expect(kinds(groups)).toEqual([['care']]);
  });

  it('every kind in DIGEST_THEMES is reachable and unique', () => {
    const all = DIGEST_THEMES.flatMap((t) => t.kinds);
    expect(new Set(all).size).toBe(all.length);
    for (const kind of all) {
      expect(groupDigestCards([card(kind)])).toHaveLength(1);
    }
  });
});
