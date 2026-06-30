// Pure fit-score logic. NO Firebase/React imports — fully unit-tested.
// The Gemini-calling orchestration lives in ai.js (generateItemFitWithGemini).

export function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// Overall tier with a coherence floor: an item far outside the user's
// aesthetic can never score high just for being aspirational/different.
export function fitTier(coherence, aspiration) {
  const c = clamp01(coherence);
  const a = clamp01(aspiration);
  if (c < 0.4) return 'A departure';
  const overall = 0.55 * c + 0.45 * a;
  if (overall >= 0.78) return 'Unmistakably you';
  if (overall >= 0.58) return 'A strong fit';
  if (overall >= 0.42) return 'A considered reach';
  return 'A departure';
}

// Aspiration is measured against saved inspirations when any are analysed,
// otherwise against the declared style-profile quiz.
export function selectAspirationBasis(inspirations) {
  const analysed = (inspirations || []).filter((i) => i && i.analysis && i.analysis.summary);
  return analysed.length > 0 ? 'inspirations' : 'profile';
}

// A cached fit is stale if absent or computed against an older manifesto.
export function isFitStale(item, currentManifestoAt) {
  const fit = item && item.manifestoFit;
  if (!fit) return true;
  if (!currentManifestoAt) return false;
  return fit.manifestoAt !== currentManifestoAt;
}

// One-line item summary, mirroring the manifesto generator's format.
export function buildItemSummaryLine(item) {
  const i = item || {};
  const cat = i.subCategory ? `${i.category || '?'}/${i.subCategory}` : (i.category || '?');
  const colours = (i.colors || []).join(',') || '-';
  const styles = (i.styles || []).join(',') || '-';
  return `- ${i.name || 'Untitled'} (${i.brand || '?'}) · ${cat} · colours=${colours} · styles=${styles}`;
}

// Build the structured-JSON scoring prompt. Pure string assembly.
export function buildItemFitPrompt({ itemLine, manifesto, inspirationsSummary = '', styleProfile = '', basis = 'profile' }) {
  const aspirationSource = basis === 'inspirations'
    ? `What they SAVE as inspiration (their aspiration):\n${inspirationsSummary}`
    : `They have no saved inspirations yet, so judge aspiration against the style you’ve described below.`;
  const verdictGuidance = basis === 'inspirations'
    ? 'Tie the verdict to what you save — name the gap this piece closes.'
    : 'Tie the verdict to the style they’ve described.';
  return `You are a senior fashion editor judging, in private, how well ONE item fits a client.

The item under consideration:
${itemLine}

Their Style Manifesto:
${manifesto}

${styleProfile}

${aspirationSource}

Return ONLY JSON with this shape:
{
  "verdict": "one warm, specific sentence (max 30 words). ${verdictGuidance} No clichés, no the words 'stylish' or 'trendy'. UK English.",
  "coherence": 0.0-1.0,  // how well this sits within their EXISTING aesthetic universe
  "aspiration": 0.0-1.0,  // how much it moves them toward what they reach for
  "dimensions": [ {"label":"Palette","state":"Aligned|A reach|Off","level":0.0-1.0}, {"label":"Silhouette",...}, {"label":"Formality",...} ]
}`;
}

// Parse + normalise the model's JSON into the shape the UI consumes.
export function parseAndNormalizeFit(rawText, { basis = 'profile' } = {}) {
  let p;
  try { p = JSON.parse(rawText); } catch { throw new Error('The Concierge replied in an unexpected format.'); }
  const coherence = clamp01(p.coherence);
  const aspiration = clamp01(p.aspiration);
  const dimensions = Array.isArray(p.dimensions)
    ? p.dimensions.map((d) => ({ label: String(d?.label || ''), state: String(d?.state || ''), level: clamp01(d?.level) }))
    : [];
  return {
    verdict: String(p.verdict || '').trim(),
    coherence,
    aspiration,
    tier: fitTier(coherence, aspiration),
    dimensions,
    basis,
  };
}
