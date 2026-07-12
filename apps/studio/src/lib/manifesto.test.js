import { describe, it, expect } from 'vitest';
import { splitManifestoParagraphs } from './manifesto.js';

describe('splitManifestoParagraphs', () => {
  it('splits three blank-line-separated paragraphs into labelled parts', () => {
    const text = 'Para one about aesthetic.\n\nPara two about colour.\n\nPara three about tension.';
    expect(splitManifestoParagraphs(text)).toEqual({
      signature: 'Para one about aesthetic.',
      colour: 'Para two about colour.',
      aspiration: 'Para three about tension.',
    });
  });

  it('tolerates multiple blank lines and trims whitespace', () => {
    const text = '  A. \n\n\n B. \n\n C. ';
    expect(splitManifestoParagraphs(text)).toEqual({ signature: 'A.', colour: 'B.', aspiration: 'C.' });
  });

  it('returns null when the text does not split into 3 paragraphs', () => {
    expect(splitManifestoParagraphs('Only one paragraph.')).toBeNull();
    expect(splitManifestoParagraphs('')).toBeNull();
    expect(splitManifestoParagraphs(null)).toBeNull();
  });

  it('merges extra paragraphs into the third part so nothing is lost', () => {
    const text = 'A.\n\nB.\n\nC.\n\nD.';
    expect(splitManifestoParagraphs(text)).toEqual({ signature: 'A.', colour: 'B.', aspiration: 'C.\n\nD.' });
  });
});
