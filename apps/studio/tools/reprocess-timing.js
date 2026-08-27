// Dev-only, like alpha-check.html — Vite builds index.html only, so nothing
// here reaches production.
//
// Measures the cost of ONE item's reprocess, which is the whole migration
// question. Phase two cannot recover alpha from a white-flattened JPEG (treating
// near-white as transparent would erase a white shirt), so every existing item
// must have background removal re-run from its original. Whether that is
// tolerable depends entirely on the per-item cost, and nobody has measured it.
//
// The first call is always far slower than the rest: it fetches and initialises
// a ~5MB model. That is paid once per session, not once per item, so it is
// reported separately — averaging it in would badly overstate a wardrobe run.
import { removeBackground } from '@imgly/background-removal';
import { canEncodeWebp, pickEncoding, WEBP_LADDER, JPEG_LADDER, CUTOUT_BUDGET_CHARS } from '../src/lib/encode.js';

const PROXY = `https://europe-west2-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/imageProxy`;

const els = {
  urls: document.getElementById('urls'),
  files: document.getElementById('files'),
  run: document.getElementById('run'),
  status: document.getElementById('status'),
  table: document.getElementById('table'),
  rows: document.getElementById('rows'),
  foot: document.getElementById('foot'),
  verdict: document.getElementById('verdict'),
};

const ms = (n) => `${Math.round(n).toLocaleString()} ms`;

// Firebase Storage sends no CORS headers and cannot be proxied by weserv (the
// object path must stay percent-encoded; weserv normalises %2F and Storage
// answers 403). The app's own proxy encodes the whole URL, so it survives.
async function fetchBlob(url) {
  const direct = url.includes('firebasestorage.googleapis.com')
    ? `${PROXY}?url=${encodeURIComponent(url)}`
    : url;
  const resp = await fetch(direct);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.blob();
}

// The same flatten-and-encode the real pipeline does, so the number includes
// everything an item actually costs — not just the model.
async function encodeLikeProduction(blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 900 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const webp = await canEncodeWebp();
  return pickEncoding(
    async (q) => canvas.toDataURL(webp ? 'image/webp' : 'image/jpeg', q),
    webp ? WEBP_LADDER : JPEG_LADDER,
    CUTOUT_BUDGET_CHARS,
  );
}

els.run.addEventListener('click', async () => {
  const urls = els.urls.value.split('\n').map((s) => s.trim()).filter(Boolean);
  const files = Array.from(els.files.files || []);
  const jobs = [
    ...urls.map((u, i) => ({ label: `url ${i + 1}`, get: () => fetchBlob(u) })),
    ...files.map((f) => ({ label: f.name, get: () => Promise.resolve(f) })),
  ];
  if (jobs.length === 0) { els.status.textContent = 'Paste a URL or choose a file first.'; return; }

  els.run.disabled = true;
  els.table.hidden = false;
  els.rows.innerHTML = '';
  const removals = [];

  for (const [i, job] of jobs.entries()) {
    els.status.textContent = `Reprocessing ${i + 1} of ${jobs.length} — ${job.label}`;
    try {
      const t0 = performance.now();
      const blob = await job.get();
      const t1 = performance.now();
      const cut = await removeBackground(blob);
      const t2 = performance.now();
      await encodeLikeProduction(cut);
      const t3 = performance.now();

      removals.push({ first: i === 0, removal: t2 - t1, total: t3 - t0 });
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${job.label}${i === 0 ? ' <em>(model load)</em>' : ''}</td>`
        + `<td>${ms(t1 - t0)}</td><td>${ms(t2 - t1)}</td><td>${ms(t3 - t2)}</td><td>${ms(t3 - t0)}</td>`;
      els.rows.appendChild(tr);
    } catch (err) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${job.label}</td><td colspan="4">failed — ${err.message}</td>`;
      els.rows.appendChild(tr);
    }
  }

  els.status.textContent = 'Done.';
  els.run.disabled = false;

  const steady = removals.filter((r) => !r.first);
  if (steady.length === 0) {
    els.verdict.hidden = false;
    els.verdict.innerHTML = '<b>Only one item measured.</b> That figure includes the one-off model '
      + 'load, so it overstates a wardrobe run badly. Run at least three to get a steady-state number.';
    return;
  }
  const mean = steady.reduce((t, r) => t + r.total, 0) / steady.length;
  const firstTotal = removals[0].total;
  els.foot.innerHTML = `<tr><td>steady state, excluding model load</td>`
    + `<td colspan="3"></td><td>${ms(mean)}</td></tr>`;

  const forN = (n) => ms(firstTotal + mean * (n - 1));
  els.verdict.hidden = false;
  els.verdict.innerHTML = `<b>${ms(mean)} per item</b> once the model is loaded; the first item cost `
    + `${ms(firstTotal)} including the one-off load.<br><br>`
    + `A wardrobe of 50 would take about <b>${forN(50)}</b>, 150 about <b>${forN(150)}</b>, `
    + `300 about <b>${forN(300)}</b> — single-threaded, tab open, no uploads counted. `
    + `Storage writes add a round-trip each and are not in these figures.`;
});
