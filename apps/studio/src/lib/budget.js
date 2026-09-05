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

/**
 * The budget to actually use: what the wearer stored if they corrected it,
 * otherwise what their wardrobe implies.
 *
 * This exists because the first version only ever sent STORED figures to the
 * prompts, and almost nobody stores them — the UI shows the inference as a
 * placeholder, which looks set but is not. The result was an audit that said
 * "your typical spend is £143.51", a MEAN it computed for itself from the
 * total-spend figure in its own data, against a true median of £98. We built
 * the median precisely to avoid that number and then did not send it.
 *
 * Returns null when there is neither a stored pair nor enough priced items.
 */
export function resolveBudget(measurements, items) {
  const typical = Number(measurements?.budgetTypical);
  const high = Number(measurements?.budgetHigh);
  // Both or neither: one number cannot say "typical, and this is a lot".
  if (Number.isFinite(typical) && typical > 0 && Number.isFinite(high) && high > 0) {
    return { typical, high, source: 'stated' };
  }
  const inferred = inferBudget(items);
  return inferred ? { ...inferred, source: 'inferred' } : null;
}

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
