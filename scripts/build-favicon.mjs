// Generate public/favicon.ico (multi-resolution PNG-in-ICO) from public/icon.svg.
// Why: Firebase Hosting's SPA catch-all rewrite ("**" → "/index.html") intercepts
// the browser's implicit /favicon.ico request and serves the HTML page back, which
// browsers silently reject and fall back to a cached or default icon. Shipping a
// real /favicon.ico means the request hits a real file before the rewrite runs.

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const SIZES = [16, 32, 48];
const svg = readFileSync('public/icon.svg');

const pngs = await Promise.all(
  SIZES.map((s) =>
    sharp(svg, { density: 384 }) // supersample for crisp downscale
      .resize(s, s)
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ),
);

// ICO container: 6-byte ICONDIR + 16-byte ICONDIRENTRY per image + PNG data.
const HEADER_SIZE = 6;
const ENTRY_SIZE = 16;
const dirSize = HEADER_SIZE + ENTRY_SIZE * pngs.length;

const header = Buffer.alloc(HEADER_SIZE);
header.writeUInt16LE(0, 0);             // reserved
header.writeUInt16LE(1, 2);             // type: 1 = ICO
header.writeUInt16LE(pngs.length, 4);   // image count

const entries = Buffer.alloc(ENTRY_SIZE * pngs.length);
let offset = dirSize;
pngs.forEach((png, i) => {
  const size = SIZES[i];
  const e = entries.subarray(i * ENTRY_SIZE, (i + 1) * ENTRY_SIZE);
  e.writeUInt8(size === 256 ? 0 : size, 0);  // width  (0 = 256)
  e.writeUInt8(size === 256 ? 0 : size, 1);  // height (0 = 256)
  e.writeUInt8(0, 2);                         // palette size (0 for 32bpp)
  e.writeUInt8(0, 3);                         // reserved
  e.writeUInt16LE(1, 4);                      // color planes
  e.writeUInt16LE(32, 6);                     // bits per pixel
  e.writeUInt32LE(png.length, 8);             // PNG byte size
  e.writeUInt32LE(offset, 12);                // offset from file start
  offset += png.length;
});

const ico = Buffer.concat([header, entries, ...pngs]);
writeFileSync('public/favicon.ico', ico);
console.log(`public/favicon.ico  ${SIZES.join('+')}px  ${Math.round(ico.length / 1024)}KB`);
