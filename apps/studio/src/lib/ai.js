// All Gemini model calls — outfit generation, item/label/receipt/inspiration
// vision analysis, naming/tagging, concierge chat, style manifesto, travel
// capsule. Wired via Firebase AI Logic (App Check verified, no API key in bundle).
import { isAIEnabled, geminiText, geminiTextVision, geminiTextStream, Schema } from "../firebase.js";
import { currentSeasonLabel, itemColors, itemMaterials, itemSeasons, itemStyles, itemWearCount, itemWearHistory, itemWearOccasions, resolveOutfitItems, todayISO } from "./items.js";
import { buildItemFitPrompt, parseAndNormalizeFit, selectAspirationBasis, buildItemSummaryLine } from './itemFit.js';
import { weatherLabel } from "./weather.js";
import { ensureClothingBase, hasClothingBase, trimToOnePerSlot } from "./outfit.js";
import { ALL_MATERIALS, CARE_TAGS, COLOR_FAMILIES, MATERIALS, STYLES } from "./taxonomy.js";

// Locks the shape of a composed-outfit reply: all four fields required, with
// the right types. Stops malformed/partial JSON at the source (fix A); the
// deterministic clothing-base backstop (ensureClothingBase) handles the
// semantic guarantee a schema can't express ("at least one garment").
const OUTFIT_RESPONSE_SCHEMA = Schema.object({
  properties: {
    itemIds: Schema.array({ items: Schema.string() }),
    reasoning: Schema.string(),
    confidence: Schema.number(),
    tags: Schema.array({ items: Schema.string() }),
  },
});

const FIT_RESPONSE_SCHEMA = Schema.object({
  properties: {
    verdict: Schema.string(),
    coherence: Schema.number(),
    aspiration: Schema.number(),
    dimensions: Schema.array({
      items: Schema.object({
        properties: {
          label: Schema.string(),
          state: Schema.string(),
          level: Schema.number(),
        },
      }),
    }),
  },
});

// The marker rule promises every piece named in the reasoning is in itemIds. If
// trimToOnePerSlot drops one, unwrap its <<item:ID|name>> marker back to plain
// text so the prose can never cite a piece the look no longer contains.
function unwrapMarkers(reasoning = '', ids = []) {
  return ids.reduce((text, id) => {
    const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`<<item:${escaped}\\|([^>]*)>>`, 'g'), '$1');
  }, reasoning || '');
}

export async function generateOutfitWithGemini({ items, intent, weather, season, previousOutfit = null, temperature = 0.7, styleProfile = '', mustIncludeItem = null, calendarEvents = [], recentLooks = [] }) {
  if (!isAIEnabled()) {
    throw new Error('Concierge is not yet set up. Add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic to .env.local to enable styling.');
  }
  if (!items.length) throw new Error('Add some items first.');

  const summarize = (i) =>
    `${i.id}|${i.name}|${i.brand || '?'}|${i.category}${i.subCategory ? '/' + i.subCategory : ''}` +
    `${i.favorite ? '|★FAVOURITE' : ''}` +
    `|styles=${itemStyles(i).join(',') || '-'}` +
    `|colors=${itemColors(i).join(',') || '-'}` +
    `|seasons=${itemSeasons(i).join(',') || 'any'}` +
    `|materials=${itemMaterials(i).join(',') || '-'}`;

  const refinementBlock = previousOutfit && previousOutfit.length > 0
    ? `\n\nThe user currently has this outfit assembled:\n${previousOutfit.map((i) => `- ${i.category}: ${i.name} by ${i.brand || '?'}`).join('\n')}\n\nThey want a REFINEMENT: "${intent}". Build a NEW outfit that addresses their refinement request — keep elements that aren't being changed, swap elements that are.\n`
    : '';

  // When the user opens an item and asks "style around this", the focal piece
  // is non-negotiable — every other piece must complement it.
  const mustIncludeBlock = mustIncludeItem
    ? `\n\nFOCAL PIECE — the outfit MUST be built around this exact item (do not omit it, do not substitute):\n- id=${mustIncludeItem.id} · ${mustIncludeItem.name} by ${mustIncludeItem.brand || '?'} · ${mustIncludeItem.category}${mustIncludeItem.subCategory ? '/' + mustIncludeItem.subCategory : ''}\nInclude '${mustIncludeItem.id}' in itemIds. Build complementary pieces from the rest of the wardrobe that work with its colour, style and category.\n`
    : '';

  const eventsHint = calendarEvents.length > 0
    ? `\n\nWHAT THE USER HAS ON TODAY:
${calendarEvents.map((e) => `- ${e.allDay ? 'All day' : new Date(e.startISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}: ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n')}

Dress for the most demanding event of the day — if there's a board meeting AND a casual lunch, dress for the board meeting. Reflect this in the reasoning sentence.\n`
    : '';

  // Freshness. Without this the daily brief sends identical inputs every day
  // and the model re-picks the same base, so the same shirt and trousers come
  // back each morning (only the optional slots jitter). Naming the recent bases
  // steers AWAY from repeats rather than naming a piece to reach for — but that
  // is not by itself a safety property: on a small wardrobe, ruling out all but
  // one base effectively forces that one in, and it could be an occasion piece.
  // What actually keeps a gown off an ordinary Tuesday is the explicit
  // everyday-appropriateness carve-out in the PRIORITY paragraph. The block
  // states its own priority, because the model never sees this comment: it
  // OUTRANKS the ★FAVOURITE preference for the base (favourites are what tend
  // to recur, so deferring to them would reinstate the bug), and stays
  // subordinate to the weather, complete-the-look and everyday rules.
  //
  // CONTRACT: callers must pass `recentLooks` most-recent-day first (the order
  // dailyBrief's mergeRecent already returns). The block says so in its header
  // because the rendered lines carry no dates — without that cue "prefer the
  // LEAST recent" is unactionable, and a wrong order would invert it into
  // "repeat yesterday's", the exact bug this exists to fix.
  const freshnessBlock = recentLooks.length > 0
    ? `\n\nRECENT DAILY LOOKS were built on these pieces, most recent day first. Match them by id — the wardrobe can hold several pieces sharing a name, and a different colourway IS a different piece:
${recentLooks.map((i) => `- id=${i.id} · ${i.category}: ${i.name}${itemColors(i).length ? ` (${itemColors(i).join(', ')})` : ''}`).join('\n')}

Build today's look on a DIFFERENT clothing base — a different Top + Bottom pair, or a different Dress. Shoes, bags and jewellery MAY repeat if they genuinely finish the new look.

PRIORITY: this freshness steer outranks EXACTLY ONE rule — the ★FAVOURITE preference below, and only when choosing the base (a piece being a favourite is not a reason to repeat a recent base; favourites are exactly what tend to recur). It outranks NOTHING ELSE. Every other rule below still binds in full: one item per category slot, the weather rules, complete-the-look, colour and style cohesion, and everyday-appropriateness. Being "different" is NEVER a licence to break one of them — do not add extra garments to a slot to manufacture variety, and never reach for an Occasion or eveningwear piece. If no everyday-appropriate different base can satisfy every rule and still form a coherent look, repeat a base rather than break one — and when repeating, prefer the LEAST recent of the pieces listed above.\n`
    : '';

  // Fix C — present clothing as a clearly-labelled, MANDATORY foundation listed
  // FIRST, with everything else as complementary pieces after. An accessory-/
  // jewellery-heavy wardrobe otherwise buries the handful of garments in one flat
  // list, and the model drifts to composing pure accessories. Bases are listed in
  // full (the look must be built from them); the deterministic ensureClothingBase
  // backstop below still guarantees correctness if the model slips anyway.
  const isClothingBase = (i) => i.category === 'Dresses' || i.category === 'Tops' || i.category === 'Bottoms';
  const baseItems = items.filter(isClothingBase);
  const otherItems = items.filter((i) => !isClothingBase(i));
  const baseBlock = baseItems.length
    ? baseItems.map(summarize).join('\n')
    : '(none — the wardrobe has no dress/top/bottom; a complete look cannot be built)';

  const prompt = `You are an expert personal stylist. From the user's wardrobe below, build ONE coherent outfit that genuinely works together visually.${refinementBlock}${mustIncludeBlock}

User context:
- Intent: ${intent || 'an everyday look'}
- Today's weather: ${weather ? `${weather.temp}°C, ${weatherLabel(weather.code, weather.precipProb)}${weather.precipProb != null ? ` (${weather.precipProb}% rain chance)` : ''}` : 'unknown'}
- Current season: ${season}
${styleProfile ? `- ${styleProfile}` : ''}${eventsHint}${freshnessBlock}

Stylist rules:
- Pick AT MOST one item per category slot for: Tops, Outerwear, Bottoms, Dresses, Shoes, Bags, Accessories.
- Jewellery is layered — you MAY pick MULTIPLE items per jewellery slot (Earrings, Necklaces, Wrist). A complete look can carry two stacked necklaces, layered bracelets, or both pearl studs and a small drop earring. Compose jewellery as a curated stack, not a single piece — but only when the items genuinely work together.
- A Pendant is not wearable on its own — it hangs on a chain, and the wardrobe lists Pendants and Necklaces as SEPARATE pieces. If you pick a Pendant you MUST also include a Necklace for it to hang on; if no suitable Necklace is available, do not pick the Pendant at all.
- A Dress REPLACES Tops + Bottoms — never include all three.
- COMPLETE THE LOOK — non-negotiable: itemIds MUST contain a full clothing base — EITHER one Dress, OR BOTH a Top AND a Bottom. Never return a look that is missing its bottom (a top with no trousers/skirt/shorts) or missing its top. If you describe trousers, shorts, a skirt or a top in the reasoning, that exact item MUST be in itemIds (see the marker rule) — a garment mentioned in prose but absent from itemIds is a hard failure.
- Pick ONLY items whose category matches the slot — never put a bag in the shoes slot.

WEATHER-DRIVEN RULES (this is NON-NEGOTIABLE — temperature is the strongest filter):
- Below 5°C: REQUIRE heavy outerwear (winter coat). REQUIRE long sleeves. Prefer wool, cashmere, knits. NO bare legs, NO open shoes, NO linen.
- 5-12°C: REQUIRE outerwear (coat or heavy jacket). Long sleeves. Mid-weight materials. Closed shoes. Tights/trousers, not bare legs.
- 12-18°C: Light outerwear (blazer, light jacket, cardigan). Long sleeves or layerable. Avoid heavy wool. Closed or low-cut shoes OK.
- 18-24°C: Optional light layer. T-shirt-weight tops, light trousers, dresses. Avoid heavy outerwear or thick knits.
- Above 24°C: NO outerwear. Linen, cotton, lightweight pieces only. Sleeveless, shorts, dresses preferred. Sandals welcome.
- Rain/Snow weather code: choose darker tones (visibility/stain), prefer water-resistant outerwear if owned, closed shoes.
- The reasoning sentence MUST mention the temperature and weather conditions explicitly so the user can see the call was made deliberately.

- Colour palette must be cohesive: neutrals + 1-2 accent colours, avoid clashes (red+pink, red+orange, etc.).
- Metal cohesion: keep the jewellery and metal hardware in ONE metal family per look — all yellow gold, OR all rose gold, OR all silver/white gold/platinum. Do NOT mix yellow gold with rose gold, or gold with silver, in the same look (a yellow-gold necklace with a rose-gold pendant reads as a mistake, not a choice). Match watch, earrings, necklaces, and bracelets to the same metal.
- Style cohesion: a smart blazer doesn't go with sports leggings.
- Skip Outerwear unless the weather/season warrants it.
- Skip optional slots (Bags, Accessories, Jewellery) if nothing genuinely complements the look — better empty than wrong.
- ★FAVOURITE items are pieces the user loves — give them meaningful preference when they fit the intent and palette. Don't force a favourite that clashes; do prefer one over an equally-suitable non-favourite.
- Default to everyday-appropriate pieces. Reserve Occasion-tagged pieces and eveningwear (styles=Occasion, or Dresses/Cocktail, or Dresses/Evening / Gown) for days whose events call for them — on an ordinary day with no matching event, do not choose them.

Reasoning rules:
- The reasoning is saved with the look long-term — write it as a STANDALONE description of the final outfit. Describe why this combination works as a complete look (palette, silhouette, occasion). Do NOT reference the user's previous outfit, what was swapped, replaced, or kept — that context is meaningless when the user opens the saved look weeks later.

Available items — build the look from these. Choose the clothing FOUNDATION first, then add complementary pieces.

CLOTHING BASES — the look MUST be built on one of these: EITHER one Dress, OR one Top AND one Bottom. Select the base BEFORE anything else, and put its id(s) in itemIds first (id|name|brand|category|attributes):
${baseBlock}

COMPLEMENTARY PIECES — shoes, bags, outerwear, belts, accessories and jewellery to FINISH the look. These NEVER replace the clothing base; add only what genuinely completes it (id|name|brand|category|attributes):
${otherItems.map(summarize).join('\n')}

Respond ONLY with valid JSON in this exact shape:
{"itemIds": ["id1", "id2", ...], "reasoning": "one elegant sentence explaining why this combination works", "confidence": 0-100, "tags": ["3-5 short descriptive labels"]}

Marker rule for the reasoning field — STRICT. The pictured look (your itemIds) and the written look (this reasoning) MUST be identical:
- EVERY garment or accessory you name in the reasoning MUST be one of the items in your itemIds array, and MUST be wrapped as <<item:ID|display name>> using that exact item's id.
- NEVER name a piece that is not in itemIds. If you describe wearing something, it has to be in itemIds — no exceptions, including the main garment (dress / top / bottom).
- NEVER leave a named piece as plain text. There is no "too generic to wrap" exception — if it is part of the look, it is in itemIds and it is wrapped.
- Lead the reasoning with the actual clothing (the dress, or the top and bottom), then layer in shoes, bag, and jewellery — describe the outfit as worn, garments first.
- Do not invent ids.
- Example: "The <<item:i_xyz|ivory silk shirt>> pairs cleanly with the <<item:i_abc|charcoal trouser>>."
Wrap only the piece itself, not the surrounding sentence.

Tags guidance:
- 3 to 5 short labels (1-2 words each, lowercase, no punctuation)
- Mix of: occasion ("dinner", "weekend", "office"), mood ("relaxed", "polished", "playful"), formality ("smart casual", "black tie"), season/weather hint when relevant ("layered", "summer evening")
- Avoid restating the items themselves; tags describe the LOOK, not its parts
- No duplicates, no marketing fluff

Confidence reflects how strongly the available wardrobe matches the intent (100 = perfect fit, 50 = workable but not ideal, low = thin matches).

FINAL SELF-CHECK before you respond — all three must be true, or fix itemIds and retry yourself:
1. itemIds contains a real clothing base: a Dress, OR a Top AND a Bottom. (A look of only shoes/bag/jewellery is invalid.)
2. Every garment and accessory named in the reasoning is in itemIds and wrapped as <<item:ID|name>> — including the main garment.
3. Nothing in itemIds is left unnamed in the reasoning, and nothing named in the reasoning is missing from itemIds.`;

  // Run the model and parse. Pulled into a helper so we can re-run with a
  // correction if the first attempt comes back without a clothing base.
  const runOnce = async (promptText, temp) => {
    const text = await geminiText(promptText, { temperature: temp, jsonMode: true, responseSchema: OUTFIT_RESPONSE_SCHEMA }, 'suggest-look');
    let p;
    try { p = JSON.parse(text); } catch { throw new Error('The Concierge replied in an unexpected format'); }
    if (!p.itemIds?.length) throw new Error('The Concierge could not compose a look from this wardrobe');
    return p;
  };

  // CODE-LEVEL COMPLETENESS GUARD — defense in depth. The prompt already demands
  // a full clothing base, but the model intermittently names a garment in the
  // prose (e.g. "the black linen shirt dress") yet omits its id from itemIds —
  // leaving a look of pure accessories with no actual clothes. Two layers:
  //   1. Re-compose once with a stern correction (and a nudge up in temperature
  //      to break the failure mode) when the first attempt lacks a base.
  //   2. ensureClothingBase — a DETERMINISTIC final backstop. If the model and
  //      its retry both fail, it recovers the garment the model named in its own
  //      prose (the accessories were chosen for it), or injects a
  //      weather-appropriate base. The user never sees an accessories-only look.
  const baseOk = (ids) => hasClothingBase(ids, items);

  let parsed = await runOnce(prompt, temperature);
  if (!baseOk(parsed.itemIds)) {
    const correction = `${prompt}

CRITICAL CORRECTION — your previous attempt is INVALID: it returned a look with NO clothing base (no dress, or a top without a bottom / a bottom without a top). A look of only accessories is a hard failure. Re-compose now. itemIds MUST contain the actual garment(s): EITHER one Dress, OR BOTH a Top AND a Bottom, drawn from the wardrobe list. Before you respond, read back your own itemIds and confirm a real garment is present.`;
    try {
      const retry = await runOnce(correction, Math.min(0.9, temperature + 0.1));
      if (baseOk(retry.itemIds)) parsed = retry;
    } catch { /* keep the first attempt if the retry itself errors */ }
  }

  // Final deterministic guarantee — recovers from prose or injects a base so an
  // accessories-only look can never reach the user, even if the model fails twice.
  if (!baseOk(parsed.itemIds)) {
    const fixed = ensureClothingBase(
      { itemIds: parsed.itemIds, reasoning: parsed.reasoning },
      items,
      { weather, season },
    );
    parsed.itemIds = fixed.itemIds;
  }

  // Deterministic slot cap — runs AFTER the base backstop so a base it injected
  // is never trimmed away. Nothing above this catches a slot violation:
  // hasClothingBase is satisfied by a top + three bottoms, so the retry and
  // ensureClothingBase both pass it straight through to the user.
  const { kept, dropped } = trimToOnePerSlot(parsed.itemIds, items);
  if (dropped.length) {
    parsed.itemIds = kept;
    parsed.reasoning = unwrapMarkers(parsed.reasoning, dropped);
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags
        .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return { ...parsed, tags };
}

// Gemini Vision: read a care/composition label photo. Pulls brand, materials,
// size, colour, care instructions, and any barcode digits. Used by the "Scan
// Label" entry point on Add Item to pre-fill the form before the user reviews.
// Materials are mapped to the app's MATERIALS vocabulary so chips light up.
// Gemini Vision: look at a photo of a clothing item (as you'd shoot it
// hanging in your wardrobe or laid flat) and identify everything visible.
// Returns a draft suitable for pre-filling the Add Item form. The single
// highest-leverage import path — one tap, one photo, form ready.
export async function identifyItemWithGemini({ imageDataUrl, knownBrands = [] }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  const knownMaterials = ALL_MATERIALS.filter((m) => m !== 'Other').join(', ');
  const knownColors = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : []).join(', ');
  const knownStyles = (typeof STYLES !== 'undefined' ? STYLES : []).join(', ');
  const cats = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

  const prompt = `You are a personal stylist's assistant identifying a single clothing item from a photograph. The user wants to add it to their digital wardrobe — pre-fill as many fields as you confidently can.

Look at the photo and identify:
- The item's CATEGORY — must be exactly one of: ${cats.join(', ')}.
- Sub-category (only if clearly identifiable). For tops: T-Shirts, Blouses, Shirts, Sleeveless, Jumpers, Sweaters, Cardigans, Hoodies, Sweatshirts, Vests. For outerwear: Blazers, Coats, Jackets, Trench Coats, Puffer Jackets, Parkas, Capes, Gilets, Leather Jackets. For dresses: Mini, Midi, Maxi, Wrap, Shift, Bodycon, Shirt Dress, Knit Dress, Cocktail, Evening / Gown, Sundress, Slip Dress. For shoes: Sneakers, Sandals, Wedges, Loafers, Heels, Ankle Boots, Boots, Flats. For bags: Handbag, Crossbody, Tote, Clutch, Backpack, Weekend, Wallet. For accessories: Sunglasses, Sun Hats, Hats, Belts, Scarves, Gloves. For jewellery: Necklaces, Pendants, Earrings, Rings, Bracelets, Watches, Brooches. For swimwear: Bikini, Swimsuit, Tankini, Bandeau, Swim Shorts, Cover-up, Kaftan, Sarong, Beach Dress, Rash Vest.
- Brand — if a logo or visible tag identifies it. Prefer matches from: ${knownBrands.slice(0, 20).join(', ') || 'any known brand'}. Leave empty if uncertain.
- Suggested name — short, descriptive: "[colour] [silhouette/cut] [item type]", e.g. "Navy wool blazer", "Cream silk slip dress", "Tan leather crossbody".
- Colours visible — array, mapped to: ${knownColors}. Include 1-3 dominant colours. If a colour is unusual ("sage", "rust"), pick its closest family ("Green", "Orange").
- Material best guess from: ${knownMaterials}. Pick materials appropriate to the CATEGORY — metals/stones (gold, silver, pearl, diamond) for Jewellery; leather/suede/canvas/etc. for Shoes & Bags; fabrics for garments. Only include if highly confident from visual texture (knit, denim weave, leather sheen, silk drape, metal/stone, etc).
- Style tags from: ${knownStyles}. Pick the 1-3 best-fitting moods.
- Season suitability: array from Spring, Summer, Autumn, Winter. Include all that genuinely fit (a wool coat = Autumn + Winter; a linen dress = Spring + Summer).
- A 1-sentence description noting silhouette, fit, or distinctive detail.
- Confidence score 0-100 — your overall certainty about the identification.

Respond ONLY with valid JSON in this exact shape:
{
  "category": "string",
  "subCategory": "string or empty",
  "brand": "string or empty",
  "name": "string",
  "colors": ["array of canonical colour names"],
  "materials": ["array of canonical material names"],
  "styles": ["array of canonical style names"],
  "seasons": ["array of season names"],
  "description": "string",
  "confidence": 0
}`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.2, jsonMode: true }, 'identify-item');
  if (!text) throw new Error('The Concierge did not respond');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The Concierge replied in an unexpected format'); }
  return parsed;
}

export async function analyzeLabelWithGemini({ imageDataUrl }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  const knownMaterials = ALL_MATERIALS.filter((m) => m !== 'Other').join(', ');
  const knownColors = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : []).join(', ');

  const prompt = `You are reading a clothing care label, brand tag, or product barcode label.

Extract everything visible:
- Brand name (often the largest text or the logo).
- Product name if present on a hang-tag (e.g. "Sienna Cropped Blazer"). Empty if not visible.
- Material composition — translate to one or more of these known materials: ${knownMaterials}. Use exact spelling. Include only materials clearly present (≥10% composition or main fibre).
- Size (e.g. "M", "10", "EU 38", "32R").
- Colour name if printed. Prefer one of these canonical families when possible: ${knownColors || 'any short name'}. If the label says "Navy Blue" return "Navy"; if it says "Stone" return "Beige".
- Care symbols / instructions. For each, output the closest match from this fixed list when applicable: ${CARE_TAGS.join(', ')}. If a phrase has no good match, include the original short text. One short phrase per array entry.
- Barcode digits if a barcode (UPC/EAN) is visible — digits only, no formatting.
- Product code / style number if visible (e.g. "1234567-001").

Respond ONLY with valid JSON in this exact shape:
{
  "brand": "string or empty",
  "productName": "string or empty",
  "size": "string or empty",
  "color": "string or empty",
  "materials": ["array of known materials, exact spelling"],
  "care": ["array of short instruction phrases"],
  "barcode": "digits only or empty",
  "productCode": "string or empty",
  "notes": "anything else worth keeping, or empty"
}`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.1, jsonMode: true }, 'analyze-label');
  if (!text) throw new Error('The Concierge did not respond');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The Concierge replied in an unexpected format'); }
  return parsed;
}

// Gemini Vision: extract line-items from a receipt screenshot or order
// confirmation. Returns the same { brand, purchasedDate, purchasedFrom, items }
// shape as the text-based parseReceiptText, so the modal flow stays unified.
export async function analyzeReceiptImageWithGemini({ imageDataUrl }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  const prompt = `You are reading a clothing-purchase receipt or order confirmation screenshot.

Extract:
- Each line-item purchased: the product name, the brand if shown (often the same as the retailer), and the price as a plain number (no currency symbol).
- The retailer/brand name overall (e.g. "COS", "Holland Cooper", "Net-a-Porter").
- The purchase date in YYYY-MM-DD if visible.

Ignore: postage / shipping / discount / tax lines.

Respond ONLY with valid JSON in this exact shape:
{
  "brand": "string or empty",
  "purchasedDate": "YYYY-MM-DD or empty",
  "purchasedFrom": "string or empty",
  "items": [
    { "name": "string", "brand": "string or empty", "price": number }
  ]
}`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.2, jsonMode: true }, 'analyze-receipt');
  if (!text) throw new Error('The Concierge did not respond');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The Concierge replied in an unexpected format'); }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) throw new Error('No items found in this image.');
  return parsed;
}

// Gemini wardrobe-gap audit. Distils items into category/style/colour/season
// counts and asks Gemini for a balance critique: what's over-represented,
// what's missing, and the 3 highest-leverage additions to buy next.
// Returns { strengths, gaps, recommendations, missingPieces }.
export async function analyzeWardrobeGapsWithGemini({ items, inspirations = [] }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  const owned = items.filter((i) => i.status === 'owned');
  if (owned.length === 0) throw new Error('Add some owned items first.');

  // Compact aggregate summary (counts only — never send full inventory).
  const count = (key, getter) => {
    const m = {};
    for (const i of owned) {
      const v = getter(i);
      if (Array.isArray(v)) for (const x of v) m[x] = (m[x] || 0) + 1;
      else if (v) m[v] = (m[v] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(', ') || 'none';
  };
  const byCategory = count('category', (i) => i.category);
  const bySubCategory = count('subCategory', (i) => i.subCategory);
  const byStyle = count('style', (i) => itemStyles(i));
  const byColor = count('color', (i) => itemColors(i));
  const bySeason = count('season', (i) => itemSeasons(i));
  const byMaterial = count('material', (i) => itemMaterials(i));
  const wornNever = owned.filter((i) => itemWearCount(i) === 0).length;
  const priceTotal = owned.reduce((s, i) => s + Number(i.price || 0), 0);
  const wishlistReasons = items
    .filter((i) => i.status === 'wishlist' && i.wishlistReason)
    .map((i) => `- ${i.name}${i.brand ? ` (${i.brand})` : ''}: ${i.wishlistReason}`)
    .slice(0, 15);

  const prompt = `You are a senior personal stylist auditing a client's wardrobe for balance and gaps.

The client has ${owned.length} owned items (total spend £${priceTotal.toLocaleString()}), of which ${wornNever} have never been worn.

Wardrobe composition:
- By category: ${byCategory}
- By sub-category: ${bySubCategory}
- By style: ${byStyle}
- By colour: ${byColor}
- By season: ${bySeason}
- By material: ${byMaterial}
${wishlistReasons.length ? `\nWishlist intent (purposes the client has set):\n${wishlistReasons.join('\n')}` : ''}
${(inspirations || []).filter((i) => i.analysis?.summary).slice(0, 8).length
  ? `\nSaved inspirations (looks the client is drawn to — recommendations should align with these):\n${(inspirations || []).filter((i) => i.analysis?.summary).slice(0, 8).map((i) => `- ${i.caption || 'Untitled'}: ${i.analysis.summary}`).join('\n')}`
  : ''}

Audit rules:
- Be specific and quantitative ("11 tops vs 2 bottoms suggests…") — never generic.
- Identify 2-3 STRENGTHS (well-built parts of the wardrobe).
- Identify 2-4 GAPS (imbalances or missing essentials), each with a one-line reason grounded in the numbers.
- Suggest 3 high-leverage RECOMMENDATIONS — specific pieces to add (category + colour + style hint, e.g. "a tailored navy blazer in wool"). Avoid duplicates of what's already over-represented.
- Tone: warm, direct, premium-stylist. UK English.

Respond ONLY with valid JSON in this exact shape:
{
  "strengths": [{"title": "string", "detail": "string"}],
  "gaps": [{"title": "string", "detail": "string"}],
  "recommendations": [{"piece": "string", "why": "string"}]
}`;

  const text = await geminiText(prompt, { temperature: 0.5, jsonMode: true }, 'wardrobe-gap');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The Concierge replied in an unexpected format'); }
  return parsed;
}

// Gemini Vision: analyze an inspiration outfit photo and cross-reference against
// the user's wardrobe. Returns garments visible, matching items, and gaps.
export async function analyzeInspirationWithGemini({ imageDataUrl, items }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!imageDataUrl) throw new Error('No image to analyze.');

  // Richer wardrobe summary — include subcategory, materials, and styles
  // so the model has more signal to match. Cap at 500 (was 120) — below
  // that ceiling every owned item must be visible to matching, or a
  // genuinely-owned piece past the cutoff gets silently treated as missing.
  const wardrobeSummary = items.slice(0, 500).map((i) => {
    const cat = i.subCategory ? `${i.category}/${i.subCategory}` : i.category;
    const colours = itemColors(i).join(',') || '-';
    const styles = itemStyles(i).join(',') || '-';
    return `${i.id}|${i.name}|${i.brand || '?'}|${cat}|colors=${colours}|styles=${styles}`;
  }).join('\n');

  const prompt = `You are an expert stylist analyzing an inspiration outfit photo against a specific user's wardrobe.

YOUR TASK:
For EACH visible garment in the inspiration photo, decide whether the user OWNS something close enough to wear, OR is MISSING a piece they would need to buy.

MATCHING RULES (be GENEROUS — the user owns very few near-perfect matches; close is the target):
- Same broad category is a HARD requirement that the "be generous" guidance below never overrides — a belt is never a match for a bag, a shoe is never a match for a boot, a bracelet is never a match for a necklace, even when the colour and material are identical. Generosity applies WITHIN a category (a slightly different silhouette, a close colour, a similar style) — never across categories. A category mismatch is always "missing", never a low-confidence match.
- When multiple owned items in the SAME category could plausibly match, prefer the closest SUBTYPE (e.g. a "chain link bracelet" should match an owned chain bracelet over an owned cuff bracelet, if both exist in the wardrobe list) — do not settle for a same-category-but-wrong-subtype match when a better subtype match is available.
- Compatible colour FAMILY (cream/ivory/white are interchangeable; navy/dark blue interchangeable; tan/camel/cognac interchangeable)
- Compatible silhouette when both have silhouette info (loose fits loose, tailored fits tailored)
- If the inspiration garment is generic (e.g. "white shirt") and the wardrobe has a "white linen shirt" or "white silk shirt" — that IS a match. The garment description does not need to be exact.
- When in doubt about SILHOUETTE, COLOUR, or SUBTYPE (never about CATEGORY), MATCH rather than mark missing. A user with a wardrobe of 100+ pieces almost always has a stand-in for any common item. Listing things as missing that they functionally own is the WORST failure mode — but a wrong-category match is worse still, since it tells the user they own something they do not.

EXAMPLES of what counts as a match:
- Inspiration "white linen button-down" + Wardrobe "Sleeveless Amalfi Linen Shirt" (White, by Holland Cooper) → MATCH (both white, both linen, both Tops)
- Inspiration "tailored navy trousers" + Wardrobe "Slim Fit Stretch Chinos" (Navy, by Ralph Lauren) → MATCH (both Bottoms, both navy, both tailored-ish)
- Inspiration "leather loafer" + Wardrobe "Barnsbury Driver Shoe" (Tan, by Ralph Lauren) → MATCH (both Shoes/Loafers, compatible colour)
- Inspiration "gold cuff bracelet" + Wardrobe "MV Siren Muse Bold Cuff" (Gold, by Monica Vinader) → MATCH (both Jewellery/Cuffs, both gold)

BRAND IDENTIFICATION (be conservative):
- For each garment, set "brand_guess" ONLY if you can clearly identify the brand from a visible logo, signature design element, or extremely distinctive style (e.g. a Cartier Tank watch, Chanel quilted bag with CC clasp, Bottega Veneta intrecciato weave).
- If uncertain — even slightly — leave brand_guess as null. Wrong brand guesses are worse than no guess.

CRITICAL RULE — NO DOUBLE-DIPPING:
If you matched a garment to a wardrobe item, do NOT also list it as missing. Every garment in the inspiration must be EITHER matched OR missing, never both.

COMPLETION VERDICT:
Write one calm, editorial line judging how much of THIS look the user could wear today from pieces they already own, based on the garments you just matched above. No score, no percentage, no price, no currency, no exclamation marks — speak only in terms of pieces owned vs missing.
- All garments matched: "You already own this look."
- One garment missing: "One piece would complete this."
- Several missing, some matched: "Two pieces would complete this." / "A different direction for you, but three pieces in."
- Nothing matched: "Nothing here yet from your wardrobe."
Ground the line in the exact garments you just listed — never state or imply a count separately from what they show.

User's wardrobe (id|name|brand|category|colors|styles):
${wardrobeSummary}

Respond ONLY with valid JSON in this exact shape:
{
  "garments": [
    {
      "category": "Tops|Bottoms|Outerwear|Dresses|Shoes|Bags|Accessories|Jewellery",
      "description": "white silk sleeveless shirt",
      "color": "white",
      "brand_guess": "brand name or null — see brand identification rules above",
      "matchedItemId": "id_xyz_or_null",
      "matchConfidence": "high|medium|low or null — only set when matchedItemId is set",
      "buyingNote": "string or null — only when matchedItemId is null. Include a brand-or-style suggestion when useful (e.g. 'a tailored navy blazer with peak lapels — Ralph Lauren or Theory style'). When matchedItemId is set with confidence medium or low, you MAY instead include a note of the form 'you have a similar piece but the inspiration\\'s is [more relaxed / more cropped / different material]' only if the difference is meaningful — otherwise leave null."
    }
  ],
  "completionVerdict": "one calm line — see COMPLETION VERDICT rules above",
  "summary": "2-3 sentences describing the overall look — its atmosphere, what makes it cohesive, the kind of moment it suggests. Editorial voice, like a stylist captioning the page in a magazine. Avoid generic words like 'stylish', 'chic', 'fresh' — reach for specificity."
}

Rules for the response:
- One object per visible garment in the inspiration.
- matchedItemId MUST be an exact id from the wardrobe list above, or null if no match.
- When matchedItemId is set: matchConfidence MUST be 'high', 'medium', or 'low'. buyingNote is optional (null unless you want to note a meaningful difference).
- When matchedItemId is null: matchConfidence MUST be null. buyingNote MUST be a short specific suggestion (<=90 chars).
- brand_guess is independent of matching — you can guess a brand on the inspiration whether or not the user owns something matching.
- Never invent ids. Never list the same id twice.
- completionVerdict must be consistent with the garments array you return in THIS SAME response: judge how many of exactly those garments are matched vs missing. Never mention price or money.`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.2, jsonMode: true }, 'inspiration-analysis');
  if (!text) throw new Error('The Concierge could not analyse this photo');
  const parsed = JSON.parse(text);

  // Derive the legacy shape from the new structure so existing consumers
  // (the UI that renders wardrobeMatchIds / missingPieces) don't need
  // updates yet. Mutual exclusion is now enforced by the per-garment
  // matchedItemId being null XOR set.
  const garments = Array.isArray(parsed.garments) ? parsed.garments : [];
  const wardrobeMatchIds = [];
  const missingPieces = [];
  for (const g of garments) {
    if (g.matchedItemId && typeof g.matchedItemId === 'string') {
      // Verify the id exists AND that its category matches the garment's
      // stated category before trusting the match. The model's own bias
      // toward avoiding "missing" can otherwise produce cross-category
      // matches (e.g. a belt matched to a bag) at low confidence — this is
      // a hard rule in the prompt too, but checked here in code since it's
      // mechanically verifiable and must never depend on the model alone.
      const matchedItem = items.find((i) => i.id === g.matchedItemId);
      const sameCategory = matchedItem && String(matchedItem.category || '').trim().toLowerCase() === String(g.category || '').trim().toLowerCase();
      if (sameCategory) {
        wardrobeMatchIds.push(g.matchedItemId);
        continue;
      }
    }
    // Otherwise treat as missing — prefer the model's buyingNote, fallback to description
    const note = g.buyingNote || g.description;
    if (note) missingPieces.push(note);
  }

  // Derived deterministically from the already-validated match list, not
  // from the model — piecesOwned/piecesMissing can never drift from the
  // garments actually shown, unlike a count the model states separately.
  // Uses missingPieces.length (not the deduped wardrobeMatchIds set) so the
  // count stays consistent even if the model mistakenly matches two
  // different garments to the same wardrobe id — each garment is still
  // counted individually, matching what the garment list itself will show.
  const dedupedMatchIds = [...new Set(wardrobeMatchIds)];
  return {
    garments,                                  // new shape (preferred)
    wardrobeMatchIds: dedupedMatchIds,
    missingPieces,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    completionVerdict: typeof parsed.completionVerdict === 'string' ? parsed.completionVerdict : '',
    piecesOwned: garments.length - missingPieces.length,
    piecesMissing: missingPieces.length,
  };
}

export async function generateOutfitNameWithGemini(picked, intent) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!picked || picked.length === 0) throw new Error('Pick at least one piece first.');
  const itemList = picked
    .map((p) => [p.brand, p.category, p.subCategory, p.name].filter(Boolean).join(' '))
    .filter(Boolean)
    .slice(0, 8)
    .join('\n- ');
  const briefLine = (intent && intent.trim() && intent !== 'Any')
    ? `The user's brief: "${intent.trim()}"\n\nUse that brief to anchor the name — echo a place, a moment, a mood from it. The name should feel like the editor's title for THIS specific brief, not a generic stylist label.`
    : `No specific brief — name the look as a self-contained editorial piece.`;

  const prompt = `You are an editorial fashion stylist titling a saved look for Atelier, a private digital wardrobe.

Give it a SHORT but evocative name: 3 to 6 words, title case, no quotes, no full stops, no emoji.

Voice: like a couturier captioning a piece for a private client — refined, considered, a little romantic. Reach for atmosphere over function: a place, a time of day, a weather, a mood, a moment. Avoid stylist clichés ("Effortless Chic", "Smart Casual", "Power Move"). Avoid restating the items.

${briefLine}

Items in this look:
- ${itemList}

Examples of the tone wanted (note the rhythm, not the words):
- "Storm Light at the Lido"
- "Mayfair Hour, Late Spring"
- "Quiet Power, Quiet Wool"
- "Gallery Opening in Linen"
- "Sunday Coffee, Slow Sunday"
- "Black Tie at the Sea"

Reply with the name ONLY — no preamble, no explanation, no quotes.`;
  const result = await geminiText(prompt, { temperature: 0.9 }, 'name-look');
  return (result || '')
    .trim()
    .split('\n')[0]
    .replace(/^["'`]+|["'`.,!?]+$/g, '')
    .slice(0, 40);
}

// generateOutfitTagsWithGemini — generate 3-5 descriptive tags for a
// saved outfit. Mirrors the tag-emission rule from generateOutfitWithGemini
// (Stylist) so the vocabulary is consistent between auto-generated and
// AI-composed looks. Returns a string[] (empty on any failure — caller
// decides how to handle; never throws to the UI).
export async function generateOutfitTagsWithGemini(picked, intent = '') {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!picked || picked.length === 0) return [];
  const itemList = picked
    .map((p) => [p.brand, p.category, p.subCategory, p.name].filter(Boolean).join(' '))
    .filter(Boolean)
    .slice(0, 8)
    .join('\n- ');
  const prompt = `You are tagging a saved outfit for an editorial wardrobe app called Atelier.

Return 3 to 5 short descriptive labels covering occasion, mood, formality, season hint.

Rules:
- Lowercase, no punctuation, 1-2 words each
- Mix categories — don't return five tags all describing occasion
- Avoid restating items themselves
- No marketing fluff ("stylish", "chic", "trendy")

Items in this look:
- ${itemList}

${intent && intent !== 'Any' ? `Style intent: ${intent}\n\n` : ''}Respond ONLY with valid JSON of the shape: {"tags": ["...","..."]}`;

  const result = await geminiText(prompt, { temperature: 0.6, jsonMode: true }, 'backfill-tags');
  try {
    const parsed = JSON.parse(result);
    if (!Array.isArray(parsed.tags)) return [];
    return parsed.tags
      .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

// generateWearNarration — when the user logs a wear with a photo, ask
// Gemini for ONE evocative memory line in the voice of a personal stylist
// keeping a journal. Stored on wornPhotos[i].caption and rendered as an
// italic pull quote in the Diary alongside the photo.
//
// Returns null on any failure — narration is purely additive flavour; if
// the AI is unavailable or rate-limited, the photo just goes in without
// a caption (no error surfaced to user).
export async function generateWearNarration({ outfit, intent = '', eventName = '', dateISO, itemNames = [] }) {
  if (!isAIEnabled()) return null;
  try {
    const d = new Date(dateISO + 'T00:00:00');
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const monthDay = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const pieces = itemNames.slice(0, 6).join(', ');
    const prompt = `You are a personal stylist keeping a private journal for your client. Write ONE evocative memory line for today's wear — no more than 90 characters, no quotes, no preamble.

The line should evoke the day's mood and how the look felt. Avoid generic praise ("looked great", "stunning"). Lean concrete: weather, occasion, a tactile note, a small observation. Match a tone of quiet luxury.

Today: ${weekday} ${monthDay}
Look: "${outfit?.name || 'Untitled'}"${intent ? ` (styled for ${intent})` : ''}${eventName ? ` · ${eventName}` : ''}
Pieces: ${pieces || '—'}

Examples of the tone wanted:
- A bright Thursday, linen-light and unhurried.
- A late lunch on the terrace; the navy did most of the work.
- Soft city wear for a meeting that ran long but felt easy.
- The kind of look that means business without saying so.

Reply with the line only.`;
    const result = await geminiText(prompt, { temperature: 0.85 }, 'narrate-day');
    if (!result) return null;
    return result.trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').slice(0, 110);
  } catch {
    return null;
  }
}

// generateStyleFitWithGemini — generates a short narrative tying a
// saved outfit to the user's style manifesto / profile. The result is
// persisted on outfit.styleFit so re-opening the detail view doesn't
// re-call. Returns the narrative string or null on failure.
export async function generateStyleFitWithGemini({ outfit, picked, manifesto = '', styleProfile = '' }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!picked || picked.length === 0) return null;
  const itemList = picked
    .map((p) => [p.brand, p.color, p.category, p.subCategory, p.name].filter(Boolean).join(' '))
    .filter(Boolean)
    .slice(0, 10)
    .join('\n- ');
  const profileBlock = manifesto
    ? `\nThe client's style manifesto:\n${manifesto.slice(0, 800)}\n`
    : styleProfile
    ? `\nThe client's style profile: ${styleProfile.slice(0, 400)}\n`
    : '\nNo style manifesto saved yet — read the look as a self-contained piece.\n';
  const prompt = `You are an editorial fashion stylist writing a private note to the client about how a specific saved look fits THEIR style.

Items in this look:
- ${itemList}
${profileBlock}
Write 2-3 sentences (max 60 words). Voice: warm, considered, like a couturier captioning the look in a private dossier. Reference one or two specific pieces from the list and tie them to the manifesto's themes (or to the look's own atmosphere if no manifesto). Avoid clichés ("This look is perfect for..."), avoid the words "stylish" or "trendy". No bullets, no headings, just prose.

Reply with the narrative only — no preamble, no quotes.`;
  const result = await geminiText(prompt, { temperature: 0.75 }, 'style-fit');
  if (!result) return null;
  return result.trim().split('\n').filter(Boolean).join(' ').replace(/^["'`]+|["'`]+$/g, '');
}

// Judge how well a single item fits the user's style. Returns the normalised
// fit object: { verdict, coherence, aspiration, tier, dimensions, basis }.
export async function generateItemFitWithGemini({ item, manifesto, inspirations = [], styleProfile = '' }) {
  if (!manifesto) throw new Error('Generate your Style Manifesto first to unlock fit readings.');
  const basis = selectAspirationBasis(inspirations);
  const inspirationsSummary = basis === 'inspirations'
    ? inspirations
        .filter((i) => i && i.analysis && i.analysis.summary)
        .slice(0, 12)
        .map((i) => `- ${i.caption || 'saved'}: ${i.analysis.summary}`)
        .join('\n')
    : '';
  const prompt = buildItemFitPrompt({
    itemLine: buildItemSummaryLine(item),
    manifesto,
    inspirationsSummary,
    styleProfile,
    basis,
  });
  const text = await geminiText(prompt, { temperature: 0.6, jsonMode: true, responseSchema: FIT_RESPONSE_SCHEMA }, 'item-fit');
  return parseAndNormalizeFit(text, { basis });
}

// AI fit estimate for a wishlist item — replaces the manual per-brand size-chart
// approach. Reasons from the user's body measurements AND, most importantly,
// from items they ALREADY OWN from the same brand (whose sizes demonstrably fit
// them). `ownedSameBrand` is [{ category, subCategory, name, size }]. Returns
// { verdict, recommendation, confidence } or null.
export async function generateFitEstimateWithGemini({ item, measurements = {}, ownedSameBrand = [] }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!item?.brand) return null;
  const m = measurements || {};
  const bodyBits = [
    m.height ? `height ${m.height}cm` : null,
    m.weight ? `weight ${m.weight}kg` : null,
    m.chest ? `chest/bust ${m.chest}cm` : null,
    m.waist ? `waist ${m.waist}cm` : null,
    m.hips ? `hips ${m.hips}cm` : null,
    m.shoeSize ? `usual shoe size ${m.shoeSize}` : null,
  ].filter(Boolean).join(', ') || 'no body measurements recorded';

  // Same-category owned pieces are the strongest signal; list them first.
  const sameCat = ownedSameBrand.filter((o) => o.category === item.category);
  const otherCat = ownedSameBrand.filter((o) => o.category !== item.category);
  const ownedList = [...sameCat, ...otherCat]
    .slice(0, 12)
    .map((o) => `- ${o.category}${o.subCategory ? '/' + o.subCategory : ''} "${o.name}" — size ${o.size}`)
    .join('\n');

  const ownedBlock = ownedSameBrand.length
    ? `WHAT THEY ALREADY OWN FROM ${item.brand} (these sizes already fit them — this is your STRONGEST signal, weight same-category matches the most):
${ownedList}
Reason from these: if a ${item.brand} ${item.category} in a known size fits them, infer whether labelled size "${item.size || '?'}" of this new piece will sit looser, tighter, or the same.`
    : `They own nothing from ${item.brand} yet, so reason from general knowledge of how ${item.brand} and this garment type typically run, plus their body measurements. Be candid that confidence is lower without owned references.`;

  const prompt = `You are a precise, honest fit advisor for a personal wardrobe app. Estimate how a wishlist garment will fit this person and give ONE practical sizing recommendation.

GARMENT THEY ARE CONSIDERING:
- ${item.brand} ${item.name || ''}
- category: ${item.category}${item.subCategory ? '/' + item.subCategory : ''}
- labelled size: ${item.size || '(no size recorded — note this in the recommendation)'}

THEIR BODY: ${bodyBits}

${ownedBlock}

RULES:
- Be honest about uncertainty. If you genuinely cannot tell, verdict = "unsure".
- verdict ∈ "runs small" | "true to size" | "runs large" | "unsure" (how this BRAND/garment runs, not whether they should buy it).
- recommendation: ONE practical sentence, max 160 chars, e.g. "Your other Holland Cooper trousers are a 10 and fit, so this 12 will sit a touch loose — size down for a tailored look."
- confidence (0-100): high only when same-brand same-category owned pieces anchor it; low when reasoning from body measurements alone.

Respond ONLY with JSON: {"verdict": "...", "recommendation": "...", "confidence": 0}`;

  const text = await geminiText(prompt, { temperature: 0.4, jsonMode: true }, 'fit-estimate');
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!parsed?.recommendation) return null;
  return {
    verdict: typeof parsed.verdict === 'string' ? parsed.verdict : 'unsure',
    recommendation: String(parsed.recommendation),
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
  };
}

// ── The Considered Purchase ────────────────────────────────────────────────
// Score a piece the user is thinking of buying AGAINST their real wardrobe:
// how many new outfits it unlocks, what it duplicates, its likely cost-per-wear,
// fit risk, and whether it fills a gap — ending in a calm buy/wait/skip verdict.
// The moat feature: only Atelier can answer this, because only Atelier holds the
// user's owned wardrobe. See docs/superpowers/specs/2026-07-13-the-considered-purchase-spec.md
const CONSIDERED_PURCHASE_SCHEMA = Schema.object({
  properties: {
    verdictLine: Schema.string(),
    recommendation: Schema.string(),
    outfitsUnlocked: Schema.number(),
    overlaps: Schema.array({ items: Schema.string() }),
    predictedCostPerWear: Schema.string(),
    fitNote: Schema.string(),
    gapNote: Schema.string(),
    reasoning: Schema.string(),
  },
});

export async function scorePurchaseWithGemini({ item, items = [], measurements = {} }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!item) return null;

  const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
  const wardrobe = owned.slice(0, 120).map((i) => {
    const cat = i.subCategory ? `${i.category}/${i.subCategory}` : i.category;
    return `${i.name}|${i.brand || '?'}|${cat}|colors=${itemColors(i).join(',') || '-'}|styles=${itemStyles(i).join(',') || '-'}`;
  }).join('\n');

  const cat = item.subCategory ? `${item.category}/${item.subCategory}` : item.category;
  const price = item.price != null && item.price !== '' ? `£${item.price}` : '(no price recorded)';
  const m = measurements || {};
  const body = [
    m.height && `height ${m.height}cm`, m.chest && `chest/bust ${m.chest}cm`,
    m.waist && `waist ${m.waist}cm`, m.hips && `hips ${m.hips}cm`,
  ].filter(Boolean).join(', ') || 'no body measurements recorded';

  const prompt = `You are a warm, numerate wardrobe advisor for a "considered wardrobe" app. You are NOT anti-shopping — a considered wardrobe still grows, and part of your job is to give people confidence in a good buy. You are honest about genuine duplication or poor value, but your default posture is encouraging.

THE PIECE BEING CONSIDERED:
- ${item.name || 'Unnamed piece'}${item.brand ? ' · ' + item.brand : ''}
- category: ${cat}
- price: ${price}
- colours: ${itemColors(item).join(', ') || '—'}${item.materials?.length ? `\n- materials: ${item.materials.join(', ')}` : ''}

THEIR BODY: ${body}

THEY ALREADY OWN (name|brand|category|colors|styles):
${wardrobe || '(their wardrobe is empty)'}

Judge this piece for THIS person, weighing four things together:
- Taste fit: does it suit the palette, styles and spirit of the wardrobe they have built? A strong taste fit is a real point in its favour — if it is unmistakably "them", say so.
- What it unlocks: outfitsUnlocked = roughly how many complete outfits (a dress, OR a top + bottom, plus optional shoes/accessory) it would work in with pieces they ALREADY own. Count where it genuinely combines; a versatile everyday piece is worth several, a true one-off fewer. Accessories (sunglasses, belts, bags, jewellery) and neutral staples pair with many outfits — never return 0 for a wearable, combinable piece.
- Value: predictedCostPerWear = estimate realistic yearly wears for this category and person, then divide the price.
- Fit & gap: any fit risk (fitNote), and whether it fills a gap or adds to a saturated area (gapNote).

Then choose the recommendation — "buy", "wait", or "skip":
- "buy": it suits them and adds something — a gap filled, a strong taste fit, a good cost-per-wear, or several outfits unlocked. This is the right call for MOST well-chosen pieces; be confident and encouraging.
- "wait": promising, but the timing or value is not quite there — a very similar piece is still going strong, or the cost-per-wear looks high for now.
- "skip": a clear duplicate of something they already own and wear, adding little.

Overlap with what they own is NOT an automatic veto: a clear upgrade, a refresh of a tired staple, or A DIFFERENT COLOURWAY (a tortoiseshell where they own black, a camel where they own navy) is a legitimate addition that extends the wardrobe — lean positive on these. Only call something a duplicate when it is genuinely the same piece in the same colour family. Never contradict a genuine taste match — if it truly suits them, let the verdict reflect that warmth even while noting any overlap.

Fields to return:
- verdictLine: a short, warm verdict in the brand's quiet voice, max 4 words, ending in a full stop. It MUST match the recommendation. Buy: "A clear yes." / "This earns its place." / "Buy it well." — Wait: "Worth the wait." / "Nearly, not yet." — Skip: "You have this already." / "Leave it on the rail."
- recommendation: exactly one of "buy", "wait", "skip".
- outfitsUnlocked: an integer.
- overlaps: the plain display NAME only of each owned piece it closely duplicates (e.g. "Black Chanel sunglasses"), or an empty array. Never include brand codes, colours, or the raw pipe-delimited data. Do NOT list a piece here if it is merely a different colour of this one.
- predictedCostPerWear: a MONEY value ONLY, formatted like "£4.20". Never put words, a verdict, or a sentence in this field. Use "—" only when there is genuinely no price.
- fitNote, gapNote: one short sentence each, or "".
- reasoning: ONE elegant, encouraging sentence that fits the verdict.

Respond ONLY as JSON matching the schema.`;

  const text = await geminiText(prompt, { temperature: 0.5, jsonMode: true, responseSchema: CONSIDERED_PURCHASE_SCHEMA }, 'considered-purchase');
  let p;
  try { p = JSON.parse(text); } catch { return null; }
  if (!p?.verdictLine) return null;
  return {
    verdictLine: String(p.verdictLine),
    recommendation: ['buy', 'wait', 'skip'].includes(p.recommendation) ? p.recommendation : 'wait',
    outfitsUnlocked: typeof p.outfitsUnlocked === 'number' ? Math.max(0, Math.round(p.outfitsUnlocked)) : null,
    // Clean names only: strip any leaked "name|brand|cat|colors=…|styles=…"
    // wardrobe-summary formatting down to the display name before the pipe.
    overlaps: Array.isArray(p.overlaps)
      ? p.overlaps
          .filter((x) => typeof x === 'string' && x.trim())
          .map((x) => x.split('|')[0].trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    // Only accept a genuine money value ("£4.20", "4.20"); never a stray
    // sentence the model may have leaked into this field.
    predictedCostPerWear: (typeof p.predictedCostPerWear === 'string' && /^\s*£?\s*\d/.test(p.predictedCostPerWear) && p.predictedCostPerWear.length <= 12)
      ? p.predictedCostPerWear.trim()
      : '—',
    fitNote: typeof p.fitNote === 'string' ? p.fitNote : '',
    gapNote: typeof p.gapNote === 'string' ? p.gapNote : '',
    reasoning: typeof p.reasoning === 'string' ? p.reasoning : '',
  };
}

// generateConciergeReply — multi-turn chat with the user's personal
// stylist. Builds a single prompt that concatenates system context
// (wardrobe inventory, most-worn pieces, style profile, owner name,
// today) + the full conversation history + the next user turn, then
// asks Gemini to play the stylist.
//
// Returns the assistant's reply text. Throws on AI failure so the
// caller can surface a graceful error in the chat thread.
export async function generateConciergeReply({ messages, items = [], outfits = [], styleProfile = '', ownerFirstName = '', calendarEvents = [], onChunk = null }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');

  const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);

  // Most-worn signal — the stylist should know what the user actually
  // reaches for so suggestions feel grounded in lived behaviour.
  const mostWorn = [...owned]
    .map((it) => ({ it, count: itemWearCount(it) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((x) => `${x.it.name} × ${x.count}`)
    .join(', ');

  // Least-worn signal — same guards as the Insights "Stale" panel (owned
  // 90+ days, currently in-season) so a typed "what have I worn least"
  // question doesn't get answered from a brand-new or out-of-season piece.
  const currentSeason = currentSeasonLabel();
  const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
  const leastWorn = [...owned]
    .filter((it) => it.createdAt && new Date(it.createdAt).getTime() < ninetyDaysAgo)
    .filter((it) => {
      const seasons = itemSeasons(it);
      return seasons.length === 0 || seasons.includes(currentSeason);
    })
    .map((it) => ({ it, count: itemWearCount(it) }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 8)
    .map((x) => `${x.it.name} × ${x.count}`)
    .join(', ');

  // Saved outfits the stylist can suggest by name.
  const savedLooks = outfits.slice(0, 30).map((o) => {
    const ct = Object.values(o).filter((v) => v && typeof v === 'object' && (v.id || Array.isArray(v))).length;
    return `"${o.name}"${o.intent ? ` (for ${o.intent})` : ''}`;
  }).join(', ');

  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Recent wears with occasions — empowers the stylist to say "you wore
  // this last to the gallery opening" rather than vague references.
  // Walks every item, picks the most recent 5 wears across the wardrobe
  // that have an occasion noted, formats them for the prompt.
  const recentWearsWithOccasions = (() => {
    const entries = [];
    for (const item of items) {
      if (!item || item.deletedAt) continue;
      const hist = itemWearHistory(item);
      const occasions = itemWearOccasions(item);
      for (const dateISO of hist) {
        const occasion = occasions[dateISO];
        if (occasion) {
          entries.push({
            dateISO,
            occasion,
            itemName: item.name || item.category || 'piece',
            itemId: item.id,
          });
        }
      }
    }
    entries.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    return entries.slice(0, 5);
  })();

  const wearContextsBlock = recentWearsWithOccasions.length > 0
    ? `\nRecent specific wears (use these to make replies concrete — say "you wore this last to the X" when relevant; do NOT invent occasions for items not listed here):
${recentWearsWithOccasions.map((w) => `  - ${w.dateISO}: ${w.itemName} → ${w.occasion}`).join('\n')}\n`
    : '';

  const eventsBlock = calendarEvents.length > 0
    ? (() => {
        // Group events by their LOCAL day so the stylist can dress for a
        // specific day the client asks about ("what should I wear Thursday?"),
        // not just today. en-CA gives a YYYY-MM-DD key for grouping; en-GB
        // gives the human label. All-day events carry a bare date already.
        const byDay = new Map();
        for (const e of calendarEvents) {
          const key = e.allDay ? e.startISO.slice(0, 10) : new Date(e.startISO).toLocaleDateString('en-CA');
          if (!byDay.has(key)) byDay.set(key, []);
          byDay.get(key).push(e);
        }
        // LOCAL today (matches the grouping keys, which are local). Using the
        // UTC todayISO() here would mislabel days near the date boundary.
        const today = new Date().toLocaleDateString('en-CA');
        const days = [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, evs]) => {
            const label = new Date(key + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
            const heading = key === today ? `${label} (today)` : label;
            const items = evs.map((e) => {
              const time = e.allDay ? 'All day' : new Date(e.startISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
              return `  - ${time}: ${e.title}${e.location ? ` (${e.location})` : ''}`;
            }).join('\n');
            return `${heading}:\n${items}`;
          })
          .join('\n');
        const hasTodayEvents = byDay.has(today);
        return `\nON THE CLIENT'S CALENDAR (next 7 days):\n${days}\n\nThe day marked "(today)" is today. When the client asks what to wear on a particular day, dress for THAT day's events only. ${hasTodayEvents ? '' : 'TODAY HAS NO EVENTS LISTED — so if the client asks about "today", treat it as an open day and do NOT borrow another day\'s events or imply that an upcoming day\'s plans are happening today. '}Match formality to the occasion (a board meeting or presentation calls for sharper tailoring than a coffee catch-up). Only reference an event when it's relevant to the wardrobe question; don't shoehorn it in.\n`;
      })()
    : '';

  // Indexed item list — the model uses these IDs to anchor specific
  // mentions. Wrapped in <<item:id|name>> markers so the renderer can
  // swap each marker for an inline thumbnail chip without fuzzy name-
  // matching. We cap at 80 items to keep the prompt small; that's enough
  // coverage for the typical wardrobe size where this matters.
  const itemIndex = items
    .filter((i) => i && !i.deletedAt && (i.status === 'owned' || !i.status))
    .slice(0, 80)
    .map((i) => {
      const display = [i.brand, i.name, i.subCategory || i.category]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 60);
      return `  - ${i.id} | ${display}`;
    })
    .join('\n');

  const chipRule = itemIndex
    ? `\nTHE WARDROBE (live inventory — only suggest from this). When you reference a SPECIFIC piece, wrap it in this exact marker form: <<item:ID|display name>> — picking the id from the indexed list below. Wrap only the piece itself, not the surrounding sentence. Examples:
- Right: "Pair the <<item:i_xyz|ivory silk shirt>> with the <<item:i_abc|charcoal wool trouser>>."
- Wrong: "<<item:i_xyz|Pair the ivory silk shirt>>"
- Wrong: a marker for a piece you can't find in the indexed list — invent neither id nor item.

Indexed wardrobe items (id | display):
${itemIndex}
`
    : '';

  const systemBlock = `You are the personal stylist of ${ownerFirstName || 'the user'}, working from a complete view of their wardrobe. Your voice is warm, considered, decisive. You speak like a trusted couturier — never sycophantic, never corporate. Brief and confident; one short paragraph plus a tidy bullet list when proposing pieces. Avoid filler ("Great question!"), avoid generic style advice. Reference specific pieces by exact name from the inventory below.

Today is ${todayLabel}.
${styleProfile ? `\nThe client's style profile: ${styleProfile}\n` : ''}
${mostWorn ? `\nMOST WORN PIECES: ${mostWorn}` : ''}
${leastWorn ? `\nLEAST WORN (in season, owned 90+ days): ${leastWorn}\nWhen asked what's been worn least, cite ONLY pieces from this exact list — you have no wear-count data for anything else, so never guess or imply that some other item is neglected. Mention 2-4 standout pieces, not the whole list, in the same brief-prose style as any other question — no bulleted enumeration of everything.` : ''}
${savedLooks ? `\nSAVED LOOKS (suggest by name when fitting): ${savedLooks}` : ''}
${chipRule}${wearContextsBlock}${eventsBlock}
When proposing an outfit, format as:
A one-sentence rationale, then:
• [Piece name] — short reason
• [Piece name] — short reason

When asked anything else (critique, packing, advice), reply in 1-3 short paragraphs of natural prose. No headings, no markdown. Keep it under 180 words unless asked for detail.`;

  // Cap history to last 12 messages (6 turns). Prevents unbounded prompt
  // growth as threads age. The model still has full system context above
  // — this just trims redundant chat backlog.
  const trimmedMessages = messages.length > 12 ? messages.slice(-12) : messages;
  const conversationBlock = trimmedMessages.map((m) => `${m.role === 'user' ? 'CLIENT' : 'STYLIST'}: ${m.text}`).join('\n\n');

  const prompt = `${systemBlock}\n\n──────\n\n${conversationBlock}\n\nSTYLIST:`;

  const reply = await geminiTextStream(prompt, { temperature: 0.75 }, 'concierge', onChunk);
  return (reply || '').trim();
}

export async function generateStyleManifestoWithGemini({ items, outfits, inspirations = [], onChunk = null }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
  if (owned.length < 5) throw new Error('Add at least a few items first.');

  // Top 15 most-worn pieces
  const topWorn = [...owned]
    .map((i) => ({ ...i, _w: itemWearCount(i) }))
    .filter((i) => i._w > 0)
    .sort((a, b) => b._w - a._w)
    .slice(0, 15);
  // Recent outfit pairings (last 10)
  const recentOutfits = [...(outfits || [])]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 10);

  const lines = [];
  if (topWorn.length) {
    lines.push('Most-worn pieces:');
    for (const i of topWorn) lines.push(`- ${i._w}× · ${i.name} (${i.brand || '?'}) · ${i.category}${i.subCategory ? '/' + i.subCategory : ''} · colours=${itemColors(i).join(',') || '-'} · styles=${itemStyles(i).join(',') || '-'}`);
  }
  if (recentOutfits.length) {
    lines.push('\nRecent outfits:');
    for (const o of recentOutfits) {
      const ps = resolveOutfitItems(o, items);
      lines.push(`- ${o.name}: ${ps.map((p) => p.name).join(' + ')}`);
    }
  }
  // Inspirations: the looks they SAVE that aren't theirs are pure aspiration
  // signal — feed in summaries so the manifesto captures the gap between what
  // they own and what they reach for.
  const analysed = (inspirations || []).filter((i) => i.analysis?.summary).slice(0, 12);
  if (analysed.length) {
    lines.push('\nSaved inspirations (aspirational):');
    for (const ins of analysed) {
      lines.push(`- ${ins.caption || 'Untitled'}: ${ins.analysis.summary}`);
    }
  }

  const prompt = `You are a senior fashion editor writing a private style brief for one client. Read the data below and write exactly 3 short paragraphs (1-2 sentences each):

1. The client's recurring aesthetic — what their wardrobe is genuinely *about*.
2. The colour and texture story they keep returning to.
3. The TENSION between what they actually wear and what they SAVE as inspiration — what they reach for that they don't yet have. If no inspirations are saved, describe what they avoid by absence instead.

UK English. Warm, observational, specific. No platitudes. No bullet points.

Data:
${lines.join('\n')}`;

  const text = await geminiTextStream(prompt, { temperature: 0.7 }, 'manifesto', onChunk);
  if (!text) throw new Error('The Concierge did not respond');
  return text.trim();
}

// Gemini: one-line observation on a freshly-logged wear. Cheap and cheerful —
// notes the choice in context (weather, recent history, novelty). Fire & forget;
// if the AI is down, the wear still saves.
export async function narrateWearWithGemini({ outfit, items, recentLog, weather }) {
  if (!isAIEnabled()) return '';
  const pieces = resolveOutfitItems(outfit, items);
  if (pieces.length === 0) return '';
  const summary = pieces.map((p) => `${p.name} (${p.category}${p.subCategory ? '/' + p.subCategory : ''}, ${itemColors(p).join('/') || '-'})`).join(' + ');
  const recent = (recentLog || []).slice(-5).map((r) => `${r.date}: ${r.name}`).join('; ') || 'none';

  const prompt = `You are a personal stylist commenting on the user's outfit choice today, in one short observational sentence (under 20 words). UK English. No platitudes ("great look!"). Notice something specific — colour pairing, weather fit, a fresh combination, or a return to a favourite.

Today's outfit: ${summary}
Weather: ${weather ? `${weather.temp}°C, ${weatherLabel(weather.code, weather.precipProb)}${weather.precipProb != null ? ` (${weather.precipProb}% rain chance)` : ''}` : 'unknown'}
Recent wears: ${recent}

Respond with the sentence only, no quotes.`;

  try {
    const text = await geminiText(prompt, { temperature: 0.8 }, 'narrate-wear');
    return (text || '').trim();
  } catch { return ''; }
}

export async function generateTravelCapsuleWithGemini({ items, destination, daily, styleProfile = '', tripType = 'vacation', activities = [], specificPlaces = '' }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!items.length) throw new Error('Add some owned items first.');

  const summarize = (i) =>
    `${i.id}|${i.name}|${i.brand || '?'}|${i.category}${i.subCategory ? '/' + i.subCategory : ''}` +
    `${i.favorite ? '|★FAVOURITE' : ''}` +
    `|styles=${itemStyles(i).join(',') || '-'}` +
    `|colors=${itemColors(i).join(',') || '-'}` +
    `|seasons=${itemSeasons(i).join(',') || 'any'}` +
    `|materials=${itemMaterials(i).join(',') || '-'}`;

  const forecastLines = daily.map((d) => {
    if (d.estimated) {
      const monthName = new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long' });
      return `- ${d.date}: (beyond 14-day forecast — use typical ${monthName} climate at the destination)`;
    }
    return `- ${d.date}: ${d.tmin}-${d.tmax}°C · ${weatherLabel(d.code)}`;
  }).join('\n');

  const hasEstimated = daily.some((d) => d.estimated);

  // Trip-context block — shapes the wardrobe to the actual purpose.
  // A "vacation" with no activities still gets generic-leisure styling;
  // adding activities (beach, hiking, dinner, business) pulls specific
  // requirements into the capsule.
  const tripTypeLabel = tripType === 'business' ? 'BUSINESS' : tripType === 'mixed' ? 'MIXED (business + leisure)' : 'VACATION (leisure)';
  const activitiesBlock = activities.length > 0
    ? `Planned activities (the capsule MUST accommodate these):
${activities.map((a) => `  - ${a.label} — ${a.hint}`).join('\n')}

Activity-driven rules:
${activities.some((a) => a.id === 'beach') ? '  - At least 1-2 days should feature swimwear; include cover-ups and sandals.\n' : ''}${activities.some((a) => a.id === 'dinner' || a.id === 'cocktails' || a.id === 'formal') ? '  - At least one day per 3 days needs an evening-polished look (dress or smart separates).\n' : ''}${activities.some((a) => a.id === 'business') ? '  - Include at least one blazer / smart trouser combination, polished shoes.\n' : ''}${activities.some((a) => a.id === 'hiking') ? '  - Include a hiking-appropriate day: sturdy closed shoes, weather-appropriate outerwear, durable bottoms.\n' : ''}${activities.some((a) => a.id === 'sport') ? '  - Pack sportswear for at least the days where it makes sense.\n' : ''}${activities.some((a) => a.id === 'formal') ? '  - Include one occasion look — the formal event day should be a distinct outfit from regular dinner.\n' : ''}
`
    : '';

  // Specific-places block — user's free-text input goes verbatim. Far more
  // powerful than generic chips because it lets them name venues, events,
  // and contexts the chips can't capture.
  const specificPlacesBlock = specificPlaces
    ? `Specific places, events, or occasions the user mentioned:
"${specificPlaces}"
Honour each one — if a Vatican / temple / mosque visit is mentioned, ensure modest cover-up options (long sleeves, covered shoulders/knees). If a wedding or formal event is named, allocate one polished occasion look. If a specific restaurant or club is named, treat that day's outfit as the evening look. If a hike or beach club is named, dress for the specific activity.

`
    : '';

  // Cultural-awareness instruction — relies on Gemini's general knowledge of
  // destination-specific dress norms. Activates even when specificPlaces is
  // empty.
  const culturalAwarenessBlock = `Cultural / destination awareness:
- Consider any dress norms specific to ${destination} (e.g. covered shoulders for religious sites in Italy / Greece / SE Asia, modest dress in Gulf states, swimwear etiquette beyond the beach, layering for variable mountain weather).
- Factor in seasonal events / festivals at the destination during these dates if you're confident they're happening (don't invent events).
- If the destination has signature evening venues / scene (cocktail bars in Mykonos, fado in Lisbon, izakaya in Tokyo) and an evening activity is selected, lean into the local register.

`;

  const prompt = `You are a personal stylist packing a travel capsule from the user's wardrobe.

Destination: ${destination}
Trip type: ${tripTypeLabel}
${activitiesBlock}${specificPlacesBlock}${culturalAwarenessBlock}Daily forecast:
${forecastLines}

${hasEstimated ? `Some days fall beyond the 14-day forecast window. For those, draw on your knowledge of typical climate at ${destination} in the given month (e.g. "Lisbon in October is mild, often 15-22°C with occasional rain") and infer a sensible temperature range and weather. Apply the same WEATHER-DRIVEN RULES below to the inferred range. State the inferred range in that day's reasoning line. THESE DAYS REQUIRE THE SAME FULL OUTFIT — do NOT skip them or return fewer items just because the forecast is inferred.\n\n` : ''}${styleProfile ? `${styleProfile}\n\n` : ''}Packing rules (NON-NEGOTIABLE):
- Compose ONE outfit per forecast day (every date above) — never skip a day, never return an empty itemIds array.
- Each day's itemIds MUST be drawn from the "Available items" list below. NEVER invent IDs. If you're not sure, pick the closest match from the list.
- Each outfit needs AT MINIMUM: top + bottom + shoes, OR dress + shoes. Aim for 4-7 pieces total per day (add outerwear / bag / accessories / jewellery to complete the look).
- Capsule logic: reuse BOTTOMS, SHOES, outerwear and bags freely across days (that is the point of a capsule). But ROTATE the hero pieces — tops and dresses — for visible variety: aim for a different top or dress on MOST days where the wardrobe allows it. Do not repeat the same dress or the same top more than about twice across the whole trip when weather-appropriate alternatives exist. Only fall back to repeating a hero piece when the wardrobe genuinely lacks other suitable options for that day's weather.
- Each outfit follows the standard slot rules: at most one item per category, dresses replace tops+bottoms.
- A short reasoning line per day (max 12 words) that mentions the day's temperature range so the user can see the call was made deliberately.
- One summary line about the overall capsule choices that mentions the destination's overall climate.

WEATHER-DRIVEN RULES (use the DAILY MAX temperature for each outfit, this is NON-NEGOTIABLE):
- Below 5°C max: REQUIRE heavy outerwear, long sleeves, wool/knit, closed shoes, NO bare legs.
- 5-12°C max: REQUIRE outerwear (coat/jacket), long sleeves, mid-weight, closed shoes.
- 12-18°C max: light outerwear (blazer/cardigan), long sleeves or layerable.
- 18-24°C max: optional light layer, t-shirt weight, dresses welcome.
- Above 24°C max: NO outerwear; light linen/cotton only; STRONGLY prefer shorts, skirts, and light dresses with sandals; sleeveless and bare legs are good. AVOID long trousers and especially jeans in this heat — only use a long bottom if it is lightweight linen AND no shorts, skirt or dress is available for that day.
- Rain/snow forecast code: pick darker pieces, prefer water-resistant outerwear if owned, closed shoes.
- A day's min temperature near 0 with warm max needs versatile layering — include a transportable outer layer even if not worn all day.

Available items (id|name|brand|category|attributes):
${items.map(summarize).join('\n')}

Marker rule for the reasoning field: when you mention a specific piece by name in the reasoning text, wrap it as <<item:ID|display name>> using the id from your itemIds list. Example:
- "The <<item:i_xyz|ivory silk shirt>> keeps it breezy at 26°C."
Wrap only the piece itself, not the surrounding sentence. Do not invent ids.

Respond ONLY with valid JSON in this exact shape:
{
  "days": [
    { "date": "YYYY-MM-DD", "itemIds": ["id1", "id2"], "reasoning": "string" }
  ],
  "summary": "one short paragraph"
}`;

  // Lowered from 0.6 → 0.4 — capsules need consistency more than creativity.
  // The previous temperature led to sparse / hallucinated itemIds.
  const text = await geminiText(prompt, { temperature: 0.4, jsonMode: true }, 'travel-capsule');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The Concierge replied in an unexpected format'); }
  if (!Array.isArray(parsed.days) || parsed.days.length === 0) throw new Error('The Concierge could not compose a capsule.');
  // Filter each day's itemIds to only those that actually exist in the wardrobe.
  // Gemini occasionally hallucinates IDs; we render based on resolvable items
  // anyway, but stripping the bad IDs now means the UI's "empty day" detection
  // is accurate and reroll prompts have clean state to work from.
  const validIds = new Set(items.map((i) => i.id));
  parsed.days = parsed.days.map((d) => ({
    ...d,
    itemIds: (Array.isArray(d.itemIds) ? d.itemIds : []).filter((id) => validIds.has(id)),
  }));
  return parsed;
}

// Reroll just one day of an existing travel capsule. Used by the per-day
// Reroll button in TravelPlannerModal. We re-prompt with the full wardrobe
// context but ONLY the one day's forecast, and ask for a single fresh outfit.
// The caller merges the result into the existing plan.
export async function regenerateTravelDayWithGemini({ items, destination, dayInfo, otherDayPieceIds = [], styleProfile = '', tripType = 'vacation', activities = [], specificPlaces = '' }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  if (!items.length) throw new Error('Add some owned items first.');

  const summarize = (i) =>
    `${i.id}|${i.name}|${i.brand || '?'}|${i.category}${i.subCategory ? '/' + i.subCategory : ''}` +
    `${i.favorite ? '|★FAVOURITE' : ''}` +
    `|styles=${itemStyles(i).join(',') || '-'}` +
    `|colors=${itemColors(i).join(',') || '-'}` +
    `|seasons=${itemSeasons(i).join(',') || 'any'}` +
    `|materials=${itemMaterials(i).join(',') || '-'}`;

  const isEstimated = !!dayInfo.estimated;
  const monthName = new Date(dayInfo.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long' });
  const forecastLine = isEstimated
    ? `(beyond 14-day forecast — use typical ${monthName} climate at ${destination})`
    : `${dayInfo.tmin}-${dayInfo.tmax}°C · ${weatherLabel(dayInfo.code)}`;

  const otherPieces = otherDayPieceIds.length > 0
    ? `\nPieces already used on OTHER days of this trip (prefer reusing these to keep the capsule tight): ${otherDayPieceIds.join(', ')}\n`
    : '';

  const tripTypeLabel = tripType === 'business' ? 'BUSINESS' : tripType === 'mixed' ? 'MIXED (business + leisure)' : 'VACATION (leisure)';
  const activitiesNote = activities.length > 0
    ? `Trip activities (the recomposed day must fit alongside these): ${activities.map((a) => a.label).join(', ')}.\n`
    : '';
  const specificPlacesNote = specificPlaces
    ? `Specific places / events on this trip: "${specificPlaces}". If THIS day's date plausibly matches one of those (e.g. the wedding day, the Vatican day), dress for it specifically.\n`
    : '';
  const culturalNote = `Consider dress norms specific to ${destination} when relevant (modest cover-up for religious sites, climate-appropriate fabrics, evening register for known scene venues).\n`;

  const prompt = `You are recomposing ONE day of an existing travel capsule.

Destination: ${destination}
Trip type: ${tripTypeLabel}
${activitiesNote}${specificPlacesNote}${culturalNote}Date: ${dayInfo.date}
Forecast: ${forecastLine}
${otherPieces}
${styleProfile ? `${styleProfile}\n\n` : ''}Rules:
- Return exactly ONE outfit for this single date.
- itemIds MUST be drawn from the "Available items" list below. NEVER invent IDs.
- Minimum: top + bottom + shoes, OR dress + shoes. Aim for 4-7 pieces.
- Apply the same WEATHER-DRIVEN RULES (same temperature thresholds as a full capsule prompt).
- Reasoning line ≤ 12 words, mention the temperature range.
- Compose something DIFFERENT from the last attempt — fresh combination, not the same pieces.
- Marker rule: when you name a specific piece in reasoning, wrap it as <<item:ID|display name>> using the id from itemIds. Example: "The <<item:i_xyz|ivory silk shirt>> keeps it cool at 26°C." Wrap only the piece name, not the whole sentence. Do not invent ids.

Available items (id|name|brand|category|attributes):
${items.map(summarize).join('\n')}

Respond ONLY with valid JSON in this exact shape:
{ "date": "${dayInfo.date}", "itemIds": ["id1", "id2"], "reasoning": "string" }`;

  const text = await geminiText(prompt, { temperature: 0.6, jsonMode: true }, 'travel-capsule');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('The Concierge replied in an unexpected format'); }
  const validIds = new Set(items.map((i) => i.id));
  parsed.itemIds = (Array.isArray(parsed.itemIds) ? parsed.itemIds : []).filter((id) => validIds.has(id));
  if (parsed.itemIds.length === 0) throw new Error('The Concierge could not compose this day — try again.');
  return parsed;
}
