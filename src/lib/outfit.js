// The outfit-slot model — shared domain knowledge between the Styling Studio
// (OutfitBuilder) and the item detail view. Pure: no React, no Firebase.
//
// Strict 1:1 — items can ONLY fill a slot matching their actual category +
// subcategory where relevant. Jewellery is split into three slots so an outfit
// can carry earrings + a necklace + a bracelet at the same time without one
// piece evicting another. Outerwear is its own slot (was previously mixed into
// Tops, which produced incoherent looks like "Sport jacket + Smart trousers").
export const OUTFIT_SLOTS = ['Tops', 'Dresses', 'Bottoms', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Belts', 'Earrings', 'Necklaces', 'Wrist'];
export const SLOT_FILTER = {
  Tops:        (i) => i.category === 'Tops',
  Dresses:     (i) => i.category === 'Dresses',
  Bottoms:     (i) => i.category === 'Bottoms',
  Outerwear:   (i) => i.category === 'Outerwear',
  Shoes:       (i) => i.category === 'Shoes',
  Bags:        (i) => i.category === 'Bags',
  Accessories: (i) => i.category === 'Accessories' && i.subCategory !== 'Belts' || (i.category === 'Jewellery' && i.subCategory === 'Brooches'),
  Belts:       (i) => i.category === 'Accessories' && i.subCategory === 'Belts',
  Earrings:    (i) => i.category === 'Jewellery' && i.subCategory === 'Earrings',
  Necklaces:   (i) => i.category === 'Jewellery' && (i.subCategory === 'Necklaces' || i.subCategory === 'Pendants'),
  Wrist:       (i) => i.category === 'Jewellery' && (i.subCategory === 'Bracelets' || i.subCategory === 'Watches' || i.subCategory === 'Rings'
                       || !i.subCategory || i.subCategory === 'Other'),
};
export const itemFitsSlot = (item, slot) => !!item && !!SLOT_FILTER[slot]?.(item);
export const slotForItem = (item) => OUTFIT_SLOTS.find((s) => itemFitsSlot(item, s)) || null;
// Slots that hold an array of items (layered looks) instead of a single piece.
// Earrings, necklaces, bracelets/watches/rings are stackable in real styling —
// "wear three pendants together", "stack a watch and two bracelets".
export const MULTI_SLOTS = new Set(['Earrings', 'Necklaces', 'Wrist']);
export const isMultiSlot = (slot) => MULTI_SLOTS.has(slot);
// Read all items from a slot value, regardless of single/array shape.
export const slotItems = (val) => Array.isArray(val) ? val : (val ? [val] : []);
// Backwards-compat shim for any old callers — returns the strict list of
// categories a slot can hold (jewellery slots all answer "Jewellery").
export const SLOT_CATEGORIES = {
  Tops: ['Tops'], Dresses: ['Dresses'], Bottoms: ['Bottoms'], Outerwear: ['Outerwear'],
  Shoes: ['Shoes'], Bags: ['Bags'], Accessories: ['Accessories'], Belts: ['Accessories'],
  Earrings: ['Jewellery'], Necklaces: ['Jewellery'], Wrist: ['Jewellery'],
};
export const emptyOutfit = () => Object.fromEntries(OUTFIT_SLOTS.map((s) => [s.toLowerCase(), null]));
