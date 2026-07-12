#!/usr/bin/env node
// Generate the seed wardrobe images used by the marketing demo.
//
// Reads SEED_WARDROBE from ../src/seedWardrobe.js, hits Pollinations
// (free Flux endpoint, no API key, no watermark) once per item, writes
// public/seed-wardrobe/<slug>.jpg. Skips files that already exist so
// reruns are cheap; pass --force to regenerate everything.
//
// Usage:
//   node scripts/generate-seed-wardrobe.mjs           # generate missing
//   node scripts/generate-seed-wardrobe.mjs --force   # regenerate all
//   node scripts/generate-seed-wardrobe.mjs <slug>    # one item only
//
// Requires Node 18+ for built-in fetch.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'seed-wardrobe');
const SEED_MODULE = pathToFileURL(path.join(ROOT, 'src', 'seedWardrobe.js')).href;

const WIDTH = 832;
const HEIGHT = 1088;            // ~3:4 portrait — wardrobe card aspect
const MODEL = 'flux';
const ENDPOINT = 'https://image.pollinations.ai/prompt/';
const POLITE_DELAY_MS = 800;    // Pollinations is free; don't hammer it.

const args = new Set(process.argv.slice(2));
const FORCE = args.delete('--force');
const ONLY_SLUG = [...args][0];  // optional single-slug filter

const c = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const dim = c(2), bold = c(1), green = c(32), yellow = c(33), red = c(31), cyan = c(36);

function buildPrompt(item, prefix, suffix) {
  return `${prefix} ${item.prompt}${suffix}`.replace(/\s+/g, ' ').trim();
}

function buildUrl(prompt, seed) {
  const encoded = encodeURIComponent(prompt);
  const q = new URLSearchParams({
    width: String(WIDTH),
    height: String(HEIGHT),
    model: MODEL,
    nologo: 'true',
    private: 'true',
    enhance: 'false',
    seed: String(seed),
  });
  return `${ENDPOINT}${encoded}?${q.toString()}`;
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'image/jpeg,image/*' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 4096) throw new Error(`suspiciously small payload (${buf.length}B)`);
      return buf;
    } catch (err) {
      lastErr = err;
      const wait = 1500 * i;
      console.log(`  ${yellow('retry')} ${i}/${attempts} after ${wait}ms — ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function generateOne(item, prefix, suffix) {
  const out = path.join(OUT_DIR, `${item.slug}.jpg`);
  if (!FORCE && (await fileExists(out))) {
    console.log(`  ${dim('skip')}  ${item.slug} ${dim('(already exists, --force to redo)')}`);
    return { status: 'skipped' };
  }
  const prompt = buildPrompt(item, prefix, suffix);
  const url = buildUrl(prompt, item.seed);
  const t0 = Date.now();
  const buf = await fetchWithRetry(url);
  await fs.writeFile(out, buf);
  const kb = (buf.length / 1024).toFixed(0);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ${green('ok')}    ${item.slug} ${dim(`${kb}KB · ${sec}s`)}`);
  return { status: 'ok', bytes: buf.length };
}

async function main() {
  const { SEED_WARDROBE, SEED_MASTER_PROMPT_PREFIX, SEED_MASTER_PROMPT_SUFFIX } =
    await import(SEED_MODULE);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const queue = ONLY_SLUG
    ? SEED_WARDROBE.filter((it) => it.slug === ONLY_SLUG)
    : SEED_WARDROBE;

  if (queue.length === 0) {
    console.log(red(`no items matched ${ONLY_SLUG ? `slug "${ONLY_SLUG}"` : 'the filter'}.`));
    process.exit(1);
  }

  console.log(bold(`\n${cyan('seed wardrobe')} — generating ${queue.length} item${queue.length === 1 ? '' : 's'} into ${path.relative(ROOT, OUT_DIR)}\n`));

  const summary = { ok: 0, skipped: 0, failed: 0 };
  for (const item of queue) {
    try {
      const { status } = await generateOne(item, SEED_MASTER_PROMPT_PREFIX, SEED_MASTER_PROMPT_SUFFIX);
      summary[status]++;
      if (status === 'ok') await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
    } catch (err) {
      summary.failed++;
      console.log(`  ${red('fail')}  ${item.slug} — ${err.message}`);
    }
  }

  const parts = [];
  if (summary.ok) parts.push(green(`${summary.ok} generated`));
  if (summary.skipped) parts.push(dim(`${summary.skipped} skipped`));
  if (summary.failed) parts.push(red(`${summary.failed} failed`));
  console.log(`\n${bold('done')} · ${parts.join(' · ') || dim('no work')}`);

  if (summary.failed) process.exit(1);
}

main().catch((err) => {
  console.error(red('\nfatal:'), err);
  process.exit(1);
});
