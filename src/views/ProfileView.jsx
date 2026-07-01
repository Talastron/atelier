import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, BarChart3, Calendar, Check, Download, LogOut, Save, Sparkles, X } from "lucide-react";
import { classifyBodyShape, itemImages, itemNeedsDetail, summariseStyleProfile, todayISO, live } from "../lib/items.js";
import { rehostExternalImage } from "../lib/canvas.js";
import { matchColorFamily } from "../lib/color.js";
import { identifyItemWithGemini } from "../lib/ai.js";
import { connectGoogleCalendar, disconnectGoogleCalendar, isCalendarConnected, getFounderCount, isAIEnabled, signOutUser, deleteMyAccount } from "../firebase.js";
import { itemImageDisplay, polishItemPrimary } from "../lib/polish.js";
import ItemTileImage from "../components/ItemTileImage.jsx";
import EditorialHeader from "../ui/EditorialHeader.jsx";
import Input from "../ui/Input.jsx";
import { useToast } from "../ui/toast.jsx";
import { INITIAL_MEASUREMENTS, STYLE_UNDERTONES, STYLE_SILHOUETTES, STYLE_FORMALITY, STYLE_SEASONS, STYLE_PRINCIPLES, BODY_SHAPE_GUIDES, MATERIALS, materialsForCategory, STYLES, CURRENCY_SYMBOLS } from "../lib/taxonomy.js";

// Complete-my-data backfill: scan the wardrobe for items missing key fields
// (category set to generic "Tops" with no other tags, or no colour, or no
// material), re-analyse the main photo via Gemini Vision, and fill the gaps.
// One-tap enrichment for sparse legacy items.
function BackfillCard({ items = [], shops = [], onUpdateItem, onReviewManually }) {
  const [stage, setStage] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0, updated: 0 });
  const toast = useToast();

  // AI candidates: incomplete AND has a photo to analyse. The manual-review
  // path (Wardrobe "Needs detail" filter) uses the same itemNeedsDetail rule but
  // doesn't require a photo — you can type the tags in yourself.
  const isSparse = (i) => {
    const hasImage = (Array.isArray(i.images) && i.images.length > 0) || i.image;
    return hasImage && itemNeedsDetail(i);
  };
  const candidates = items.filter(isSparse);
  const incompleteCount = items.filter(itemNeedsDetail).length;

  const run = async () => {
    if (!isAIEnabled() || candidates.length === 0) return;
    setStage('running');
    setProgress({ done: 0, total: candidates.length, updated: 0 });
    const knownBrands = Array.from(new Set((shops || []).map((s) => s.name).filter(Boolean)));
    let updated = 0;
    for (const it of candidates) {
      try {
        const src = (Array.isArray(it.images) ? it.images : [it.image]).filter(Boolean)[0];
        if (!src) { setProgress((p) => ({ ...p, done: p.done + 1 })); continue; }
        const r = await identifyItemWithGemini({ imageDataUrl: src, knownBrands });
        const validMaterials = (r.materials || []).filter((m) => materialsForCategory(it.category).includes(m));
        const validColours = (r.colors || []).map((c) => matchColorFamily(c)).filter(Boolean);
        const validStyles = (r.styles || []).filter((s) => STYLES.includes(s));
        const validSeasons = (r.seasons || []).filter((s) => ['Spring', 'Summer', 'Autumn', 'Winter'].includes(s));
        const next = {
          ...it,
          colors: (it.colors && it.colors.length) ? it.colors : validColours,
          materials: (it.materials && it.materials.length) ? it.materials : validMaterials,
          styles: (it.styles && it.styles.length) ? it.styles : validStyles,
          seasons: (it.seasons && it.seasons.length) ? it.seasons : validSeasons,
        };
        await onUpdateItem(next);
        updated++;
      } catch { /* skip failures silently — backfill is best-effort */ }
      setProgress((p) => ({ ...p, done: p.done + 1, updated }));
    }
    setStage('done');
    toast.show(`Backfill complete · ${updated} of ${candidates.length} enriched`, { kind: 'success', duration: 4500 });
  };

  return (
    <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-600 font-medium">Data hygiene</span>
          </div>
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Complete my data</h3>
          <p className="text-stone-500 text-sm mt-2 leading-relaxed max-w-xl">
            {candidates.length === 0
              ? 'Every item has at least one colour, material, and style tagged. Nothing to backfill.'
              : `${candidates.length} item${candidates.length === 1 ? '' : 's'} ${candidates.length === 1 ? 'is' : 'are'} missing colours, materials, or styles. Atelier can analyse each one's photo and fill the gaps — won't overwrite anything you've already set.`}
          </p>
          {incompleteCount > 0 && onReviewManually && (
            <button
              type="button"
              onClick={onReviewManually}
              className="mt-3 text-xs tracking-wide uppercase text-stone-500 hover:text-stone-900 underline-offset-4 hover:underline transition-colors"
            >
              Or review &amp; fill them in yourself →
            </button>
          )}
        </div>
        {candidates.length > 0 && stage !== 'running' && (
          <button onClick={run} disabled={!isAIEnabled()}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40 flex items-center gap-2 shrink-0">
            <Sparkles size={14} strokeWidth={1.5} /> {stage === 'done' ? 'Run again' : `Enrich ${candidates.length}`}
          </button>
        )}
      </div>

      {stage === 'running' && (
        <div className="mt-4 flex items-center gap-3 text-sm text-stone-600">
          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          Analysing {progress.done}/{progress.total} · {progress.updated} enriched so far
        </div>
      )}
    </div>
  );
}

// Backfill external-URL images to inline data URLs for existing items.
// Surfaces in Profile → Storage. Uses the same rehostExternalImage helper
// as the fire-and-forget that runs on every new item save.
function RehostCard({ items = [], onUpdateItem }) {
  const [stage, setStage] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const toast = useToast();

  const isExternal = (u) => u && typeof u === 'string' && !u.startsWith('data:');
  const candidates = items.filter((i) => !i.deletedAt && (
    isExternal(i.imageUrl) ||
    (Array.isArray(i.images) && i.images.some(isExternal))
  ));

  const run = async () => {
    if (candidates.length === 0 || stage === 'running') return;
    const ok = window.confirm(
      `Rehost ${candidates.length} item${candidates.length === 1 ? '' : 's'} with external images? ` +
      `This downloads each image and stores it in your wardrobe data. Runs in the background — you can keep using the app.`
    );
    if (!ok) return;
    setStage('running');
    setProgress({ done: 0, total: candidates.length, failed: 0 });
    let failed = 0;
    for (const item of candidates) {
      try {
        const patch = { ...item };
        let changed = false;
        if (isExternal(item.imageUrl)) {
          const dataUrl = await rehostExternalImage(item.imageUrl);
          if (dataUrl && dataUrl !== item.imageUrl) { patch.imageUrl = dataUrl; changed = true; }
        }
        if (Array.isArray(item.images)) {
          const next = [...item.images];
          let anyChanged = false;
          for (let i = 0; i < item.images.length; i++) {
            if (isExternal(item.images[i])) {
              const dataUrl = await rehostExternalImage(item.images[i]);
              if (dataUrl && dataUrl !== item.images[i]) { next[i] = dataUrl; anyChanged = true; }
            }
          }
          if (anyChanged) { patch.images = next; changed = true; }
        }
        if (changed) await onUpdateItem(patch);
      } catch (err) {
        console.warn('[rehost] item failed', item.id, err?.message);
        failed++;
      }
      setProgress((p) => ({ ...p, done: p.done + 1, failed }));
    }
    setStage('done');
    const failedNote = failed > 0 ? ` · ${failed} couldn't be fetched` : '';
    toast.show(`Rehosted ${candidates.length - failed} image${candidates.length - failed === 1 ? '' : 's'}${failedNote}`, { kind: 'success', duration: 5000 });
  };

  return (
    <div id="profile-storage" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-600 font-medium">Storage</span>
          </div>
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Rehost external images</h3>
          <p className="text-stone-500 text-sm mt-2 leading-relaxed max-w-xl">
            {candidates.length === 0
              ? 'All your wardrobe images are stored inline — share exports and Lookbook covers render reliably everywhere.'
              : `${candidates.length} item${candidates.length === 1 ? '' : 's'} still reference${candidates.length === 1 ? 's' : ''} the brand's CDN. Those URLs can break if the product page is removed, and many brand CDNs block external use (which is why some pieces appear blank in share exports). Rehost copies each image into your own data.`}
          </p>
        </div>
        {candidates.length > 0 && stage !== 'running' && (
          <button onClick={run}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-700 flex items-center gap-2 shrink-0 transition-colors">
            <Sparkles size={14} strokeWidth={1.5} />
            {stage === 'done' ? 'Run again' : `Rehost ${candidates.length}`}
          </button>
        )}
        {candidates.length === 0 && (
          <span className="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-emerald-700 shrink-0">
            <Check size={12} strokeWidth={2.5} /> All rehosted
          </span>
        )}
      </div>
      {stage === 'running' && (
        <div className="mt-4 flex items-center gap-3 text-sm text-stone-600">
          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          Rehosting {progress.done}/{progress.total}{progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
        </div>
      )}
    </div>
  );
}

// Style profile editor card. Compact chip-based UI, no separate quiz modal —
// the choices ARE the quiz. Saving each chip writes immediately so there's no
// "save" friction. Feeds summariseStyleProfile() which goes into Gemini prompts.
function StyleProfileCard({ measurements, saveMeasurements }) {
  const m = measurements || {};
  const set = (key, value) => saveMeasurements({ ...m, [key]: value });
  const togglePrinciple = (p) => {
    const cur = Array.isArray(m.stylePrinciples) ? m.stylePrinciples : [];
    set('stylePrinciples', cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p].slice(0, 3));
  };
  const populated = !!(m.styleUndertone || m.styleSilhouette || m.styleFormality || m.stylePalette);

  const Row = ({ label, options, value, onPick }) => (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onPick(value === opt ? '' : opt)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              value === opt ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-500'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="brass-rule shrink-0" aria-hidden="true"></span>
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Style profile</h3>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed max-w-xl mt-2">
            Tell the Concierge how you actually dress. Every suggestion (Today tile, Styling Studio, Travel packing) gets sharper when these are set.
          </p>
        </div>
        <span className={`text-[10px] tracking-widest uppercase ${populated ? 'text-emerald-700' : 'text-brass-600'}`}>
          {populated ? 'Active in prompts' : 'Not set yet'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Row label="Skin undertone" options={STYLE_UNDERTONES} value={m.styleUndertone || ''} onPick={(v) => set('styleUndertone', v)} />
        <Row label="Silhouette" options={STYLE_SILHOUETTES} value={m.styleSilhouette || ''} onPick={(v) => set('styleSilhouette', v)} />
        <Row label="Formality default" options={STYLE_FORMALITY} value={m.styleFormality || ''} onPick={(v) => set('styleFormality', v)} />
        <Row label="Seasonal palette" options={STYLE_SEASONS} value={m.stylePalette || ''} onPick={(v) => set('stylePalette', v)} />
      </div>

      <div className="mt-6">
        <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">
          Style principles <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(pick up to 3)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRINCIPLES.map((p) => {
            const active = Array.isArray(m.stylePrinciples) && m.stylePrinciples.includes(p);
            return (
              <button key={p} type="button" onClick={() => togglePrinciple(p)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-500'
                }`}>
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Body-shape result — designed to sit as the bottom panel INSIDE the
// Measurements card (parent has overflow-hidden), not as its own free card.
// Until chest/waist/hips are filled it's a quiet ivory prompt; once we can
// classify a shape it becomes a dark "reveal" that crowns the inputs above it.
function FitProfileCard({ measurements }) {
  const shape = classifyBodyShape(measurements);
  if (!shape) {
    return (
      <div className="border-t border-stone-100 bg-[#FBFAF8] px-6 md:px-8 py-7">
        <div className="flex items-center gap-3">
          <span className="brass-rule shrink-0" aria-hidden="true"></span>
          <h4 className="font-display text-lg md:text-xl text-stone-900">Your fit profile</h4>
        </div>
        <p className="text-stone-500 text-sm leading-relaxed mt-3 max-w-2xl">
          Add your <strong className="text-stone-700">chest, waist, and hips</strong> above and your body-shape guidance appears here — the same foundation M&amp;S, ASOS and Stitch Fix build their fit tools on.
        </p>
      </div>
    );
  }
  const guide = BODY_SHAPE_GUIDES[shape];
  return (
    <div className="bg-stone-900 text-white px-6 md:px-10 py-8 md:py-10">
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.28em] text-brass-300">Your fit profile</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Body shape based</span>
      </div>
      <p className="text-4xl md:text-5xl font-display font-medium mt-2 mb-2">{shape}</p>
      <p className="text-stone-300 text-sm leading-relaxed mb-8 max-w-2xl">{guide.blurb}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-brass-300 mb-4">Styles that flatter</h4>
          <ul className="space-y-2 text-sm text-stone-100 leading-relaxed">
            {guide.flatter.map((tip) => <li key={tip} className="flex gap-3"><span className="text-brass-400">·</span>{tip}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400 mb-4">Worth avoiding</h4>
          <ul className="space-y-2 text-sm text-stone-100 leading-relaxed">
            {guide.avoid.map((tip) => <li key={tip} className="flex gap-3"><span className="text-stone-500">·</span>{tip}</li>)}
          </ul>
        </div>
      </div>
      <p className="text-[10px] text-stone-500 mt-8 uppercase tracking-widest">
        General stylist guidance — not a per-item size recommendation. Brand size charts coming next.
      </p>
    </div>
  );
}

// Generate a minimal but spec-compliant .ics file from scheduled outfits.
// Each schedule becomes a 1-day all-day event. The user opens the file in
// Apple Calendar / Google Calendar (import) → events land in a separate
// calendar they can toggle. Includes the outfit name + pieces in description.

function downloadJson(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function SubscriptionPill({ state }) {
  if (state.loading) return <p className="mt-2 text-sm text-stone-400">Checking…</p>;
  if (state.kind === 'owner') {
    return <p className="mt-2 text-sm text-stone-700">Founder access · no renewal.</p>;
  }
  if (state.kind === 'invited') {
    return <p className="mt-2 text-sm text-stone-700">Invited member · access granted by the owner.</p>;
  }
  if (state.kind === 'subscriber') {
    const planLabel = state.plan === 'founding' ? 'Founding member' : state.plan === 'annual' ? 'Annual' : state.plan === 'monthly' ? 'Monthly' : 'Member';
    if (state.isTrial) {
      return (
        <p className="mt-2 text-sm text-stone-700">
          {planLabel} · trial · {state.daysRemaining ?? '—'} day{state.daysRemaining === 1 ? '' : 's'} remaining.
        </p>
      );
    }
    if (state.status === 'cancelled') {
      return (
        <p className="mt-2 text-sm text-stone-700">
          {planLabel} · cancelled · access until {state.currentPeriodEnd?.toLocaleDateString() || '—'}.
        </p>
      );
    }
    return (
      <p className="mt-2 text-sm text-stone-700">
        {planLabel} · active · renews {state.currentPeriodEnd?.toLocaleDateString() || '—'}.
      </p>
    );
  }
  return <p className="mt-2 text-sm text-stone-400">Membership status unavailable.</p>;
}

export default function ProfileView({ user, measurements, saveMeasurements, isOwner, allowlist, addInvite, removeInvite, items, polishItems, deletedItems = [], outfits, inspirations = [], shops, onRestoreItem, onHardDeleteItem, onUpdateItem, subStatus, onOpenInsights, onReviewManually, onOpenItem }) {
  const currency = measurements?.currency || 'GBP';
  const aiTempPreset = measurements?.aiTemperaturePreset || 'balanced';
  const setCurrency = (v) => saveMeasurements({ ...measurements, currency: v });
  const setAITempPreset = (v) => saveMeasurements({ ...measurements, aiTemperaturePreset: v });
  // Local input value for the monthly budget — persisted on blur so the user
  // can edit freely without each keystroke writing to Firestore.
  const [budgetInput, setBudgetInput] = useState(measurements?.monthlyBudget ?? '');
  useEffect(() => { setBudgetInput(measurements?.monthlyBudget ?? ''); }, [measurements?.monthlyBudget]);
  const saveBudget = () => {
    const v = budgetInput === '' ? null : Number(budgetInput);
    if (v !== null && (Number.isNaN(v) || v < 0)) return;
    saveMeasurements({ ...measurements, monthlyBudget: v });
  };
  const [localMeasurements, setLocalMeasurements] = useState(measurements || INITIAL_MEASUREMENTS);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [founderCount, setFounderCount] = useState(null);

  // Polish-my-wardrobe batch state
  const [polishState, setPolishState] = useState(null); // null | { done,total,failed } | { summary }
  const polishCancelRef = useRef(false);

  const runPolishWardrobe = async () => {
    if (!user) return;
    polishCancelRef.current = false;
    // Clear stale proxy cooldowns so the reliable function proxy gets a fresh go.
    try { const net = await import("../lib/net.js"); net.clearAllHostBlocks(); } catch { /* non-blocking */ }
    // Owned + wishlist — polish every item with a photo that isn't cut out yet.
    // `items` is owned-only (used for the enrichment cards); the polish batch
    // must also reach wishlist pieces, so App passes the combined live list as
    // `polishItems`. Fall back to `items` if the prop isn't provided.
    const targets = ((polishItems || items) || []).filter((it) =>
      (it.images || []).length > 0 &&
      !(it.imageMeta?.[0]?.cutoutUrl) &&
      it.imageMeta?.[0]?.cutout !== true
    );
    setPolishState({ done: 0, total: targets.length, failed: 0 });
    let done = 0, failed = 0;
    const failedItems = [];
    for (const it of targets) {
      if (polishCancelRef.current) break;
      try {
        const res = await polishItemPrimary(it, user.uid);
        if (res.ok) { await onUpdateItem({ ...it, imageMeta: res.imageMeta }); }
        else { failed += 1; failedItems.push(it); }
      } catch { failed += 1; failedItems.push(it); }
      done += 1;
      setPolishState({ done, total: targets.length, failed });
      await new Promise((r) => setTimeout(r, 0));
    }
    setPolishState({ summary: { done, total: targets.length, failed, cancelled: polishCancelRef.current, failedItems } });
  };

  // Google Calendar connection state. null = still checking, true/false = known.
  const profileToast = useToast();
  const [calConnected, setCalConnected] = useState(null);
  const [calBusy, setCalBusy] = useState(false);

  // Permanent account deletion (GDPR). Guarded by a type-your-email modal.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const runDeleteAccount = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteMyAccount(); // signs out on success → this view unmounts
    } catch (e) {
      setDeleteError(e?.message || 'Could not delete your account. Please try again.');
      setDeleteBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const connected = await isCalendarConnected(user);
        if (alive) setCalConnected(connected);
      } catch {
        if (alive) setCalConnected(false);
      }
    })();
    return () => { alive = false; };
  }, [user]);

  const handleConnectCalendar = async () => {
    setCalBusy(true);
    try {
      await connectGoogleCalendar(); // redirects away on success
    } catch {
      setCalBusy(false);
      profileToast.show('Could not start calendar connection. Please try again.', { kind: 'error' });
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalBusy(true);
    try {
      await disconnectGoogleCalendar();
      setCalConnected(false);
      profileToast.show('Calendar disconnected', { kind: 'success', eyebrow: 'DISCONNECTED' });
    } catch {
      profileToast.show('Could not disconnect. Please try again.', { kind: 'error' });
    } finally {
      setCalBusy(false);
    }
  };

  useEffect(() => { if (measurements) setLocalMeasurements({ ...INITIAL_MEASUREMENTS, ...measurements }); }, [measurements]);

  useEffect(() => {
    let cancelled = false;
    getFounderCount().then((n) => { if (!cancelled) setFounderCount(n); });
    return () => { cancelled = true; };
  }, []);
  const handleChange = (e) => setLocalMeasurements({ ...localMeasurements, [e.target.name]: e.target.value });

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteBusy(true); setInviteError(null);
    try {
      await addInvite(inviteEmail, inviteName);
      setInviteEmail(''); setInviteName('');
    } catch (err) {
      setInviteError(err?.message || 'Could not add invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <EditorialHeader eyebrow="Your atelier" title="Profile" subtitle="Account, measurements, style, and preferences." />

      <nav className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 py-3 bg-[#F7F5F2]/95 backdrop-blur-md border-b border-stone-200/60" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex flex-wrap gap-2">
          {[['group-account', 'Account'], ['group-you', 'Style & Fit'], ['group-preferences', 'Preferences'], ['group-data', 'Your Data'], ...(isOwner ? [['group-people', 'People']] : [])].map(([gid, label]) => (
            <a key={gid} href={`#${gid}`}
              className="text-[10px] sm:text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors duration-200">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section id="group-account" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">01</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">Account</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      {user && (
        <div id="profile-account" className="scroll-mt-24 relative overflow-hidden bg-white rounded-[2rem] ring-1 ring-stone-200/70 smooth-shadow">
          {/* Brass hairline crowns the identity card — the one warm accent that
              tells you this is the top of your account, not just another box. */}
          <div className="h-1 bg-gradient-to-r from-brass-200 via-brass-400 to-brass-200" aria-hidden="true" />
          <div className="p-6 md:p-8 flex items-center gap-5">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-16 h-16 md:w-20 md:h-20 rounded-full ring-2 ring-brass-200 shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-stone-900 text-white flex items-center justify-center font-display text-2xl md:text-3xl ring-2 ring-brass-200 shrink-0">
                {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-[0.28em] uppercase text-stone-400 mb-1.5">Signed in</p>
              <p className="font-display text-2xl md:text-3xl text-stone-900 leading-tight truncate">{user.displayName || 'Your account'}</p>
              <p className="text-stone-500 text-xs tracking-wide mt-1 truncate">{user.email}</p>
              {isOwner && subStatus && <div className="mt-2"><SubscriptionPill state={subStatus} /></div>}
            </div>
            {/* Insights is a desktop sidebar pillar; on mobile it's reached here. */}
            {onOpenInsights && (
              <button
                onClick={onOpenInsights}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full border border-stone-200 text-stone-500 hover:border-brass-400 hover:text-stone-900 transition-colors shrink-0"
                aria-label="Insights"
              >
                <BarChart3 size={16} strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={signOutUser}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-full border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-900 text-[10px] tracking-[0.2em] uppercase transition-colors shrink-0"
              aria-label="Sign out"
            >
              <LogOut size={14} strokeWidth={1.5} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      )}
      {/* Subscription — non-owners only. Owners don't pay. The customer portal
          link goes to Lemon Squeezy's hosted billing UI where customers sign
          in with their email and can update card, change plan, view invoices,
          or cancel. Per-subscription deep-links exist but are signed and expire,
          so we link to the generic store entry. */}
      {!isOwner && (
        <div id="profile-subscription" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule shrink-0" aria-hidden="true"></span>
            <h3 className="font-display text-2xl text-stone-900">Membership</h3>
          </div>
          {subStatus && <SubscriptionPill state={subStatus} />}
          <p className="text-stone-500 text-sm leading-relaxed mb-6 mt-4">
            Update your payment method, view past invoices, change plan, or cancel — all through your secure customer portal.
          </p>
          <a
            href="https://myatelier.lemonsqueezy.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Manage subscription
          </a>
          <p className="text-xs text-stone-400 mt-6 leading-relaxed">
            Opens in a new tab. You'll sign in with your subscription email to access your account.
          </p>
        </div>
      )}
      {/* Calendar — optional Google Calendar connection, read-only. An account
          connection (like sign-in / billing), so it lives under Account rather
          than Preferences. The Concierge reads upcoming events to dress you. */}
      <section id="profile-calendar" className="scroll-mt-24 space-y-6 md:space-y-8">
        <div className="flex items-center gap-3">
          <span className="brass-rule shrink-0" aria-hidden="true"></span>
          <h3 className="font-display text-stone-900 text-xl md:text-2xl">Calendar</h3>
        </div>
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          {calConnected === null ? (
            <p className="text-stone-400 text-sm">Checking…</p>
          ) : calConnected ? (
            <div>
              <div className="flex items-center gap-2 text-stone-900">
                <Check size={18} strokeWidth={2} className="text-emerald-600" />
                <span className="font-display text-lg">Connected</span>
              </div>
              <p className="text-stone-500 text-sm mt-2">Primary calendar · read-only.</p>
              <button
                onClick={handleDisconnectCalendar}
                disabled={calBusy}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 text-sm tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calBusy ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-stone-700 leading-relaxed mb-6">
                Connect your Google Calendar and the Concierge will dress you for what's actually on — a board meeting, a long lunch, a quiet day in. Read-only: Atelier never edits or deletes anything on your calendar. Primary calendar only.
              </p>
              <button
                onClick={handleConnectCalendar}
                disabled={calBusy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar size={16} strokeWidth={1.5} />
                {calBusy ? 'Connecting…' : 'Connect Google Calendar'}
              </button>
            </div>
          )}
        </div>
      </section>
      </section>

      <section id="group-you" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">02</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">Style & Fit</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      <section id="profile-measurements" className="scroll-mt-24 space-y-6 md:space-y-8">
        <div className="flex items-center gap-3">
          <span className="brass-rule shrink-0" aria-hidden="true"></span>
          <h3 className="font-display text-stone-900 text-xl md:text-2xl">Measurements &amp; Fit</h3>
        </div>
        {/* One card: light inputs on top → dark body-shape "reveal" at the
            bottom (FitProfileCard renders full-bleed; overflow-hidden clips
            its corners to the card radius). The inputs and the fit profile
            are the same idea — what you enter and what it tells us. */}
        <div className="bg-white border border-stone-200/60 rounded-[2rem] smooth-shadow overflow-hidden">
          <div className="p-6 md:p-8">
          <p className="text-stone-500 text-sm leading-relaxed mb-8 max-w-2xl">
            Fill in <span className="text-stone-800 font-medium">chest, waist and hips</span> to unlock your body-shape guidance below, and AI fit estimates on wishlist items (open any wishlist piece → "Will it fit?"). Stored privately under your account.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-7">
            {[
              { id: 'height', label: 'Height', unit: 'cm' }, { id: 'weight', label: 'Weight', unit: 'kg' },
              { id: 'chest', label: 'Chest', unit: 'cm', fit: true }, { id: 'waist', label: 'Waist', unit: 'cm', fit: true },
              { id: 'hips', label: 'Hips', unit: 'cm', fit: true }, { id: 'shoeSize', label: 'Shoe size', unit: 'EU' },
            ].map(field => (
              <div key={field.id} className="relative">
                <label className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] font-semibold text-stone-500 uppercase mb-2 ml-1">
                  {field.label}
                  {field.fit && <span className="w-1 h-1 rounded-full bg-brass-400" title="Powers fit predictions" aria-hidden="true" />}
                </label>
                <div className="relative">
                  <input type="number" name={field.id} value={localMeasurements[field.id] || ''} onChange={handleChange}
                    className="w-full pl-5 pr-12 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-stone-900 focus:ring-4 focus:ring-stone-900/5 outline-none transition-all text-stone-900 text-lg font-display"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[11px] tracking-widest uppercase text-stone-400 pointer-events-none">{field.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-stone-100 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-brass-400" aria-hidden="true" /> Powers fit &amp; body shape
            </p>
            <button onClick={() => saveMeasurements(localMeasurements)} className="bg-stone-900 text-white px-7 py-3.5 rounded-full font-medium text-sm flex items-center gap-2.5 hover:bg-stone-700 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]">
              <Save size={16} strokeWidth={1.5} /> Update Profile
            </button>
          </div>
          </div>

          {/* Body-shape guidance — full-bleed bottom panel, fed live by the inputs above. */}
          <FitProfileCard measurements={measurements} />
        </div>
      </section>
      <div id="profile-style" className="scroll-mt-24">
        <StyleProfileCard measurements={measurements} saveMeasurements={saveMeasurements} />
      </div>
      </section>

      <section id="group-preferences" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">03</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">Preferences</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      <div id="profile-settings" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-center gap-3 mb-6">
          <span className="brass-rule shrink-0" aria-hidden="true"></span>
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Settings</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Currency</label>
            <div className="flex flex-wrap gap-2">
              {['GBP', 'USD', 'EUR'].map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    currency === c ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-500'
                  }`}>
                  {CURRENCY_SYMBOLS[c]} {c}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-400 mt-2">Display only — existing prices keep their numbers.</p>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Concierge temperament</label>
            <div className="flex flex-wrap gap-2">
              {[
                { v: 'safe', label: 'Safe', sub: 'Consistent' },
                { v: 'balanced', label: 'Balanced', sub: 'Default' },
                { v: 'surprise', label: 'Surprise', sub: 'Adventurous' },
              ].map((p) => (
                <button key={p.v} onClick={() => setAITempPreset(p.v)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border text-left ${
                    aiTempPreset === p.v ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-500'
                  }`}>
                  <div>{p.label}</div>
                  <div className={`text-[10px] mt-0.5 ${aiTempPreset === p.v ? 'text-stone-300' : 'text-stone-400'}`}>{p.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="monthly-budget" className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Monthly shopping budget</label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm">{CURRENCY_SYMBOLS[currency] || '£'}</span>
                <input
                  id="monthly-budget"
                  type="number" inputMode="numeric" min="0" step="10"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onBlur={saveBudget}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  placeholder="e.g. 200"
                  className="w-full h-11 pl-9 pr-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
                />
              </div>
              {measurements?.monthlyBudget > 0 && (
                <button onClick={() => { setBudgetInput(''); saveMeasurements({ ...measurements, monthlyBudget: null }); }}
                  className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline underline-offset-2">
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10px] text-stone-400 mt-2">Powers the spending meter on Insights. Counts owned items added this month (by purchase date if set, otherwise added date). Leave blank to hide the meter.</p>
          </div>
        </div>
      </div>
      <div id="profile-cutouts" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="brass-rule shrink-0" aria-hidden="true"></span>
              <h3 className="font-display text-xl md:text-2xl text-stone-900">Photo cutouts <span className="text-[10px] tracking-widest uppercase text-brass-600 ml-2 align-middle">Beta</span></h3>
            </div>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xl">
              Remove the background from item photos so each piece sits on a clean white card. New items are polished automatically; if a cut-out ever looks wrong, the original is kept and one tap reverts it. Heavy in-browser model — first run downloads ~5MB.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 cursor-pointer shrink-0">
            <span className="text-xs tracking-widest uppercase text-stone-500">{measurements?.removeBackground !== false ? 'On' : 'Off'}</span>
            <input type="checkbox" className="sr-only peer"
              checked={measurements?.removeBackground !== false}
              onChange={(e) => saveMeasurements({ ...measurements, removeBackground: e.target.checked })} />
            <span className="w-11 h-6 bg-stone-200 rounded-full peer-checked:bg-stone-900 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></span>
          </label>
        </div>

        <div className="mt-6 pt-5 border-t border-stone-100">
          {!polishState && (
            <button type="button" onClick={runPolishWardrobe}
              className="text-xs tracking-widest uppercase px-5 py-3 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors">
              Polish my wardrobe
            </button>
          )}
          {polishState && !polishState.summary && (
            <div className="max-w-sm">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                <span>Polishing… {polishState.done} / {polishState.total}{polishState.failed ? ` · ${polishState.failed} kept original` : ''}</span>
                <button type="button" onClick={() => { polishCancelRef.current = true; }} className="underline hover:text-stone-900">Stop</button>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-brass-400 transition-all" style={{ width: `${polishState.total ? Math.round((polishState.done / polishState.total) * 100) : 0}%` }} />
              </div>
            </div>
          )}
          {polishState?.summary && (
            <div className="text-sm text-stone-700">
              <p className="mb-2">
                {polishState.summary.done - polishState.summary.failed} polished
                {polishState.summary.failed ? ` · ${polishState.summary.failed} kept their original` : ''}
                {polishState.summary.cancelled ? ' · stopped — run again to continue' : ''}.
              </p>
              {polishState.summary.failedItems?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-stone-500 mb-2">Couldn’t cut these out — tap to review:</p>
                  <div className="flex flex-wrap gap-2">
                    {polishState.summary.failedItems.map((it) => (
                      <button key={it.id} type="button" onClick={() => onOpenItem?.(it.id)} title={it.name}
                        className="w-14 h-14 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 hover:border-stone-500 transition-colors">
                        {(it.images || [])[0] && <img src={it.images[0]} alt={it.name} className="w-full h-full object-cover" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={() => setPolishState(null)} className="text-xs tracking-widest uppercase underline text-stone-500 hover:text-stone-900">Done</button>
            </div>
          )}
        </div>
      </div>
      </section>

      <section id="group-data" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">04</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">Your Data</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      {/* Privacy — surfaces data-handling position and live founder cohort
          counter. Matches the editorial chrome used throughout the profile
          (brass-rule + small-caps headers, white card with soft border). */}
      <section id="profile-privacy" className="scroll-mt-24 space-y-6 md:space-y-8">
        <div className="flex items-center gap-3">
          <span className="brass-rule shrink-0" aria-hidden="true"></span>
          <h3 className="font-display text-stone-900 text-xl md:text-2xl">Privacy</h3>
        </div>
        {/* Editorial treatment — a warm ivory panel with a brass spine, set
            apart from the functional white cards. This is a statement of
            position, so it should read like a printed note, not a settings box. */}
        <div className="relative bg-[#FBFAF8] border border-stone-200/70 rounded-[2rem] p-7 sm:p-10 overflow-hidden smooth-shadow">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brass-200 via-brass-400 to-brass-200" aria-hidden="true" />
          <p className="font-display text-lg md:text-xl text-stone-800 leading-relaxed mb-5">
            Atelier is a private wardrobe. Your pieces, your wears, your photos — they live in your account, encrypted in transit and at rest. We do not sell, share, or train on your data.
          </p>
          <p className="text-stone-600 text-sm leading-relaxed mb-4">
            The Concierge sees only what you've added; the model never receives your personal details beyond the wardrobe and notes you've written. You can export your full wardrobe any time from Backup below, and delete your account permanently from the Delete account section below — deletions are immediate and irrecoverable, we keep no archive.
          </p>
          <p className="text-sm">
            <a href="https://myatelier.style/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-stone-700 underline underline-offset-2 hover:text-stone-900 transition-colors">Privacy Policy</a>
            <span className="text-stone-300 mx-2" aria-hidden="true">·</span>
            <a href="https://myatelier.style/legal/terms" target="_blank" rel="noopener noreferrer" className="text-stone-700 underline underline-offset-2 hover:text-stone-900 transition-colors">Terms of Service</a>
          </p>
          {founderCount !== null && (
            <div className="mt-7 pt-6 border-t border-stone-200/80 flex items-center gap-3">
              <span className="inline-block w-4 h-px bg-brass-400" aria-hidden="true" />
              <p className="text-[11px] tracking-[0.28em] uppercase text-stone-500">
                Atelier · {founderCount.toLocaleString()} founder{founderCount === 1 ? '' : 's'} to date
              </p>
            </div>
          )}
        </div>
      </section>
      <BackfillCard items={items} shops={shops} onUpdateItem={onUpdateItem} onReviewManually={onReviewManually} />
      <RehostCard items={items} onUpdateItem={onUpdateItem} />
      <div id="profile-backup" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="brass-rule shrink-0" aria-hidden="true"></span>
              <h3 className="font-display text-xl md:text-2xl text-stone-900">Backup &amp; export</h3>
            </div>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xl">
              Download your entire wardrobe — items, photos, outfits, shops, size charts, measurements — as a single JSON file. Portable to any database, future-proof against vendor changes.
            </p>
          </div>
          <button onClick={() => downloadJson(
            `atelier-wardrobe-${todayISO()}.json`,
            { exportedAt: new Date().toISOString(), version: 1, user: { email: user?.email, displayName: user?.displayName }, measurements, items, outfits, shops }
          )} className="bg-stone-900 text-white px-5 py-3 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-stone-700 transition-all shadow-lg shrink-0">
            <Download size={16} strokeWidth={1.5} /> Download backup
          </button>
        </div>
      </div>
      {deletedItems.length > 0 && (
        <div id="profile-trash" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="brass-rule shrink-0" aria-hidden="true"></span>
              <h3 className="font-display text-xl md:text-2xl text-stone-900">Trash</h3>
            </div>
            <span className="text-[10px] tracking-widest uppercase text-stone-500">{deletedItems.length} item{deletedItems.length === 1 ? '' : 's'}</span>
          </div>
          <p className="text-stone-500 text-sm mb-6">Deleted items live here for 30 days. Restore anything, or remove forever.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {deletedItems.map((item) => {
              const days = item.deletedAt ? Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86_400_000) : 0;
              return (
                <div key={item.id} className="flex flex-col gap-2">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 opacity-60">
                    <ItemTileImage item={item} alt={item.name} />
                  </div>
                  <p className="text-xs text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400">Deleted {days}d ago</p>
                  <div className="flex gap-1">
                    <button onClick={() => onRestoreItem?.(item.id)} className="flex-1 px-2 py-1.5 text-[10px] tracking-widest uppercase rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors">
                      Restore
                    </button>
                    <button onClick={() => onHardDeleteItem?.(item.id)} className="px-2 py-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete forever">
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger zone — permanent account deletion (GDPR right-to-erasure). */}
      <div id="profile-delete" className="scroll-mt-24 rounded-[2rem] border border-red-200 bg-red-50/50 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="brass-rule shrink-0" aria-hidden="true"></span>
          <h3 className="font-display text-xl md:text-2xl text-red-800">Delete account</h3>
        </div>
        <p className="text-stone-600 text-sm leading-relaxed max-w-xl">
          Permanently erase your account and everything in it — items, photos, outfits, measurements, and history. Immediate and irreversible; we keep no archive.
        </p>
        {subStatus?.kind === 'subscriber' && (
          <p className="mt-3 text-xs leading-relaxed text-red-700 flex items-start gap-2 max-w-xl">
            <AlertCircle size={14} strokeWidth={1.5} className="shrink-0 mt-0.5" />
            You have an active subscription. Cancel it first under Account → Membership so you aren't billed again — deleting here does not stop billing.
          </p>
        )}
        <button
          onClick={() => { setDeleteText(''); setDeleteError(null); setDeleteOpen(true); }}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-red-300 text-red-700 text-sm font-medium hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
        >
          <X size={15} strokeWidth={2} /> Delete my account
        </button>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-stone-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-7 md:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle size={20} strokeWidth={1.5} className="text-red-600" />
              <h3 className="font-display text-2xl text-stone-900">Delete your account?</h3>
            </div>
            <p className="text-stone-600 text-sm leading-relaxed mb-5">
              This erases everything permanently and cannot be undone. To confirm, type your email
              <span className="font-medium text-stone-900"> {user?.email}</span> below.
            </p>
            <input
              type="email" autoFocus value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={user?.email}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-red-500 outline-none transition-colors text-stone-900"
            />
            {deleteError && <p className="mt-3 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setDeleteOpen(false)} disabled={deleteBusy}
                className="px-5 py-2.5 rounded-full text-stone-600 hover:text-stone-900 text-sm transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={runDeleteAccount}
                disabled={deleteBusy || deleteText.trim().toLowerCase() !== (user?.email || '').toLowerCase()}
                className="px-6 py-2.5 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteBusy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
      </section>

      {isOwner && (
      <section id="group-people" className="scroll-mt-24 space-y-8 md:space-y-10">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-2xl md:text-3xl text-brass-400 tabular-nums leading-none">05</span>
            <h2 className="font-display text-3xl md:text-4xl text-stone-900 tracking-tight">People</h2>
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-stone-300 via-stone-200 to-transparent" aria-hidden="true"></div>
        </div>
      {isOwner && (
        <div id="profile-people" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-center justify-between mb-6 gap-3">
            <div className="flex items-center gap-3">
              <span className="brass-rule shrink-0" aria-hidden="true"></span>
              <h3 className="font-display text-xl md:text-2xl text-stone-900">Invited Friends</h3>
            </div>
            <span className="text-xs text-stone-400 tracking-widest uppercase shrink-0">{allowlist.length} {allowlist.length === 1 ? 'person' : 'people'}</span>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed mb-8">
            Add someone's Google email to give them access. They'll get their own private wardrobe inside this app — they won't see yours, you won't see theirs.
          </p>

          <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mb-8">
            <div className="sm:col-span-5">
              <Input label="Google email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@gmail.com" required />
            </div>
            <div className="sm:col-span-4">
              <Input label="Name (optional)" type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Anna" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" disabled={inviteBusy} className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-700 transition-all disabled:opacity-50">
                {inviteBusy ? 'Adding…' : 'Invite'}
              </button>
            </div>
            {inviteError && <p className="sm:col-span-12 text-xs text-red-700">{inviteError}</p>}
          </form>

          <div className="space-y-2">
            {allowlist.length === 0 && (
              <p className="text-stone-400 italic text-sm py-6 text-center border border-dashed border-stone-200 rounded-2xl">
                No invited friends yet. Owners ({OWNER_EMAILS.join(', ')}) always have access.
              </p>
            )}
            {allowlist.map((entry) => (
              <div key={entry.email} className="flex items-center justify-between py-3 px-4 bg-stone-50 border border-stone-200/60 rounded-xl group">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-900 truncate">{entry.displayName || entry.email}</p>
                  {entry.displayName && <p className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5 truncate">{entry.email}</p>}
                </div>
                <button onClick={() => removeInvite(entry.email).catch((e) => alert(e.message))}
                  className="text-stone-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Revoke access for ${entry.email}`}
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </section>
      )}

    </div>
  );
}
