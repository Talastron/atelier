// Curated 20-piece luxury capsule used as the marketing-site demo wardrobe
// and as a regeneration target for scripts/generate-seed-wardrobe.mjs.
//
// Each item matches the live item schema in App.jsx (see handleAddItem
// callers around line 3517). `slug` is the only addition: it is the stable
// filename the generation script writes to `public/seed-wardrobe/<slug>.jpg`
// and the wardrobe never reads it.
//
// Prompts are intentionally generic ("camel wool double-breasted coat"),
// never branded — keeps the IP story clean even though the upstream model
// (Flux via Pollinations) is not Firefly-grade trained-on-licensed-only.
//
// `seed` is fixed per item so re-running the script produces the same
// image. Change the seed to nudge an individual piece without disturbing
// the rest of the capsule.

const ISO = '2026-06-19T00:00:00.000Z';
const asset = (slug) => `/seed-wardrobe/${slug}.jpg`;

export const SEED_WARDROBE = [
  // ───── Tops ─────
  {
    id: 'seed-top-silk-blouse', slug: 'silk-blouse-ivory',
    name: 'Silk Charmeuse Blouse', brand: '', price: 0,
    category: 'Tops', subCategory: 'Blouses', status: 'owned',
    seasons: ['Spring', 'Summer', 'Autumn'], styles: ['Smart', 'Work'],
    colors: ['Cream'], materials: ['Silk'], care: ['Dry clean'],
    description: 'Ivory silk charmeuse blouse with a soft notch collar.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('silk-blouse-ivory')],
    prompt: 'ivory silk charmeuse blouse with a soft notch collar and long sleeves, gentle drape, mother-of-pearl buttons, hanging on a thin invisible wire',
    seed: 101,
  },
  {
    // Refined from atelier-website/public/Clothes/navy top.jpeg via
    // scripts/refine-clothes.mjs (strong neutralisation + cream→stone bg).
    id: 'seed-top-silk-black', slug: 'silk-top-black',
    name: 'Black Silk Sleeveless Top', brand: '', price: 0,
    category: 'Tops', subCategory: 'Sleeveless', status: 'owned',
    seasons: ['Spring', 'Summer', 'Autumn'], styles: ['Smart', 'Occasion'],
    colors: ['Black'], materials: ['Silk'], care: ['Dry clean'],
    description: 'Black silk sleeveless V-neck top with a sheer chiffon yoke.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('silk-top-black')],
  },
  {
    // Refined from atelier-website/public/Clothes/top.jpeg via refine-clothes.mjs.
    id: 'seed-top-silver-sequin', slug: 'silver-sequin-tank',
    name: 'Silver Sequin Tank', brand: '', price: 0,
    category: 'Tops', subCategory: 'Sleeveless', status: 'owned',
    seasons: ['Spring', 'Summer', 'Autumn'], styles: ['Occasion'],
    colors: ['Silver'], materials: ['Sequins'], care: ['Dry clean'],
    description: 'Silver sequin sleeveless V-neck tank with a relaxed silhouette.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('silver-sequin-tank')],
  },
  {
    id: 'seed-top-poplin-shirt', slug: 'poplin-shirt-white',
    name: 'White Poplin Shirt', brand: '', price: 0,
    category: 'Tops', subCategory: 'Shirts', status: 'owned',
    seasons: ['All Seasons'], styles: ['Work', 'Smart', 'Casual'],
    colors: ['White'], materials: ['Cotton'], care: ['Iron low'],
    description: 'Crisp white cotton poplin shirt with a clean point collar.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('poplin-shirt-white')],
    prompt: 'crisp pure white cotton poplin shirt with point collar, long sleeves, neat placket, hanging on a thin invisible wire',
    seed: 104,
  },

  // ───── Bottoms ─────
  {
    id: 'seed-bottom-wool-trouser', slug: 'wool-trouser-charcoal',
    name: 'Wool Wide-Leg Trousers', brand: '', price: 0,
    category: 'Bottoms', subCategory: 'Trousers', status: 'owned',
    seasons: ['Autumn', 'Winter', 'Spring'], styles: ['Work', 'Smart'],
    colors: ['Grey'], materials: ['Wool'], care: ['Dry clean'],
    description: 'Charcoal wool wide-leg tailored trousers with a high waist.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('wool-trouser-charcoal')],
    prompt: 'flatlay product photography of charcoal grey wool wide leg tailored trousers, photographed from directly above, top down view, empty trousers neatly arranged on a pure white seamless paper backdrop, garment alone, e-commerce flat lay',
    seed: 1201,
  },
  {
    id: 'seed-bottom-dark-jeans', slug: 'dark-wash-jeans',
    name: 'Straight-Leg Dark Wash Jeans', brand: '', price: 0,
    category: 'Bottoms', subCategory: 'Jeans', status: 'owned',
    seasons: ['All Seasons'], styles: ['Casual', 'Smart'],
    colors: ['Blue'], materials: ['Denim', 'Cotton'], care: ['Cool wash'],
    description: 'Straight-leg dark indigo wash jeans, raw selvedge.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('dark-wash-jeans')],
    prompt: 'straight leg dark indigo wash raw selvedge denim jeans, mid rise, five pocket, laid flat',
    seed: 202,
  },

  // ───── Dresses ─────
  {
    // Originally prompted as a midi skirt; Flux Schnell's strong "champagne silk
    // satin midi" → dress prior produced this beautiful sleeveless midi dress
    // instead. Re-categorised rather than fought. Prompt+seed kept as a memo
    // of how the image was made (re-running would regenerate this exact dress).
    id: 'seed-dress-champagne-midi', slug: 'silk-midi-dress-champagne',
    name: 'Champagne Silk Midi Dress', brand: '', price: 0,
    category: 'Dresses', subCategory: 'Midi', status: 'owned',
    seasons: ['Spring', 'Summer', 'Autumn'], styles: ['Occasion', 'Smart'],
    colors: ['Cream'], materials: ['Silk'], care: ['Dry clean'],
    description: 'Champagne silk satin sleeveless midi dress with a fitted bodice and fluid A-line skirt.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('silk-midi-dress-champagne')],
    prompt: 'flatlay product photography of a champagne silk satin bias cut midi skirt, garment alone neatly laid flat on a pure white seamless backdrop, photographed from directly above, top down view, waistband visible at the top of frame, only a skirt covering the lower body, fluid satin drape, e-commerce flat lay',
    seed: 2203,
  },
  {
    // Refined from atelier-website/public/Clothes/dress.jpeg via refine-clothes.mjs.
    id: 'seed-dress-ivory-shirt', slug: 'cotton-shirt-dress-ivory',
    name: 'Ivory Cotton Shirt Dress', brand: '', price: 0,
    category: 'Dresses', subCategory: 'Shirt Dress', status: 'owned',
    seasons: ['Spring', 'Summer'], styles: ['Casual', 'Smart'],
    colors: ['White', 'Cream'], materials: ['Cotton'], care: ['Iron low'],
    description: 'Ivory cotton sleeveless midi shirt dress with a self-tie belt at the waist.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('cotton-shirt-dress-ivory')],
  },
  {
    id: 'seed-dress-slip', slug: 'silk-slip-pewter',
    name: 'Bias Silk Slip Dress', brand: '', price: 0,
    category: 'Dresses', subCategory: 'Slip Dress', status: 'owned',
    seasons: ['Spring', 'Summer'], styles: ['Occasion'],
    colors: ['Grey'], materials: ['Silk'], care: ['Dry clean'],
    description: 'Bias-cut silk slip dress in pewter.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('silk-slip-pewter')],
    prompt: 'pewter grey silk bias cut slip dress, midi length, thin straps, fluid drape, hanging on a thin invisible wire',
    seed: 302,
  },
  {
    id: 'seed-dress-shirt', slug: 'midi-shirt-dress-stone',
    name: 'Stone Midi Shirt Dress', brand: '', price: 0,
    category: 'Dresses', subCategory: 'Shirt Dress', status: 'owned',
    seasons: ['Spring', 'Summer', 'Autumn'], styles: ['Smart', 'Casual'],
    colors: ['Beige'], materials: ['Cotton'], care: ['Iron low'],
    description: 'Stone cotton midi shirt dress with a soft self-tie waist.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('midi-shirt-dress-stone')],
    prompt: 'stone beige cotton midi shirt dress, point collar, button front, soft self tie waist, laid flat',
    seed: 303,
  },

  // ───── Outerwear ─────
  {
    // Refined from atelier-website/public/Clothes/coat.webp via refine-clothes.mjs.
    id: 'seed-outer-wool-coat', slug: 'wool-coat-charcoal',
    name: 'Wool Double-Breasted Coat', brand: '', price: 0,
    category: 'Outerwear', subCategory: 'Coats', status: 'owned',
    seasons: ['Autumn', 'Winter'], styles: ['Smart', 'Work'],
    colors: ['Grey'], materials: ['Wool'], care: ['Dry clean'],
    description: 'Charcoal wool double-breasted tailored coat with a fitted waist.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('wool-coat-charcoal')],
  },
  {
    id: 'seed-outer-trench', slug: 'trench-coat-beige',
    name: 'Classic Beige Trench Coat', brand: '', price: 0,
    category: 'Outerwear', subCategory: 'Trench Coats', status: 'owned',
    seasons: ['Spring', 'Autumn'], styles: ['Smart', 'Casual'],
    colors: ['Beige'], materials: ['Cotton', 'Synthetic'], care: ['Dry clean'],
    description: 'Classic beige cotton gabardine trench coat with belt.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('trench-coat-beige')],
    prompt: 'classic beige cotton gabardine trench coat with storm flap, epaulets, belted waist, knee length, hanging on a thin invisible wire',
    seed: 402,
  },
  {
    // Refined from atelier-website/public/Clothes/blazer pink.jpeg via refine-clothes.mjs.
    id: 'seed-outer-tailored-blazer', slug: 'tailored-blazer-cream',
    name: 'Cream Tailored Blazer', brand: '', price: 0,
    category: 'Outerwear', subCategory: 'Blazers', status: 'owned',
    seasons: ['Spring', 'Summer', 'Autumn'], styles: ['Smart', 'Occasion', 'Work'],
    colors: ['Cream'], materials: ['Other'], care: ['Dry clean'],
    description: 'Cream tailored single-breasted blazer with peaked lapels and a single button.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('tailored-blazer-cream')],
  },

  // ───── Shoes ─────
  {
    // Originally prompted as ankle boots / chelsea boots; Flux Schnell's
    // "black leather boot" prior kept returning mid-calf knee boots regardless
    // of qualifiers. Re-categorised rather than fought — the boots are nice as
    // knee boots. Prompt+seed kept as a memo of how the image was made.
    id: 'seed-shoe-knee-boot', slug: 'leather-knee-boots-black',
    name: 'Black Leather Knee Boots', brand: '', price: 0,
    category: 'Shoes', subCategory: 'Boots', status: 'owned',
    seasons: ['Autumn', 'Winter', 'Spring'], styles: ['Smart', 'Casual'],
    colors: ['Black'], materials: ['Leather'], care: ['Dry clean'],
    description: 'Black calfskin knee boots, almond toe, block heel.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('leather-knee-boots-black')],
    prompt: 'still life of a pair of black calfskin chelsea boots, ankle high silhouette ending just at the ankle bone, elasticated side panel, pull tab at the back, almond toe, low block heel, both boots empty and standing upright on a white seamless backdrop, e-commerce product photography',
    seed: 2501,
  },
  {
    // Refined from atelier-website/public/Clothes/wedges.jpeg via refine-clothes.mjs.
    id: 'seed-shoe-wedge-black', slug: 'canvas-wedges-black',
    name: 'Black Canvas Espadrille Wedges', brand: '', price: 0,
    category: 'Shoes', subCategory: 'Wedges', status: 'owned',
    seasons: ['Spring', 'Summer'], styles: ['Casual', 'Smart'],
    colors: ['Black'], materials: ['Other'], care: [],
    description: 'Black canvas espadrille wedges with jute sole and ankle ribbon ties.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('canvas-wedges-black')],
  },
  {
    id: 'seed-shoe-sneaker', slug: 'leather-sneakers-white',
    name: 'White Leather Sneakers', brand: '', price: 0,
    category: 'Shoes', subCategory: 'Sneakers', status: 'owned',
    seasons: ['All Seasons'], styles: ['Casual', 'Leisure'],
    colors: ['White'], materials: ['Leather'], care: [],
    description: 'Minimal low-top white leather sneakers.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('leather-sneakers-white')],
    prompt: 'pair of minimal low top white leather sneakers, no logos, plain side panels, three quarter angle',
    seed: 503,
  },

  // ───── Bags ─────
  {
    id: 'seed-bag-tote', slug: 'structured-tote-tan',
    name: 'Tan Structured Leather Tote', brand: '', price: 0,
    category: 'Bags', subCategory: 'Tote', status: 'owned',
    seasons: ['All Seasons'], styles: ['Work', 'Smart'],
    colors: ['Brown', 'Tan'], materials: ['Leather'], care: [],
    description: 'Structured tan leather tote with rolled top handles.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('structured-tote-tan')],
    prompt: 'structured tan smooth leather tote bag with rolled top handles, no branding, no logos, three quarter angle',
    seed: 601,
  },

  // ───── Accessories ─────
  {
    // Refined from atelier-website/public/Clothes/sun hat.jpeg via refine-clothes.mjs.
    id: 'seed-acc-fedora', slug: 'straw-fedora-stone',
    name: 'Straw Fedora Sun Hat', brand: '', price: 0,
    category: 'Accessories', subCategory: 'Sun Hats', status: 'owned',
    seasons: ['Spring', 'Summer'], styles: ['Casual', 'Leisure'],
    colors: ['Beige'], materials: ['Other'], care: [],
    description: 'Stone straw fedora with a slim leather trim band.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('straw-fedora-stone')],
  },
  {
    // Refined from atelier-website/public/Clothes/gloves.jpeg via refine-clothes.mjs.
    id: 'seed-acc-gloves', slug: 'leather-gloves-olive',
    name: 'Olive Leather Gloves', brand: '', price: 0,
    category: 'Accessories', subCategory: 'Gloves', status: 'owned',
    seasons: ['Autumn', 'Winter'], styles: ['Smart', 'Casual'],
    colors: ['Brown'], materials: ['Leather'], care: [],
    description: 'Olive leather gloves with a soft knit cuff.',
    sourceUrl: '', createdAt: ISO,
    images: [asset('leather-gloves-olive')],
  },
];

export const SEED_MASTER_PROMPT_PREFIX =
  'editorial fashion product photography, single garment isolated on pure white seamless studio backdrop, soft diffused natural light, hyper detailed fabric texture, magazine quality, minimalist composition, no model, no mannequin, no people, no hands, no text, no logos, no watermarks, no signatures, no branding,';

export const SEED_MASTER_PROMPT_SUFFIX =
  ', shot on medium format camera, shallow depth of field, true to colour, luxury e-commerce hero shot';
