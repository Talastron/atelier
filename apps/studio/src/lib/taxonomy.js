// Pure wardrobe vocabulary — category/style/material/care/colour constant
// lists and maps. Zero dependencies; safe to import anywhere.

export const SEASONS = ['All Seasons', 'Spring', 'Summer', 'Autumn', 'Winter'];
export const TOP_SUBCATEGORIES = ['T-Shirts', 'Blouses', 'Shirts', 'Sleeveless', 'Jumpers', 'Sweaters', 'Cardigans', 'Hoodies', 'Sweatshirts', 'Vests', 'Other'];
export const BOTTOM_SUBCATEGORIES = ['Jeans', 'Trousers', 'Chinos', 'Leggings', 'Joggers', 'Shorts', 'Skirts', 'Midi Skirts', 'Maxi Skirts', 'Mini Skirts', 'Culottes', 'Cargo', 'Suit Trousers', 'Other'];
export const OUTERWEAR_SUBCATEGORIES = ['Blazers', 'Coats', 'Jackets', 'Trench Coats', 'Puffer Jackets', 'Parkas', 'Capes', 'Gilets', 'Leather Jackets', 'Other'];
export const DRESS_SUBCATEGORIES = ['Mini', 'Midi', 'Maxi', 'Wrap', 'Shift', 'Bodycon', 'Shirt Dress', 'Knit Dress', 'Cocktail', 'Evening / Gown', 'Sundress', 'Slip Dress', 'Other'];
export const ACCESSORY_SUBCATEGORIES = ['Sunglasses', 'Sun Hats', 'Hats', 'Belts', 'Scarves', 'Gloves', 'Other'];
export const JEWELLERY_SUBCATEGORIES = ['Necklaces', 'Pendants', 'Earrings', 'Rings', 'Bracelets', 'Watches', 'Brooches', 'Other'];
export const SPORTSWEAR_SUBCATEGORIES = ['Running', 'Gym', 'Yoga', 'Hiking', 'Swimming', 'Cycling', 'Tennis', 'Other'];
export const BAG_SUBCATEGORIES = ['Handbag', 'Crossbody', 'Tote', 'Clutch', 'Backpack', 'Weekend', 'Wallet', 'Other'];
export const SHOE_SUBCATEGORIES = ['Sneakers', 'Sandals', 'Wedges', 'Loafers', 'Heels', 'Ankle Boots', 'Boots', 'Flats', 'Other'];
export const SWIMWEAR_SUBCATEGORIES = ['Bikini', 'Swimsuit', 'Tankini', 'Bandeau', 'Swim Shorts', 'Cover-up', 'Kaftan', 'Sarong', 'Beach Dress', 'Rash Vest', 'Other'];
export const STYLES = ['Smart', 'Casual', 'Work', 'Occasion', 'Leisure', 'Sport'];
export const MOOD_PRESETS = [
  'Weekend brunch', 'Office day', 'Important meeting', 'Dinner date',
  'Wedding guest', 'Travel day', 'Lazy Sunday', 'Cocktail evening',
];

export const INITIAL_MEASUREMENTS = { height: '', weight: '', chest: '', waist: '', hips: '', shoeSize: '' };
// Style profile — populated by the quiz; fed into every Gemini prompt.
export const STYLE_UNDERTONES = ['Cool', 'Warm', 'Neutral'];
export const STYLE_SILHOUETTES = ['Hourglass', 'Pear', 'Apple', 'Rectangle', 'Inverted triangle', 'Athletic'];
export const STYLE_FORMALITY = ['Casual-leaning', 'Smart-casual', 'Polished', 'Formal'];
export const STYLE_SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter']; // Seasonal colour analysis
export const STYLE_PRINCIPLES = [
  'Neutral base with a single statement colour',
  'Tonal layering · monochrome stories',
  'Bold prints and pattern mixing',
  'Soft romantic · texture-led',
  'Sharp tailoring · architectural',
  'Effortless coastal · linen / cotton',
];

export const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

// Condition / cleaning state for an owned item. Default is `available` —
// the piece is wearable right now. Other states block it from being
// auto-recommended by Gemini suggestions and surface a badge on the
// wardrobe card so 'what can I wear today?' is a glance, not a hunt.
export const ITEM_CONDITIONS = [
  { key: 'available',     label: 'Available',     short: 'Ready',     color: 'emerald', shortcut: 'Mark available' },
  { key: 'in_wash',       label: 'In the wash',   short: 'In wash',   color: 'blue',    shortcut: 'Send to wash' },
  { key: 'needs_ironing', label: 'Needs ironing', short: 'To iron',   color: 'amber',   shortcut: 'Needs ironing' },
  { key: 'damaged',       label: 'Damaged',       short: 'Damaged',   color: 'red',     shortcut: 'Mark damaged' },
];

export const CURRENCY_SYMBOLS = { GBP: '£', USD: '$', EUR: '€', JPY: '¥', AUD: 'A$', CAD: 'C$' };

export const AI_TEMPERATURE_PRESETS = { safe: 0.3, balanced: 0.7, surprise: 1.0 };

export const CARE_TAGS = ['Dry clean', 'Hand wash', 'Cool wash', 'No tumble', 'Iron low', 'Steam only', 'Delicate'];

export const MATERIALS = ['Cotton', 'Linen', 'Silk', 'Wool', 'Cashmere', 'Leather', 'Suede', 'Denim', 'Velvet', 'Lace', 'Knit', 'Sequins', 'Tweed', 'Synthetic', 'Other'];

// Jewellery is not a garment: it has its own materials (metals, stones) and
// none of the laundry-oriented care tags or wash/iron statuses apply. These
// helpers make the Add/Edit form and the condition picker category-aware so a
// Cartier watch never offers "In the wash" or "Cotton".
export const JEWELLERY_MATERIALS = ['Yellow gold', 'White gold', 'Rose gold', 'Silver', 'Platinum', 'Gold-plated', 'Stainless steel', 'Pearl', 'Diamond', 'Gemstone', 'Enamel', 'Beads', 'Other'];

// Footwear materials — leather/suede/canvas etc., not cotton/wool/silk.
export const SHOE_MATERIALS = ['Leather', 'Suede', 'Nubuck', 'Patent', 'Canvas', 'Mesh', 'Rubber', 'Satin', 'Espadrille', 'Synthetic', 'Other'];

// Accessories span fabrics (scarves, gloves) AND hard goods (belts, sunglasses,
// hats), so the list keeps the fabrics but adds straw/metal/acetate/resin.
export const ACCESSORY_MATERIALS = ['Leather', 'Suede', 'Silk', 'Wool', 'Cashmere', 'Cotton', 'Linen', 'Canvas', 'Straw', 'Metal', 'Acetate', 'Resin', 'Beads', 'Velvet', 'Synthetic', 'Other'];

// Bag materials — leather/canvas/nylon/raffia, not garment fabrics.
export const BAG_MATERIALS = ['Leather', 'Suede', 'Canvas', 'Nylon', 'Raffia', 'Straw', 'Patent', 'Velvet', 'Synthetic', 'Other'];

// Union of every category's materials — the vocabulary the AI identify/enrich
// prompts offer, so a watch can come back "Yellow gold" and a tote "Raffia".
// Validation still narrows to the item's own category via materialsForCategory.
export const ALL_MATERIALS = [...new Set([...MATERIALS, ...JEWELLERY_MATERIALS, ...SHOE_MATERIALS, ...ACCESSORY_MATERIALS, ...BAG_MATERIALS])];

// Categories that are never laundered or ironed — laundry care tags and the
// wash/iron statuses don't apply. (Accessories are deliberately NOT here: the
// category includes washable/ironable pieces like silk scarves and gloves.)
const NON_LAUNDERED = new Set(['Jewellery', 'Shoes', 'Bags']);

export function materialsForCategory(category) {
  if (category === 'Jewellery') return JEWELLERY_MATERIALS;
  if (category === 'Shoes') return SHOE_MATERIALS;
  if (category === 'Bags') return BAG_MATERIALS;
  if (category === 'Accessories') return ACCESSORY_MATERIALS;
  return MATERIALS;
}

// Non-laundered categories only offer the wearable/damaged states.
export function conditionsForCategory(category) {
  return NON_LAUNDERED.has(category)
    ? ITEM_CONDITIONS.filter((c) => c.key === 'available' || c.key === 'damaged')
    : ITEM_CONDITIONS;
}

// Laundry care tags only make sense for laundered categories.
export function careAppliesToCategory(category) {
  return !NON_LAUNDERED.has(category);
}

// Care reminders: when wears-since-last-care crosses these thresholds, the
// item detail page surfaces a gentle nudge with the suggested action. Pick the
// rule for the item's most-fragile material (lowest threshold wins).
export const CARE_RULES = {
  Cashmere: { everyN: 5, action: 'wash gently with cashmere shampoo or dry-clean' },
  Silk:     { everyN: 3, action: 'spot-clean and steam to refresh' },
  Suede:    { everyN: 4, action: 'brush with a suede brush to restore the nap' },
  Wool:     { everyN: 4, action: 'brush down and air out to keep the fibres fresh' },
  Linen:    { everyN: 3, action: 'steam or press — linen rumples fast' },
  Leather:  { everyN: 8, action: 'condition with a leather balm to prevent cracking' },
  Velvet:   { everyN: 5, action: 'steam from inside-out to lift the pile' },
  Tweed:    { everyN: 6, action: 'brush gently to release lint and debris' },
};

export const NEUTRAL_COLORS = ['Black', 'White', 'Cream', 'Beige', 'Brown', 'Tan', 'Grey', 'Navy', 'Gold', 'Silver', 'Rose Gold'];

export const COLOR_FAMILIES = [
  'Black', 'White', 'Cream', 'Beige', 'Brown', 'Tan', 'Grey',
  'Red', 'Pink', 'Orange', 'Yellow', 'Olive', 'Green', 'Teal',
  'Blue', 'Navy', 'Purple',
  'Gold', 'Silver', 'Rose Gold',
  'Multicolor',
];

export const COLOR_SWATCHES = {
  Black: '#1c1917', White: '#FAFAF9', Cream: '#F5EFE6', Beige: '#D5C3A1',
  Brown: '#6B4226', Tan: '#B89570', Grey: '#9CA3AF',
  Red: '#DC2626', Pink: '#EC4899', Orange: '#F97316', Yellow: '#EAB308',
  Olive: '#65731F', Green: '#16A34A', Teal: '#0D9488',
  Blue: '#2563EB', Navy: '#1E3A8A', Purple: '#9333EA',
  Gold: 'linear-gradient(135deg, #F4D27A, #C9A961 45%, #E6C870 70%, #B8860B)',
  Silver: 'linear-gradient(135deg, #ECECEC, #B8B8B8 45%, #DADADA 70%, #9C9C9C)',
  'Rose Gold': 'linear-gradient(135deg, #F4D0CB, #C97F73 50%, #E8B4A6)',
  Multicolor: 'linear-gradient(135deg, #DC2626, #EAB308, #16A34A, #2563EB, #9333EA)',
};

export const COLOUR_HEX_MAP = {
  black: '#1c1917', white: '#fafaf9', cream: '#f5f1ea', ivory: '#f1ebe0',
  beige: '#d9c9af', tan: '#bfa17a', camel: '#c4974f', brown: '#6b4f3a',
  chocolate: '#3e2a1d', grey: '#9ca29a', gray: '#9ca29a', charcoal: '#3d3d3b',
  silver: '#c4c4c0', navy: '#1f2a44', blue: '#3e6791', 'sky blue': '#86b0d3',
  cobalt: '#1a3d82', denim: '#4d6d8a', green: '#5a6f4e', olive: '#7a7048',
  forest: '#3b4a36', khaki: '#8a8060', teal: '#3e7373', sage: '#8fa887',
  red: '#9a3a30', burgundy: '#5d2a2a', rust: '#a55a3a', terracotta: '#b05e42',
  pink: '#e0b7be', blush: '#e9c9c5', rose: '#c98996', fuchsia: '#b03070',
  purple: '#6b4a72', lilac: '#b9a7c6', lavender: '#b0a8c8',
  gold: '#c9a45e', brass: '#b3924b', yellow: '#d9b54a', mustard: '#b8963a',
  orange: '#cc7a3a', coral: '#d46a5a',
};

export const BODY_SHAPE_GUIDES = {
  Hourglass: {
    blurb: 'Bust and hips are roughly balanced, with a clearly defined waist.',
    flatter: ['Wrap dresses and tops', 'Belted waists and high-rise bottoms', 'Pencil skirts and tailored trousers', 'V- and sweetheart necklines'],
    avoid: ['Boxy, shapeless cuts that hide the waist', 'Drop-waist silhouettes'],
  },
  Pear: {
    blurb: 'Hips are noticeably wider than the bust; a defined waist.',
    flatter: ['Structured shoulders and statement sleeves', 'Boat necks and off-shoulder tops', 'A-line skirts and dresses', 'Dark, sleek bottoms with brighter tops'],
    avoid: ['Tapered or skinny bottoms in light colours', 'Hip-pocket detailing that adds bulk'],
  },
  Apple: {
    blurb: 'Fuller around the midsection; bust and hips similar widths.',
    flatter: ['V-necks and open necklines to elongate', 'Empire waist or wrap dresses', 'A-line and flared bottoms', 'Structured jackets that skim the waist'],
    avoid: ['Clingy fabrics across the waist', 'High-waist bottoms with tucked-in tops', 'Belts that cinch tightly at the natural waist'],
  },
  Rectangle: {
    blurb: 'Bust, waist and hips are similar widths — long, lean lines.',
    flatter: ['Peplum tops and belted dresses to create curves', 'Ruffles, layers and texture', 'Wide-leg trousers paired with fitted tops', 'Wrap silhouettes and bias-cut skirts'],
    avoid: ['Box-cut shifts in heavy fabrics that flatten further', 'Very loose, tent-like dresses'],
  },
  'Inverted Triangle': {
    blurb: 'Shoulders or bust wider than the hips.',
    flatter: ['Full and A-line skirts to balance shoulders', 'Wide-leg trousers and bootcuts', 'V-necks and scoop necklines', 'Detail on the lower half: pockets, prints, texture'],
    avoid: ['Shoulder pads and puff sleeves', 'Boat necks and halters that widen further'],
  },
};
