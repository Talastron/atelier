// Dev-only. Vite builds index.html only, so this never enters a production
// bundle. Answers the two questions gating phase two of the flat-lay work:
// does WebP-with-alpha cost more than today's JPEG-on-white, and do real
// cut-outs look acceptable floating on cream rather than sitting on white.
import { removeBackground } from '@imgly/background-removal';
import { compressImageToDataUrl } from '../src/lib/canvas.js';

// toDataURL/toBlob do NOT throw on an unsupported MIME type — per spec they
// fall back to image/png. A naive toBlob('image/webp') on a browser without
// WebP encoding therefore returns a PNG, which is exactly the 3-5x blow-up the
// original flatten-onto-white decision was avoiding, and it would do so
// invisibly. So detect properly before reporting any number.
async function webpEncodingSupported() {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
  return !!blob && blob.type === 'image/webp';
}

const encode = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b ? b.size : 0), type, quality));

function canvasFor(img, { flattenOnWhite }) {
  // 900px cap matches removeImageBackground, so the baseline column is the
  // real baseline rather than a differently-sized approximation.
  const scale = Math.min(1, 900 / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext('2d');
  if (flattenOnWhite) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const im = new Image();
  im.onload = () => resolve(im);
  im.onerror = reject;
  im.src = src;
});

const kb = (bytes) => (bytes / 1024).toFixed(0) + 'K';

const els = {
  files: document.getElementById('files'),
  rows: document.getElementById('rows'),
  foot: document.getElementById('foot'),
  table: document.getElementById('table'),
  strip: document.getElementById('strip'),
  status: document.getElementById('status'),
  warn: document.getElementById('warn'),
};

els.files.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  if (!(await webpEncodingSupported())) {
    els.warn.className = 'show';
    els.warn.textContent =
      'This browser cannot encode WebP from a canvas. toBlob would silently return PNG, so any '
      + 'number here would be a lie. Re-run in a browser with canvas WebP encoding.';
    return;
  }

  els.table.hidden = false;
  const ratios = [];

  for (const [i, file] of files.entries()) {
    els.status.textContent = `Removing background ${i + 1} of ${files.length} — ${file.name}`;

    const sourceDataUrl = await compressImageToDataUrl(file);
    const sourceBlob = await (await fetch(sourceDataUrl)).blob();
    const cutoutBlob = await removeBackground(sourceBlob);
    const cutout = await loadImage(URL.createObjectURL(cutoutBlob));

    const alpha = canvasFor(cutout, { flattenOnWhite: false });
    const white = canvasFor(cutout, { flattenOnWhite: true });

    const sizes = {
      jpegWhite: await encode(white, 'image/jpeg', 0.86),
      webpWhite: await encode(white, 'image/webp', 0.8),
      webp90: await encode(alpha, 'image/webp', 0.9),
      webp80: await encode(alpha, 'image/webp', 0.8),
      webp70: await encode(alpha, 'image/webp', 0.7),
      png: await encode(alpha, 'image/png'),
    };
    const ratio = sizes.webp80 / sizes.jpegWhite;
    ratios.push(ratio);

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${file.name}</td><td>${kb(sizes.jpegWhite)}</td><td>${kb(sizes.webpWhite)}</td>`
      + `<td>${kb(sizes.webp90)}</td><td>${kb(sizes.webp80)}</td><td>${kb(sizes.webp70)}</td>`
      + `<td>${kb(sizes.png)}</td><td>${ratio.toFixed(2)}x</td>`;
    els.rows.appendChild(tr);

    // The edge-quality check: on a white plate a ragged edge is invisible,
    // floating on cream it is not. This is the most likely reason to abandon
    // phase two, and no number can answer it.
    const fig = document.createElement('figure');
    const url = alpha.toDataURL('image/webp', 0.8);
    fig.innerHTML = `<div class="on-cream"><img src="${url}"></div>`
      + `<div class="on-white" style="margin-top:6px"><img src="${url}"></div>`
      + `<figcaption>${file.name}<br>cream above, white below</figcaption>`;
    els.strip.appendChild(fig);
  }

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const lo = Math.min(...ratios).toFixed(2);
  const hi = Math.max(...ratios).toFixed(2);
  els.foot.innerHTML =
    `<tr><td colspan="7">WebP+&alpha; q80 &divide; JPEG-on-white — mean across ${ratios.length} images `
    + `(spread ${lo}x to ${hi}x)</td><td>${mean.toFixed(2)}x</td></tr>`;
  els.status.textContent = 'Done.';
});
