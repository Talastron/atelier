import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { Bookmark, Camera, Check, CheckCircle2, ChevronRight, GripVertical, Save, Shirt, Sparkles, Star, Trash2, Wand2, X } from "lucide-react";
import { OUTFIT_SLOTS, emptyOutfit, isMultiSlot, itemFitsSlot, slotForItem, slotItems } from "../lib/outfit.js";
import { MOOD_PRESETS, STYLES } from "../lib/taxonomy.js";
import { colorsHarmonize, hexFromColorName } from "../lib/color.js";
import { daysSinceLastWorn, itemColors, itemImages, itemSeasons, itemStyles, live, newId, resolveOutfitItems } from "../lib/items.js";
import { generateOutfitWithGemini, generateOutfitNameWithGemini, generateOutfitTagsWithGemini } from "../lib/ai.js";
import { isAIEnabled } from "../firebase.js";
import { haptic } from "../lib/haptic.js";
import EditorialHeader from "../ui/EditorialHeader.jsx";
import { useToast } from "../ui/toast.jsx";
import { useEscapeKey } from "../ui/hooks.js";
import WhyThisPanel from "../components/WhyThisPanel.jsx";
import { renderTextWithChips } from "../components/ItemChip.jsx";
import AIProgressModal from "../components/AIProgressModal.jsx";
import DiaryView from "./Calendar.jsx";

function LookbookSortableCard({ outfit, items, isSelected, selectMode, isHero, indexLabel, onClick, onContextMenu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: outfit.id });
  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 60 : undefined,
  };
  const resolvedItems = resolveOutfitItems(outfit, items);
  const wornPhoto = Array.isArray(outfit.wornPhotos) && outfit.wornPhotos.length > 0
    ? outfit.wornPhotos[outfit.wornPhotos.length - 1]?.image
    : null;
  const SLOT_PRIORITY = ['Dresses', 'Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
  const orderedPieces = [...resolvedItems].sort((a, b) => {
    const ai = SLOT_PRIORITY.indexOf(a.category);
    const bi = SLOT_PRIORITY.indexOf(b.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const gridPieces = orderedPieces.slice(0, isHero ? 6 : 4);
  const extraCount = Math.max(0, resolvedItems.length - gridPieces.length);
  // Hero gets landscape 16:10 (magazine-cover proportions) on desktop
  // where it spans 2 cols. On mobile (single col) it'd render SHORTER
  // than secondary portrait cards — defeating the "featured" treatment.
  // So mobile gets a tall 3:4 portrait, making the hero visibly more
  // prominent than the 4:5 secondary cards. Inner thumbnail grid flips
  // shape with the container: 2x3 portrait on mobile, 3x2 landscape on
  // desktop.
  const aspect = isHero ? 'aspect-[3/4] md:aspect-[16/10]' : 'aspect-[4/5]';
  const gridCols = isHero ? 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2' : 'grid-cols-2 grid-rows-2';
  return (
    <div ref={setNodeRef} style={style}
         className={isHero ? 'md:col-span-2' : ''}>
      <div onClick={onClick} onContextMenu={onContextMenu}
           role="button" tabIndex={0}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
           className="text-left group cursor-pointer relative">
        {selectMode && (
          <span className={`absolute top-3 left-3 z-30 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all backdrop-blur ${
            isSelected ? 'bg-stone-900 border-stone-900' : 'bg-white/90 border-stone-300'
          }`}>
            {isSelected && <CheckCircle2 size={16} strokeWidth={2.5} className="text-white" />}
          </span>
        )}

        {/* Magazine-cover treatment: the card is a self-contained artifact.
            Title lives INSIDE the card at the bottom (postcard style), so the
            entire look — image, brass-rule, title, drag handle — fits inside
            one bounded rectangle. No external caption below saves ~80px of
            vertical space per card, getting more cards above the fold on
            typical laptop viewports.
            Hover signal = border colour shift to brass only. No scale, no
            shadow lift, no image zoom. Restraint signals premium. */}
        <div className={`relative ${aspect} rounded-[1.5rem] overflow-hidden transition-colors duration-300 flex flex-col ${
          isSelected
            ? 'ring-4 ring-stone-900'
            : 'border border-stone-200/60 lg:group-hover:border-brass-300/70'
        } ${wornPhoto ? 'bg-stone-900' : 'bg-stone-100/70'}`}>

          {/* IMAGE AREA — flex-1 takes the available height above the caption. */}
          <div className="flex-1 min-h-0 relative">
            {wornPhoto && (
              <>
                <img src={wornPhoto} alt={outfit.name} loading="lazy" decoding="async"
                  className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none"></div>
              </>
            )}

            {!wornPhoto && gridPieces.length > 0 && (
              <div className={`absolute inset-0 ${isHero ? 'px-9 pt-12 pb-3 md:px-12 md:pt-14 md:pb-4' : 'px-7 pt-10 pb-3 sm:px-9 sm:pt-12 sm:pb-4'} grid ${gridCols} gap-4 sm:gap-5`}>
                {Array.from({ length: isHero ? 6 : 4 }).map((_, slotIdx) => {
                  const piece = gridPieces[slotIdx];
                  if (!piece) return <div key={slotIdx} aria-hidden="true" />;
                  const img = itemImages(piece)[0];
                  const lastSlot = isHero ? 5 : 3;
                  const showExtra = slotIdx === lastSlot && extraCount > 0;
                  return (
                    <div key={piece.id} className="relative bg-white rounded-lg overflow-hidden shadow-sm ring-1 ring-black/5">
                      {img ? (
                        <img src={img} alt={piece.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={24} strokeWidth={1} /></div>
                      )}
                      {showExtra && (
                        <div className="absolute inset-0 bg-stone-900/55 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="font-display text-3xl text-white">+{extraCount}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!wornPhoto && gridPieces.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                <Shirt size={56} strokeWidth={0.8} />
              </div>
            )}

            {/* Editorial chrome lives over the image area: N° series label
                + piece count + brass-rule top-left; favourite chip top-right;
                drag handle bottom-right (visible on hover). All absolute
                within the image area only, so they don't intrude on the
                caption strip below. */}
            <div className="absolute top-5 left-5 z-20 flex items-center gap-2.5">
              <span className={`inline-block w-4 h-px ${wornPhoto ? 'bg-brass-200' : 'bg-brass-300'}`} aria-hidden="true"></span>
              <span className={`text-[9px] tracking-[0.28em] uppercase font-medium ${wornPhoto ? 'text-white/90' : 'text-stone-500'}`}>
                {indexLabel} · {resolvedItems.length} {resolvedItems.length === 1 ? 'piece' : 'pieces'}
              </span>
            </div>
            {outfit.favorite && (
              <span className="absolute top-4 right-4 z-20 w-7 h-7 rounded-full bg-brass-300 flex items-center justify-center" title="Favourite">
                <Star size={12} strokeWidth={1.5} className="fill-stone-900 text-stone-900" />
              </span>
            )}
            <button type="button"
              {...attributes} {...listeners}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className="hidden lg:flex absolute bottom-4 right-4 z-30 w-9 h-9 items-center justify-center rounded-full bg-white/90 backdrop-blur ring-1 ring-stone-200 text-stone-500 hover:text-stone-900 hover:bg-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Rearrange this look"
              title="Drag to rearrange"
            >
              <GripVertical size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* CAPTION STRIP — inside the card at the bottom. Sits on the cream
              surface for grid covers (a tiny brass-rule divider above
              separates it from the image area); on photo covers, a tall
              dark gradient blends the title into the photo (magazine-cover
              style, no hard edge).
              Title intentionally larger on the hero card to preserve the
              magazine-cover visual hierarchy. */}
          {wornPhoto ? (
            <div className="relative z-20 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-16 pb-5 px-6">
              <h3 className={`font-display ${isHero ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'} text-white leading-tight drop-shadow-sm truncate`}>
                {outfit.name}
              </h3>
              {outfit.intent && (
                <p className="text-[10px] tracking-[0.28em] uppercase text-white/80 mt-1.5 truncate">
                  {outfit.intent}
                </p>
              )}
              {outfit.tags && outfit.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {outfit.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/15 border border-white/25 text-white/80 text-[10px] tracking-wide uppercase"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative z-20 px-7 pb-6 pt-2 sm:px-9 sm:pb-7">
              <h3 className={`font-display ${isHero ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'} text-stone-900 leading-tight truncate lg:group-hover:text-stone-700 transition-colors`}>
                {outfit.name}
              </h3>
              {outfit.intent && (
                <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 mt-1.5 truncate">
                  {outfit.intent}
                </p>
              )}
              {outfit.tags && outfit.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {outfit.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-[10px] tracking-wide uppercase"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OutfitBuilder({ items, outfits, saveOutfit, deleteOutfit, onOpenOutfit, onOpenItem, aiHistory = [], saveAIHistory, deleteAIHistory, toggleAIHistoryFavorite, schedules = {}, scheduleOutfit, aiTemperature = 0.7, styleProfile = '', measurements = null, onCreateLookbook, editOutfit = null, onEditDone, mode = 'studio', seedOutfit = null, onSeedConsumed, onAfterSave, onApplyHistory, onReorderOutfits, initialTab = null, onInitialTabConsumed, onEditPreferences, collections = [], onCreateCollection = null, onAddOutfitToCollection = null, onRemoveOutfitFromCollection = null, onDeleteCollection = null }) {
  // mode === 'studio'   → Create flow only (intent panel + composition)
  // mode === 'lookbook' → Saved / Calendar / AI History tabs only (no Create)
  // This split lets one component power two sidebar destinations: Studio is
  // for MAKING looks, Lookbook is for BROWSING/managing them. Both share the
  // same underlying handlers (saveOutfit, scheduleOutfit, etc.) so the data
  // layer doesn't fork.
  const isLookbook = mode === 'lookbook';
  const [tab, setTab] = useState(initialTab && isLookbook ? initialTab : (isLookbook ? 'saved' : 'create'));
  // When the parent passes initialTab (e.g. user clicks 'Open the Diary'
  // in Insights, which routes to Lookbook with initialTab='diary'),
  // sync to it and tell the parent it's been consumed so the hint clears.
  useEffect(() => {
    if (initialTab && isLookbook && initialTab !== tab) {
      setTab(initialTab);
      onInitialTabConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [currentOutfit, setCurrentOutfit] = useState(emptyOutfit);
  const [outfitName, setOutfitName] = useState('');
  // Studio archives: by default only owned items appear in slot pools.
  // When includeWishlist is ON, wishlist items are also eligible and get
  // a brass "WISHLIST" badge so the user knows they're composing around
  // a piece they don't yet own.
  const [includeWishlist, setIncludeWishlist] = useState(false);
  const composableItems = useMemo(
    () => includeWishlist ? items : items.filter((i) => i.status === 'owned'),
    [items, includeWishlist]
  );
  // Single accordion: at most one slot expanded at a time in the Wardrobe
  // Archives. null = all collapsed.
  const [expandedSlot, setExpandedSlot] = useState(null);
  // Refs to each archive section header so handleSelect can scroll the
  // next open section into view after a pick.
  const archiveSectionRefs = React.useRef({});
  // When editing an existing outfit, hold its id so handleSave updates the
  // same doc instead of creating a new one. Reset to null after save/exit.
  const [editingId, setEditingId] = useState(null);
  useEffect(() => {
    if (!editOutfit) return;
    // Resolve itemIds → items and place each into its proper slot, mirroring
    // the AI-styled load path in handleAIStyle.
    const next = emptyOutfit();
    const ids = Array.isArray(editOutfit.itemIds) ? editOutfit.itemIds : [];
    for (const id of ids) {
      const it = items.find((i) => i.id === id);
      if (!it) continue;
      const slot = slotForItem(it);
      if (!slot) continue;
      const key = slot.toLowerCase();
      if (isMultiSlot(slot)) {
        next[key] = Array.isArray(next[key]) ? [...next[key], it] : [it];
      } else if (!next[key]) {
        next[key] = it;
      }
    }
    setCurrentOutfit(next);
    setOutfitName(editOutfit.name || '');
    setEditingId(editOutfit.id);
    setTab('create');
    // EDIT MODE: auto-expand the first filled slot so the user can see
    // what's in the look immediately and pick something to swap.
    const firstFilledSlot = OUTFIT_SLOTS.find((s) => slotItems(next[s.toLowerCase()]).length > 0) || null;
    setExpandedSlot(firstFilledSlot);
    setAiTags([]);  // clear stale AI tags from a prior generation
  }, [editOutfit?.id]);
  // Seed loader — when Lookbook hands off an AI history entry via
  // navigation, hydrate the canvas without setting editingId. The save
  // that follows creates a NEW outfit (AI history entries aren't outfits).
  useEffect(() => {
    if (!seedOutfit) return;
    const next = emptyOutfit();
    for (const id of seedOutfit.itemIds || []) {
      const it = items.find((i) => i.id === id);
      if (!it) continue;
      const slot = slotForItem(it);
      if (!slot) continue;
      const key = slot.toLowerCase();
      if (isMultiSlot(slot)) next[key] = Array.isArray(next[key]) ? [...next[key], it] : [it];
      else if (!next[key]) next[key] = it;
    }
    setCurrentOutfit(next);
    if (seedOutfit.reasoning) setAiNote(seedOutfit.reasoning);
    setEditingId(null); // not editing; this is a seed for a NEW save
    setTab('create');
    if (onSeedConsumed) onSeedConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedOutfit?.id]);
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [styleIntent, setStyleIntent] = useState('Any');
  const [suggestingName, setSuggestingName] = useState(false);
  const [customIntent, setCustomIntent] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedOutfits, setSelectedOutfits] = useState(() => new Set());
  const [lookbookNamerOpen, setLookbookNamerOpen] = useState(false);
  const [lookbookBusy, setLookbookBusy] = useState(false);
  const [outfitsFilter, setOutfitsFilter] = useState('all');
  const [activeTagFilter, setActiveTagFilter] = useState(null); // null = "All"
  const [sortMode, setSortMode] = useState('recent'); // recent | most-worn | a-z
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null); // collectionId or null
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  // Sort by user-arranged `order` field (set via Lookbook drag-to-reorder).
  // Outfits without `order` fall back to createdAt-descending so newly-saved
  // looks land at the top before the user has explicitly arranged anything.
  const sortedAllOutfits = React.useMemo(() => {
    const arr = [...outfits];
    arr.sort((a, b) => {
      const ao = typeof a.order === 'number' ? a.order : null;
      const bo = typeof b.order === 'number' ? b.order : null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1; // explicitly-ordered ahead of unsorted
      if (bo !== null) return 1;
      // Both unsorted → newest first by createdAt
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return arr;
  }, [outfits]);
  // Base filter: favorites vs all (existing behaviour)
  const baseFilteredOutfits = outfitsFilter === 'favorites' ? sortedAllOutfits.filter((o) => o.favorite) : sortedAllOutfits;

  // Union of all tags across the base-filtered set, sorted by frequency (most-used first).
  // Cap at 12 chips to keep the row readable on narrow screens.
  const tagUnion = React.useMemo(() => {
    const m = new Map();
    for (const o of baseFilteredOutfits) {
      for (const t of (o.tags || [])) {
        m.set(t, (m.get(t) || 0) + 1);
      }
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [baseFilteredOutfits]);

  // Tag filter applied on top of the favorites filter
  const tagFilteredOutfits = activeTagFilter
    ? baseFilteredOutfits.filter((o) => Array.isArray(o.tags) && o.tags.includes(activeTagFilter))
    : baseFilteredOutfits;

  // Sort the tag-filtered set according to sortMode.
  // 'recent' honours the existing drag-to-reorder `order` field (falls back to
  // createdAt-descending) — this matches the original sortedAllOutfits behaviour
  // so the user's manual arrangement is respected by default.
  const filteredOutfits = React.useMemo(() => {
    if (sortMode === 'most-worn') {
      const wears = (o) => Array.isArray(o.wornPhotos) ? o.wornPhotos.length : 0;
      return [...tagFilteredOutfits].sort((a, b) => wears(b) - wears(a));
    }
    if (sortMode === 'a-z') {
      return [...tagFilteredOutfits].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    // 'recent' — already in order from sortedAllOutfits, just return as-is
    return tagFilteredOutfits;
  }, [tagFilteredOutfits, sortMode]);

  // Collection filter: if a collection is active, narrow to its outfitIds
  const collectionFilteredOutfits = React.useMemo(() => {
    if (!activeCollection) return filteredOutfits;
    const coll = collections.find((c) => c.id === activeCollection);
    if (!coll) return filteredOutfits;
    const idSet = new Set(coll.outfitIds);
    return filteredOutfits.filter((o) => idSet.has(o.id));
  }, [filteredOutfits, activeCollection, collections]);

  const toast = useToast();

  // Desktop: PointerSensor for click-and-drag. We omit TouchSensor by design —
  // on mobile, drag-from-stacked-layout is genuinely awkward (slots scroll above
  // the source). Tap-to-assign is the mobile path, with haptic + toast feedback.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event) => {
    const data = event.active.data.current;
    if (data?.item) setActiveDragItem(data.item);
  };

  const handleDragEnd = (event) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || !active.data.current?.item) return;
    const slot = String(over.id).startsWith('slot-') ? String(over.id).replace('slot-', '') : null;
    if (slot) handleSelect(slot, active.data.current.item);
  };

  const handleSelect = (slot, item) => {
    const key = slot.toLowerCase();
    if (isMultiSlot(slot)) {
      // Tap toggles membership; pieces stack. Tap again to remove.
      setCurrentOutfit((prev) => {
        const existing = slotItems(prev[key]);
        const has = existing.some((x) => x.id === item.id);
        const next = has ? existing.filter((x) => x.id !== item.id) : [...existing, item];
        return { ...prev, [key]: next };
      });
      haptic('tap');
      toast.show(`${slot}: ${item.name}`, { kind: 'default', duration: 1400 });
      // Multi-slots stay expanded — user is mid-curation, don't fight them.
    } else {
      setCurrentOutfit((prev) => ({ ...prev, [key]: item }));
      if (item) {
        haptic('tap');
        toast.show(`Added to ${slot}`, { kind: 'default', duration: 1400 });
        // Auto-flow: collapse current slot, scroll to next open section.
        setExpandedSlot(null);
        setTimeout(() => scrollToNextOpenSection(slot, { tops: slot === 'Tops' ? item : currentOutfit.tops, bottoms: slot === 'Bottoms' ? item : currentOutfit.bottoms, dresses: slot === 'Dresses' ? item : currentOutfit.dresses }), 150);
      }
    }
  };

  // Mutual-exclusion rules: dress vs separates. If a dress is filled,
  // tops/bottoms are 'covered' (and vice versa). The user can override
  // via the "Add anyway" link in the collapsed summary.
  const isSlotCovered = (slot, outfit = currentOutfit) => {
    const hasDress = !!outfit.dresses;
    const hasTopOrBottom = !!outfit.tops || !!outfit.bottoms;
    if (slot === 'Tops' || slot === 'Bottoms') return hasDress;
    if (slot === 'Dresses') return hasTopOrBottom;
    return false;
  };
  const isSlotFilled = (slot, outfit = currentOutfit) =>
    slotItems(outfit[slot.toLowerCase()]).length > 0;
  // Accordion: toggle the one expanded slot; close if already open.
  const toggleSlotExpansion = (slot) => {
    setExpandedSlot((prev) => (prev === slot ? null : slot));
  };
  // Auto-scroll when a slot expands so it's never lost above/below viewport.
  React.useEffect(() => {
    if (!expandedSlot) return;
    const el = archiveSectionRefs.current[expandedSlot];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [expandedSlot]);
  const scrollToNextOpenSection = (currentSlot, outfitOverride) => {
    const startIdx = OUTFIT_SLOTS.indexOf(currentSlot);
    if (startIdx < 0) return;
    for (let i = startIdx + 1; i < OUTFIT_SLOTS.length; i++) {
      const slot = OUTFIT_SLOTS[i];
      if (isSlotFilled(slot, outfitOverride) || isSlotCovered(slot, outfitOverride)) continue;
      // Expand this slot in the accordion (the useEffect will scroll it into view).
      setExpandedSlot(slot);
      return;
    }
  };

  // AI name suggestion — saves the user from naming fatigue. Pulls the
  // currently-picked items + intent into a short evocative phrase via
  // Gemini, then drops it into the name input. Toast on failure.
  const handleSuggestName = async () => {
    const picked = OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]));
    if (picked.length === 0) {
      toast.show('Pick at least one piece first', { kind: 'default' });
      return;
    }
    setSuggestingName(true);
    // Show the naming-phase label in the AI progress modal if it happens
    // to be open (e.g. user triggered name suggestion while AI is still
    // running); harmless no-op otherwise since the modal gates on aiBusy.
    setAiStage('Titling the look…');
    try {
      const intent = customIntent.trim() || (styleIntent !== 'Any' ? styleIntent : '');
      const name = await generateOutfitNameWithGemini(picked, intent);
      if (name) {
        setOutfitName(name);
        haptic('tap');
      }
    } catch (err) {
      toast.show(err?.message || 'Could not suggest a name', { kind: 'error' });
    } finally {
      setSuggestingName(false);
    }
  };

  const handleSave = () => {
    const picked = OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]));
    if (!outfitName.trim() || picked.length === 0) return;
    // When editing, preserve the original id, createdAt, and any existing
    // wornPhotos/favorite/reasoning that we shouldn't blow away.
    const orig = editingId ? outfits.find((o) => o.id === editingId) : null;
    saveOutfit({
      ...(orig || {}),
      id: editingId || newId(),
      name: outfitName,
      itemIds: picked.map((p) => p.id),
      createdAt: orig?.createdAt || new Date().toISOString(),
      ...(aiNote ? { reasoning: aiNote } : (orig?.reasoning ? { reasoning: orig.reasoning } : {})),
      ...(customIntent.trim() || styleIntent !== 'Any' ? { intent: customIntent.trim() || styleIntent } : {}),
      ...(aiTags && aiTags.length > 0 ? { tags: aiTags } : (orig?.tags ? { tags: orig.tags } : {})),
    });
    setOutfitName(''); setCurrentOutfit(emptyOutfit());
    setAiNote(null);
    setAiTags([]);
    setEditingId(null);
    if (onEditDone) onEditDone();
    // Studio mode: notify parent so it can navigate to Lookbook (user
    // sees their newly-saved look in context). Lookbook mode: switch
    // to the Lookbook tab so the new outfit is visible inline.
    if (onAfterSave) onAfterSave();
    else setTab('saved');
  };

  // Gold-standard generator: strict 1:1 category/slot, hard filters BEFORE
  // scoring (items that actively conflict are removed, not just penalised),
  // then anchor on first pick to lock style + season + colour palette.
  const generateOneLook = (styleFilter = null, used = new Set()) => {
    const next = emptyOutfit();
    const pickedItems = [];
    const month = new Date().getMonth();
    const currentSeason = month >= 2 && month <= 4 ? 'Spring'
      : month >= 5 && month <= 7 ? 'Summer'
      : month >= 8 && month <= 10 ? 'Autumn' : 'Winter';

    let anchorStyle = styleFilter || null;
    let anchorSeasons = null;
    let anchorColors = null;

    // Dress or separates? A dress replaces a Top+Bottoms pair — never both.
    // 35% chance of dress look when dresses exist (so dresses surface but
    // separates remain the dominant pattern). If user has no dresses, always separates.
    const hasDresses = items.some((i) => i.category === 'Dresses');
    const goDressLook = hasDresses && Math.random() < 0.35;

    // Slots picked in defining order so anchor is set early
    const slotOrder = goDressLook
      ? ['Dresses', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery']
      : ['Tops', 'Outerwear', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

    for (const slot of slotOrder) {
      // Strict category + sub-category match (e.g. Earrings slot only gets earrings)
      const all = items.filter((i) => itemFitsSlot(i, slot));
      if (!all.length) continue;

      // HARD FILTERS first — remove items that actively conflict with anchor
      let eligible = all;

      if (anchorStyle) {
        const styleMatched = eligible.filter((i) => {
          const s = itemStyles(i);
          return s.length === 0 || s.includes(anchorStyle); // untagged OK, matching OK; explicit mismatch out
        });
        if (styleMatched.length > 0) eligible = styleMatched;
      }

      if (anchorSeasons) {
        const seasonMatched = eligible.filter((i) => {
          const s = itemSeasons(i);
          return s.length === 0 || s.some((x) => anchorSeasons.includes(x));
        });
        if (seasonMatched.length > 0) eligible = seasonMatched;
      } else {
        // No anchor yet — bias toward current season
        const seasonMatched = eligible.filter((i) => {
          const s = itemSeasons(i);
          return s.length === 0 || s.includes(currentSeason);
        });
        if (seasonMatched.length > 0) eligible = seasonMatched;
      }

      if (anchorColors && anchorColors.length > 0) {
        const colorMatched = eligible.filter((i) => {
          const c = itemColors(i);
          return c.length === 0 || colorsHarmonize(c, anchorColors);
        });
        if (colorMatched.length > 0) eligible = colorMatched;
      }

      // Outerwear: skip if no eligible items for the current weather/season anchor
      // (you don't want a parka in a summer look just because there's no other Outerwear)
      if (slot === 'Outerwear' && eligible.length === 0) continue;

      // Now score the survivors
      const scored = eligible.map((item) => {
        let score = 1;
        if (anchorStyle && itemStyles(item).includes(anchorStyle)) score += 4;
        if (anchorColors && itemColors(item).length > 0 && colorsHarmonize(itemColors(item), anchorColors)) score += 3;
        if (item.favorite) score += 2.5;
        const days = daysSinceLastWorn(item);
        if (days === null || days > 30) score += 0.5;
        if (used.has(item.id)) score -= 8;
        score += Math.random() * 0.4;
        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);
      // Pick from top 3 — coherent but with some variety on retap
      const top = scored.slice(0, Math.min(3, scored.length));
      const pick = top[Math.floor(Math.random() * top.length)].item;
      if (!pick) continue;

      next[slot.toLowerCase()] = pick;
      pickedItems.push(pick);
      used.add(pick.id);

      // Lock the anchor from the FIRST tagged item
      if (!anchorStyle) {
        const s = itemStyles(pick);
        if (s.length > 0) anchorStyle = s[0];
      }
      if (!anchorSeasons) {
        const ss = itemSeasons(pick);
        if (ss.length > 0) anchorSeasons = ss;
      }
      if (!anchorColors) {
        const c = itemColors(pick);
        if (c.length > 0) anchorColors = c;
      }
    }
    return next;
  };

  const generateSuggestion = (styleFilter = null) => {
    setCurrentOutfit(generateOneLook(styleFilter));
  };

  const [aiBusy, setAiBusy] = useState(false);
  const [aiStage, setAiStage] = useState('');
  const [aiNote, setAiNote] = useState(null);
  const [aiTags, setAiTags] = useState([]);
  const [aiConfidence, setAiConfidence] = useState(null);
  const [abComparing, setAbComparing] = useState(false);
  const [abPair, setAbPair] = useState(null); // { a: { outfit, reasoning, confidence }, b: {...} }

  const AI_STAGES = [
    'Reading your wardrobe…',
    'Considering today\'s weather and season…',
    'Finding pieces that harmonise…',
    'Composing colour and shape…',
    'Adding finishing touches…',
    'Almost there…',
    'Titling the look…',
  ];

  const buildIntent = () => {
    const custom = customIntent.trim();
    if (custom) return custom;
    if (styleIntent === 'Any') return 'a coherent everyday look';
    return `a ${styleIntent.toLowerCase()} outfit`;
  };

  const handleQuickStyle = () => {
    const style = styleIntent === 'Any' ? null : styleIntent;
    setCurrentOutfit(generateOneLook(style));
    setAiNote(null);
    setAiTags([]);
  };

  // Generate two AI looks in parallel for side-by-side comparison.
  const handleABCompare = async () => {
    if (!isAIEnabled()) { toast.show('AI not configured', { kind: 'error' }); return; }
    setAbComparing(true); setAiStage(AI_STAGES[0]);
    let stageIndex = 0;
    const stageTimer = setInterval(() => { stageIndex = Math.min(stageIndex + 1, AI_STAGES.length - 1); setAiStage(AI_STAGES[stageIndex]); }, 1200);
    try {
      const month = new Date().getMonth();
      const season = month >= 2 && month <= 4 ? 'Spring' : month >= 5 && month <= 7 ? 'Summer' : month >= 8 && month <= 10 ? 'Autumn' : 'Winter';
      const cached = (() => { try { return JSON.parse(localStorage.getItem('atelier-weather') || 'null')?.data; } catch { return null; } })();
      const intent = buildIntent();
      // Run two parallel — second slightly higher temperature for variety
      const [resultA, resultB] = await Promise.all([
        generateOutfitWithGemini({ items, intent, weather: cached, season, temperature: aiTemperature, styleProfile }),
        generateOutfitWithGemini({ items, intent, weather: cached, season, temperature: Math.min(1, aiTemperature + 0.3), styleProfile }),
      ]);
      const buildOutfit = (result) => {
        const next = emptyOutfit();
        for (const id of result.itemIds || []) {
          const item = items.find((i) => i.id === id);
          if (!item) continue;
          const slot = slotForItem(item);
          if (!slot) continue;
          const key = slot.toLowerCase();
          if (isMultiSlot(slot)) {
            next[key] = Array.isArray(next[key]) ? [...next[key], item] : [item];
          } else if (!next[key]) {
            next[key] = item;
          }
        }
        return next;
      };
      setAbPair({
        intent,
        a: { outfit: buildOutfit(resultA), reasoning: resultA.reasoning, confidence: resultA.confidence, tags: Array.isArray(resultA.tags) ? resultA.tags : [] },
        b: { outfit: buildOutfit(resultB), reasoning: resultB.reasoning, confidence: resultB.confidence, tags: Array.isArray(resultB.tags) ? resultB.tags : [] },
      });
    } catch (err) {
      toast.show(err?.message || 'AB compare failed', { kind: 'error', duration: 4000 });
    } finally {
      clearInterval(stageTimer);
      setAbComparing(false);
      setAiStage('');
    }
  };

  const handleAIStyle = async (intentOverride = null, { refine = false } = {}) => {
    setAiBusy(true); setAiNote(null); setAiTags([]);
    setAiStage(AI_STAGES[0]);
    // Cycle stage labels every 1.2s so the user sees forward motion
    let stageIndex = 0;
    const stageTimer = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, AI_STAGES.length - 1);
      setAiStage(AI_STAGES[stageIndex]);
    }, 1200);
    try {
      const month = new Date().getMonth();
      const season = month >= 2 && month <= 4 ? 'Spring'
        : month >= 5 && month <= 7 ? 'Summer'
        : month >= 8 && month <= 10 ? 'Autumn' : 'Winter';
      const cached = (() => { try { return JSON.parse(localStorage.getItem('atelier-weather') || 'null')?.data; } catch { return null; } })();
      // Guard: only accept a string override. A bare onClick={handleAIStyle}
      // would pass the click event here, and that non-serializable object then
      // poisoned the saved AI-history `intent` field (Firestore setDoc failure).
      const intent = (typeof intentOverride === 'string' ? intentOverride : null) || buildIntent();
      const previousOutfit = refine
        ? OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]))
        : null;
      const result = await generateOutfitWithGemini({ items, intent, weather: cached, season, previousOutfit, temperature: aiTemperature, styleProfile });
      const next = emptyOutfit();
      for (const id of result.itemIds) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        const slot = slotForItem(item);
        if (!slot) continue;
        const key = slot.toLowerCase();
        if (isMultiSlot(slot)) {
          next[key] = Array.isArray(next[key]) ? [...next[key], item] : [item];
        } else if (!next[key]) {
          next[key] = item;
        }
      }
      setCurrentOutfit(next);
      setAiNote(result.reasoning || 'AI-styled look ready');
      setAiTags(Array.isArray(result.tags) ? result.tags : []);
      setAiConfidence(typeof result.confidence === 'number' ? result.confidence : null);
      toast.show(refine ? 'Refined' : 'Styled by the Concierge', { kind: 'success' });
      // Save to AI prompt history
      if (saveAIHistory) {
        try {
          await saveAIHistory({
            id: newId(),
            intent,
            itemIds: Object.values(next).flatMap(slotItems).map((i) => i.id),
            reasoning: result.reasoning || '',
            confidence: typeof result.confidence === 'number' ? result.confidence : null,
            refined: refine,
            createdAt: new Date().toISOString(),
          });
        } catch (e) { console.warn('[wardrobe] could not save AI history:', e); }
      }
      // Auto-name the freshly composed look. The user can still click
      // "Suggest" later to regenerate, but we save them a step in the
      // common case where they accept the AI's suggestion. We force the
      // stage label so the user sees what we're doing during the extra
      // ~3s the naming call takes (the AIProgressModal is still up because
      // aiBusy hasn't been set false yet).
      try {
        const picked = OUTFIT_SLOTS.flatMap((s) => slotItems(next[s.toLowerCase()]));
        if (picked.length > 0 && !outfitName.trim()) {
          setAiStage('Titling the look…');
          const briefForName = customIntent.trim() || (styleIntent !== 'Any' ? styleIntent : '');
          const name = await generateOutfitNameWithGemini(picked, briefForName);
          if (name) setOutfitName(name);
        }
      } catch (autoNameErr) {
        console.warn('[stylist] auto-name failed:', autoNameErr?.message);
      }
    } catch (err) {
      toast.show(err?.message || 'AI styling failed', { kind: 'error', duration: 4000 });
    } finally {
      clearInterval(stageTimer);
      setAiBusy(false);
      setAiStage('');
    }
  };

  const generateCapsule = async (count, styleFilter, trip) => {
    const used = new Set();
    const baseName = trip || 'Capsule';
    const created = [];
    for (let i = 0; i < count; i++) {
      const look = generateOneLook(styleFilter, used);
      const pieces = OUTFIT_SLOTS.map((s) => look[s.toLowerCase()]).filter(Boolean);
      if (pieces.length === 0) break;
      const outfit = {
        id: newId(),
        name: `${baseName} · Day ${i + 1}`,
        itemIds: pieces.map((p) => p.id),
        createdAt: new Date().toISOString(),
        capsule: baseName,
      };
      await saveOutfit(outfit);
      created.push(outfit);
    }
    toast.show(`${created.length} capsule looks saved`, { kind: 'success' });
    setCapsuleOpen(false);
    setTab('saved');
  };

  const OutfitSlot = ({ slot }) => {
    const value = currentOutfit[slot.toLowerCase()];
    const pieces = slotItems(value);
    const multi = isMultiSlot(slot);
    const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}` });
    const clearOne = (it) => {
      if (multi) {
        setCurrentOutfit((prev) => {
          const key = slot.toLowerCase();
          const cur = slotItems(prev[key]);
          return { ...prev, [key]: cur.filter((x) => x.id !== it.id) };
        });
      } else {
        handleSelect(slot, null);
      }
    };
    // Mute slots that are covered by mutual exclusion. If user picked a
    // Dress, the Tops and Bottoms slots are visually muted to match the
    // Archive collapse — single source of truth across both sides.
    // Covered slots that are ALSO filled (rare layering case) keep full
    // appearance so the user can still see their override choice.
    const covered = pieces.length === 0 && isSlotCovered(slot);
    return (
      <div
        ref={setNodeRef}
        onClick={pieces.length === 0 && !covered ? () => setExpandedSlot((prev) => (prev === slot ? null : slot)) : undefined}
        className={`border-2 rounded-xl lg:rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-200 aspect-square lg:aspect-square group ${
          pieces.length === 0 && !covered ? 'cursor-pointer' : ''
        } ${
          isOver
            ? 'border-stone-900 ring-4 ring-stone-900/20 scale-[1.02]'
            : pieces.length > 0
              ? 'bg-white smooth-shadow border-stone-200'
              : covered
                ? 'bg-stone-50/60 border-stone-200/60 border-dashed opacity-50'
                : expandedSlot === slot
                  ? 'bg-stone-200 border-stone-400 border-solid'
                  : 'bg-stone-100 border-dashed border-stone-300'
        }`}>
        {pieces.length === 0 ? (
          <span className={`text-[9px] lg:text-xs font-medium tracking-widest uppercase text-center px-1 leading-tight ${covered ? 'text-stone-300 line-through' : 'text-stone-400'}`}>{slot}</span>
        ) : pieces.length === 1 ? (
          <>
            <img src={itemImages(pieces[0])[0]} alt={pieces[0].name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            <button
              onClick={() => clearOne(pieces[0])}
              className="absolute top-1.5 right-1.5 lg:top-3 lg:right-3 bg-white/95 backdrop-blur text-stone-900 p-1.5 lg:p-2 rounded-full opacity-100 lg:opacity-70 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 shadow-md active:scale-90"
              aria-label={`Clear ${slot}`}
            >
              <X size={12} strokeWidth={2} className="lg:w-3.5 lg:h-3.5" />
            </button>
          </>
        ) : (
          // Multi-pick stacked thumbs (jewellery layering). Up to 4 in a 2×2.
          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 relative">
            {pieces.slice(0, 4).map((it) => (
              <div key={it.id} className="relative bg-stone-100 rounded overflow-hidden">
                {itemImages(it)[0] && <img src={itemImages(it)[0]} alt={it.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                <button onClick={(e) => { e.stopPropagation(); clearOne(it); }}
                  className="absolute top-0.5 right-0.5 bg-white/90 backdrop-blur text-stone-900 p-0.5 rounded-full opacity-90 hover:bg-red-50 hover:text-red-500 shadow-sm" aria-label={`Remove ${it.name}`}>
                  <X size={9} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {pieces.length > 4 && (
              <span className="absolute bottom-1 right-1 bg-stone-900 text-white text-[9px] tracking-wider px-1.5 py-0.5 rounded-full">+{pieces.length - 4}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const DraggableArchiveItem = ({ slot, item }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: `archive-${slot}-${item.id}`,
      data: { item, slot },
    });
    const style = transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, touchAction: 'none' }
      : { touchAction: 'manipulation' };
    const isSelected = slotItems(currentOutfit[slot.toLowerCase()]).some((p) => p.id === item.id);
    // On coarse-pointer (touch) devices, omit the dnd listeners entirely.
    // PointerSensor's 6px activation distance was firing on every scroll → an
    // accidental drag → ghost item lands when the finger lifts. Tap-to-add via
    // onClick is the mobile contract; drag is desktop-only.
    const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    const dndProps = isTouch ? {} : { ...attributes, ...listeners };
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...dndProps}
        onClick={() => !isDragging && handleSelect(slot, item)}
        className={`flex-none w-28 sm:w-32 md:w-36 cursor-pointer group transition-opacity ${isDragging ? 'opacity-30' : ''}`}
      >
        {/* Hover framing: thin brass instead of stone-300 — same brass
            thread used on outfit cards, brass-rule eyebrows, brass nav
            accent etc. Border-3px stays as the layout (reserves space)
            so selected-state border-stone-900 doesn't cause a shift;
            on hover the unselected card shows a subtle brass-300/40
            framing. */}
        <div className={`aspect-[3/4] rounded-2xl overflow-hidden mb-3 border-[3px] transition-all duration-200 relative ${
          isSelected ? 'border-stone-900 shadow-xl' : 'border-transparent group-hover:border-brass-300/40'
        }`}>
          <img src={itemImages(item)[0]} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none" loading="lazy" />
          <div className="hidden lg:block absolute top-1.5 left-1.5 p-1 bg-white/85 backdrop-blur rounded-full text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical size={11} strokeWidth={1.5} />
          </div>
          {item.status === 'wishlist' && (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[8px] tracking-widest uppercase font-medium pointer-events-none">
              Wishlist
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-stone-900 truncate px-1">{item.name}</p>
        <p className="text-[10px] text-stone-500 uppercase tracking-wider px-1 mt-0.5">{item.brand}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-10">
      {isLookbook ? (
        <EditorialHeader
          eyebrow="Curated archive"
          title="Lookbook"
          subtitle={`Your saved looks${outfits.length ? ` · ${outfits.length}` : ''}, scheduled wears, and AI history.`}
        />
      ) : (
        <EditorialHeader
          eyebrow="Studio"
          title="Styling Studio"
          subtitle="Compose new looks from your wardrobe."
        />
      )}

      {/* Tab switcher.
          Studio:    Compose · AI History  (history belongs with creation —
                     it's a record of past suggestions to reload into the
                     canvas, not a curated archive)
          Lookbook:  Lookbook · Diary      (saved outfits + the wear
                     journal/calendar that records WHEN they were worn —
                     two faces of the same outfit story) */}
      <div className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 py-3 bg-[#F7F5F2]/95 backdrop-blur-md border-b border-stone-200/40"
           style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex bg-stone-200/50 p-1.5 rounded-full w-fit overflow-x-auto hide-scrollbar max-w-full">
          {(isLookbook
            ? [
                ['saved', `Outfits${outfits.length ? ` · ${outfits.length}` : ''}`],
                ['collections', `Collections${collections.length ? ` · ${collections.length}` : ''}`],
              ]
            : [
                ['create', 'Compose'],
                ['history', `AI History${aiHistory.length ? ` · ${aiHistory.length}` : ''}`],
              ]
          ).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`whitespace-nowrap px-4 sm:px-5 py-3 sm:py-2 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-colors duration-200 ${
                tab === id ? 'bg-white text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!isLookbook && tab === 'history' && (
        <AIHistoryView
          history={aiHistory}
          items={items}
          onApply={(entry) => {
            const next = emptyOutfit();
            for (const id of entry.itemIds || []) {
              const item = items.find((i) => i.id === id);
              if (!item) continue;
              const slot = slotForItem(item);
              if (!slot) continue;
              const key = slot.toLowerCase();
              if (isMultiSlot(slot)) next[key] = Array.isArray(next[key]) ? [...next[key], item] : [item];
              else if (!next[key]) next[key] = item;
            }
            setCurrentOutfit(next);
            setAiNote(entry.reasoning);
            setTab('create');
            toast.show('Restored from history', { kind: 'success' });
          }}
          onToggleFavorite={toggleAIHistoryFavorite}
          onDelete={deleteAIHistory}
        />
      )}

      {!isLookbook && tab === 'create' && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-4 sm:p-6 smooth-shadow space-y-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            {/* Editorial eyebrow + brass-rule pattern — same language as the
                "GOOD MORNING, SIBYLLE" + brass-rule in every main-column
                header. Replaces the previous Wand icon + plain text label. */}
            <div className="flex items-center gap-3">
              <span className="brass-rule" aria-hidden="true"></span>
              <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Style intent</span>
            </div>
            <button onClick={() => setShowCustom((s) => !s)} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors duration-200">
              {showCustom ? 'Hide custom' : '+ Custom intent'}
            </button>
          </div>

          {/* Style intent chips — unified hover convention */}
          <div className="flex flex-wrap gap-2">
            {['Any', ...STYLES].map((s) => (
              <button key={s} onClick={() => setStyleIntent(s)}
                className={`px-4 py-2 rounded-full text-xs border transition-colors duration-200 ${
                  styleIntent === s
                    ? 'bg-stone-900 border-stone-900 text-white font-medium hover:bg-stone-700'
                    : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900'
                }`}>
                {s}
              </button>
            ))}
          </div>

          {/* Optional custom intent for richer AI prompting */}
          {showCustom && (
            <input
              type="text"
              value={customIntent}
              onChange={(e) => setCustomIntent(e.target.value)}
              placeholder='e.g. "office presentation Tuesday" or "dinner with friends"'
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
            />
          )}

          {/* Primary action stack. AI Style is the hero CTA (full-width,
              dark pill) — it's what most users actually want. Quick is a
              secondary affordance for users who explicitly want a non-AI
              suggestion, sized smaller as a text-link-style action below. */}
          <button onClick={() => handleAIStyle()} disabled={aiBusy || abComparing || !isAIEnabled()}
            className="w-full px-4 py-3.5 rounded-xl text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors duration-200 inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 font-medium">
            <Sparkles size={14} strokeWidth={1.5} />
            {aiBusy ? 'Styling…' : isAIEnabled() ? 'Style with Concierge' : 'Concierge — setup'}
          </button>
          <div className="flex items-center justify-center gap-4 text-[11px] tracking-widest uppercase">
            <button onClick={handleQuickStyle} disabled={aiBusy || abComparing}
              className="text-stone-500 hover:text-stone-900 transition-colors duration-200 disabled:opacity-50 inline-flex items-center gap-1.5">
              <Wand2 size={11} strokeWidth={1.5} /> Quick pick
            </button>
            {isAIEnabled() && (
              <>
                <span className="text-stone-300" aria-hidden="true">·</span>
                <button onClick={handleABCompare} disabled={aiBusy || abComparing}
                  className="text-stone-500 hover:text-stone-900 transition-colors duration-200 disabled:opacity-50 inline-flex items-center gap-1.5">
                  <Sparkles size={11} strokeWidth={1.5} className="text-amber-500" />
                  {abComparing ? 'Generating…' : 'Compare two looks'}
                </button>
              </>
            )}
          </div>

          {/* Quick mood presets — unified hover convention */}
          {isAIEnabled() && (
            <div>
              <p className="text-[10px] tracking-[0.28em] uppercase text-stone-400 mb-2 font-medium">Or try a mood</p>
              <div className="flex flex-wrap gap-2">
                {MOOD_PRESETS.map((mood) => (
                  <button key={mood} disabled={aiBusy}
                    onClick={() => { setCustomIntent(mood); setShowCustom(true); handleAIStyle(mood); }}
                    className="px-3 py-2 rounded-full text-xs bg-white border border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 disabled:opacity-50 inline-flex items-center gap-1.5">
                    <Sparkles size={11} strokeWidth={1.5} className="text-amber-500" /> {mood}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning banner from AI with refinement options */}
          {aiNote && (
            <div className="bg-stone-900 text-white rounded-2xl p-4 text-sm leading-relaxed animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <Sparkles size={14} strokeWidth={1.5} className="shrink-0 mt-0.5 text-brass-300" />
                <p className="flex-1 italic">{renderTextWithChips(aiNote, { items, onOpenItem })}</p>
                <button onClick={() => setAiNote(null)} className="text-stone-400 hover:text-white shrink-0"><X size={14} /></button>
              </div>
              {typeof aiConfidence === 'number' && (
                <div className="mt-3 ml-7 flex items-center gap-2 text-[10px] tracking-widest uppercase">
                  <span className="text-stone-400">Confidence</span>
                  <div className="flex-1 max-w-[120px] h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${aiConfidence >= 75 ? 'bg-emerald-400' : aiConfidence >= 50 ? 'bg-amber-300' : 'bg-orange-400'}`}
                      style={{ width: `${Math.max(5, Math.min(100, aiConfidence))}%` }} />
                  </div>
                  <span className="text-stone-300 font-medium">{aiConfidence}%</span>
                </div>
              )}
              <div className="mt-4 ml-7 space-y-2">
                <p className="text-[10px] tracking-widest uppercase text-stone-400 font-semibold">Refine</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Try another', intent: null, refine: false },
                    { label: 'More casual', intent: 'make it more casual / relaxed', refine: true },
                    { label: 'More smart', intent: 'make it more polished / smart', refine: true },
                    { label: 'Swap shoes', intent: 'swap the shoes for something different that still works', refine: true },
                    { label: 'Different colours', intent: 'try a different colour palette while keeping the silhouette', refine: true },
                    { label: 'Swap top', intent: 'swap the top while keeping the rest', refine: true },
                    { label: 'Swap bottoms', intent: 'swap the bottoms while keeping the rest', refine: true },
                  ].map((r) => (
                    <button key={r.label} onClick={() => handleAIStyle(r.intent, { refine: r.refine })} disabled={aiBusy}
                      className="text-[11px] tracking-wide text-stone-200 hover:text-white border border-stone-700 hover:border-stone-500 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50">
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <details className="mt-2 ml-7">
                <summary className="cursor-pointer text-xs uppercase tracking-widest text-stone-500 hover:text-stone-300">
                  Why this?
                </summary>
                <WhyThisPanel
                  weather={(() => { try { return JSON.parse(localStorage.getItem('atelier-weather-v3') || 'null')?.data; } catch { return null; } })()}
                  season={(() => { const m = new Date().getMonth(); return m >= 2 && m <= 4 ? 'Spring' : m >= 5 && m <= 7 ? 'Summer' : m >= 8 && m <= 10 ? 'Autumn' : 'Winter'; })()}
                  styleProfile={measurements}
                  temperature={aiTemperature}
                  itemCount={items.filter(it => it.status === 'owned').length}
                  onEditPreferences={onEditPreferences}
                />
              </details>
            </div>
          )}

          {/* Capsule generator — unified light-pill hover convention. */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[10px] tracking-widest uppercase text-stone-500">Multiple looks at once</span>
            <button onClick={() => setCapsuleOpen(true)}
              className="px-4 py-2 rounded-full text-xs bg-white border border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 inline-flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.5} /> Build a capsule
            </button>
          </div>

          {!isAIEnabled() && (
            <p className="text-[10px] text-stone-400 tracking-wide italic">
              Atelier styling needs the Concierge configured. Add <code>VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic</code> to <code>.env.local</code> from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">aistudio.google.com</a> to enable.
            </p>
          )}
        </div>
      )}

      {capsuleOpen && <CapsuleBuilder onClose={() => setCapsuleOpen(false)} onGenerate={generateCapsule} />}
      <AIProgressModal open={aiBusy || abComparing} stage={aiStage} title={abComparing ? 'Composing two looks' : 'Putting together your outfit'} />
      {abPair && (
        <ABCompareModal
          pair={abPair}
          onClose={() => setAbPair(null)}
          onPick={async (choice) => {
            setCurrentOutfit(choice.outfit);
            setAiNote(choice.reasoning);
            setAiTags(choice.tags || []);
            setAiConfidence(typeof choice.confidence === 'number' ? choice.confidence : null);
            if (saveAIHistory) {
              saveAIHistory({
                id: newId(),
                intent: abPair.intent,
                itemIds: Object.values(choice.outfit).flatMap(slotItems).map((i) => i.id),
                reasoning: choice.reasoning || '',
                confidence: choice.confidence ?? null,
                createdAt: new Date().toISOString(),
              }).catch(() => {});
            }
            setAbPair(null);
            toast.show('Look applied', { kind: 'success' });
            // Auto-name the A/B picked look. The AIProgressModal is no longer
            // open here so we flip suggestingName to show the "Composing a
            // name…" placeholder in the name input (added in P1.1 Task 2.4).
            if (!outfitName.trim()) {
              setSuggestingName(true);
              try {
                const picked = OUTFIT_SLOTS.flatMap((s) => slotItems(choice.outfit[s.toLowerCase()]));
                const briefForName = customIntent.trim() || (styleIntent !== 'Any' ? styleIntent : '');
                const name = await generateOutfitNameWithGemini(picked, briefForName);
                if (name) setOutfitName(name);
              } catch (e) { console.warn('[stylist] A/B auto-name failed:', e?.message); }
              finally { setSuggestingName(false); }
            }
          }}
        />
      )}

      {isLookbook && tab === 'diary' ? (
        // DIARY — the wear journal + calendar living inside Lookbook.
        // Conceptually paired: Lookbook = outfits (curated), Diary =
        // when those outfits (or any pieces) were actually worn.
        <DiaryView
          items={items}
          outfits={outfits}
          schedules={schedules}
          onScheduleOutfit={scheduleOutfit}
          onOpenOutfit={onOpenOutfit}
          onSaveOutfit={saveOutfit}
          onOpenItem={onOpenItem}
          styleProfile={styleProfile}
          autoActivateRangeMode={false}
        />
      ) : !isLookbook && tab === 'create' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {(() => {
            // Sticky mobile summary: floats above bottom nav, visible while
            // scrolling the Wardrobe Archives so the user never loses sight of
            // what they've picked. Renders only on lg:hidden + when 1+ slot
            // is filled. Tap a thumb → remove it. Save CTA inline.
            const picked = OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]).map((item) => ({ slot: s, item })));
            if (picked.length === 0) return null;
            return createPortal(
              <div className="lg:hidden fixed left-0 right-0 z-30 px-3 pointer-events-none"
                   style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 86px)' }}>
                <div className="pointer-events-auto mx-auto max-w-md bg-stone-900 text-white rounded-2xl shadow-2xl px-3 py-2.5 flex items-center gap-2">
                  <div className="flex-1 flex gap-1.5 overflow-x-auto hide-scrollbar">
                    {picked.map(({ slot, item }) => (
                      <button key={slot} onClick={() => handleSelect(slot, item)}
                        title={`Remove ${item.name}`}
                        className="flex-none w-9 h-12 rounded-lg overflow-hidden bg-stone-700 ring-1 ring-white/10 relative active:scale-95 transition-transform">
                        {itemImages(item)[0] && <img src={itemImages(item)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] tracking-widest uppercase text-stone-400 shrink-0">{picked.length}/{OUTFIT_SLOTS.length}</span>
                  {outfitName.trim() ? (
                    <button onClick={handleSave}
                      className="text-[10px] tracking-widest uppercase px-3 py-2 rounded-full bg-amber-300 text-stone-900 font-medium shrink-0">
                      Save
                    </button>
                  ) : (
                    <button onClick={() => document.querySelector('input[placeholder="Name this look…"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className="text-[10px] tracking-widest uppercase px-3 py-2 rounded-full bg-white text-stone-900 font-medium shrink-0">
                      Name…
                    </button>
                  )}
                </div>
              </div>,
              document.body
            );
          })()}

          {/* lg:items-start stops the default grid-row stretch — without it,
              both columns would inherit the height of the (much taller)
              Wardrobe Archives, forcing the Current Look card to stretch to
              ~3000px with empty white space below the slots and a Save
              button pinned to the bottom via mt-auto. With items-start the
              column shrinks to its content height, and lg:sticky lg:top-20
              keeps it pinned just below the sticky tab bar while the user
              scrolls through Archives. Sticky's natural release at the end
              of the grid row means the card un-pins when Archives ends and
              scrolls away normally — no JS bookkeeping needed. */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
            {(() => {
              // Progress: count pieces, foundation (dress OR top+bottom), shoes.
              // 'Complete' = look is wearable head-to-toe. Reaching it earns
              // a subtle brass-accent celebration on the Save button.
              const pieceCount = OUTFIT_SLOTS.reduce((sum, s) => sum + slotItems(currentOutfit[s.toLowerCase()]).length, 0);
              const hasFoundation = !!currentOutfit.dresses || (!!currentOutfit.tops && !!currentOutfit.bottoms);
              const hasShoes = !!currentOutfit.shoes;
              const isComplete = hasFoundation && hasShoes;
              const canSave = outfitName.trim() && pieceCount > 0;
              // Flat list of all picked pieces in slot order — fuel for the
              // live composition strip below the header.
              const allPicked = OUTFIT_SLOTS.flatMap((s) =>
                slotItems(currentOutfit[s.toLowerCase()]).map((item) => ({ slot: s, item }))
              );
              return (
                <div className="lg:col-span-5 lg:sticky lg:top-20 bg-white rounded-[2rem] p-4 sm:p-6 md:p-8 border border-stone-200/60 smooth-shadow flex flex-col">
                  <div className="flex items-baseline justify-between mb-3 sm:mb-6 gap-3">
                    <h3 className="font-display text-lg md:text-2xl text-stone-900">Current Look</h3>
                    {/* Dynamic header signal: starts as the original "Drag or
                        tap" hint while the look is empty; switches to a piece
                        counter + readiness pill once the user has begun
                        picking. Lets the user know at a glance how complete
                        their composition is without scanning all 10 slots. */}
                    {pieceCount === 0 ? (
                      <span className="hidden lg:inline text-[10px] uppercase tracking-widest text-stone-400">Drag or tap</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                        <span className="text-stone-500">{pieceCount} {pieceCount === 1 ? 'piece' : 'pieces'}</span>
                        {isComplete && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-medium">
                            <Check size={9} strokeWidth={2.5} /> Ready
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {/* Live composition strip — every picked piece in slot
                      order, always above the fold. Solves the 'I picked
                      earrings but the Earrings slot is below the viewport'
                      blind-spot: as soon as you pick, the thumb appears
                      up here in the strip even though the corresponding
                      slot might be 400px down. Renders nothing when empty
                      (Current Look starts clean). Horizontal scroll on
                      overflow — relevant for multi-slot accessory stacks. */}
                  {allPicked.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-4 sm:mb-5 -mx-1 px-1 overflow-x-auto hide-scrollbar">
                      {allPicked.map(({ slot, item }) => (
                        <div key={`${slot}-${item.id}`}
                          title={`${slot} · ${item.name}`}
                          className="shrink-0 w-8 h-11 rounded-md overflow-hidden bg-stone-100 ring-1 ring-stone-200/60">
                          {itemImages(item)[0] && (
                            <img src={itemImages(item)[0]} alt="" loading="lazy" decoding="async"
                              className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 lg:grid-cols-2 gap-2 lg:gap-3 mb-5 lg:mb-8">
                    {OUTFIT_SLOTS.map((slot) => <OutfitSlot key={slot} slot={slot} />)}
                  </div>
                  {/* Live composing palette — mirrors the Lookbook detail palette
                      strip but at smaller scale so it doesn't dominate the Studio
                      canvas. Updates as pieces are added/removed. Hidden when
                      fewer than 2 distinct colours (single-colour palette adds
                      no signal). */}
                  {(() => {
                    const pickedItems = OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]));
                    const counts = new Map();
                    for (const piece of pickedItems) {
                      for (const c of (itemColors(piece) || [])) {
                        const key = (c || '').toLowerCase().trim();
                        if (!key) continue;
                        counts.set(key, (counts.get(key) || 0) + 1);
                      }
                    }
                    const studioPalette = [...counts.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([name, count]) => ({ name, count, hex: hexFromColorName(name) }));
                    if (studioPalette.length < 2) return null;
                    return (
                      <div className="mb-5 lg:mb-8">
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
                          <span className="text-[10px] tracking-[0.28em] uppercase font-medium text-stone-500">Composing palette</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {studioPalette.map(({ name, count, hex }) => (
                            <div key={name} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-white border border-stone-200">
                              <span className="block w-4 h-4 rounded-full border border-stone-300/70 shrink-0" style={{ backgroundColor: hex }} aria-hidden="true" />
                              <span className="text-[10px] tracking-wide uppercase text-stone-700">
                                {name}
                                {count > 1 && <span className="text-stone-400 ml-1">×{count}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-auto">
                    {/* Name input + inline AI Suggest button. The Suggest
                        button only appears when AI is enabled AND the user
                        has picked at least one piece (otherwise there's
                        nothing to name from). Positioned inside the input
                        on the right via absolute positioning. */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder={suggestingName ? 'Composing a name…' : 'Name this look…'}
                        value={outfitName}
                        onChange={(e) => setOutfitName(e.target.value)}
                        disabled={suggestingName}
                        className={`w-full px-5 py-4 rounded-xl bg-stone-50 border border-stone-200 focus:border-stone-900 outline-none transition-colors disabled:bg-stone-50 disabled:text-stone-400 ${isAIEnabled() && pieceCount > 0 ? 'pr-32' : ''}`}
                      />
                      {isAIEnabled() && pieceCount > 0 && (
                        <button
                          type="button"
                          onClick={handleSuggestName}
                          disabled={suggestingName}
                          title={suggestingName ? 'Composing a name with the Concierge' : 'Suggest a name with the Concierge'}
                          aria-busy={suggestingName}
                          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] tracking-widest uppercase text-stone-600 hover:text-stone-900 hover:bg-white border border-stone-200 hover:border-stone-500 bg-white/70 transition-colors duration-200 disabled:cursor-not-allowed"
                        >
                          <Sparkles size={10} strokeWidth={1.75} className={suggestingName ? 'animate-pulse text-amber-500' : 'text-amber-500'} />
                          {suggestingName ? 'Composing…' : 'Suggest'}
                        </button>
                      )}
                    </div>
                    {/* Save button: when isComplete, gets a brass-300 outer
                        ring as a quiet celebration — the look is head-to-toe
                        and ready to save. Subtle so it doesn't shout. */}
                    <button onClick={handleSave} disabled={!canSave}
                      className={`w-full bg-stone-900 text-white py-4 rounded-xl font-medium flex justify-center items-center gap-2 hover:bg-stone-700 transition-all disabled:opacity-50 shadow-lg active:scale-[0.98] ${isComplete && canSave ? 'ring-2 ring-brass-300 ring-offset-2' : ''}`}
                    >
                      <Save size={18} strokeWidth={1.5} /> Save Look
                    </button>
                    {/* Helpful hint when items are picked but name is missing
                        — the most common reason the Save button stays disabled.
                        Better than a silent grey button. */}
                    {pieceCount > 0 && !outfitName.trim() && (
                      <p className="text-[10px] tracking-widest uppercase text-stone-400 text-center mt-2">
                        Name your look to save it
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="lg:col-span-7">
              <div className="flex items-baseline justify-between mb-4 sm:mb-6 px-2">
                <h3 className="font-display text-xl md:text-2xl text-stone-900">Wardrobe Archives</h3>
              </div>
              {items.some((i) => i.status === 'wishlist') && (
                <div className="flex items-center gap-2 mb-4 px-2">
                  <label className="text-[10px] tracking-widest uppercase text-stone-500 cursor-pointer flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={includeWishlist}
                      onChange={(e) => setIncludeWishlist(e.target.checked)}
                      className="w-3.5 h-3.5 accent-stone-900"
                    />
                    Include wishlist
                    {includeWishlist && <span className="text-stone-400 normal-case tracking-normal">({items.filter((i) => i.status === 'wishlist').length} items)</span>}
                  </label>
                </div>
              )}
              <div className="space-y-2">
                {OUTFIT_SLOTS.map((slot) => {
                  const pool = composableItems.filter((i) => itemFitsSlot(i, slot));
                  const filled = slotItems(currentOutfit[slot.toLowerCase()]);
                  const covered = isSlotCovered(slot);
                  const isExpanded = expandedSlot === slot;

                  return (
                    <div
                      key={slot}
                      ref={(el) => { archiveSectionRefs.current[slot] = el; }}
                      className="scroll-mt-24 bg-white border border-stone-200 rounded-2xl overflow-hidden transition-colors hover:border-stone-300"
                    >
                      {/* Accordion header — always visible, always tappable */}
                      <button
                        type="button"
                        onClick={() => toggleSlotExpansion(slot)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-block w-3 h-px bg-brass-400 shrink-0" aria-hidden="true" />
                          <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-[0.2em] shrink-0">
                            {slot}
                          </h4>
                          <span className="text-[10px] text-stone-400 shrink-0">· {pool.length}</span>
                          {filled.length > 0 && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-700 shrink-0" title={`${filled.length} picked`}>
                              <Check size={10} strokeWidth={2.5} />
                            </span>
                          )}
                          {/* Filled item peek — tiny thumbs visible even when collapsed */}
                          {!isExpanded && filled.length > 0 && (
                            <div className="flex gap-1 min-w-0 overflow-hidden ml-1">
                              {filled.slice(0, 3).map((item) => (
                                <div key={item.id} className="w-6 h-8 rounded-md overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                                  {itemImages(item)[0] && (
                                    <img src={itemImages(item)[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
                                  )}
                                </div>
                              ))}
                              {filled.length > 3 && <span className="text-[9px] text-stone-400 self-center ml-1">+{filled.length - 3}</span>}
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          size={16}
                          strokeWidth={1.5}
                          className={`text-stone-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {/* Expanded body */}
                      {isExpanded && (
                        <div className="border-t border-stone-100 px-4 pt-4 pb-5">
                          {covered && filled.length === 0 ? (
                            <p className="text-xs text-stone-500 italic">
                              {slot === 'Dresses'
                                ? "You've picked separates — a dress isn't needed."
                                : "You're wearing a dress — separates aren't needed."}
                            </p>
                          ) : pool.length === 0 ? (
                            <p className="text-xs text-stone-400 italic">No pieces in {slot.toLowerCase()} yet.</p>
                          ) : (
                            <div className="flex gap-3 md:gap-4 overflow-x-auto pb-1 hide-scrollbar lg:flex-wrap lg:overflow-x-visible">
                              {pool.map((item) => <DraggableArchiveItem key={item.id} slot={slot} item={item} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeDragItem && (
              <div className="w-32 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 border-stone-900 rotate-3 pointer-events-none">
                <img src={itemImages(activeDragItem)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : isLookbook && (tab === 'saved' || tab === 'collections') ? (
        <div className="space-y-6 md:space-y-8">
          {tab === 'saved' && outfits.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {[['all','All'],['favorites','★ Favourites']].map(([f, label]) => (
                  <button key={f} onClick={() => setOutfitsFilter(f)}
                    className={`text-xs tracking-widest uppercase px-3 py-1.5 rounded-full transition-colors duration-200 border ${
                      outfitsFilter === f
                        ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-700'
                        : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900'
                    }`}>{label}</button>
                ))}
                <span className="text-xs text-stone-500 ml-2">{collectionFilteredOutfits.length} {collectionFilteredOutfits.length === 1 ? 'look' : 'looks'}</span>
              </div>
              {!selectMode ? (
                <button onClick={() => setSelectMode(true)} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors">
                  Select
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500">{selectedOutfits.size} selected</span>
                  <button onClick={() => { setSelectMode(false); setSelectedOutfits(new Set()); }}
                    className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Active-collection filter banner — shown on the Outfits tab when a
              collection was tapped over on the Collections tab. Tells the user
              why the grid is narrowed and lets them clear it without leaving. */}
          {tab === 'saved' && activeCollection && (() => {
            const coll = collections.find((c) => c.id === activeCollection);
            if (!coll) return null;
            return (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] tracking-widest uppercase text-stone-500">Collection</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 text-white text-[11px] tracking-wide uppercase">
                  {coll.name}
                  <button type="button" onClick={() => setActiveCollection(null)} className="text-white/60 hover:text-white ml-0.5 leading-none" aria-label="Clear collection filter">×</button>
                </span>
              </div>
            );
          })()}
          {/* Collections strip — named outfit moodboards. Sits ABOVE the
              tag-chip + sort row so it reads as primary navigation pivot
              (choose a named collection) before secondary filtering
              (chip + sort within that pivot). Each tile is a 2×2 mosaic
              of the first piece image from up to 4 outfits in that
              collection. On desktop (lg+) the strip becomes a 4-col
              inline grid. */}
          {tab === 'collections' && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="brass-rule" aria-hidden="true"></span>
                  <h3 className="font-display text-stone-900 text-lg sm:text-xl">Collections</h3>
                  <span className="text-[10px] tracking-widest uppercase text-stone-400">{collections.length}</span>
                </div>
                <div className="flex items-center gap-3">
                  {activeCollection && (
                    <button
                      type="button"
                      onClick={() => setActiveCollection(null)}
                      className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline"
                    >
                      Show all
                    </button>
                  )}
                  {typeof onCreateCollection === 'function' && (
                    <button
                      type="button"
                      onClick={() => { setNewCollectionOpen(true); setNewCollectionName(''); }}
                      className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline"
                    >
                      + New collection
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
                {collections.map((coll) => {
                  const collOutfits = coll.outfitIds.map((id) => outfits.find((o) => o.id === id)).filter(Boolean);
                  const preview = collOutfits.slice(0, 4).map((o) => {
                    const pieces = resolveOutfitItems(o, items);
                    return pieces[0] ? itemImages(pieces[0])[0] : null;
                  });
                  const isActive = activeCollection === coll.id;
                  return (
                    <button
                      key={coll.id}
                      type="button"
                      onClick={() => { const next = isActive ? null : coll.id; setActiveCollection(next); if (next) setTab('saved'); }}
                      className={`shrink-0 lg:shrink w-48 lg:w-auto text-left bg-white border rounded-2xl overflow-hidden transition-colors ${
                        isActive ? 'border-stone-900 shadow-sm' : 'border-stone-200 hover:border-stone-500'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-stone-100 grid grid-cols-2 grid-rows-2 gap-0.5">
                        {preview.length === 0
                          ? <div className="col-span-2 row-span-2 flex items-center justify-center text-stone-300"><Bookmark size={28} strokeWidth={1} /></div>
                          : Array.from({ length: 4 }).map((_, i) => {
                              const img = preview[i];
                              return (
                                <div key={i} className="bg-stone-100 overflow-hidden">
                                  {img && <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />}
                                </div>
                              );
                            })}
                      </div>
                      <div className="p-3">
                        <p className="font-display text-sm text-stone-900 truncate">{coll.name}</p>
                        <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-0.5">
                          {collOutfits.length} look{collOutfits.length === 1 ? '' : 's'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Active collection banner */}
              {activeCollection && (() => {
                const coll = collections.find((c) => c.id === activeCollection);
                if (!coll) return null;
                return (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] tracking-widest uppercase text-stone-500">Showing:</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 text-white text-[11px] tracking-wide uppercase">
                      {coll.name}
                      <button type="button" onClick={() => setActiveCollection(null)} className="text-white/60 hover:text-white ml-0.5 leading-none" aria-label="Clear collection filter">×</button>
                    </span>
                  </div>
                );
              })()}
              {/* New collection modal (lightweight inline) */}
              {newCollectionOpen && (
                <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setNewCollectionOpen(false)}>
                  <form
                    className="bg-[#F7F5F2] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const name = newCollectionName.trim();
                      if (!name || !onCreateCollection) return;
                      await onCreateCollection(name, []);
                      setNewCollectionOpen(false);
                      setNewCollectionName('');
                    }}
                  >
                    <p className="text-[10px] tracking-widest uppercase text-stone-500 mb-1">New collection</p>
                    <h3 className="font-display text-stone-900 text-lg mb-4">Name your moodboard</h3>
                    <input
                      autoFocus
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="e.g. Wedding season 2026"
                      maxLength={50}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-stone-300 text-sm outline-none focus:border-stone-900 mb-4"
                      style={{ fontSize: '16px' }}
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setNewCollectionOpen(false)}
                        className="flex-1 px-4 py-2.5 rounded-full border border-stone-300 text-stone-700 text-[11px] tracking-wide uppercase hover:border-stone-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newCollectionName.trim()}
                        className="flex-1 px-4 py-2.5 rounded-full bg-stone-900 text-white text-[11px] tracking-wide uppercase hover:bg-stone-700 disabled:opacity-50"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}

          {/* TAG FILTER CHIPS + SORT — sits BELOW Collections. Auto-tag
              button is a small contextual prompt (untagged looks exist);
              chip row + compact sort pill share one flex row so they read
              as a single control surface. Revealed once there are >5
              looks so the controls don't dominate empty collections. */}
          {(() => {
            if (tab !== 'saved') return null;
            const untagged = outfits.filter((o) => !Array.isArray(o.tags) || o.tags.length === 0);
            return (
              <>
                {untagged.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (backfillBusy) return;
                      const confirmed = window.confirm(
                        `Auto-tag ${untagged.length} look${untagged.length === 1 ? '' : 's'} using AI? This uses a tiny amount of your AI allowance (roughly £0.0001 per look).`
                      );
                      if (!confirmed) return;
                      setBackfillBusy(true);
                      setBackfillProgress({ done: 0, total: untagged.length });
                      try {
                        for (let i = 0; i < untagged.length; i++) {
                          const o = untagged[i];
                          const picked = (o.itemIds || []).map((id) => items.find((it) => it.id === id)).filter(Boolean);
                          if (picked.length === 0) { setBackfillProgress({ done: i + 1, total: untagged.length }); continue; }
                          try {
                            const tags = await generateOutfitTagsWithGemini(picked, o.intent || '');
                            if (tags.length > 0) {
                              await saveOutfit({ ...o, tags });
                            }
                          } catch (err) {
                            console.warn('[backfill-tags] failed for outfit', o.id, err?.message);
                          }
                          setBackfillProgress({ done: i + 1, total: untagged.length });
                        }
                        toast.show(`Tagged ${untagged.length} look${untagged.length === 1 ? '' : 's'}`, { kind: 'success' });
                      } finally {
                        setBackfillBusy(false);
                        setBackfillProgress(null);
                      }
                    }}
                    className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] tracking-wide uppercase bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    disabled={backfillBusy}
                  >
                    <Sparkles size={12} strokeWidth={1.75} />
                    {backfillBusy
                      ? (backfillProgress ? `Tagging ${backfillProgress.done}/${backfillProgress.total}…` : 'Tagging…')
                      : `Auto-tag ${untagged.length} older look${untagged.length === 1 ? '' : 's'}`}
                  </button>
                )}
                {outfits.length > 5 && (
                  <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setActiveTagFilter(null)}
                        className={`px-3 py-1.5 rounded-full text-[11px] tracking-wide uppercase transition-colors ${
                          activeTagFilter === null
                            ? 'bg-stone-900 text-white'
                            : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-900'
                        }`}
                      >
                        All ({baseFilteredOutfits.length})
                      </button>
                      {tagUnion.map(([tag, count]) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setActiveTagFilter(tag === activeTagFilter ? null : tag)}
                          className={`px-3 py-1.5 rounded-full text-[11px] tracking-wide uppercase transition-colors ${
                            activeTagFilter === tag
                              ? 'bg-stone-900 text-white'
                              : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-900'
                          }`}
                        >
                          {tag} ({count})
                        </button>
                      ))}
                    </div>
                    <div className="shrink-0">
                      <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value)}
                        className="text-[10px] tracking-widest uppercase bg-white border border-stone-300 px-3 py-2 rounded-full text-stone-700 hover:border-stone-900 outline-none cursor-pointer transition-colors"
                        style={{ fontSize: '16px' }}
                      >
                        <option value="recent">Recent</option>
                        <option value="most-worn">Most worn</option>
                        <option value="a-z">A–Z</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Editorial lookbook grid. Single column on mobile, max TWO on
              desktop — looks deserve room to breathe. Each card is a tall
              4:5 portrait with a deterministic flat-lay arrangement of
              pieces (rotated, layered, sized — first piece largest, on
              top). Cream gradient surface so the items pop. Serif name
              below in display weight. Mirrors a magazine spread, not a
              dashboard. */}
          {tab === 'saved' && (activeTagFilter && collectionFilteredOutfits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-stone-500 text-sm">No looks tagged "{activeTagFilter}"{ activeCollection ? ' in this collection' : ''} yet.</p>
              <button
                type="button"
                onClick={() => setActiveTagFilter(null)}
                className="mt-3 text-stone-700 underline-offset-4 hover:underline text-[12px] tracking-wide"
              >
                Show all looks
              </button>
            </div>
          ) : collectionFilteredOutfits.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-stone-400 bg-white/50 border border-dashed border-stone-300 rounded-3xl">
              <Camera size={40} strokeWidth={1} className="mb-4 opacity-50" />
              <p className="text-lg font-display tracking-wide">{activeCollection ? 'No looks in this collection yet.' : outfitsFilter === 'favorites' ? 'No favourites yet.' : 'No saved looks yet.'}</p>
              <p className="text-sm mt-1">{activeCollection ? 'Open a look and add it to this collection.' : outfitsFilter === 'favorites' ? 'Star a look from its detail page.' : 'Create one in the Studio.'}</p>
            </div>
          ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;
              const oldIndex = collectionFilteredOutfits.findIndex((o) => o.id === active.id);
              const newIndex = collectionFilteredOutfits.findIndex((o) => o.id === over.id);
              if (oldIndex < 0 || newIndex < 0) return;
              const newOrder = arrayMove(collectionFilteredOutfits, oldIndex, newIndex).map((o) => o.id);
              if (onReorderOutfits) onReorderOutfits(newOrder);
              haptic('tap');
            }}
          >
            <SortableContext items={collectionFilteredOutfits.map((o) => o.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                {collectionFilteredOutfits.map((outfit, idx) => {
                  const isSelected = selectedOutfits.has(outfit.id);
                  const handleCardClick = () => {
                    if (selectMode) {
                      setSelectedOutfits((prev) => {
                        const next = new Set(prev);
                        if (next.has(outfit.id)) next.delete(outfit.id); else next.add(outfit.id);
                        return next;
                      });
                    } else {
                      onOpenOutfit?.(outfit.id);
                    }
                  };
                  // First card in the user's arrangement = hero (cover).
                  // Re-orderable: drag any look to the front to crown it
                  // the cover of your lookbook.
                  const indexLabel = `N° ${String(idx + 1).padStart(2, '0')}`;
                  return (
                    <LookbookSortableCard
                      key={outfit.id}
                      outfit={outfit}
                      items={items}
                      isSelected={isSelected}
                      selectMode={selectMode}
                      isHero={idx === 0}
                      indexLabel={indexLabel}
                      onClick={handleCardClick}
                      onContextMenu={(e) => { e.preventDefault(); if (!selectMode) { setSelectMode(true); setSelectedOutfits(new Set([outfit.id])); } }}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          ))}
          {selectMode && selectedOutfits.size > 0 && createPortal(
            // Top-pinned action bar — was previously bottom-pinned but users
            // missed it (attention on the items being clicked, not the bar
            // far below). Now portaled into document.body so it ACTUALLY
            // tracks viewport scroll: `position: fixed` is hijacked by any
            // ancestor with `transform`/`filter`/`backdrop-filter`, becoming
            // relative to that ancestor instead of the viewport. The
            // lookbook view sits inside such a parent (animation/blur), so
            // the toolbar would otherwise scroll with the page. Portaling to
            // body sidesteps the entire ancestor chain.
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-stone-900 text-white rounded-full shadow-2xl ring-2 ring-stone-900/20 flex items-center gap-2 px-3 py-2 animate-in slide-in-from-top-4 duration-200 max-w-[calc(100vw-1rem)]"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
              <span className="text-xs px-3 shrink-0 font-medium">{selectedOutfits.size} selected</span>
              {onCreateLookbook && selectedOutfits.size >= 2 && (
                <button onClick={() => setLookbookNamerOpen(true)}
                  className="px-4 py-2 rounded-full bg-white text-stone-900 hover:bg-stone-100 text-xs font-medium transition-colors inline-flex items-center gap-1.5 shrink-0">
                  <Bookmark size={12} strokeWidth={1.5} /> Share as lookbook
                </button>
              )}
              <button onClick={async () => {
                const ids = Array.from(selectedOutfits);
                if (!window.confirm(`Delete ${ids.length} look${ids.length === 1 ? '' : 's'}?`)) return;
                for (const id of ids) await deleteOutfit(id);
                toast.show(`${ids.length} look${ids.length === 1 ? '' : 's'} deleted`, { kind: 'success' });
                setSelectMode(false); setSelectedOutfits(new Set());
              }} className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-xs font-medium transition-colors inline-flex items-center gap-1.5 shrink-0">
                <Trash2 size={12} strokeWidth={1.5} /> Delete
              </button>
              <button onClick={() => { setSelectMode(false); setSelectedOutfits(new Set()); }}
                className="px-3 py-2 rounded-full text-xs text-stone-300 hover:text-white transition-colors shrink-0"
                aria-label="Exit select mode">
                Cancel
              </button>
            </div>,
            document.body
          )}
          {lookbookNamerOpen && (
            <LookbookNamerModal
              count={selectedOutfits.size}
              busy={lookbookBusy}
              onCancel={() => setLookbookNamerOpen(false)}
              onCreate={async (name) => {
                setLookbookBusy(true);
                try {
                  await onCreateLookbook?.({ name, outfitIds: Array.from(selectedOutfits) });
                  setLookbookNamerOpen(false);
                  setSelectMode(false); setSelectedOutfits(new Set());
                } finally {
                  setLookbookBusy(false);
                }
              }}
            />
          )}
        </div>
      ) : null}

    </div>
  );
}

function ABCompareModal({ pair, onClose, onPick }) {
  const renderSide = (label, side) => {
    const pieces = Object.values(side.outfit).filter(Boolean);
    return (
      <div className="flex flex-col bg-white border border-stone-200/60 rounded-2xl p-4 sm:p-5 smooth-shadow">
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-display text-2xl text-stone-900">{label}</span>
          {typeof side.confidence === 'number' && (
            <span className={`text-[10px] tracking-widest uppercase font-medium px-2 py-1 rounded-full ${
              side.confidence >= 75 ? 'bg-emerald-100 text-emerald-800' : side.confidence >= 50 ? 'bg-brass-100 text-brass-700' : 'bg-orange-100 text-orange-800'
            }`}>{side.confidence}%</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 flex-1">
          {pieces.slice(0, 9).map((p) => (
            <div key={p.id} className="aspect-[3/4] rounded-lg overflow-hidden bg-stone-100">
              {itemImages(p)[0] && <img src={itemImages(p)[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
            </div>
          ))}
        </div>
        {side.reasoning && <p className="text-xs text-stone-600 italic leading-relaxed mb-4">{side.reasoning}</p>}
        <button onClick={() => onPick(side)} className="mt-auto w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-700 transition-all active:scale-[0.98]">
          Pick {label}
        </button>
      </div>
    );
  };
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-md z-[90] overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 text-white">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Pick the look you prefer</p>
            <h2 className="text-2xl sm:text-3xl font-display mt-1">A or B?</h2>
          </div>
          <button onClick={onClose} className="p-2.5 text-stone-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors" aria-label="Close">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {renderSide('A', pair.a)}
          {renderSide('B', pair.b)}
        </div>
      </div>
    </div>,
    document.body
  );
}

function AIHistoryView({ history, items, onApply, onToggleFavorite, onDelete }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'favorites' ? history.filter((h) => h.favorite) : history;
  const sorted = [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (history.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white/50 border border-dashed border-stone-300 rounded-3xl px-6">
        <Sparkles size={40} strokeWidth={1} className="mb-6 text-stone-300" />
        <p className="font-display text-2xl text-stone-700">No Concierge history yet</p>
        <p className="text-sm text-stone-500 mt-3 max-w-md">
          Every Concierge-styled look gets saved here automatically. Re-apply, favourite, or remove past suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Canonical segmented-track pill size — matches Wardrobe status pills
          and Studio tabs (px-4 sm:px-5 py-3 sm:py-2 text-[10px] sm:text-xs). */}
      <div className="flex bg-stone-200/50 p-1.5 rounded-full w-fit">
        {[['all', 'All'], ['favorites', '★ Favourites']].map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`whitespace-nowrap px-4 sm:px-5 py-3 sm:py-2 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-colors duration-200 ${
              filter === f ? 'bg-white text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-stone-500 italic text-sm py-8 text-center">No favourites yet — star past suggestions to keep them here.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((entry) => {
            const resolvedItems = (entry.itemIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
            const date = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={entry.id} className="bg-white border border-stone-200/60 rounded-2xl p-4 sm:p-5 smooth-shadow">
                <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] tracking-widest uppercase text-stone-400">{date}{entry.refined ? ' · refinement' : ''}</p>
                    <p className="text-sm text-stone-900 font-medium mt-1 truncate">{entry.intent || 'Everyday look'}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onToggleFavorite(entry)}
                      className={`p-2 rounded-full transition-all ${
                        entry.favorite ? 'bg-amber-100 text-amber-600' : 'text-stone-300 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                      aria-label="Toggle favourite">
                      <Star size={14} strokeWidth={1.5} className={entry.favorite ? 'fill-amber-500' : ''} />
                    </button>
                    <button onClick={() => onDelete(entry.id)}
                      className="p-2 rounded-full text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all" aria-label="Delete">
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {entry.reasoning && (
                  <p className="text-xs text-stone-600 italic leading-relaxed mb-3">{entry.reasoning}</p>
                )}

                {resolvedItems.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-3">
                    {resolvedItems.map((it) => (
                      <div key={it.id} className="flex-none w-14 aspect-[3/4] rounded-lg overflow-hidden bg-stone-100">
                        {itemImages(it)[0] && <img src={itemImages(it)[0]} alt={it.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-400 italic mb-3">Some items have been deleted from your wardrobe.</p>
                )}

                <button onClick={() => onApply(entry)} disabled={resolvedItems.length === 0}
                  className="w-full px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase font-medium bg-stone-900 text-white hover:bg-stone-700 transition-all active:scale-[0.98] disabled:opacity-50">
                  Re-apply to Current Look
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CapsuleBuilder({ onClose, onGenerate }) {
  const [count, setCount] = useState(5);
  const [styleFilter, setStyleFilter] = useState(null);
  const [tripName, setTripName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setBusy(true);
    try { await onGenerate(count, styleFilter, tripName.trim() || 'Capsule'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Build a capsule</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          <p className="text-stone-500 text-sm leading-relaxed">
            Generate several outfits at once, drawing from your wardrobe — useful for trips, work weeks, or when you want a coordinated rotation.
          </p>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Trip / Capsule name (optional)</label>
            <input value={tripName} onChange={(e) => setTripName(e.target.value)}
              placeholder="e.g. Lisbon, Work week, Long weekend"
              className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-3">Number of looks</label>
            <div className="flex flex-wrap gap-2">
              {[3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" onClick={() => setCount(n)}
                  className={`w-12 h-12 rounded-xl text-sm font-medium border transition-all ${
                    count === n ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-3">Style focus (optional)</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStyleFilter(null)}
                className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border ${
                  styleFilter === null ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}>Any</button>
              {STYLES.map((s) => (
                <button key={s} type="button" onClick={() => setStyleFilter(s)}
                  className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border ${
                    styleFilter === s ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={busy}
            className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-700 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            <Sparkles size={16} strokeWidth={1.5} /> {busy ? 'Generating…' : `Generate ${count} looks`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function LookbookNamerModal({ count, busy, onCancel, onCreate }) {
  useEscapeKey(onCancel);
  const [name, setName] = useState('');
  const submit = (e) => { e?.preventDefault?.(); if (busy) return; onCreate?.(name); };
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onCancel}>
      <form onSubmit={submit} className="bg-[#F7F5F2] w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-stone-200/60 bg-white flex justify-between items-center">
          <h3 className="text-xl font-display text-stone-900">Create lookbook</h3>
          <button type="button" onClick={onCancel} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors" aria-label="Cancel">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-stone-500 text-sm leading-relaxed">
            {count} look{count === 1 ? '' : 's'} will be bundled into a single shareable URL. Anyone with the link can view — no sign-in needed.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            autoFocus
            placeholder="Lookbook name · e.g. Italy 2026"
            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none"
            maxLength={80}
            disabled={busy}
          />
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-5 py-3 text-sm text-stone-500 hover:text-stone-900 rounded-full">Cancel</button>
          <button type="submit" disabled={busy}
            className="px-6 py-3 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50 flex items-center gap-2">
            {busy ? 'Creating…' : 'Create & copy link'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
