import React, { useState } from "react";
import { Link as LinkIcon, Plus, Trash2, Search, Store, X } from "lucide-react";
import EditorialHeader from "../ui/EditorialHeader.jsx";
import Input from "../ui/Input.jsx";
import { newId } from "../lib/items.js";
import { SHOP_SEEDS } from "../lib/seeds.js";

function ShopRow({ shop, saveShop, deleteShop }) {
  const [editingChart, setEditingChart] = useState(false);
  const [rows, setRows] = useState(shop.sizes || []);
  const chartCount = (shop.sizes || []).length;

  const updateRow = (i, field, value) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((prev) => [...prev, { label: '', bust: '', waist: '', hips: '' }]);
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const saveChart = async () => {
    const cleaned = rows.filter((r) => r.label?.trim()).map((r) => ({
      label: r.label.trim(),
      bust: r.bust ? Number(r.bust) : null,
      waist: r.waist ? Number(r.waist) : null,
      hips: r.hips ? Number(r.hips) : null,
    }));
    await saveShop({ ...shop, sizes: cleaned });
    setEditingChart(false);
  };

  return (
    <div className="bg-white border border-stone-200/60 rounded-2xl p-6 hover:shadow-lg transition-all group duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-xl text-stone-900">{shop.name}</h4>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <a href={shop.url} target="_blank" rel="noopener noreferrer" className="text-xs tracking-wider uppercase font-semibold text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5">
              <LinkIcon size={12} strokeWidth={2} /> Visit Store
            </a>
            {shop.category && (<>
              <span className="w-1 h-1 rounded-full bg-stone-300"></span>
              <span className="text-stone-500 text-xs tracking-widest uppercase">{shop.category}</span>
            </>)}
            {chartCount > 0 && (<>
              <span className="w-1 h-1 rounded-full bg-stone-300"></span>
              <span className="text-emerald-700 text-xs tracking-widest uppercase font-medium">{chartCount} sizes</span>
            </>)}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => { setRows(shop.sizes || []); setEditingChart((v) => !v); }}
            className="px-3 py-2 rounded-full text-xs tracking-widest uppercase text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
          >
            {editingChart ? 'Cancel' : 'Sizes'}
          </button>
          <button onClick={() => deleteShop(shop.id)} className="text-stone-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors">
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {editingChart && (
        <div className="mt-6 pt-6 border-t border-stone-100">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Size Chart (cm)</p>
            <p className="text-[10px] text-stone-400">Enter what you can — partial rows are fine.</p>
          </div>
          <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mb-2 text-[10px] tracking-widest uppercase text-stone-400 font-semibold">
            <span>Size</span><span>Bust</span><span>Waist</span><span>Hips</span><span></span>
          </div>
          <div className="space-y-3 sm:space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={row.label || ''} onChange={(e) => updateRow(i, 'label', e.target.value)} placeholder="Size" aria-label="Size label" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <input value={row.bust || ''} onChange={(e) => updateRow(i, 'bust', e.target.value)} placeholder="Bust" aria-label="Bust cm" type="number" inputMode="decimal" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <input value={row.waist || ''} onChange={(e) => updateRow(i, 'waist', e.target.value)} placeholder="Waist" aria-label="Waist cm" type="number" inputMode="decimal" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <input value={row.hips || ''} onChange={(e) => updateRow(i, 'hips', e.target.value)} placeholder="Hips" aria-label="Hips cm" type="number" inputMode="decimal" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <button onClick={() => removeRow(i)} className="text-stone-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"><X size={14} strokeWidth={1.5} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addRow} className="flex-1 px-4 py-3 rounded-xl text-sm bg-white border border-dashed border-stone-300 text-stone-500 hover:border-stone-500 hover:text-stone-900 transition-all flex items-center justify-center gap-2">
              <Plus size={14} strokeWidth={1.5} /> Add size row
            </button>
            <button onClick={saveChart} className="px-6 py-3 rounded-xl text-sm bg-stone-900 text-white hover:bg-stone-700 transition-all font-medium">
              Save chart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShoppingDirectory({ shops, saveShop, deleteShop }) {
  const [newShop, setNewShop] = useState({ name: '', url: '', category: '' });
  const [restoring, setRestoring] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const existingShopNames = new Set(shops.map((s) => (s.name || '').toLowerCase()));
  const missingPresets = SHOP_SEEDS.filter((s) => !existingShopNames.has(s.name.toLowerCase()));

  // Simple search filter — name OR category. Stays empty by default
  // (most users have a small directory; search only earns its place
  // once you've added enough brands for scanning to be slow).
  const filteredShops = searchQuery.trim()
    ? shops.filter((s) => {
        const q = searchQuery.trim().toLowerCase();
        return (s.name || '').toLowerCase().includes(q)
            || (s.category || '').toLowerCase().includes(q);
      })
    : shops;

  const addShop = async (e) => {
    e.preventDefault();
    if (!newShop.name || !newShop.url) return;
    const id = newId();
    await saveShop({ ...newShop, id });
    setNewShop({ name: '', url: '', category: '' });
  };

  const restorePresets = async () => {
    setRestoring(true);
    try {
      for (const preset of missingPresets) {
        const id = newId();
        await saveShop({ ...preset, id });
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-10 md:space-y-12 max-w-5xl">
      <EditorialHeader
        eyebrow="Curated houses"
        title="Directory"
        subtitle="Your trusted designers and boutiques."
        right={missingPresets.length > 0 ? (
          <button onClick={restorePresets} disabled={restoring}
            className="bg-white border border-stone-300 text-stone-700 px-5 py-3 rounded-full text-xs tracking-widest uppercase font-medium hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 disabled:opacity-50"
          >
            {restoring ? 'Adding…' : `Add ${missingPresets.length} preset ${missingPresets.length === 1 ? 'brand' : 'brands'}`}
          </button>
        ) : null}
      />

      {/* Sticky search strip — same bg/bleed pattern as the Wardrobe /
          Inspiration / Insights / Profile sticky bars. Only renders the
          search input when there are 3+ shops (below that, scanning the
          short list is faster than typing). Anchor consistency across all
          content views: a sticky strip below the editorial header. */}
      {/* top-0 only — <main> supplies the safe-area inset; re-adding
          top:inset double-offsets this bar in standalone/PWA. */}
      {shops.length >= 3 && (
        <div className="sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 py-3 bg-[#F7F5F2] border-b border-stone-200/60">
          <div className="relative max-w-md">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search boutiques by name or aesthetic…"
              className="w-full h-10 pl-9 pr-9 bg-white border border-stone-300 rounded-full text-sm placeholder:text-stone-400 focus:border-stone-900 outline-none transition-colors"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-base pointer-events-none leading-none">⌕</span>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
                aria-label="Clear search">
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          {/* Canonical card padding (p-6 md:p-8) + heading sizing matches
              every other section card across the app. sticky top-20 leaves
              room for the sticky search strip above (when it renders) —
              same offset Studio's Current Look uses below its sticky tabs. */}
          <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow lg:sticky lg:top-20">
            <h3 className="font-display text-xl md:text-2xl mb-6 text-stone-900">Add Boutique</h3>
            <form onSubmit={addShop} className="space-y-5">
              <Input label="Boutique Name" value={newShop.name} onChange={e => setNewShop({...newShop, name: e.target.value})} type="text" required />
              <Input label="Website Link" value={newShop.url} onChange={e => setNewShop({...newShop, url: e.target.value})} type="url" placeholder="https://" required />
              <Input label="Aesthetic / Category" value={newShop.category} onChange={e => setNewShop({...newShop, category: e.target.value})} type="text" placeholder="e.g. Minimalist Basics" />
              <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-700 transition-colors duration-200 mt-4">Save to Directory</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 grid gap-4 align-top content-start">
          {filteredShops.map(shop => (
            <ShopRow key={shop.id} shop={shop} saveShop={saveShop} deleteShop={deleteShop} />
          ))}
          {shops.length === 0 && <p className="text-stone-400 italic text-center py-10 border border-dashed border-stone-300 rounded-2xl">No boutiques added yet.</p>}
          {shops.length > 0 && filteredShops.length === 0 && (
            <p className="text-stone-400 italic text-center py-10 border border-dashed border-stone-300 rounded-2xl">
              No boutiques match "{searchQuery}".
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick verdict on today's wear — chips for common reactions plus free-text.
// Debounces saves so typing doesn't write to Firestore on every keystroke.
