import React, { useState, useEffect, useMemo, createContext, useContext, useCallback, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  Shirt, LayoutGrid, Plus, Link as LinkIcon, Trash2,
  Heart, FileText, Ruler, Store, CheckCircle2, AlertCircle, X, Camera, Save,
  Wand2, ChevronRight, ChevronDown, ChevronUp, LogOut, Calendar, TrendingDown, Star, Download, Sparkles, GripVertical, SlidersHorizontal, Bookmark, BookOpen, Check, Copy, ArrowUpDown, Search, Share2, Printer, BarChart3, MoreHorizontal, Pencil
} from 'lucide-react';
import {
  DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import { doc, setDoc, deleteDoc, onSnapshot, collection, writeBatch, getDocs, getDoc, query, orderBy } from 'firebase/firestore';
import { auth, db, onAuthStateChanged, signInWithGoogle, sendMagicLink, signOutUser, isAIEnabled, getFounderCount, findProductListingFromPhoto, connectGoogleCalendar, disconnectGoogleCalendar, isCalendarConnected, fetchCalendarEvents } from './firebase.js';
import { SEED_WARDROBE } from './seedWardrobe.js';
import { readDailyBrief, writeDailyBrief, clearDailyBrief, nextSlotIndex, getInflightCompose, registerInflightCompose } from './dailyBrief';
import { loadCurrentThread, saveCurrentThread, clearCurrentThread } from './conciergeStore';
import { useSubscriptionStatus } from './subscriptionStatus';
import AppCheckDevBanner from './AppCheckDevBanner.jsx';
import AtelierMark from './components/AtelierMark.jsx';
import BottomBar from './nav/BottomBar.jsx';
import Sidebar from './nav/Sidebar.jsx';
import WeekStrip from './components/WeekStrip.jsx';
import ConciergePrompt from './components/ConciergePrompt.jsx';
import ImageFramer from './components/ImageFramer.jsx';
import ItemTileImage from './components/ItemTileImage.jsx';
import {
  SEASONS, TOP_SUBCATEGORIES, BOTTOM_SUBCATEGORIES, OUTERWEAR_SUBCATEGORIES,
  DRESS_SUBCATEGORIES, ACCESSORY_SUBCATEGORIES, JEWELLERY_SUBCATEGORIES,
  SPORTSWEAR_SUBCATEGORIES, BAG_SUBCATEGORIES, SHOE_SUBCATEGORIES,
  SWIMWEAR_SUBCATEGORIES, STYLES, MOOD_PRESETS, INITIAL_MEASUREMENTS,
  STYLE_UNDERTONES, STYLE_SILHOUETTES, STYLE_FORMALITY, STYLE_SEASONS,
  STYLE_PRINCIPLES, CATEGORIES, ITEM_CONDITIONS, CURRENCY_SYMBOLS,
  AI_TEMPERATURE_PRESETS, CARE_TAGS, MATERIALS, materialsForCategory, conditionsForCategory, careAppliesToCategory, CARE_RULES, NEUTRAL_COLORS,
  COLOR_FAMILIES, COLOR_SWATCHES, COLOUR_HEX_MAP, BODY_SHAPE_GUIDES,
} from './lib/taxonomy.js';
import { rgbToHsl, classifyColorFromRgb, matchColorFamily, derivePaletteFromGarments, hexFromColorName, colorsHarmonize, extractDominantColors } from './lib/color.js';
import {
  itemCondition, isItemAvailable, isLive, isDeleted, live, newId, todayISO,
  itemStyles, itemImages, itemColors, itemMaterials, itemSeasons,
  resolveOutfitItems, matchCareTag, itemCareReminder, itemWearHistory,
  itemWearNotes, itemWearOccasions, itemWearCount, itemLastWornISO,
  daysSinceLastWorn, itemCostPerWear, formatLastWorn, formatPrice,
  classifyBodyShape, computeFitAgainstChart, summariseStyleProfile,
} from './lib/items.js';
import { drawRoundedRect, loadImageForCanvas, wrapCanvasText, composeOutfitExportImage, shareOrDownloadImage, autoEnhanceCanvas, removeImageBackground, compressImageToDataUrl, rehostExternalImage, parseSourceUrl, resizeImageToDataUrl } from './lib/canvas.js';
import { fetchTodaysWeather, fetchTravelForecast, weatherLabel, weatherToSeasons, weatherAppropriatenessScore, pickTodaysRecommendation, getGreeting, firstName } from './lib/weather.js';
import { brandSearchUrl, fetchProductFromUrl, imageUrlToCompressedDataUrl } from './lib/net.js';
import { parseReceiptText } from './lib/receipts.js';
import { generateOutfitWithGemini, identifyItemWithGemini, analyzeLabelWithGemini, analyzeReceiptImageWithGemini, analyzeWardrobeGapsWithGemini, analyzeInspirationWithGemini, generateOutfitNameWithGemini, generateOutfitTagsWithGemini, generateWearNarration, generateStyleFitWithGemini, generateConciergeReply, generateStyleManifestoWithGemini, narrateWearWithGemini, generateTravelCapsuleWithGemini, regenerateTravelDayWithGemini, generateFitEstimateWithGemini, generateItemFitWithGemini, scorePurchaseWithGemini } from './lib/ai.js';
import { isFitStale } from './lib/itemFit.js';
import EditorialHeader from './ui/EditorialHeader.jsx';
import { useToast, ToastProvider } from './ui/toast.jsx';
import { useEscapeKey, useCountUp } from './ui/hooks.js';
import Input from './ui/Input.jsx';
import { SHOP_SEEDS } from './lib/seeds.js';
const ShoppingDirectory = lazy(() => import('./views/ShoppingDirectory.jsx'));
const InspirationView = lazy(() => import('./views/InspirationView.jsx'));
import WhyThisPanel from './components/WhyThisPanel.jsx';
import { renderTextWithChips } from './components/ItemChip.jsx';
import TodayView from './views/TodayView.jsx';
const DiaryView = lazy(() => import('./views/Calendar.jsx'));
const WardrobeView = lazy(() => import('./views/WardrobeView.jsx'));
const ProfileView = lazy(() => import('./views/ProfileView.jsx'));
const InsightsView = lazy(() => import('./views/InsightsView.jsx'));
import { OUTFIT_SLOTS, SLOT_FILTER, itemFitsSlot, slotForItem, MULTI_SLOTS, isMultiSlot, slotItems, SLOT_CATEGORIES, emptyOutfit } from './lib/outfit.js';
import AIProgressModal from './components/AIProgressModal.jsx';
import { PinterestGlyph, InstagramGlyph } from './components/BrandGlyphs.jsx';
import { haptic } from './lib/haptic.js';
import { buildPinterestUrl, uploadShareCardImage, newShareId } from './lib/publicShare.js';
const OutfitBuilder = lazy(() => import('./views/OutfitBuilder.jsx'));
import { itemImageDisplay, revertItemPrimary, frameItemPrimary, revertFramePrimary } from './lib/polish.js';

// Owners can invite/revoke other users. Must match the rules file exactly.
// (The rules are the real security boundary — this is just so the UI knows
//  whether to show the Invite panel.)
// Set via VITE_OWNER_EMAILS in .env.local — comma-separated list of emails.
// Empty by default so a fresh fork doesn't unintentionally trust anyone.
const OWNER_EMAILS = (import.meta.env.VITE_OWNER_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);


// Build a self-contained HTML document for a printable packing list page.
// Called by both TravelPlannerModal and PackingListModal so that print output
// is consistent regardless of which path the user took.
// categorySections: raw HTML string of <section> blocks already rendered by
// the caller (since each modal has a different data shape).




// Editorial in-app preview before the system share sheet. Replaces the
// previous "tap Share → OS dialog jumps in" flow which felt like an
// abrupt brand handover. New flow: tap Share → Atelier-styled modal
// previews the composed image, offers three actions in our own visual
// language (Share / Save / Public link), and the OS sheet only opens
// on explicit user confirmation.
function ShareLookModal({ outfit, items, onClose, onCreateLink }) {
  const [imageBlob, setImageBlob] = React.useState(null);
  const [imageUrl, setImageUrl] = React.useState(null);
  const [composing, setComposing] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const toast = useToast();
  useEscapeKey(onClose);

  // Compose the editorial PNG on mount. Cleanup revokes the object URL
  // on unmount so the blob can be GC'd.
  useEffect(() => {
    let cancelled = false;
    setComposing(true); setError(null);
    composeOutfitExportImage(outfit, items)
      .then((blob) => {
        if (cancelled) return;
        setImageBlob(blob);
        setImageUrl(URL.createObjectURL(blob));
        setComposing(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Could not compose the look.');
        setComposing(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit?.id]);

  // Revoke object URL when component unmounts or url changes
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const slug = React.useMemo(() => (outfit?.name || 'look')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'look',
    [outfit?.name]);
  const filename = `${slug}-atelier.png`;

  const handleShare = async () => {
    if (!imageBlob || busy) return;
    setBusy(true);
    try {
      const result = await shareOrDownloadImage(imageBlob, filename, {
        title: outfit?.name || 'A look',
        text: `${outfit?.name || 'A look'} — composed in Atelier.`,
      });
      if (result === 'shared') { toast.show('Shared', { kind: 'success' }); onClose(); }
      else if (result === 'downloaded') { toast.show('Saved to downloads', { kind: 'success' }); }
    } catch (err) {
      toast.show(err?.message || 'Could not share', { kind: 'error' });
    } finally { setBusy(false); }
  };
  const handleDownload = () => {
    if (!imageBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(imageBlob);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.show('Saved to downloads', { kind: 'success' });
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300"
           onClick={(e) => e.stopPropagation()}>
        {/* Editorial header — same eyebrow + brass-rule pattern as every
            other main-column header. Tiny X close in a stone-100 chip. */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200/60 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="inline-block w-5 h-px bg-brass-300" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Share this look</span>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors" aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body — image preview */}
        <div className="px-6 pt-6 pb-4 overflow-y-auto flex-1">
          <p className="text-[10px] tracking-widest uppercase text-stone-500 mb-5">
            {(outfit?.itemIds || []).length} {(outfit?.itemIds || []).length === 1 ? 'piece' : 'pieces'} · Composed for sharing
          </p>

          {/* Preview frame — 9:16 to mirror the actual output. White card
              + hairline border so the preview itself reads as a deliberate
              artifact, not a screenshot. */}
          <div className="relative rounded-2xl overflow-hidden bg-white border border-stone-200/60 smooth-shadow"
               style={{ aspectRatio: '9 / 16' }}>
            {composing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-400">
                <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></div>
                <p className="text-[10px] tracking-[0.28em] uppercase">Composing</p>
              </div>
            )}
            {error && !composing && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-stone-500 text-sm italic">
                {error}
              </div>
            )}
            {imageUrl && !composing && !error && (
              <img src={imageUrl} alt="Preview of the composed look" className="w-full h-full object-contain" />
            )}
          </div>
          <p className="text-[10px] tracking-widest uppercase text-stone-400 text-center mt-3">
            1080 × 1920 · Instagram Story · Pinterest
          </p>
        </div>

        {/* Action footer. Primary Share is the dark hero pill — opens the
            system share sheet WITH the image attached (or downloads if
            the platform doesn't support file-share). Secondary actions
            sit below as a quieter row: Save directly to disk, or generate
            a public hosted link via the existing Firestore flow. */}
        <div className="px-6 py-5 border-t border-stone-200/60 bg-white space-y-3 shrink-0"
             style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
          <button onClick={handleShare} disabled={!imageBlob || busy || !!error}
            className="w-full h-12 bg-stone-900 text-white rounded-full text-sm font-medium hover:bg-stone-700 transition-colors duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-50">
            <Share2 size={16} strokeWidth={1.5} className={busy ? 'animate-pulse' : ''} />
            {busy ? 'Opening share…' : 'Share'}
          </button>
          <div className="flex gap-2">
            <button onClick={handleDownload} disabled={!imageBlob || busy}
              className="flex-1 h-11 bg-white border border-stone-300 text-stone-700 rounded-full text-[10px] tracking-widest uppercase font-medium hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Download size={13} strokeWidth={1.5} /> Save image
            </button>
            {onCreateLink && (
              <button onClick={() => { onCreateLink(imageBlob); onClose(); }}
                className="flex-1 h-11 bg-white border border-stone-300 text-stone-700 rounded-full text-[10px] tracking-widest uppercase font-medium hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 inline-flex items-center justify-center gap-1.5">
                <LinkIcon size={12} strokeWidth={1.5} /> Public link
              </button>
            )}
          </div>

          {/* Social share options — visible mainly on desktop where Web Share
              doesn't cover Pinterest/Instagram natively. On mobile the OS
              share sheet typically already includes both if the apps are
              installed, so we hide this row on small screens. */}
          <div className="hidden sm:block pt-4 border-t border-stone-200/60">
            <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 mb-2.5">Share to</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!imageBlob || busy) return;
                  setBusy(true);
                  try {
                    if (onCreateLink) {
                      try {
                        const res = await onCreateLink(imageBlob);
                        const publicUrl = typeof res === 'string' ? res : res?.url;
                        const cardImageUrl = typeof res === 'object' ? res?.cardImageUrl : null;
                        if (publicUrl) {
                          const pinterestUrl = buildPinterestUrl({
                            url: publicUrl,
                            media: cardImageUrl || undefined,
                            description: outfit?.name || 'A look from Atelier',
                          });
                          window.open(pinterestUrl, '_blank', 'noopener,noreferrer,width=750,height=600');
                          return;
                        }
                      } catch (linkErr) {
                        console.warn('[share] onCreateLink failed:', linkErr?.message);
                      }
                    }
                    handleDownload();
                    window.open('https://www.pinterest.com/pin-builder/', '_blank', 'noopener,noreferrer');
                    toast.show('Image saved — drag it into Pinterest', { kind: 'default', eyebrow: 'TIP' });
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={!imageBlob || busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-300 text-stone-700 text-[12px] tracking-wide hover:border-stone-900 hover:text-stone-900 transition-colors disabled:opacity-60"
              >
                <PinterestGlyph size={16} />
                Pin to Pinterest
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownload();
                  toast.show('Image saved — open Instagram to post', { kind: 'default', eyebrow: 'TIP' });
                }}
                disabled={!imageBlob || busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-300 text-stone-700 text-[12px] tracking-wide hover:border-stone-900 hover:text-stone-900 transition-colors disabled:opacity-60"
              >
                <InstagramGlyph size={16} />
                Save for Instagram
              </button>
            </div>
            <p className="text-[10px] text-stone-400 italic mt-2">
              On mobile, the standard Share button covers Pinterest, Instagram and more.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


// --- Firestore collection / doc refs -------------------------------------
const userItemsRef = (uid) => collection(db, 'users', uid, 'items');
const userOutfitsRef = (uid) => collection(db, 'users', uid, 'outfits');
const userShopsRef = (uid) => collection(db, 'users', uid, 'shops');
const userInspirationRef = (uid) => collection(db, 'users', uid, 'inspiration');
const userAIHistoryRef = (uid) => collection(db, 'users', uid, 'aiHistory');
const userScheduleRef = (uid) => collection(db, 'users', uid, 'schedule');
const userCollectionsRef = (uid) => collection(db, 'users', uid, 'collections');
const userScheduleDoc = (uid, dateISO) => doc(db, 'users', uid, 'schedule', dateISO);
const userProfileDoc = (uid) => doc(db, 'users', uid, 'profile', 'measurements');
const allowlistRef = () => collection(db, 'allowlist');
const allowlistDoc = (email) => doc(db, 'allowlist', email.toLowerCase().trim());
const publicShareDoc = (shareId) => doc(db, 'public', shareId);
// newShareId is imported from ./lib/publicShare.js (single source of truth).

export default function DigitalWardrobeRoot() {
  // Public share routing: if ?share=ID is in the URL, render the read-only
  // share viewer and skip auth entirely. The share doc is publicly readable.
  const shareId = (() => {
    try { return new URLSearchParams(window.location.search).get('share'); }
    catch { return null; }
  })();
  if (shareId) {
    return <ToastProvider><PublicShareView shareId={shareId} /></ToastProvider>;
  }
  return (
    <ToastProvider>
      <AppCheckDevBanner />
      <DigitalWardrobe />
    </ToastProvider>
  );
}

function DigitalWardrobe() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('today');
  // Hint to OutfitBuilder (Lookbook mode) for which internal tab to open
  // on the next render. Used when navigating in from the Insights diary
  // hand-off — clears itself once consumed.
  const [lookbookInitialTab, setLookbookInitialTab] = useState(null);
  // Deep-link target for the Calendar pillar — set by the Today "Your week"
  // strip so tapping a day opens the calendar already on that date.
  const [calendarJumpDate, setCalendarJumpDate] = useState(null);
  const jumpToCalendarDay = (dateISO) => { setCalendarJumpDate(dateISO); setActiveTab('calendar'); };
  // Atelier Concierge — AI chat stylist. Opens as a right-edge slide-in
  // panel; reachable from the sidebar (desktop) and a hero card on the
  // Wardrobe landing page (mobile + desktop).
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  // Demo mode: ?demo=1 in the URL spins up an interactive marketing demo
  // pre-loaded with the SEED_WARDROBE capsule. No auth, no Firestore writes,
  // no cross-contamination with a real user's data. Lives entirely in local
  // React state; a "Reset demo" button restores the seed capsule. Used by
  // the atelier-website marketing site to let prospects try the app cold.
  const [demoMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('demo') === '1';
  });
  const [items, setItems] = useState([]);
  const [measurements, setMeasurements] = useState(INITIAL_MEASUREMENTS);
  const [shops, setShops] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [allowlist, setAllowlist] = useState([]);
  const [inspirations, setInspirations] = useState([]);
  const [selectedInspirationId, setSelectedInspirationId] = useState(null);
  const [isInspirationModalOpen, setIsInspirationModalOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [schedules, setSchedules] = useState({}); // { 'YYYY-MM-DD': { outfitId } }
  const [collections, setCollections] = useState([]); // named outfit moodboards
  const selectedInspiration = selectedInspirationId ? inspirations.find((i) => i.id === selectedInspirationId) : null;
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);
  const [inspirationDefaultFilter, setInspirationDefaultFilter] = useState('all');
  // When jumping to the Wardrobe tab from Insights (or anywhere else), seed
  // the filter/category so the user lands on a pre-filtered view instead of
  // having to drill down a second time. {nonce} forces re-application when
  // the same filter is re-requested.
  const [wardrobeJump, setWardrobeJump] = useState({ filter: null, category: null, nonce: 0 });
  const jumpToWardrobe = ({ filter = null, category = null } = {}) => {
    setWardrobeJump((p) => ({ filter, category, nonce: p.nonce + 1 }));
    setActiveTab('wardrobe');
  };
  // AI styling around a focal item (triggered from ItemDetailView).
  // The styling modal opens whenever styleSourceItem is set.
  const [styleSourceItem, setStyleSourceItem] = useState(null);
  const [styleSuggestion, setStyleSuggestion] = useState(null);
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleError, setStyleError] = useState(null);
  const [styleSaving, setStyleSaving] = useState(false);
  // Outfit variation modal — same shape, but the source is an existing
  // saved outfit and the AI is asked to spin a variation of it.
  const [varySourceOutfit, setVarySourceOutfit] = useState(null);
  const [varySuggestion, setVarySuggestion] = useState(null);
  const [varyBusy, setVaryBusy] = useState(false);
  const [varyError, setVaryError] = useState(null);
  const [varySaving, setVarySaving] = useState(false);
  const [shareTarget, setShareTarget] = useState(null); // { url, title, kind }
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const liveItems = items.filter(isLive);
  // Items the user actually OWNS (not deleted, not wishlist).
  // Use this for composition, counts, AI analysis — anywhere "what's in
  // your wardrobe today" matters. liveItems still exists for views that
  // LEGITIMATELY need both owned + wishlist (the Wardrobe browser with
  // its filters, the Wishlist tab, etc).
  const ownedItems = liveItems.filter((i) => i.status === 'owned');
  const deletedItems = items.filter(isDeleted);
  const mainScrollRef = React.useRef(null);
  // Show a floating ↑ button once the user has scrolled. Universal fallback
  // for the safe-area top-tap (which is 0-height in non-PWA browsers where
  // env(safe-area-inset-top) reports 0). Deps include the auth state because
  // <main> only mounts after auth completes — without these, the effect runs
  // once at the auth-loading splash, finds no main element, and never
  // re-attaches the listener.
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Separate near-top tracker for the floating mobile Profile button.
  // The Profile pill lives at top-right and would otherwise collide with
  // the sticky filter/sort bars that every view pins to the top edge
  // (Wardrobe, Lookbook, Inspiration all use sticky headers that kick
  // in at ~0px scroll). Hiding it as soon as the user starts scrolling
  // gets it out of the way; it returns when they scroll back to the top.
  const [atTop, setAtTop] = useState(true);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [desktopAccountOpen, setDesktopAccountOpen] = useState(false);
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollTop(el.scrollTop > 200);
      setAtTop(el.scrollTop < 8);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [authReady, user, accessDenied]);
  const scrollMainToTop = () => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  useEffect(() => { mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' }); }, [activeTab]);
  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;
  const [openOutfitId, setOpenOutfitId] = useState(null);
  const openOutfit = openOutfitId ? outfits.find((o) => o.id === openOutfitId) : null;

  const isOwner = !!(user?.email && OWNER_EMAILS.includes(user.email.toLowerCase()));
  const subStatus = useSubscriptionStatus(user);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      setAccessDenied(false);
      if (!u) setLoading(false);
    });
  }, []);

  // Post-OAuth return from the Google Calendar consent screen. The callback
  // lands on the app root with ?calendarConnected=1 regardless of which tab
  // is active, so this runs once at mount and strips the param afterwards so
  // a refresh doesn't re-toast.
  useEffect(() => {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    if (params.get('calendarConnected') === '1') {
      toast.show('Calendar connected', { kind: 'success', eyebrow: 'CONNECTED' });
      params.delete('calendarConnected');
      const qs = params.toString();
      const newUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Demo mode bootstrap. Skips Firestore entirely — populates items from the
  // local SEED_WARDROBE capsule and forces auth as ready so the auth gate
  // falls through to the main app. Outfits/inspirations/etc stay empty so
  // visitors can experience the "blank lookbook" + AI flows from scratch.
  useEffect(() => {
    if (!demoMode) return;
    setItems(SEED_WARDROBE.map((it) => ({ ...it })));  // clone so user edits don't mutate the import
    setLoading(false);
    setAuthReady(true);
  }, [demoMode]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setAccessDenied(false);

    const seedShopsIfEmpty = async () => {
      const snap = await getDocs(userShopsRef(user.uid));
      if (snap.empty) {
        const batch = writeBatch(db);
        SHOP_SEEDS.forEach((shop) => {
          const id = newId();
          batch.set(doc(userShopsRef(user.uid), id), { ...shop, id });
        });
        await batch.commit();
      }
    };
    seedShopsIfEmpty().catch((err) => {
      if (err?.code === 'permission-denied') { setAccessDenied(true); setLoading(false); }
      else console.error('shop seed failed', err);
    });

    const onPermErr = (err) => {
      if (err?.code === 'permission-denied') setAccessDenied(true);
      else console.error(err);
      setLoading(false);
    };

    const unsubItems = onSnapshot(userItemsRef(user.uid),
      (snap) => { setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }))); setLoading(false); },
      onPermErr
    );
    const unsubOutfits = onSnapshot(userOutfitsRef(user.uid),
      (snap) => setOutfits(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubShops = onSnapshot(userShopsRef(user.uid),
      (snap) => setShops(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubInspiration = onSnapshot(userInspirationRef(user.uid),
      (snap) => setInspirations(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubAIHistory = onSnapshot(userAIHistoryRef(user.uid),
      (snap) => setAiHistory(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubSchedule = onSnapshot(userScheduleRef(user.uid),
      (snap) => {
        const map = {};
        for (const d of snap.docs) map[d.id] = d.data();
        setSchedules(map);
      },
      onPermErr
    );
    const unsubProfile = onSnapshot(userProfileDoc(user.uid),
      (snap) => { if (snap.exists()) setMeasurements({ ...INITIAL_MEASUREMENTS, ...snap.data() }); },
      onPermErr
    );
    const unsubCollections = onSnapshot(
      query(userCollectionsRef(user.uid), orderBy('createdAt', 'desc')),
      (snap) => setCollections(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onPermErr
    );

    return () => { unsubItems(); unsubOutfits(); unsubShops(); unsubInspiration(); unsubAIHistory(); unsubSchedule(); unsubProfile(); unsubCollections(); };
  }, [user]);

  // Only owners can list the whole allowlist; everyone else just gets [].
  useEffect(() => {
    if (!isOwner) { setAllowlist([]); return; }
    return onSnapshot(allowlistRef(),
      (snap) => setAllowlist(snap.docs.map((d) => ({ email: d.id, ...d.data() }))),
      (err) => console.error('allowlist subscribe failed', err)
    );
  }, [isOwner]);

  const handleAddItem = async (newItem) => {
    if (demoMode) {
      // Local-state only; visitor's changes evaporate on refresh / reset.
      setItems((prev) => {
        const exists = prev.some((i) => i.id === newItem.id);
        return exists ? prev.map((i) => (i.id === newItem.id ? newItem : i)) : [...prev, newItem];
      });
      return;
    }
    if (!user) return;
    await setDoc(doc(userItemsRef(user.uid), newItem.id), newItem);

    // Fire-and-forget rehost: if any image is still an external URL (not a
    // data URL), copy it into inline data in the background. The initial save
    // above is already done — the user sees the item immediately. When the
    // rehost completes, a second write patches the item with the data URL.
    // This handles the case where fetchProductFromUrl's imageUrlToCompressedDataUrl
    // failed (e.g. the proxy timed out) and fell back to the raw external URL.
    const externalRefs = [];
    if (newItem.imageUrl && !newItem.imageUrl.startsWith('data:')) {
      externalRefs.push({ field: 'imageUrl', index: -1, url: newItem.imageUrl });
    }
    if (Array.isArray(newItem.images)) {
      newItem.images.forEach((u, i) => {
        if (u && !u.startsWith('data:')) externalRefs.push({ field: 'images', index: i, url: u });
      });
    }
    if (externalRefs.length > 0) {
      const uid = user.uid;
      (async () => {
        try {
          const patch = { ...newItem };
          let changed = false;
          for (const ref of externalRefs) {
            const dataUrl = await rehostExternalImage(ref.url);
            if (!dataUrl || dataUrl === ref.url) continue;
            if (ref.field === 'imageUrl') {
              patch.imageUrl = dataUrl;
              changed = true;
            } else if (ref.field === 'images' && Array.isArray(patch.images)) {
              const next = [...patch.images];
              next[ref.index] = dataUrl;
              patch.images = next;
              changed = true;
            }
          }
          if (changed) {
            await setDoc(doc(userItemsRef(uid), newItem.id), patch);
            console.log('[rehost] patched item', newItem.id, 'with', externalRefs.length, 'rehosted image(s)');
          }
        } catch (err) {
          console.warn('[rehost-bg] failed for item', newItem.id, '—', err?.message);
        }
      })();
    }
  };
  const handleBulkUpdateItems = async (ids, partial) => {
    if (!ids.length) return;
    if (demoMode) {
      setItems((prev) => prev.map((it) => (ids.includes(it.id) ? { ...it, ...partial } : it)));
      toast.show(`Updated ${ids.length} item${ids.length === 1 ? '' : 's'}`, { kind: 'success' });
      return;
    }
    if (!user) return;
    const batch = writeBatch(db);
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      batch.set(doc(userItemsRef(user.uid), id), { ...item, ...partial });
    }
    await batch.commit();
    toast.show(`Updated ${ids.length} item${ids.length === 1 ? '' : 's'}`, { kind: 'success' });
  };
  const handleBulkDeleteItems = async (ids) => {
    if (!user || !ids.length) return;
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      batch.set(doc(userItemsRef(user.uid), id), { ...item, deletedAt: now });
    }
    await batch.commit();
    toast.show(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'} to Trash`, { kind: 'default' });
  };

  const handleBulkAddItems = async (newItems) => {
    if (!user || !newItems.length) return;
    const batch = writeBatch(db);
    for (const item of newItems) batch.set(doc(userItemsRef(user.uid), item.id), item);
    await batch.commit();
    toast.show(`${newItems.length} item${newItems.length === 1 ? '' : 's'} added from receipt`, { kind: 'success' });
  };
  const handleDeleteItem = async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (demoMode) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, deletedAt: new Date().toISOString() } : i)));
      toast.show('Moved to Trash · restore from Profile', { kind: 'default' });
      return;
    }
    if (!user) return;
    // Soft delete: 30-day grace period (restorable from Profile → Trash).
    await setDoc(doc(userItemsRef(user.uid), id), { ...item, deletedAt: new Date().toISOString() });
    toast.show('Moved to Trash · restore from Profile', { kind: 'default' });
  };
  const handleRestoreItem = async (id) => {
    if (!user) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { deletedAt, ...rest } = item;
    await setDoc(doc(userItemsRef(user.uid), id), rest);
    toast.show('Restored to your wardrobe', { kind: 'success' });
  };
  const handleHardDeleteItem = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userItemsRef(user.uid), id));
    toast.show('Permanently removed', { kind: 'default' });
  };

  // Auto-purge items soft-deleted more than 30 days ago. Runs once when
  // the user's items first load; quietly batches up to 50 per pass so a
  // huge backlog doesn't blow the writeBatch limit.
  const purgedRef = React.useRef(false);
  useEffect(() => {
    if (!user || purgedRef.current || items.length === 0) return;
    purgedRef.current = true;
    const cutoff = Date.now() - 30 * 86_400_000;
    const stale = items.filter((i) => i.deletedAt && new Date(i.deletedAt).getTime() < cutoff).slice(0, 50);
    if (stale.length === 0) return;
    (async () => {
      const batch = writeBatch(db);
      for (const it of stale) batch.delete(doc(userItemsRef(user.uid), it.id));
      try { await batch.commit(); } catch { /* silent — not user-blocking */ }
    })();
  }, [user, items.length]);

  // Wishlist price watcher. Once per app session, scan wishlist items with a
  // sourceUrl whose last check was > 24h ago. Re-fetch via Microlink+schema,
  // append to priceHistory[], toast on >5% drop. Stops after 6 refreshes per
  // session to be polite to free APIs.
  const priceWatchRef = React.useRef(false);
  useEffect(() => {
    if (!user || priceWatchRef.current || items.length === 0) return;
    priceWatchRef.current = true;
    (async () => {
      const dayAgo = Date.now() - 24 * 3600_000;
      const candidates = items
        .filter((i) => i.status === 'wishlist' && i.sourceUrl && !i.deletedAt)
        .filter((i) => !i.priceCheckedAt || new Date(i.priceCheckedAt).getTime() < dayAgo)
        .slice(0, 6);
      if (candidates.length === 0) return;
      for (const it of candidates) {
        try {
          const data = await fetchProductFromUrl(it.sourceUrl);
          const newPrice = Number(data.price);
          if (!Number.isFinite(newPrice) || newPrice <= 0) {
            await setDoc(doc(userItemsRef(user.uid), it.id), { ...it, priceCheckedAt: new Date().toISOString() });
            continue;
          }
          const oldPrice = Number(it.price) || 0;
          const history = Array.isArray(it.priceHistory) ? it.priceHistory : [];
          const lastLogged = history[history.length - 1]?.price ?? oldPrice;
          const next = lastLogged === newPrice ? history : [...history, { date: new Date().toISOString().slice(0, 10), price: newPrice }].slice(-30);
          await setDoc(doc(userItemsRef(user.uid), it.id), {
            ...it, price: newPrice, priceHistory: next, priceCheckedAt: new Date().toISOString(),
          });
          if (oldPrice > 0 && newPrice < oldPrice * 0.95) {
            const drop = Math.round((1 - newPrice / oldPrice) * 100);
            toast.show(`${it.name}: ${drop}% off · now £${newPrice}`, { kind: 'success', duration: 6000 });
          }
        } catch {
          // Persist the attempt timestamp so a permanently failing URL doesn't
          // get re-scanned on every app load. Without this, the 24h gate above
          // never engages for failing items and the proxy chain runs forever.
          try {
            await setDoc(doc(userItemsRef(user.uid), it.id), { ...it, priceCheckedAt: new Date().toISOString() });
          } catch { /* offline / firestore down — accept the retry next time */ }
        }
      }
    })();
  }, [user, items.length]);
  const handleSaveOutfit = async (outfit) => {
    if (demoMode) {
      setOutfits((prev) => {
        const exists = prev.some((o) => o.id === outfit.id);
        return exists ? prev.map((o) => (o.id === outfit.id ? outfit : o)) : [...prev, outfit];
      });
      if (!outfit.capsule) toast.show('Look saved · sign up to keep it', { kind: 'success' });
      return;
    }
    if (!user) return;
    await setDoc(doc(userOutfitsRef(user.uid), outfit.id), outfit);
    // Capsule generator handles its own summary toast — don't spam per-look here.
    if (!outfit.capsule) {
      toast.show(outfit.name, { kind: 'success', eyebrow: 'SAVED' });
    }
  };
  const handleDeleteOutfit = async (id) => {
    if (demoMode) {
      setOutfits((prev) => prev.filter((o) => o.id !== id));
      return;
    }
    if (!user) return;
    await deleteDoc(doc(userOutfitsRef(user.uid), id));
  };
  // Persist the user's Lookbook order. Receives the outfits in their NEW
  // sequence; assigns sequential `order` values and writes them back in
  // parallel. We write ALL affected docs (not just the moved one) because
  // sortable arrays shift indices in a range — anyone between the source
  // and destination needs their order updated too. Trade-off: N writes per
  // drag, but N is usually small (≤30 lookbook entries for most users).
  const handleReorderOutfits = async (orderedIds) => {
    if (!Array.isArray(orderedIds)) return;
    if (demoMode) {
      setOutfits((prev) => {
        const indexById = new Map(orderedIds.map((id, idx) => [id, idx]));
        return prev.map((o) => (indexById.has(o.id) ? { ...o, order: indexById.get(o.id) } : o));
      });
      return;
    }
    if (!user) return;
    try {
      await Promise.all(orderedIds.map((id, idx) => {
        const o = outfits.find((x) => x.id === id);
        if (!o || o.order === idx) return null;
        return setDoc(doc(userOutfitsRef(user.uid), id), { ...o, order: idx });
      }).filter(Boolean));
    } catch (err) {
      toast.show('Could not save the new order', { kind: 'error' });
    }
  };
  // --- Collections (named outfit moodboards) ---
  // /users/{uid}/collections/{id}: { id, name, outfitIds[], cover, createdAt, notes? }
  const handleCreateCollection = async (name, initialOutfitIds = []) => {
    if (!user || !name?.trim()) return null;
    const id = newId();
    const data = {
      id,
      name: name.trim(),
      outfitIds: Array.isArray(initialOutfitIds) ? initialOutfitIds : [],
      cover: null,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(userCollectionsRef(user.uid), id), data);
    return id;
  };

  const handleAddOutfitToCollection = async (collectionId, outfitId) => {
    if (!user) return;
    const coll = collections.find((c) => c.id === collectionId);
    if (!coll || coll.outfitIds.includes(outfitId)) return;
    await setDoc(doc(userCollectionsRef(user.uid), collectionId), {
      ...coll,
      outfitIds: [...coll.outfitIds, outfitId],
    });
  };

  const handleRemoveOutfitFromCollection = async (collectionId, outfitId) => {
    if (!user) return;
    const coll = collections.find((c) => c.id === collectionId);
    if (!coll) return;
    await setDoc(doc(userCollectionsRef(user.uid), collectionId), {
      ...coll,
      outfitIds: coll.outfitIds.filter((id) => id !== outfitId),
    });
  };

  const handleRenameCollection = async (collectionId, name) => {
    if (!user || !name?.trim()) return;
    const coll = collections.find((c) => c.id === collectionId);
    if (!coll) return;
    await setDoc(doc(userCollectionsRef(user.uid), collectionId), {
      ...coll,
      name: name.trim(),
    });
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!user) return;
    await deleteDoc(doc(userCollectionsRef(user.uid), collectionId));
  };

  // Snapshot a collection of outfits as a lookbook. Same /public/{shareId}
  // shape as single shares; the public viewer renders kind === 'lookbook'
  // as a vertical list of outfits with a sticky contents nav.
  const handleShareLookbook = async ({ name, outfitIds }) => {
    if (!user) return null;
    const picked = outfitIds.map((id) => outfits.find((o) => o.id === id)).filter(Boolean);
    if (picked.length === 0) return null;
    const looks = picked.map((outfit) => ({
      id: outfit.id,
      name: outfit.name || 'Untitled look',
      reasoning: outfit.reasoning || '',
      pieces: resolveOutfitItems(outfit, items).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || '',
        category: p.category || '',
        subCategory: p.subCategory || '',
        images: (Array.isArray(p.images) ? p.images : (p.image ? [p.image] : [])).slice(0, 1),
        colors: itemColors(p),
      })),
    }));
    const shareId = newShareId();
    const title = (name || '').trim() || `Lookbook · ${picked.length} looks`;
    const snapshot = {
      v: 1,
      kind: 'lookbook',
      name: title,
      sharedAt: new Date().toISOString(),
      sharedByName: user.displayName || 'Atelier',
      looks,
    };
    await setDoc(publicShareDoc(shareId), snapshot);
    const url = `${window.location.origin}/?share=${shareId}`;
    setShareTarget({ url, title, kind: 'lookbook' });
    return url;
  };

  // Snapshot the outfit (+ resolved item summaries) into /public/{shareId} so
  // anyone with the link can view, even unauthenticated. Embeds image data URLs
  // directly — the share doc is self-contained, no follow-up reads required.
  const handleShareOutfit = async (outfit, cardBlob = null) => {
    if (!user) return null;
    const pieces = resolveOutfitItems(outfit, items).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || '',
      category: p.category || '',
      subCategory: p.subCategory || '',
      images: (Array.isArray(p.images) ? p.images : (p.image ? [p.image] : [])).slice(0, 1),
      colors: itemColors(p),
    }));
    const shareId = newShareId();
    const title = outfit.name || 'Untitled look';
    let cardImageUrl = null;
    if (cardBlob) {
      try { cardImageUrl = await uploadShareCardImage(shareId, cardBlob); }
      catch (e) { console.warn('[share] card image upload failed:', e?.message); }
    }
    const snapshot = {
      v: 1,
      kind: 'outfit',
      name: title,
      reasoning: outfit.reasoning || '',
      cardImageUrl,
      sharedAt: new Date().toISOString(),
      sharedByName: user.displayName || 'Atelier',
      pieces,
    };
    await setDoc(publicShareDoc(shareId), snapshot);
    const url = `${window.location.origin}/?share=${shareId}`;
    setShareTarget({ url, title, kind: 'outfit' });
    return { url, cardImageUrl };
  };

  // Editorial-share flow — opens the in-app preview modal rather than
  // jumping straight to the OS share sheet. The modal renders the
  // composed image in Atelier's language, then offers Share / Save /
  // Public-link actions. This is the "luxury publishing moment" — the
  // user sees the artifact before it leaves the app.
  const [shareModalOutfit, setShareModalOutfit] = useState(null);
  const handleExportOutfit = (outfit) => {
    if (!outfit) return;
    setShareModalOutfit(outfit);
  };

  // Single wishlist/owned item shared as a self-contained public page.
  // Mirrors handleShareOutfit: snapshots image + key metadata into
  // /public/{shareId} so the page is viewable by anyone with the link,
  // unauthenticated. Useful for "should I buy this?" texts to friends.
  // Only the primary image is included — Firestore caps docs at 1 MiB and
  // base64 photos can be 150-300 KB each, so multiple would risk overflow.
  const handleShareItem = async (item) => {
    if (!user) return null;
    const shareId = newShareId();
    const title = item.name || 'A piece';
    const allImages = itemImages(item);
    const primaryImage = allImages[0];
    const snapshot = {
      v: 1,
      kind: 'item',
      name: title,
      brand: item.brand || '',
      category: item.category || '',
      subCategory: item.subCategory || '',
      price: Number(item.price) || 0,
      status: item.status || 'owned',
      colors: itemColors(item),
      materials: itemMaterials(item),
      styles: itemStyles(item),
      seasons: itemSeasons(item),
      description: item.description || '',
      wishlistReason: item.wishlistReason || '',
      images: primaryImage ? [primaryImage] : [],
      sourceUrl: item.sourceUrl || '',
      sharedAt: new Date().toISOString(),
      sharedByName: user.displayName || 'Atelier',
    };
    try {
      const docSizeKB = Math.round(JSON.stringify(snapshot).length / 1024);
      console.log(`[share] item snapshot ${docSizeKB} KB · kind=item · image=${primaryImage ? 'yes' : 'no'}`);
      if (docSizeKB > 900) {
        // 1 MiB Firestore cap with ~10% buffer. The photo is the likely culprit.
        toast.show('Photo is too large to share. Try a different item or re-add the photo at lower quality.', { kind: 'error', duration: 6000 });
        return null;
      }
      await setDoc(publicShareDoc(shareId), snapshot);
    } catch (err) {
      console.error('[share] failed to save item share doc', err);
      toast.show(`Could not create share link: ${err?.message || 'unknown error'}`, { kind: 'error', duration: 6000 });
      return null;
    }
    const url = `${window.location.origin}/?share=${shareId}`;
    setShareTarget({ url, title, kind: 'item', sharedByName: snapshot.sharedByName, status: snapshot.status });
    return url;
  };

  // Style around a focal item. Triggered from ItemDetailView's "Style with
  // this" button (owned) or "Style this — see how it works" card (wishlist).
  // For wishlist items we include the focal piece in the source list even
  // though it's not owned — that way the AI can include it in the outfit.
  const handleStyleWithItem = async (item) => {
    if (!item) return;
    setStyleSourceItem(item);
    setStyleSuggestion(null);
    setStyleError(null);
    setStyleBusy(true);
    try {
      // Skip items in the wash / damaged so AI doesn't suggest pieces you
      // can't actually wear right now. The focal item itself bypasses this
      // check — if you're explicitly styling around it, you want it included.
      const owned = liveItems.filter((i) => i.status === 'owned' && !i.deletedAt && (isItemAvailable(i) || i.id === item.id));
      const sourceItems = item.status === 'wishlist' && !owned.find((i) => i.id === item.id)
        ? [item, ...owned]
        : owned;
      if (sourceItems.length < 3) throw new Error('Add a few more owned pieces first — styling needs at least 3 items to work with.');
      const month = new Date().getMonth();
      const season = month >= 2 && month <= 4 ? 'Spring'
        : month >= 5 && month <= 7 ? 'Summer'
        : month >= 8 && month <= 10 ? 'Autumn'
        : 'Winter';
      const result = await generateOutfitWithGemini({
        items: sourceItems,
        intent: `an outfit built around ${item.name}${item.status === 'wishlist' ? ' (checking how it would fit my wardrobe)' : ''}`,
        season,
        styleProfile: summariseStyleProfile(measurements),
        temperature: AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7,
        mustIncludeItem: item,
      });
      setStyleSuggestion(result);
    } catch (err) {
      setStyleError(err?.message || 'Styling failed.');
    } finally {
      setStyleBusy(false);
    }
  };

  // Save the AI-suggested outfit as a real saved look, close the modal +
  // ItemDetailView, and open the new outfit so the user lands on it.
  const handleSaveStyledOutfit = async (providedName) => {
    if (!styleSuggestion?.itemIds || !styleSourceItem) return;
    setStyleSaving(true);
    try {
      const outfit = {
        id: newId(),
        name: providedName || `Styled with ${styleSourceItem.name}`,
        itemIds: styleSuggestion.itemIds,
        reasoning: styleSuggestion.reasoning || '',
        ...(typeof styleSuggestion.confidence === 'number' ? { confidence: styleSuggestion.confidence } : {}),
        createdAt: new Date().toISOString(),
      };
      await handleSaveOutfit(outfit);
      toast.show('Look saved · opening it now', { kind: 'success' });
      setStyleSuggestion(null);
      setStyleSourceItem(null);
      setSelectedItemId(null);
      setOpenOutfitId(outfit.id);
    } catch (err) {
      toast.show(`Could not save: ${err?.message || 'unknown error'}`, { kind: 'error' });
    } finally {
      setStyleSaving(false);
    }
  };
  const dismissStyleSuggestion = () => {
    setStyleSuggestion(null);
    setStyleSourceItem(null);
    setStyleError(null);
  };

  // Spin a variation of an existing saved outfit. Reuses the
  // generateOutfitWithGemini refinement path (previousOutfit + intent) so the
  // AI is anchored on the original rather than starting from scratch.
  // Intent presets map to prompt phrasing; users can re-trigger with a
  // different preset from inside the modal.
  const VARIATION_INTENTS = {
    fresh: 'a fresh variation of this outfit — keep the overall spirit, swap one or two pieces for new combinations',
    casual: 'a more casual version of this outfit — relax the formality',
    polished: 'a more polished version of this outfit — elevate the formality',
    palette: 'this outfit reimagined in a different colour palette',
    season: 'the same vibe but reimagined for the opposite mood (sleek vs softer, neutral vs colour-led)',
  };
  const handleVaryOutfit = async (outfit, intentKey = 'fresh') => {
    if (!outfit) return;
    setVarySourceOutfit(outfit);
    setVarySuggestion(null);
    setVaryError(null);
    setVaryBusy(true);
    try {
      // Skip items in the wash / damaged so variations only use pieces
      // available right now. Items in the original outfit that are
      // currently unavailable are still passed so the AI knows what to
      // swap away from.
      const owned = liveItems.filter((i) => i.status === 'owned' && !i.deletedAt && isItemAvailable(i));
      if (owned.length < 3) throw new Error('Add a few more owned pieces first — variations need at least 3 items to work with.');
      const previousPieces = resolveOutfitItems(outfit, liveItems);
      const month = new Date().getMonth();
      const season = month >= 2 && month <= 4 ? 'Spring'
        : month >= 5 && month <= 7 ? 'Summer'
        : month >= 8 && month <= 10 ? 'Autumn'
        : 'Winter';
      const result = await generateOutfitWithGemini({
        items: owned,
        intent: VARIATION_INTENTS[intentKey] || VARIATION_INTENTS.fresh,
        season,
        previousOutfit: previousPieces,
        styleProfile: summariseStyleProfile(measurements),
        temperature: AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7,
      });
      setVarySuggestion(result);
    } catch (err) {
      setVaryError(err?.message || 'Styling failed.');
    } finally {
      setVaryBusy(false);
    }
  };
  const handleSaveVariation = async () => {
    if (!varySuggestion?.itemIds || !varySourceOutfit) return;
    setVarySaving(true);
    try {
      const baseName = varySourceOutfit.name || 'Look';
      const newOutfit = {
        id: newId(),
        name: `${baseName} · variation`,
        itemIds: varySuggestion.itemIds,
        reasoning: varySuggestion.reasoning || '',
        ...(typeof varySuggestion.confidence === 'number' ? { confidence: varySuggestion.confidence } : {}),
        createdAt: new Date().toISOString(),
      };
      await handleSaveOutfit(newOutfit);
      toast.show('Variation saved · opening it now', { kind: 'success' });
      setVarySuggestion(null);
      setVarySourceOutfit(null);
      setOpenOutfitId(newOutfit.id);
    } catch (err) {
      toast.show(`Could not save: ${err?.message || 'unknown error'}`, { kind: 'error' });
    } finally {
      setVarySaving(false);
    }
  };
  const dismissVariation = () => {
    setVarySuggestion(null);
    setVarySourceOutfit(null);
    setVaryError(null);
  };

  // Edit an existing saved outfit. Setting this loads the outfit into the
  // OutfitBuilder (Styling Studio) and switches to that tab. Save updates
  // the original doc instead of creating a new one.
  const [editingOutfit, setEditingOutfit] = useState(null);
  // Seed handoff from Lookbook (AI History "Apply") → Studio. Holds the
  // entry the user wants pre-loaded into the canvas. OutfitBuilder picks
  // it up via the seedOutfit prop and clears via onSeedConsumed.
  const [studioSeed, setStudioSeed] = useState(null);
  const handleEditOutfit = (outfit) => {
    if (!outfit) return;
    setEditingOutfit(outfit);
    setOpenOutfitId(null); // close OutfitDetailView so the user lands in Studio
    setActiveTab('outfits');
  };

  const handleSaveProfile = async (newMeasurements) => {
    if (!user) return;
    await setDoc(userProfileDoc(user.uid), newMeasurements);
  };
  const handleSaveShop = async (shop) => {
    if (!user) return;
    await setDoc(doc(userShopsRef(user.uid), shop.id), shop);
  };
  const handleDeleteShop = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userShopsRef(user.uid), id));
  };
  const handleAddInvite = async (rawEmail, displayName = '') => {
    const email = rawEmail?.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('Please enter a valid email.');
    await setDoc(allowlistDoc(email), {
      addedBy: user.email,
      addedAt: new Date().toISOString(),
      ...(displayName ? { displayName } : {}),
    });
  };
  const handleRemoveInvite = async (email) => {
    if (OWNER_EMAILS.includes(email)) throw new Error('Owners cannot be revoked from the allowlist.');
    await deleteDoc(allowlistDoc(email));
  };
  const handleSaveAIHistory = async (entry) => {
    if (!user) return;
    await setDoc(doc(userAIHistoryRef(user.uid), entry.id), entry);
    // Auto-prune to keep most recent 50
    if (aiHistory.length >= 50) {
      const sorted = [...aiHistory].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      const toDelete = sorted.slice(0, aiHistory.length - 49);
      for (const old of toDelete) {
        deleteDoc(doc(userAIHistoryRef(user.uid), old.id)).catch(() => {});
      }
    }
  };
  const handleDeleteAIHistory = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userAIHistoryRef(user.uid), id));
  };
  const handleToggleAIHistoryFavorite = async (entry) => {
    if (!user) return;
    await setDoc(doc(userAIHistoryRef(user.uid), entry.id), { ...entry, favorite: !entry.favorite });
  };
  // meta is an optional plain object written verbatim into the schedule doc.
  // TravelPlannerModal uses it to stamp trip metadata onto each scheduled day:
  //   meta.trip = { id, name, startISO, endISO, location }
  // All existing call-sites that pass only (dateISO, outfitId) are unaffected —
  // the third positional arg is still the eventName string for the rare callers
  // that set it, and meta is the FOURTH arg for new travel-planner callers.
  const handleScheduleOutfit = async (dateISO, outfitId, eventName = '', meta = null) => {
    if (!user) return;
    if (!outfitId) {
      await deleteDoc(userScheduleDoc(user.uid, dateISO));
      toast.show('Removed from schedule', { kind: 'default' });
    } else {
      const trimmed = (eventName || '').trim();
      const doc = { outfitId, scheduledAt: new Date().toISOString() };
      if (trimmed) doc.eventName = trimmed;
      if (meta && typeof meta === 'object') Object.assign(doc, meta);
      await setDoc(userScheduleDoc(user.uid, dateISO), doc);
      toast.show(trimmed ? `Scheduled · ${trimmed}` : 'Scheduled', { kind: 'success' });
    }
  };

  // Delete a whole trip: a trip is derived from the scheduled days that share
  // its trip.id, so removing it means deleting each of those scheduled docs.
  // One toast (not one per day). The trips list re-derives once the schedule
  // snapshot updates.
  const handleDeleteTrip = async (trip) => {
    if (!user || !trip?.days?.length) return;
    await Promise.all(trip.days.map((d) => deleteDoc(userScheduleDoc(user.uid, d.dateISO))));
    toast.show(`Trip removed · ${trip.name}`, { kind: 'default' });
  };

  const handleSaveInspiration = async (insp) => {
    if (!user) return;
    await setDoc(doc(userInspirationRef(user.uid), insp.id), insp);
  };
  const handleDeleteInspiration = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userInspirationRef(user.uid), id));
    toast.show('Inspiration removed', { kind: 'default' });
  };
  const handleAnalyzeInspiration = async (insp) => {
    if (!user) return;
    const analysis = await analyzeInspirationWithGemini({ imageDataUrl: insp.image, items: ownedItems });
    await setDoc(doc(userInspirationRef(user.uid), insp.id), { ...insp, analysis });
    toast.show('Analysis complete', { kind: 'success' });
  };

  const handleDuplicateItem = async (item) => {
    if (!user) return;
    const copy = {
      ...item,
      id: newId(),
      name: `${item.name} (copy)`,
      createdAt: new Date().toISOString(),
      wearHistory: [], // fresh wear log for the duplicate
    };
    delete copy.deletedAt;
    await handleAddItem(copy);
    toast.show('Duplicated — edit colour/photos', { kind: 'success' });
    setSelectedItemId(null);
    setEditingItem(copy);
    setIsAddItemModalOpen(true);
  };

  const handleToggleFavorite = async (item) => {
    if (!user) return;
    haptic('tap');
    await handleAddItem({ ...item, favorite: !item.favorite });
    toast.show(item.favorite ? 'Removed from favourites' : 'Added to favourites', { kind: 'success', duration: 1400 });
  };
  const handleSetItemCondition = async (item, condition) => {
    if (!user) return;
    const next = condition === 'available' ? null : condition;
    await handleAddItem({ ...item, condition: next });
    const meta = ITEM_CONDITIONS.find((c) => c.key === condition);
    toast.show(meta ? `${item.name} · ${meta.shortcut}` : 'Updated', { kind: 'success', duration: 1800 });
  };
  const handleLogWear = async (item, dateISO = todayISO(), occasion = '') => {
    if (!user) return;
    const history = itemWearHistory(item);
    if (history.includes(dateISO)) return; // already logged for this date
    const occasions = { ...itemWearOccasions(item) };
    if (occasion && occasion.trim()) occasions[dateISO] = occasion.trim();
    await handleAddItem({ ...item, wearHistory: [...history, dateISO].sort(), wearOccasions: occasions });
    const newCount = history.length + 1;
    const cpw = itemCostPerWear({ ...item, wearHistory: [...history, dateISO] });
    haptic('success');
    toast.show(
      `Logged · ${newCount} ${newCount === 1 ? 'wear' : 'wears'}${cpw !== null ? ` · £${cpw < 10 ? cpw.toFixed(2) : Math.round(cpw)}/wear` : ''}`,
      { kind: 'success' }
    );
  };
  const handleUnlogWear = async (item, dateISO) => {
    if (!user) return;
    const history = itemWearHistory(item).filter((d) => d !== dateISO);
    const notes = { ...itemWearNotes(item) };
    delete notes[dateISO];
    const occasions = { ...itemWearOccasions(item) };
    delete occasions[dateISO];
    await handleAddItem({ ...item, wearHistory: history, wearNotes: notes, wearOccasions: occasions });
  };
  const handleMarkCared = async (item) => {
    if (!user) return;
    await handleAddItem({ ...item, caredAtWear: itemWearCount(item), caredAt: new Date().toISOString() });
    toast.show('Marked as cared for — next reminder when due', { kind: 'success' });
  };

  // Cascade a single wear-log across every item in an outfit. One batch write,
  // optional shared verdict written to each item's wearNotes. Skips items
  // already logged for that date (idempotent if user taps twice).
  const handleLogOutfitWear = async (outfit, dateISO = todayISO(), verdict = '', occasion = '') => {
    if (!user || !outfit) return;
    const pieces = resolveOutfitItems(outfit, items);
    if (pieces.length === 0) return;
    const batch = writeBatch(db);
    let touched = 0;
    for (const p of pieces) {
      const hist = itemWearHistory(p);
      if (hist.includes(dateISO)) continue;
      const notes = { ...itemWearNotes(p) };
      const v = (verdict || '').trim();
      if (v) notes[dateISO] = v;
      const occasions = { ...itemWearOccasions(p) };
      const occ = (occasion || '').trim();
      if (occ) occasions[dateISO] = occ;
      batch.set(doc(userItemsRef(user.uid), p.id), {
        ...p,
        wearHistory: [...hist, dateISO].sort(),
        wearNotes: notes,
        wearOccasions: occasions,
      });
      touched++;
    }
    if (touched === 0) { toast.show('Already logged for today', { kind: 'default', eyebrow: 'NOTED' }); return; }
    await batch.commit();
    haptic('success');
    toast.show(`${outfit.name} · ${touched} ${touched === 1 ? 'piece' : 'pieces'}`, { kind: 'success', eyebrow: 'WORN' });
    // Also record the wear at the OUTFIT level (separate from per-item
    // wearHistory). The outfit's wearLog is what powers the "Worn N times"
    // counter on the detail view — without this, a wear without a photo
    // read as "didn't wear it" because the old counter only counted photos.
    try {
      const existingLog = Array.isArray(outfit.wearLog) ? outfit.wearLog : [];
      // Don't add a duplicate entry for the same date
      if (!existingLog.some((w) => w.date === dateISO)) {
        const entry = { date: dateISO };
        const v = (verdict || '').trim();
        const occ = (occasion || '').trim();
        if (v) entry.verdict = v;
        if (occ) entry.occasion = occ;
        const nextLog = [...existingLog, entry].sort((a, b) => a.date.localeCompare(b.date));
        await setDoc(doc(userOutfitsRef(user.uid), outfit.id), {
          ...outfit,
          wearLog: nextLog,
        });
      }
    } catch (e) {
      console.warn('[outfit-wear-log] failed to write outfit-level wearLog:', e?.message);
      // Non-blocking — per-item wears already committed; outfit-level is supplementary
    }
    // Fire-and-forget Gemini narration. Won't block the wear log.
    try {
      const weather = (() => { try { return JSON.parse(localStorage.getItem('atelier-weather') || 'null')?.data; } catch { return null; } })();
      const recentLog = pieces.flatMap((p) => (itemWearHistory(p) || []).map((d) => ({ date: d, name: p.name }))).slice(-5);
      const line = await narrateWearWithGemini({ outfit, items, recentLog, weather });
      // Longer than the routine confirmation toasts (default 2.8s) — this is
      // a one-off styling compliment worth actually reading, not a status
      // ping, and it's the only toast left in this flow once the wear is
      // logged (the redundant "Logged for today" toast at the call site
      // was removed so this doesn't have to compete for attention).
      if (line) toast.show(line, { kind: 'default', duration: 9000 });
    } catch { /* AI offline — no problem */ }
  };
  const handleSetWearNote = async (item, dateISO, note) => {
    if (!user) return;
    const notes = { ...itemWearNotes(item) };
    const trimmed = (note || '').trim();
    if (trimmed) notes[dateISO] = trimmed; else delete notes[dateISO];
    await handleAddItem({ ...item, wearNotes: notes });
  };

  const handleSetWearOccasion = async (item, dateISO, occasion) => {
    if (!user) return;
    const occasions = { ...itemWearOccasions(item) };
    const trimmed = (occasion || '').trim();
    if (trimmed) occasions[dateISO] = trimmed; else delete occasions[dateISO];
    await handleAddItem({ ...item, wearOccasions: occasions });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Jost', sans-serif; }
        .glass-panel { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.4); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        body { background-color: #F7F5F2; }
      `}</style>

      {!authReady ? (
        <FullScreenLoader label="Opening your Atelier" />
      ) : !user && !demoMode ? (
        <SignInScreen onSignIn={signInWithGoogle} />
      ) : accessDenied && !demoMode ? (
        <AccessDeniedScreen user={user} onSignOut={signOutUser} />
      ) : (
        <div className="flex font-sans text-stone-900 overflow-hidden bg-[#F7F5F2] w-full"
             style={{ height: 'var(--app-vh, 100dvh)' }}>
          {demoMode && (
            // Editorial pill banner pinned to the top of the viewport. Visible
            // only while the visitor is exploring with ?demo=1; survives every
            // tab and modal because it's fixed and z-50.
            <div className="fixed top-0 inset-x-0 z-50 pointer-events-none px-4"
                 style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
              <div className="mx-auto max-w-3xl pointer-events-auto">
                <div className="glass-panel rounded-full shadow-sm px-4 sm:px-5 py-2 flex items-center justify-between gap-3 text-[11px] sm:text-xs">
                  <div className="flex items-center gap-2 sm:gap-2.5 text-stone-600 min-w-0">
                    <span className="font-display italic text-stone-900 text-sm sm:text-base leading-none shrink-0">Demo</span>
                    <span className="hidden sm:inline text-stone-400">·</span>
                    <span className="hidden sm:inline truncate">A sample wardrobe to play with — nothing saves</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setItems(SEED_WARDROBE.map((it) => ({ ...it })));
                        setOutfits([]);
                        setInspirations([]);
                        setAiHistory([]);
                        setSchedules({});
                        toast.show('Demo wardrobe restored', { kind: 'default' });
                      }}
                      className="text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-[0.18em]"
                    >
                      Reset
                    </button>
                    <a
                      href="/"
                      className="bg-stone-900 text-white px-3 sm:px-3.5 py-1.5 rounded-full uppercase tracking-[0.18em] hover:bg-stone-700 transition-colors whitespace-nowrap"
                    >
                      Sign up
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onOpenConcierge={() => setIsConciergeOpen(true)} user={user} demoMode={demoMode} signOutUser={signOutUser} setInspirationDefaultFilter={setInspirationDefaultFilter} />

          <main ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden lg:pb-0 relative scroll-smooth hide-scrollbar"
                style={{
                  paddingTop: 'env(safe-area-inset-top, 0px)',
                  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)',
                }}>
            {subStatus.kind === 'subscriber' && subStatus.isTrial && subStatus.daysRemaining !== null && subStatus.daysRemaining <= 3 && (
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Your trial ends in {subStatus.daysRemaining} day{subStatus.daysRemaining === 1 ? '' : 's'}. <a href="https://myatelier.style/pricing" className="underline">Keep your keys.</a>
              </div>
            )}
            <div className="p-4 sm:p-6 lg:p-12 max-w-6xl mx-auto min-h-full w-full lg:pb-0">
              {loading ? (
                <WardrobeSkeleton />
              ) : (
                // No transform-based animation here — slide-in-from-bottom
                // leaves a translateY(0) on the element after the animation
                // completes, which establishes a containing block and breaks
                // position:sticky for descendants (they end up scoped to this
                // wrapper instead of the main scroll ancestor). Fade-in only.
                <div key={activeTab} className="animate-in fade-in duration-500 ease-out">
                  {/* Lazy-loaded views: each non-home view is a separate chunk
                      fetched on first navigation. Suspense shows a brief loader
                      while a view's chunk downloads (once, then cached). Today
                      stays eager so the home screen paints instantly. */}
                  <Suspense fallback={<div className="flex items-center justify-center py-32"><div className="w-8 h-8 rounded-full border-2 border-stone-200 border-t-stone-900 animate-spin" /></div>}>
                  {activeTab === 'today' && (
                    <TodayView
                      user={user}
                      items={liveItems}
                      measurements={measurements}
                      schedules={schedules}
                      outfits={outfits}
                      inspirations={inspirations}
                      aiTemperature={AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7}
                      onSaveOutfit={handleSaveOutfit}
                      onLogOutfitWear={handleLogOutfitWear}
                      onOpenBrief={(brief) => { setStudioSeed({ ...brief, id: brief.savedAt ?? Date.now() }); setActiveTab('outfits'); }}
                      onOpenSavedLook={setOpenOutfitId}
                      onItemClick={setSelectedItemId}
                      onEditPreferences={() => { setActiveTab('profile'); requestAnimationFrame(() => { requestAnimationFrame(() => { document.getElementById('profile-style')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }}
                      onOpenConcierge={() => setIsConciergeOpen(true)}
                      onOpenInspiration={setSelectedInspirationId}
                      onOpenInspirationTab={() => { setInspirationDefaultFilter('unanalysed'); setActiveTab('inspiration'); }}
                      onSelectCalendarDay={jumpToCalendarDay}
                      onExportOutfit={handleExportOutfit}
                    />
                  )}
                  {activeTab === 'wardrobe' && <WardrobeView items={liveItems} deleteItem={handleDeleteItem} openAddModal={() => setIsAddItemModalOpen(true)} measurements={measurements} onItemClick={setSelectedItemId} user={user} onToggleFavorite={handleToggleFavorite} schedules={schedules} outfits={outfits} onOpenOutfit={setOpenOutfitId} onBulkUpdate={handleBulkUpdateItems} onBulkDelete={handleBulkDeleteItems} onScheduleOutfit={handleScheduleOutfit} onSaveOutfit={handleSaveOutfit} onLogOutfitWear={handleLogOutfitWear} inspirations={inspirations} onOpenInspiration={setSelectedInspirationId} onOpenInspirationTab={() => { setInspirationDefaultFilter('unanalysed'); setActiveTab('inspiration'); }} aiTemperature={AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7} onScrollTop={scrollMainToTop} jumpFilter={wardrobeJump.filter} jumpCategory={wardrobeJump.category} jumpNonce={wardrobeJump.nonce} onOpenConcierge={() => setIsConciergeOpen(true)} onOpenBrief={(brief) => { setStudioSeed({ ...brief, id: brief.savedAt ?? Date.now() }); setActiveTab('outfits'); }} onEditPreferences={() => { setActiveTab('profile'); requestAnimationFrame(() => { requestAnimationFrame(() => { document.getElementById('profile-style')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }} />}
                  {activeTab === 'outfits' && (
                    <OutfitBuilder
                      mode="studio"
                      items={ownedItems}
                      outfits={outfits}
                      saveOutfit={handleSaveOutfit}
                      deleteOutfit={handleDeleteOutfit}
                      onOpenOutfit={setOpenOutfitId}
                      aiHistory={aiHistory}
                      saveAIHistory={handleSaveAIHistory}
                      deleteAIHistory={handleDeleteAIHistory}
                      toggleAIHistoryFavorite={handleToggleAIHistoryFavorite}
                      schedules={schedules}
                      scheduleOutfit={handleScheduleOutfit}
                      aiTemperature={AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7}
                      styleProfile={summariseStyleProfile(measurements)}
                      measurements={measurements}
                      onCreateLookbook={handleShareLookbook}
                      editOutfit={editingOutfit}
                      onEditDone={() => setEditingOutfit(null)}
                      seedOutfit={studioSeed}
                      onSeedConsumed={() => setStudioSeed(null)}
                      onAfterSave={() => setActiveTab('lookbook')}
                      onEditPreferences={() => { setActiveTab('profile'); requestAnimationFrame(() => { requestAnimationFrame(() => { document.getElementById('profile-style')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }}
                    />
                  )}
                  {activeTab === 'lookbook' && (
                    <OutfitBuilder
                      mode="lookbook"
                      items={ownedItems}
                      outfits={outfits}
                      saveOutfit={handleSaveOutfit}
                      deleteOutfit={handleDeleteOutfit}
                      onOpenOutfit={setOpenOutfitId}
                      onOpenItem={setSelectedItemId}
                      aiHistory={aiHistory}
                      saveAIHistory={handleSaveAIHistory}
                      deleteAIHistory={handleDeleteAIHistory}
                      toggleAIHistoryFavorite={handleToggleAIHistoryFavorite}
                      schedules={schedules}
                      scheduleOutfit={handleScheduleOutfit}
                      aiTemperature={AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7}
                      styleProfile={summariseStyleProfile(measurements)}
                      measurements={measurements}
                      onCreateLookbook={handleShareLookbook}
                      onReorderOutfits={handleReorderOutfits}
                      initialTab={lookbookInitialTab}
                      onInitialTabConsumed={() => setLookbookInitialTab(null)}
                      collections={collections}
                      onCreateCollection={handleCreateCollection}
                      onAddOutfitToCollection={handleAddOutfitToCollection}
                      onRemoveOutfitFromCollection={handleRemoveOutfitFromCollection}
                      onDeleteCollection={handleDeleteCollection}
                    />
                  )}
                  {activeTab === 'calendar' && (
                    <DiaryView
                      items={ownedItems}
                      outfits={outfits}
                      schedules={schedules}
                      onScheduleOutfit={handleScheduleOutfit}
                      onOpenOutfit={setOpenOutfitId}
                      onSaveOutfit={handleSaveOutfit}
                      onOpenItem={setSelectedItemId}
                      styleProfile={summariseStyleProfile(measurements)}
                      autoActivateRangeMode={false}
                      initialSelectedDate={calendarJumpDate}
                      onDeleteTrip={handleDeleteTrip}
                    />
                  )}
                  {activeTab === 'insights' && <InsightsView items={liveItems} inspirations={inspirations} onJumpToWardrobe={jumpToWardrobe} measurements={measurements} saveMeasurements={handleSaveProfile} onOpenProfile={() => setActiveTab('profile')} onOpenItem={setSelectedItemId} outfits={outfits} schedules={schedules} onOpenOutfit={setOpenOutfitId} onOpenDiary={() => setActiveTab('calendar')} />}
                  {activeTab === 'profile' && (
                    <ProfileView
                      user={user}
                      measurements={measurements}
                      saveMeasurements={handleSaveProfile}
                      isOwner={isOwner}
                      allowlist={allowlist}
                      addInvite={handleAddInvite}
                      removeInvite={handleRemoveInvite}
                      items={ownedItems}
                      polishItems={liveItems}
                      deletedItems={deletedItems}
                      outfits={outfits}
                      inspirations={inspirations}
                      shops={shops}
                      onRestoreItem={handleRestoreItem}
                      onHardDeleteItem={handleHardDeleteItem}
                      onUpdateItem={handleAddItem}
                      subStatus={subStatus}
                      onOpenInsights={() => setActiveTab('insights')}
                      onReviewManually={() => jumpToWardrobe({ filter: 'untagged' })}
                      onOpenItem={setSelectedItemId}
                    />
                  )}
                  {activeTab === 'shops' && (
                    <ShoppingDirectory
                      shops={shops}
                      saveShop={handleSaveShop}
                      deleteShop={handleDeleteShop}
                    />
                  )}
                  {activeTab === 'inspiration' && (
                    <InspirationView
                      inspirations={inspirations}
                      onOpenInspiration={setSelectedInspirationId}
                      onAddInspiration={() => setIsInspirationModalOpen(true)}
                      onDelete={handleDeleteInspiration}
                      defaultFilter={inspirationDefaultFilter}
                      wishlistCount={liveItems.filter((i) => i.status === 'wishlist').length}
                      onJumpToWishlist={() => jumpToWardrobe({ filter: 'wishlist' })}
                    />
                  )}
                  </Suspense>
                </div>
              )}
            </div>
          </main>

          {/* iOS-style "tap the status bar to scroll to top". The safe-area
              inset is the notch / Dynamic-Island strip on iPhone PWA, where
              this element gets its tap height. In normal mobile browsers the
              inset is 0 — so we ALSO render a visible ↑ button below as a
              universal fallback once the user has scrolled past a screen. */}
          <button
            type="button"
            onClick={scrollMainToTop}
            className="lg:hidden fixed top-0 left-0 right-0 z-30"
            style={{ height: 'env(safe-area-inset-top, 0px)' }}
            aria-label="Scroll to top"
            tabIndex={-1}
          />
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollMainToTop}
              className="fixed right-4 lg:right-6 z-30 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-stone-900 text-white shadow-2xl flex items-center justify-center active:scale-90 hover:bg-stone-700 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 lg:!bottom-6"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
              aria-label="Scroll to top"
            >
              <ChevronUp size={20} strokeWidth={2} />
            </button>
          )}

          {/* DESKTOP ACCOUNT AVATAR — fixed top-right, fades on scroll (like the
              mobile pattern). Opens a small menu (Profile + Sign out). Lives here,
              not in the sidebar, so it reads as the conventional top-right account
              corner and keeps the sidebar a clean nav column. */}
          <div className="hidden lg:block">
            <button
              type="button"
              onClick={() => setDesktopAccountOpen((o) => !o)}
              className={`fixed right-12 z-40 w-10 h-10 rounded-full overflow-hidden bg-stone-900 text-white flex items-center justify-center shadow-lg ring-1 transition-all duration-200 active:scale-90 ${['profile','insights','inspiration','shops'].includes(activeTab) ? 'ring-brass-300' : 'ring-white/40 hover:ring-brass-300'} ${atTop ? 'opacity-100' : 'opacity-0 pointer-events-none -translate-y-1'}`}
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}
              aria-label="Account"
              aria-haspopup="menu"
              aria-expanded={desktopAccountOpen}
              aria-hidden={!atTop}
              tabIndex={atTop ? 0 : -1}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="font-display text-sm">{(user?.displayName || user?.email || (demoMode ? 'D' : '?')).charAt(0).toUpperCase()}</span>
              )}
            </button>
            {desktopAccountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDesktopAccountOpen(false)} aria-hidden="true" />
                <div className="fixed right-12 z-50 w-60 rounded-2xl border border-stone-200 bg-white py-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 5rem)' }}>
                  <button type="button" onClick={() => { setDesktopAccountOpen(false); setActiveTab('profile'); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-display text-sm shrink-0">{(user?.displayName || user?.email || (demoMode ? 'D' : '?')).charAt(0).toUpperCase()}</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{user?.displayName || (demoMode ? 'Demo guest' : 'Account')}</p>
                      <p className="text-[11px] text-stone-500 truncate">{user?.email || (demoMode ? 'Sign up to save' : '')}</p>
                    </div>
                  </button>
                  <div className="my-1 border-t border-stone-100" />
                  <button type="button" onClick={() => { setDesktopAccountOpen(false); setActiveTab('profile'); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50 transition-colors ${activeTab === 'profile' ? 'text-brass-700' : 'text-stone-700'}`}>
                    <Ruler size={16} strokeWidth={1.5} />
                    <span className="text-sm tracking-wide">Profile &amp; measurements</span>
                  </button>
                  <div className="my-1 border-t border-stone-100" />
                  <button type="button" onClick={() => { setDesktopAccountOpen(false); signOutUser(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-stone-400 hover:bg-stone-50 hover:text-stone-700 transition-colors">
                    <LogOut size={15} strokeWidth={1.5} />
                    <span className="text-[11px] tracking-widest uppercase">Sign out</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* MOBILE AVATAR — single top-right gateway to the Account sheet, which
              holds the lower-frequency, "about you" destinations (Insights,
              Inspiration, Directory, Profile, Sign out). Replaces the old pair of
              cryptic pills (a ruler + a bar-chart) — the avatar is the universally
              understood entry to "me & my data". Daily destinations live in the
              bottom bar; Calendar folds into Today's week strip + Lookbook's Diary. */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className={`lg:hidden fixed top-0 right-3 z-40 mt-3 w-10 h-10 rounded-full overflow-hidden bg-stone-900/85 backdrop-blur text-white flex items-center justify-center shadow-lg active:scale-90 hover:bg-stone-900 transition-all duration-200 ${['profile','insights','inspiration','shops'].includes(activeTab) ? 'ring-2 ring-brass-300' : ''} ${atTop ? 'opacity-100' : 'opacity-0 pointer-events-none -translate-y-1'}`}
            style={{ marginTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
            aria-label="Account & more"
            aria-hidden={!atTop}
            tabIndex={atTop ? 0 : -1}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="font-display text-sm">{(user?.displayName || user?.email || (demoMode ? 'D' : '?')).charAt(0).toUpperCase()}</span>
            )}
          </button>

          {mobileMoreOpen && (
            <div
              className="lg:hidden fixed inset-0 z-50"
              onClick={() => setMobileMoreOpen(false)}
            >
              <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" />
              <div
                className="absolute right-3 bg-white rounded-2xl shadow-2xl border border-stone-200 py-2 min-w-[248px] animate-in fade-in slide-in-from-top-2 duration-200"
                style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Account header — tap to open Profile */}
                <button
                  type="button"
                  onClick={() => { setMobileMoreOpen(false); setActiveTab('profile'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
                >
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-display text-sm shrink-0">
                      {(user?.displayName || user?.email || (demoMode ? 'D' : '?')).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{user?.displayName || (demoMode ? 'Demo guest' : 'Account')}</p>
                    <p className="text-[11px] text-stone-500 truncate">{user?.email || (demoMode ? 'Sign up to save' : '')}</p>
                  </div>
                </button>
                <div className="my-1 border-t border-stone-100" />
                {[
                  { id: 'insights', label: 'Insights', icon: FileText },
                  { id: 'inspiration', label: 'Inspiration', icon: Bookmark },
                  { id: 'shops', label: 'Directory', icon: Store },
                  { id: 'profile', label: 'Profile & measurements', icon: Ruler },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setMobileMoreOpen(false); if (id === 'inspiration') setInspirationDefaultFilter('all'); setActiveTab(id); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50 transition-colors ${activeTab === id ? 'text-brass-700' : 'text-stone-700'}`}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    <span className="text-sm tracking-wide">{label}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-stone-100" />
                <button
                  type="button"
                  onClick={() => { setMobileMoreOpen(false); signOutUser(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-stone-400 hover:bg-stone-50 hover:text-stone-700 transition-colors"
                >
                  <LogOut size={15} strokeWidth={1.5} />
                  <span className="text-[11px] tracking-widest uppercase">Sign out</span>
                </button>
              </div>
            </div>
          )}

          <div className="lg:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/50 px-2 sm:px-6 pt-2 z-40 smooth-shadow"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
            {/* MOBILE BOTTOM NAV — four destinations + central + FAB,
                arranged as a 5-column grid with the FAB in column 3.
                With grid-cols-5 + equal-width cells, the FAB sits at
                EXACT geometric centre — no flex / justify quirks, no
                visual asymmetry. Profile moved to a floating button at
                top-right (above) so all destinations stay one tap away.
                Asymmetric flex-group layouts (3-left+FAB+2-right) read
                as off-centre because the eye weights item density, not
                pixel position. Symmetric grid is the only true fix. */}
            <BottomBar activeTab={activeTab} setActiveTab={setActiveTab} onScrollTop={scrollMainToTop} onOpenConcierge={() => setIsConciergeOpen(true)} />
          </div>

          <PwaInstallNudge hasContent={liveItems.length > 0} />
          <NotificationManager items={liveItems} outfits={outfits} schedules={schedules} />
          <OnboardingTour onJumpTo={(tab) => setActiveTab(tab)} />

          {shareModalOutfit && (
            <ShareLookModal
              outfit={shareModalOutfit}
              items={items}
              onClose={() => setShareModalOutfit(null)}
              onCreateLink={(cardBlob) => handleShareOutfit(shareModalOutfit, cardBlob)}
            />
          )}

          {shareTarget && (
            <ShareLinkModal
              url={shareTarget.url}
              title={shareTarget.title}
              kind={shareTarget.kind}
              sharedByName={shareTarget.sharedByName || user?.displayName || ''}
              status={shareTarget.status}
              onClose={() => setShareTarget(null)}
            />
          )}

          {(styleBusy || styleSuggestion || styleError) && styleSourceItem && (
            <StyleAroundItemModal
              sourceItem={styleSourceItem}
              suggestion={styleSuggestion}
              busy={styleBusy}
              error={styleError}
              saving={styleSaving}
              allItems={liveItems}
              onRegenerate={() => handleStyleWithItem(styleSourceItem)}
              onSave={handleSaveStyledOutfit}
              onClose={dismissStyleSuggestion}
            />
          )}

          {(varyBusy || varySuggestion || varyError) && varySourceOutfit && (
            <OutfitVariationModal
              sourceOutfit={varySourceOutfit}
              suggestion={varySuggestion}
              busy={varyBusy}
              error={varyError}
              saving={varySaving}
              allItems={liveItems}
              onRegenerate={(intentKey) => handleVaryOutfit(varySourceOutfit, intentKey)}
              onSave={handleSaveVariation}
              onClose={dismissVariation}
            />
          )}

          {isConciergeOpen && (
            <AtelierConcierge
              onClose={() => setIsConciergeOpen(false)}
              items={ownedItems}
              outfits={outfits}
              styleProfile={summariseStyleProfile(measurements)}
              measurements={measurements}
              ownerFirstName={(user?.displayName || '').split(' ')[0] || ''}
              user={user}
              onEditPreferences={() => { setActiveTab('profile'); requestAnimationFrame(() => { requestAnimationFrame(() => { document.getElementById('profile-style')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }}
              onOpenItem={(id) => { setIsConciergeOpen(false); setSelectedItemId(id); }}
              onSaveLook={async (itemIds) => {
                setIsConciergeOpen(false);
                const name = `From Concierge · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                const outfit = {
                  id: newId(),
                  name,
                  itemIds,
                  createdAt: new Date().toISOString(),
                };
                try {
                  // Await the write before opening so the outfit exists in the
                  // list when OutfitDetailView resolves it by id.
                  await handleSaveOutfit(outfit);
                  toast.show('Saved · opening it now', { kind: 'success' });
                  setOpenOutfitId(outfit.id);
                } catch (err) {
                  toast.show(`Could not save: ${err?.message || 'unknown error'}`, { kind: 'error' });
                }
              }}
              onSchedule={(itemIds, dateISO) => {
                const id = newId();
                const name = `From Concierge · ${new Date(dateISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
                handleSaveOutfit({
                  id,
                  name,
                  itemIds,
                  createdAt: new Date().toISOString(),
                });
                handleScheduleOutfit(dateISO, id);
                setIsConciergeOpen(false);
                toast.show(`Scheduled for ${new Date(dateISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, { kind: 'success' });
              }}
              onAddToPacking={(itemIds) => {
                // PackingListModal reads from schedules within a date range and
                // cannot accept ad-hoc item lists. Defer full packing integration
                // to a follow-up; for now surface the look in Lookbook where the
                // user can confirm and use the existing Download packing button.
                setIsConciergeOpen(false);
                setActiveTab('lookbook');
                toast.show(`${itemIds.length} pieces noted — find them in your Lookbook to add to a planned trip`, { kind: 'success' });
              }}
            />
          )}

          {isAddItemModalOpen && (
            <AddItemModal
              user={user}
              shops={shops}
              existingItem={editingItem}
              removeBackground={!!measurements?.removeBackground}
              onClose={() => { setIsAddItemModalOpen(false); setEditingItem(null); }}
              onSave={async (item) => { await handleAddItem(item); setIsAddItemModalOpen(false); setEditingItem(null); }}
              onOpenReceiptModal={() => { setIsAddItemModalOpen(false); setIsReceiptModalOpen(true); }}
              onOpenBulkImport={() => { setIsAddItemModalOpen(false); setIsBulkImportModalOpen(true); }}
              onOpenSweep={() => { setIsAddItemModalOpen(false); setIsSweepModalOpen(true); }}
              measurements={measurements}
              inspirations={inspirations}
            />
          )}

          {isReceiptModalOpen && (
            <ReceiptImportModal
              onClose={() => setIsReceiptModalOpen(false)}
              onBulkSave={async (newItems) => {
                await handleBulkAddItems(newItems);
                setIsReceiptModalOpen(false);
              }}
            />
          )}

          {isBulkImportModalOpen && (
            <BulkImportModal
              shops={shops}
              onClose={() => setIsBulkImportModalOpen(false)}
              onBulkSave={async (newItems) => {
                await handleBulkAddItems(newItems);
                setIsBulkImportModalOpen(false);
              }}
            />
          )}

          {isSweepModalOpen && (
            <ClosetSweepModal
              shops={shops}
              onClose={() => setIsSweepModalOpen(false)}
              onBulkSave={async (newItems) => {
                await handleBulkAddItems(newItems);
                setIsSweepModalOpen(false);
              }}
            />
          )}

          {isInspirationModalOpen && (
            <AddInspirationModal
              onClose={() => setIsInspirationModalOpen(false)}
              onSave={async (insp) => { await handleSaveInspiration(insp); setIsInspirationModalOpen(false); toast.show('Saved to Inspiration', { kind: 'success' }); }}
            />
          )}

          {selectedInspiration && (
            <InspirationDetailView
              inspiration={selectedInspiration}
              items={liveItems}
              shops={shops}
              onClose={() => setSelectedInspirationId(null)}
              onAnalyze={() => handleAnalyzeInspiration(selectedInspiration)}
              onDelete={async () => { await handleDeleteInspiration(selectedInspiration.id); setSelectedInspirationId(null); }}
              onOpenItem={(id) => { setSelectedInspirationId(null); setSelectedItemId(id); }}
              onRecreateLook={async () => {
                const ins = selectedInspiration;
                const ids = (ins.analysis?.wardrobeMatchIds || []).filter((id) => liveItems.some((i) => i.id === id));
                if (ids.length === 0) { toast.show('No wardrobe matches to compose from', { kind: 'default' }); return; }
                const outfit = {
                  id: newId(),
                  name: ins.caption ? `Like · ${ins.caption.slice(0, 40)}` : `Like · Inspiration ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
                  itemIds: ids,
                  createdAt: new Date().toISOString(),
                  reasoning: ins.analysis?.summary || '',
                  intent: 'recreated from inspiration',
                  inspirationId: ins.id,
                };
                await handleSaveOutfit(outfit);
                setSelectedInspirationId(null);
                setOpenOutfitId(outfit.id);
              }}
              onAddMissingToWishlist={async (piece) => {
                const ins = selectedInspiration;
                const newItem = {
                  id: newId(),
                  name: piece,
                  brand: '',
                  price: 0,
                  category: 'Tops',
                  subCategory: '',
                  status: 'wishlist',
                  seasons: [], styles: [], images: ins.image ? [ins.image] : [], colors: [], care: [], materials: [],
                  description: '',
                  sourceUrl: '',
                  wishlistReason: ins.caption ? `From inspiration: ${ins.caption}` : 'From an inspiration',
                  inspirationId: ins.id,
                  createdAt: new Date().toISOString(),
                };
                await handleAddItem(newItem);
                toast.show(`Added "${piece}" to wishlist`, { kind: 'success' });
              }}
              onSaveAsWishlist={async () => {
                const ins = selectedInspiration;
                const sourceHost = (() => { try { return new URL(ins.sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
                const newItem = {
                  id: newId(),
                  name: ins.caption?.trim() || `Inspiration · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
                  brand: '',
                  price: 0,
                  category: 'Tops',
                  subCategory: '',
                  status: 'wishlist',
                  seasons: [], styles: [], colors: [], care: [], materials: [],
                  images: ins.image ? [ins.image] : [],
                  description: ins.notes || '',
                  sourceUrl: ins.sourceUrl || '',
                  wishlistReason: sourceHost
                    ? `Saved from inspiration · ${sourceHost}`
                    : 'Saved from an inspiration',
                  inspirationId: ins.id,
                  createdAt: new Date().toISOString(),
                };
                await handleAddItem(newItem);
                toast.show('Added to wishlist · review category in the wardrobe', { kind: 'success', duration: 4500 });
              }}
            />
          )}

          {openOutfit && (() => {
            // Prev/next look navigation — index into outfits array for magazine page-turn.
            const currentIdx = outfits.findIndex((o) => o.id === openOutfitId);
            const prevOutfitId = currentIdx > 0 ? outfits[currentIdx - 1]?.id : null;
            const nextOutfitId = currentIdx >= 0 && currentIdx < outfits.length - 1 ? outfits[currentIdx + 1]?.id : null;
            return (
              <OutfitDetailView
                outfit={openOutfit}
                items={liveItems}
                onClose={() => setOpenOutfitId(null)}
                onDelete={async () => { await handleDeleteOutfit(openOutfit.id); setOpenOutfitId(null); }}
                onSaveOutfit={handleSaveOutfit}
                onShare={() => handleShareOutfit(openOutfit)}
                onExport={() => handleExportOutfit(openOutfit)}
                onVary={() => handleVaryOutfit(openOutfit, 'fresh')}
                onEdit={() => handleEditOutfit(openOutfit)}
                onLogWear={(dateISO, verdict, occasion) => handleLogOutfitWear(openOutfit, dateISO, verdict, occasion)}
                measurements={measurements}
                onOpenItem={(id) => setSelectedItemId(id)}
                prevOutfitId={prevOutfitId}
                nextOutfitId={nextOutfitId}
                onPick={(id) => setOpenOutfitId(id)}
                onDuplicate={async () => {
                  // If legacy outfit had embedded items, migrate to itemIds
                  const itemIds = Array.isArray(openOutfit.itemIds)
                    ? openOutfit.itemIds
                    : (openOutfit.items || []).map((i) => i.id).filter(Boolean);
                  const newOutfit = {
                    id: newId(),
                    name: `${openOutfit.name} (copy)`,
                    itemIds,
                    createdAt: new Date().toISOString(),
                    ...(openOutfit.reasoning ? { reasoning: openOutfit.reasoning } : {}),
                    ...(openOutfit.intent ? { intent: openOutfit.intent } : {}),
                  };
                  await handleSaveOutfit(newOutfit);
                  setOpenOutfitId(newOutfit.id);
                }}
                collections={collections}
                onAddToCollection={handleAddOutfitToCollection}
                onRemoveFromCollection={handleRemoveOutfitFromCollection}
                onCreateCollection={handleCreateCollection}
              />
            );
          })()}

          {selectedItem && (() => {
            // Build prev/next from the live wardrobe order for swipe nav.
            const idx = liveItems.findIndex((i) => i.id === selectedItem.id);
            const prev = idx > 0 ? liveItems[idx - 1] : null;
            const next = idx >= 0 && idx < liveItems.length - 1 ? liveItems[idx + 1] : null;
            return (
            <ItemDetailView
              item={selectedItem}
              shops={shops}
              measurements={measurements}
              items={liveItems}
              outfits={outfits}
              onPrev={prev ? () => setSelectedItemId(prev.id) : null}
              onNext={next ? () => setSelectedItemId(next.id) : null}
              positionLabel={idx >= 0 ? `${idx + 1} / ${liveItems.length}` : null}
              onOpenOutfit={(id) => { setSelectedItemId(null); setOpenOutfitId(id); }}
              onLogWear={(dateISO, occasion) => handleLogWear(selectedItem, dateISO, occasion)}
              onUnlogWear={(dateISO) => handleUnlogWear(selectedItem, dateISO)}
              onSetWearNote={(dateISO, note) => handleSetWearNote(selectedItem, dateISO, note)}
              onSetWearOccasion={(dateISO, occasion) => handleSetWearOccasion(selectedItem, dateISO, occasion)}
              onMarkCared={() => handleMarkCared(selectedItem)}
              onToggleFavorite={() => handleToggleFavorite(selectedItem)}
              onSetCondition={(c) => handleSetItemCondition(selectedItem, c)}
              onDuplicate={() => handleDuplicateItem(selectedItem)}
              onShare={() => handleShareItem(selectedItem)}
              onStyleWithItem={() => handleStyleWithItem(selectedItem)}
              onOpenItem={(id) => setSelectedItemId(id)}
              onClose={() => setSelectedItemId(null)}
              uid={user?.uid}
              onUpdateItem={(updated) => handleAddItem(updated)}
              onEdit={() => { setEditingItem(selectedItem); setIsAddItemModalOpen(true); setSelectedItemId(null); }}
              onDelete={async () => { await handleDeleteItem(selectedItem.id); setSelectedItemId(null); }}
              onMarkOwned={async () => {
                await handleAddItem({
                  ...selectedItem,
                  status: 'owned',
                  purchasedDate: selectedItem.purchasedDate || new Date().toISOString().slice(0, 10),
                });
              }}
              onMarkWishlist={async () => {
                await handleAddItem({ ...selectedItem, status: 'wishlist' });
              }}
              inspirations={inspirations}
              onSaveFit={(fit) => handleAddItem({
                ...selectedItem,
                manifestoFit: { ...fit, manifestoAt: measurements?.styleManifestoAt || null },
              })}
            />
            );
          })()}
        </div>
      )}
    </>
  );
}

function PhotoLightbox({ images, startIndex = 0, alt = '', onClose }) {
  const [index, setIndex] = useState(Math.min(startIndex, images.length - 1));
  const [touchStart, setTouchStart] = useState(null);
  const [zoom, setZoom] = useState(1);

  const goPrev = () => { setIndex((i) => (i - 1 + images.length) % images.length); setZoom(1); };
  const goNext = () => { setIndex((i) => (i + 1) % images.length); setZoom(1); };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && images.length > 1) goPrev();
      else if (e.key === 'ArrowRight' && images.length > 1) goNext();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.5, 4));
      else if (e.key === '-' || e.key === '_') setZoom((z) => Math.max(z - 0.5, 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line
  }, [images.length]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) setTouchStart(e.touches[0].clientX);
    else setTouchStart(null); // ignore swipe during pinch
  };
  const handleTouchEnd = (e) => {
    if (touchStart === null || zoom !== 1) { setTouchStart(null); return; }
    const end = e.changedTouches[0].clientX;
    const diff = touchStart - end;
    if (Math.abs(diff) > 50 && images.length > 1) {
      if (diff > 0) goNext(); else goPrev();
    }
    setTouchStart(null);
  };
  const handleWheel = (e) => {
    if (e.deltaY < 0) setZoom((z) => Math.min(z + 0.2, 4));
    else setZoom((z) => Math.max(z - 0.2, 1));
  };
  const handleDoubleClick = () => setZoom((z) => (z > 1 ? 1 : 2));

  if (!images?.length) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center animate-in fade-in duration-200"
         onClick={onClose}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-4 sm:px-6 sm:py-5 z-10"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
           onClick={(e) => e.stopPropagation()}>
        <span className="text-white/70 text-xs tracking-[0.2em] uppercase">
          {images.length > 1 ? `${index + 1} / ${images.length}` : 'Detail view'}
        </span>
        <div className="flex gap-2">
          {zoom > 1 && (
            <button onClick={() => setZoom(1)} className="px-3 py-2 text-white/80 hover:text-white text-xs tracking-widest uppercase bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              Reset zoom
            </button>
          )}
          <button onClick={onClose} className="p-2.5 text-white hover:bg-white/10 rounded-full transition-colors" aria-label="Close">
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem)' }}
           onClick={(e) => e.stopPropagation()}
           onTouchStart={handleTouchStart}
           onTouchEnd={handleTouchEnd}
           onWheel={handleWheel}
           onDoubleClick={handleDoubleClick}>
        <img src={images[index]} alt={alt}
          className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
          style={{ touchAction: 'pinch-zoom', transform: `scale(${zoom})`, cursor: zoom > 1 ? 'zoom-out' : 'zoom-in' }}
          draggable={false}
        />
      </div>

      {/* Arrows (desktop / accessible) */}
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-90"
            aria-label="Previous photo">
            <ChevronRight size={22} strokeWidth={1.5} className="rotate-180" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-90"
            aria-label="Next photo">
            <ChevronRight size={22} strokeWidth={1.5} />
          </button>
        </>
      )}

      {/* Thumbnail strip at bottom */}
      {images.length > 1 && (
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto px-3 hide-scrollbar"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
             onClick={(e) => e.stopPropagation()}>
          {images.map((src, i) => (
            <button key={i} onClick={() => { setIndex(i); setZoom(1); }}
              className={`w-12 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                index === i ? 'border-white scale-105' : 'border-transparent opacity-50 hover:opacity-80'
              }`}>
              <img src={src} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-2 right-3 hidden sm:block text-white/30 text-[10px] tracking-widest uppercase pointer-events-none"
           style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        {images.length > 1 ? 'Swipe or ← → · double-click to zoom' : 'Double-click to zoom · scroll to zoom in'}
      </div>
    </div>
  );
}

function WardrobeSkeleton() {
  return (
    <div className="space-y-6 md:space-y-10 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="h-10 w-48 bg-stone-200 rounded-xl" />
          <div className="h-3 w-32 bg-stone-200 rounded mt-3" />
        </div>
      </div>
      <div className="h-12 bg-stone-200/50 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-12">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="aspect-[3/4] rounded-2xl bg-stone-200" />
            <div className="space-y-2 px-1">
              <div className="h-2 w-1/3 bg-stone-200 rounded" />
              <div className="h-4 w-3/4 bg-stone-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FullScreenLoader({ label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] text-stone-400">
      <Shirt size={40} className="mb-4 opacity-30 animate-pulse" strokeWidth={1} />
      <p className="font-display text-xl">{label}…</p>
    </div>
  );
}

function SignInScreen({ onSignIn }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // 'idle' = show Google + "or use email" link
  // 'emailForm' = show email input + send button
  // 'sent' = show "check your inbox" confirmation
  const [mode, setMode] = useState('idle');
  const [email, setEmail] = useState('');

  const handleGoogle = async () => {
    setBusy(true); setError(null);
    try { await onSignIn(); }
    catch (e) { setError(e?.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  };

  const handleSendLink = async (e) => {
    e?.preventDefault();
    if (!email || busy) return;
    setBusy(true); setError(null);
    try {
      await sendMagicLink(email);
      setMode('sent');
    } catch (err) {
      setError(err?.message || 'Could not send sign-in link. Try again, or write to contact@myatelier.style.');
    } finally {
      setBusy(false);
    }
  };

  // Layout: on mobile, top-anchor the content (py-12 + items-center) so the
  // form is always visible without scrolling. On sm+, vertically center as
  // before. justify-center on a min-h-screen flex broke on mobile when the
  // keyboard opened — content scrolled off-screen.
  return (
    <div className="relative min-h-screen flex flex-col items-center bg-[#F7F5F2] px-6 py-12 sm:py-0 sm:justify-center font-sans">
      <div className="mb-8"><AtelierMark size={88} /></div>
      <h1 className="text-5xl font-display font-medium tracking-wide mb-3">Atelier<span className="text-[#D4B378]">.</span></h1>
      <p className="text-stone-500 text-sm tracking-wide mb-10 text-center max-w-sm">
        Your private digital wardrobe.
      </p>

      {mode === 'sent' ? (
        <div className="max-w-sm w-full text-center">
          <p className="text-stone-700 text-sm leading-relaxed mb-3">
            Check your inbox at <span className="font-medium text-stone-900">{email}</span> for your sign-in link.
          </p>
          <p className="text-stone-400 text-xs leading-relaxed">
            The link is valid for one hour. Didn't receive it? Check your spam folder or{' '}
            <button onClick={() => { setMode('emailForm'); setError(null); }} className="underline hover:text-stone-700">
              try again
            </button>.
          </p>
        </div>
      ) : mode === 'emailForm' ? (
        <form onSubmit={handleSendLink} className="w-full max-w-sm flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            disabled={busy}
            autoFocus
            autoComplete="email"
            className="w-full px-5 py-4 bg-white border border-stone-200 rounded-full text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!email || busy}
            className="w-full bg-stone-900 text-white px-10 py-4 rounded-full font-medium hover:bg-stone-700 transition-all shadow-lg disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('idle'); setError(null); }}
            className="text-xs text-stone-500 hover:text-stone-900 mt-2"
          >
            ← Back to Google sign-in
          </button>
        </form>
      ) : (
        // w-full max-w-sm on the wrapper makes both buttons fill the same
        // width so the Google button doesn't visibly shrink when its text
        // changes from "Sign in with Google" to "Signing in…".
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full bg-stone-900 text-white px-10 py-4 rounded-full font-medium hover:bg-stone-700 transition-all shadow-lg disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('emailForm'); setError(null); }}
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            Or sign in with email
          </button>
        </div>
      )}

      {error && <p className="mt-6 text-xs text-red-700 max-w-sm text-center leading-relaxed">{error}</p>}

      <p className="absolute bottom-6 inset-x-0 text-center text-[11px] tracking-wide text-stone-400">
        <a href="https://myatelier.style/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-stone-700 transition-colors">Privacy</a>
        <span className="mx-2" aria-hidden="true">·</span>
        <a href="https://myatelier.style/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-stone-700 transition-colors">Terms</a>
      </p>
    </div>
  );
}

function AccessDeniedScreen({ user, onSignOut }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] px-6 font-sans text-center">
      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-8">
        <AlertCircle className="text-stone-900" size={26} strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl font-display font-medium tracking-wide mb-3">Atelier awaits.</h1>
      <p className="text-stone-500 text-sm leading-relaxed max-w-sm mb-10">
        You're signed in as <span className="text-stone-800 font-medium">{user.email}</span>, but this account doesn't currently have access. Start a 14-day trial to unlock your collection.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3 mb-8">
        <a
          href="https://myatelier.style/pricing"
          className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-700 transition-all shadow-lg"
        >
          Start your trial
        </a>
        <button
          onClick={onSignOut}
          className="text-sm text-stone-500 hover:text-stone-900 px-6 py-3 transition-colors"
        >
          Sign out
        </button>
      </div>
      <p className="text-xs text-stone-400 leading-relaxed max-w-sm">
        Already a member with a different email, or expecting an invite from the wardrobe owner? Sign out and try again, or write to <a href="mailto:contact@myatelier.style" className="underline hover:text-stone-700">contact@myatelier.style</a>.
      </p>
    </div>
  );
}




function AddItemModal({ user, shops = [], existingItem = null, removeBackground = false, onClose, onSave, onOpenReceiptModal, onOpenBulkImport, onOpenSweep, measurements, inspirations = [] }) {
  const isEdit = !!existingItem;
  const toast = useToast();
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [linkInput, setLinkInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cutoutBusy, setCutoutBusy] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null); // { index, src }
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(existingItem ? {
    name: existingItem.name || '',
    brand: existingItem.brand || '',
    price: existingItem.price?.toString() || '',
    category: existingItem.category || 'Tops',
    subCategory: existingItem.subCategory || '',
    seasons: Array.isArray(existingItem.seasons)
      ? existingItem.seasons
      : (existingItem.season && existingItem.season !== 'All Seasons' ? [existingItem.season] : []),
    styles: Array.isArray(existingItem.styles) ? existingItem.styles : [],
    status: existingItem.status || 'owned',
    images: itemImages(existingItem),
    imageMeta: Array.isArray(existingItem.imageMeta) ? existingItem.imageMeta : [],
    description: existingItem.description || '',
    sourceUrl: existingItem.sourceUrl || '',
    purchasedDate: existingItem.purchasedDate || '',
    purchasedFrom: existingItem.purchasedFrom || '',
    size: existingItem.size || '',
    lentTo: existingItem.lentTo || '',
    lentReturnBy: existingItem.lentReturnBy || '',
    wishlistReason: existingItem.wishlistReason || '',
    care: Array.isArray(existingItem.care) ? existingItem.care : [],
    colors: Array.isArray(existingItem.colors) ? existingItem.colors : [],
    materials: Array.isArray(existingItem.materials) ? existingItem.materials : [],
  } : {
    name: '', brand: '', price: '', category: 'Tops', subCategory: '',
    seasons: [], styles: [], status: 'owned', images: [], imageMeta: [],
    description: '', sourceUrl: '', purchasedDate: '', purchasedFrom: '', size: '', care: [], colors: [], materials: [], lentTo: '', lentReturnBy: '', wishlistReason: '',
  });

  // ── Photo-to-listing state ──────────────────────────────────────────────────
  // State machine for the "Find this online" path added to the Identify flow.
  // idle → searching → found | no-match
  // found: show Google Shopping link; no-match: same but note AI wasn't sure
  // Both states let the user paste a URL to import via fetchProductFromUrl.
  const [findStep, setFindStep] = useState('idle'); // idle | searching | found | no-match
  const [findResult, setFindResult] = useState(null); // { description, searchQuery, brand, confidence }
  const [findError, setFindError] = useState(null);
  const [findPasteUrl, setFindPasteUrl] = useState('');

  // The photo data URL captured for "Find this online" — needed so we can
  // pass it to findProductListingFromPhoto and also add it as the item image
  // if the user does end up importing from a URL.
  const [findPhotoDataUrl, setFindPhotoDataUrl] = useState(null);

  // ── "Should I buy this?" fit check ──────────────────────────────────────────
  const [fitCheck, setFitCheck] = useState(null);
  const [fitBusy, setFitBusy] = useState(false);
  const [fitError, setFitError] = useState(null);

  const runFitCheck = async () => {
    if (fitBusy) return;
    setFitBusy(true); setFitError(null);
    try {
      const fit = await generateItemFitWithGemini({
        item: {
          name: formData.name, brand: formData.brand, category: formData.category,
          subCategory: formData.subCategory, colors: formData.colors, styles: formData.styles,
        },
        manifesto: measurements?.styleManifesto || '',
        inspirations,
        styleProfile: summariseStyleProfile(measurements),
      });
      setFitCheck(fit);
    } catch (e) {
      setFitError(e?.message || 'Could not check the fit.');
    } finally {
      setFitBusy(false);
    }
  };

  const handleFindOnline = async (file) => {
    if (!file) return;
    if (!isAIEnabled()) { setError('Find online needs the Concierge configured (add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic).'); return; }
    setIsLoading(true); setFindError(null); setFindStep('searching'); setFindResult(null); setFindPasteUrl('');
    // Switch to the find-online sub-view — we use step 1.5 conceptually but
    // keep step===1 and use findStep to drive the sub-UI inside step 1.
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 1200, maxBytes: 350_000, enhance: false });
      setFindPhotoDataUrl(dataUrl);
      const result = await findProductListingFromPhoto(dataUrl);
      setFindResult(result);
      setFindStep(result.confidence === 'low' ? 'no-match' : 'found');
    } catch (err) {
      setFindError(err?.message || 'Could not search for this item.');
      setFindStep('idle');
    } finally {
      setIsLoading(false);
    }
  };
  const handleFindInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFindOnline(f);
    e.target.value = '';
  };

  // Import from a URL the user has pasted (in the find-online flow).
  // Mirrors importFromLink but also carries over the photo as a fallback
  // if the listing has no image.
  const handleFindPasteImport = async () => {
    const url = findPasteUrl.trim();
    if (!url) return;
    setIsLoading(true); setFindError(null);
    try {
      const data = await fetchProductFromUrl(url);
      setFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        brand: data.brand || prev.brand,
        images: data.imageUrl
          ? [...(prev.images || []), data.imageUrl].slice(0, 6)
          // No listing image → use the photo they took for this flow
          : (findPhotoDataUrl ? [...(prev.images || []), findPhotoDataUrl].slice(0, 6) : prev.images),
        description: data.description || prev.description,
        price: data.price || prev.price,
        sourceUrl: data.sourceUrl || prev.sourceUrl || url,
      }));
      setFindStep('idle'); setFindResult(null); setFindPhotoDataUrl(null); setFindPasteUrl('');
      toast.show('Listing imported ✓ — review and save', { kind: 'success', duration: 3500 });
      setStep(2);
    } catch (err) {
      setFindError(err?.message || 'Could not import from this URL. Try another link or Manual Entry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindReset = () => {
    setFindStep('idle'); setFindResult(null); setFindError(null); setFindPasteUrl(''); setFindPhotoDataUrl(null);
  };
  // ── End photo-to-listing state ──────────────────────────────────────────────

  // Scan a care label / brand tag / barcode → Gemini Vision pre-fills the form.
  // Materials/care/colour are mapped to the app's known vocabularies (chips light
  // up correctly). Unmapped care phrases get appended to the description so they
  // aren't lost. The user always lands on step 2 to review.
  const [scanSummary, setScanSummary] = useState(null);
  const handleScanLabel = async (file) => {
    if (!file) return;
    if (!isAIEnabled()) { setError('Label scanning needs the Concierge configured (add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic).'); return; }
    setIsLoading(true); setError(null); setScanSummary(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 1400, maxBytes: 600_000, enhance: false });
      const result = await analyzeLabelWithGemini({ imageDataUrl: dataUrl });

      const allowedMaterials = materialsForCategory(formData.category);
      const validMaterials = Array.isArray(result.materials)
        ? result.materials.filter((m) => allowedMaterials.includes(m))
        : [];

      // Care: map each phrase to a chip when possible; collect unmapped phrases
      // so we can append them to the description (nothing gets lost).
      const careIn = Array.isArray(result.care) ? result.care.filter(Boolean) : [];
      const careChips = []; const careUnmapped = [];
      for (const phrase of careIn) {
        const tag = matchCareTag(phrase);
        if (tag && !careChips.includes(tag)) careChips.push(tag);
        else if (!tag) careUnmapped.push(phrase);
      }

      // Colour fuzzy-map → known family
      const mappedColor = matchColorFamily(result.color);

      const noteBits = [
        result.productCode ? `Product code: ${result.productCode}` : '',
        result.barcode ? `Barcode: ${result.barcode}` : '',
        careUnmapped.length ? `Care: ${careUnmapped.join(' · ')}` : '',
        result.notes || '',
      ].filter(Boolean);

      setFormData((prev) => ({
        ...prev,
        name: prev.name || result.productName || '',
        brand: prev.brand || result.brand || '',
        size: prev.size || result.size || '',
        colors: prev.colors.length ? prev.colors : (mappedColor ? [mappedColor] : prev.colors),
        materials: prev.materials.length ? prev.materials : validMaterials,
        care: prev.care.length ? prev.care : careChips,
        description: [prev.description, noteBits.join('\n')].filter(Boolean).join('\n').trim(),
      }));

      setScanSummary({
        brand: result.brand || '',
        productName: result.productName || '',
        size: result.size || '',
        color: mappedColor || result.color || '',
        materialsCount: validMaterials.length,
        careCount: careChips.length,
        unmappedColor: result.color && !mappedColor ? result.color : null,
      });
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Could not read this label.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleScanInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleScanLabel(f);
    // reset value so picking the same file twice re-fires onChange
    e.target.value = '';
  };

  // Identify-with-AI: one photo of the item → Gemini Vision returns a draft
  // → form opens with category, brand, name, colours, materials, styles,
  // seasons, description pre-filled. The single biggest import accelerator.
  const handleIdentifyItem = async (file) => {
    if (!file) return;
    if (!isAIEnabled()) { setError('Identify needs the Concierge configured (add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic).'); return; }
    setIsLoading(true); setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 1200, maxBytes: 350_000, enhance: false });
      const knownBrands = Array.from(new Set((shops || []).map((s) => s.name).filter(Boolean)));
      const result = await identifyItemWithGemini({ imageDataUrl: dataUrl, knownBrands });

      const validMaterials = (result.materials || []).filter((m) => materialsForCategory(result.category).includes(m));
      const validColours = (result.colors || []).map((c) => matchColorFamily(c)).filter(Boolean);
      const validStyles = (result.styles || []).filter((s) => STYLES.includes(s));
      const validSeasons = (result.seasons || []).filter((s) => ['Spring', 'Summer', 'Autumn', 'Winter'].includes(s));

      // Pre-fill the form. Always set category (required). For other fields,
      // only overwrite if currently empty so partial work isn't lost.
      setFormData((prev) => ({
        ...prev,
        category: result.category || prev.category || 'Tops',
        subCategory: prev.subCategory || result.subCategory || '',
        brand: prev.brand || result.brand || '',
        name: prev.name || result.name || '',
        colors: prev.colors.length ? prev.colors : validColours,
        materials: prev.materials.length ? prev.materials : validMaterials,
        styles: prev.styles.length ? prev.styles : validStyles,
        seasons: prev.seasons.length ? prev.seasons : validSeasons,
        description: prev.description || result.description || '',
        // Use the same photo as the item's main image — that's what the user
        // identified, after all.
        images: prev.images.length ? prev.images : [dataUrl],
        imageMeta: prev.images.length ? prev.imageMeta : [{ cutout: false }],
      }));

      toast.show(`Identified · ${result.confidence ?? '–'}/100 confidence`, { kind: 'success', duration: 3500 });
      setScanSummary({
        brand: result.brand || '',
        productName: result.name || '',
        size: '',
        color: validColours[0] || result.colors?.[0] || '',
        materialsCount: validMaterials.length,
        careCount: 0,
        unmappedColor: result.colors?.find((c) => !matchColorFamily(c)) || null,
      });
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Could not identify this item.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleIdentifyInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleIdentifyItem(f);
    e.target.value = '';
  };

  // Paste-an-image-from-clipboard: works while the modal is open on desktop.
  useEffect(() => {
    const onPaste = async (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type?.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      e.preventDefault();
      setIsLoading(true); setError(null);
      try {
        const originalDataUrl = await compressImageToDataUrl(file);
        let dataUrl = originalDataUrl;
        let cutoutOk = null;
        if (removeBackground) {
          setCutoutBusy(true);
          const out = await removeImageBackground(originalDataUrl);
          dataUrl = out.url; cutoutOk = out.ok;
          setCutoutBusy(false);
          toast.show(out.ok ? 'Background removed ✓ · tap to revert' : 'Cutout failed — kept original photo', { kind: out.ok ? 'success' : 'default', duration: 3500 });
        }
        setFormData((prev) => {
          if ((prev.images || []).length >= 6) return prev;
          const meta = Array.isArray(prev.imageMeta) ? prev.imageMeta : [];
          return {
            ...prev,
            images: [...(prev.images || []), dataUrl],
            imageMeta: [...meta, { cutout: cutoutOk === true, original: cutoutOk === true ? originalDataUrl : undefined }],
          };
        });
        setStep((s) => (s === 1 ? 2 : s));
      } catch (err) {
        setError(err?.message || 'Could not paste image.');
      } finally {
        setIsLoading(false);
        setCutoutBusy(false);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [removeBackground]);

  const addImageFiles = async (files) => {
    const list = Array.from(files || []).slice(0, 6 - (formData.images?.length || 0));
    if (!list.length) return;
    setIsLoading(true); setError(null);
    let firstNewDataUrl = null;
    try {
      let okCount = 0; let failCount = 0;
      for (const file of list) {
        const originalDataUrl = await compressImageToDataUrl(file);
        let dataUrl = originalDataUrl;
        let cutoutOk = null;
        if (removeBackground) {
          setCutoutBusy(true);
          const out = await removeImageBackground(originalDataUrl);
          dataUrl = out.url; cutoutOk = out.ok;
          if (out.ok) okCount++; else failCount++;
        }
        if (!firstNewDataUrl) firstNewDataUrl = dataUrl;
        setFormData((prev) => {
          const meta = Array.isArray(prev.imageMeta) ? prev.imageMeta : [];
          return {
            ...prev,
            images: [...(prev.images || []), dataUrl].slice(0, 6),
            imageMeta: [...meta, { cutout: cutoutOk === true, original: cutoutOk === true ? originalDataUrl : undefined }].slice(0, 6),
          };
        });
      }
      setCutoutBusy(false);
      if (removeBackground && (okCount || failCount)) {
        if (okCount && !failCount) toast.show(`Background removed ✓ on ${okCount} photo${okCount === 1 ? '' : 's'}`, { kind: 'success', duration: 3500 });
        else if (failCount && !okCount) toast.show(`Cutout failed on ${failCount} — kept originals`, { kind: 'default', duration: 4000 });
        else toast.show(`${okCount} cut out · ${failCount} kept original`, { kind: 'default', duration: 4000 });
      }
      setStep((s) => (s === 1 ? 2 : s));
      // Auto-extract colours from the first added photo IF no colour set yet.
      if (firstNewDataUrl && (!formData.colors || formData.colors.length === 0)) {
        try {
          const detected = await extractDominantColors(firstNewDataUrl);
          if (detected.length > 0) {
            setFormData((prev) => prev.colors?.length ? prev : { ...prev, colors: detected });
          }
        } catch (e) { console.warn('[wardrobe] colour extraction failed:', e); }
      }
    } catch (err) {
      setError(err?.message || 'Could not process one of the images.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      imageMeta: (prev.imageMeta || []).filter((_, i) => i !== index),
    }));
  };

  const promoteToMain = (index) => {
    if (index === 0) return;
    setFormData((prev) => {
      const next = [...prev.images];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      const meta = [...(prev.imageMeta || [])];
      const [movedMeta] = meta.splice(index, 1);
      if (movedMeta !== undefined) meta.unshift(movedMeta);
      return { ...prev, images: next, imageMeta: meta };
    });
  };

  const toggleSeason = (s) => {
    setFormData((prev) => {
      const current = prev.seasons || [];
      if (s === 'All Seasons') return { ...prev, seasons: [] };
      return {
        ...prev,
        seasons: current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
      };
    });
  };

  const toggleStyle = (s) => {
    setFormData((prev) => {
      const current = prev.styles || [];
      return {
        ...prev,
        styles: current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
      };
    });
  };

  const toggleCare = (c) => {
    setFormData((prev) => {
      const current = prev.care || [];
      return {
        ...prev,
        care: current.includes(c) ? current.filter((x) => x !== c) : [...current, c],
      };
    });
  };

  const toggleColor = (c) => {
    setFormData((prev) => {
      const current = prev.colors || [];
      return {
        ...prev,
        colors: current.includes(c) ? current.filter((x) => x !== c) : [...current, c],
      };
    });
  };

  const toggleMaterial = (m) => {
    setFormData((prev) => {
      const current = prev.materials || [];
      return {
        ...prev,
        materials: current.includes(m) ? current.filter((x) => x !== m) : [...current, m],
      };
    });
  };

  const handleImageUpload = (e) => addImageFiles(e.target.files);

  const importFromLink = async (e) => {
    e.preventDefault();
    if (!linkInput) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProductFromUrl(linkInput);
      setFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        brand: data.brand || prev.brand,
        images: data.imageUrl ? [...(prev.images || []), data.imageUrl].slice(0, 6) : prev.images,
        description: data.description || prev.description,
        price: data.price || prev.price,
        sourceUrl: data.sourceUrl || prev.sourceUrl || linkInput,
        status: 'wishlist',
      }));
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Import failed. Try Manual Entry instead.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true); setError(null);
    try {
      // Strip the bulky in-memory `original` base64 snapshot from imageMeta
      // before save (risks 1MiB Firestore cap). Small Storage-URL fields
      // (cutoutUrl, framedUrl) and frame params are kept intentionally.
      const slimMeta = Array.isArray(formData.imageMeta)
        ? formData.imageMeta.map((m) => m ? {
            cutout: !!m.cutout,
            ...(m.angle ? { angle: m.angle } : {}),
            ...(m.cutoutUrl ? { cutoutUrl: m.cutoutUrl } : {}),
            ...(m.framedUrl ? { framedUrl: m.framedUrl } : {}),
            ...(m.frame ? { frame: m.frame } : {}),
          } : null)
        : [];
      const raw = {
        ...formData,
        imageMeta: slimMeta,
        id: existingItem?.id || newId(),
        price: Number(formData.price) || 0,
        images: (formData.images || []).filter(Boolean),
        createdAt: existingItem?.createdAt || new Date().toISOString(),
      };
      // Firestore rejects undefined values silently in some SDK paths.
      // Strip them defensively so saves never hang.
      const payload = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v !== undefined && k !== 'imageUrl') payload[k] = v;
      }
      await onSave(payload);
    } catch (err) {
      console.error('[wardrobe] item save failed:', err);
      setError(err?.message || 'Save failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6 transition-all">
      <div className="bg-[#F7F5F2] w-full sm:max-w-xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">{isEdit ? 'Edit Item' : 'Add to Atelier'}</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-4 sm:p-6 lg:p-10 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="space-y-8">
              <p className="text-stone-500 text-sm leading-relaxed">
                Add items to your digital wardrobe via a product link from your favorite store, or capture an item you already own.
              </p>

              <form onSubmit={importFromLink} className="space-y-3">
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase">Import via Link</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon size={18} className="text-stone-400" strokeWidth={1.5} />
                  </div>
                  <input
                    type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Paste URL (e.g. hollandcooper.com/...)"
                    className="block w-full pl-12 pr-32 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                    required
                  />
                  <button
                    type="submit" disabled={isLoading}
                    className="absolute right-2 top-2 bottom-2 bg-stone-900 text-white px-6 rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Scanning...' : 'Extract'}
                  </button>
                </div>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="flex-shrink-0 mx-4 text-stone-400 text-xs tracking-widest uppercase">Or</span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              {/* ── Photo-to-listing active panel ───────────────────────────────────── */}
              {findStep !== 'idle' && (
                <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                    <p className="text-[10px] tracking-widest uppercase font-semibold text-stone-500">
                      {findStep === 'searching' ? 'Searching…' : 'Find this online'}
                    </p>
                    <button
                      type="button"
                      onClick={handleFindReset}
                      className="text-stone-400 hover:text-stone-900 transition-colors"
                      aria-label="Cancel search"
                    >
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Searching spinner */}
                  {findStep === 'searching' && (
                    <div className="py-8 flex flex-col items-center gap-3 text-stone-600">
                      <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
                      <p className="text-[11px] tracking-[0.28em] uppercase text-stone-500">Identifying product</p>
                    </div>
                  )}

                  {/* Result panel: found (medium/high confidence) or no-match (low) */}
                  {(findStep === 'found' || findStep === 'no-match') && findResult && (
                    <div className="p-4 space-y-4">
                      {/* What we saw */}
                      <div className="text-xs text-stone-600 leading-relaxed italic">
                        "{findResult.description}"
                      </div>

                      {/* Confidence badge + brand */}
                      {findResult.confidence !== 'low' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {findResult.brand && (
                            <span className="px-2.5 py-1 rounded-full bg-stone-900 text-white text-[10px] tracking-widest uppercase">
                              {findResult.brand}
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-[10px] tracking-widest uppercase ${
                            findResult.confidence === 'high'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {findResult.confidence === 'high' ? 'Confident match' : 'Possible match'}
                          </span>
                        </div>
                      )}
                      {findStep === 'no-match' && (
                        <p className="text-[11px] text-stone-500 italic">
                          Couldn't identify a specific brand or product — try Google Shopping below to find it yourself.
                        </p>
                      )}

                      {/* Google Shopping CTA */}
                      <a
                        href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(findResult.searchQuery || findResult.description || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-stone-900 text-white text-sm tracking-wide hover:bg-stone-700 transition-colors"
                      >
                        <Search size={14} strokeWidth={1.5} />
                        Search Google Shopping
                        {findResult.searchQuery && (
                          <span className="text-stone-400 text-[10px] truncate max-w-[120px] hidden sm:inline">
                            "{findResult.searchQuery}"
                          </span>
                        )}
                      </a>

                      {/* URL paste */}
                      <div className="space-y-2">
                        <p className="text-[10px] tracking-widest uppercase text-stone-500">Found the listing? Paste the URL to import it:</p>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={findPasteUrl}
                            onChange={(e) => setFindPasteUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFindPasteImport(); } }}
                            placeholder="https://…"
                            className="flex-1 px-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-all"
                            style={{ fontSize: '16px' }}
                          />
                          <button
                            type="button"
                            onClick={handleFindPasteImport}
                            disabled={!findPasteUrl.trim() || isLoading}
                            className="px-4 py-2 rounded-xl bg-stone-900 text-white text-[11px] tracking-wide uppercase hover:bg-stone-700 disabled:opacity-50 transition-colors shrink-0"
                          >
                            {isLoading ? '…' : 'Import'}
                          </button>
                        </div>
                      </div>

                      {findError && <p className="text-[11px] text-red-700 italic">{findError}</p>}

                      {/* Escape hatch back to normal AI analysis */}
                      <button
                        type="button"
                        onClick={() => { handleFindReset(); }}
                        className="w-full text-[11px] tracking-wide text-stone-400 hover:text-stone-900 hover:underline underline-offset-4 transition-colors"
                      >
                        Or go back to other add options
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Normal option grid — hidden while find-online flow is active ──── */}
              {findStep === 'idle' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="group relative flex flex-col items-center justify-center p-5 sm:p-6 bg-stone-900 border border-stone-900 rounded-2xl cursor-pointer hover:bg-stone-700 transition-all col-span-2 sm:col-span-3 text-center">
                  <span className="absolute top-2 right-2 text-[9px] tracking-widest uppercase text-brass-300 font-medium">Fastest</span>
                  <Sparkles size={26} strokeWidth={1} className="mb-2 text-brass-300 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-display text-base sm:text-lg text-white">Identify with Concierge</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase">Snap any item · category, brand, colours, name — auto-filled</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleIdentifyInput} className="hidden" />
                </label>
                {/* Find this online — new card */}
                <label className="group relative flex flex-col items-center justify-center p-5 sm:p-6 bg-white border-2 border-stone-200 hover:border-stone-900 rounded-2xl cursor-pointer transition-all col-span-2 sm:col-span-3 text-center">
                  <span className="absolute top-2 right-2 text-[9px] tracking-widest uppercase text-stone-400 font-medium">Best images</span>
                  <Search size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-display text-base sm:text-lg text-stone-900">Find this online</span>
                  <span className="text-[10px] text-stone-500 mt-1 tracking-wide uppercase">Snap · AI finds the real listing · import name, brand, official image, price</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFindInput} className="hidden" />
                </label>
                {onOpenSweep && (
                  <button type="button" onClick={onOpenSweep} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-brass-50 border border-brass-300 rounded-2xl cursor-pointer hover:border-brass-500 transition-all col-span-2 sm:col-span-3">
                    <Camera size={22} strokeWidth={1} className="mb-2 text-brass-700 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Closet sweep</span>
                    <span className="text-[10px] text-stone-500 mt-1 tracking-wide uppercase text-center">Take many photos in a row · AI identifies each · save them all</span>
                  </button>
                )}
                {onOpenBulkImport && (
                  <button type="button" onClick={onOpenBulkImport} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-500 transition-all col-span-2 sm:col-span-3">
                    <LinkIcon size={22} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Search & Bulk Import</span>
                    <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Find on the web · paste many URLs at once</span>
                  </button>
                )}
                <label className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-500 transition-all">
                  <Camera size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Add Photos</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Up to 6</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
                <label className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-500 transition-all">
                  <Wand2 size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Scan Label</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Care tag · barcode</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleScanInput} className="hidden" />
                </label>
                {onOpenReceiptModal && (
                  <button type="button" onClick={onOpenReceiptModal} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-500 transition-all">
                    <Sparkles size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Paste Receipt</span>
                    <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Order email</span>
                  </button>
                )}
                <button type="button" onClick={() => setStep(2)} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-500 transition-all">
                  <Plus size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Manual Entry</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Type details</span>
                </button>
              </div>
              )}
              <p className="text-[10px] text-stone-400 tracking-wide text-center">
                Tip: on desktop, copy an image and press <span className="font-medium text-stone-600">Ctrl+V</span> anywhere in this dialog to paste it in.
              </p>
              {error && <p className="text-xs text-red-700">{error}</p>}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="p-4 sm:p-6 lg:p-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-6">
              {scanSummary && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-start gap-3">
                  <Wand2 size={16} className="text-emerald-700 mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0 text-xs leading-relaxed">
                    <p className="font-medium text-emerald-900">Read from label</p>
                    <p className="text-emerald-800/80 mt-0.5">
                      {[
                        scanSummary.brand && `Brand: ${scanSummary.brand}`,
                        scanSummary.productName && `Name: ${scanSummary.productName}`,
                        scanSummary.size && `Size: ${scanSummary.size}`,
                        scanSummary.color && `Colour: ${scanSummary.color}`,
                        scanSummary.materialsCount && `${scanSummary.materialsCount} material${scanSummary.materialsCount === 1 ? '' : 's'}`,
                        scanSummary.careCount && `${scanSummary.careCount} care chip${scanSummary.careCount === 1 ? '' : 's'}`,
                      ].filter(Boolean).join(' · ') || 'No details — try a clearer photo.'}
                    </p>
                    {scanSummary.unmappedColor && (
                      <p className="text-brass-700 mt-1">Colour "{scanSummary.unmappedColor}" didn't match a palette family — set it manually below.</p>
                    )}
                    <p className="text-emerald-800/60 mt-1">Review the fields below and add a category before saving.</p>
                  </div>
                  <button type="button" onClick={() => setScanSummary(null)} className="text-emerald-700/60 hover:text-emerald-900 shrink-0" aria-label="Dismiss">
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )}
              <div>
                <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase">
                    Photos <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">{formData.images.length} / 6</span>
                  </label>
                  {formData.images.length === 0 && (formData.brand || formData.name) && (
                    <a
                      href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent([formData.brand, formData.name].filter(Boolean).join(' '))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors inline-flex items-center gap-1.5"
                    >
                      Find product photo ↗
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 relative group">
                      <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      {formData.imageMeta?.[i]?.cutout && (
                        <button type="button"
                          onClick={() => {
                            // Revert this thumb to the saved original. Original
                            // moves into images[], cutout is dropped.
                            const original = formData.imageMeta[i]?.original;
                            if (!original) return;
                            setFormData((prev) => {
                              const nextImages = [...prev.images]; nextImages[i] = original;
                              const nextMeta = [...(prev.imageMeta || [])];
                              nextMeta[i] = { ...nextMeta[i], cutout: false };
                              return { ...prev, images: nextImages, imageMeta: nextMeta };
                            });
                            toast.show('Reverted to original photo', { kind: 'default', duration: 2500 });
                          }}
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] tracking-widest uppercase rounded-full font-medium shadow-sm hover:bg-emerald-700 transition-colors"
                          title="Revert to original photo">
                          Cutout · revert
                        </button>
                      )}
                      {!formData.imageMeta?.[i]?.cutout && (
                        <button type="button"
                          disabled={cutoutBusy}
                          onClick={async () => {
                            // Apply cutout to this thumb. Keeps a copy of the
                            // currently-displayed photo as the new "original"
                            // for future reverts.
                            const src = formData.images[i];
                            setCutoutBusy(true);
                            try {
                              const out = await removeImageBackground(src);
                              if (out.ok) {
                                setFormData((prev) => {
                                  const nextImages = [...prev.images]; nextImages[i] = out.url;
                                  const nextMeta = [...(prev.imageMeta || [])];
                                  while (nextMeta.length <= i) nextMeta.push({});
                                  nextMeta[i] = { ...nextMeta[i], cutout: true, original: src };
                                  return { ...prev, images: nextImages, imageMeta: nextMeta };
                                });
                                toast.show('Background removed ✓', { kind: 'success', duration: 2500 });
                              } else {
                                toast.show('Cutout failed — kept original', { kind: 'default', duration: 3000 });
                              }
                            } finally { setCutoutBusy(false); }
                          }}
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-white/90 backdrop-blur text-stone-700 text-[9px] tracking-widest uppercase rounded-full font-medium shadow-sm hover:text-stone-900 transition-colors opacity-0 sm:group-hover:opacity-100"
                          title="Remove background">
                          Cut out
                        </button>
                      )}
                      <button type="button" onClick={() => setEditingPhoto({ index: i, src: img })}
                        className="absolute top-1.5 right-9 p-1.5 bg-white/90 backdrop-blur text-stone-900 rounded-full opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-stone-100 shadow-sm"
                        title="Crop or rotate">
                        <Wand2 size={12} strokeWidth={2} />
                      </button>
                      <select
                        value={formData.imageMeta?.[i]?.angle || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormData((prev) => {
                            const meta = [...(prev.imageMeta || [])];
                            while (meta.length <= i) meta.push({});
                            meta[i] = { ...meta[i], angle: v };
                            return { ...prev, imageMeta: meta };
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-1.5 right-1.5 text-[9px] tracking-widest uppercase bg-white/90 backdrop-blur text-stone-900 rounded-full px-2 py-0.5 border border-stone-200 outline-none cursor-pointer">
                        <option value="">—</option>
                        <option value="Front">Front</option>
                        <option value="Back">Back</option>
                        <option value="Styled">Styled</option>
                        <option value="Detail">Detail</option>
                      </select>
                      <button type="button" onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur text-stone-900 rounded-full opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 shadow-sm">
                        <X size={12} strokeWidth={2} />
                      </button>
                      {i === 0 ? (
                        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-stone-900 text-white text-[9px] tracking-widest uppercase rounded-full">Main</span>
                      ) : (
                        <button type="button" onClick={() => promoteToMain(i)}
                          className="absolute bottom-1.5 left-1.5 px-2 py-1 bg-white/90 backdrop-blur text-stone-900 text-[9px] tracking-widest uppercase rounded-full opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-stone-100 shadow-sm flex items-center gap-1"
                          title="Set as main photo">
                          <Star size={10} strokeWidth={2} /> Make main
                        </button>
                      )}
                    </div>
                  ))}
                  {cutoutBusy && (
                    <div className="aspect-square rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 flex flex-col items-center justify-center text-emerald-700">
                      <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin mb-2" />
                      <span className="text-[10px] tracking-wider uppercase">Removing bg…</span>
                    </div>
                  )}
                  {formData.images.length < 6 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-500 transition-all text-stone-400 hover:text-stone-900">
                      <Plus size={22} strokeWidth={1.5} />
                      <span className="text-[10px] tracking-wider uppercase mt-1">Add</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 mt-2">Or paste with Ctrl+V. First photo is shown on the card — tap "Make main" on any other to promote it.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input label="Product Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" required />
                <Input label="Brand Designer" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} type="text" required />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Input label="Price (£)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} type="number" step="0.01" required />
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, subCategory: ''})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors">
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Accessories', 'Jewellery', 'Sportswear', 'Swimwear', 'Bags', 'Shoes'].includes(formData.category) && (
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                    {formData.category === 'Tops' ? 'Top Type'
                      : formData.category === 'Bottoms' ? 'Bottom Type'
                      : formData.category === 'Outerwear' ? 'Outerwear Type'
                      : formData.category === 'Dresses' ? 'Dress Type'
                      : formData.category === 'Jewellery' ? 'Jewellery Type'
                      : formData.category === 'Sportswear' ? 'Sport / Activity'
                      : formData.category === 'Bags' ? 'Bag Type'
                      : formData.category === 'Shoes' ? 'Shoe Type'
                      : formData.category === 'Swimwear' ? 'Swimwear Type'
                      : 'Accessory Type'}
                  </label>
                  <select value={formData.subCategory} onChange={e => setFormData({...formData, subCategory: e.target.value})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors">
                    <option value="">Select type...</option>
                    {(formData.category === 'Tops' ? TOP_SUBCATEGORIES
                      : formData.category === 'Bottoms' ? BOTTOM_SUBCATEGORIES
                      : formData.category === 'Outerwear' ? OUTERWEAR_SUBCATEGORIES
                      : formData.category === 'Dresses' ? DRESS_SUBCATEGORIES
                      : formData.category === 'Jewellery' ? JEWELLERY_SUBCATEGORIES
                      : formData.category === 'Sportswear' ? SPORTSWEAR_SUBCATEGORIES
                      : formData.category === 'Bags' ? BAG_SUBCATEGORIES
                      : formData.category === 'Shoes' ? SHOE_SUBCATEGORIES
                      : formData.category === 'Swimwear' ? SWIMWEAR_SUBCATEGORIES
                      : ACCESSORY_SUBCATEGORIES
                    ).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Seasons <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(select any number)</span>
                </label>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {SEASONS.map((season) => {
                    const isAllSeasons = season === 'All Seasons';
                    const selected = formData.seasons || [];
                    const isActive = isAllSeasons ? selected.length === 0 : selected.includes(season);
                    return (
                      <button key={season} type="button" onClick={() => toggleSeason(season)}
                        className={`flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                          isActive ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {season}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Styles <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(select any)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => {
                    const isActive = (formData.styles || []).includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleStyle(s)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                          isActive ? 'bg-stone-700 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-3">Collection Status</label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setFormData({ ...formData, status: 'owned' })}
                    className={`flex-1 py-4 px-3 rounded-xl text-sm font-medium transition-all border text-center ${
                      formData.status === 'owned' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}>
                    <div>Owned</div>
                    <div className={`text-[10px] mt-1 ${formData.status === 'owned' ? 'text-stone-300' : 'text-stone-400'}`}>It's in my wardrobe</div>
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, status: 'wishlist' })}
                    className={`flex-1 py-4 px-3 rounded-xl text-sm font-medium transition-all border text-center ${
                      formData.status === 'wishlist' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}>
                    <div>Wishlist</div>
                    <div className={`text-[10px] mt-1 ${formData.status === 'wishlist' ? 'text-stone-300' : 'text-stone-400'}`}>I want this</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Size <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(unlocks fit comparison when the brand has a size chart)</span>
                </label>
                <input list="size-suggestions" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} type="text" placeholder="e.g. 10, M, EU 39"
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
                />
                <datalist id="size-suggestions">
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL',
                    '6', '8', '10', '12', '14', '16', '18', '20',
                    'EU 36', 'EU 37', 'EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42',
                    'UK 3', 'UK 3.5', 'UK 4', 'UK 4.5', 'UK 5', 'UK 5.5', 'UK 6', 'UK 6.5', 'UK 7', 'UK 7.5', 'UK 8',
                    'One Size'].map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>

              {careAppliesToCategory(formData.category) && (
              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Care <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CARE_TAGS.map((c) => {
                    const isActive = (formData.care || []).includes(c);
                    return (
                      <button key={c} type="button" onClick={() => toggleCare(c)}
                        className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isActive ? 'bg-stone-700 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Materials <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {materialsForCategory(formData.category).map((m) => {
                    const isActive = (formData.materials || []).includes(m);
                    return (
                      <button key={m} type="button" onClick={() => toggleMaterial(m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isActive ? 'bg-stone-700 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Colours <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">{(formData.colors || []).length > 0 ? '(auto-detected — adjust if wrong)' : '(auto-detects from photos)'}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_FAMILIES.map((c) => {
                    const isActive = (formData.colors || []).includes(c);
                    const swatch = COLOR_SWATCHES[c];
                    return (
                      <button key={c} type="button" onClick={() => toggleColor(c)}
                        className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-2 ${
                          isActive ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full border border-stone-300/50" style={swatch.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }} />
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  placeholder="Notes, fabric, fit, styling thoughts…"
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors resize-y"
                />
              </div>

              <Input
                label="Source URL (where you found / bought it)"
                type="url"
                value={formData.sourceUrl}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                placeholder="https://"
              />

              {formData.status === 'owned' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased On</label>
                    <input type="date" value={formData.purchasedDate}
                      onChange={(e) => setFormData({ ...formData, purchasedDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased From</label>
                    <input list="purchased-from-suggestions" type="text" value={formData.purchasedFrom}
                      onChange={(e) => setFormData({ ...formData, purchasedFrom: e.target.value })}
                      placeholder="Shop name"
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
                    />
                    <datalist id="purchased-from-suggestions">
                      {shops.map((s) => <option key={s.id} value={s.name} />)}
                    </datalist>
                  </div>
                </div>
              )}

              {formData.status === 'owned' && (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                  <p className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Lent out <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(optional)</span></p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" value={formData.lentTo}
                      onChange={(e) => setFormData({ ...formData, lentTo: e.target.value })}
                      placeholder="Lent to (e.g. Anna)"
                      className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                    <input type="date" value={formData.lentReturnBy}
                      onChange={(e) => setFormData({ ...formData, lentReturnBy: e.target.value })}
                      placeholder="Return by"
                      disabled={!formData.lentTo}
                      className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors disabled:opacity-50" />
                  </div>
                </div>
              )}

              {formData.status === 'wishlist' && (
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Why? <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(optional — feeds AI gap analysis)</span></label>
                  <input type="text" value={formData.wishlistReason || ''}
                    onChange={(e) => setFormData({ ...formData, wishlistReason: e.target.value })}
                    placeholder="e.g. for a wedding · to replace my black blazer · need a winter coat"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors" />
                </div>
              )}

              {measurements?.styleManifesto && (
                <div className="mt-4 rounded-xl border border-stone-200 p-4">
                  {fitCheck ? (
                    <>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#9a7b4f] mb-1">Should you buy this?</div>
                      <p className="font-display italic text-sm text-stone-800">{fitCheck.verdict}</p>
                      <div className="text-xs text-stone-500 mt-1">{fitCheck.tier}</div>
                      <button type="button" onClick={runFitCheck} disabled={fitBusy} className="text-[11px] uppercase tracking-wider text-stone-500 underline mt-2 disabled:opacity-40">
                        {fitBusy ? 'Reading…' : 'Check again'}
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={runFitCheck} disabled={fitBusy || !formData.name} className="text-sm text-stone-700 underline disabled:opacity-40">
                      {fitBusy ? 'Reading…' : 'Check this against my style'}
                    </button>
                  )}
                  {fitError && <p className="text-xs text-red-600 mt-2">{fitError}</p>}
                </div>
              )}

              {error && <p className="text-xs text-red-700">{error}</p>}
            </div>
            <div className="px-4 sm:px-6 lg:px-10 py-3 sm:py-4 border-t border-stone-200/60 bg-white/95 backdrop-blur shrink-0"
                 style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
              <button type="submit" disabled={isLoading}
                className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-700 transition-all shadow-lg disabled:opacity-50 active:scale-[0.98]">
                {isLoading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save to Collection')}
              </button>
            </div>
          </form>
        )}
      </div>
      {editingPhoto && (
        <PhotoEditorModal
          src={editingPhoto.src}
          onClose={() => setEditingPhoto(null)}
          onSave={(dataUrl) => {
            setFormData((prev) => {
              const next = [...prev.images];
              next[editingPhoto.index] = dataUrl;
              return { ...prev, images: next };
            });
            setEditingPhoto(null);
            toast.show('Photo updated', { kind: 'success' });
          }}
        />
      )}
    </div>
  );
}

function FitVerdictSection({ item, measurements, inspirations, onSaveFit }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const manifesto = measurements?.styleManifesto || '';
  const cached = item?.manifestoFit;
  const stale = isFitStale(item, measurements?.styleManifestoAt || null);

  if (!manifesto) {
    return (
      <div className="rounded-2xl border border-stone-200 p-5 text-sm text-stone-500">
        Generate your <span className="font-medium">Style Manifesto</span> on the Insights tab to unlock a fit reading for this piece.
      </div>
    );
  }

  const run = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const fit = await generateItemFitWithGemini({
        item, manifesto, inspirations,
        styleProfile: summariseStyleProfile(measurements),
      });
      onSaveFit(fit);
    } catch (e) {
      setError(e?.message || 'Could not read this against your style.');
    } finally {
      setBusy(false);
    }
  };

  const fit = (!stale && cached) ? cached : null;

  return (
    <div className="rounded-2xl bg-stone-900 text-white p-5">
      <div className="text-[10px] tracking-[0.18em] uppercase text-[#c9a85f] mb-2">The Concierge's read</div>
      {fit ? (
        <>
          <p className="font-display italic text-[15px] leading-relaxed text-[#F7F5F2]">{fit.verdict}</p>
          <div className="text-xs text-stone-400 mt-2">{fit.tier}</div>
          <button onClick={() => setExpanded((v) => !v)} className="text-xs underline text-stone-300 mt-3">
            {expanded ? 'Hide the detail' : 'Why?'}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2">
              {fit.dimensions.map((d, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-[11px] text-stone-400"><span>{d.label}</span><span>{d.state}</span></div>
                  <div className="h-1 rounded-full bg-stone-700 overflow-hidden"><div className="h-full bg-[#c9a85f]" style={{ width: `${Math.round(d.level * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <button onClick={run} disabled={busy} className="text-[11px] uppercase tracking-wider text-stone-400 mt-4 disabled:opacity-40">{busy ? 'Reading…' : 'Re-read'}</button>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-300">See how this piece sits with your style.</p>
          <button onClick={run} disabled={busy} className="mt-3 bg-[#c9a85f] text-stone-900 rounded-full px-5 py-2 text-xs uppercase tracking-wider disabled:opacity-40">
            {busy ? 'Reading…' : 'Read against my style'}
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </div>
  );
}

function ItemDetailView({ item, shops, measurements, items: allItems = [], outfits = [], onOpenOutfit, onClose, onEdit, onDelete, onMarkOwned, onMarkWishlist, onLogWear, onUnlogWear, onSetWearNote, onSetWearOccasion, onMarkCared, onToggleFavorite, onSetCondition, onDuplicate, onShare, onStyleWithItem, onOpenItem, onPrev, onNext, positionLabel, inspirations = [], onSaveFit, uid, onUpdateItem }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [framerOpen, setFramerOpen] = useState(false);
  const [itemLogDate, setItemLogDate] = useState(todayISO());
  const [itemLogDateOpen, setItemLogDateOpen] = useState(false);
  const [fitEstimate, setFitEstimate] = useState(null);
  const [fitEstimateBusy, setFitEstimateBusy] = useState(false);
  const [fitEstimateError, setFitEstimateError] = useState(null);
  const [purchaseVerdict, setPurchaseVerdict] = useState(null);
  const [purchaseVerdictBusy, setPurchaseVerdictBusy] = useState(false);
  const [purchaseVerdictError, setPurchaseVerdictError] = useState(null);
  const images = itemImages(item);
  const toast = useToast();
  // Touch swipe between items in the wardrobe list. Only horizontal gestures
  // (≥60px) on the page background trigger nav — vertical scrolls and gestures
  // inside the photo carousel / inputs are ignored.
  const swipeRef = React.useRef(null);
  useEffect(() => {
    let startX = 0; let startY = 0; let armed = false;
    const onStart = (e) => {
      const t = e.touches?.[0]; if (!t) return;
      const tag = e.target?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'IMG'].includes(tag)) { armed = false; return; }
      startX = t.clientX; startY = t.clientY; armed = true;
    };
    const onEnd = (e) => {
      if (!armed) return;
      const t = e.changedTouches?.[0]; if (!t) return;
      const dx = t.clientX - startX; const dy = t.clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && onNext) { haptic('tap'); onNext(); }
        else if (dx > 0 && onPrev) { haptic('tap'); onPrev(); }
      }
    };
    const el = swipeRef.current;
    if (!el) return;
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [onPrev, onNext]);

  // Image-level swipe: flip activePhoto when the user swipes on the main image.
  // Tap (no movement) still opens the lightbox. Movement > 40px cancels the
  // synthetic click so swipe never accidentally fullscreens the gallery.
  const photoRef = React.useRef(null);
  const photoSwipeRef = React.useRef({ startX: 0, startY: 0, swiped: false });
  useEffect(() => {
    const el = photoRef.current;
    if (!el || images.length < 2) return;
    const onStart = (e) => {
      const t = e.touches?.[0]; if (!t) return;
      photoSwipeRef.current = { startX: t.clientX, startY: t.clientY, swiped: false };
    };
    const onEnd = (e) => {
      const t = e.changedTouches?.[0]; if (!t) return;
      const { startX, startY } = photoSwipeRef.current;
      const dx = t.clientX - startX; const dy = t.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        photoSwipeRef.current.swiped = true;
        if (dx < 0) setActivePhoto((i) => Math.min(images.length - 1, i + 1));
        else setActivePhoto((i) => Math.max(0, i - 1));
        haptic('tap');
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [images.length]);

  // Navigating to a different item (via Wear-with, Appears-in, prev/next) should
  // land on that item from the top, not preserve the previous item's scroll.
  // Also reset the photo carousel so we don't open the new item on photo #3.
  useEffect(() => {
    swipeRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setActivePhoto(0);
    setFitEstimate(null);
    setFitEstimateError(null);
    setPurchaseVerdict(null);
    setPurchaseVerdictError(null);
  }, [item.id]);

  const seasons = itemSeasons(item);
  const fit = computeFitAgainstChart({ item, shops, measurements });
  // Owned pieces from the same brand whose sizes already fit — the strongest
  // signal for the AI fit estimate (no per-brand size chart required).
  const ownedSameBrand = (allItems || [])
    .filter((i) => i.id !== item.id && i.status !== 'wishlist' && i.size?.trim()
      && i.brand && item.brand && i.brand.toLowerCase().trim() === item.brand.toLowerCase().trim())
    .map((i) => ({ category: i.category, subCategory: i.subCategory, name: i.name, size: i.size }));
  const runFitEstimate = async () => {
    setFitEstimateBusy(true); setFitEstimateError(null);
    try {
      const est = await generateFitEstimateWithGemini({ item, measurements, ownedSameBrand });
      if (est) setFitEstimate(est);
      else setFitEstimateError('Could not estimate fit this time — try again.');
    } catch (e) {
      setFitEstimateError(e?.message || 'Fit estimate failed.');
    } finally {
      setFitEstimateBusy(false);
    }
  };
  const runPurchaseVerdict = async () => {
    setPurchaseVerdictBusy(true); setPurchaseVerdictError(null);
    try {
      // Hard timeout so a slow/stalled model call can never leave the button
      // stuck in its "Scoring…" state indefinitely.
      const v = await Promise.race([
        scorePurchaseWithGemini({ item, items: allItems, measurements }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Took too long — try again.')), 40000)),
      ]);
      if (v) setPurchaseVerdict(v);
      else setPurchaseVerdictError('Could not score this one — try again.');
    } catch (e) {
      setPurchaseVerdictError(e?.message || 'Scoring failed.');
    } finally {
      setPurchaseVerdictBusy(false);
    }
  };
  const wears = itemWearCount(item);
  const cpw = itemCostPerWear(item);
  const wornToday = itemWearHistory(item).includes(todayISO());
  const wornOnLogDate = itemWearHistory(item).includes(itemLogDate);
  const sourceHost = (() => {
    try { return new URL(item.sourceUrl).host.replace(/^www\./, ''); } catch { return null; }
  })();
  const formattedDate = item.purchasedDate
    ? new Date(item.purchasedDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div ref={swipeRef} className="fixed inset-0 bg-[#F7F5F2] z-50 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      <div className="sticky top-0 z-10 bg-[#F7F5F2]/80 backdrop-blur-md border-b border-stone-200/60 pt-safe">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-3 sm:p-4 lg:p-6">
          <button onClick={onClose} className="flex items-center gap-2 pl-2 pr-3 sm:pl-3 sm:pr-4 py-2 rounded-full text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 transition-colors">
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
            <span className="hidden sm:inline">Back to Wardrobe</span>
            <span className="sm:hidden">Back</span>
          </button>
          {(onPrev || onNext) && (
            <div className="hidden sm:flex items-center gap-1.5 text-stone-400">
              <button onClick={onPrev} disabled={!onPrev} aria-label="Previous item"
                className="p-2 rounded-full hover:bg-stone-200/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronRight size={16} strokeWidth={1.5} className="rotate-180" />
              </button>
              {positionLabel && <span className="text-[10px] tracking-widest uppercase">{positionLabel}</span>}
              <button onClick={onNext} disabled={!onNext} aria-label="Next item"
                className="p-2 rounded-full hover:bg-stone-200/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          )}
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={onToggleFavorite}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${
                item.favorite
                  ? 'bg-brass-300 text-stone-900 border border-brass-400'
                  : 'bg-white border border-stone-200 text-stone-400 hover:border-brass-400 hover:text-brass-500'
              }`}
              aria-label={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Star size={16} strokeWidth={1.5} className={item.favorite ? 'fill-stone-900' : ''} />
            </button>
            <button onClick={onEdit} className="p-2.5 sm:px-5 sm:py-2.5 rounded-full text-sm bg-white border border-stone-200 text-stone-800 hover:border-stone-500 transition-all">
              <span className="hidden sm:inline">Edit</span>
              <span className="sm:hidden text-xs font-medium px-1">Edit</span>
            </button>
            {onShare && (() => {
              // Wishlist items use share as a primary action (asking friends
              // for opinions), so we make it a labelled brass pill that's
              // immediately discoverable — not just another icon in the row.
              // Owned items keep the lighter icon-only treatment.
              const isWish = item.status === 'wishlist';
              return (
                <button
                  onClick={onShare}
                  className={`p-2.5 sm:px-4 sm:py-2.5 rounded-full text-sm transition-all inline-flex items-center gap-2 border ${
                    isWish
                      ? 'bg-brass-200 text-stone-900 border-brass-300 hover:bg-brass-300 font-medium'
                      : 'bg-white border-stone-200 text-stone-700 hover:border-stone-500'
                  }`}
                  title={isWish ? 'Share this wishlist item for second opinions' : 'Share this piece'}
                  aria-label="Share item"
                >
                  <Share2 size={16} strokeWidth={1.5} />
                  <span className={isWish ? 'text-xs sm:text-sm font-medium' : 'hidden sm:inline'}>Share</span>
                </button>
              );
            })()}
            {/* "Style with this" — owned-item treatment: brass pill in the
                action row. For wishlist items the same action is presented as
                a discoverable card below, so we skip this button there. */}
            {onStyleWithItem && item.status !== 'wishlist' && isAIEnabled() && (
              <button
                onClick={onStyleWithItem}
                className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-sm transition-all inline-flex items-center gap-2 bg-brass-200 text-stone-900 border border-brass-300 hover:bg-brass-300 font-medium"
                title="Build an AI outfit around this piece"
                aria-label="Style an outfit with this item"
              >
                <Wand2 size={16} strokeWidth={1.5} />
                <span className="text-xs sm:text-sm font-medium">Style with this</span>
              </button>
            )}
            <button
              onClick={onDuplicate}
              className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-500 transition-all inline-flex items-center gap-2"
              title="Duplicate (e.g. same item in a different colour)"
              aria-label="Duplicate item"
            >
              <Copy size={16} strokeWidth={1.5} className="sm:hidden" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-full bg-white border border-stone-200 text-stone-400 hover:border-red-300 hover:text-red-600 transition-all" aria-label="Delete">
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            ) : (
              <>
                <button onClick={onDelete} className="px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm bg-red-600 text-white hover:bg-red-700 transition-all whitespace-nowrap">
                  Delete forever
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm text-stone-500 hover:text-stone-900 transition-all">
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Image column — proper sticky-in-grid pattern:
              - The OUTER div is the grid cell. No sticky on this one.
              - The INNER div is sticky. Its containing block = the outer
                grid cell, which stretches to row height by default
                (lg:items-stretch on the grid). So the inner sticky has
                runway for the entire page scroll.
              - This avoids the conflict between 'self-start for layout'
                vs 'stretch for sticky runway' that broke things before. */}
          <div className="lg:col-span-6">
            <div className="lg:sticky lg:top-[12rem] space-y-3">
            {/* role="button" (not a real <button>) so the cut-out/framed revert
                and "Edit image" overlay controls can be real nested buttons —
                a <button> inside a <button> is invalid HTML. */}
            <div
              ref={photoRef}
              role="button"
              tabIndex={images.length === 0 ? -1 : 0}
              onClick={() => {
                // A swipe just happened — don't open the lightbox.
                if (photoSwipeRef.current.swiped) { photoSwipeRef.current.swiped = false; return; }
                if (images.length > 0) setLightboxOpen(true);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && images.length > 0) { e.preventDefault(); setLightboxOpen(true); }
              }}
              aria-disabled={images.length === 0}
              className={`aspect-[3/4] w-full max-h-[65vh] lg:max-h-[60vh] rounded-2xl lg:rounded-[2rem] overflow-hidden bg-stone-100 smooth-shadow relative group border border-brass-300 ${images.length === 0 ? 'cursor-default' : 'cursor-pointer'}`}
              style={{ touchAction: images.length > 1 ? 'pan-y' : undefined }}
              aria-label={images.length > 1 ? 'Swipe to flip photos, tap to view fullscreen' : 'View photo in fullscreen'}
            >
              {images.length > 0 ? (
                <>
                  {(() => {
                    const idx = Math.min(activePhoto, images.length - 1);
                    const disp = itemImageDisplay(item, idx);
                    return (
                      <div className="w-full h-full bg-white flex items-center justify-center">
                        <img src={disp.src || images[idx]} alt={item.name}
                          className="w-full h-full object-contain transition-transform duration-500 lg:group-hover:scale-[1.02]" />
                      </div>
                    );
                  })()}
                  {item.imageMeta?.[Math.min(activePhoto, images.length - 1)]?.cutoutUrl && (
                    <button type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const nextMeta = revertItemPrimary(item);
                        await onUpdateItem({ ...item, imageMeta: nextMeta });
                        toast.show('Reverted to your original photo', { kind: 'default' });
                      }}
                      className="absolute top-3 right-3 lg:top-4 lg:right-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-700 hover:text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium shadow-sm transition-colors">
                      Cut-out · revert
                    </button>
                  )}
                  {/* Framed · revert — mirrors the cut-out revert control */}
                  {item.imageMeta?.[Math.min(activePhoto, images.length - 1)]?.framedUrl && (
                    <button type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const nextMeta = revertFramePrimary(item);
                        await onUpdateItem({ ...item, imageMeta: nextMeta });
                        toast.show('Reverted to the un-cropped image', { kind: 'default' });
                      }}
                      className="absolute top-3 right-3 lg:top-4 lg:right-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-700 hover:text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium shadow-sm transition-colors mt-9">
                      Framed · revert
                    </button>
                  )}
                  {/* Edit image — opens the manual framer on the primary photo */}
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFramerOpen(true); }}
                    className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-700 hover:text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium shadow-sm transition-colors">
                    Edit image
                  </button>
                  {item.imageMeta?.[Math.min(activePhoto, images.length - 1)]?.angle && (
                    <span className="absolute top-3 left-3 lg:top-4 lg:left-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium">
                      {item.imageMeta[Math.min(activePhoto, images.length - 1)].angle}
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 lg:bottom-4 lg:right-4 px-3 py-1.5 bg-stone-900/70 backdrop-blur-md text-white text-[10px] tracking-widest uppercase rounded-full opacity-80 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                    <Plus size={12} strokeWidth={2} /> Zoom
                  </span>
                  {images.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 lg:hidden">
                      {images.map((_, i) => (
                        <span key={i} className={`block w-1.5 h-1.5 rounded-full transition-all ${
                          i === Math.min(activePhoto, images.length - 1) ? 'bg-white w-4' : 'bg-white/50'
                        }`} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <Shirt size={64} strokeWidth={1} />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActivePhoto(i)}
                    aria-label={`Photo ${i + 1}`}
                    className={`flex-none w-16 aspect-square rounded-lg overflow-hidden border transition-all ${
                      activePhoto === i ? 'border-brass-400 shadow-sm' : 'border-stone-200 opacity-60 hover:opacity-100 hover:border-stone-500'
                    }`}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-8 lg:space-y-6 lg:pt-11">
            <div>
              <p className="text-[11px] font-semibold text-stone-500 tracking-[0.25em] uppercase mb-2">{item.brand}</p>
              <h1 className="text-3xl sm:text-4xl lg:text-4xl font-display text-stone-900 leading-tight">{item.name}</h1>
              <div className="flex items-center gap-4 mt-4 flex-wrap">
                <p className="text-3xl font-display font-medium">£{Number(item.price || 0).toLocaleString()}</p>
                {item.status === 'wishlist' && (
                  <span className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 bg-stone-100 text-stone-900">
                    <Heart size={12} className="fill-stone-900" strokeWidth={0} /> Wishlist
                  </span>
                )}
                {item.status === 'owned' && (
                  <span className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium bg-stone-900 text-white">In Collection</span>
                )}
              </div>
              <div className="mt-4">
                {item.status === 'wishlist' ? (
                  <button onClick={onMarkOwned} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-stone-900 text-white hover:bg-stone-700 transition-all">
                    <CheckCircle2 size={16} strokeWidth={1.5} /> I bought this — move to wardrobe
                  </button>
                ) : (
                  <button onClick={onMarkWishlist} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-500 transition-all">
                    <Heart size={16} strokeWidth={1.5} /> Move back to wishlist
                  </button>
                )}
              </div>
              {item.status === 'wishlist' && item.createdAt && (() => {
                const days = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86_400_000);
                if (days < 30) return null;
                return (
                  <div className="mt-4 bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl p-4 text-sm">
                    <p className="font-medium">On your wishlist for {days} days.</p>
                    <p className="text-orange-800 text-xs mt-1">Still want this? Buy it or remove it — wishlists work best when curated.</p>
                  </div>
                );
              })()}
            </div>

            {item.status === 'owned' && (
              <div className="bg-white border border-stone-200/60 rounded-2xl p-5 lg:p-6 smooth-shadow">
                <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Wear Log</h2>
                  <button onClick={() => setShowHistory((v) => !v)} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors">
                    {showHistory ? 'Hide' : 'History'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-stone-50 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-500">Wears</p>
                    <p className="text-2xl font-display font-medium mt-1">{wears}</p>
                  </div>
                  <div className="bg-stone-50 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-500">Last worn</p>
                    <p className="text-sm font-medium mt-1.5">{formatLastWorn(item)}</p>
                  </div>
                  <div className="bg-stone-900 text-white rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-400">Cost / wear</p>
                    <p className="text-2xl font-display font-medium mt-1">
                      {cpw !== null ? `£${cpw < 10 ? cpw.toFixed(2) : Math.round(cpw)}` : '—'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {/* Date chip — tap to change. Shows what date will be logged. */}
                  {onLogWear && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] tracking-widest uppercase text-stone-400">Logging for</span>
                        <button
                          type="button"
                          onClick={() => setItemLogDateOpen((v) => !v)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors"
                        >
                          <Calendar size={10} strokeWidth={1.75} />
                          {itemLogDate === todayISO() ? 'Today' : new Date(itemLogDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </button>
                      </div>
                    </div>
                  )}
                  {itemLogDateOpen && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setItemLogDate(todayISO()); setItemLogDateOpen(false); }}
                        className="px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase bg-white border border-stone-300 text-stone-700 hover:border-stone-900 transition-colors"
                      >Today</button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() - 1);
                          setItemLogDate(d.toISOString().slice(0, 10));
                          setItemLogDateOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase bg-white border border-stone-300 text-stone-700 hover:border-stone-900 transition-colors"
                      >Yesterday</button>
                      <input
                        type="date"
                        value={itemLogDate}
                        max={todayISO()}
                        onChange={(e) => { if (e.target.value) { setItemLogDate(e.target.value); setItemLogDateOpen(false); } }}
                        className="px-2 py-1 rounded-full text-[10px] tracking-wide bg-white border border-stone-300 text-stone-700 outline-none focus:border-stone-900"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  )}
                  <button onClick={() => !wornOnLogDate && onLogWear(itemLogDate)} disabled={wornOnLogDate}
                    className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                      wornOnLogDate ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                                : 'bg-stone-900 text-white hover:bg-stone-700'
                    }`}>
                    {wornOnLogDate
                      ? <><CheckCircle2 size={16} strokeWidth={1.5} /> {itemLogDate === todayISO() ? 'Logged for today' : `Logged for ${new Date(itemLogDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}</>
                      : <><Calendar size={16} strokeWidth={1.5} /> {itemLogDate === todayISO() ? 'I wore this today' : 'Log this wear'}</>}
                  </button>
                </div>
                {wornToday && onSetWearNote && (
                  <WearVerdictInput
                    initial={itemWearNotes(item)[todayISO()] || ''}
                    onSave={(note) => onSetWearNote(todayISO(), note)}
                    initialOccasion={itemWearOccasions(item)[todayISO()] || ''}
                    onSaveOccasion={onSetWearOccasion ? (occ) => onSetWearOccasion(todayISO(), occ) : undefined}
                  />
                )}
                {(() => {
                  const reminder = itemCareReminder(item);
                  if (!reminder || !reminder.due || !onMarkCared) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-stone-100 flex items-start gap-3 bg-amber-50/60 -mx-3 px-3 py-3 rounded-xl border border-amber-200/60">
                      <Sparkles size={16} className="text-brass-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-brass-800">
                          {reminder.material} care · worn {reminder.wearsSince} {reminder.wearsSince === 1 ? 'time' : 'times'}
                        </p>
                        <p className="text-[11px] text-brass-700/80 mt-0.5 leading-relaxed">Suggested: {reminder.action}.</p>
                      </div>
                      <button onClick={onMarkCared}
                        className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors shrink-0">
                        Done
                      </button>
                    </div>
                  );
                })()}
                {showHistory && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    {itemWearHistory(item).length === 0 ? (
                      <p className="text-xs text-stone-400 italic">No wear history yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {[...itemWearHistory(item)].sort().reverse().map((d) => {
                          const note = itemWearNotes(item)[d];
                          return (
                            <li key={d} className="flex items-start gap-2 group">
                              <button onClick={() => onUnlogWear(d)} className="px-3 py-1.5 bg-stone-100 hover:bg-red-50 hover:text-red-700 text-xs rounded-full text-stone-700 transition-colors shrink-0" title="Click to remove this entry">
                                {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </button>
                              {note && <span className="text-xs text-stone-500 italic leading-relaxed pt-1.5">"{note}"</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {item.lentTo && (() => {
              const overdue = item.lentReturnBy && item.lentReturnBy < todayISO();
              return (
                <div className={`rounded-2xl p-5 border ${overdue ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}>
                  <h2 className={`text-[10px] font-bold tracking-[0.2em] uppercase mb-1 ${overdue ? 'text-red-800' : 'text-stone-500'}`}>
                    {overdue ? 'Overdue · please chase' : 'Lent out'}
                  </h2>
                  <p className="text-sm text-stone-900 mt-2">
                    Currently with <span className="font-medium">{item.lentTo}</span>
                    {item.lentReturnBy && (
                      <span className={`ml-2 ${overdue ? 'text-red-700 font-medium' : 'text-stone-600'}`}>
                        · {overdue ? 'was due' : 'due back'} {new Date(item.lentReturnBy + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </p>
                </div>
              );
            })()}

            {item.status === 'wishlist' && item.wishlistReason && (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Why this is on your wishlist</h2>
                <p className="text-sm text-stone-700 mt-2 italic">"{item.wishlistReason}"</p>
              </div>
            )}

            {item.status === 'owned' && (() => {
              const q = encodeURIComponent([item.brand, item.name].filter(Boolean).join(' '));
              const stale = daysSinceLastWorn(item);
              return (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-2">Resell or donate</h2>
                  <p className="text-xs text-stone-500 leading-relaxed mb-3">
                    {stale === null || stale >= 180
                      ? "Haven't worn it in a while — list it for resale or pass it on."
                      : 'Move it on when you\'re ready.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`https://www.vinted.co.uk/catalog?search_text=${q}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500 hover:text-stone-900">Vinted ↗</a>
                    <a href={`https://www.vestiairecollective.com/search/?q=${q}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500 hover:text-stone-900">Vestiaire ↗</a>
                    <a href={`https://www.ebay.co.uk/sh/lst/active?q=${q}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500 hover:text-stone-900">eBay ↗</a>
                    <a href={`https://www.oxfam.org.uk/shop/donate-clothes/`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500 hover:text-stone-900">Donate (Oxfam) ↗</a>
                  </div>
                </div>
              );
            })()}

            {item.status === 'wishlist' && Array.isArray(item.priceHistory) && item.priceHistory.length > 0 && (() => {
              const history = item.priceHistory;
              const first = history[0]?.price ?? item.price;
              const latest = history[history.length - 1]?.price ?? item.price;
              const peak = Math.max(...history.map((h) => h.price), first, item.price);
              const dropFromPeak = peak > 0 ? Math.round((1 - latest / peak) * 100) : 0;
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold text-emerald-800 tracking-[0.2em] uppercase mb-2">Price watch</h2>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <p className="font-display text-2xl text-stone-900">£{latest}</p>
                    {dropFromPeak >= 5 && (
                      <span className="text-xs tracking-wider uppercase text-emerald-800 font-medium">
                        {dropFromPeak}% off peak (£{peak})
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-2">
                    Tracking since {new Date(history[0].date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} · {history.length} observation{history.length === 1 ? '' : 's'}
                  </p>
                </div>
              );
            })()}

            {item.status === 'wishlist' && (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 lg:p-6 smooth-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={13} strokeWidth={1.5} className="text-brass-500" />
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">The Considered Purchase</h2>
                </div>
                {purchaseVerdict ? (
                  <div className="animate-in fade-in duration-300">
                    <p className="font-display text-2xl lg:text-3xl text-stone-900 leading-tight">{purchaseVerdict.verdictLine}</p>
                    {purchaseVerdict.reasoning && (
                      <p className="text-sm italic text-stone-600 leading-relaxed mt-2">{purchaseVerdict.reasoning}</p>
                    )}
                    <dl className="mt-5">
                      {[
                        ['Outfits unlocked', purchaseVerdict.outfitsUnlocked != null ? `${purchaseVerdict.outfitsUnlocked} new look${purchaseVerdict.outfitsUnlocked === 1 ? '' : 's'} from pieces you own` : null],
                        ['Cost per wear', purchaseVerdict.predictedCostPerWear && purchaseVerdict.predictedCostPerWear !== '—' ? purchaseVerdict.predictedCostPerWear : null],
                        ['You already own', purchaseVerdict.overlaps.length ? purchaseVerdict.overlaps.join(', ') : null],
                        ['Fit', purchaseVerdict.fitNote || null],
                        ['In your wardrobe', purchaseVerdict.gapNote || null],
                      ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 border-t border-stone-100 first:border-t-0">
                          <dt className="text-[10px] tracking-widest uppercase text-stone-400 shrink-0">{label}</dt>
                          <dd className="text-sm text-stone-800 text-right min-w-0 break-words">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-5 flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] tracking-[0.18em] uppercase text-brass-700 font-medium">Hold 72 hours, then decide</span>
                      <button onClick={runPurchaseVerdict} disabled={purchaseVerdictBusy}
                        className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline disabled:opacity-50">
                        {purchaseVerdictBusy ? 'Re-scoring…' : 'Re-score'}
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-400 italic mt-3">Scored against your own wardrobe. The studio advises; the decision is yours.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-stone-600 leading-relaxed mb-3">
                      Before you buy it, ask the studio. Atelier scores this against everything you already own — the new outfits it unlocks, what it duplicates, its likely cost-per-wear — then suggests a pause.
                    </p>
                    <button onClick={runPurchaseVerdict} disabled={purchaseVerdictBusy}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-medium hover:bg-stone-700 transition-colors disabled:opacity-60">
                      <Sparkles size={13} strokeWidth={1.5} className="text-brass-300" />
                      {purchaseVerdictBusy ? 'Scoring…' : 'Is it worth it?'}
                    </button>
                    {purchaseVerdictError && <p className="text-xs text-red-600 mt-2">{purchaseVerdictError}</p>}
                  </>
                )}
              </div>
            )}

            {item.status === 'wishlist' && (
              <FitVerdictSection item={item} measurements={measurements} inspirations={inspirations} onSaveFit={onSaveFit} />
            )}

            {!fit && item.status === 'wishlist' && item.brand && (() => {
              const hasMeasurements = measurements?.chest || measurements?.waist || measurements?.hips;
              const verdictTone = fitEstimate?.verdict === 'true to size' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : fitEstimate?.verdict === 'runs small' ? 'text-orange-700 bg-orange-50 border-orange-200'
                : fitEstimate?.verdict === 'runs large' ? 'text-sky-700 bg-sky-50 border-sky-200'
                : 'text-stone-600 bg-stone-100 border-stone-200';
              return (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={13} strokeWidth={1.5} className="text-brass-500" />
                    <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Will it fit?</h2>
                  </div>
                  {!hasMeasurements ? (
                    <p className="text-sm text-stone-700">Add your <span className="font-medium">chest, waist and hips</span> on the Account tab in Profile, then the Concierge can estimate the fit.</p>
                  ) : fitEstimate ? (
                    <div className="animate-in fade-in duration-300">
                      <span className={`inline-block text-[10px] tracking-widest uppercase font-medium px-2.5 py-1 rounded-full border ${verdictTone}`}>{fitEstimate.verdict}</span>
                      <p className="text-sm text-stone-800 leading-relaxed mt-3">{fitEstimate.recommendation}</p>
                      <div className="flex items-center gap-3 mt-3">
                        {typeof fitEstimate.confidence === 'number' && (
                          <span className="text-[10px] tracking-widest uppercase text-stone-400">{fitEstimate.confidence}% confidence</span>
                        )}
                        <button onClick={runFitEstimate} disabled={fitEstimateBusy}
                          className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline disabled:opacity-50">
                          {fitEstimateBusy ? 'Re-estimating…' : 'Re-estimate'}
                        </button>
                      </div>
                      <p className="text-[10px] text-stone-400 italic mt-3">AI estimate — not a guarantee. Best when you own pieces from this brand.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-stone-600 leading-relaxed mb-3">
                        {ownedSameBrand.length > 0
                          ? <>The Concierge will estimate the fit using your measurements and the <span className="font-medium">{ownedSameBrand.length}</span> {item.brand} piece{ownedSameBrand.length === 1 ? '' : 's'} you already own.</>
                          : <>The Concierge will estimate the fit from your measurements and how {item.brand} typically runs.{!item.size?.trim() && ' Add a size (Edit → Size) for a sharper read.'}</>}
                      </p>
                      <button onClick={runFitEstimate} disabled={fitEstimateBusy}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-white text-xs font-medium hover:bg-stone-700 transition-colors disabled:opacity-60">
                        <Sparkles size={13} strokeWidth={1.5} className="text-brass-300" />
                        {fitEstimateBusy ? 'Asking the Concierge…' : 'Estimate my fit'}
                      </button>
                      {fitEstimateError && <p className="text-xs text-red-600 mt-2">{fitEstimateError}</p>}
                    </>
                  )}
                </div>
              );
            })()}

            {fit && (
              <div className="bg-stone-900 text-white rounded-2xl p-5 lg:p-6">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                  <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400">Fit vs your measurements</h2>
                  <span className="text-xs text-stone-300">{fit.brand} · size {fit.size}</span>
                </div>
                <p className="text-lg font-display font-medium mb-4">{fit.summary}</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[['Bust', fit.deltas.bust], ['Waist', fit.deltas.waist], ['Hips', fit.deltas.hips]].map(([label, d]) => (
                    <div key={label} className="bg-stone-800 rounded-lg p-3">
                      <p className="text-[10px] tracking-widest uppercase text-stone-400">{label}</p>
                      <p className="mt-1 font-medium">
                        {d ? `${d.delta > 0 ? '+' : ''}${d.delta.toFixed(1)}cm` : '—'}
                      </p>
                      {d && <p className={`text-[10px] uppercase tracking-wider mt-0.5 ${d.verdict === 'good' ? 'text-emerald-300' : d.verdict === 'tight' ? 'text-orange-300' : 'text-sky-300'}`}>{d.verdict}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Condition / cleaning state — only meaningful for owned items.
                Wishlist items are pre-purchase; condition doesn't apply. */}
            {item.status === 'owned' && onSetCondition && (() => {
              const current = itemCondition(item);
              return (
                <div>
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-3">Right now</h2>
                  <div className="flex flex-wrap gap-2">
                    {conditionsForCategory(item.category).map((c) => {
                      const active = current === c.key;
                      const ringByColor = {
                        emerald: 'bg-emerald-100 border-emerald-300 text-emerald-800',
                        blue: 'bg-blue-100 border-blue-300 text-blue-800',
                        amber: 'bg-amber-100 border-amber-300 text-amber-800',
                        red: 'bg-red-100 border-red-300 text-red-800',
                      };
                      return (
                        <button key={c.key} onClick={() => onSetCondition(c.key)}
                          className={`text-xs px-3.5 py-2 rounded-full border transition-all ${
                            active ? `${ringByColor[c.color]} font-medium` : 'bg-white border-stone-200 text-stone-600 hover:border-stone-500'
                          }`}>
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                  {current !== 'available' && (
                    <p className="text-[11px] text-stone-500 mt-2 italic">AI styling will skip this piece until it's available again.</p>
                  )}
                </div>
              );
            })()}

            {item.description && (
              <div>
                <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-3">Description</h2>
                <p className="text-stone-700 leading-relaxed whitespace-pre-wrap text-sm">{item.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-6">
              <DetailField label="Category" value={item.category} />
              {item.subCategory && <DetailField label="Sub-type" value={item.subCategory} />}
              {item.size && <DetailField label="Size" value={item.size} />}
              {seasons.length > 0 && <DetailField label="Seasons" value={seasons.join(' · ')} />}
              {itemStyles(item).length > 0 && <DetailField label="Styles" value={itemStyles(item).join(' · ')} />}
              {formattedDate && <DetailField label="Purchased on" value={formattedDate} />}
              {item.purchasedFrom && <DetailField label="Purchased from" value={item.purchasedFrom} />}
              {Array.isArray(item.care) && item.care.length > 0 && <DetailField label="Care" value={item.care.join(' · ')} />}
              {itemMaterials(item).length > 0 && <DetailField label="Materials" value={itemMaterials(item).join(' · ')} />}
              {itemColors(item).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-2">Colours</p>
                  <div className="flex gap-2 flex-wrap">
                    {itemColors(item).map((c) => {
                      const swatch = COLOR_SWATCHES[c];
                      return (
                        <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 rounded-full text-xs">
                          <span className="w-3 h-3 rounded-full border border-stone-300/60"
                            style={swatch?.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }} />
                          {c}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {item.sourceUrl && (
              <div className="pt-6 border-t border-stone-200">
                <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-3">Source</h2>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900 transition-colors break-all"
                >
                  <LinkIcon size={14} strokeWidth={1.5} />
                  {sourceHost || item.sourceUrl}
                </a>
              </div>
            )}

            {/* Shop-around shortcuts — open the item on price-comparison
                surfaces in a new tab. No backend, no API costs; just a
                one-tap path to compare prices yourself. Especially useful
                for wishlist items (find a better deal) and owned items
                (check resale value or replacement cost). */}
            {(item.name || item.brand) && (() => {
              const query = encodeURIComponent(`${item.brand || ''} ${item.name || ''}`.trim());
              const shops = [
                { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${query}`, hint: 'Compare new prices' },
                { label: 'eBay', url: `https://www.ebay.co.uk/sch/?_nkw=${query}`, hint: 'New + pre-loved' },
                { label: 'Vinted', url: `https://www.vinted.co.uk/catalog?search_text=${query}`, hint: 'Second-hand' },
                { label: 'Vestiaire', url: `https://www.vestiairecollective.com/search/?q=${query}`, hint: 'Luxury resale' },
              ];
              return (
                <div className="pt-6 border-t border-stone-200">
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-3">Shop around</h2>
                  <div className="flex flex-wrap gap-2">
                    {shops.map((s) => (
                      <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
                        title={s.hint}
                        className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors">
                        <Search size={12} strokeWidth={1.5} /> {s.label}
                      </a>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-400 italic mt-2">Searches open in a new tab — Atelier doesn't track or compare prices itself.</p>
                </div>
              );
            })()}

            {/* "Style this — see how it works with your wardrobe" — wishlist
                treatment. Shown as a discoverable card rather than just a
                button in the action row, because for a piece you're
                considering buying, knowing whether it fits your wardrobe is
                a primary decision-driver. */}
            {onStyleWithItem && item.status === 'wishlist' && isAIEnabled() && (
              <button
                onClick={onStyleWithItem}
                className="w-full pt-6 border-t border-stone-200 group text-left"
              >
                <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-5 sm:p-6 relative overflow-hidden hover:from-stone-800 hover:to-stone-700 transition-all active:scale-[0.99]">
                  <div className="absolute -right-12 -top-12 opacity-[0.08] rotate-12 pointer-events-none">
                    <Sparkles size={180} strokeWidth={0.8} />
                  </div>
                  <div className="relative z-10 flex items-start gap-4">
                    <span className="shrink-0 w-12 h-12 rounded-2xl bg-brass-300 text-stone-900 flex items-center justify-center">
                      <Wand2 size={22} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-bold mb-1">Before you buy</p>
                      <h3 className="font-display text-xl sm:text-2xl text-white leading-tight">Style this with your wardrobe</h3>
                      <p className="text-xs sm:text-sm text-stone-400 mt-2 leading-relaxed">
                        Atelier will build an outfit around this piece using what you already own — so you can see if it actually fits your style.
                      </p>
                    </div>
                    <ChevronRight size={18} strokeWidth={1.5} className="text-stone-500 shrink-0 group-hover:text-brass-300 transition-colors mt-2" />
                  </div>
                </div>
              </button>
            )}

            <AppearsInSection item={item} outfits={outfits} allItems={allItems} onOpenOutfit={onOpenOutfit} />
            <WearWithSection item={item} allItems={allItems} outfits={outfits} onOpenItem={onOpenItem} />
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <PhotoLightbox
          images={images}
          startIndex={activePhoto}
          alt={item.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      {framerOpen && (
        <ImageFramer
          baseSrc={(item.imageMeta?.[0]?.cutoutUrl) || item.images?.[0]}
          initialFrame={item.imageMeta?.[0]?.frame || undefined}
          onClose={() => setFramerOpen(false)}
          onCommit={async ({ dataUrl, frame }) => {
            const out = await frameItemPrimary(item, uid, dataUrl, frame);
            if (out.ok) {
              await onUpdateItem({ ...item, imageMeta: out.imageMeta });
              toast.show('Image framed ✓', { kind: 'success' });
            } else {
              toast.show('Could not frame this image', { kind: 'error' });
            }
            setFramerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function WearWithSection({ item, allItems, outfits = [], onOpenItem }) {
  const scrollRef = useRef(null);
  if (!allItems?.length) return null;

  // Slots to suggest = OUTFIT_SLOTS minus the slot this item occupies
  const myCategory = item.category;
  const mySlot = slotForItem(item);
  const targetSlots = OUTFIT_SLOTS.filter((s) => s !== mySlot);

  // Mutually-exclusive categories: a dress replaces tops+bottoms, so don't
  // suggest them with a dress — and don't suggest a dress alongside a top or
  // bottom either (you wear separates OR a dress, never both).
  const isDress = myCategory === 'Dresses';
  const isTopOrBottom = myCategory === 'Tops' || myCategory === 'Bottoms';
  const blockedSlots = isDress ? ['Tops', 'Bottoms'] : (isTopOrBottom ? ['Dresses'] : []);
  const filteredSlots = targetSlots.filter((s) => !blockedSlots.includes(s));

  const myStyles = itemStyles(item);
  const mySeasons = itemSeasons(item);
  const myColors = itemColors(item);
  const myBrand = (item.brand || '').trim().toLowerCase();
  const NEUTRAL_SET = new Set(NEUTRAL_COLORS);

  // Build a "co-pair" map: candidate.id → count of saved outfits where this
  // candidate appears together with `item`. Stronger signal than scoring —
  // the user already endorsed this pairing.
  const coPairCounts = new Map();
  for (const o of outfits) {
    const ids = Array.isArray(o.itemIds) ? o.itemIds : (Array.isArray(o.items) ? o.items.map((x) => x.id) : []);
    if (!ids.includes(item.id)) continue;
    for (const id of ids) {
      if (id === item.id) continue;
      coPairCounts.set(id, (coPairCounts.get(id) || 0) + 1);
    }
  }

  const scoreCandidate = (candidate) => {
    let score = 1;
    const reasons = [];

    // Same brand — strong signal: brands ship coordinated collections (a pink
    // Reiss blazer + pink Reiss shorts is almost certainly designed together).
    const cBrand = (candidate.brand || '').trim().toLowerCase();
    if (myBrand && cBrand && myBrand === cBrand) { score += 4; reasons.push('same brand'); }

    // Already paired by the user in a saved outfit — endorse it explicitly.
    const coCount = coPairCounts.get(candidate.id) || 0;
    if (coCount > 0) { score += 3 + Math.min(coCount - 1, 2); reasons.push(coCount === 1 ? 'worn together' : `worn together × ${coCount}`); }

    if (myStyles.length > 0) {
      const cStyles = itemStyles(candidate);
      if (cStyles.length > 0 && cStyles.some((s) => myStyles.includes(s))) { score += 4; reasons.push('same style'); }
      else if (cStyles.length > 0) score -= 3;
    }
    if (mySeasons.length > 0) {
      const cSeasons = itemSeasons(candidate);
      if (cSeasons.length === 0) score += 0.5;
      else if (cSeasons.some((s) => mySeasons.includes(s))) score += 2.5;
      else score -= 2;
    }
    if (myColors.length > 0) {
      const cColors = itemColors(candidate);
      if (cColors.length > 0) {
        const exactShared = cColors.filter((c) => myColors.includes(c) && !NEUTRAL_SET.has(c));
        const harmonises = colorsHarmonize(cColors, myColors);
        if (exactShared.length > 0) {
          // Strong: shares a non-neutral colour → coordinated palette.
          score += 4; reasons.push(`matches ${exactShared[0].toLowerCase()}`);
        } else if (harmonises) {
          score += 2;
        } else {
          score -= 3;
        }
      }
    }
    if (candidate.favorite) score += 1;
    return { score, reasons };
  };

  // Top 2 candidates per slot — keep a stretch suggestion so the user always
  // sees options, not a blank space. Threshold loosened to 1.5 (was 2).
  const suggestions = filteredSlots.flatMap((slot) => {
    const candidates = allItems.filter(
      (c) => c.id !== item.id && itemFitsSlot(c, slot)
    );
    if (candidates.length === 0) return [];
    const scored = candidates
      .map((c) => ({ c, ...scoreCandidate(c) }))
      .filter((x) => x.score >= 1.5)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 2).map((x) => ({ item: x.c, reasons: x.reasons }));
  });

  if (suggestions.length === 0) return null;

  return (
    <div className="pt-6 border-t border-stone-200">
      <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-4">Wear with</h2>
      <div className="relative group/wearwith">
        {/* Desktop scroll arrows — mobile scrolls by swipe, but on desktop the
            hidden scrollbar leaves no affordance, so reveal chevrons on hover
            that nudge the strip one card-cluster at a time. */}
        <button type="button" aria-label="Scroll back"
          onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
          className="hidden lg:flex absolute -left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-stone-200 text-stone-700 hover:text-stone-900 opacity-0 group-hover/wearwith:opacity-100 transition-opacity duration-200">
          <ChevronRight size={18} strokeWidth={1.75} className="rotate-180" />
        </button>
        <button type="button" aria-label="Scroll forward"
          onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
          className="hidden lg:flex absolute -right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-stone-200 text-stone-700 hover:text-stone-900 opacity-0 group-hover/wearwith:opacity-100 transition-opacity duration-200">
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pb-3">
        {suggestions.map(({ item: s, reasons }) => (
          <button key={s.id} onClick={() => onOpenItem?.(s.id)}
            className="flex-none w-28 sm:w-32 text-left group transition-transform active:scale-[0.97]">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 mb-2 relative">
              {itemImages(s)[0] ? (
                <ItemTileImage item={s} alt={s.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={28} strokeWidth={1} /></div>
              )}
              {s.status === 'wishlist' && (
                <span className="absolute top-1.5 left-1.5 text-[8px] tracking-widest uppercase px-1.5 py-0.5 bg-white/90 backdrop-blur text-stone-900 rounded-full font-medium">Wish</span>
              )}
            </div>
            <p className="text-xs font-medium text-stone-900 truncate px-1">{s.name}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider truncate px-1 mt-0.5">{s.brand}</p>
            {reasons?.[0] && (
              <p className="text-[10px] text-brass-600 px-1 mt-0.5 truncate" title={reasons.join(' · ')}>
                {reasons[0]}
              </p>
            )}
          </button>
        ))}
        </div>
      </div>
      <p className="text-[10px] text-stone-400 italic mt-2">Suggested by brand, palette, style, season and what you've already paired.</p>
    </div>
  );
}

// Outfits this item is part of. Useful for "what looks already use this?" —
// click jumps straight to the look. Surfaced above Wear-with so the user sees
// real-history pairings before algorithmic ones.
function AppearsInSection({ item, outfits = [], allItems = [], onOpenOutfit }) {
  const matching = (outfits || []).filter((o) => {
    const ids = Array.isArray(o.itemIds) ? o.itemIds : (Array.isArray(o.items) ? o.items.map((x) => x.id) : []);
    return ids.includes(item.id);
  });
  if (matching.length === 0) return null;

  return (
    <div className="pt-6 border-t border-stone-200">
      <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-4">
        Appears in {matching.length} {matching.length === 1 ? 'look' : 'looks'}
      </h2>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pb-3">
        {matching.map((o) => {
          const pieces = resolveOutfitItems(o, allItems);
          const previews = pieces.slice(0, 4).map((p) => itemImageDisplay(p, 0).src || itemImages(p)[0]).filter(Boolean);
          return (
            <button key={o.id} onClick={() => onOpenOutfit?.(o.id)}
              className="flex-none w-32 sm:w-36 text-left group transition-transform active:scale-[0.97]">
              <div className="aspect-square rounded-xl overflow-hidden bg-stone-100 mb-2 grid grid-cols-2 grid-rows-2 gap-0.5">
                {previews.length === 0 && <div className="col-span-2 row-span-2 flex items-center justify-center text-stone-300"><Shirt size={24} strokeWidth={1} /></div>}
                {previews.map((src, i) => (
                  <div key={i} className={previews.length === 1 ? 'col-span-2 row-span-2' : previews.length === 2 ? 'col-span-1 row-span-2' : (previews.length === 3 && i === 0 ? 'col-span-2 row-span-1' : '')}>
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-stone-900 truncate px-1 group-hover:text-stone-600">{o.name}</p>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider px-1 mt-0.5">{pieces.length} pieces</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">{label}</p>
      <p className="text-sm text-stone-900 font-medium">{value}</p>
    </div>
  );
}

// Tiny in-app photo editor. Rotate (90° steps) + crop to a draggable square.
// Output goes back through compressImageToDataUrl-ish quality control so the
// edited image stays within the Firestore-friendly size budget. No deps.
function PhotoEditorModal({ src, onClose, onSave }) {
  useEscapeKey(onClose);
  const [rotation, setRotation] = useState(0);
  // Crop rect in NATURAL image coords once the image loads, normalized [0,1].
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [drag, setDrag] = useState(null); // { kind: 'move' | corner, startX, startY, startCrop }
  const [imgEl, setImgEl] = useState(null);
  const [busy, setBusy] = useState(false);
  const containerRef = React.useRef(null);

  const handlePointerDown = (e, kind) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    setDrag({ kind, startX, startY, startCrop: { ...crop } });
  };
  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      setCrop((c) => {
        let { x, y, w, h } = drag.startCrop;
        if (drag.kind === 'move') {
          x = Math.max(0, Math.min(1 - w, x + dx));
          y = Math.max(0, Math.min(1 - h, y + dy));
        } else if (drag.kind === 'br') {
          w = Math.max(0.1, Math.min(1 - x, w + dx));
          h = Math.max(0.1, Math.min(1 - y, h + dy));
        } else if (drag.kind === 'tl') {
          const nx = Math.max(0, Math.min(x + w - 0.1, x + dx));
          const ny = Math.max(0, Math.min(y + h - 0.1, y + dy));
          w = w + (x - nx); h = h + (y - ny);
          x = nx; y = ny;
        }
        return { x, y, w, h };
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [drag]);

  const apply = async () => {
    if (!imgEl) return;
    setBusy(true);
    try {
      // Step 1: rotate the source to an offscreen canvas at full size.
      const radians = (rotation * Math.PI) / 180;
      const rotSwapped = rotation % 180 !== 0;
      const rw = rotSwapped ? imgEl.naturalHeight : imgEl.naturalWidth;
      const rh = rotSwapped ? imgEl.naturalWidth : imgEl.naturalHeight;
      const c1 = document.createElement('canvas');
      c1.width = rw; c1.height = rh;
      const ctx1 = c1.getContext('2d');
      ctx1.translate(rw / 2, rh / 2);
      ctx1.rotate(radians);
      ctx1.drawImage(imgEl, -imgEl.naturalWidth / 2, -imgEl.naturalHeight / 2);

      // Step 2: crop relative to the rotated canvas.
      const cx = crop.x * rw, cy = crop.y * rh, cw = crop.w * rw, ch = crop.h * rh;
      const targetMax = 900;
      const scale = Math.min(1, targetMax / Math.max(cw, ch));
      const outW = Math.round(cw * scale), outH = Math.round(ch * scale);
      const c2 = document.createElement('canvas');
      c2.width = outW; c2.height = outH;
      const ctx2 = c2.getContext('2d');
      ctx2.drawImage(c1, cx, cy, cw, ch, 0, 0, outW, outH);

      // Step 3: compress to fit Firestore-friendly budget (~150KB).
      let q = 0.85;
      let out = c2.toDataURL('image/jpeg', q);
      while (out.length > 200_000 && q > 0.4) {
        q -= 0.1;
        out = c2.toDataURL('image/jpeg', q);
      }
      await onSave(out);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-stone-200/60 bg-white shrink-0 pt-safe">
          <h3 className="text-lg font-display text-stone-900">Edit photo</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <div ref={containerRef} className="relative w-full bg-stone-200 rounded-2xl overflow-hidden" style={{ aspectRatio: '1' }}>
            <img src={src} alt="" onLoad={(e) => setImgEl(e.target)}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-transform duration-200"
              style={{ transform: `rotate(${rotation}deg)` }} />
            {/* Crop overlay */}
            <div
              className="absolute border-2 border-amber-300 cursor-move"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-amber-300 rounded-full cursor-nwse-resize"
                onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'tl'); }} />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-300 rounded-full cursor-nwse-resize"
                onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'br'); }} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button type="button" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              className="text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500 inline-flex items-center gap-2">
              ↺ 90°
            </button>
            <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)}
              className="text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500 inline-flex items-center gap-2">
              ↻ 90°
            </button>
            <button type="button" onClick={() => setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })}
              className="text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-500">
              Reset crop
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-2 justify-end pb-safe">
          <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
            Cancel
          </button>
          <button onClick={apply} disabled={busy}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40">
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Closet Sweep: rapid multi-photo capture → background Vision identification
// → batch review/save. The fastest way to digitise an existing wardrobe.
// Each photo runs through identifyItemWithGemini independently; the user can
// take the next photo while the previous is still being analysed.
function ClosetSweepModal({ shops = [], onClose, onBulkSave }) {
  useEscapeKey(onClose);
  const toast = useToast();
  // Drafts: [{ id, dataUrl, status: 'pending'|'done'|'error', result?, error? }]
  const [drafts, setDrafts] = useState([]);
  const [includeMap, setIncludeMap] = useState({});
  const [savingAll, setSavingAll] = useState(false);
  const knownBrands = useMemo(
    () => Array.from(new Set((shops || []).map((s) => s.name).filter(Boolean))),
    [shops]
  );

  const captureFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    // Add as pending immediately so the UI updates.
    const next = await Promise.all(files.map(async (f) => {
      const dataUrl = await compressImageToDataUrl(f, { maxWidth: 1100, maxBytes: 280_000, enhance: false });
      return { id: newId(), dataUrl, status: 'pending' };
    }));
    setDrafts((prev) => [...prev, ...next]);
    setIncludeMap((prev) => ({ ...prev, ...Object.fromEntries(next.map((n) => [n.id, true])) }));
    // Identify in parallel (Gemini Flash is happy with concurrent reqs at this volume).
    next.forEach(async (d) => {
      try {
        const result = await identifyItemWithGemini({ imageDataUrl: d.dataUrl, knownBrands });
        setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, status: 'done', result } : x));
      } catch (e) {
        setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, status: 'error', error: e?.message || 'failed' } : x));
      }
    });
  };

  const onPick = (e) => captureFiles(e.target.files);
  const updateField = (id, field, value) => {
    setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, result: { ...d.result, [field]: value } } : d));
  };
  const includedCount = drafts.filter((d) => d.status === 'done' && includeMap[d.id]).length;
  const pendingCount = drafts.filter((d) => d.status === 'pending').length;

  const saveAll = async () => {
    setSavingAll(true);
    try {
      const newItems = drafts
        .filter((d) => d.status === 'done' && includeMap[d.id])
        .map((d) => {
          const r = d.result || {};
          const validMaterials = (r.materials || []).filter((m) => MATERIALS.includes(m));
          const validColours = (r.colors || []).map((c) => matchColorFamily(c)).filter(Boolean);
          const validStyles = (r.styles || []).filter((s) => STYLES.includes(s));
          const validSeasons = (r.seasons || []).filter((s) => ['Spring', 'Summer', 'Autumn', 'Winter'].includes(s));
          return {
            id: newId(),
            name: r.name || 'Untitled piece',
            brand: r.brand || '',
            price: 0,
            category: r.category || 'Tops',
            subCategory: r.subCategory || '',
            status: 'owned',
            seasons: validSeasons,
            styles: validStyles,
            care: [],
            colors: validColours,
            materials: validMaterials,
            images: [d.dataUrl],
            imageMeta: [{ cutout: false }],
            description: r.description || '',
            sourceUrl: '',
            createdAt: new Date().toISOString(),
          };
        });
      if (newItems.length === 0) { setSavingAll(false); return; }
      await onBulkSave(newItems);
      toast.show(`Added ${newItems.length} item${newItems.length === 1 ? '' : 's'} from sweep`, { kind: 'success' });
    } catch (e) {
      toast.show(e?.message || 'Save failed', { kind: 'error' });
      setSavingAll(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-5 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0 pt-safe">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Closet sweep</p>
            <h3 className="text-xl sm:text-2xl font-display text-stone-900 mt-1">Snap many · save all</h3>
            <p className="text-stone-500 text-xs mt-1">Take a photo of each piece. AI identifies in the background.</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-4">
          <label className="block w-full bg-stone-900 text-white py-4 rounded-2xl text-center cursor-pointer hover:bg-stone-700 transition-colors">
            <span className="text-sm font-medium flex items-center justify-center gap-2">
              <Camera size={16} strokeWidth={1.5} /> {drafts.length === 0 ? 'Start sweep · take a photo' : 'Take another'}
            </span>
            <input type="file" accept="image/*" capture="environment" multiple onChange={onPick} className="hidden" />
          </label>

          {drafts.length > 0 && (
            <div className="flex items-center justify-between text-[10px] tracking-widest uppercase text-stone-500">
              <span>{drafts.length} captured · {includedCount} ready · {pendingCount} analysing</span>
            </div>
          )}

          {drafts.length === 0 && (
            <p className="text-stone-500 text-sm italic text-center py-8">
              Tip: stand in front of your wardrobe, take a photo per piece. Each one becomes a draft ready to save.
            </p>
          )}

          <div className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className={`p-3 rounded-xl border transition-all flex gap-3 ${
                d.status === 'error' ? 'bg-red-50 border-red-200'
                : d.status === 'pending' ? 'bg-white border-stone-200'
                : includeMap[d.id] ? 'bg-white border-stone-200'
                : 'bg-stone-50 border-stone-100 opacity-60'
              }`}>
                <input type="checkbox" disabled={d.status !== 'done'}
                  checked={!!includeMap[d.id]} onChange={() => setIncludeMap((p) => ({ ...p, [d.id]: !p[d.id] }))}
                  className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0 self-center" />
                <div className="w-14 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  <img src={d.dataUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  {d.status === 'pending' && (
                    <div className="flex items-center gap-2 text-xs text-stone-500 h-full">
                      <div className="w-3 h-3 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
                      Analysing…
                    </div>
                  )}
                  {d.status === 'error' && (
                    <p className="text-xs text-red-700">Couldn't identify · {d.error}. <button type="button" onClick={() => setDrafts((p) => p.filter((x) => x.id !== d.id))} className="underline">remove</button></p>
                  )}
                  {d.status === 'done' && d.result && (
                    <>
                      <input value={d.result.name || ''} onChange={(e) => updateField(d.id, 'name', e.target.value)}
                        type="text" placeholder="Name"
                        className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded text-sm focus:border-stone-900 outline-none mb-1" />
                      <div className="flex items-center gap-2">
                        <input value={d.result.brand || ''} onChange={(e) => updateField(d.id, 'brand', e.target.value)}
                          type="text" placeholder="Brand"
                          className="flex-1 min-w-0 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-[11px] tracking-wider uppercase focus:border-stone-900 outline-none" />
                        <select value={d.result.category || 'Tops'} onChange={(e) => updateField(d.id, 'category', e.target.value)}
                          className="px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs focus:border-stone-900 outline-none">
                          {['Tops','Bottoms','Dresses','Outerwear','Sportswear','Swimwear','Shoes','Bags','Accessories','Jewellery'].map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        {(d.result.colors || []).slice(0, 3).join(' · ')}
                        {d.result.confidence != null && <span className="ml-2">{d.result.confidence}/100</span>}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {drafts.length > 0 && (
          <div className="px-5 sm:px-6 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-3 justify-end pb-safe">
            <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
              Cancel
            </button>
            <button onClick={saveAll} disabled={includedCount === 0 || savingAll}
              className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40">
              {savingAll ? 'Saving…' : `Save ${includedCount} item${includedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Bulk URL importer + brand-aware web search. Two paths in one modal:
//   1. SEARCH: type a query → buttons open each brand's own search page (or
//      Google site-restricted as fallback). User clicks through, copies the
//      product URL back into the textarea below.
//   2. PASTE: drop multiple product URLs (one per line) → parallel-fetch via
//      the existing link-import pipeline → review/edit/save in one batch.
// This is the lowest-friction route from "I own this Reiss thing" to "it's in
// my wardrobe with photo, price, brand, description filled in."
function BulkImportModal({ shops = [], onClose, onBulkSave }) {
  useEscapeKey(onClose);
  const [query, setQuery] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [stage, setStage] = useState('input'); // input | fetching | review | saving
  const [fetched, setFetched] = useState([]); // [{ url, ok, data | error }]
  const [include, setInclude] = useState({});
  const [status, setStatus] = useState('owned');
  const [size, setSize] = useState('');
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const toast = useToast();

  const sortedShops = [...shops].filter((s) => s.website).slice(0, 16);

  const parseUrls = (text) =>
    Array.from(new Set(
      (text || '')
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s))
    ));

  const fetchAll = async () => {
    const urls = parseUrls(urlsText);
    if (urls.length === 0) { setError('Paste at least one URL.'); return; }
    if (urls.length > 25) { setError('Up to 25 URLs at a time.'); return; }
    setStage('fetching'); setError(null);
    setProgress({ done: 0, total: urls.length });
    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      try {
        const data = await fetchProductFromUrl(u);
        results.push({ url: u, ok: true, data });
      } catch (e) {
        results.push({ url: u, ok: false, error: e?.message || 'Fetch failed' });
      }
      setProgress({ done: i + 1, total: urls.length });
    }
    setFetched(results);
    setInclude(Object.fromEntries(results.map((r, i) => [i, r.ok])));
    setStage('review');
  };

  const updateField = (i, field, value) => {
    setFetched((prev) => prev.map((r, idx) => idx === i ? { ...r, data: { ...r.data, [field]: value } } : r));
  };

  const includedCount = fetched.filter((_, i) => include[i]).length;

  const saveAll = async () => {
    setStage('saving');
    const newItems = fetched
      .filter((r, i) => include[i] && r.ok)
      .map((r) => ({
        id: newId(),
        name: r.data.name || '',
        brand: r.data.brand || '',
        price: Number(r.data.price) || 0,
        category: 'Tops',
        subCategory: '',
        status,
        size: size || '',
        purchasedDate: status === 'owned' ? todayISO() : '',
        purchasedFrom: r.data.brand || '',
        seasons: [], styles: [], care: [], colors: [], materials: [],
        images: r.data.imageUrl ? [r.data.imageUrl] : [],
        description: r.data.description || '',
        sourceUrl: r.data.sourceUrl || '',
        createdAt: new Date().toISOString(),
      }));
    if (newItems.length === 0) { setStage('review'); return; }
    try {
      await onBulkSave(newItems);
      toast.show(`Imported ${newItems.length} item${newItems.length === 1 ? '' : 's'} · category set to Tops by default — edit each from the wardrobe`, { kind: 'success', duration: 6000 });
    } catch (e) {
      setError(e?.message || 'Save failed');
      setStage('review');
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-5 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0 pt-safe">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Bulk import</p>
            <h3 className="text-xl sm:text-2xl font-display text-stone-900 mt-1">Find & import many at once</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {stage === 'input' && (
            <>
              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
                <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">1 · Find it</p>
                <p className="text-stone-600 text-sm leading-relaxed mb-3">
                  Type what you're looking for, then tap a brand below to open their search. Copy the product URL when you find it, then paste below.
                </p>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="search"
                  placeholder="e.g. pink shorts, navy blazer, white sandals…"
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:border-stone-900 outline-none"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {sortedShops.map((s) => (
                    <a key={s.id || s.name}
                      href={brandSearchUrl(s.website, query || ' ')}
                      target="_blank" rel="noopener noreferrer"
                      className={`text-xs tracking-wider uppercase px-3 py-1.5 rounded-full border transition-colors ${
                        query.trim() ? 'bg-white border-stone-200 text-stone-700 hover:border-stone-500 hover:text-stone-900' : 'bg-stone-50 border-stone-100 text-stone-300 cursor-not-allowed pointer-events-none'
                      }`}>
                      {s.name} ↗
                    </a>
                  ))}
                  <a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`}
                    target="_blank" rel="noopener noreferrer"
                    className={`text-xs tracking-wider uppercase px-3 py-1.5 rounded-full border transition-colors ${
                      query.trim() ? 'bg-stone-900 border-stone-900 text-white hover:bg-stone-700' : 'bg-stone-50 border-stone-100 text-stone-300 cursor-not-allowed pointer-events-none'
                    }`}>
                    Google Shopping ↗
                  </a>
                </div>
                {sortedShops.length === 0 && (
                  <p className="text-[11px] text-stone-400 mt-3 italic">Add some brands in Profile → Shops to surface them here.</p>
                )}
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
                <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">2 · Paste URLs</p>
                <p className="text-stone-600 text-sm leading-relaxed mb-3">
                  One per line. Up to 25 at a time. Each one gets parsed for brand, name, price, image, and description automatically.
                </p>
                <textarea
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  rows={6}
                  placeholder={`https://www.reiss.com/...\nhttps://www.cos.com/...\nhttps://hollandcooper.com/...`}
                  className="w-full px-3 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono leading-relaxed focus:bg-white focus:border-stone-900 outline-none"
                />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-1">Default status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:border-stone-900 outline-none">
                      <option value="owned">Owned</option>
                      <option value="wishlist">Wishlist</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-1">Default size <span className="font-normal normal-case tracking-normal text-stone-400">(optional)</span></label>
                    <input value={size} onChange={(e) => setSize(e.target.value)} type="text"
                      placeholder="e.g. 10, M, 38"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:border-stone-900 outline-none" />
                  </div>
                </div>
                {error && <p className="text-xs text-red-700 mt-3">{error}</p>}
                <button onClick={fetchAll} disabled={!parseUrls(urlsText).length}
                  className="w-full mt-4 bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <LinkIcon size={16} strokeWidth={1.5} /> Fetch {parseUrls(urlsText).length || ''} item{parseUrls(urlsText).length === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}

          {stage === 'fetching' && (
            <div className="flex flex-col items-center gap-4 py-16 text-stone-500 text-sm">
              <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
              <p>Fetching {progress.done} / {progress.total}…</p>
              <div className="w-64 h-1 bg-stone-200 rounded-full overflow-hidden">
                <div className="h-full bg-stone-900 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {stage === 'review' && (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h4 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Review · {includedCount} of {fetched.length} selected</h4>
                <button type="button" onClick={() => { setStage('input'); setFetched([]); }}
                  className="text-[10px] tracking-wider uppercase text-stone-500 hover:text-stone-900">← Back</button>
              </div>
              <div className="space-y-2">
                {fetched.map((r, i) => (
                  <div key={i} className={`p-3 rounded-xl border transition-all ${
                    !r.ok ? 'bg-red-50 border-red-200'
                    : include[i] ? 'bg-white border-stone-200'
                    : 'bg-stone-50 border-stone-100 opacity-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" disabled={!r.ok}
                        checked={!!include[i]} onChange={() => setInclude((p) => ({ ...p, [i]: !p[i] }))}
                        className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0" />
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 flex items-center justify-center">
                        {r.ok && r.data.imageUrl
                          ? <img src={r.data.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          : <Shirt size={16} strokeWidth={1} className="text-stone-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {r.ok ? (
                          <>
                            <input value={r.data.name || ''} onChange={(e) => updateField(i, 'name', e.target.value)} type="text"
                              placeholder="Product name"
                              className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded text-sm focus:border-stone-900 outline-none mb-1" />
                            <div className="flex items-center gap-2">
                              <input value={r.data.brand || ''} onChange={(e) => updateField(i, 'brand', e.target.value)} type="text"
                                placeholder="Brand"
                                className="flex-1 min-w-0 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-[11px] tracking-wider uppercase focus:border-stone-900 outline-none" />
                              <span className="text-stone-400 text-xs">£</span>
                              <input value={r.data.price || ''} onChange={(e) => updateField(i, 'price', e.target.value)} type="text"
                                className="w-16 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs focus:border-stone-900 outline-none" />
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-red-800 truncate">{r.url}</p>
                            <p className="text-[10px] text-red-700 mt-0.5">{r.error}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {error && <p className="text-xs text-red-700 mt-3">{error}</p>}
            </div>
          )}

          {stage === 'saving' && (
            <div className="flex items-center justify-center gap-3 py-16 text-stone-500 text-sm">
              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
              Saving {includedCount} item{includedCount === 1 ? '' : 's'}…
            </div>
          )}
        </div>

        {stage === 'review' && (
          <div className="px-5 sm:px-6 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-3 justify-end pb-safe">
            <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
              Cancel
            </button>
            <button onClick={saveAll} disabled={includedCount === 0}
              className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40">
              Save {includedCount} item{includedCount === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function ReceiptImportModal({ onClose, onBulkSave }) {
  useEscapeKey(onClose);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [include, setInclude] = useState({}); // index → bool
  const [brand, setBrand] = useState('');
  const [purchasedDate, setPurchasedDate] = useState('');
  const [purchasedFrom, setPurchasedFrom] = useState('');
  const [status, setStatus] = useState('owned');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const acceptParsed = (result) => {
    setParsed(result);
    setBrand(result.brand || '');
    setPurchasedDate(result.purchasedDate || todayISO());
    setPurchasedFrom(result.purchasedFrom || result.brand || '');
    setInclude(Object.fromEntries(result.items.map((_, i) => [i, true])));
  };

  const handleParse = () => {
    setError(null);
    const result = parseReceiptText(text);
    if (result.items.length === 0) {
      setError('No items detected. Try pasting more of the email, or use Manual Entry.');
      setParsed(null);
      return;
    }
    acceptParsed(result);
  };

  const handleImageFile = async (file) => {
    if (!file) return;
    if (!isAIEnabled()) {
      setError('Image receipts need the Concierge configured — add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic to .env.local.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 1400, maxBytes: 600_000, enhance: false });
      const result = await analyzeReceiptImageWithGemini({ imageDataUrl: dataUrl });
      acceptParsed(result);
    } catch (e) {
      setError(e?.message || 'Could not read this image.');
    } finally {
      setBusy(false);
    }
  };
  const handleImageInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleImageFile(f);
  };

  useEffect(() => {
    const onPaste = (e) => {
      if (parsed) return;
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type?.startsWith('image/'));
      if (!item) return;
      const f = item.getAsFile();
      if (f) { e.preventDefault(); handleImageFile(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [parsed]);

  const toggleItem = (i) => setInclude((p) => ({ ...p, [i]: !p[i] }));
  const updateItem = (i, field, value) => setParsed((p) => ({
    ...p,
    items: p.items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)),
  }));

  const includedCount = parsed ? parsed.items.filter((_, i) => include[i]).length : 0;

  const [enrichBusyIdx, setEnrichBusyIdx] = useState(null);
  const enrichOne = async (i) => {
    const it = parsed?.items?.[i];
    if (!it?.sourceUrl) return;
    setEnrichBusyIdx(i); setError(null);
    try {
      const data = await fetchProductFromUrl(it.sourceUrl);
      setParsed((p) => ({
        ...p,
        items: p.items.map((row, idx) => idx === i ? {
          ...row,
          name: row.name || data.name || '',
          imageUrl: data.imageUrl || row.imageUrl || '',
          description: row.description || data.description || '',
          price: row.price || (data.price ? parseFloat(data.price) : row.price) || 0,
        } : row),
      }));
    } catch (e) {
      setError(`Couldn't fetch image for "${it.name}": ${e?.message || 'failed'}`);
    } finally {
      setEnrichBusyIdx(null);
    }
  };
  const enrichAll = async () => {
    if (!parsed) return;
    for (let i = 0; i < parsed.items.length; i++) {
      if (!include[i]) continue;
      const it = parsed.items[i];
      if (it.imageUrl || !it.sourceUrl) continue;
      await enrichOne(i);
    }
  };
  const searchUrlFor = (it) => {
    const q = encodeURIComponent([brand || it.brand || '', it.name].filter(Boolean).join(' '));
    return `https://www.google.com/search?tbm=shop&q=${q}`;
  };

  const handleSaveAll = async () => {
    if (!parsed || includedCount === 0) return;
    setBusy(true);
    try {
      const newItems = parsed.items
        .filter((_, i) => include[i])
        .map((it) => ({
          id: newId(),
          name: it.name,
          brand: brand || it.brand || '',
          price: Number(it.price) || 0,
          category: 'Tops', // default — user can edit later from detail view
          subCategory: '',
          status,
          purchasedDate: status === 'owned' ? purchasedDate : '',
          purchasedFrom: status === 'owned' ? purchasedFrom : '',
          seasons: [],
          styles: [],
          images: it.imageUrl ? [it.imageUrl] : [],
          colors: [],
          care: [],
          size: '',
          description: it.description || '',
          sourceUrl: it.sourceUrl || '',
          createdAt: new Date().toISOString(),
        }));
      await onBulkSave(newItems);
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Paste a receipt</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {!parsed && (
            <>
              <p className="text-stone-500 text-sm leading-relaxed">
                Two ways: paste the order email text below, or drop in a screenshot of the order confirmation page. Atelier extracts brand, items, prices, and purchase date — you'll review each one before saving.
              </p>

              <label className="block w-full p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-500 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                    {busy ? <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" /> : <Camera size={20} strokeWidth={1.5} className="text-stone-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-stone-900">{busy ? 'Reading receipt…' : 'Upload or paste a screenshot'}</p>
                    <p className="text-[10px] text-stone-400 mt-1 tracking-wider uppercase">Order confirmation pages, app screenshots, photos of paper receipts</p>
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handleImageInput} className="hidden" disabled={busy} />
              </label>

              <div className="flex items-center gap-3 text-[10px] tracking-widest uppercase text-stone-400">
                <span className="flex-1 h-px bg-stone-200" /> Or paste text <span className="flex-1 h-px bg-stone-200" />
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the entire receipt or order confirmation email here…"
                rows={8}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors font-mono leading-relaxed"
                disabled={busy}
              />
              {error && <p className="text-xs text-red-700">{error}</p>}
              <button onClick={handleParse} disabled={!text.trim() || busy}
                className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-700 transition-colors shadow-lg disabled:opacity-50">
                Parse text receipt
              </button>
            </>
          )}

          {parsed && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Brand</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} type="text"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased on</label>
                  <input value={purchasedDate} onChange={(e) => setPurchasedDate(e.target.value)} type="date"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased from</label>
                  <input value={purchasedFrom} onChange={(e) => setPurchasedFrom(e.target.value)} type="text"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Status</label>
                  <div className="flex gap-2">
                    {['owned', 'wishlist'].map((s) => (
                      <button key={s} onClick={() => setStatus(s)}
                        className={`flex-1 py-3 rounded-xl text-sm capitalize transition-all border ${
                          status === s ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600'
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Detected items</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500">{includedCount} of {parsed.items.length} selected</span>
                    <button
                      type="button"
                      onClick={enrichAll}
                      disabled={enrichBusyIdx !== null || parsed.items.every((it, i) => !include[i] || !it.sourceUrl || it.imageUrl)}
                      className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      {enrichBusyIdx !== null ? `Fetching ${enrichBusyIdx + 1}/${parsed.items.length}…` : 'Fetch all images'}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                  {parsed.items.map((it, i) => (
                    <div key={i} className={`p-3 rounded-xl border transition-all ${
                      include[i] ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100 opacity-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={!!include[i]} onChange={() => toggleItem(i)}
                          className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0" />
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 flex items-center justify-center">
                          {it.imageUrl
                            ? <img src={it.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            : <Shirt size={16} strokeWidth={1} className="text-stone-300" />}
                        </div>
                        <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} type="text"
                          className="flex-1 min-w-0 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none" />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-stone-400 text-sm">£</span>
                          <input value={it.price} onChange={(e) => updateItem(i, 'price', parseFloat(e.target.value) || 0)} type="number" step="0.01"
                            className="w-20 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none" />
                        </div>
                      </div>
                      {include[i] && (
                        <div className="flex items-center gap-2 mt-2 pl-7">
                          <input
                            value={it.sourceUrl || ''}
                            onChange={(e) => updateItem(i, 'sourceUrl', e.target.value.trim())}
                            type="url"
                            placeholder="Paste product URL for auto-image…"
                            className="flex-1 min-w-0 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:border-stone-900 outline-none placeholder:text-stone-400"
                          />
                          {it.sourceUrl ? (
                            <button
                              type="button"
                              onClick={() => enrichOne(i)}
                              disabled={enrichBusyIdx !== null}
                              className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40 shrink-0">
                              {enrichBusyIdx === i ? '…' : 'Fetch'}
                            </button>
                          ) : (
                            <a
                              href={searchUrlFor(it)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 transition-colors shrink-0">
                              Find on web ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-700">{error}</p>}

              <div className="flex gap-2">
                <button onClick={() => { setParsed(null); setError(null); }}
                  className="px-5 py-3 rounded-xl text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-500 transition-colors">
                  Back
                </button>
                <button onClick={handleSaveAll} disabled={busy || includedCount === 0}
                  className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-700 transition-colors shadow-lg disabled:opacity-50">
                  {busy ? 'Saving…' : `Save ${includedCount} item${includedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// Sortable lookbook card. Extracted as a standalone component because
// useSortable is a hook — can't be called inside a .map() callback. Each
// card instance gets its own sortable handle + transform.
// HERO TREATMENT: the first card (index 0 of the user's arranged order)
// renders at md:col-span-2 with a wider landscape aspect — the
// magazine-cover position. As the user reorders, the cover changes; their
// arrangement IS the curation. The drag handle only appears on hover so
// the card body stays calmly clickable for the open-detail flow.


// ---------------------------------------------------------------------------
// TripDetailView — full-screen portal showing day-by-day outfits for a trip
// ---------------------------------------------------------------------------


function AddInspirationModal({ onClose, onSave }) {
  useEscapeKey(onClose);
  const [step, setStep] = useState('choose'); // choose | url | preview
  const [linkInput, setLinkInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ image: '', caption: '', sourceUrl: '', notes: '' });

  // Ctrl+V to paste an image (desktop power-user shortcut)
  useEffect(() => {
    const onPaste = async (e) => {
      if (step === 'preview') return; // don't intercept on the review step
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type?.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      e.preventDefault();
      setBusy(true); setError(null);
      try {
        const dataUrl = await compressImageToDataUrl(file, { maxWidth: 900, maxBytes: 200_000, enhance: false });
        setData({ image: dataUrl, caption: '', sourceUrl: '', notes: '' });
        setStep('preview');
      } catch (err) {
        setError(err?.message || 'Could not paste image.');
      } finally {
        setBusy(false);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [step]);

  const handleFromUrl = async (e) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    setBusy(true); setError(null);
    try {
      const meta = await fetchProductFromUrl(linkInput);
      if (!meta.imageUrl) throw new Error('No image found at that URL.');
      // If imageUrl is already a data URL from the proxy, use it; otherwise try to compress
      let image = meta.imageUrl;
      if (!image.startsWith('data:')) {
        const compressed = await imageUrlToCompressedDataUrl(image);
        if (compressed) image = compressed;
      }
      setData({ image, caption: meta.name || '', sourceUrl: meta.sourceUrl || linkInput, notes: '' });
      setStep('preview');
    } catch (err) {
      setError(err?.message || 'Could not load that link.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 900, maxBytes: 200_000, enhance: false });
      setData({ image: dataUrl, caption: '', sourceUrl: '', notes: '' });
      setStep('preview');
    } catch (err) {
      setError(err?.message || 'Could not load that image.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave({
        id: newId(),
        image: data.image,
        caption: data.caption.trim(),
        sourceUrl: data.sourceUrl.trim(),
        notes: data.notes.trim(),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err?.message || 'Save failed.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Save inspiration</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
          {step === 'choose' && (
            <>
              <p className="text-stone-500 text-sm leading-relaxed">
                Save looks you love from anywhere — Pinterest, Instagram, magazine sites, or your camera roll. Later you can have the Concierge analyse the look and find matches in your wardrobe.
              </p>
              <form onSubmit={handleFromUrl} className="space-y-3">
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase">Import via URL</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon size={18} className="text-stone-400" strokeWidth={1.5} />
                  </div>
                  <input type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Paste a Pinterest / Instagram / blog URL"
                    className="block w-full pl-12 pr-32 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm" required />
                  <button type="submit" disabled={busy} className="absolute right-2 top-2 bottom-2 bg-stone-900 text-white px-6 rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50">
                    {busy ? 'Loading…' : 'Fetch'}
                  </button>
                </div>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="flex-shrink-0 mx-4 text-stone-400 text-xs tracking-widest uppercase">Or</span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              <label className="block w-full p-8 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-500 transition-all text-center">
                <Camera size={28} strokeWidth={1} className="mx-auto mb-3 text-stone-900" />
                <p className="font-medium text-sm text-stone-900">Upload an image</p>
                <p className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase">From camera roll or screenshot</p>
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>

              <p className="text-[10px] text-stone-400 tracking-wide text-center">
                Tip: copy an image and press <span className="font-medium text-stone-600">Ctrl+V</span> anywhere in this dialog to paste it in.
              </p>

              {error && <p className="text-xs text-red-700">{error}</p>}
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-stone-100 smooth-shadow max-w-xs mx-auto">
                {data.image && <img src={data.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </div>
              <Input label="Caption / Title (optional)" value={data.caption} onChange={(e) => setData({ ...data, caption: e.target.value })} type="text" placeholder="e.g. Neutral autumn layers" />
              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Notes (optional)</label>
                <textarea value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} rows={3}
                  placeholder="What you love about this look, where you saw it, etc."
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors resize-y" />
              </div>
              {error && <p className="text-xs text-red-700">{error}</p>}
            </>
          )}
        </div>

        {step === 'preview' && (
          <div className="px-4 sm:px-6 py-4 border-t border-stone-200/60 bg-white/95 backdrop-blur shrink-0 flex gap-2"
               style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
            <button onClick={() => setStep('choose')} className="px-4 py-3 rounded-xl text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-500 transition-colors">
              Back
            </button>
            <button onClick={handleSave} disabled={busy || !data.image}
              className="flex-1 bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50">
              {busy ? 'Saving…' : 'Save inspiration'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function InspirationDetailView({ inspiration, items = [], shops = [], onClose, onAnalyze, onDelete, onOpenItem, onRecreateLook, onAddMissingToWishlist, onSaveAsWishlist }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);
  const [paletteColors, setPaletteColors] = useState(() => {
    // Synchronous initial: derive from analysis if available so the palette
    // is visible before any async work.
    const garmentList = inspiration?.analysis?.garments;
    if (Array.isArray(garmentList)) return derivePaletteFromGarments(garmentList);
    return [];
  });
  const toast = useToast();

  // Build a garment-to-wardrobe-item map from the new garments array.
  // Falls back to the legacy wardrobeMatchIds shape for analyses run before
  // the garment-per-item schema existed.
  const garments = inspiration.analysis?.garments || [];
  const matchedItemById = useMemo(() => {
    const map = {};
    for (const g of garments) {
      if (g.matchedItemId) {
        const item = items.find((i) => i.id === g.matchedItemId);
        if (item) map[g.matchedItemId] = item;
      }
    }
    return map;
  }, [garments, items]);

  // Preferred path: derive palette from Vision-identified garment colours.
  // These are semantically correct (Gemini names the actual garment colour,
  // not the backdrop) so "soft pink + denim" → Pink, Blue rather than the
  // Tan/Orange that pixel sampling returned.
  //
  // Fallback: unanalysed inspirations — pixel-sample the image so the palette
  // section isn't empty before the user analyses. Once analysed, the garment-
  // derived palette takes over and updates immediately when refreshed.
  useEffect(() => {
    const garmentList = inspiration?.analysis?.garments;
    if (Array.isArray(garmentList) && garmentList.length > 0) {
      setPaletteColors(derivePaletteFromGarments(garmentList));
      return;
    }
    // Fallback: pixel sampling for unanalysed inspirations.
    let cancelled = false;
    if (inspiration?.image) {
      extractDominantColors(inspiration.image, 5).then((colors) => {
        if (!cancelled) setPaletteColors(colors || []);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [inspiration?.id, inspiration?.analysis]);

  const shopHosts = useMemo(() => shops.map((s) => {
    try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return null; }
  }).filter(Boolean), [shops]);

  const googleShopUrl = (piece) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(piece)}`;
  const yourShopsUrl = (piece) => shopHosts.length > 0
    ? `https://www.google.com/search?q=${encodeURIComponent(piece + ' (' + shopHosts.map((h) => `site:${h}`).join(' OR ') + ')')}`
    : null;

  const ANALYSE_STAGES = [
    'Examining the photograph…',
    'Identifying each garment…',
    'Reading colour and silhouette…',
    'Searching your wardrobe for matches…',
    'Noting what\'s missing…',
    'Almost there…',
  ];

  const handleAnalyze = async () => {
    setAnalyzing(true); setError(null);
    setAnalyzeStage(ANALYSE_STAGES[0]);
    let i = 0;
    const t = setInterval(() => { i = Math.min(i + 1, ANALYSE_STAGES.length - 1); setAnalyzeStage(ANALYSE_STAGES[i]); }, 1200);
    try { await onAnalyze(); }
    catch (err) { setError(err?.message || 'Analysis failed.'); toast.show(err?.message || 'Analysis failed', { kind: 'error', duration: 4000 }); }
    finally { clearInterval(t); setAnalyzing(false); setAnalyzeStage(''); }
  };

  const hasAnalysis = !!inspiration.analysis;
  const hasMatches = garments.some((g) => g.matchedItemId && matchedItemById[g.matchedItemId]);
  const recreateable = hasMatches && !!onRecreateLook;

  return createPortal(
    <div className="fixed inset-0 bg-[#F7F5F2] z-50 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      {/* ─── TOP NAV ─── */}
      <div className="sticky top-0 z-10 bg-[#F7F5F2]/80 backdrop-blur-md border-b border-stone-200/60 pt-safe">
        <div className="max-w-7xl mx-auto flex justify-between items-center p-3 sm:p-4 lg:p-6">
          <button onClick={onClose} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 transition-colors">
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
            <span className="hidden sm:inline">Back to Inspiration</span>
            <span className="sm:hidden">Back</span>
          </button>
          {!confirmDelete ? (
            <div className="flex items-center gap-2">
              {onSaveAsWishlist && (
                <button onClick={onSaveAsWishlist}
                  className="text-xs tracking-widest uppercase px-3 sm:px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-800 hover:border-stone-500 transition-all inline-flex items-center gap-1.5"
                  title="Save this inspiration as a wishlist item">
                  <Heart size={13} strokeWidth={1.5} />
                  <span className="hidden sm:inline">Save to wishlist</span>
                  <span className="sm:hidden">Wishlist</span>
                </button>
              )}
              <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-full bg-white border border-stone-200 text-stone-400 hover:border-red-300 hover:text-red-600 transition-all" aria-label="Delete">
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={onDelete} className="px-4 py-2.5 rounded-full text-xs sm:text-sm bg-red-600 text-white hover:bg-red-700 transition-all">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2.5 rounded-full text-xs sm:text-sm text-stone-500 hover:text-stone-900 transition-all">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* ─── TWO-COLUMN BODY ─── */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-64px)]">

          {/* ── LEFT: Hero photo ── */}
          <div className="lg:col-span-6 lg:sticky lg:top-[65px] lg:self-start lg:h-[calc(100vh-65px)] p-4 sm:p-6 lg:p-8 lg:pr-0">
            <div className="h-full rounded-2xl lg:rounded-[2rem] overflow-hidden bg-stone-100 smooth-shadow">
              <img
                src={inspiration.image}
                alt={inspiration.caption || 'inspiration'}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            {inspiration.sourceUrl && (
              <a href={inspiration.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs tracking-wider uppercase text-stone-400 hover:text-stone-700 transition-colors">
                <LinkIcon size={11} strokeWidth={2} /> View source
              </a>
            )}
          </div>

          {/* ── RIGHT: Editorial intelligence column ── */}
          <div className="lg:col-span-6 px-4 sm:px-6 lg:px-10 lg:pr-8 py-8 lg:py-12 space-y-8">

            {/* Eyebrow + title */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="brass-rule" aria-hidden="true" />
                <p className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Inspiration</p>
              </div>
              {/* Caption: if it's a plain URL (e.g. the product name wasn't
                  found so the URL ended up as caption), render a source chip
                  instead of a raw tracking URL as the H1. */}
              {(() => {
                const captionUrl = parseSourceUrl(inspiration.caption);
                if (captionUrl) {
                  // Caption IS a URL — show fallback title + source chip
                  return (
                    <>
                      <h1 className="text-3xl sm:text-4xl font-display text-stone-900 leading-tight">Untitled inspiration</h1>
                      <a
                        href={captionUrl.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-3 text-[11px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline transition-colors"
                      >
                        <span className="inline-block w-3 h-px bg-current" aria-hidden="true" />
                        Source · {captionUrl.hostname}
                      </a>
                    </>
                  );
                }
                return inspiration.caption ? (
                  <h1 className="text-3xl sm:text-4xl font-display text-stone-900 leading-tight">{inspiration.caption}</h1>
                ) : null;
              })()}
              {/* Notes: if prose, render as italic text. If somehow a bare URL,
                  render as a source chip (e.g. old data where notes held the URL). */}
              {(() => {
                const notesUrl = parseSourceUrl(inspiration.notes);
                if (notesUrl) {
                  return (
                    <a
                      href={notesUrl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 text-[11px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline transition-colors"
                    >
                      <span className="inline-block w-3 h-px bg-current" aria-hidden="true" />
                      Source · {notesUrl.hostname}
                    </a>
                  );
                }
                return inspiration.notes ? (
                  <p className="text-stone-500 mt-3 leading-relaxed text-sm whitespace-pre-wrap">{inspiration.notes}</p>
                ) : null;
              })()}
            </div>

            {/* Palette strip */}
            {paletteColors.length > 0 && (
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400 font-medium mb-2">Palette</p>
                <div className="flex gap-2 flex-wrap">
                  {paletteColors.map((colour) => (
                    <div key={colour} className="flex items-center gap-1.5">
                      <span
                        className="w-5 h-5 rounded-full border border-stone-200/60 shrink-0"
                        style={{ background: COLOR_SWATCHES[colour] || hexFromColorName(colour) }}
                      />
                      <span className="text-[10px] text-stone-500 tracking-wider">{colour}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Analyse CTA (pre-analysis state) ── */}
            {!hasAnalysis && (
              <div className="bg-stone-900 text-white rounded-2xl p-5 lg:p-6">
                <h2 className="font-display text-xl mb-3 flex items-center gap-2">
                  <Sparkles size={16} strokeWidth={1.5} className="text-brass-300" /> Analyse with Concierge
                </h2>
                <p className="text-stone-300 text-sm mb-5 leading-relaxed">
                  The Concierge will identify the garments in this look and cross-reference against your wardrobe to find matches and gaps.
                </p>
                <button onClick={handleAnalyze} disabled={analyzing || !isAIEnabled()}
                  className="bg-white text-stone-900 px-5 py-3 rounded-full text-sm font-medium hover:bg-stone-100 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={1.5} />
                  {analyzing ? 'Analysing…' : isAIEnabled() ? 'Analyse this look' : 'Concierge not set up'}
                </button>
                {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
              </div>
            )}

            {/* ── Post-analysis content ── */}
            {hasAnalysis && (
              <>
                {/* Concierge summary as editorial pull-quote */}
                {inspiration.analysis.summary && (
                  <div>
                    <p className="font-display text-stone-800 text-lg sm:text-xl leading-relaxed italic">
                      "{inspiration.analysis.summary}"
                    </p>
                    <button onClick={handleAnalyze} disabled={analyzing}
                      className="mt-3 text-[10px] tracking-widest uppercase text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1.5">
                      <Sparkles size={11} strokeWidth={1.5} />
                      {analyzing ? 'Re-analysing…' : 'Re-analyse'}
                    </button>
                  </div>
                )}

                {/* Recreate CTA — primary action, near the top */}
                {recreateable && (
                  <button onClick={onRecreateLook}
                    className="w-full sm:w-auto bg-stone-900 text-white px-6 py-3.5 rounded-full font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-[0.98] inline-flex items-center justify-center gap-2 text-sm">
                    <Sparkles size={15} strokeWidth={1.5} />
                    Recreate this look
                  </button>
                )}

                {/* The Style Verdict — completion read against the owned
                    wardrobe. Guarded on completionVerdict so inspirations
                    analysed before this field existed just skip the card
                    (they still show the garment list below unaffected). */}
                {inspiration.analysis.completionVerdict && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 lg:p-6 smooth-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={13} strokeWidth={1.5} className="text-brass-500" />
                      <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">The Style Verdict</h2>
                    </div>
                    <p className="font-display text-2xl lg:text-3xl text-stone-900 leading-tight">{inspiration.analysis.completionVerdict}</p>
                    <dl className="mt-5">
                      {[
                        ['Pieces owned', String(inspiration.analysis.piecesOwned ?? 0)],
                        ['Pieces missing', String(inspiration.analysis.piecesMissing ?? 0)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 border-t border-stone-100 first:border-t-0">
                          <dt className="text-[10px] tracking-widest uppercase text-stone-400 shrink-0">{label}</dt>
                          <dd className="text-sm text-stone-800 text-right min-w-0 break-words">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {/* Garments as visual cards */}
                {garments.length > 0 && (
                  <div>
                    <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400 font-medium mb-3">
                      Garments identified · {garments.length}
                    </p>
                    <div className="space-y-3">
                      {garments.map((g, idx) => {
                        const matchedItem = g.matchedItemId ? matchedItemById[g.matchedItemId] : null;
                        const isMatched = !!matchedItem;
                        // For non-garments-array analyses: derive missingPiece text from buyingNote
                        const missingText = !isMatched ? (g.buyingNote || g.description) : null;
                        const shopUrl = missingText ? googleShopUrl(missingText) : null;
                        const yourShops = missingText ? yourShopsUrl(missingText) : null;
                        return (
                          <div key={idx} className="bg-white border border-stone-200/60 rounded-2xl p-4 flex items-start gap-4">
                            {/* Thumbnail / fallback */}
                            {isMatched ? (
                              <button
                                onClick={() => onOpenItem?.(matchedItem.id)}
                                className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 hover:border-stone-400 transition-colors"
                                title={`Open ${matchedItem.name}`}
                              >
                                {itemImages(matchedItem)[0]
                                  ? <ItemTileImage item={matchedItem} alt={matchedItem.name} />
                                  : <div className="w-full h-full flex items-center justify-center"><Shirt size={18} className="text-stone-300" /></div>}
                              </button>
                            ) : (
                              <div className="shrink-0 w-14 h-14 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center">
                                <Shirt size={20} className="text-stone-300" />
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] tracking-widest uppercase text-stone-400 mb-0.5">{g.category}</p>
                              <p className="text-stone-900 text-sm font-medium leading-snug">
                                {g.description}
                                {g.brand_guess && (
                                  <span className="text-[11px] italic text-amber-700 font-normal ml-2">· likely {g.brand_guess}</span>
                                )}
                              </p>

                              {/* Match status chip */}
                              {isMatched ? (
                                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                  <span className="text-[9px] tracking-widest uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    ✓ In your wardrobe
                                  </span>
                                  {g.matchConfidence && (
                                    <span className={`text-[9px] tracking-widest uppercase ${
                                      g.matchConfidence === 'high' ? 'text-emerald-600' : 'text-stone-400'
                                    }`}>
                                      {g.matchConfidence} match
                                    </span>
                                  )}
                                  {g.buyingNote && (
                                    <p className="w-full text-[11px] text-stone-400 italic mt-1">{g.buyingNote}</p>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1.5">
                                  <span className="text-[9px] tracking-widest uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                    ◯ Missing from wardrobe
                                  </span>
                                  {/* Buying actions inline */}
                                  {missingText && (
                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                      {onAddMissingToWishlist && (
                                        <button onClick={() => onAddMissingToWishlist(missingText)}
                                          className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase px-2.5 py-1.5 bg-stone-900 hover:bg-stone-700 text-white rounded-full transition-colors">
                                          <Heart size={10} strokeWidth={1.5} /> Wishlist
                                        </button>
                                      )}
                                      {shopUrl && (
                                        <a href={shopUrl} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase px-2.5 py-1.5 bg-white border border-stone-200 hover:border-stone-400 text-stone-700 rounded-full transition-colors">
                                          <Store size={10} strokeWidth={1.5} /> Shop
                                        </a>
                                      )}
                                      {yourShops && (
                                        <a href={yourShops} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase px-2.5 py-1.5 bg-white border border-stone-200 hover:border-stone-400 text-stone-700 rounded-full transition-colors">
                                          <Bookmark size={10} strokeWidth={1.5} /> Your shops
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Re-analyse link (bottom) */}
                {!analyzing && (
                  <button onClick={handleAnalyze} disabled={analyzing}
                    className="text-[10px] tracking-widest uppercase text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1.5">
                    <Sparkles size={11} strokeWidth={1.5} /> Re-analyse
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AIProgressModal open={analyzing} stage={analyzeStage} title="Analysing your inspiration" />
    </div>,
    document.body
  );
}



// Travel planner: type a destination, hit forecast → Gemini → one outfit per
// day of the range. Saves each as a "Trip · Date" outfit + schedules it. After
// it runs, the user can immediately tap "Generate packing list" right next to
// this button to get the deduped list.
// Activities the user can multi-select. Each carries an implicit wardrobe
// requirement that the Concierge prompt teaches Gemini to honour — e.g.
// "Beach / pool" means swimwear belongs in the capsule. The chips are
// ordered roughly by frequency on a generic trip.


// Aggregate every piece across a date-range of planned outfits, dedupe by
// item id, group by category, and print a clean checklist. Optional CSV/PDF
// export skipped — print works as PDF on every modern browser via "Save as PDF".
// Share sheet: native Web Share (iOS/Android) + WhatsApp/email deep links +
// explicit Copy button. The inline URL field is selectable so even when
// clipboard.writeText is blocked (Safari outside user-gesture, some PWAs),
// the user can long-press → copy manually.
// Portal modal — used when the user clicks "Style with this" on an item
// detail page. Mirrors the TodayTile Suggest-a-Look modal but constrained
// to one focal item. Three states: busy (composing), result (with Save +
// regenerate + discard), error.
function StyleAroundItemModal({ sourceItem, suggestion, busy, error, saving, allItems = [], onRegenerate, onSave, onClose }) {
  useEscapeKey(busy || saving ? () => {} : onClose);
  const [name, setName] = useState('');
  useEffect(() => {
    if (sourceItem && !name) {
      setName(`Styled with ${sourceItem.name}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceItem?.name]);
  const pieces = (suggestion?.itemIds || [])
    .map((id) => allItems.find((i) => i.id === id) || (sourceItem.id === id ? sourceItem : null))
    .filter(Boolean);
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && !busy && !saving) onClose(); }}
    >
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl shadow-2xl w-full max-w-xl sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="absolute -right-16 -top-16 opacity-[0.06] rotate-12 pointer-events-none">
          <Sparkles size={280} strokeWidth={0.8} />
        </div>
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <p className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-bold">
                {busy ? 'Composing' : error ? 'Couldn’t style this' : `Styled with · ${suggestion?.confidence ?? '–'}/100 confidence`}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl mt-1 truncate">
                {busy ? 'Building a look around it…' : sourceItem.name}
              </h2>
            </div>
            {!busy && !saving && (
              <button onClick={onClose} aria-label="Close"
                className="shrink-0 -mt-1 -mr-1 p-2 rounded-full hover:bg-white/10 transition-colors">
                <X size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {busy ? (
            <div className="py-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-brass-300 rounded-full animate-pulse" style={{ width: '40%' }} />
                </div>
                <span className="text-xs text-stone-400 tracking-wide">Pairing your wardrobe…</span>
              </div>
              <p className="text-sm text-stone-400 leading-relaxed">
                The Concierge is looking for pieces in your wardrobe that complement {sourceItem.brand ? `the ${sourceItem.brand} ` : 'this '}{sourceItem.category?.toLowerCase() || 'piece'} — colour, style, season.
              </p>
            </div>
          ) : error ? (
            <div className="py-4">
              <p className="text-sm text-stone-300 leading-relaxed mb-5">{error}</p>
              <div className="flex gap-3">
                <button onClick={onRegenerate} disabled={saving}
                  className="text-xs tracking-widest uppercase px-5 py-3 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 font-medium">
                  Try again
                </button>
                <button onClick={onClose} className="text-xs tracking-widest uppercase px-5 py-3 rounded-full text-stone-400 hover:text-white">
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {pieces.map((p) => {
                  const isFocal = p.id === sourceItem.id;
                  return (
                    <div key={p.id} className="min-w-0">
                      <div className={`aspect-[3/4] rounded-xl overflow-hidden bg-stone-700 mb-2 ${isFocal ? 'ring-2 ring-brass-300' : ''}`}>
                        <ItemTileImage item={p} alt={p.name || ""} />
                      </div>
                      <p className={`text-[11px] truncate ${isFocal ? 'text-brass-300 font-medium' : 'text-stone-300'}`}>
                        {isFocal ? '★ ' : ''}{p.name}
                      </p>
                      <p className="text-[10px] text-stone-500 truncate uppercase tracking-wider">{p.brand}</p>
                    </div>
                  );
                })}
              </div>

              {suggestion?.reasoning && (
                <p className="text-sm text-stone-300 italic mt-5 leading-relaxed bg-white/5 border border-white/10 rounded-xl p-4">
                  "{renderTextWithChips(suggestion.reasoning, { items: allItems })}"
                </p>
              )}

              <div className="mt-6 mb-2">
                <label className="block text-[10px] tracking-[0.22em] uppercase text-stone-400 mb-1.5">Name this look</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Styled with ${sourceItem.name}`}
                  className="w-full bg-white/10 text-white text-sm rounded-xl px-4 py-2.5 placeholder-stone-500 border border-white/10 focus:outline-none focus:border-brass-300 transition-colors"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <button onClick={() => onSave(name.trim() || undefined)} disabled={saving}
                  className="text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 font-medium">
                  <Bookmark size={14} strokeWidth={1.5} /> {saving ? 'Saving…' : 'Save this look'}
                </button>
                <button onClick={onRegenerate} disabled={saving}
                  className="text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                  ↻ Try a different look
                </button>
              </div>
              <button onClick={onClose} disabled={saving}
                className="block mx-auto mt-5 text-[11px] tracking-widest uppercase text-stone-400 hover:text-white transition-colors">
                Discard
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Portal modal — triggered from OutfitDetailView's "Vary look" button.
// Same shape as StyleAroundItemModal but the source is an existing saved
// outfit and the AI is asked to spin a variation of it. Five intent
// presets ('fresh', 'casual', 'polished', 'palette', 'season') are
// surfaced as chips so the user can re-roll without leaving the modal.
function OutfitVariationModal({ sourceOutfit, suggestion, busy, error, saving, allItems = [], onRegenerate, onSave, onClose }) {
  useEscapeKey(busy || saving ? () => {} : onClose);
  const pieces = (suggestion?.itemIds || [])
    .map((id) => allItems.find((i) => i.id === id))
    .filter(Boolean);
  const intentChips = [
    { key: 'fresh', label: 'Fresh take' },
    { key: 'casual', label: 'More casual' },
    { key: 'polished', label: 'More polished' },
    { key: 'palette', label: 'Different palette' },
    { key: 'season', label: 'Different mood' },
  ];
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && !busy && !saving) onClose(); }}
    >
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl shadow-2xl w-full max-w-xl sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="absolute -right-16 -top-16 opacity-[0.06] rotate-12 pointer-events-none">
          <Sparkles size={280} strokeWidth={0.8} />
        </div>
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0">
              <p className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-bold">
                {busy ? 'Composing' : error ? 'Couldn’t spin a variation' : `Variation of · ${suggestion?.confidence ?? '–'}/100 confidence`}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl mt-1 truncate">
                {busy ? `Reimagining "${sourceOutfit.name}"…` : sourceOutfit.name}
              </h2>
            </div>
            {!busy && !saving && (
              <button onClick={onClose} aria-label="Close"
                className="shrink-0 -mt-1 -mr-1 p-2 rounded-full hover:bg-white/10 transition-colors">
                <X size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {busy ? (
            <div className="py-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-brass-300 rounded-full animate-pulse" style={{ width: '40%' }} />
                </div>
                <span className="text-xs text-stone-400 tracking-wide">Spinning a fresh combination…</span>
              </div>
              <p className="text-sm text-stone-400 leading-relaxed">
                Anchoring on the original look, then swapping pieces from your wardrobe to find a different combination.
              </p>
            </div>
          ) : error ? (
            <div className="py-4">
              <p className="text-sm text-stone-300 leading-relaxed mb-5">{error}</p>
              <div className="flex gap-3">
                <button onClick={() => onRegenerate('fresh')} disabled={saving}
                  className="text-xs tracking-widest uppercase px-5 py-3 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 font-medium">
                  Try again
                </button>
                <button onClick={onClose} className="text-xs tracking-widest uppercase px-5 py-3 rounded-full text-stone-400 hover:text-white">
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {pieces.map((p) => (
                  <div key={p.id} className="min-w-0">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-700 mb-2">
                      <ItemTileImage item={p} alt={p.name || ""} />
                    </div>
                    <p className="text-[11px] text-stone-300 truncate">{p.name}</p>
                    <p className="text-[10px] text-stone-500 truncate uppercase tracking-wider">{p.brand}</p>
                  </div>
                ))}
              </div>

              {suggestion?.reasoning && (
                <p className="text-sm text-stone-300 italic mt-5 leading-relaxed bg-white/5 border border-white/10 rounded-xl p-4">
                  "{renderTextWithChips(suggestion.reasoning, { items: allItems })}"
                </p>
              )}

              {/* Intent chips — re-roll the variation with a different angle
                  without closing the modal. */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="text-[10px] tracking-widest uppercase text-stone-500 self-center mr-1">Try:</span>
                {intentChips.map((c) => (
                  <button key={c.key} onClick={() => onRegenerate(c.key)} disabled={saving}
                    className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40">
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
                <button onClick={onSave} disabled={saving}
                  className="text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 font-medium">
                  <Bookmark size={14} strokeWidth={1.5} /> {saving ? 'Saving…' : 'Save as new look'}
                </button>
                <button onClick={() => onRegenerate('fresh')} disabled={saving}
                  className="text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                  ↻ Try again
                </button>
              </div>
              <button onClick={onClose} disabled={saving}
                className="block mx-auto mt-5 text-[11px] tracking-widest uppercase text-stone-400 hover:text-white transition-colors">
                Discard
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}




// ─── THE ATELIER CONCIERGE ─────────────────────────────────────────────
// Conversational AI stylist. Right-edge slide-in panel (480-560px wide
// on tablet+ ; full-screen on mobile) — feels like opening a hotel
// concierge desk. Multi-turn chat with Gemini using the full wardrobe
// as context. Time-of-day greeting opens each session.
//
// Architecture:
//   • messages state: [{role: 'user'|'assistant', text}]
//   • busy flag while a reply is in flight
//   • error flag if a reply fails (offers retry of last user message)
//   • input controlled with submit-on-enter (shift+enter = new line)
//   • auto-scrolls to bottom on new messages
function AtelierConcierge({ onClose, items, outfits, styleProfile, measurements = null, ownerFirstName, user, onEditPreferences, onOpenItem = null, onSaveLook = null, onSchedule = null, onAddToPacking = null }) {
  useEscapeKey(onClose);

  // Time-of-day greeting — sets the tone before the user even types.
  // Hour ranges deliberately broad so the greeting feels right at edges.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const first = ownerFirstName || '';
    if (h < 5) return `Up late${first ? `, ${first}` : ''}. What are you dressing for?`;
    if (h < 12) return `Good morning${first ? `, ${first}` : ''}. What's the day asking of you?`;
    if (h < 17) return `Good afternoon${first ? `, ${first}` : ''}. How can I help you dress?`;
    if (h < 22) return `Good evening${first ? `, ${first}` : ''}. Are we dressing for something?`;
    return `Late evening${first ? `, ${first}` : ''}. Planning tomorrow, or out tonight?`;
  }, [ownerFirstName]);

  const [messages, setMessages] = useState(() => [{ role: 'assistant', text: greeting }]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = React.useRef(null);
  const textareaRef = React.useRef(null);
  const cancelledRef = React.useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // Soft-cancel the in-flight stream. Sets cancelledRef so onChunk and
  // post-await bail. We also clean up the placeholder + reset busy here
  // so the UI returns to a clean state without waiting for the
  // (still in-flight) Gemini stream to finally close server-side.
  const cancelStream = React.useCallback(() => {
    cancelledRef.current = true;
    setMessages((prev) => prev.filter((m) => !m.streaming));
    setBusy(false);
    setError(null);
  }, []);

  // Hydrate persisted thread from Firestore on mount. If there is a saved
  // thread, restore it; otherwise the greeting-only initial state stands.
  useEffect(() => {
    if (!user?.uid) { setHydrated(true); return; }
    let cancelled = false;
    (async () => {
      const { messages: saved } = await loadCurrentThread();
      if (!cancelled) {
        if (saved.length > 0) setMessages(saved);
        setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll the chat to the bottom whenever messages change.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Best-effort: pull the next week of calendar events so the stylist can
  // dress for whatever day the client asks about — not just today. (The Daily
  // Brief stays today-only; it composes a look for today specifically. The
  // Concierge is conversational and the client may ask about any upcoming day.)
  // Guarded so non-connected users never fire the callable.
  const [calendarEvents, setCalendarEvents] = useState([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const connected = await isCalendarConnected(user);
        if (!connected || !alive) return;
        const start = new Date(todayISO() + 'T00:00:00');
        const end = new Date(todayISO() + 'T00:00:00');
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);
        const { events = [], reason } = await fetchCalendarEvents(start.toISOString(), end.toISOString());
        if (alive && reason !== 'revoked') setCalendarEvents(events);
      } catch (err) {
        // Calendar context is best-effort — never block styling on it.
        console.warn('[calendar] event fetch for AI context failed:', err?.message);
      }
    })();
    return () => { alive = false; };
  }, [user]);

  // Focus the input when the panel opens.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || busy) return;
    // CRITICAL: set busy immediately, before any await, to close the
    // double-click / double-send race. Any second invocation that slips past
    // the guard above will be stopped here before it can launch a stream.
    setBusy(true);
    setError(null);
    // cancelledRef is a one-way latch tripped by a PRIOR request (explicit
    // Cancel, a watchdog timeout, or — in dev, under StrictMode — a synthetic
    // mount/unmount cycle) and nothing ever reset it. Once tripped, every
    // future send() in this component's lifetime silently skipped the
    // finalize step below (`if (cancelledRef.current) return`), leaving the
    // reply stuck mid-stream forever even though the API call itself
    // completed fine — this was the actual "Concierge hangs" bug. Reset it
    // here so a stale cancellation from an earlier turn can never affect a
    // new one.
    cancelledRef.current = false;

    const userMsg = { role: 'user', text, ts: new Date().toISOString() };
    const afterUser = [...messages, userMsg];
    setMessages(afterUser);
    setInput('');
    await saveCurrentThread(afterUser);

    // Insert an empty placeholder assistant message that will fill in as
    // chunks arrive. The streaming=true flag lets the bubble render a
    // pulsing caret-style indicator while text is mid-stream.
    const placeholder = { role: 'assistant', text: '', ts: new Date().toISOString(), streaming: true };
    setMessages([...afterUser, placeholder]);

    let accumulated = '';
    // Two watchdogs:
    // 1. Start watchdog: if NO chunks arrive in 60s, the stream is stuck
    //    in thinking/connect — abort.
    // 2. Idle watchdog: each chunk resets a 30s timer; if 30s passes
    //    without a NEW chunk, the stream stalled mid-reply — abort.
    let lastChunkAt = performance.now();
    const startWatchdog = setTimeout(() => {
      if (!cancelledRef.current && accumulated.length === 0) {
        cancelledRef.current = true;
        setMessages((prev) => prev.filter((m) => !m.streaming));
        setError('The Concierge took too long to start. Try again?');
      }
    }, 60_000);
    const idleWatchdog = setInterval(() => {
      if (cancelledRef.current) return;
      if (accumulated.length === 0) return; // start-watchdog covers this case
      if (performance.now() - lastChunkAt > 30_000) {
        cancelledRef.current = true;
        setMessages((prev) => prev.filter((m) => !m.streaming));
        setError('The reply stalled mid-stream. Try again?');
      }
    }, 5_000);
    try {
      await generateConciergeReply({
        messages: afterUser,
        items,
        outfits,
        styleProfile,
        ownerFirstName,
        calendarEvents,
        onChunk: (chunk) => {
          if (cancelledRef.current) return;
          lastChunkAt = performance.now(); // reset idle timer
          accumulated += chunk;
          // Update the last (placeholder) message's text in place. React
          // re-renders the bubble; user sees text grow smoothly.
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.streaming) {
              next[next.length - 1] = { ...last, text: accumulated };
            }
            return next;
          });
        },
      });

      // Bail out if panel was closed while stream was in flight.
      if (cancelledRef.current) return;

      // Stream done. Finalize the placeholder (strip streaming flag) and
      // persist to Firestore. Use a fresh build of the final message so the
      // saved thread matches what the user sees.
      const finalMsg = { role: 'assistant', text: accumulated || '(no reply)', ts: new Date().toISOString() };
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = finalMsg;
        return next;
      });
      await saveCurrentThread([...afterUser, finalMsg]);
    } catch (err) {
      if (cancelledRef.current) return;
      // Strip the placeholder so the user doesn't see an empty bubble alongside the error
      setMessages((prev) => prev.filter((m) => !m.streaming));
      setError(err?.message || 'Something interrupted us. Try again?');
    } finally {
      clearTimeout(startWatchdog);
      clearInterval(idleWatchdog);
      setBusy(false);
    }
  };

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    // Same reset as send() — see the comment there. Without this, retrying
    // after any prior cancellation/timeout in this session would hit the
    // exact same stuck-forever bug immediately.
    cancelledRef.current = false;

    // Insert a streaming placeholder — mirrors the send flow so the user
    // sees tokens arrive rather than waiting for a full non-streaming reply.
    const placeholder = { role: 'assistant', text: '', ts: new Date().toISOString(), streaming: true };
    setMessages((prev) => [...prev, placeholder]);

    // Capture the messages at retry time (closed over); retry replays against
    // the existing thread without adding a new user message, so we use the
    // closure-captured `messages` rather than an afterUser snapshot.
    let accumulated = '';
    // Two watchdogs (same pattern as send()):
    // 1. Start watchdog: if NO chunks arrive in 60s, abort.
    // 2. Idle watchdog: reset on each chunk; abort if 30s of mid-stream silence.
    let lastChunkAt = performance.now();
    const startWatchdog = setTimeout(() => {
      if (!cancelledRef.current && accumulated.length === 0) {
        cancelledRef.current = true;
        setMessages((prev) => prev.filter((m) => !m.streaming));
        setError('The Concierge took too long to start. Try again?');
      }
    }, 60_000);
    const idleWatchdog = setInterval(() => {
      if (cancelledRef.current) return;
      if (accumulated.length === 0) return; // start-watchdog covers this case
      if (performance.now() - lastChunkAt > 30_000) {
        cancelledRef.current = true;
        setMessages((prev) => prev.filter((m) => !m.streaming));
        setError('The reply stalled mid-stream. Try again?');
      }
    }, 5_000);
    try {
      await generateConciergeReply({
        messages,
        items,
        outfits,
        styleProfile,
        ownerFirstName,
        calendarEvents,
        onChunk: (chunk) => {
          if (cancelledRef.current) return;
          lastChunkAt = performance.now(); // reset idle timer
          accumulated += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.streaming) {
              next[next.length - 1] = { ...last, text: accumulated };
            }
            return next;
          });
        },
      });

      if (cancelledRef.current) return;

      const finalMsg = { role: 'assistant', text: accumulated || '(no reply)', ts: new Date().toISOString() };
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = finalMsg;
        return next;
      });
      await saveCurrentThread([...messages, finalMsg]);
    } catch (err) {
      if (cancelledRef.current) return;
      setMessages((prev) => prev.filter((m) => !m.streaming));
      setError(err?.message || 'Still no luck — try again in a moment.');
    } finally {
      clearTimeout(startWatchdog);
      clearInterval(idleWatchdog);
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send();
  };

  const onKeyDown = (e) => {
    // Enter sends; Shift+Enter newlines (textarea default).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Suggested first prompts — visible only at greeting time (no user
  // turns yet) so the user has somewhere to start. Each is a single tap.
  const STARTER_PROMPTS = [
    'What should I wear today?',
    'Help me pack for a 4-day trip.',
    'Suggest something for a dinner out.',
    'Which pieces have I worn least?',
  ];

  // True when the last message is a user message and we're not actively
  // streaming or erroring. Happens when a previous stream was abandoned
  // (user closed the panel mid-stream → cancelledRef bailed → the
  // assistant reply was never persisted). Surfacing a one-tap retry
  // is much friendlier than making the user retype.
  const hasOrphanUserMessage =
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'user' &&
    !busy &&
    !error;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex animate-in fade-in duration-200" onClick={onClose}>
      {/* Scrim */}
      <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Slide-in panel from the right edge. On mobile this fills the
          viewport; on tablet+ it sits as a 480-560px concierge desk. */}
      <div
        className="ml-auto relative w-full sm:w-[480px] lg:w-[560px] bg-[#F7F5F2] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="The Atelier Concierge"
      >
        {/* HEADER — brass-rule eyebrow + serif title + close */}
        <header className="border-b border-stone-200/60 pt-safe">
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="brass-rule" aria-hidden="true" />
                  <span className="text-[10px] tracking-[0.3em] uppercase text-stone-500 font-medium">The Concierge</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl text-stone-900 tracking-tight leading-tight">
                  Your private stylist
                </h2>
              </div>
              <button onClick={onClose}
                className="shrink-0 w-9 h-9 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-200/70 flex items-center justify-center transition-colors"
                aria-label="Close concierge">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            {messages.length > 1 && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Clear the conversation? This cannot be undone.')) return;
                  setMessages([{ role: 'assistant', text: greeting }]);
                  await clearCurrentThread();
                }}
                className="inline-flex items-center gap-1.5 text-[10px] tracking-widest uppercase text-stone-700 hover:text-stone-900 border border-stone-300 hover:border-stone-500 bg-white hover:bg-stone-50 rounded-full px-3 py-1.5 transition-colors"
                title="Clear this conversation and start over"
              >
                <Plus size={11} strokeWidth={2} className="rotate-45" /> New thread
              </button>
            )}
          </div>
        </header>

        {/* CONTEXT CAPSULE — what the Concierge actually knows about you */}
        {(() => {
          const ownedCount = items.filter(it => it.status === 'owned' && !it.deletedAt).length;
          const savedLooksCount = outfits?.length ?? 0;
          const mostWornNames = [...items.filter(it => it.status === 'owned' && !it.deletedAt)]
            .sort((a, b) => itemWearCount(b) - itemWearCount(a))
            .filter(it => itemWearCount(it) > 0)
            .slice(0, 3)
            .map(it => it.name)
            .join(', ');
          const weather = (() => { try { return JSON.parse(localStorage.getItem('atelier-weather-v3') || 'null')?.data; } catch { return null; } })();
          const currentSeason = (() => { const m = new Date().getMonth(); return m >= 2 && m <= 4 ? 'Spring' : m >= 5 && m <= 7 ? 'Summer' : m >= 8 && m <= 10 ? 'Autumn' : 'Winter'; })();
          const paletteLabel = measurements?.stylePalette;
          return (
            <div className="border-b border-stone-200 bg-stone-50 px-4 py-2">
              <details>
                <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-stone-500 hover:underline">
                  What the Concierge knows
                </summary>
                <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
                  <li>· {ownedCount} pieces in your wardrobe</li>
                  <li>· {savedLooksCount} saved looks</li>
                  <li>· Most-worn: {mostWornNames || '—'}</li>
                  {weather && <li>· {weather.temp != null ? `${Math.round(weather.temp)}°C` : 'no forecast'} · {currentSeason}</li>}
                  {paletteLabel && <li>· Palette: {paletteLabel}</li>}
                </ul>
                {onEditPreferences && (
                  <button
                    type="button"
                    onClick={() => { onClose?.(); onEditPreferences(); }}
                    className="mt-2 text-[10px] tracking-widest uppercase text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    Update preferences →
                  </button>
                )}
              </details>
            </div>
          );
        })()}

        {/* MESSAGES — vertical scroll, two bubble styles */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-5">
          {messages.map((m, i) => (
            <ConciergeMessage
              key={i}
              role={m.role}
              text={m.text}
              streaming={!!m.streaming}
              items={items}
              onOpenItem={onOpenItem}
              onCancel={cancelStream}
              onSaveLook={onSaveLook}
              onSchedule={onSchedule}
              onAddToPacking={onAddToPacking}
            />
          ))}
          {hasOrphanUserMessage && (
            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-900 text-white text-[12px] tracking-wide hover:bg-stone-700 transition-colors shadow-sm"
              >
                <Sparkles size={13} strokeWidth={1.75} className="text-amber-400" />
                Tap to retry
              </button>
            </div>
          )}
          {busy && !messages.some((m) => m.streaming) && (
            <div className="flex items-center gap-2 text-stone-400 text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="font-display italic text-stone-400">Thinking…</span>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200/70 rounded-2xl p-4">
              <p className="text-sm text-red-900">{error}</p>
              <button onClick={retry}
                className="mt-2 text-[11px] tracking-widest uppercase text-red-700 hover:text-red-900">
                Try again
              </button>
            </div>
          )}
          {messages.length === 1 && !busy && (
            // Starter prompts on first open only. Lets the user start
            // without typing — feels like a stylist offering options.
            <div className="space-y-2 pt-2">
              <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400 mb-3">Or pick a starting point</p>
              {STARTER_PROMPTS.map((p) => (
                <button key={p} onClick={() => send(p)}
                  className="block w-full text-left px-4 py-3 rounded-2xl bg-white border border-stone-200/70 hover:border-brass-300 text-sm text-stone-700 hover:text-brass-700 transition-colors font-display italic">
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INPUT — auto-grow textarea, enter to send */}
        <form onSubmit={onSubmit}
          className="border-t border-stone-200/60 p-4 sm:p-5 bg-white/60 backdrop-blur"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask anything…"
              disabled={busy}
              className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 rounded-2xl border border-stone-300 focus:border-brass-400 focus:outline-none focus:ring-2 focus:ring-brass-300/40 bg-white text-sm text-stone-900 resize-none disabled:opacity-50"
              style={{ fontSize: '16px' /* avoid iOS auto-zoom */ }}
            />
            <button type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 px-5 h-11 rounded-full bg-stone-900 text-white text-[11px] tracking-widest uppercase font-medium hover:bg-stone-700 disabled:opacity-30 disabled:hover:bg-stone-900 transition-colors">
              Ask
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// Inline item chip rendered when the Concierge text contains an
// <<item:id|name>> marker. Resolves id → current item object so the
// thumbnail is always up to date (renames, image swaps reflect
// automatically). Falls back to plain text if the id is unknown,
// which protects against hallucinated markers.
// Extract item ids referenced in Concierge assistant text via the
// <<item:id|display>> markers. Returns a deduped string array in
// the order they appeared. Used by the Concierge action row to know
// what items the stylist actually proposed in a given message.
function extractItemIdsFromConciergeText(raw) {
  if (!raw) return [];
  const re = /<<item:([^|>]+)\|[^>]+>>/g;
  const seen = new Set();
  const ids = [];
  let match;
  while ((match = re.exec(raw)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

// Action row rendered below assistant messages whose text contains 2+
// item chips. Lets the user act on the stylist's proposal without
// leaving the chat: save the proposed pieces as a Look, schedule them
// for a day, or drop them into the packing list. Hidden when there's
// nothing actionable (≤1 chip = casual chat, not an outfit suggestion).
function ConciergeActionRow({ itemIds, items, onSaveLook, onSchedule, onAddToPacking }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  if (!itemIds || itemIds.length < 2) return null;
  const resolved = itemIds.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  if (resolved.length < 2) return null;

  const todayISO = new Date().toISOString().slice(0, 10);
  const tomorrowISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {onSaveLook && (
        <button
          type="button"
          onClick={() => onSaveLook(itemIds)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900 text-white text-[11px] tracking-wide hover:bg-stone-700 transition-colors"
        >
          <Bookmark size={12} strokeWidth={1.75} />
          Save as a look
        </button>
      )}
      {onSchedule && !scheduleOpen && (
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 text-[11px] tracking-wide hover:border-stone-900 hover:text-stone-900 transition-colors"
        >
          <Calendar size={12} strokeWidth={1.75} />
          Schedule for…
        </button>
      )}
      {onSchedule && scheduleOpen && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-stone-50 border border-stone-300">
          <button
            type="button"
            onClick={() => { onSchedule(itemIds, todayISO); setScheduleOpen(false); }}
            className="px-2 py-0.5 rounded-full text-[11px] text-stone-700 hover:bg-stone-200 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => { onSchedule(itemIds, tomorrowISO); setScheduleOpen(false); }}
            className="px-2 py-0.5 rounded-full text-[11px] text-stone-700 hover:bg-stone-200 transition-colors"
          >
            Tomorrow
          </button>
          <input
            type="date"
            min={todayISO}
            onChange={(e) => { if (e.target.value) { onSchedule(itemIds, e.target.value); setScheduleOpen(false); } }}
            className="px-1.5 py-0.5 text-[11px] bg-transparent border-l border-stone-300 outline-none focus:bg-white"
            style={{ fontSize: '16px' }}
          />
          <button
            type="button"
            onClick={() => setScheduleOpen(false)}
            aria-label="Cancel"
            className="px-1 text-stone-400 hover:text-stone-700"
          >
            ×
          </button>
        </div>
      )}
      {onAddToPacking && (
        <button
          type="button"
          onClick={() => onAddToPacking(itemIds)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 text-[11px] tracking-wide hover:border-stone-900 hover:text-stone-900 transition-colors"
        >
          <Download size={12} strokeWidth={1.75} />
          Add to packing
        </button>
      )}
    </div>
  );
}


// Prominent in-bubble "Composing your reply…" indicator. Renders while the
// streaming placeholder exists but no text has arrived yet (the worst UX
// window — feels like a hang on a slow first chunk).
//
// Stages advance progressively based on elapsed time and HOLD at the last
// stage — they don't cycle back, because looping reads as "stuck in a
// loop" to the user. After ~20s a Cancel button appears so the user
// can bail rather than feeling trapped.
//
// onCancel: called when the user clicks Cancel. Parent should set its
// cancelledRef.current = true and clean up the placeholder. Optional —
// if not provided, the Cancel button is hidden.
function ConciergeComposingIndicator({ onCancel = null }) {
  // (time-in-seconds, label) pairs, ascending. The LAST entry holds
  // indefinitely once we reach it.
  const STAGES = [
    [0,  'Reading the conversation…'],
    [3,  'Looking through your wardrobe…'],
    [7,  'Considering the moment…'],
    [14, 'Composing a reply…'],
    [25, 'Refining the wording…'],
    [45, 'This is taking longer than usual…'],
  ];

  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = React.useRef(0);

  useEffect(() => {
    startRef.current = performance.now();
    const elapsedTimer = setInterval(() => {
      setElapsedMs(performance.now() - startRef.current);
    }, 250);
    return () => clearInterval(elapsedTimer);
  }, []);

  // Pick the current stage by elapsed seconds — walk the STAGES list
  // and choose the last entry whose threshold has been crossed.
  const elapsedSec = Math.floor(elapsedMs / 1000);
  let currentStage = STAGES[0][1];
  for (const [threshold, label] of STAGES) {
    if (elapsedSec >= threshold) currentStage = label;
  }
  const showElapsed = elapsedMs >= 5000;
  const showCancel = elapsedMs >= 20000 && typeof onCancel === 'function';

  return (
    <div className="inline-flex items-center gap-2.5 text-stone-700">
      <Sparkles size={16} strokeWidth={1.5} className="text-amber-500 animate-pulse shrink-0" />
      <span className="font-display italic text-[14px] sm:text-[15px]">
        {currentStage}
      </span>
      {showElapsed && (
        <span className="text-[11px] tabular-nums text-stone-400 ml-1">
          {elapsedSec}s
        </span>
      )}
      {showCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="ml-2 text-[11px] tracking-wide text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// Single chat bubble. The assistant's voice gets editorial treatment
// (white card with brass-rule shoulder eyebrow); the client's voice is
// quieter (dark pill aligned right). Whitespace-pre-line preserves the
// bullet lists Gemini returns.
function ConciergeMessage({ role, text, streaming = false, items = [], onOpenItem = null, onCancel = null, onSaveLook = null, onSchedule = null, onAddToPacking = null }) {
  if (role === 'assistant') {
    return (
      <div className="flex flex-col items-start max-w-[90%]">
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
          <span className="text-[9px] tracking-[0.28em] uppercase text-stone-500">Stylist</span>
        </div>
        <div className="bg-white rounded-2xl rounded-tl-md ring-1 ring-stone-200/70 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_4px_12px_-6px_rgba(28,25,23,0.12)] px-5 py-4">
          {streaming && !text ? (
            <ConciergeComposingIndicator onCancel={onCancel} />
          ) : (
            <p className="font-display text-stone-900 leading-relaxed text-[15px] sm:text-base whitespace-pre-line">
              {renderTextWithChips(text, { items, onOpenItem })}
              {streaming && <span className="inline-block w-0.5 h-4 align-middle ml-0.5 bg-stone-700 animate-pulse" aria-hidden="true" />}
            </p>
          )}
        </div>
        {!streaming && (() => {
          const chipIds = extractItemIdsFromConciergeText(text);
          if (chipIds.length < 2) return null;
          return (
            <ConciergeActionRow
              itemIds={chipIds}
              items={items}
              onSaveLook={onSaveLook}
              onSchedule={onSchedule}
              onAddToPacking={onAddToPacking}
            />
          );
        })()}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end max-w-[85%] ml-auto">
      <div className="bg-stone-900 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
        <p className="text-sm leading-relaxed whitespace-pre-line">{text}</p>
      </div>
    </div>
  );
}

function ShareLinkModal({ url, title, kind, sharedByName = '', status = '', onClose }) {
  useEscapeKey(onClose);
  const [copied, setCopied] = useState(false);
  const inputRef = React.useRef(null);
  const label = kind === 'lookbook' ? 'lookbook' : kind === 'item' ? 'item' : 'look';
  // Contextual share copy — what gets pasted into WhatsApp, email subject, or
  // the OS share sheet. Item shares mention the sharer's name + wishlist
  // context so recipients understand why they're being asked to look.
  const shareText = (() => {
    const who = sharedByName ? sharedByName.split(' ')[0] : '';
    if (kind === 'item') {
      if (status === 'wishlist') {
        return who
          ? `This piece is on ${who}'s wishlist on Atelier — what do you think?`
          : `This piece is on someone's wishlist on Atelier — what do you think?`;
      }
      return who
        ? `${who} shared this piece with you on Atelier`
        : `Take a look at this piece on Atelier`;
    }
    if (kind === 'lookbook') {
      return who
        ? `${who} shared a lookbook with you on Atelier · "${title}"`
        : `Take a look at this lookbook on Atelier · "${title}"`;
    }
    return who
      ? `${who} shared an outfit with you on Atelier · "${title}"`
      : `Have a look at "${title}" on Atelier`;
  })();

  const tryCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input so the user can copy with the system menu.
      inputRef.current?.select();
      inputRef.current?.setSelectionRange?.(0, url.length);
    }
  };

  const tryNativeShare = async () => {
    if (!navigator.share) return;
    try { await navigator.share({ title, text: shareText, url }); }
    catch { /* user cancelled or unsupported; ignore */ }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`;
  const hasNative = typeof navigator !== 'undefined' && !!navigator.share;

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-stone-200/60 bg-white flex justify-between items-start">
          <div className="min-w-0">
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Share {label}</p>
            <h3 className="text-xl font-display text-stone-900 truncate mt-1">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors shrink-0 ml-3" aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {hasNative && (
            <button onClick={tryNativeShare}
              className="w-full bg-stone-900 text-white py-4 rounded-2xl font-medium hover:bg-stone-700 transition-colors flex items-center justify-center gap-2 shadow-lg">
              <Download size={16} strokeWidth={1.5} className="rotate-180" /> Share via…
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
              className="bg-white border border-stone-200 hover:border-stone-500 rounded-2xl py-4 flex flex-col items-center gap-2 transition-colors">
              <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-base font-bold">W</span>
              <span className="text-xs tracking-wider uppercase text-stone-700">WhatsApp</span>
            </a>
            <a href={emailHref}
              className="bg-white border border-stone-200 hover:border-stone-500 rounded-2xl py-4 flex flex-col items-center gap-2 transition-colors">
              <span className="w-9 h-9 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center">@</span>
              <span className="text-xs tracking-wider uppercase text-stone-700">Email</span>
            </a>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-stone-500 mb-2">Or copy the link</label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={url}
                readOnly
                onFocus={(e) => { e.target.select(); e.target.setSelectionRange?.(0, url.length); }}
                className="flex-1 min-w-0 px-3 py-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-700 outline-none font-mono"
              />
              <button onClick={tryCopy}
                className={`px-4 py-3 rounded-xl text-xs tracking-wider uppercase font-medium transition-colors shrink-0 ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-stone-900 text-white hover:bg-stone-700'
                }`}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-stone-400 mt-2 leading-relaxed">Tip: tap the URL above to select, then long-press → Copy if the button doesn't work in your browser.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Tiny name-this-lookbook prompt. Submit → onCreate(name); cancel closes.



// Preset tag suggestions, organised by category. Tap to add. These mirror
// the vocabulary the Stylist's auto-tag generation tends to produce, so
// manually-added presets feel consistent with AI-generated tags.
const PRESET_TAG_CATEGORIES = [
  { label: 'Occasion', tags: ['brunch', 'dinner', 'office', 'weekend', 'travel', 'wedding', 'date night', 'errands'] },
  { label: 'Mood', tags: ['polished', 'relaxed', 'playful', 'statement', 'classic', 'romantic', 'sharp'] },
  { label: 'Formality', tags: ['smart casual', 'business', 'black tie', 'leisure', 'cocktail'] },
  { label: 'Season', tags: ['summer evening', 'winter layers', 'spring light', 'autumn warm'] },
];

function OutfitDetailView({ outfit, items = [], onClose, onDelete, onDuplicate, onSaveOutfit, onShare, onExport, onVary, onEdit, onLogWear, onOpenItem, measurements, prevOutfitId = null, nextOutfitId = null, onPick = null, collections = [], onAddToCollection = null, onRemoveFromCollection = null, onCreateCollection = null }) {
  const [logVerdict, setLogVerdict] = useState('');
  const [logOccasion, setLogOccasion] = useState('');
  const [logBusy, setLogBusy] = useState(false);
  const [logDate, setLogDate] = useState(todayISO());
  const [logDateOpen, setLogDateOpen] = useState(false);
  const [styleFitBusy, setStyleFitBusy] = useState(false);
  const [styleFitError, setStyleFitError] = useState(null);
  const [view, setView] = useState('flatlay'); // 'flatlay' | 'grid'
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [wearLogExpanded, setWearLogExpanded] = useState(false);
  // After "I wore this", remember the logged date so we can offer an inline
  // "add a photo of this wear?" prompt — capture in the same breath as logging.
  const [justLoggedDate, setJustLoggedDate] = useState(null);
  const [paletteFilter, setPaletteFilter] = useState(null); // colour name or null
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [newCollectionNameDetail, setNewCollectionNameDetail] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const toast = useToast();
  const pieces = resolveOutfitItems(outfit, items);
  const total = pieces.reduce((sum, it) => sum + Number(it.price || 0), 0);
  const wornPhotos = Array.isArray(outfit.wornPhotos) ? outfit.wornPhotos : [];
  // Editorial substance for the header: when was this look saved? When was
  // it last worn? How many times? Magazines always credit their dates.
  const savedDate = outfit.createdAt ? new Date(outfit.createdAt) : null;
  const savedLabel = savedDate
    ? savedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: savedDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
    : null;
  // Derive outfit-level wear stats. Source of truth: outfit.wearLog
  // (added in P2.3 — written by handleLogOutfitWear). Legacy fallback:
  // scan items in the outfit, count dates where ≥50% of pieces share
  // a wear entry (heuristic for outfits logged before wearLog existed).
  const wearLogEntries = (() => {
    if (Array.isArray(outfit.wearLog) && outfit.wearLog.length > 0) {
      return outfit.wearLog;
    }
    // Legacy backfill: derive from items' wearHistory union
    const dateCounts = new Map();
    for (const piece of pieces) {
      const hist = itemWearHistory(piece);
      for (const d of hist) dateCounts.set(d, (dateCounts.get(d) || 0) + 1);
    }
    const threshold = Math.max(1, Math.ceil(pieces.length / 2));
    return [...dateCounts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([date]) => ({ date }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })();
  const totalWears = wearLogEntries.length;
  const photosCount = wornPhotos.length;
  // wearCount and lastWornISO now come from wearLog (or legacy backfill),
  // not just wornPhotos, so a wear without a photo is counted correctly.
  const wearCount = totalWears;
  const lastWornISOFromLog = wearLogEntries.length > 0 ? wearLogEntries[wearLogEntries.length - 1].date : null;
  const lastWornISO = lastWornISOFromLog;
  const lastWornLabel = lastWornISO ? (() => {
    const t = todayISO();
    if (lastWornISO === t) return 'today';
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (lastWornISO === y.toISOString().slice(0, 10)) return 'yesterday';
    const d = new Date(lastWornISO + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  })() : null;

  const handleAddWornPhoto = async (e, dateISO) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ''; // reset so re-picking the same file fires onChange again
    if (!file || !onSaveOutfit) return;
    if (wornPhotos.length >= 6) { toast.show('6 photos max per look', { kind: 'error', eyebrow: 'LIMIT' }); return; }
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 700, maxBytes: 80_000, enhance: false });
      // Attach to the wear's ACTUAL date (the selected log date, or a specific
      // past wear) — not always "today". Otherwise a back-dated wear's photo
      // files under the wrong day and won't pair with its wear-log entry.
      const when = dateISO || todayISO();
      // Save the photo immediately so the UI updates fast; then narrate
      // in the background and patch the caption in once Gemini responds.
      // If narration fails, the photo just sits without a caption — no
      // error surfaced. AI is additive flavour, not a critical path.
      const photoEntry = { date: when, image: dataUrl };
      const next = [...wornPhotos, photoEntry];
      await onSaveOutfit({ ...outfit, wornPhotos: next });
      setJustLoggedDate(null); // a photo answers the post-log prompt
      toast.show('Photo added', { kind: 'success', eyebrow: 'CAPTURED' });
      const itemNames = pieces.map((p) => p.name);
      const caption = await generateWearNarration({
        outfit,
        intent: outfit?.intent || '',
        eventName: '',
        dateISO: when,
        itemNames,
      });
      if (caption) {
        const patched = next.map((p, i) => i === next.length - 1 ? { ...p, caption } : p);
        await onSaveOutfit({ ...outfit, wornPhotos: patched });
      }
    } catch (err) {
      toast.show(err?.message || 'Could not add photo', { kind: 'error' });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeWornPhoto = async (idx) => {
    if (!onSaveOutfit) return;
    const next = wornPhotos.filter((_, i) => i !== idx);
    await onSaveOutfit({ ...outfit, wornPhotos: next });
  };
  // Keyboard navigation: ← → to flip between sibling looks
  useEffect(() => {
    const handler = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && prevOutfitId) {
        e.preventDefault();
        onPick?.(prevOutfitId);
      } else if (e.key === 'ArrowRight' && nextOutfitId) {
        e.preventDefault();
        onPick?.(nextOutfitId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevOutfitId, nextOutfitId, onPick]);

  // Compute colour palette here (used in both render and later for Commit 3 filter)
  const colourPalette = (() => {
    const counts = new Map();
    for (const piece of pieces) {
      for (const c of (itemColors(piece) || [])) {
        const key = (c || '').toLowerCase().trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count, hex: hexFromColorName(name) }));
  })();

  return (
    <div className="fixed inset-0 bg-[#F7F5F2] z-50 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      {/* Prev/next navigation — fixed at viewport edges. Hidden on mobile
          where edge-tap conflicts with normal scroll/swipe gestures. */}
      {prevOutfitId && (
        <button
          type="button"
          onClick={() => onPick?.(prevOutfitId)}
          aria-label="Previous look"
          className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 items-center justify-center rounded-full bg-white/85 backdrop-blur border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-white shadow-md transition-all hover:scale-105"
        >
          <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
        </button>
      )}
      {nextOutfitId && (
        <button
          type="button"
          onClick={() => onPick?.(nextOutfitId)}
          aria-label="Next look"
          className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 items-center justify-center rounded-full bg-white/85 backdrop-blur border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-white shadow-md transition-all hover:scale-105"
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      )}
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-[#F7F5F2]/85 backdrop-blur-md border-b border-stone-200/60 pt-safe">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-3 sm:p-4 lg:p-6 gap-3">
          <button onClick={onClose} className="flex items-center gap-2 pl-2 pr-3 sm:pl-3 sm:pr-4 py-2 rounded-full text-xs sm:text-sm tracking-wide text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 transition-colors">
            <ChevronRight size={16} strokeWidth={1.5} className="rotate-180" />
            <span className="hidden sm:inline">Back to Lookbook</span>
            <span className="sm:hidden">Back</span>
          </button>
          {!confirmDelete ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {onSaveOutfit && (
                <button
                  onClick={() => onSaveOutfit({ ...outfit, favorite: !outfit.favorite })}
                  className={`p-2.5 rounded-full transition-colors duration-200 ${
                    outfit.favorite
                      ? 'bg-brass-300 text-stone-900'
                      : 'text-stone-400 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                  aria-label={outfit.favorite ? 'Remove favourite' : 'Add to favourites'}
                  title={outfit.favorite ? 'Remove favourite' : 'Add to favourites'}
                >
                  <Star size={16} strokeWidth={1.5} className={outfit.favorite ? 'fill-stone-900' : ''} />
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit}
                  className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors duration-200 inline-flex items-center gap-2 whitespace-nowrap"
                  title="Edit this look in the Studio">
                  <Pencil size={15} strokeWidth={1.5} />
                  <span className="hidden md:inline">Edit</span>
                </button>
              )}
              {onVary && isAIEnabled() && (
                <button onClick={onVary}
                  className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm bg-brass-300 text-stone-900 hover:bg-brass-200 transition-colors duration-200 inline-flex items-center gap-2 whitespace-nowrap font-medium"
                  title="Spin a variation of this look with the Concierge">
                  <Wand2 size={15} strokeWidth={1.5} />
                  <span className="hidden md:inline">Vary look</span>
                </button>
              )}
              {onExport && (
                <button onClick={onExport}
                  className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors duration-200 inline-flex items-center gap-2 whitespace-nowrap"
                  title="Preview, then share or save this look">
                  <Share2 size={15} strokeWidth={1.5} />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}
              {/* Overflow menu: Restyle · Duplicate · Delete */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setToolbarMenuOpen((v) => !v)}
                  aria-label="More actions"
                  className="p-2.5 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors duration-200"
                >
                  <MoreHorizontal size={16} strokeWidth={1.5} />
                </button>
                {toolbarMenuOpen && (
                  <>
                    {/* Backdrop to dismiss */}
                    <div className="fixed inset-0 z-40" onClick={() => setToolbarMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-stone-200 py-1.5 min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-200">
                      <button type="button"
                        onClick={async () => { setToolbarMenuOpen(false); await onDuplicate?.(); toast.show('Duplicated · edit anytime', { kind: 'success' }); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors flex items-center gap-3">
                        <Copy size={14} strokeWidth={1.5} className="text-stone-400" />
                        Duplicate
                      </button>
                      <div className="border-t border-stone-100 my-1" />
                      <button type="button" onClick={() => { setToolbarMenuOpen(false); setConfirmDelete(true); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3">
                        <Trash2 size={14} strokeWidth={1.5} />
                        Delete look
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={async () => { await onDelete(); toast.show('Look deleted', { kind: 'success' }); }} className="px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm bg-red-600 text-white hover:bg-red-700 transition-colors duration-200 whitespace-nowrap">Delete look</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm text-stone-500 hover:text-stone-900 transition-colors duration-200">Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout: hero LEFT, editorial column RIGHT */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16">

          {/* ── LEFT COLUMN: Look hero (60%) ── */}
          <div className="lg:col-span-7">
            {/* View toggle — small pill, top-right of the look region */}
            <div className="flex justify-end mb-3">
              <div className="flex bg-stone-200/50 p-1 rounded-full text-[10px] tracking-wider uppercase">
                <button onClick={() => setView('flatlay')}
                  className={`px-3 py-1.5 rounded-full transition-colors duration-200 ${view === 'flatlay' ? 'bg-white text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}>
                  Flat-lay
                </button>
                <button onClick={() => setView('grid')}
                  className={`px-3 py-1.5 rounded-full transition-colors duration-200 ${view === 'grid' ? 'bg-white text-stone-900 font-medium' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}>
                  Grid
                </button>
              </div>
            </div>

            {view === 'flatlay' ? (
              <OutfitFlatLay pieces={pieces} onOpenItem={onOpenItem} paletteFilter={paletteFilter} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 md:gap-6">
                {pieces.map((piece, i) => {
                  const openable = !!(onOpenItem && piece.id);
                  const Tag = openable ? 'button' : 'div';
                  return (
                    <Tag
                      key={piece.id || i}
                      {...(openable ? { type: 'button', onClick: () => onOpenItem(piece.id), 'aria-label': `Open ${piece.name}` } : {})}
                      className={`flex flex-col gap-3 text-left ${openable ? 'group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded-2xl' : ''}`}
                    >
                      <div className={`aspect-[3/4] rounded-2xl overflow-hidden bg-white border border-stone-200/60 transition-colors duration-300 ${openable ? 'lg:group-hover:border-brass-300/70' : ''}`}>
                        {itemImages(piece)[0] ? (
                          <ItemTileImage item={piece} alt={piece.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={40} strokeWidth={1} /></div>
                        )}
                      </div>
                      <div className="px-1">
                        <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">{piece.brand}</p>
                        <p className={`font-display text-base text-stone-800 leading-snug truncate ${openable ? 'group-hover:text-stone-700 transition-colors' : ''}`}>{piece.name}</p>
                        <p className="text-xs text-stone-500 mt-1">£{Number(piece.price || 0).toLocaleString()}</p>
                      </div>
                    </Tag>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Editorial intelligence (40%) ── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Eyebrow + title + subtitle */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="brass-rule" aria-hidden="true"></span>
                <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Saved Look</span>
              </div>
              {editingName ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const trimmed = draftName.trim();
                      if (trimmed && trimmed !== outfit.name) { onSaveOutfit({ ...outfit, name: trimmed }); }
                      setEditingName(false);
                    } else if (e.key === 'Escape') {
                      setEditingName(false);
                    }
                  }}
                  onBlur={() => {
                    const trimmed = draftName.trim();
                    if (trimmed && trimmed !== outfit.name) { onSaveOutfit({ ...outfit, name: trimmed }); }
                    setEditingName(false);
                  }}
                  className="w-full text-4xl sm:text-5xl lg:text-4xl xl:text-5xl font-display text-stone-900 tracking-tight leading-[1.05] bg-transparent border-b-2 border-brass-300 outline-none"
                />
              ) : (
                <h1
                  className="group text-4xl sm:text-5xl lg:text-4xl xl:text-5xl font-display text-stone-900 tracking-tight leading-[1.05] cursor-text hover:opacity-70 transition-opacity inline-flex items-start gap-2"
                  onClick={() => { setDraftName(outfit.name || ''); setEditingName(true); }}
                  title="Click to rename"
                >
                  {outfit.name}
                  <Pencil size={18} strokeWidth={1.5} className="opacity-0 group-hover:opacity-40 transition-opacity mt-2 shrink-0" aria-hidden="true" />
                </h1>
              )}
              {(outfit.intent || savedLabel) && (
                <p className="font-display italic text-stone-500 text-sm sm:text-base mt-3">
                  {[
                    outfit.intent ? `For ${outfit.intent}` : null,
                    savedLabel ? `Saved ${savedLabel}` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-[10px] text-stone-500 mt-2 tracking-[0.18em] uppercase">
                {`${pieces.length} pieces · £${total.toLocaleString()}`}
              </p>
            </div>

            {/* Unified Stylist's Note card */}
            {(outfit.reasoning || outfit.styleFit || onSaveOutfit) && (
              <div className="bg-white border border-stone-200/60 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="inline-block w-4 h-px bg-brass-400" aria-hidden="true" />
                  <span className="text-[11px] tracking-[0.28em] uppercase font-medium text-stone-700">Stylist's Note</span>
                </div>
                {outfit.reasoning && (
                  <div className="mb-4">
                    <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-1.5">On the composition</p>
                    <p className="text-sm italic text-stone-700 leading-relaxed">"{renderTextWithChips(outfit.reasoning, { items, onOpenItem })}"</p>
                  </div>
                )}
                {onSaveOutfit && (
                  <div className={outfit.reasoning ? 'pt-4 border-t border-stone-100' : ''}>
                    <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-1.5">On your style</p>
                    {outfit.styleFit ? (
                      <p className="text-sm italic text-stone-700 leading-relaxed">{renderTextWithChips(outfit.styleFit, { items, onOpenItem })}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (styleFitBusy) return;
                          setStyleFitBusy(true);
                          setStyleFitError(null);
                          try {
                            const manifesto = measurements?.styleManifesto || '';
                            const styleProfile = measurements?.styleProfile || '';
                            const note = await generateStyleFitWithGemini({ outfit, picked: pieces, manifesto, styleProfile });
                            if (note) {
                              await onSaveOutfit({ ...outfit, styleFit: note.trim() });
                            }
                          } catch (err) {
                            setStyleFitError(err?.message || 'Could not generate note');
                          } finally {
                            setStyleFitBusy(false);
                          }
                        }}
                        disabled={styleFitBusy}
                        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline transition-colors disabled:opacity-60"
                      >
                        <Sparkles size={11} strokeWidth={1.75} className="text-amber-500" />
                        {styleFitBusy ? 'Composing…' : '+ Add personal note'}
                      </button>
                    )}
                    {styleFitError && <p className="text-[11px] text-stone-500 mt-2 italic">{styleFitError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Colour palette — tappable: click to filter flat-lay by colour */}
            {colourPalette.length > 0 && (
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-block w-4 h-px bg-brass-400" aria-hidden="true" />
                  <span className="text-[11px] tracking-[0.28em] uppercase font-medium text-stone-700">Palette</span>
                  {paletteFilter && (
                    <button
                      type="button"
                      onClick={() => setPaletteFilter(null)}
                      className="text-[10px] tracking-wide text-stone-400 hover:text-stone-700 underline-offset-4 hover:underline transition-colors ml-1"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {colourPalette.map(({ name, count, hex }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPaletteFilter((cur) => cur === name ? null : name)}
                      className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all ${
                        paletteFilter === name
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white border-stone-200 text-stone-700 hover:border-stone-900'
                      }`}
                    >
                      <span
                        className={`block w-6 h-6 rounded-full border ${paletteFilter === name ? 'border-white' : 'border-stone-300/70'}`}
                        style={{ backgroundColor: hex }}
                        aria-hidden="true"
                      />
                      <span className="text-[11px] tracking-wide uppercase">
                        {name}
                        {count > 1 && <span className={paletteFilter === name ? 'text-white/60 ml-1.5' : 'text-stone-400 ml-1.5'}>× {count}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {((outfit.tags && outfit.tags.length > 0) || typeof onSaveOutfit === 'function') && (
              <div className="pt-5 border-t border-stone-200">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-block w-4 h-px bg-brass-400" aria-hidden="true" />
                    <span className="text-[11px] tracking-[0.28em] uppercase font-medium text-stone-700">Tags</span>
                  </div>
                  {typeof onSaveOutfit === 'function' && (
                    <button
                      type="button"
                      onClick={() => { setEditingTags((v) => !v); setNewTag(''); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-wide uppercase transition-colors ${
                        editingTags
                          ? 'bg-stone-900 text-white hover:bg-stone-700'
                          : 'bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900'
                      }`}
                    >
                      {editingTags ? (
                        <>
                          <Check size={12} strokeWidth={2} />
                          Done
                        </>
                      ) : (
                        <>
                          <Plus size={12} strokeWidth={2} />
                          {outfit.tags && outfit.tags.length > 0 ? 'Edit tags' : 'Add tags'}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {(outfit.tags || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(outfit.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-[11px] tracking-wide uppercase"
                      >
                        {tag}
                        {editingTags && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (outfit.tags || []).filter((t) => t !== tag);
                              onSaveOutfit?.({ ...outfit, tags: next });
                            }}
                            aria-label={`Remove ${tag}`}
                            className="text-stone-400 hover:text-stone-900 ml-0.5 leading-none transition-colors"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-stone-400 italic">No tags yet — add a few to find this look faster.</p>
                )}

                {editingTags && typeof onSaveOutfit === 'function' && (
                  <div className="mt-4 space-y-4">
                    {(outfit.tags || []).length < 8 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const t = newTag.trim().toLowerCase();
                          if (!t) return;
                          const existing = outfit.tags || [];
                          if (existing.includes(t)) { setNewTag(''); return; }
                          if (existing.length >= 8) return;
                          onSaveOutfit?.({ ...outfit, tags: [...existing, t] });
                          setNewTag('');
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Type a custom tag and press Enter"
                          maxLength={20}
                          className="flex-1 px-3 py-2 rounded-full bg-white border border-stone-300 text-stone-900 text-sm outline-none focus:border-stone-900 transition-colors"
                          style={{ fontSize: '16px' }}
                        />
                        <button
                          type="submit"
                          disabled={!newTag.trim()}
                          className="px-4 py-2 rounded-full bg-stone-900 text-white text-[11px] tracking-wide uppercase hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:hover:bg-stone-900"
                        >
                          Add
                        </button>
                      </form>
                    )}

                    <div className="space-y-3">
                      <p className="text-[10px] tracking-widest uppercase text-stone-400">Suggested</p>
                      {PRESET_TAG_CATEGORIES.map(({ label, tags }) => {
                        const available = tags.filter((t) => !(outfit.tags || []).includes(t));
                        if (available.length === 0) return null;
                        return (
                          <div key={label}>
                            <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-1.5">{label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {available.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  disabled={(outfit.tags || []).length >= 8}
                                  onClick={() => {
                                    const existing = outfit.tags || [];
                                    if (existing.includes(tag) || existing.length >= 8) return;
                                    onSaveOutfit?.({ ...outfit, tags: [...existing, tag] });
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-stone-300 text-stone-600 text-[11px] tracking-wide uppercase hover:border-stone-900 hover:text-stone-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <span aria-hidden="true" className="text-stone-400">+</span>
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(outfit.tags || []).length >= 8 && (
                      <p className="text-[10px] tracking-wide uppercase text-stone-400">Maximum of 8 tags reached.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Collections — which named moodboards this outfit belongs to.
                Mirrors the Tags affordance: same eyebrow, same pill pattern.
                Only shown when the parent passes the collection handlers. */}
            {typeof onAddToCollection === 'function' && (
              <div className="bg-white border border-stone-200/60 rounded-2xl p-5 sm:p-6 smooth-shadow">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="brass-rule" aria-hidden="true"></span>
                    <span className="text-[10px] tracking-[0.28em] uppercase font-medium text-stone-700">Collections</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAddToCollectionOpen((v) => !v); setNewCollectionNameDetail(''); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 text-[11px] tracking-wide uppercase hover:border-stone-900 transition-colors"
                  >
                    <Plus size={12} strokeWidth={2} /> {addToCollectionOpen ? 'Done' : 'Add to'}
                  </button>
                </div>
                {(() => {
                  const memberCollections = collections.filter((c) => c.outfitIds.includes(outfit.id));
                  if (memberCollections.length === 0 && !addToCollectionOpen) {
                    return <p className="text-[12px] text-stone-400 italic">Not in any collection yet.</p>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {memberCollections.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-[11px] tracking-wide uppercase">
                          {c.name}
                          {addToCollectionOpen && (
                            <button
                              type="button"
                              onClick={() => onRemoveFromCollection?.(c.id, outfit.id)}
                              className="text-stone-400 hover:text-stone-900 ml-0.5 leading-none transition-colors"
                              aria-label={`Remove from ${c.name}`}
                            >×</button>
                          )}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                {addToCollectionOpen && (
                  <div className="mt-3 space-y-2">
                    {collections.filter((c) => !c.outfitIds.includes(outfit.id)).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onAddToCollection?.(c.id, outfit.id)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-white border border-stone-200 hover:border-stone-900 text-sm text-stone-700 transition-colors flex items-center justify-between"
                      >
                        <span>{c.name}</span>
                        <span className="text-[10px] tracking-widest uppercase text-stone-400">{c.outfitIds.length} look{c.outfitIds.length === 1 ? '' : 's'}</span>
                      </button>
                    ))}
                    {typeof onCreateCollection === 'function' && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const name = newCollectionNameDetail.trim();
                          if (!name) return;
                          const id = await onCreateCollection(name, [outfit.id]);
                          if (id) setNewCollectionNameDetail('');
                          setAddToCollectionOpen(false);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          value={newCollectionNameDetail}
                          onChange={(e) => setNewCollectionNameDetail(e.target.value)}
                          placeholder="+ New collection name"
                          maxLength={50}
                          className="flex-1 px-3 py-2 rounded-lg bg-white border border-stone-300 text-sm outline-none focus:border-stone-900"
                          style={{ fontSize: '16px' }}
                        />
                        <button
                          type="submit"
                          disabled={!newCollectionNameDetail.trim()}
                          className="px-4 py-2 rounded-lg bg-stone-900 text-white text-[11px] tracking-wide uppercase hover:bg-stone-700 disabled:opacity-50"
                        >
                          Create
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Wear-this-look card — progressive disclosure */}
            {onLogWear && (
              <div className="bg-white border border-stone-200/60 rounded-2xl p-5 sm:p-6 smooth-shadow">
                {/* Always-visible header */}
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="brass-rule" aria-hidden="true"></span>
                      <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">Wear this look</span>
                    </div>
                    {wearCount > 0 && (
                      <p className="text-[10px] tracking-wide uppercase text-stone-400">
                        Worn {wearCount}× · last {lastWornLabel}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {/* Date chip + picker */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] tracking-widest uppercase text-stone-400">For</span>
                      <button
                        type="button"
                        onClick={() => setLogDateOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors"
                      >
                        <Calendar size={10} strokeWidth={1.75} />
                        {logDate === todayISO() ? 'Today' : new Date(logDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </button>
                    </div>
                    {logDateOpen && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => { setLogDate(todayISO()); setLogDateOpen(false); }}
                          className="px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase bg-white border border-stone-300 text-stone-700 hover:border-stone-900 transition-colors"
                        >Today</button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            setLogDate(d.toISOString().slice(0, 10));
                            setLogDateOpen(false);
                          }}
                          className="px-2.5 py-1 rounded-full text-[10px] tracking-wide uppercase bg-white border border-stone-300 text-stone-700 hover:border-stone-900 transition-colors"
                        >Yesterday</button>
                        <input
                          type="date"
                          value={logDate}
                          max={todayISO()}
                          onChange={(e) => { if (e.target.value) { setLogDate(e.target.value); setLogDateOpen(false); } }}
                          className="px-2 py-1 rounded-full text-[10px] tracking-wide bg-white border border-stone-300 text-stone-700 outline-none focus:border-stone-900"
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                    )}
                    {/* Big log button */}
                    <button
                      type="button"
                      disabled={logBusy}
                      onClick={async () => {
                        setLogBusy(true);
                        try {
                          // onLogWear (handleLogOutfitWear) already shows its own
                          // "WORN" confirmation toast, plus an optional Concierge
                          // narration line — a third confirmation toast here just
                          // stacked on top and crowded out the narration before
                          // it could be read. Don't duplicate the confirmation.
                          await onLogWear(logDate, logVerdict, logOccasion);
                          setJustLoggedDate(logDate); // offer the photo prompt for this wear
                          setLogVerdict(''); setLogOccasion(''); setLogDate(todayISO()); setWearLogExpanded(false);
                        } catch (err) {
                          toast.show(err?.message || 'Could not log wear', { kind: 'error' });
                        } finally { setLogBusy(false); }
                      }}
                      className="text-[10px] tracking-widest uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors duration-200 disabled:opacity-40 flex items-center gap-2 font-medium"
                    >
                      <Calendar size={13} strokeWidth={1.5} />
                      {logBusy ? 'Logging…' : (logDate === todayISO() ? 'I wore this today' : 'Log this wear')}
                    </button>
                  </div>
                </div>

                {/* Collapsed: small expand link */}
                {!wearLogExpanded && (
                  <button
                    type="button"
                    onClick={() => setWearLogExpanded(true)}
                    className="text-[11px] tracking-wide text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline transition-colors"
                  >
                    + Add a note or occasion
                  </button>
                )}

                {/* Expanded: full form */}
                {wearLogExpanded && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    {/* Occasion */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-medium">
                        Occasion <span className="text-stone-400 normal-case tracking-normal">(optional — what was the day?)</span>
                      </label>
                      <input
                        value={logOccasion}
                        onChange={(e) => setLogOccasion(e.target.value)}
                        placeholder="e.g. gallery opening, client lunch, Sunday at home…"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:border-stone-900 outline-none transition-colors"
                        style={{ fontSize: '16px' }}
                        maxLength={60}
                      />
                    </div>
                    {/* Verdict chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_VERDICT_CHIPS.map((c) => (
                        <button key={c} type="button"
                          onClick={() => setLogVerdict((cur) => cur.trim() ? `${cur.trim()}, ${c.toLowerCase()}` : c)}
                          className="text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 transition-colors duration-200">
                          {c}
                        </button>
                      ))}
                    </div>
                    {/* Verdict free-text */}
                    <input
                      value={logVerdict}
                      onChange={(e) => setLogVerdict(e.target.value)}
                      placeholder="Optional verdict — applies to every piece…"
                      maxLength={120}
                      className="w-full text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition-colors"
                    />
                    {/* Collapse link */}
                    <button
                      type="button"
                      onClick={() => setWearLogExpanded(false)}
                      className="text-[11px] tracking-wide text-stone-400 hover:text-stone-700 underline-offset-4 hover:underline transition-colors"
                    >
                      − Hide options
                    </button>
                  </div>
                )}

                {/* Post-log prompt — capture a photo in the same moment as logging,
                    attached to the wear's actual date. */}
                {justLoggedDate && wornPhotos.length < 6 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass-200 bg-brass-50/60 p-3 animate-in fade-in duration-200">
                    <span className="flex items-center gap-2 min-w-0 text-xs text-stone-700">
                      <Check size={14} strokeWidth={2} className="shrink-0 text-emerald-600" />
                      Logged{justLoggedDate === todayISO() ? ' for today' : ` for ${new Date(justLoggedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}. Add a photo of this wear?
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-white transition-colors hover:bg-stone-700">
                        <Camera size={13} strokeWidth={1.5} /> {photoBusy ? 'Adding…' : 'Add photo'}
                        <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => handleAddWornPhoto(e, justLoggedDate)} />
                      </label>
                      <button type="button" onClick={() => setJustLoggedDate(null)} className="text-[10px] uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-700">Not now</button>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Worn photos strip */}
            <div className="pt-5 border-t border-stone-200">
              <div className="flex items-baseline justify-between mb-4 gap-3">
                <div className="flex items-center gap-3">
                  <span className="brass-rule" aria-hidden="true"></span>
                  <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">
                    {totalWears === 0 ? 'Wore this · not yet' : `Wore this · ${totalWears}`}
                    {photosCount > 0 && (
                      <span className="text-stone-400 normal-case tracking-wide ml-2">({photosCount} with photo)</span>
                    )}
                  </span>
                </div>
              </div>
              {/* Date chips for wears that don't have a corresponding photo.
                  Rendered above the photo strip so the user can see ALL
                  their wears at a glance even without photos. */}
              {wearLogEntries.length > 0 && wearLogEntries.some((w) => !wornPhotos.find((p) => p.date === w.date)) && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {wearLogEntries
                    .filter((w) => !wornPhotos.find((p) => p.date === w.date))
                    .slice(-8)
                    .map((w) => (
                      <label
                        key={w.date}
                        className="inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-600 text-[10px] tracking-wide uppercase hover:border-stone-500 hover:text-stone-900 transition-colors"
                        title={`Add a photo for ${w.occasion ? `${w.date} · ${w.occasion}` : w.date}`}
                      >
                        <Calendar size={10} strokeWidth={1.75} />
                        {(() => {
                          const d = new Date(w.date + 'T00:00:00');
                          return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                        })()}
                        {w.occasion && <span className="text-stone-400 normal-case tracking-normal">· {w.occasion}</span>}
                        <Camera size={10} strokeWidth={1.75} className="text-stone-400" />
                        <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => handleAddWornPhoto(e, w.date)} />
                      </label>
                    ))}
                </div>
              )}
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {/* Discoverable capture: a camera tile leads the strip, tied to the
                    selected log date so the photo files under the right day. */}
                {wornPhotos.length < 6 && (
                  <label className="group flex-none w-24 sm:w-28 cursor-pointer">
                    <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 flex flex-col items-center justify-center gap-1.5 text-stone-400 group-hover:border-stone-500 group-hover:text-stone-700 transition-colors">
                      <Camera size={22} strokeWidth={1.5} />
                      <span className="text-[10px] tracking-widest uppercase">{photoBusy ? 'Adding…' : 'Add photo'}</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" disabled={photoBusy} onChange={(e) => handleAddWornPhoto(e, logDate)} />
                  </label>
                )}
                {wornPhotos.map((p, i) => (
                  <div key={i} className="flex-none w-24 sm:w-28 group relative">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 smooth-shadow">
                      <img src={p.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1.5 tracking-wider">
                      {new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <button onClick={() => removeWornPhoto(i)} className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur text-stone-400 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                      <X size={11} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
              {wornPhotos.length === 0 && (
                <p className="mt-3 text-xs text-stone-400 italic">Snap a photo when you wear this look — your private record of what actually got worn.</p>
              )}
            </div>
          </div>
          {/* ── End right column ── */}

        </div>
      </div>
    </div>
  );
}

// Styled flat-lay: items get deterministic-by-id transforms (rotation, scale,
// vertical offset) so the same outfit always renders identically but each
// look feels uniquely composed. Names render below in a clean list to keep the
// canvas itself uncluttered. Uses category-aware sizing — outerwear larger,
// jewellery smaller — mimicking a real flat-lay arrangement.
function OutfitFlatLay({ pieces, onOpenItem, paletteFilter = null }) {
  // Helper: does this piece have a colour matching the active palette filter?
  const pieceMatchesFilter = (piece) => {
    if (!paletteFilter) return true;
    const colours = (itemColors(piece) || []).map((c) => (c || '').toLowerCase().trim());
    return colours.includes(paletteFilter);
  };
  // MAGAZINE SPREAD — the Net-a-Porter "Complete the Look" / Mr Porter
  // "The Edit" / Vogue "What to Wear" convention. Asymmetric editorial
  // grid with three regions:
  //
  //   HERO        — one signature piece (Outerwear / Dress / Top), large,
  //                 left column on desktop. The editor's pick.
  //   GARMENTS    — supporting garments (top, bottom, shoes, bag) in a
  //                 tight 2-column grid to the right of the hero.
  //   ACCESSORIES — sunglasses, jewellery, watches in a 4-6 column strip
  //                 at the bottom, smaller cells.
  //
  // Every cell carries TYPOGRAPHIC EDITORIAL CREDITS: a numbered tag
  // (N°01, N°02 in italic serif), the brand in small-caps, and the
  // item name below the photo. Typography is a co-equal design element,
  // not an afterthought — that's what separates a stylist's edit from
  // a product grid.
  //
  // The container snug-wraps the content (no max-width sprawl), uses
  // an atmospheric warm-radial backdrop (raked styling light), and each
  // cell is a polaroid-rounded white frame with a layered shadow so
  // pieces cast presence on the styled surface.

  const HERO_PRIORITY = ['Outerwear', 'Dresses', 'Swimwear', 'Tops'];
  const ACCESSORY_CATEGORIES = new Set(['Accessories', 'Jewellery']);
  const ORDER = ['Outerwear', 'Dresses', 'Tops', 'Swimwear', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
  const sortByOrder = (a, b) => {
    const ai = ORDER.indexOf(a.category); const bi = ORDER.indexOf(b.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  };

  // Pick hero: first piece by HERO_PRIORITY that exists in the outfit.
  // Fallback: first piece period.
  let hero = null;
  for (const cat of HERO_PRIORITY) {
    const found = pieces.find((p) => p.category === cat);
    if (found) { hero = found; break; }
  }
  if (!hero && pieces.length > 0) hero = pieces[0];

  const rest = pieces.filter((p) => p !== hero).sort(sortByOrder);
  const garments = rest.filter((p) => !ACCESSORY_CATEGORIES.has(p.category));
  const accessories = rest.filter((p) => ACCESSORY_CATEGORIES.has(p.category));

  // Number every piece in display order for the editorial N°XX badges.
  const orderedAll = [hero, ...garments, ...accessories].filter(Boolean);
  const numberOf = new Map(orderedAll.map((p, i) => [p, i + 1]));

  // Single editorial cell. Photograph above, credit caption below.
  // The credit block carries the editorial signature — N° tag in italic
  // serif, brand in small-caps, item name in display serif. Reads like
  // a magazine page no matter the photography quality.
  const Cell = ({ item, isHero = false }) => {
    if (!item) return null;
    const openable = !!(onOpenItem && item.id);
    const Tag = openable ? 'button' : 'div';
    const n = numberOf.get(item) || 0;
    const dimmed = !pieceMatchesFilter(item);
    return (
      <div className={`transition-opacity duration-300 ${dimmed ? 'opacity-30' : 'opacity-100'}`}>
        <Tag
          {...(openable ? { type: 'button', onClick: () => onOpenItem(item.id), 'aria-label': `Open ${item.name}` } : {})}
          className={`group block w-full text-left ${openable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-500 focus-visible:ring-offset-4 rounded-2xl' : ''}`}
        >
          {/* Polaroid frame: rounded white card, hairline ring, layered
              shadow so the piece sits on the surface. Hero gets a slightly
              larger radius to feel weightier. */}
          <div className={`relative ${isHero ? 'aspect-[3/4]' : 'aspect-[3/4]'} ${isHero ? 'rounded-[1.5rem]' : 'rounded-[1.125rem]'} bg-white overflow-hidden ring-1 ring-stone-200/70 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-12px_rgba(28,25,23,0.18)] transition-shadow duration-300 group-hover:shadow-[0_2px_4px_rgba(28,25,23,0.06),0_16px_36px_-12px_rgba(28,25,23,0.22)]`}>
            {/* N°XX tag — italic serif, the editorial signature */}
            <span className={`absolute ${isHero ? 'top-3 left-4 text-xs' : 'top-2 left-3 text-[10px]'} tracking-[0.15em] text-stone-400 font-display italic z-10`}>
              N°{String(n).padStart(2, '0')}
            </span>
            {itemImages(item)[0] ? (
              // Feed the cut-out/framed image when the item has one (already
              // white-backed) so it sits seamlessly on the flat-lay card; falls
              // back to the original. The card is object-contain by design.
              <img src={itemImageDisplay(item, 0).src || itemImages(item)[0]} alt={item.name} loading="lazy" decoding="async"
                className={`w-full h-full object-contain ${isHero ? 'p-2' : 'p-1.5'}`} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={isHero ? 64 : 28} strokeWidth={1} /></div>
            )}
          </div>
          {/* CREDIT CAPTION — brand in small-caps, item name in display
              serif. The typography pair magazines use universally. */}
          <div className={`${isHero ? 'mt-3 px-1' : 'mt-2 px-0.5'}`}>
            <p className={`${isHero ? 'text-[10px]' : 'text-[9px]'} tracking-[0.2em] uppercase text-stone-500 truncate`}>{item.brand || item.category}</p>
            <p className={`font-display ${isHero ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'} text-stone-900 leading-tight truncate ${openable ? 'group-hover:text-brass-700 transition-colors' : ''}`}>{item.name}</p>
          </div>
        </Tag>
      </div>
    );
  };

  return (
    <div>
      {/* Atmospheric backdrop — warm radial highlight from upper-left
          like soft window light raking across a styled surface. */}
      <div
        className="relative rounded-[2rem] border border-stone-200/60 px-3 sm:px-5 md:px-7 lg:px-8 py-5 sm:py-7 md:py-8 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 90% 70% at 20% 0%, #FBFAF7 0%, #F4F0E8 55%, #ECE6D8 100%)',
        }}
      >
        {pieces.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-stone-300">
            <Shirt size={64} strokeWidth={1} />
          </div>
        ) : (
          // 12-col editorial grid. Hero spans 5 cols on desktop (left),
          // garments occupy the remaining 7 in a 2-col sub-grid (top
          // right), accessories full-width strip below. On mobile,
          // everything stacks single-column for legibility.
          <div className="grid grid-cols-12 gap-x-4 gap-y-6 sm:gap-x-5 sm:gap-y-7 md:gap-x-6 md:gap-y-8 max-w-5xl mx-auto">
            {/* HERO */}
            {hero && (
              <div className="col-span-12 sm:col-span-6 md:col-span-5">
                <Cell item={hero} isHero />
              </div>
            )}
            {/* SUPPORTING GARMENTS — 2-col sub-grid right of hero on
                desktop, full-width 2-col on mobile. self-start so the
                grid hugs the top of the hero, not stretching to match
                hero's height. */}
            {garments.length > 0 && (
              <div className={`${hero ? 'col-span-12 sm:col-span-6 md:col-span-7' : 'col-span-12'} grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-5 self-start`}>
                {garments.map((p, i) => (
                  <Cell key={p.id || `g${i}`} item={p} />
                ))}
              </div>
            )}
            {/* ACCESSORIES STRIP — runs full width below the hero+garments
                block. Smaller cells (4-6 cols) so jewellery doesn't dwarf
                the garments. Always at the bottom of the spread, like
                the accessory credits at the end of a magazine page. */}
            {accessories.length > 0 && (
              <div className="col-span-12 grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {accessories.map((p, i) => (
                  <Cell key={p.id || `a${i}`} item={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Credits list — items grouped by category, each group a self-contained
          editorial block. Thumbnails make it scan-able; single eyebrow per
          category eliminates the repetition that read as a flat database table.
          On desktop the groups still flow into two columns via columns-2 css
          (each group is a single column-break-inside unit so it never splits
          mid-group). */}
      {(() => {
        // Group by category, preserve the orderedAll sort within each group.
        const grouped = new Map();
        for (const p of orderedAll) {
          const cat = p.category || 'Other';
          if (!grouped.has(cat)) grouped.set(cat, []);
          grouped.get(cat).push(p);
        }
        return (
          <div className="mt-8 sm:columns-2 sm:gap-x-10 space-y-6 sm:space-y-0">
            {[...grouped.entries()].map(([category, items]) => (
              <div key={category} className="break-inside-avoid mb-6 sm:mb-8">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
                  <span className="text-[10px] tracking-[0.28em] uppercase font-medium text-stone-600">{category}</span>
                  <span className="text-[10px] text-stone-300">·</span>
                  <span className="text-[10px] tracking-wide text-stone-400">{items.length}</span>
                </div>
                <ul className="space-y-0">
                  {items.map((p, i) => {
                    const openable = !!(onOpenItem && p.id);
                    const thumb = itemImages(p)[0];
                    const Tag = openable ? 'button' : 'div';
                    const creditsDimmed = !pieceMatchesFilter(p);
                    return (
                      <li key={p.id || i} className={`border-b border-stone-200/50 last:border-0 transition-opacity duration-300 ${creditsDimmed ? 'opacity-30' : 'opacity-100'}`}>
                        <Tag
                          {...(openable ? { type: 'button', onClick: () => onOpenItem(p.id), 'aria-label': `Open ${p.name}` } : {})}
                          className={`w-full flex items-center gap-3 py-2.5 text-left ${openable ? 'group cursor-pointer hover:bg-stone-100/50 -mx-2 px-2 rounded-lg transition-colors' : ''}`}
                        >
                          {/* Thumbnail */}
                          <div className="w-11 h-11 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden shrink-0">
                            {thumb ? (
                              <ItemTileImage item={p} alt={p.name || ""} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <Shirt size={18} strokeWidth={1} />
                              </div>
                            )}
                          </div>
                          {/* Name + brand */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm text-stone-900 truncate leading-tight ${openable ? 'group-hover:text-brass-700 transition-colors' : ''}`}>
                              {p.name}
                            </p>
                            <p className="text-[10px] tracking-wider uppercase text-stone-500 truncate mt-0.5">
                              {p.brand || ' '}
                            </p>
                          </div>
                          {/* Price */}
                          <span className="text-xs tabular-nums text-stone-500 shrink-0">
                            £{Number(p.price || 0).toLocaleString()}
                          </span>
                          {openable && (
                            <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0 group-hover:text-brass-500 transition-colors" />
                          )}
                        </Tag>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}



// Style manifesto card — Gemini-written 3-paragraph aesthetic brief from the
// user's actual wear history. Cached on the profile doc. User regenerates when
// they feel their taste has shifted.

const QUICK_VERDICT_CHIPS = ['Felt great', 'Too warm', 'Too cold', 'Restyle', 'Waistband loose', 'Compliments'];
function WearVerdictInput({ initial, onSave, initialOccasion, onSaveOccasion }) {
  const [text, setText] = useState(initial || '');
  const [saved, setSaved] = useState(!!initial);
  const lastSentRef = React.useRef(initial || '');

  const [occasion, setOccasion] = useState(initialOccasion || '');
  const lastOccasionRef = React.useRef(initialOccasion || '');

  useEffect(() => { setText(initial || ''); lastSentRef.current = initial || ''; }, [initial]);
  useEffect(() => { setOccasion(initialOccasion || ''); lastOccasionRef.current = initialOccasion || ''; }, [initialOccasion]);

  useEffect(() => {
    if (text === lastSentRef.current) return;
    const t = setTimeout(() => {
      lastSentRef.current = text;
      onSave?.(text);
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [text, onSave]);

  useEffect(() => {
    if (occasion === lastOccasionRef.current) return;
    const t = setTimeout(() => {
      lastOccasionRef.current = occasion;
      onSaveOccasion?.(occasion);
    }, 600);
    return () => clearTimeout(t);
  }, [occasion, onSaveOccasion]);

  const addChip = (c) => {
    setSaved(false);
    setText((cur) => cur.trim() ? `${cur.trim()}, ${c.toLowerCase()}` : c);
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
      {onSaveOccasion && (
        <div className="space-y-1.5">
          <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-medium">
            Occasion <span className="text-stone-400 normal-case tracking-normal">(optional — what was the day?)</span>
          </label>
          <input
            type="text"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="e.g. gallery opening, client lunch, Sunday at home…"
            className="w-full text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition-all text-stone-900 placeholder:text-stone-400"
            style={{ fontSize: '16px' }}
            maxLength={60}
          />
        </div>
      )}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] tracking-widest uppercase text-stone-500">Today's verdict <span className="text-stone-400 normal-case tracking-normal">(optional)</span></p>
          {saved && text && <span className="text-[10px] text-emerald-700 tracking-wider uppercase">Saved</span>}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_VERDICT_CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => addChip(c)}
              className="text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 transition-all">
              {c}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => { setSaved(false); setText(e.target.value); }}
          placeholder="e.g. felt great, restyle next time…"
          className="w-full text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition-all text-stone-900 placeholder:text-stone-400"
          maxLength={120}
        />
      </div>
    </div>
  );
}

// One-time prompt to install Atelier as a PWA. Two paths:
//   - Chrome/Edge/Android: the browser fires `beforeinstallprompt`; we capture
//     the event and trigger the native prompt on tap.
//   - iOS Safari: no event exists. We sniff (iPhone/iPad + Safari + not in
//     standalone mode) and show the manual Share → Add to Home Screen guide.
// Dismissal persists in localStorage so the user never sees it twice.
// Footer rendered on every public share page. Optionally credits the
// publisher of this deployment (VITE_PUBLISHER_NAME / VITE_PUBLISHER_URL).
// Falls back to a plain "Made with Atelier" if no publisher set.
// Conversion CTA for the public share page — turns a cold visitor (who just
// admired a shared look) into a trial, instead of punting them to the login wall.
function PublicShareCTA() {
  return (
    <div className="mt-16 sm:mt-20 rounded-[2rem] bg-stone-900 text-white px-6 py-10 sm:px-12 sm:py-14 text-center">
      <p className="text-[10px] tracking-[0.28em] uppercase text-[#D4B378] mb-3">Styled by Atelier</p>
      <h2 className="font-display text-2xl sm:text-3xl leading-tight">Build looks like this from your own wardrobe</h2>
      <p className="text-stone-300 text-sm sm:text-base max-w-md mx-auto leading-relaxed mt-3 mb-7">
        Atelier styles your real pieces into outfits, reads your colour story, and writes your private Style Manifesto — see your Style DNA in minutes.
      </p>
      <a href="https://myatelier.style" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-[#D4B378] text-stone-900 text-xs tracking-[0.18em] uppercase font-medium hover:bg-[#c9a85f] transition-colors">
        Start your free trial
      </a>
      <p className="text-[10px] tracking-widest uppercase text-stone-500 mt-4">14-day free trial</p>
    </div>
  );
}

function PublicShareFooter() {
  const publisher = import.meta.env.VITE_PUBLISHER_NAME?.trim();
  const publisherUrl = import.meta.env.VITE_PUBLISHER_URL?.trim();
  return (
    <footer className="mt-20 pt-8 border-t border-stone-200 text-center text-xs tracking-wider uppercase text-stone-400 space-y-1">
      <p>Read-only view · made with Atelier</p>
      {publisher && (
        <p>
          Personal project by{' '}
          {publisherUrl ? (
            <a href={publisherUrl} target="_blank" rel="noopener noreferrer"
              className="text-stone-600 hover:text-stone-900 underline decoration-stone-300 underline-offset-2 transition-colors">
              {publisher}
            </a>
          ) : (
            <span className="text-stone-600">{publisher}</span>
          )}
        </p>
      )}
    </footer>
  );
}

// Public read-only viewer for a shared outfit. Reads /public/{shareId}; no auth
// required. Self-contained — uses only the embedded snapshot, no further reads.
function PublicShareView({ shareId }) {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getDoc(publicShareDoc(shareId));
        if (cancelled) return;
        if (!d.exists()) { setState({ status: 'not-found', data: null }); return; }
        setState({ status: 'ok', data: d.data() });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', data: null, error: e?.message });
      }
    })();
    return () => { cancelled = true; };
  }, [shareId]);

  if (state.status === 'loading') return <FullScreenLoader label="Loading shared look" />;
  if (state.status === 'not-found') {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 rounded-[2rem] p-10 max-w-md text-center smooth-shadow">
          <Shirt size={48} strokeWidth={1} className="mx-auto text-stone-300 mb-4" />
          <h1 className="font-display text-2xl text-stone-900">Look unavailable</h1>
          <p className="text-stone-500 text-sm mt-2">This share link has expired or was removed.</p>
          <a href="/" className="inline-block mt-6 text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900">Visit Atelier</a>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-6">
        <p className="text-sm text-red-700">{state.error || 'Could not load this look.'}</p>
      </div>
    );
  }

  const { kind, name, reasoning, sharedByName, sharedAt, pieces = [], looks = [] } = state.data;
  const sharedDate = sharedAt ? new Date(sharedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const isLookbook = kind === 'lookbook';
  const isItem = kind === 'item';

  // Dedicated single-item view — when a wishlist piece is shared for opinions.
  if (isItem) {
    const data = state.data;
    const itemImages = Array.isArray(data.images) ? data.images : [];
    return (
      <div className="min-h-screen bg-[#F7F5F2] font-sans text-stone-900">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
          .font-display { font-family: 'Playfair Display', serif; }
          .font-sans { font-family: 'Jost', sans-serif; }
          .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        `}</style>
        <header className="border-b border-stone-200/60 bg-white">
          <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AtelierMark size={36} />
              <span className="font-display text-2xl">Atelier<span className="text-[#D4B378]">.</span></span>
            </div>
            <a href="/" className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900">Visit</a>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-10 sm:py-16">
          <p className="text-[10px] font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">
            {data.status === 'wishlist' ? 'Wishlist · ' : ''}Shared by {sharedByName || 'a friend'}{sharedDate ? ` · ${sharedDate}` : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mt-6">
            <div className="space-y-3">
              <div className="aspect-[3/4] rounded-3xl bg-stone-100 overflow-hidden smooth-shadow border border-brass-300">
                {itemImages[0] ? (
                  <img src={itemImages[0]} alt={name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={64} strokeWidth={1} /></div>
                )}
              </div>
              {itemImages.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {itemImages.slice(1).map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              {data.brand && <p className="text-xs font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">{data.brand}</p>}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display text-stone-900 leading-tight">{name}</h1>
              <div className="flex items-center gap-3 mt-5 flex-wrap">
                {data.price > 0 && <p className="text-2xl font-display font-medium">£{Number(data.price).toLocaleString()}</p>}
                {data.status === 'wishlist' && (
                  <span className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium bg-stone-100 text-stone-900 inline-flex items-center gap-1.5">
                    <Heart size={12} className="fill-stone-900" strokeWidth={0} /> Wishlist
                  </span>
                )}
              </div>

              {data.wishlistReason && (
                <p className="mt-6 text-stone-700 italic leading-relaxed bg-white border border-stone-200/60 rounded-2xl p-4">"{data.wishlistReason}"</p>
              )}

              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                {data.category && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Category</p><p>{data.category}{data.subCategory ? ` · ${data.subCategory}` : ''}</p></div>}
                {Array.isArray(data.colors) && data.colors.length > 0 && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Colours</p><p>{data.colors.join(' · ')}</p></div>}
                {Array.isArray(data.materials) && data.materials.length > 0 && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Materials</p><p>{data.materials.join(' · ')}</p></div>}
                {Array.isArray(data.seasons) && data.seasons.length > 0 && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Seasons</p><p>{data.seasons.join(' · ')}</p></div>}
              </div>

              {data.description && (
                <div className="mt-8">
                  <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-2">About</p>
                  <p className="text-stone-700 leading-relaxed text-sm whitespace-pre-wrap">{data.description}</p>
                </div>
              )}

              {data.sourceUrl && (
                <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-8 text-sm text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900 transition-colors break-all">
                  <LinkIcon size={14} strokeWidth={1.5} />
                  View at source
                </a>
              )}
            </div>
          </div>
          <PublicShareCTA />
          <PublicShareFooter />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] font-sans text-stone-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Jost', sans-serif; }
        .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
      `}</style>

      <header className="border-b border-stone-200/60 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtelierMark size={36} />
            <span className="font-display text-2xl">Atelier<span className="text-[#D4B378]">.</span></span>
          </div>
          <a href="/" className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900">Visit</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
        <p className="text-[10px] font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">
          {isLookbook ? 'Lookbook · ' : ''}Shared by {sharedByName || 'a friend'}{sharedDate ? ` · ${sharedDate}` : ''}
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display text-stone-900">{name || (isLookbook ? 'A lookbook' : 'A look')}</h1>
        {reasoning && (
          <p className="mt-4 text-stone-600 italic max-w-2xl leading-relaxed">"{renderTextWithChips(reasoning, { items: pieces })}"</p>
        )}

        {isLookbook ? (
          <div className="mt-10">
            <nav className="flex flex-wrap gap-2 mb-12 sticky top-2 z-10 bg-[#F7F5F2]/80 backdrop-blur-md py-2 -mx-2 px-2 rounded-xl">
              {looks.map((l, i) => (
                <a key={l.id || i} href={`#look-${i}`}
                  className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 transition-colors">
                  {i + 1}. {l.name}
                </a>
              ))}
            </nav>
            <div className="space-y-20">
              {looks.map((l, i) => (
                <section key={l.id || i} id={`look-${i}`} className="scroll-mt-24">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                    <h2 className="font-display text-2xl sm:text-3xl text-stone-900">{l.name}</h2>
                    <span className="text-[10px] tracking-widest uppercase text-stone-400">{(l.pieces || []).length} pieces</span>
                  </div>
                  {l.reasoning && <p className="text-stone-600 italic max-w-2xl mb-6 leading-relaxed">"{renderTextWithChips(l.reasoning, { items: l.pieces || [] })}"</p>}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {(l.pieces || []).map((p) => (
                      <div key={p.id} className="flex flex-col gap-3">
                        <div className="aspect-[3/4] rounded-2xl bg-white overflow-hidden smooth-shadow">
                          {(p.images || [])[0] ? (
                            <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>
                          )}
                        </div>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">{p.brand}</p>
                          <p className="font-display text-base text-stone-800 leading-snug mt-1">{p.name}</p>
                          <p className="text-xs text-stone-500 mt-1">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {pieces.map((p) => (
              <div key={p.id} className="flex flex-col gap-3">
                <div className="aspect-[3/4] rounded-2xl bg-stone-100 overflow-hidden smooth-shadow">
                  {(p.images || [])[0] ? (
                    <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>
                  )}
                </div>
                <div className="px-1">
                  <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">{p.brand}</p>
                  <p className="font-display text-base text-stone-800 leading-snug mt-1">{p.name}</p>
                  <p className="text-xs text-stone-500 mt-1">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <PublicShareCTA />

        <footer className="mt-20 pt-8 border-t border-stone-200 text-center text-xs tracking-wider uppercase text-stone-400">
          Read-only view · made with Atelier
        </footer>
      </main>
    </div>
  );
}

// "Notify-on-open" — without a backend we can't deliver true background push.
// On each app open: if Notifications are granted, fire OS notifications for
// items the user genuinely should know about right now (planned outfit for
// tomorrow, care reminders due, stale favourites). Throttled to once per kind
// per day via localStorage to avoid spamming. The user can permission once.
function NotificationManager({ items, outfits, schedules }) {
  const [showAsk, setShowAsk] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      // Offer the permission prompt once the user has some content
      const dismissed = localStorage.getItem('atelier-notif-asked') === '1';
      if (items.length > 2 && !dismissed) setShowAsk(true);
    } else if (Notification.permission === 'granted') {
      maybeFireOpenNotifications({ items, outfits, schedules });
    }
  }, [items.length, outfits.length, Object.keys(schedules || {}).length]);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      localStorage.setItem('atelier-notif-asked', '1');
      setShowAsk(false);
      if (result === 'granted') maybeFireOpenNotifications({ items, outfits, schedules });
    } catch { setShowAsk(false); }
  };
  const dismiss = () => { localStorage.setItem('atelier-notif-asked', '1'); setShowAsk(false); };

  if (!showAsk) return null;
  return createPortal(
    <div className="fixed left-0 right-0 z-[55] flex justify-center px-4 pointer-events-none"
         style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 168px)' }}>
      <div className="pointer-events-auto bg-white border border-stone-200 rounded-2xl shadow-2xl max-w-sm w-full p-4 flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-brass-600 flex items-center justify-center shrink-0">
          <Sparkles size={16} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900">Reminders?</p>
          <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
            Get a heads-up about tomorrow's planned outfit and care reminders the next time you open Atelier.
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={requestPermission} className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white">
              Enable
            </button>
            <button onClick={dismiss} className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full text-stone-500 hover:text-stone-900">
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-stone-400 hover:text-stone-900 shrink-0" aria-label="Dismiss">
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>,
    document.body
  );
}

// Fires OS-level notifications once per kind per day. No backend; works as long
// as Notifications API permission is 'granted' AND the page has been opened.
function maybeFireOpenNotifications({ items, outfits, schedules }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const todayKey = `atelier-notif-fired-${new Date().toISOString().slice(0, 10)}`;
  let fired;
  try { fired = JSON.parse(localStorage.getItem(todayKey) || '{}'); } catch { fired = {}; }
  const mark = (key) => { fired[key] = 1; localStorage.setItem(todayKey, JSON.stringify(fired)); };

  // 1) Tomorrow's planned outfit
  if (!fired['tomorrow-plan']) {
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
    const sched = schedules?.[tomorrow];
    const outfit = sched?.outfitId ? outfits.find((o) => o.id === sched.outfitId) : null;
    if (outfit) {
      new Notification("Tomorrow's look · Atelier", {
        body: `${outfit.name} is planned. Lay it out tonight.`,
        tag: 'atelier-tomorrow',
        icon: '/icon.svg',
      });
      mark('tomorrow-plan');
    }
  }

  // 2) Care due
  if (!fired['care']) {
    const dueCare = (items || [])
      .filter((i) => i.status === 'owned')
      .map((i) => ({ i, r: itemCareReminder(i) }))
      .filter((x) => x.r?.due);
    if (dueCare.length > 0) {
      const example = dueCare[0];
      new Notification('Care reminder · Atelier', {
        body: dueCare.length === 1
          ? `${example.i.name}: ${example.r.action}.`
          : `${dueCare.length} pieces are due care — including ${example.i.name}.`,
        tag: 'atelier-care',
        icon: '/icon.svg',
      });
      mark('care');
    }
  }

  // 3) Stale favourite (haven't worn in 30+ days)
  if (!fired['stale-fav']) {
    const staleFav = (items || []).find((i) => {
      if (!i.favorite || i.status !== 'owned') return false;
      const d = daysSinceLastWorn(i);
      return d === null || d >= 30;
    });
    if (staleFav) {
      const d = daysSinceLastWorn(staleFav);
      new Notification('Bring it back · Atelier', {
        body: `${staleFav.name} is a favourite but ${d === null ? "hasn't been worn yet" : `hasn't been worn in ${d} days`}.`,
        tag: 'atelier-stale',
        icon: '/icon.svg',
      });
      mark('stale-fav');
    }
  }
}

// 4-screen first-run walkthrough. Shown once, persisted via localStorage flag.
// "Show me" links jump the user to the relevant tab and dismiss the tour.
const ONBOARD_STEPS = [
  { title: 'Build your wardrobe', body: 'Add pieces by photo, by pasting a product link, by scanning a care label, or by importing a receipt. Tag colours, materials and styles so the Concierge gets sharper over time.', cta: 'Add an item', target: 'wardrobe' },
  { title: 'Style with the Concierge', body: 'In the Styling Studio, drag pieces into slots or let the Concierge compose a look for an intent ("dinner date", "office day"). A/B compare two suggestions, refine in plain English, save the winner.', cta: 'Open Styling Studio', target: 'outfits' },
  { title: 'Plan, pack, and wear', body: 'Use the Calendar to schedule outfits per day, switch to range mode to plan a trip, and generate a deduped packing list. Log wears in one tap; the data feeds Insights.', cta: 'See the calendar', target: 'outfits' },
  { title: 'Insights & gaps', body: 'Best/worst cost-per-wear, your most-worn pieces, what your wardrobe is missing. Tap "Analyse my wardrobe" for a Concierge-written audit of strengths and gaps.', cta: 'Open Insights', target: 'insights' },
  // The mobile FAB is a double-action button — this step is the primary
  // discovery vehicle for the long-press gesture. Re-tour-shows once after
  // the localStorage key bump below; thereafter the in-gesture tooltip
  // ("Hold for Concierge ✦") self-teaches anyone who tries the hold.
  { title: 'A button with two minds', body: 'On mobile, the hanger button at the centre of the bottom bar has two roles. Tap it to add a piece to your wardrobe. Press and hold for about half a second to summon Atelier Concierge — your private stylist that already knows everything you own.' },
];
function OnboardingTour({ onJumpTo }) {
  // Versioned key — bumped from atelier-onboard-done → -v2 so existing
  // users see the refreshed tour (step 5 introduces the mobile FAB long-
  // press gesture which they have no other way to discover).
  const STORAGE_KEY = 'atelier-onboard-done-v2';
  const [step, setStep] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' ? -1 : 0; }
    catch { return -1; }
  });
  if (step < 0 || step >= ONBOARD_STEPS.length) return null;
  const s = ONBOARD_STEPS[step];
  const last = step === ONBOARD_STEPS.length - 1;
  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
    setStep(-1);
  };
  const jump = () => { finish(); onJumpTo?.(s.target); };

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-stone-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6">
      <div className="bg-[#F7F5F2] w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl">
        <div className="bg-stone-900 text-white px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400">Welcome to Atelier</p>
            <span className="text-[10px] tracking-wider uppercase text-stone-400">{step + 1} / {ONBOARD_STEPS.length}</span>
          </div>
          <h3 className="font-display text-2xl">{s.title}</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-700 leading-relaxed">{s.body}</p>
          <div className="flex gap-1.5">
            {ONBOARD_STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-stone-900' : 'bg-stone-200'}`} />
            ))}
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-between flex-wrap">
          <button onClick={finish} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 px-3 py-2">
            Skip
          </button>
          <div className="flex gap-2">
            {/* Some steps (e.g. the FAB-gesture intro) have no target tab to
                jump to — the lesson is about the bottom-nav button itself.
                In that case we hide the jump CTA so the user just hits Next/Done. */}
            {s.target && s.cta && (
              <button onClick={jump} className="text-xs tracking-widest uppercase px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-800 hover:border-stone-500">
                {s.cta} ↗
              </button>
            )}
            <button onClick={() => last ? finish() : setStep((s) => s + 1)}
              className="text-xs tracking-widest uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700">
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PwaInstallNudge({ hasContent }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem('atelier-pwa-nudge-dismissed') === '1') return;
    } catch { return; }
    setDismissed(false);

    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) return;
    if (isIos && isSafari) setShowIos(true);

    const onBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem('atelier-pwa-nudge-dismissed', '1'); } catch { /* noop */ }
    setDismissed(true);
  };
  const installNow = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      dismiss();
      setDeferredPrompt(null);
    }
  };

  if (dismissed || !hasContent) return null;
  if (!deferredPrompt && !showIos) return null;

  return createPortal(
    <div className="fixed left-0 right-0 z-[55] flex justify-center px-4 pointer-events-none"
         style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
      <div className="pointer-events-auto bg-stone-900 text-white rounded-2xl shadow-2xl max-w-sm w-full p-5 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center shrink-0">
          <Shirt size={18} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Install Atelier</p>
          {showIos ? (
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              Tap the <span className="font-semibold">Share</span> icon, then{' '}
              <span className="font-semibold">Add to Home Screen</span> — opens like a native app.
            </p>
          ) : (
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              Add it to your home screen for one-tap access, with offline support.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {deferredPrompt && (
              <button onClick={installNow} className="text-[11px] tracking-wider uppercase px-4 py-2 rounded-full bg-white text-stone-900 font-medium">
                Install
              </button>
            )}
            <button onClick={dismiss} className="text-[11px] tracking-wider uppercase px-4 py-2 rounded-full text-stone-300 hover:text-white">
              {deferredPrompt ? 'Not now' : 'Got it'}
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-stone-500 hover:text-white shrink-0" aria-label="Dismiss">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>,
    document.body
  );
}
