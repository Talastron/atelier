import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, BarChart3, Calendar, Check, Download, LogOut, Save, Sparkles, Wand2, X } from "lucide-react";
import { classifyBodyShape, itemImages, itemWearCount, summariseStyleProfile, todayISO, live } from "../lib/items.js";
import { rehostExternalImage } from "../lib/canvas.js";
import { matchColorFamily } from "../lib/color.js";
import { identifyItemWithGemini, generateStyleManifestoWithGemini } from "../lib/ai.js";
import { connectGoogleCalendar, disconnectGoogleCalendar, isCalendarConnected, getFounderCount, isAIEnabled, signOutUser } from "../firebase.js";
import EditorialHeader from "../ui/EditorialHeader.jsx";
import Input from "../ui/Input.jsx";
import { useToast } from "../ui/toast.jsx";
import { INITIAL_MEASUREMENTS, STYLE_UNDERTONES, STYLE_SILHOUETTES, STYLE_FORMALITY, STYLE_SEASONS, STYLE_PRINCIPLES, BODY_SHAPE_GUIDES, MATERIALS, STYLES, CURRENCY_SYMBOLS } from "../lib/taxonomy.js";

// Complete-my-data backfill: scan the wardrobe for items missing key fields
// (category set to generic "Tops" with no other tags, or no colour, or no
// material), re-analyse the main photo via Gemini Vision, and fill the gaps.
// One-tap enrichment for sparse legacy items.
function BackfillCard({ items = [], shops = [], onUpdateItem }) {
  const [stage, setStage] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0, updated: 0 });
  const toast = useToast();

  const isSparse = (i) => {
    const hasImage = (Array.isArray(i.images) && i.images.length > 0) || i.image;
    if (!hasImage) return false; // can't analyse without a photo
    const noColours = !Array.isArray(i.colors) || i.colors.length === 0;
    const noMaterials = !Array.isArray(i.materials) || i.materials.length === 0;
    const noStyles = !Array.isArray(i.styles) || i.styles.length === 0;
    return noColours || noMaterials || noStyles;
  };
  const candidates = items.filter(isSparse);

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
        const validMaterials = (r.materials || []).filter((m) => MATERIALS.includes(m));
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

function StyleManifestoCard({ measurements, saveMeasurements, items = [], outfits = [], inspirations = [] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelledRef = useRef(false);
  const toast = useToast();
  const manifesto = measurements?.styleManifesto || '';
  const generatedAt = measurements?.styleManifestoAt || null;

  useEffect(() => () => { cancelledRef.current = true; }, []);

  // 90-day seasonal nudge: compute age of the current manifesto so we can
  // show a quiet inline prompt to refresh when it's been more than a season.
  const manifestoAgeDays = generatedAt
    ? Math.floor((Date.now() - new Date(generatedAt).getTime()) / (24 * 3600 * 1000))
    : null;
  const manifestoStale = manifesto && manifestoAgeDays !== null && manifestoAgeDays >= 90;

  const run = async () => {
    if (busy) return;
    setBusy(true); setError(null); setStreamingText(''); setIsStreaming(true);
    let accumulated = '';
    try {
      const text = await generateStyleManifestoWithGemini({
        items,
        outfits,
        inspirations,
        onChunk: (chunk) => {
          if (cancelledRef.current) return;
          accumulated += chunk;
          setStreamingText(accumulated);
        },
      });
      if (cancelledRef.current) return;
      await saveMeasurements({ ...measurements, styleManifesto: text, styleManifestoAt: new Date().toISOString() });
      toast.show('Manifesto refreshed', { kind: 'success' });
    } catch (e) {
      if (cancelledRef.current) return;
      setError(e?.message || 'Failed.');
    } finally {
      setIsStreaming(false);
      setBusy(false);
    }
  };

  // StyleManifestoCard — dark surface, no shadow per convention
  // (dark on light page already reads as elevated). Padding harmonised
  // to p-6 md:p-8 matching the Insights section cards.
  const WEARS_THRESHOLD = 30;
  const totalWears = items.reduce((sum, it) => sum + itemWearCount(it), 0);

  return (
    <div className="bg-stone-900 text-white rounded-[2rem] p-6 md:p-8 relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 opacity-[0.04] pointer-events-none">
        <Sparkles size={220} strokeWidth={0.8} />
      </div>
      <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-medium">A private brief, by the Concierge</span>
          </div>
          <h3 className="font-display text-2xl md:text-3xl text-white">Style manifesto</h3>
          <p className="text-stone-400 text-sm leading-relaxed max-w-xl mt-3">
            The Concierge reads your most-worn pieces, outfit pairings, and saved inspirations — and writes a private three-paragraph brief of your aesthetic. Refresh when your taste shifts.
          </p>
          {!manifesto && !isStreaming && totalWears < WEARS_THRESHOLD && (
            <div className="mt-4 flex items-center gap-3 max-w-xs">
              <div className="flex-1 h-1 rounded-full bg-stone-700 overflow-hidden">
                <div
                  className="h-full bg-brass-400 transition-[width] duration-700"
                  style={{ width: `${Math.min(100, (totalWears / WEARS_THRESHOLD) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] tracking-wide tabular-nums text-stone-400 shrink-0">
                {totalWears} / {WEARS_THRESHOLD} wears
              </span>
            </div>
          )}
        </div>
        <button onClick={run} disabled={busy} className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 flex items-center gap-2 shrink-0 font-medium">
          <Wand2 size={14} strokeWidth={1.5} /> {busy ? 'Writing…' : (manifesto ? 'Refresh' : 'Generate')}
        </button>
      </div>

      {error && <p className="relative z-10 mt-4 text-sm text-red-200 bg-red-950/40 border border-red-900/40 px-4 py-3 rounded-xl">{error}</p>}

      {manifestoStale && (
        <div className="relative z-10 mt-5 mb-1 rounded-lg border border-stone-600 bg-stone-800 px-4 py-2 text-sm text-stone-300">
          Your manifesto is {Math.floor(manifestoAgeDays / 30)} months old. A fresh reading?{' '}
          <button
            type="button"
            onClick={run}
            className="font-medium underline hover:no-underline"
          >
            Refresh it
          </button>
        </div>
      )}

      {(manifesto || isStreaming) && (
        <div className="relative z-10 mt-6 bg-[#F7F5F2] text-stone-800 rounded-2xl p-6 sm:p-8 text-sm sm:text-[15px] leading-[1.8] whitespace-pre-line font-display italic">
          {isStreaming ? streamingText : manifesto}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 align-middle ml-0.5 bg-stone-700 animate-pulse" aria-hidden="true" />
          )}
          {!isStreaming && generatedAt && (
            <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-5 font-sans not-italic flex items-center gap-3">
              <span className="brass-rule" aria-hidden="true"></span>
              Written {new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
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
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Style profile</h3>
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

function FitProfileCard({ measurements }) {
  const shape = classifyBodyShape(measurements);
  if (!shape) {
    return (
      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-3">Your Fit Profile</h3>
        <p className="text-stone-500 text-sm leading-relaxed">
          Add your <strong>chest, waist, and hips</strong> on the <strong>Account</strong> tab to unlock body-shape-based styling guidance — the same approach M&S, ASOS and Stitch Fix use as the foundation of their fit tools.
        </p>
      </div>
    );
  }
  const guide = BODY_SHAPE_GUIDES[shape];
  return (
    <div className="bg-stone-900 text-white rounded-[2rem] p-6 md:p-10 smooth-shadow">
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        <h3 className="font-display text-xl md:text-2xl">Your Fit Profile</h3>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Body shape based</span>
      </div>
      <p className="text-4xl md:text-5xl font-display font-medium mt-4 mb-2">{shape}</p>
      <p className="text-stone-300 text-sm leading-relaxed mb-8 max-w-2xl">{guide.blurb}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400 mb-4">Styles that flatter</h4>
          <ul className="space-y-2 text-sm text-stone-100 leading-relaxed">
            {guide.flatter.map((tip) => <li key={tip} className="flex gap-3"><span className="text-stone-500">·</span>{tip}</li>)}
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

export default function ProfileView({ user, measurements, saveMeasurements, isOwner, allowlist, addInvite, removeInvite, items, deletedItems = [], outfits, inspirations = [], shops, onRestoreItem, onHardDeleteItem, onUpdateItem, subStatus, onOpenInsights }) {
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

  // Google Calendar connection state. null = still checking, true/false = known.
  const profileToast = useToast();
  const [calConnected, setCalConnected] = useState(null);
  const [calBusy, setCalBusy] = useState(false);
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

  // Sub-section anchors — same pattern as Insights: long page with many
  // discrete cards, sticky chip nav jumps directly to the relevant one.
  // 'People' only appears for owners (matches the conditional Invited
  // Friends section). 'Subscription' only appears for non-owners (owners
  // don't pay).
  const PROFILE_SECTIONS = [
    { id: 'profile-account', label: 'Account' },
    { id: 'profile-privacy', label: 'Privacy' },
    { id: 'profile-calendar', label: 'Calendar' },
    ...(isOwner ? [{ id: 'profile-people', label: 'People' }] : [{ id: 'profile-subscription', label: 'Subscription' }]),
    { id: 'profile-settings', label: 'Settings' },
    { id: 'profile-style', label: 'Style' },
    { id: 'profile-cutouts', label: 'Cutouts' },
    { id: 'profile-storage', label: 'Storage' },
    { id: 'profile-backup', label: 'Backup' },
    { id: 'profile-trash', label: 'Trash' },
    { id: 'profile-measurements', label: 'Measurements' },
  ];

  return (
    <div className="space-y-10 md:space-y-12 max-w-3xl">
      <EditorialHeader eyebrow="Your atelier" title="Profile" subtitle="Account, measurements, style, and preferences." />

      {/* Sticky sub-section nav — matches the Insights pattern. Same
          'Pattern B' pill sizing (px-3 py-1.5 text-[10px] sm:text-xs)
          established in the unification commit so all sticky-bar pills
          across the app speak one language. */}
      <nav className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 py-3 bg-[#F7F5F2] border-b border-stone-200/60"
           style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {PROFILE_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className="shrink-0 text-[10px] sm:text-xs tracking-widest uppercase px-3 py-1.5 rounded-full bg-white border border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors duration-200">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {user && (
        <div id="profile-account" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow flex items-center gap-5">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-16 h-16 rounded-full ring-2 ring-stone-100" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-stone-900 text-white flex items-center justify-center font-display text-2xl">
              {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl text-stone-900 truncate">{user.displayName || 'Signed in'}</p>
            <p className="text-stone-500 text-xs tracking-wide mt-1 truncate">{user.email}</p>
            {isOwner && subStatus && <SubscriptionPill state={subStatus} />}
          </div>
          {/* Icon-only on mobile (label would crowd the small account card),
              full pill with label on sm+. The icon alone is universally
              understood for sign-out (door-with-arrow) so this stays
              accessible without a label. */}
          {/* Insights is a sidebar pillar on desktop; on mobile (no sidebar)
              it's reached here, from the Profile screen. */}
          {onOpenInsights && (
            <button
              onClick={onOpenInsights}
              className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 text-xs tracking-wide transition-colors shrink-0"
              aria-label="Insights"
            >
              <BarChart3 size={14} strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={signOutUser}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 text-xs tracking-wide transition-colors shrink-0"
            aria-label="Sign out"
          >
            <LogOut size={14} strokeWidth={1.5} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      )}

      {/* Privacy — surfaces data-handling position and live founder cohort
          counter. Matches the editorial chrome used throughout the profile
          (brass-rule + small-caps headers, white card with soft border). */}
      <section id="profile-privacy" className="scroll-mt-24 space-y-6 md:space-y-8">
        <div className="flex items-center gap-3">
          <span className="brass-rule" aria-hidden="true"></span>
          <h2 className="font-display text-stone-900 text-2xl sm:text-3xl">Privacy</h2>
        </div>
        <div className="bg-white border border-stone-200/60 rounded-2xl p-6 sm:p-8">
          <p className="text-stone-700 leading-relaxed mb-4">
            Atelier is a private wardrobe. Your pieces, your wears, your photos — they live in your account, encrypted in transit and at rest. We do not sell, share, or train on your data. The Concierge sees only what you've added; the model never receives your personal details beyond the wardrobe and notes you've written.
          </p>
          <p className="text-stone-700 leading-relaxed mb-4">
            You can export your full wardrobe at any time from the Backup section below, and delete your account permanently from the Settings section. Deletions are immediate and irrecoverable — we keep no archive.
          </p>
          {founderCount !== null && (
            <div className="mt-6 pt-6 border-t border-stone-200 flex items-center gap-3">
              <span className="inline-block w-4 h-px bg-brass-400" aria-hidden="true" />
              <p className="text-[11px] tracking-[0.28em] uppercase text-stone-500">
                Atelier · {founderCount.toLocaleString()} founder{founderCount === 1 ? '' : 's'} to date
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Calendar — optional Google Calendar connection. Read-only: the
          Concierge uses upcoming events to dress you for what's on. */}
      <section id="profile-calendar" className="scroll-mt-24 space-y-6 md:space-y-8">
        <div className="flex items-center gap-3">
          <span className="brass-rule" aria-hidden="true"></span>
          <h2 className="font-display text-stone-900 text-2xl sm:text-3xl">Calendar</h2>
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

      {/* Subscription — non-owners only. Owners don't pay. The customer portal
          link goes to Lemon Squeezy's hosted billing UI where customers sign
          in with their email and can update card, change plan, view invoices,
          or cancel. Per-subscription deep-links exist but are signed and expire,
          so we link to the generic store entry. */}
      {!isOwner && (
        <div id="profile-subscription" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <h3 className="font-display text-2xl text-stone-900 mb-2">Membership</h3>
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

      {isOwner && (
        <div id="profile-people" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-baseline justify-between mb-6">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Invited Friends</h3>
            <span className="text-xs text-stone-400 tracking-widest uppercase">{allowlist.length} {allowlist.length === 1 ? 'person' : 'people'}</span>
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

      <div id="profile-settings" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-6">Settings</h3>

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

      <div id="profile-style" className="scroll-mt-24 space-y-10 md:space-y-12">
        <StyleProfileCard measurements={measurements} saveMeasurements={saveMeasurements} />
        <StyleManifestoCard measurements={measurements} saveMeasurements={saveMeasurements} items={items} outfits={outfits} inspirations={inspirations} />
      </div>

      <div id="profile-cutouts" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-2">Photo cutouts <span className="text-[10px] tracking-widest uppercase text-brass-600 ml-2 align-middle">Beta</span></h3>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xl">
              Auto-remove the background from item photos so pieces sit on a clean transparent surface. Heavy in-browser model — first use will be slow while it downloads (~5MB). If anything fails, the original photo is kept.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 cursor-pointer shrink-0">
            <span className="text-xs tracking-widest uppercase text-stone-500">{measurements?.removeBackground ? 'On' : 'Off'}</span>
            <input type="checkbox" className="sr-only peer"
              checked={!!measurements?.removeBackground}
              onChange={(e) => saveMeasurements({ ...measurements, removeBackground: e.target.checked })} />
            <span className="w-11 h-6 bg-stone-200 rounded-full peer-checked:bg-stone-900 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></span>
          </label>
        </div>
      </div>

      <FitProfileCard measurements={measurements} />

      <BackfillCard items={items} shops={shops} onUpdateItem={onUpdateItem} />

      <RehostCard items={items} onUpdateItem={onUpdateItem} />

      <div id="profile-backup" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-2">Backup &amp; export</h3>
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
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Trash</h3>
            <span className="text-[10px] tracking-widest uppercase text-stone-500">{deletedItems.length} item{deletedItems.length === 1 ? '' : 's'}</span>
          </div>
          <p className="text-stone-500 text-sm mb-6">Deleted items live here for 30 days. Restore anything, or remove forever.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {deletedItems.map((item) => {
              const days = item.deletedAt ? Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86_400_000) : 0;
              return (
                <div key={item.id} className="flex flex-col gap-2">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 opacity-60">
                    {itemImages(item)[0] && <img src={itemImages(item)[0]} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
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

      <div id="profile-measurements" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="bg-stone-50 border border-stone-200 text-stone-600 p-5 rounded-2xl text-sm flex gap-4 mb-10 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5 text-stone-900" size={20} strokeWidth={1.5} />
          <p>Recording your measurements here makes it quick to <strong>cross-check brand size charts</strong> before buying anything on your wishlist. Stored privately under your account.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {[
            { id: 'height', label: 'Height (cm)' }, { id: 'weight', label: 'Weight (kg)' },
            { id: 'chest', label: 'Chest (cm)' }, { id: 'waist', label: 'Waist (cm)' },
            { id: 'hips', label: 'Hips (cm)' }, { id: 'shoeSize', label: 'Shoe Size (EU)' },
          ].map(field => (
            <div key={field.id} className="relative">
              <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2 ml-1">{field.label}</label>
              <input type="number" name={field.id} value={localMeasurements[field.id] || ''} onChange={handleChange}
                className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-stone-900 outline-none transition-all text-stone-900"
              />
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-stone-100 flex justify-end">
          <button onClick={() => saveMeasurements(localMeasurements)} className="bg-stone-900 text-white px-8 py-4 rounded-xl font-medium flex items-center gap-3 hover:bg-stone-700 transition-all shadow-lg hover:shadow-xl">
            <Save size={18} strokeWidth={1.5} /> Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}
