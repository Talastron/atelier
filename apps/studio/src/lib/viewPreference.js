// How a look is shown, and where that choice is remembered.
//
// Two storage keys, deliberately not one. The Lookbook's key governs the
// COVERS on a grid of many looks; the single-look key governs how ONE look is
// read, on the look detail and the Daily Brief. They sound like the same
// question and are not: someone can reasonably want dense grid covers in the
// Lookbook and the full composition when they open a single look. Sharing a
// key would make choosing grid covers silently redraw the Daily Brief.
export const LOOK_VIEW_KEY = 'atelier-look-view';

// Unchanged on purpose — it is already sitting in users' browsers, and
// renaming it would silently reset everyone's Lookbook to the default.
export const LOOKBOOK_COVER_KEY = 'atelier-lookbook-cover';

// localStorage returns null when unset and can hold anything at all — junk
// from an older build, or a value written by another tab. Anything that is
// not one of the two real views means "the default", which is the
// composition: the arrangement the whole app is built around.
export function normaliseLookView(value) {
  return value === 'grid' ? 'grid' : 'flatlay';
}
