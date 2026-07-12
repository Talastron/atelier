// Standalone Node test (no framework installed) for the clothing-base backstop.
// Run: node scripts/test-outfit-base.mjs
//
// Guards the root-cause fix for the "Daily Brief shows only accessories" bug:
// the model sometimes names a garment in its prose but omits its id from
// itemIds, leaving a look of pure accessories. ensureClothingBase must always
// recover or inject a real clothing base before the look reaches the user.

import { hasClothingBase, ensureClothingBase } from '../src/lib/outfit.js';

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

// A deliberately accessory-heavy wardrobe (mirrors the reported failure mode).
const wardrobe = [
  { id: 'd1', name: 'Morgan Cotton Cheesecloth Belted Shirt Dress', category: 'Dresses', favorite: true, seasons: ['Summer'] },
  { id: 't1', name: 'Ivory Silk Camisole', category: 'Tops', seasons: ['Summer'] },
  { id: 'b1', name: 'Tailored Linen Trouser', category: 'Bottoms', seasons: ['Summer'] },
  { id: 's1', name: 'Lope Gold Metallic Flat Sandal', category: 'Shoes' },
  { id: 'bag1', name: 'Soho Camera Bag Tan Raffia', category: 'Bags' },
  { id: 'g1', name: 'Solitaire Diamond Mini Chain', category: 'Jewellery', favorite: true },
  { id: 'g2', name: 'Keshi Pearl Pendant', category: 'Jewellery' },
  { id: 'g3', name: 'Mini Nugget Pearl Beaded Necklace', category: 'Jewellery' },
  { id: 'g4', name: 'Baroque Pearl Friendship Bracelet', category: 'Jewellery' },
  { id: 'a1', name: 'Rectangle Sunglasses CH5504', category: 'Accessories' },
];

const accessoriesOnly = ['s1', 'bag1', 'g1', 'g2', 'g3', 'g4', 'a1'];

console.log('hasClothingBase');
ok('false for accessories-only', hasClothingBase(accessoriesOnly, wardrobe) === false);
ok('true when a dress is present', hasClothingBase(['d1', 's1'], wardrobe) === true);
ok('true for top + bottom', hasClothingBase(['t1', 'b1', 's1'], wardrobe) === true);
ok('false for a top alone (no bottom)', hasClothingBase(['t1', 's1'], wardrobe) === false);

console.log('ensureClothingBase — recover from prose');
{
  // The model named the dress in prose but left it out of itemIds.
  const reasoning = 'The Morgan Cotton Cheesecloth Belted Shirt Dress anchors this coastal look, warmed by gold.';
  const r = ensureClothingBase({ itemIds: accessoriesOnly, reasoning }, wardrobe, { weather: { temp: 34 }, season: 'Summer' });
  ok('recovers the prose-named dress', r.itemIds.includes('d1'));
  ok('result now has a clothing base', hasClothingBase(r.itemIds, wardrobe) === true);
  ok('flagged as recovered (not injected)', r.recovered === true && r.injected === false);
  ok('keeps the original accessories', accessoriesOnly.every((id) => r.itemIds.includes(id)));
}

console.log('ensureClothingBase — deterministic injection (no prose match)');
{
  const reasoning = 'Layered gold jewellery and raffia texture for a summery finish.';
  const r = ensureClothingBase({ itemIds: accessoriesOnly, reasoning }, wardrobe, { weather: { temp: 34 }, season: 'Summer' });
  ok('injects a clothing base', hasClothingBase(r.itemIds, wardrobe) === true);
  ok('flagged as injected', r.injected === true);
  ok('prefers the dress when warm', r.itemIds.includes('d1'));
}

console.log('ensureClothingBase — top+bottom when no dress available');
{
  const noDress = wardrobe.filter((i) => i.category !== 'Dresses');
  const reasoning = 'Gold and pearls for a relaxed day.';
  const r = ensureClothingBase({ itemIds: accessoriesOnly, reasoning }, noDress, { weather: { temp: 18 }, season: 'Summer' });
  ok('injects BOTH a top and a bottom', r.itemIds.includes('t1') && r.itemIds.includes('b1'));
  ok('result has a clothing base', hasClothingBase(r.itemIds, noDress) === true);
}

console.log('ensureClothingBase — leaves valid looks untouched');
{
  const valid = ['d1', 's1', 'g1'];
  const r = ensureClothingBase({ itemIds: valid, reasoning: 'The dress, gold sandal and chain.' }, wardrobe, { weather: { temp: 24 }, season: 'Summer' });
  ok('does not mutate a look that already has a base', r.itemIds.length === valid.length && valid.every((id) => r.itemIds.includes(id)));
  ok('not flagged recovered or injected', r.recovered === false && r.injected === false);
}

console.log('ensureClothingBase — honest failure when wardrobe has no clothing');
{
  const noClothes = wardrobe.filter((i) => !['Dresses', 'Tops', 'Bottoms'].includes(i.category));
  const r = ensureClothingBase({ itemIds: accessoriesOnly, reasoning: 'Just accessories.' }, noClothes, { weather: { temp: 20 }, season: 'Summer' });
  ok('reports ok=false (cannot complete the look)', r.ok === false);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
