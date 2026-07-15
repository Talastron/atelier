import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowUpDown, Check, ChevronDown, ChevronRight, Heart, Plus, Shirt, SlidersHorizontal, Sparkles, Star, Trash2, X } from "lucide-react";
import { daysSinceLastWorn, isItemAvailable, itemColors, itemCondition, itemImages, itemNeedsDetail, itemSeasons, itemStyles, itemWearCount, itemWearHistory, itemCostPerWear, live, resolveOutfitItems, todayISO } from "../lib/items.js";
import { useImageBg } from "../lib/imageBg.js";
import { itemImageDisplay } from "../lib/polish.js";
import { fetchTodaysWeather, pickTodaysRecommendation, weatherToSeasons, weatherAppropriatenessScore } from "../lib/weather.js";
import { CATEGORIES, TOP_SUBCATEGORIES, BOTTOM_SUBCATEGORIES, OUTERWEAR_SUBCATEGORIES, DRESS_SUBCATEGORIES, ACCESSORY_SUBCATEGORIES, JEWELLERY_SUBCATEGORIES, SPORTSWEAR_SUBCATEGORIES, BAG_SUBCATEGORIES, SHOE_SUBCATEGORIES, SWIMWEAR_SUBCATEGORIES, STYLES, SEASONS, COLOR_SWATCHES, ITEM_CONDITIONS } from "../lib/taxonomy.js";

function WardrobeCardImage({ item }) {
  const [failed, setFailed] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStartRef = React.useRef(null);
  const images = itemImages(item);
  // Sample the active image's background to decide contain-on-white vs cover.
  // (Hook must run before the early return below — rules of hooks.)
  const activeSrcForBg = images.length ? images[Math.min(photoIndex, images.length - 1)] : null;
  const bg = useImageBg(activeSrcForBg);

  if (images.length === 0 || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 bg-stone-100">
        <Shirt size={48} strokeWidth={1} />
        <span className="text-[10px] uppercase tracking-widest mt-2">No photo</span>
      </div>
    );
  }

  const safeIndex = Math.min(photoIndex, images.length - 1);
  const hasMulti = images.length > 1;

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = (e) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    // Significant horizontal swipe, dominantly horizontal — navigate photos.
    if (hasMulti && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      e.stopPropagation();
      if (dx < 0) setPhotoIndex((i) => Math.min(images.length - 1, i + 1));
      else setPhotoIndex((i) => Math.max(0, i - 1));
    }
  };

  return (
    <div className="w-full h-full relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Editorial crossfade carousel (Net-a-Porter / SSENSE pattern):
          all images render stacked via absolute inset-0; only the active
          one is opacity-100, the rest are opacity-0. Chevron clicks just
          flip safeIndex → the previous image fades out as the new one
          fades in over 300ms. No flash, no src-swap jump.

          Two transitions, two elements:
            • Layer wrapper: transition-opacity 300ms (the crossfade)
            • Image itself:  transition-transform 700ms (the hover zoom)
          Trying to put both on one element would mean fighting one
          shared duration for two unrelated effects.

          loading=eager on all so the carousel doesn't wait for a network
          round-trip when the user clicks next — items typically have 1-6
          photos so the up-front cost is small. */}
      {images.map((src, i) => {
        const disp = itemImageDisplay(item, i);
        const showSrc = disp.src || src;
        // Cut-outs: contain on a white card. Otherwise let bg-detection decide
        // (it paints the tile the image's own colour, or covers busy photos).
        const detected = (i === safeIndex && !disp.forceContain && bg?.contain) ? bg.color : null;
        const contain = disp.forceContain || !!detected;
        const tileBg = disp.forceContain ? '#FFFFFF' : detected;
        return (
        <div
          key={i}
          style={tileBg ? { background: tileBg } : undefined}
          className={`absolute inset-0 transition-opacity duration-300 ease-out ${
            i === safeIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={showSrc}
            alt={i === safeIndex ? item.name : ''}
            onError={() => setFailed(true)}
            className={`w-full h-full transition-transform duration-700 ease-out group-hover:scale-105 pointer-events-none ${contain ? 'object-contain' : 'object-cover'}`}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
        );
      })}

      {hasMulti && (
        <>
          {/* Dot indicators — universal "swipeable" affordance */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 px-2 py-1 rounded-full bg-stone-900/30 backdrop-blur-sm">
            {images.map((_, i) => (
              <span key={i}
                className={`block rounded-full transition-all duration-200 ${
                  i === safeIndex ? 'bg-white w-1.5 h-1.5' : 'bg-white/60 w-1 h-1'
                }`} />
            ))}
          </div>

          {/* Desktop hover chevrons. Hover lift on the button itself uses
              the unified light-pill hover convention (white bg, no extra
              transform — the underlying card no longer lifts either, so a
              chevron transform would feel out of place). */}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => Math.max(0, i - 1)); }}
            disabled={safeIndex === 0}
            className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/85 hover:bg-white text-stone-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-default shadow-md z-10"
            aria-label="Previous photo"
          >
            <ChevronRight size={14} strokeWidth={1.5} className="rotate-180" />
          </button>
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => Math.min(images.length - 1, i + 1)); }}
            disabled={safeIndex === images.length - 1}
            className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/85 hover:bg-white text-stone-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:opacity-30 disabled:cursor-default shadow-md z-10"
            aria-label="Next photo"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  );
}

// Edge-case status filters that live in the sheet rather than the visible
// pill row (those are reserved for the 4 lifecycle states a user wants
// one-tap access to: All / Favourites / Owned / Wishlist).
const CONDITION_OPTIONS = [
  { key: 'all', label: 'Any condition' },
  { key: 'unavailable', label: 'In wash / etc' },
  { key: 'lent', label: 'Lent out' },
  { key: 'stale', label: 'Stale 90+ days' },
  { key: 'untagged', label: 'Needs detail' },
];
const CONDITION_KEYS = new Set(['unavailable', 'lent', 'stale', 'untagged']);
const CONDITION_LABEL_BY_KEY = Object.fromEntries(CONDITION_OPTIONS.map((o) => [o.key, o.label]));

function WardrobeFiltersSheet({
  open, onClose,
  filter, setFilter,
  subCategories, subCategoryFilter, setSubCategoryFilter,
  seasonFilter, setSeasonFilter,
  allBrands, brandFilter, setBrandFilter,
  styleFilter, setStyleFilter,
  usedColors, colorFilter, setColorFilter,
}) {
  if (!open) return null;
  const ChipRow = ({ items, value, set, getSwatch }) => (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = value === it;
        const swatch = getSwatch?.(it);
        return (
          <button key={it} onClick={() => set(it)}
            className={`px-3 py-2 rounded-full text-xs border whitespace-nowrap flex items-center gap-2 transition-colors duration-200 ${
              active
                ? 'bg-stone-900 border-stone-900 text-white hover:bg-stone-700'
                : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900'
            }`}>
            {swatch && <span className="w-3 h-3 rounded-full border border-stone-300/50"
              style={swatch.startsWith?.('linear') ? { background: swatch } : { backgroundColor: swatch }} />}
            {it}
          </button>
        );
      })}
    </div>
  );
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh] sm:max-h-[90vh]"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Filters</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 flex-1 min-h-0 overflow-y-auto space-y-6">
          {/* Condition — edge-state filters that don't earn a spot in the
              visible pill row (In wash, Lent out, Stale). Treats the
              shared `filter` state as condition-only: if user picks
              In wash, filter becomes 'unavailable' and the visible
              pill row de-highlights; a badge appears in the toolbar. */}
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Condition</h4>
            <ChipRow
              items={CONDITION_OPTIONS.map((o) => o.label)}
              value={CONDITION_KEYS.has(filter) ? CONDITION_LABEL_BY_KEY[filter] : 'Any condition'}
              set={(label) => {
                const opt = CONDITION_OPTIONS.find((o) => o.label === label);
                if (!opt) return;
                // Selecting a condition replaces whatever pill was active —
                // a user can't be in 'Owned' AND 'In wash' via this UI.
                // Picking "Any condition" while a condition was active
                // returns to 'all'.
                setFilter(opt.key);
              }}
            />
          </div>
          {subCategories && (
            <div>
              <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Sub-type</h4>
              <ChipRow items={['All Types', ...subCategories]} value={subCategoryFilter} set={setSubCategoryFilter} />
            </div>
          )}
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Season</h4>
            <ChipRow items={SEASONS} value={seasonFilter} set={setSeasonFilter} />
          </div>
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Style</h4>
            <ChipRow items={['All Styles', ...STYLES]} value={styleFilter} set={setStyleFilter} />
          </div>
          {usedColors.length > 0 && (
            <div>
              <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Colour</h4>
              <ChipRow items={['All Colours', ...usedColors]} value={colorFilter} set={setColorFilter} getSwatch={(c) => c !== 'All Colours' ? COLOR_SWATCHES[c] : null} />
            </div>
          )}
          {allBrands.length > 1 && (
            <div>
              <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Brand</h4>
              <ChipRow items={allBrands} value={brandFilter} set={setBrandFilter} />
            </div>
          )}
        </div>
        <div className="px-4 sm:px-6 py-4 border-t border-stone-200/60 bg-white/95 backdrop-blur shrink-0"
             style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <button onClick={onClose} className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-[0.98]">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


const WARDROBE_SORT_OPTIONS = [
  { key: 'recent', label: 'Recently added', hint: 'Newest first' },
  { key: 'oldest', label: 'Oldest first', hint: 'By date added' },
  { key: 'worn-recent', label: 'Recently worn', hint: 'Last wear first' },
  { key: 'most-worn', label: 'Most worn', hint: 'By wear count' },
  { key: 'least-worn', label: 'Least worn', hint: 'Surfaces neglected pieces' },
  { key: 'cpw-best', label: 'Best cost-per-wear', hint: 'Most-justified buys' },
  { key: 'cpw-worst', label: 'Worst cost-per-wear', hint: 'Wear-them-more list' },
  { key: 'price-desc', label: 'Highest value', hint: 'Priciest first' },
  { key: 'name', label: 'A → Z', hint: 'Alphabetical' },
  { key: 'color', label: 'By colour', hint: 'Grouped palette' },
];
const WARDROBE_SORT_KEY = 'atelier.wardrobeSort';

function sortWardrobeItems(items, sortBy) {
  const arr = [...items];
  const cmpDate = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');
  // Favourites always pinned to top within the chosen sort.
  const favBoost = (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
  const lastWornDate = (it) => {
    const h = itemWearHistory(it);
    return h.length > 0 ? h[h.length - 1] : '';
  };
  let comparator;
  switch (sortBy) {
    case 'oldest':
      comparator = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '');
      break;
    case 'worn-recent':
      comparator = (a, b) => lastWornDate(b).localeCompare(lastWornDate(a));
      break;
    case 'most-worn':
      comparator = (a, b) => itemWearCount(b) - itemWearCount(a);
      break;
    case 'least-worn':
      comparator = (a, b) => itemWearCount(a) - itemWearCount(b);
      break;
    case 'cpw-best': {
      // Lowest CPW (best value) first; items never-worn sink to the end.
      const score = (it) => itemCostPerWear(it) ?? Number.POSITIVE_INFINITY;
      comparator = (a, b) => score(a) - score(b);
      break;
    }
    case 'cpw-worst': {
      // Highest CPW first; never-worn items pushed to the top because
      // they're the "haven't justified the price yet" set you'd want to action.
      const score = (it) => itemCostPerWear(it) ?? Number.POSITIVE_INFINITY;
      comparator = (a, b) => score(b) - score(a);
      break;
    }
    case 'price-desc':
      comparator = (a, b) => Number(b.price || 0) - Number(a.price || 0);
      break;
    case 'name':
      comparator = (a, b) => (a.name || '').localeCompare(b.name || '');
      break;
    case 'color': {
      // Stable group by first colour, then alphabetical within group.
      const first = (it) => (itemColors(it)[0] || 'zzz');
      comparator = (a, b) => first(a).localeCompare(first(b)) || (a.name || '').localeCompare(b.name || '');
      break;
    }
    case 'recent':
    default:
      comparator = cmpDate;
  }
  // Apply primary sort, then favourites pin. The favourites pin is applied
  // second so it overrides the primary order, putting starred items on top.
  return arr.sort((a, b) => favBoost(a, b) || comparator(a, b));
}

export default function WardrobeView({ items, deleteItem, openAddModal, measurements, onItemClick, user, onToggleFavorite, schedules = {}, outfits = [], onOpenOutfit, onBulkUpdate, onBulkDelete, onScheduleOutfit, onSaveOutfit, onLogOutfitWear, inspirations = [], onOpenInspiration, onOpenInspirationTab, aiTemperature = 0.7, onScrollTop, jumpFilter = null, jumpCategory = null, jumpNonce = 0, onOpenConcierge, onOpenBrief, onEditPreferences }) {
  // Header counts — owned only for the primary count; wishlist as secondary.
  // items here is liveItems (all non-deleted) so WardrobeView can show its own
  // All/Owned/Wishlist filter. Counts are derived separately so the headline
  // only reflects pieces the user actually owns.
  const ownedCount = items.filter((i) => i.status === 'owned').length;
  const wishlistCount = items.filter((i) => i.status === 'wishlist').length;
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const enterSelectMode = (firstId = null) => {
    setSelectMode(true);
    setSelectedIds(firstId ? new Set([firstId]) : new Set());
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const tomorrowSched = schedules[tomorrow];
  const tomorrowOutfit = tomorrowSched ? outfits.find((o) => o.id === tomorrowSched.outfitId) : null;
  const tomorrowPieces = tomorrowOutfit ? resolveOutfitItems(tomorrowOutfit, items) : [];
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [seasonFilter, setSeasonFilter] = useState('All Seasons');
  // Apply any pending jump from Insights (or another tab). nonce changes on
  // every jump request so identical { filter, category } combinations also
  // re-fire. We scroll to top so the user lands on the filtered grid head.
  useEffect(() => {
    if (!jumpNonce) return;
    if (jumpFilter !== null) setFilter(jumpFilter);
    if (jumpCategory !== null) setCategoryFilter(jumpCategory);
    onScrollTop?.();
  }, [jumpNonce, jumpFilter, jumpCategory]);
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem(WARDROBE_SORT_KEY) || 'recent'; }
    catch { return 'recent'; }
  });
  useEffect(() => {
    try { localStorage.setItem(WARDROBE_SORT_KEY, sortBy); } catch { /* private mode — fine */ }
  }, [sortBy]);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  // weatherSettled = the fetch promise has resolved (either with data or null).
  // Needed by the Daily Brief auto-compose so it doesn't fire before weather
  // is known — otherwise the Concierge sees `weather: null` and composes with
  // "weather unknown, but given it's Summer…" which contradicts the Today
  // tile rendered just below it.
  const [weatherSettled, setWeatherSettled] = useState(false);
  useEffect(() => {
    fetchTodaysWeather().then((data) => { setWeather(data); setWeatherSettled(true); });
  }, []);
  const weatherSeasons = weatherToSeasons(weather);
  // Current season for the Daily Brief (local date, same logic as OutfitBuilder).
  const currentSeason = (() => {
    const m = new Date().getMonth();
    return m >= 2 && m <= 4 ? 'Spring' : m >= 5 && m <= 7 ? 'Summer' : m >= 8 && m <= 10 ? 'Autumn' : 'Winter';
  })();

  // Recommendation uses actual temperature for appropriateness scoring.
  // weather.temp is the day's HIGH from Open-Meteo daily max — the right
  // number for dressing decisions. Falls back gracefully to null when
  // geolocation is denied or the fetch hasn't settled yet.
  const pickRec = () => {
    const owned = items.filter((i) => i.status === 'owned');
    if (owned.length === 0) return null;
    // weather.temp is the daily max temperature (°C). weatherAppropriatenessScore
    // inside pickTodaysRecommendation handles null gracefully (neutral 0.5).
    const tempC = weather?.temp ?? null;
    return pickTodaysRecommendation(owned, tempC);
  };
  const [recommendation, setRecommendation] = useState(() => pickRec());
  useEffect(() => { setRecommendation(pickRec()); /* eslint-disable-next-line */ }, [items.length, weather]);
  const [brandFilter, setBrandFilter] = useState('All Brands');
  const [subCategoryFilter, setSubCategoryFilter] = useState('All Types');
  const [styleFilter, setStyleFilter] = useState('All Styles');
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('All Colours');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const usedColors = Array.from(new Set(items.flatMap((i) => itemColors(i)))).sort();

  const allBrands = ['All Brands', ...Array.from(new Set(items.map((i) => i.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b))];

  // Sub-categories only make sense when a category that defines them is selected.
  const subCategoriesForCategory =
    categoryFilter === 'Tops' ? TOP_SUBCATEGORIES :
    categoryFilter === 'Bottoms' ? BOTTOM_SUBCATEGORIES :
    categoryFilter === 'Outerwear' ? OUTERWEAR_SUBCATEGORIES :
    categoryFilter === 'Dresses' ? DRESS_SUBCATEGORIES :
    categoryFilter === 'Accessories' ? ACCESSORY_SUBCATEGORIES :
    categoryFilter === 'Jewellery' ? JEWELLERY_SUBCATEGORIES :
    categoryFilter === 'Sportswear' ? SPORTSWEAR_SUBCATEGORIES :
    categoryFilter === 'Bags' ? BAG_SUBCATEGORIES :
    categoryFilter === 'Shoes' ? SHOE_SUBCATEGORIES :
    categoryFilter === 'Swimwear' ? SWIMWEAR_SUBCATEGORIES :
    null;

  const selectCategory = (cat) => {
    setCategoryFilter(cat);
    setSubCategoryFilter('All Types');
  };

  // One-shot reset for the entire view: search + status pill + category +
  // all five advanced filters. Sort is intentionally not reset — it's a
  // persisted preference (localStorage), not a filter the user wants
  // sweeping away just to see all items again.
  const resetAllFilters = () => {
    setSearchQuery('');
    setFilter('all');
    setCategoryFilter('All');
    setSubCategoryFilter('All Types');
    setSeasonFilter('All Seasons');
    setBrandFilter('All Brands');
    setStyleFilter('All Styles');
    setColorFilter('All Colours');
  };

  const filteredItems = items.filter(item => {
    // Status pills are 'all' | 'owned' | 'wishlist' | 'stale' | 'favorites'
    // | 'lent' | 'unavailable'.
    // Stale = owned + never worn OR last worn 90+ days ago.
    // Unavailable = owned + condition !== 'available' (in wash, ironing, damaged).
    const passesStatus =
      filter === 'all' ? true
      : filter === 'stale' ? (item.status === 'owned' && (daysSinceLastWorn(item) === null || daysSinceLastWorn(item) >= 90))
      : filter === 'favorites' ? !!item.favorite
      : filter === 'lent' ? !!item.lentTo
      : filter === 'unavailable' ? (item.status === 'owned' && !isItemAvailable(item))
      : filter === 'untagged' ? itemNeedsDetail(item)
      : item.status === filter;
    const matchCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const itemS = itemSeasons(item);
    const matchSeason = seasonFilter === 'All Seasons' || itemS.length === 0 || itemS.includes(seasonFilter);
    const matchBrand = brandFilter === 'All Brands' || item.brand === brandFilter;
    const matchSubCategory = !subCategoriesForCategory || subCategoryFilter === 'All Types' || item.subCategory === subCategoryFilter;
    const itemSt = itemStyles(item);
    const matchStyle = styleFilter === 'All Styles' || itemSt.includes(styleFilter);
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q
      || item.name?.toLowerCase().includes(q)
      || item.brand?.toLowerCase().includes(q)
      || item.description?.toLowerCase().includes(q)
      || item.purchasedFrom?.toLowerCase().includes(q)
      || item.subCategory?.toLowerCase().includes(q);
    const matchColor = colorFilter === 'All Colours' || itemColors(item).includes(colorFilter);
    return passesStatus && matchCategory && matchSeason && matchBrand && matchSubCategory && matchStyle && matchSearch && matchColor;
  });

  const sortedItems = useMemo(
    () => sortWardrobeItems(filteredItems, sortBy),
    [filteredItems, sortBy]
  );

  const activeSort = WARDROBE_SORT_OPTIONS.find((o) => o.key === sortBy) || WARDROBE_SORT_OPTIONS[0];

  // Filter state hoisted out of the render so the SAME controls JSX renders
  // identically in the desktop unified toolbar AND the mobile sticky strip
  // (single source of truth — change the badge logic once, both surfaces
  // update).
  const activeBadges = [];
  // Condition badge first — when a sheet-only status is active (In wash /
  // Lent / Stale), no pill highlights, so the badge is the only feedback
  // that the view is filtered. Put it FIRST so it reads as the dominant
  // filter, not an afterthought.
  if (CONDITION_KEYS.has(filter)) activeBadges.push({ label: CONDITION_LABEL_BY_KEY[filter], clear: () => setFilter('all') });
  if (subCategoryFilter !== 'All Types') activeBadges.push({ label: subCategoryFilter, clear: () => setSubCategoryFilter('All Types') });
  if (seasonFilter !== 'All Seasons') activeBadges.push({ label: seasonFilter, clear: () => setSeasonFilter('All Seasons') });
  if (brandFilter !== 'All Brands') activeBadges.push({ label: brandFilter, clear: () => setBrandFilter('All Brands') });
  if (styleFilter !== 'All Styles') activeBadges.push({ label: styleFilter, clear: () => setStyleFilter('All Styles') });
  if (colorFilter !== 'All Colours') activeBadges.push({ label: colorFilter, clear: () => setColorFilter('All Colours'), swatch: COLOR_SWATCHES[colorFilter] });
  const activeFilterCount = activeBadges.length;
  const anyFilterActive = !!searchQuery || filter !== 'all' || categoryFilter !== 'All' || activeFilterCount > 0;

  // Filter controls fragment — used inside both the desktop unified toolbar
  // and the mobile sticky strip. Pure JSX, no surrounding bar styling, so
  // each consumer can wrap it in its own flex/sticky container.
  // Unified hover convention across the toolbar:
  //   • Light pill rest:  bg-white border-stone-300 text-stone-700
  //   • Light pill hover: border-stone-500 text-stone-900
  //   • Dark pill rest:   bg-stone-900 text-white
  //   • Dark pill hover:  bg-stone-800
  //   • All transitions:  transition-colors duration-200 (no transform/all)
  // Single convention applied to Filters, Sort, badges, Reset, Add, Select.
  const filterControls = (
    <>
      <button onClick={() => setFiltersOpen(true)}
        className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm border transition-colors duration-200 ${
          activeFilterCount > 0
            ? 'bg-stone-900 border-stone-900 text-white hover:bg-stone-700'
            : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900'
        }`}>
        <SlidersHorizontal size={14} strokeWidth={1.5} />
        Filters
        {activeFilterCount > 0 && (
          <span className="bg-white/20 text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
        )}
      </button>

      <div className="relative shrink-0">
        <button onClick={() => setSortMenuOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm border bg-white border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors duration-200">
          <ArrowUpDown size={14} strokeWidth={1.5} />
          <span className="hidden sm:inline">{activeSort.label}</span>
          <span className="sm:hidden">Sort</span>
          <ChevronDown size={12} strokeWidth={2} className={`transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {sortMenuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setSortMenuOpen(false)} aria-hidden="true" />
            <div className="absolute z-40 mt-2 left-0 sm:left-auto sm:right-0 min-w-[15rem] bg-white rounded-2xl shadow-2xl border border-stone-200 py-2 animate-in fade-in slide-in-from-top-2 duration-150" role="menu">
              <p className="px-4 pt-1 pb-2 text-[10px] tracking-widest uppercase text-stone-400 font-medium">Sort by</p>
              {WARDROBE_SORT_OPTIONS.map((o) => {
                const isActive = o.key === sortBy;
                return (
                  <button key={o.key} onClick={() => { setSortBy(o.key); setSortMenuOpen(false); }}
                    // Menu items: stone-100 on hover (unified soft-bg hover
                    // shade — was stone-50 here, stone-100 elsewhere).
                    className={`w-full text-left px-4 py-2.5 flex items-start justify-between gap-3 transition-colors duration-200 ${
                      isActive ? 'bg-stone-100' : 'hover:bg-stone-100'
                    }`}
                    role="menuitemradio" aria-checked={isActive}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm ${isActive ? 'text-stone-900 font-medium' : 'text-stone-800'}`}>{o.label}</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">{o.hint}</p>
                    </div>
                    {isActive && <Check size={16} strokeWidth={2} className="shrink-0 text-stone-900 mt-0.5" />}
                  </button>
                );
              })}
              <div className="border-t border-stone-200 mt-2 pt-2 px-4 pb-1">
                <p className="text-[10px] text-stone-400 italic">★ Favourites always pin to the top</p>
              </div>
            </div>
          </>
        )}
      </div>

      {activeBadges.map((b, i) => (
        <button key={i} onClick={b.clear}
          // Badges use the same border-stone-300 rest / stone-500 hover as
          // Filters/Sort so the whole toolbar speaks one language.
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white border border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 group">
          {b.swatch && <span className="w-2.5 h-2.5 rounded-full border border-stone-300/50"
            style={b.swatch.startsWith('linear') ? { background: b.swatch } : { backgroundColor: b.swatch }} />}
          {b.label}
          <X size={12} strokeWidth={1.5} className="text-stone-400 group-hover:text-stone-900" />
        </button>
      ))}

      {anyFilterActive && (
        <button
          onClick={resetAllFilters}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] tracking-widest uppercase bg-white border border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors duration-200"
          title="Clear search, status, category, and all advanced filters"
        >
          <X size={12} strokeWidth={1.75} />
          Reset all
        </button>
      )}
    </>
  );

  // Add/Select controls — same unified language. Add to Collection is the
  // primary dark pill; Select is a light toggle (active = dark pill).
  const addSelectControls = (
    <>
      <button
        onClick={openAddModal}
        className="h-11 inline-flex items-center justify-center gap-2 px-5 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-700 transition-colors duration-200"
      >
        <Plus size={16} strokeWidth={1.75} /> Add to Collection
      </button>
      {items.length > 0 && (
        <button
          onClick={selectMode ? exitSelectMode : () => enterSelectMode()}
          className={`h-11 shrink-0 px-4 rounded-full text-[10px] tracking-widest uppercase border transition-colors duration-200 ${
            selectMode
              ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-700'
              : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500 hover:text-stone-900'
          }`}
          title={selectMode ? 'Cancel selection' : 'Select multiple items'}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Page header — scrolls away naturally on every breakpoint. The Filters
          / Sort row below is the sticky toolbar (better candidate: it's
          actionable, the greeting is decorative). */}
      <header
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6"
      >
        <div>
          {/* Weather chip removed — the Today card on the right owns the
              daily brief (and now uses MAX temp, which is what you dress
              for, not the current reading). One source of truth. */}
          {/* Greeting now lives on the Today home; Wardrobe is pure inventory. */}
          <div className="flex items-center gap-3 flex-wrap mb-2 lg:mb-1">
            <span className="brass-rule" aria-hidden="true"></span>
            <p className="text-stone-500 text-[10px] sm:text-xs tracking-[0.28em] uppercase font-medium">
              Your Wardrobe
            </p>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-3xl xl:text-4xl font-display text-stone-900 tracking-tight leading-[1.05]">Your Collection</h2>
          <p className="text-stone-500 mt-2 md:mt-3 lg:mt-1 text-xs md:text-sm tracking-wide uppercase font-medium">
            {ownedCount} Pieces Curated{wishlistCount > 0 && <span className="normal-case tracking-normal font-normal text-stone-400 ml-1.5">· {wishlistCount} on wishlist</span>}
          </p>
          {/* THE CONCIERGE — small inline CTA right under the greeting.
              Most discoverable on landing without being a banner-style
              intrusion. Brass icon signals 'special'; pill matches the
              app's standard secondary-button shape. Hidden until the
              user has items (the Concierge needs context to be useful). */}
          {onOpenConcierge && items.length >= 3 && (
            <button onClick={onOpenConcierge}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 hover:border-brass-400 text-stone-700 hover:text-brass-700 transition-colors duration-200 group">
              <Sparkles size={14} strokeWidth={1.5} className="text-brass-500 group-hover:text-brass-600 transition-colors" />
              <span className="text-[11px] tracking-widest uppercase font-medium">Ask the Concierge</span>
            </button>
          )}
        </div>
        {/* Add + Select controls on mobile. The bottom-nav FAB is the Concierge,
            so "add an item" lives here in the Wardrobe header (mirrors the
            desktop command toolbar's Add · Select pairing). lg:hidden because
            lg+ gets the same controls in the sticky command toolbar below. */}
        <div className="flex items-center gap-3 self-start md:self-auto lg:hidden">
          <button
            onClick={openAddModal}
            className="h-11 inline-flex items-center justify-center gap-2 px-5 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-700 transition-colors duration-200"
          >
            <Plus size={16} strokeWidth={1.75} /> Add
          </button>
          {items.length > 0 && (
            selectMode ? (
              <button onClick={exitSelectMode} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 px-4 py-2 border border-stone-200 rounded-full hover:border-stone-500 transition-colors">
                Cancel
              </button>
            ) : (
              <button onClick={() => enterSelectMode()} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 px-4 py-2 border border-stone-200 rounded-full hover:border-stone-500 transition-colors">
                Select
              </button>
            )
          )}
        </div>
      </header>

      {/* Daily Brief / Today tile / digest moved to the Today home (Effort 2).
          Wardrobe is now pure inventory. */}

      {/* ─── DESKTOP COMMAND TOOLBAR ────────────────────────────────────
          One unified sticky bar spanning the full content width, containing
          ALL view-level controls (Filters · Sort · active badges · Reset on
          the left; Add to Collection · Select on the right). Sits in flow
          above the 2-column grid; pins to top:0 when scrolled.

          Why one bar instead of two per-column sticky bars (the previous
          layout): a position:sticky element can only paint inside its own
          containing block. Putting the filter bar inside col-span-8 and
          the Add/Select bar inside col-span-4 left the column gutter —
          and any area where the col-span-4 was empty — uncovered, so
          item cards scrolling underneath were visible BETWEEN the two
          floating islands. Gold-standard fix is to host both control
          groups in a single full-width bar.

          Solid bg (no /95) because translucency over a bold product grid
          reads as cheap glass overlay — colors bleed through and the bar
          loses authority. A solid surface reads as a deliberate command
          plate. The lg:-mx-12 lg:px-12 cancels the parent padding so the
          bar bleeds edge-to-edge of the max-w-6xl content well. */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-10 lg:sticky lg:top-0 lg:z-30 lg:items-center lg:-mx-12 lg:px-12 lg:py-3 lg:bg-cream lg:border-b lg:border-stone-200/60">
        {/* LEFT REGION — col-span-8. Sits directly above the pills + grid
            in the main column below. Contains search + all filter controls.
            By mirroring the page's grid template, the toolbar reads as
            "page structure made interactive" rather than a separate strip
            floating across the layout. The gap between this region and the
            right region is the ACTUAL lg:gap-8 column gutter — same one
            that separates the main column from the Today panel — so the
            user perceives one consistent vertical rhythm. */}
        <div className="lg:col-span-8 flex items-center gap-3 min-w-0">
          <div className="relative shrink-0 w-64 xl:w-72">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, brand, description…"
              className="w-full h-11 pl-10 pr-9 bg-white border border-stone-300 rounded-full text-sm placeholder:text-stone-400 focus:border-stone-900 outline-none transition-colors"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-base pointer-events-none leading-none">⌕</span>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
                aria-label="Clear search">
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {filterControls}
          </div>
        </div>

        {/* RIGHT REGION — col-span-4. Sits directly above the Today panel
            in the aside below, so Add/Select read as "controls FOR the
            collection beneath them," not "controls floating in space."
            justify-end keeps the buttons aligned to the toolbar's right
            edge (same edge the Today card uses). */}
        <div className="lg:col-span-4 flex items-stretch gap-2 justify-end">
          {addSelectControls}
        </div>
      </div>

      {/* Two-column dashboard on lg+: wardrobe LEFT (col-span-8), Today panel RIGHT
          (col-span-4 sticky). DOM order = wardrobe first, today second — so on
          mobile users hit search/filters/grid immediately and today cards drop
          below. Explicit lg:row-start-1 on both children keeps them on the
          same row on desktop despite the DOM ordering. */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-10 lg:items-start space-y-8 lg:space-y-0">

      {/* ─── MAIN COLUMN: search, filters, grid ─── */}
      {/* Full width now (was col-span-8). The Daily Brief left the right rail
          in Effort 2; the wardrobe grid reclaims the space. Today's Pick +
          Tomorrow sit as a slim strip above (row-start-1); the grid is row-start-2. */}
      <div className="lg:col-span-12 lg:col-start-1 lg:row-start-2 space-y-6 md:space-y-8 min-w-0">

      <div className="flex flex-col gap-4 md:gap-6">
        {/* Mobile-only search. On lg+ search has moved into the unified
            sticky toolbar so it stays accessible while scrolling and so the
            toolbar's middle gap is filled (avoiding the awkward Filters-
            on-left/Add-on-right with empty void between them). */}
        <div className="relative lg:hidden">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, brand, description…"
            className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-2xl text-sm focus:border-stone-900 outline-none transition-colors"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">⌕</span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors" aria-label="Clear search">
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
        {/* Primary status — the 4 lifecycle states a user actually wants
            one-click access to. The edge cases (In wash, Lent out, Stale)
            now live in the Filters sheet under "Condition" — they were
            getting clipped on the right edge here AND adding visual chrome
            for filters most users don't use daily. */}
        <div className="flex bg-stone-200/50 p-1.5 rounded-full w-fit overflow-x-auto hide-scrollbar max-w-full">
          {[['all', 'All'], ['favorites', '★ Favourites'], ['owned', 'Owned'], ['wishlist', 'Wishlist']].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              // Active pill: white bg, bold text, no shadow (same call as
              // sidebar nav — anchored, not floating). Inactive hover gets
              // a subtle stone-100 bg too so the affordance is clearer than
              // text-only color change.
              className={`whitespace-nowrap px-4 sm:px-5 py-3 sm:py-2 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-colors duration-200 ${
                filter === f ? 'bg-white text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Categories — horizontal scroll on mobile, wrap on lg.
            Hover follows unified convention: border-stone-500 + text-stone-900. */}
        <div className="flex flex-wrap items-center gap-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 overflow-x-auto lg:overflow-visible hide-scrollbar pb-1 lg:pb-0">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => selectCategory(cat)}
              className={`shrink-0 px-4 sm:px-5 py-3 sm:py-2 rounded-full text-xs sm:text-sm border whitespace-nowrap transition-colors duration-200 ${
                categoryFilter === cat
                  ? 'bg-stone-900 border-stone-900 text-white hover:bg-stone-700'
                  : 'bg-transparent border-stone-300 text-stone-600 hover:border-stone-500 hover:text-stone-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

      </div>

      {/* MOBILE-ONLY sticky filter strip. Desktop uses the unified command
          toolbar at the top of the wardrobe view instead. lg:hidden so the
          two surfaces don't both render at lg+ (which would double-stick). */}
      <div className="lg:hidden flex flex-wrap items-center gap-2 sticky top-0 z-20 -mx-4 px-4 py-3 bg-cream border-b border-stone-200/60"
           style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        {filterControls}
      </div>

      <WardrobeFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filter={filter}
        setFilter={setFilter}
        subCategories={subCategoriesForCategory}
        subCategoryFilter={subCategoryFilter}
        setSubCategoryFilter={setSubCategoryFilter}
        seasonFilter={seasonFilter}
        setSeasonFilter={setSeasonFilter}
        allBrands={allBrands}
        brandFilter={brandFilter}
        setBrandFilter={setBrandFilter}
        styleFilter={styleFilter}
        setStyleFilter={setStyleFilter}
        usedColors={usedColors}
        colorFilter={colorFilter}
        setColorFilter={setColorFilter}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
        {sortedItems.map(item => {
          const isSelected = selectedIds.has(item.id);
          return (
          <div
            key={item.id}
            onClick={() => selectMode ? toggleSelected(item.id) : onItemClick?.(item.id)}
            onContextMenu={(e) => { e.preventDefault(); if (!selectMode) enterSelectMode(item.id); }}
            // Editorial product-card pattern (Net-a-Porter / MatchesFashion /
            // Mr Porter / SSENSE): cursor:pointer + hover zoom is enough
            // click affordance. NO press-scale on the wrapper — even with
            // stopPropagation on inner buttons (chevrons, favourite star),
            // CSS :active still cascades up the DOM, which made the whole
            // card (image + text) jump when the user clicked a chevron.
            // The press-scale was also a mobile-app idiom out of place in
            // an editorial product grid.
            className={`group relative flex flex-col gap-4 cursor-pointer ${selectMode && isSelected ? 'ring-2 ring-stone-900 rounded-2xl' : ''}`}
          >
            {/* Image surface: this is where ALL hover effects happen.
                Soft shadow lift (smooth-shadow → shadow-xl) tells the user
                "this is interactive"; the image zoom inside (group-hover:
                scale-105, defined in WardrobeCardImage) invites exploration.
                Shadow transition matched to the image's 700ms zoom so the
                two effects feel like one orchestrated motion, not two. */}
            <div className={`aspect-[3/4] rounded-2xl bg-stone-100 relative overflow-hidden smooth-shadow lg:group-hover:shadow-xl transition-shadow duration-500 ${selectMode && isSelected ? 'opacity-90' : ''}`}>
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap max-w-[calc(100%-3.5rem)]">
                {item.status === 'wishlist' && (
                  <span className="glass-panel text-stone-900 text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                    <Heart size={12} className="fill-stone-900" strokeWidth={0} /> Wishlist
                  </span>
                )}
                {item.lentTo && (() => {
                  const overdue = item.lentReturnBy && item.lentReturnBy < todayISO();
                  return (
                    <span className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 ${
                      overdue ? 'bg-red-600 text-white' : 'glass-panel text-stone-900'
                    }`}>
                      {overdue ? 'Overdue' : `Lent · ${item.lentTo}`}
                    </span>
                  );
                })()}
                {!isItemAvailable(item) && (() => {
                  const meta = ITEM_CONDITIONS.find((c) => c.key === itemCondition(item));
                  const tones = {
                    blue: 'bg-blue-600 text-white',
                    amber: 'bg-amber-500 text-white',
                    red: 'bg-red-600 text-white',
                  };
                  return (
                    <span className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium ${tones[meta?.color] || 'bg-stone-700 text-white'}`}>
                      {meta?.short || itemCondition(item)}
                    </span>
                  );
                })()}
              </div>
              {selectMode ? (
                <div
                  className={`absolute top-4 right-4 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm ${
                    isSelected ? 'bg-stone-900 text-white' : 'bg-white/90 border border-stone-300 text-transparent'
                  }`}
                  aria-label={isSelected ? 'Selected' : 'Not selected'}
                >
                  <Check size={16} strokeWidth={2.5} />
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(item); }}
                  className={`absolute top-4 right-4 z-20 p-2.5 rounded-full transition-all active:scale-90 shadow-sm ${
                    item.favorite
                      ? 'bg-brass-300 text-stone-900 opacity-100'
                      : 'bg-white/80 backdrop-blur-md text-stone-400 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-500'
                  }`}
                  aria-label={item.favorite ? 'Remove favourite' : 'Mark as favourite'}
                >
                  <Star size={16} strokeWidth={1.5} className={item.favorite ? 'fill-stone-900' : ''} />
                </button>
              )}

              <WardrobeCardImage item={item} />
            </div>

            <div className="px-1">
              <div className="flex justify-between items-start mb-1.5 gap-4">
                <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">
                  {item.brand}{itemSeasons(item).length > 0 && ` • ${itemSeasons(item).join(' · ')}`}
                </p>
                <p className="text-sm font-medium text-stone-900 shrink-0">£{item.price}</p>
              </div>
              <h3 className="font-display text-lg text-stone-800 leading-snug">{item.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {item.subCategory && (
                  <p className="text-xs text-stone-500">{item.category} • {item.subCategory}</p>
                )}
                {itemColors(item).length > 0 && (
                  <div className="flex gap-1">
                    {itemColors(item).slice(0, 3).map((c) => {
                      const swatch = COLOR_SWATCHES[c];
                      return <span key={c} title={c} className="w-2.5 h-2.5 rounded-full border border-stone-300/50"
                        style={swatch?.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }} />;
                    })}
                  </div>
                )}
              </div>
              {item.status === 'owned' && (() => {
                const w = itemWearCount(item);
                const cpw = itemCostPerWear(item);
                const days = daysSinceLastWorn(item);
                const stale = days === null || days >= 90;
                return (
                  <p className={`text-[11px] mt-1.5 tracking-wide ${stale ? 'text-stone-400' : 'text-stone-600'}`}>
                    {w === 0 ? 'Not worn yet'
                      : `${w} ${w === 1 ? 'wear' : 'wears'}${cpw !== null ? ` · £${cpw < 10 ? cpw.toFixed(2) : Math.round(cpw)}/wear` : ''}`}
                  </p>
                );
              })()}

              {item.status === 'wishlist' && (
                <div className="mt-3 text-[11px] py-2 px-3 rounded-lg flex items-start gap-2 bg-stone-100 text-stone-600">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>
                    {measurements.waist
                      ? 'Cross-check the brand\'s size chart against your Profile measurements before buying.'
                      : 'Add measurements in Profile to make size comparison easier before buying.'}
                  </span>
                </div>
              )}
            </div>
          </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 md:py-28 flex flex-col items-center justify-center text-center bg-white/50 border border-dashed border-stone-300 rounded-3xl px-6">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-6 text-stone-300">
              <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 3" />
              <path d="M28 28 L24 32 L20 30 L24 46 H56 L60 30 L56 32 L52 28 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
              <path d="M32 28 Q40 34 48 28" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
              <line x1="36" y1="52" x2="44" y2="60" stroke="currentColor" strokeWidth="0.6" />
              <line x1="44" y1="52" x2="36" y2="60" stroke="currentColor" strokeWidth="0.6" />
            </svg>
            <p className="font-display text-2xl text-stone-700 tracking-tight">Nothing here yet</p>
            <p className="text-sm text-stone-500 mt-3 max-w-sm">
              {items.length === 0
                ? 'Tap + to add your first piece — by link, photo, or manual entry.'
                : 'Try a different filter, or clear the search.'}
            </p>
            {items.length === 0 && (
              <button onClick={openAddModal} className="mt-8 bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-[0.98] inline-flex items-center gap-2">
                <Plus size={16} strokeWidth={1.5} /> Add your first item
              </button>
            )}
          </div>
        )}
      </div>

      </div>
      {/* ─── /MAIN COLUMN ─── */}

      {/* ─── ASIDE: Today panel (desktop-only sticky right column) ─── */}
      {/* Hidden on mobile (`hidden lg:flex`) — mobile gets a compact
          TodayTile + DailyDigest at the TOP of the wardrobe view instead,
          so daily actions stay one tap away without burying search/filters
          or stacking under the grid. The top offset (lg:top-36) sits the
          aside just below the sticky page header. */}
      {/* Right column — today panel only. Add/Select moved into the unified
          desktop toolbar at the top of the wardrobe view (above the grid),
          so this column no longer needs its own sticky bar. Cards flow
          naturally and scroll with the page. */}
      <aside className="hidden lg:grid lg:grid-cols-2 lg:col-span-12 lg:col-start-1 lg:row-start-1 gap-3 lg:pb-2 items-start">
        {/* Daily Brief / Today tile / digest moved to the Today home (Effort 2).
            This rail now carries only "Today's Pick" — a weather-aware nudge
            from your own pieces, which stays with the wardrobe. */}
        {recommendation && (() => {
          const reasons = [];
          const tempC = weather?.temp ?? null;
          if (tempC != null) {
            const fit = weatherAppropriatenessScore(recommendation, tempC);
            // Only show the weather note when the item genuinely passes
            // temperature appropriateness (fit >= 0.5 = neutral-to-good).
            // Below that it still surfaces as Today's Pick (no hard block at
            // the card level — the hard filter is inside pickTodaysRecommendation),
            // but we don't mislead with "fits today's 34°C" for a borderline pick.
            if (fit >= 0.5) {
              reasons.push(`fits today's ${Math.round(tempC)}°C`);
            } else {
              reasons.push(`for today's ${Math.round(tempC)}°C`);
            }
          }
          const days = daysSinceLastWorn(recommendation);
          if (days === null) reasons.push("never worn");
          else if (days >= 30) reasons.push(`not worn in ${Math.floor(days / 30)} month${days < 60 ? '' : 's'}`);
          else if (days >= 14) reasons.push(`not worn in ${days} days`);
          return (
            <button onClick={() => onItemClick?.(recommendation.id)}
              className="text-left w-full bg-stone-900 text-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 flex items-center gap-4 group hover:bg-stone-700 transition-all smooth-shadow active:scale-[0.98]">
              <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden bg-stone-800 shrink-0">
                {itemImages(recommendation)[0] && <img src={itemImages(recommendation)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400 mb-1.5 flex items-center gap-2">
                  <span className="brass-rule" aria-hidden="true"></span> Today's pick
                </p>
                <p className="font-display text-base sm:text-lg text-white leading-tight truncate">{recommendation.name}</p>
                <p className="text-[11px] text-stone-400 mt-1 truncate">
                  {(() => {
                    const recSeasons = itemSeasons(recommendation);
                    return (
                      <>
                        {recommendation.brand}
                        {recSeasons.length > 0 && ` · ${recSeasons.join(' · ')}`}
                      </>
                    );
                  })()}
                </p>
                {reasons.length > 0 && (
                  <p className="text-[10px] text-emerald-300/90 mt-2 tracking-wide italic truncate" title={reasons.join(' · ')}>
                    Suggested · {reasons.join(' · ')}
                  </p>
                )}
              </div>
            </button>
          );
        })()}

        {tomorrowOutfit && (
          <button onClick={() => onOpenOutfit?.(tomorrowOutfit.id)}
            className="text-left w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-amber-100/70 transition-all active:scale-[0.99]">
            <div className="flex gap-1 shrink-0">
              {tomorrowPieces.slice(0, 3).map((p) => (
                <div key={p.id} className="w-10 h-12 rounded-md overflow-hidden bg-white border border-amber-100">
                  {itemImages(p)[0] && <img src={itemImages(p)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] tracking-[0.2em] uppercase text-brass-700 font-semibold">✦ Tomorrow</p>
              <p className="font-display text-sm text-stone-900 truncate mt-0.5">{tomorrowOutfit.name}</p>
              <p className="text-[11px] text-stone-500">{tomorrowPieces.length} pieces · tap to view</p>
            </div>
            <ChevronRight size={18} className="text-brass-600 shrink-0" />
          </button>
        )}
      </aside>
      {/* ─── /ASIDE ─── */}

      </div>
      {/* ─── /two-column grid ─── */}

      {selectMode && createPortal(
        <div className="fixed left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
          <div className="pointer-events-auto bg-stone-900 text-white rounded-full shadow-2xl flex items-center gap-1 sm:gap-2 pl-5 pr-2 py-2 max-w-full overflow-x-auto hide-scrollbar">
            <span className="text-xs tracking-widest uppercase text-stone-300 shrink-0 pr-2 border-r border-stone-700">
              {selectedIds.size} selected
            </span>
            <button
              disabled={selectedIds.size === 0}
              onClick={async () => {
                const ids = [...selectedIds];
                const allFav = ids.every((id) => items.find((i) => i.id === id)?.favorite);
                await onBulkUpdate?.(ids, { favorite: !allFav });
                exitSelectMode();
              }}
              className="text-xs tracking-wider uppercase px-3 py-2 rounded-full hover:bg-stone-700 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Star size={14} strokeWidth={1.5} /> Favourite
            </button>
            <button
              disabled={selectedIds.size === 0}
              onClick={async () => {
                const ids = [...selectedIds];
                const allWish = ids.every((id) => items.find((i) => i.id === id)?.status === 'wishlist');
                await onBulkUpdate?.(ids, { status: allWish ? 'owned' : 'wishlist' });
                exitSelectMode();
              }}
              className="text-xs tracking-wider uppercase px-3 py-2 rounded-full hover:bg-stone-700 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Heart size={14} strokeWidth={1.5} /> Wishlist
            </button>
            <button
              disabled={selectedIds.size === 0}
              onClick={async () => {
                const ids = [...selectedIds];
                if (!window.confirm(`Move ${ids.length} item${ids.length === 1 ? '' : 's'} to Trash?`)) return;
                await onBulkDelete?.(ids);
                exitSelectMode();
              }}
              className="text-xs tracking-wider uppercase px-3 py-2 rounded-full hover:bg-red-900/40 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Trash2 size={14} strokeWidth={1.5} /> Delete
            </button>
            <button
              onClick={exitSelectMode}
              className="text-xs tracking-wider uppercase px-4 py-2 rounded-full bg-white text-stone-900 ml-1 shrink-0"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
