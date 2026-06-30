// Pure helpers for the Style Manifesto. No Firebase/React imports — unit-tested.

// Split the stored manifesto prose into its three fixed paragraphs.
// The generator promises exactly 3 (aesthetic / colour-texture / tension).
// Returns null if the text can't be split into at least 3, so callers can
// fall back to rendering the raw string.
export function splitManifestoParagraphs(manifesto) {
  if (!manifesto || typeof manifesto !== 'string') return null;
  const parts = manifesto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const [signature, colour, ...rest] = parts;
  return { signature, colour, aspiration: rest.join('\n\n') };
}
