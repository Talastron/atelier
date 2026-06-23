import sharp from 'sharp';
import { copyFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'brand/store';
const publicCopies = {
  'atelier-og.png': 'public/og-image.png',
};

const targets = {
  'atelier-membership-hero.svg': [1600, 1200],
  'atelier-annual-hero.svg':     [1600, 1200],
  'atelier-monthly-hero.svg':    [1600, 1200],
  'atelier-social-square.svg':   [1080, 1080],
  'atelier-og.svg':              [1200, 630],
};

const svgs = readdirSync(dir).filter((f) => f.endsWith('.svg'));

for (const file of svgs) {
  const [w, h] = targets[file] ?? [1600, 1200];
  const svgPath = join(dir, file);
  const pngPath = join(dir, file.replace(/\.svg$/, '.png'));
  const svg = readFileSync(svgPath);
  const info = await sharp(svg, { density: 300 })
    .resize(w, h)
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(pngPath);
  console.log(`${pngPath.padEnd(48)} ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB`);

  const copyTo = publicCopies[file.replace(/\.svg$/, '.png')];
  if (copyTo) {
    copyFileSync(pngPath, copyTo);
    console.log(`  ↳ copied to ${copyTo}`);
  }
}
