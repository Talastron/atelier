import { describe, it, expect } from 'vitest';
import { deriveLookName } from './lookName.js';

const piece = (name, category, subCategory) => ({ id: name, name, category, subCategory });

describe('deriveLookName', () => {
  it('names a look by its top and its bottom', () => {
    const name = deriveLookName([
      piece('Chelsea Saddle Bag', 'Bags'),
      piece('Slim Fit Chinos', 'Bottoms'),
      piece('Oxford Shirt', 'Tops'),
    ]);
    expect(name).toBe('Oxford Shirt & Slim Fit Chinos');
  });

  it('lets a dress stand for the whole look', () => {
    const name = deriveLookName([
      piece('Belt Shirt Dress', 'Dresses'),
      piece('The Driving Loafer', 'Shoes'),
    ]);
    expect(name).toBe('Belt Shirt Dress');
  });

  it('pairs a dress with its coat, not with its shoes', () => {
    const name = deriveLookName([
      piece('Belt Shirt Dress', 'Dresses'),
      piece('Hackness Jacket', 'Outerwear'),
      piece('The Driving Loafer', 'Shoes'),
    ]);
    expect(name).toBe('Belt Shirt Dress & Hackness Jacket');
  });

  it('falls back to outerwear when there is no top', () => {
    const name = deriveLookName([
      piece('Hackness Jacket', 'Outerwear'),
      piece('Slim Fit Chinos', 'Bottoms'),
    ]);
    expect(name).toBe('Hackness Jacket & Slim Fit Chinos');
  });

  it('uses whatever it has when nothing is a garment', () => {
    const name = deriveLookName([
      piece('Chelsea Saddle Bag', 'Bags'),
      piece('Alphabet S Charm', 'Jewellery'),
    ]);
    expect(name).toBe('Chelsea Saddle Bag & Alphabet S Charm');
  });

  it('never returns a date, and never returns nothing', () => {
    // The whole point: the old name was `Daily Brief · Thu, 4 Sep`, which
    // says when it was saved and not what it is.
    expect(deriveLookName([])).toBe('A saved look');
    expect(deriveLookName(null)).toBe('A saved look');
    expect(deriveLookName([{ id: 'x', category: 'Tops' }])).toBe('A saved look');
  });

  it('ignores pieces with blank names rather than joining empty strings', () => {
    const name = deriveLookName([
      piece('  ', 'Tops'),
      piece('Slim Fit Chinos', 'Bottoms'),
    ]);
    expect(name).toBe('Slim Fit Chinos');
  });
});
