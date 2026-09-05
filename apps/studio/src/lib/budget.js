/**
 * What this person typically spends, and what counts as a lot, derived from
 * the prices already on their owned items.
 *
 * Median and p90 rather than mean and max, because a wardrobe mixes a £3,500
 * watch with £49 dresses: a mean reports a typical spend nobody recognises,
 * and a max reports a ceiling that describes a single purchase.
 *
 * Returns null below MIN_PRICED_ITEMS — an inference from four prices is a
 * guess wearing a number's clothes, and it is better to say nothing.
 */
export const MIN_PRICED_ITEMS = 8;

export function inferBudget(items) {
  const prices = (Array.isArray(items) ? items : [])
    .filter((i) => i && i.status === 'owned' && !i.deletedAt)
    .map((i) => Number(i.price))
    .filter((p) => Number.isFinite(p) && p > 0)   // a missing price is not £0
    .sort((a, b) => a - b);
  if (prices.length < MIN_PRICED_ITEMS) return null;
  const at = (q) => prices[Math.min(prices.length - 1, Math.floor(q * prices.length))];
  return { typical: at(0.5), high: at(0.9), sampleSize: prices.length };
}
