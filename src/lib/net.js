// Network resilience — CORS-proxy fallback chain with per-host backoff, plus
// product-page scraping (schema.org extraction, URL cleaning) and brand search.
import { compressImageToDataUrl } from "./canvas.js";

// Per-retailer search URL patterns. For known domains we go straight to the
// site's own search page; for everything else we fall back to a Google
// site-restricted query so the user still gets relevant results.
const BRAND_SEARCH_PATTERNS = {
  'reiss.com': 'https://www.reiss.com/search?q={q}',
  'cos.com': 'https://www.cos.com/en_gbp/search?textsearch={q}',
  'hollandcooper.com': 'https://hollandcooper.com/search?q={q}',
  'net-a-porter.com': 'https://www.net-a-porter.com/en-gb/shop/search?keywords={q}',
  'asos.com': 'https://www.asos.com/search/?q={q}',
  'johnlewis.com': 'https://www.johnlewis.com/search?search-term={q}',
  'whistles.com': 'https://www.whistles.com/uk/search?q={q}',
  'marksandspencer.com': 'https://www.marksandspencer.com/l/search?q={q}',
  'zara.com': 'https://www.zara.com/uk/en/search?searchTerm={q}',
  'arket.com': 'https://www.arket.com/en_gbp/search-results.html?q={q}',
  'mango.com': 'https://shop.mango.com/gb/search?q={q}',
  'massimodutti.com': 'https://www.massimodutti.com/uk/search?q={q}',
  'theoutnet.com': 'https://www.theoutnet.com/en-gb/shop/search?keywords={q}',
  'matchesfashion.com': 'https://www.matchesfashion.com/search?q={q}',
  'mytheresa.com': 'https://www.mytheresa.com/en-gb/search.html?q={q}',
  'farfetch.com': 'https://www.farfetch.com/uk/shopping/search?q={q}',
  'selfridges.com': 'https://www.selfridges.com/GB/en/search/products?searchTerm={q}',
  'harrods.com': 'https://www.harrods.com/en-gb/results?q={q}',
};

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

export function brandSearchUrl(website, query) {
  const host = hostOf(website);
  if (host && BRAND_SEARCH_PATTERNS[host]) {
    return BRAND_SEARCH_PATTERNS[host].replace('{q}', encodeURIComponent(query));
  }
  if (host) return `https://www.google.com/search?q=${encodeURIComponent(`${query} site:${host}`)}`;
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}


// Gemini: compose a per-day outfit capsule from the user's wardrobe for a
// travel forecast. Returns { days: [{date, outfitId, itemIds, reasoning}],
// summary }. Uses itemIds the user already owns; doesn't invent items.



// Our own Cloud Function proxy fetches server-side (no browser CORS) and is far
// more reliable than the public proxies, which are kept only as a fallback.
const FUNCTION_IMAGE_PROXY = `https://europe-west2-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/imageProxy`;
const CORS_PROXIES = [
  (u) => `${FUNCTION_IMAGE_PROXY}?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.org/?${encodeURIComponent(u)}`,
];

export function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, rej) => setTimeout(() => rej(new Error('proxy timed out')), timeoutMs)),
  ]);
}

// Domain-level circuit breaker for the proxy chain. Scraper-hostile sites
// (e.g. Holland Cooper) block all 5 public proxies; without this, the wishlist
// watcher and bulk URL importer re-attack the same dead hosts every session
// and flood DevTools with CORS errors. After a full-chain failure we record
// the host with exponential backoff (1d → 2d → 4d → … capped at 30d) and
// short-circuit further attempts. Success clears the entry.
const BLOCKED_HOSTS_KEY = 'atelier.blockedHosts';
const HOST_BACKOFF_BASE_MS = 24 * 3600_000;
const HOST_BACKOFF_MAX_MS = 30 * 86_400_000;

export function readBlockedHosts() {
  try {
    const raw = localStorage.getItem(BLOCKED_HOSTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
export function writeBlockedHosts(map) {
  try { localStorage.setItem(BLOCKED_HOSTS_KEY, JSON.stringify(map)); }
  catch { /* quota / private mode — fail open */ }
}
export function isHostBlocked(host) {
  if (!host) return false;
  const entry = readBlockedHosts()[host];
  return !!entry && entry.nextRetryAt > Date.now();
}
export function markHostFailed(host) {
  if (!host) return;
  const map = readBlockedHosts();
  const failCount = (map[host]?.failCount || 0) + 1;
  const wait = Math.min(HOST_BACKOFF_BASE_MS * 2 ** (failCount - 1), HOST_BACKOFF_MAX_MS);
  map[host] = { failCount, nextRetryAt: Date.now() + wait };
  writeBlockedHosts(map);
}
export function clearHostBlock(host) {
  if (!host) return;
  const map = readBlockedHosts();
  if (!map[host]) return;
  delete map[host];
  writeBlockedHosts(map);
}
// Reset every host cooldown — used before a batch so stale blocks (from when
// the public proxies were failing) don't skip hosts the function proxy can serve.
export function clearAllHostBlocks() { writeBlockedHosts({}); }

export async function fetchViaProxy(url, options = {}) {
  const host = hostOf(url);
  if (isHostBlocked(host)) {
    throw new Error(`Skipped — ${host} is in cooldown after repeated proxy failures`);
  }
  const errors = [];
  for (const buildUrl of CORS_PROXIES) {
    try {
      const resp = await fetchWithTimeout(buildUrl(url), options);
      if (resp.ok) {
        clearHostBlock(host);
        return resp;
      }
      errors.push(`HTTP ${resp.status}`);
    } catch (err) {
      errors.push(err?.message || 'fetch failed');
    }
  }
  markHostFailed(host);
  throw new Error(`All ${CORS_PROXIES.length} proxies failed (${errors.slice(0, 3).join(' · ')})`);
}

// Download an image (through a public CORS proxy to bypass hotlink-block headers),
// resize it, and return a small base64 data URL we can persist inside Firestore.
export async function imageUrlToCompressedDataUrl(url) {
  try {
    const resp = await fetchViaProxy(url);
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not an image');
    const file = new File([blob], 'product.jpg', { type: blob.type });
    return await compressImageToDataUrl(file, { maxWidth: 800, maxBytes: 150_000 });
  } catch (err) {
    console.warn('[wardrobe] image proxy fetch failed:', err);
    return null;
  }
}

// Parse Schema.org Product / Offer data out of a page's JSON-LD blocks.
// This is the most reliable place to find price, brand, and full descriptions —
// Open Graph rarely exposes price; Schema.org almost always does for e-commerce.
export function extractSchemaFromHtml(html) {
  const out = {};
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(jsonText); } catch { continue; }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const flat = items.flatMap((n) => (n && n['@graph'] ? n['@graph'] : [n]));
    for (const node of flat) {
      if (!node || typeof node !== 'object') continue;
      const type = Array.isArray(node['@type']) ? node['@type'].join(',') : (node['@type'] || '');
      if (!/Product/i.test(type)) continue;
      out.name = out.name || node.name;
      out.description = out.description || node.description;
      out.brand = out.brand || (typeof node.brand === 'string' ? node.brand : node.brand?.name);
      if (node.image) out.image = out.image || (Array.isArray(node.image) ? node.image[0] : node.image);
      const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      if (offers) {
        const price = offers.price ?? offers.lowPrice ?? offers.highPrice;
        if (price != null && !out.price) out.price = String(price);
        if (offers.priceCurrency && !out.currency) out.currency = offers.priceCurrency;
      }
    }
  }
  // Open Graph fallback for price.
  if (!out.price) {
    const m = html.match(/<meta\s+[^>]*?(?:property|name)=["'](?:og:price:amount|product:price:amount)["'][^>]*?content=["']([^"']+)["']/i);
    if (m) out.price = m[1];
  }
  return out;
}

// Strip tracking params + unwrap common search-engine redirect URLs so links
// from emails / Google / Bing / DuckDuckGo / Pinterest etc. extract cleanly.
// Real-world links often have 200+ chars of utm_/gclid/srsltid junk that
// proxies sometimes choke on.
export function cleanProductUrl(rawUrl) {
  let working = (rawUrl || '').trim();
  if (!working) return '';

  // Sometimes URLs come URL-encoded (e.g. from copy-paste from a redirect param)
  if (/^https?%3A/i.test(working)) {
    try { working = decodeURIComponent(working); } catch { /* ignore */ }
  }

  // Some apps wrap URLs in newlines / quotes when shared
  working = working.replace(/^["'\s]+|["'\s]+$/g, '');

  // Iteratively unwrap redirects (some links double-wrap)
  for (let i = 0; i < 3; i++) {
    let changed = false;
    try {
      const u = new URL(working);
      const host = u.hostname.toLowerCase();
      // Google search: google.*/url?q=ACTUAL
      if (/^(www\.)?google\./.test(host) && u.pathname === '/url') {
        const target = u.searchParams.get('q') || u.searchParams.get('url');
        if (target) { working = target; changed = true; continue; }
      }
      // Google Shopping redirect
      if (host === 'www.google.com' && u.pathname === '/aclk') {
        const target = u.searchParams.get('adurl');
        if (target) { working = target; changed = true; continue; }
      }
      // Bing redirect: bing.com/ck/a?...&u=BASE64
      if (/bing\./.test(host)) {
        const target = u.searchParams.get('u');
        if (target) {
          try {
            // Bing encodes the target as base64 with a "a1" prefix
            const stripped = target.replace(/^a1/, '');
            const padded = stripped + '='.repeat((4 - stripped.length % 4) % 4);
            const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
            if (/^https?:\/\//i.test(decoded)) { working = decoded; changed = true; continue; }
          } catch { /* not base64, ignore */ }
        }
      }
      // DuckDuckGo: duckduckgo.com/l/?uddg=URL_ENCODED_ACTUAL
      if (/duckduckgo\./.test(host)) {
        const target = u.searchParams.get('uddg');
        if (target) { try { working = decodeURIComponent(target); changed = true; continue; } catch {} }
      }
      // Yahoo: r.search.yahoo.com/.../RU=URL/RK=...
      if (/yahoo\./.test(host) && u.pathname.includes('/RU=')) {
        const m = u.pathname.match(/\/RU=([^/]+)/);
        if (m) { try { working = decodeURIComponent(m[1]); changed = true; continue; } catch {} }
      }
      // Pinterest pin-out redirect
      if (/pinterest\./.test(host)) {
        const target = u.searchParams.get('url');
        if (target) { working = target; changed = true; continue; }
      }
      // Facebook l.facebook.com redirect
      if (host === 'l.facebook.com' || host === 'lm.facebook.com') {
        const target = u.searchParams.get('u');
        if (target) { try { working = decodeURIComponent(target); changed = true; continue; } catch {} }
      }
    } catch { /* not a URL, stop */ }
    if (!changed) break;
  }

  // Strip tracking params from the final URL
  try {
    const u = new URL(working);
    const TRACKING_PARAMS = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'utm_name',
      'fbclid', 'gclid', 'msclkid', 'dclid', 'gbraid', 'wbraid', 'twclid', 'yclid', 'srsltid',
      'mc_cid', 'mc_eid', 'mc_tc', '_ga', '_gl', 'igshid', 'cm_mmc',
      'ref', 'referrer', 'referer', 'source', 'campaign', 'cmpid', 'ICID', 'iclid', 'sscid',
      'sa', 'ved', 'usg', 'opi', 'rct', // Google trailing junk
      'ei', 'oq', 'esrc', 'biw', 'bih',
      'cvid', 'aqs', 'sourceid', 'ie', // Bing/MSN
      'epik', 'rd', // Pinterest
    ]);
    const TRACKING_PREFIXES = ['utm_', 'pk_', 'piwik_', 'matomo_', 'oly_'];
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || TRACKING_PREFIXES.some((p) => key.toLowerCase().startsWith(p))) {
        u.searchParams.delete(key);
      }
    }
    const cleaned = u.toString();
    if (cleaned !== rawUrl) console.log('[wardrobe] URL cleaned:', rawUrl.slice(0, 60) + '...', '→', cleaned);
    return cleaned;
  } catch {
    return working;
  }
}

// Best-effort metadata extraction from any product URL.
// Pipeline: Microlink (title/image/description) + raw HTML via proxy chain
// (JSON-LD price/brand/full desc). Each step is logged on failure so console
// shows which stage failed when a user reports issues.
export async function fetchProductFromUrl(rawUrl) {
  const url = cleanProductUrl(rawUrl);
  let microlinkData = {};
  let microlinkError = null;
  try {
    const resp = await fetchWithTimeout(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {}, 10_000);
    if (resp.ok) {
      const json = await resp.json();
      if (json.status === 'success') microlinkData = json.data || {};
      else microlinkError = json.message || `Microlink ${json.status}`;
    } else {
      microlinkError = `Microlink HTTP ${resp.status}`;
    }
  } catch (err) {
    microlinkError = err?.message || 'Microlink network error';
  }
  if (microlinkError) console.warn('[wardrobe] microlink failed:', microlinkError);

  let schema = {};
  let schemaError = null;
  try {
    const htmlResp = await fetchViaProxy(url);
    const html = await htmlResp.text();
    schema = extractSchemaFromHtml(html);
  } catch (err) {
    schemaError = err?.message || 'Proxy network error';
    console.warn('[wardrobe] schema fetch failed:', schemaError);
  }

  if (!microlinkData.title && !schema.name) {
    const detail = [microlinkError, schemaError].filter(Boolean).join(' · ');
    throw new Error(
      `Couldn't read this link${detail ? ` (${detail})` : ''}. ` +
      `Try Manual Entry — you can paste the product image directly.`
    );
  }

  const rawImage = microlinkData.image?.url || schema.image || microlinkData.logo?.url || '';
  const localImage = rawImage ? await imageUrlToCompressedDataUrl(rawImage) : null;

  return {
    name: microlinkData.title || schema.name || '',
    brand: microlinkData.publisher || schema.brand || microlinkData.author || '',
    description: schema.description || microlinkData.description || '',
    price: schema.price || '',
    imageUrl: localImage || rawImage,
    sourceUrl: url,
  };
}

