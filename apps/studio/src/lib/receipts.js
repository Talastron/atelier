// Receipt OCR text parsing — extract brand, date and line-item prices from the
// raw text returned by the receipt vision model. Self-contained.

// Best-effort extraction from pasted order confirmations / receipts.
// Designed for UK retailer formats (Holland Cooper, COS, John Lewis, ASOS etc).
// Returns { brand, purchasedDate, items: [{ name, price, brand }] }.

const RECEIPT_PRICE_RE = /(?:£|GBP\s*|\$|€|EUR\s*)\s*(\d+(?:[.,]\d{1,2})?)/;
const RECEIPT_BLOCKLIST = /^\s*(total|subtotal|sub-total|grand\s+total|order\s+(total|summary)|shipping|delivery|postage|tax|vat|discount|gift\s*card|promo|payment|paid|amount(?:\s+(due|paid))?|estimated|balance)/i;

export function parseReceiptText(rawText) {
  const text = (rawText || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { brand: '', purchasedDate: '', purchasedFrom: '', items: [] };

  const brand = detectReceiptBrand(lines, text);
  const purchasedDate = detectReceiptDate(lines) || todayISO();
  const items = extractReceiptItems(lines, brand);
  return { brand, purchasedDate, purchasedFrom: brand, items };
}

export function detectReceiptBrand(lines, fullText) {
  // 1. From email address pattern
  const emailMatch = fullText.match(/(?:noreply|orders?|hello|info|contact|customerservice|support)@([a-z0-9][a-z0-9-]*)\.[a-z.]+/i);
  if (emailMatch) {
    const slug = emailMatch[1];
    return slug.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  // 2. ALL-CAPS short line at top (brand logos in plain-text emails)
  for (const line of lines.slice(0, 15)) {
    if (line.length < 3 || line.length > 40) continue;
    if (/^(order|receipt|confirmation|thank|welcome|hello|hi|dear|invoice|subject|to)/i.test(line)) continue;
    if (/^[A-Z][A-Z\s&'.-]{2,30}$/.test(line)) return line.trim();
  }
  // 3. "from BRAND" or "at BRAND" phrasing
  for (const line of lines.slice(0, 30)) {
    const m = line.match(/(?:from|at|with|shopping at)\s+([A-Z][\w&'.\s-]{1,30})(?:\.|!|,|\s*$)/);
    if (m) return m[1].trim();
  }
  return '';
}

export function detectReceiptDate(lines) {
  const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const pad = (s) => String(s).padStart(2, '0');
  for (const line of lines) {
    // "12 May 2026" or "12th May 2026"
    let m = line.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
    if (m) return `${m[3]}-${MONTHS[m[2].slice(0, 3).toLowerCase()]}-${pad(m[1])}`;
    // "May 12, 2026"
    m = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
    if (m) return `${m[3]}-${MONTHS[m[1].slice(0, 3).toLowerCase()]}-${pad(m[2])}`;
    // ISO "2026-05-12"
    m = line.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    // UK "12/05/2026"
    m = line.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  }
  return '';
}

export function extractReceiptItems(lines, brand) {
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const priceMatch = line.match(RECEIPT_PRICE_RE);
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1].replace(',', '.'));
    if (!isFinite(price) || price < 5 || price > 50000) continue;
    if (RECEIPT_BLOCKLIST.test(line)) continue;

    // Try same-line: "Amalfi Linen Short   £99.00"
    let name = line.replace(RECEIPT_PRICE_RE, '').replace(/\s{2,}/g, ' ').trim();
    name = name.replace(/^[-*•·\d.\s)]+/, '').trim();
    if (name.length < 3 || RECEIPT_BLOCKLIST.test(name) || /^(qty|quantity|size|color|colour|sku|item\s*#|x?\d+\s*$)/i.test(name)) {
      name = '';
    }

    // Otherwise look back up to 5 lines for the likely name
    if (!name) {
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const cand = lines[j];
        if (!cand) continue;
        if (RECEIPT_PRICE_RE.test(cand)) break; // hit previous item block
        if (RECEIPT_BLOCKLIST.test(cand)) continue;
        if (/^(qty|quantity|size|color|colour|sku|item\s*#)/i.test(cand)) continue;
        if (/^\s*\d+\s*x?\s*$/i.test(cand)) continue; // bare qty
        if (cand.length < 3 || cand.length > 80) continue;
        name = cand;
        break;
      }
    }

    if (!name) continue;
    // Skip exact duplicate name+price (some receipts list line items twice)
    if (items.some((it) => it.name === name && it.price === price)) continue;
    items.push({ name, price, brand });
  }
  return items;
}



