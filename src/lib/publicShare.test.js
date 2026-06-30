import { describe, it, expect } from 'vitest';
import { buildPinterestUrl } from './publicShare.js';

describe('buildPinterestUrl', () => {
  it('builds a create-pin URL with url, media and description, all encoded', () => {
    const out = buildPinterestUrl({
      url: 'https://edit.myatelier.style/?share=abc',
      media: 'https://storage.example.com/public-shares/abc.png',
      description: 'A look from Atelier & co',
    });
    expect(out).toContain('https://www.pinterest.com/pin/create/button/?');
    expect(out).toContain('url=https%3A%2F%2Fedit.myatelier.style%2F%3Fshare%3Dabc');
    expect(out).toContain('media=https%3A%2F%2Fstorage.example.com%2Fpublic-shares%2Fabc.png');
    expect(out).toContain('description=A%20look%20from%20Atelier%20%26%20co');
  });

  it('omits media when not provided', () => {
    const out = buildPinterestUrl({ url: 'https://x.test/', description: 'hi' });
    expect(out).not.toContain('media=');
    expect(out).toContain('url=https%3A%2F%2Fx.test%2F');
  });

  it('throws when url is missing', () => {
    expect(() => buildPinterestUrl({ description: 'no url' })).toThrow(/url is required/i);
  });
});
