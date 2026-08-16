// src/buildInfo.js
//
// Which build am I running? Answered from inside the app rather than from
// DevTools.
//
// The three __BUILD_*__ identifiers are not variables — they are literals
// substituted at compile time by the `define` block in vite.config.js. That is
// deliberate: a value baked into the bundle necessarily describes *that*
// bundle, so it cannot drift from the code around it the way a hand-maintained
// version constant does.
//
// `typeof` guards each one because an undeclared identifier is safe to `typeof`
// but throws on direct reference. Under Vitest there is no `define` step, so
// the guards are what let this module be imported by tests at all.

/* global __BUILD_SHA__, __BUILD_DATE__, __BUILD_DIRTY__ */

export const BUILD_SHA = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : 'unknown';
export const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';
export const BUILD_DIRTY = typeof __BUILD_DIRTY__ === 'boolean' ? __BUILD_DIRTY__ : false;

/**
 * Render the build stamp as a line of prose: "16 August 2026 · a1b2c3d".
 *
 * Kept pure and separate from the constants above so it can be tested — the
 * compile-time literals themselves are awkward to assert on.
 *
 * @param {string} isoDate  ISO timestamp of the build, or '' if unknown.
 * @param {string} sha      Short commit SHA, or 'unknown'.
 * @param {boolean} dirty   Was the working tree dirty at build time?
 * @returns {string}        A human-readable one-line stamp.
 */
export function formatBuildLabel(isoDate, sha, dirty = false) {
  // The '+' is a quiet admission that this bundle contains work which exists
  // in no commit, so the SHA alone would not reproduce it.
  const commit = sha && sha !== 'unknown' ? `${sha}${dirty ? '+' : ''}` : 'unknown build';

  const parsed = isoDate ? new Date(isoDate) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return commit;

  const date = parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${date} · ${commit}`;
}

export const BUILD_LABEL = formatBuildLabel(BUILD_DATE, BUILD_SHA, BUILD_DIRTY);
