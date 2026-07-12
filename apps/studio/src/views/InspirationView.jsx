import React, { useState, useEffect } from "react";
import { Bookmark, ChevronRight, Heart, Plus, Sparkles, Trash2 } from "lucide-react";
import EditorialHeader from "../ui/EditorialHeader.jsx";
import { derivePaletteFromGarments } from "../lib/color.js";
import { parseSourceUrl } from "../lib/canvas.js";
import { COLOR_SWATCHES } from "../lib/taxonomy.js";

export default function InspirationView({ inspirations, onOpenInspiration, onAddInspiration, onDelete, defaultFilter = 'all', wishlistCount = 0, onJumpToWishlist }) {
  // Filter: 'all' or 'unanalysed'. Initialised from defaultFilter so the
  // digest can target the user straight to unanalysed inspirations.
  const [filter, setFilter] = useState(defaultFilter);
  useEffect(() => { setFilter(defaultFilter); }, [defaultFilter]);
  const unanalysed = inspirations.filter((i) => !i.analysis);
  const visible = filter === 'unanalysed' ? unanalysed : inspirations;

  return (
    <div className="space-y-6 md:space-y-10">
      <EditorialHeader
        eyebrow="Mood board"
        title="Inspiration"
        subtitle={`${inspirations.length} ${inspirations.length === 1 ? 'look' : 'looks'} saved${unanalysed.length > 0 ? ` · ${unanalysed.length} unanalysed` : ''}`}
        right={
          <button onClick={onAddInspiration}
            className="bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-medium inline-flex items-center gap-2 hover:bg-stone-700 transition-all shadow-lg active:scale-[0.98]">
            <Plus size={16} strokeWidth={1.5} /> Save inspiration
          </button>
        }
      />

      {inspirations.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center bg-white/50 border border-dashed border-stone-300 rounded-3xl px-6">
          <div className="mb-6 text-brass-400">
            <Bookmark size={40} strokeWidth={1.25} />
          </div>
          <div className="w-8 h-px bg-brass-300 mb-5" aria-hidden="true" />
          <p className="font-display text-2xl text-stone-700">Your moodboard begins here</p>
          <p className="text-sm text-stone-500 mt-3 max-w-xs leading-relaxed italic">
            Save inspiration by tapping the button above — Concierge analyses each look to find what's in your wardrobe and what's missing.
          </p>
        </div>
      ) : (
        <>
          {/* Sticky filter strip — same pattern as the wardrobe view's
              filter/sort toolbar. Stays visible while scrolling a long
              inspiration grid so the user can switch between All and
              Unanalysed without scrolling back to the top. */}
          <div className="flex items-center gap-2 flex-wrap sticky top-0 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-12 lg:px-12 py-3 bg-[#F7F5F2] border-b border-stone-200/60"
               style={{ top: 'env(safe-area-inset-top, 0px)' }}>
            {unanalysed.length > 0 && [['all', `All · ${inspirations.length}`], ['unanalysed', `Unanalysed · ${unanalysed.length}`]].map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`shrink-0 text-[10px] sm:text-xs tracking-widest uppercase px-3 py-1.5 rounded-full transition-colors duration-200 border ${
                  filter === f
                    ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-700'
                    : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900'
                }`}>{label}</button>
            ))}
            {/* Cross-link to wishlist */}
            {wishlistCount > 0 && onJumpToWishlist && (
              <button onClick={onJumpToWishlist}
                className="shrink-0 text-[10px] sm:text-xs tracking-widest uppercase px-3 py-1.5 rounded-full transition-colors duration-200 border bg-white border-stone-300 text-stone-700 hover:border-stone-500 hover:text-stone-900 inline-flex items-center gap-1.5 ml-auto">
                <Heart size={11} strokeWidth={1.5} /> Wishlist · {wishlistCount}
                <ChevronRight size={11} strokeWidth={1.5} className="-mr-0.5" />
              </button>
            )}
            {unanalysed.length > 0 && (
              <span className="text-[10px] tracking-widest uppercase text-stone-500 ml-2 w-full sm:w-auto">
                <Sparkles size={11} strokeWidth={1.5} className="inline -mt-0.5 mr-1 text-brass-400" />
                Tap any card to analyse it with the Concierge
              </span>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-6">
              <div className="mb-4 text-brass-400">
                <Bookmark size={32} strokeWidth={1.25} />
              </div>
              <div className="w-6 h-px bg-brass-300 mb-4" aria-hidden="true" />
              <p className="font-display text-xl text-stone-700">
                {filter === 'unanalysed' ? 'All looks analysed' : 'Nothing here yet'}
              </p>
              <p className="text-sm text-stone-500 mt-2 max-w-xs leading-relaxed italic">
                {filter === 'unanalysed'
                  ? 'Every saved look has been analysed by the Concierge.'
                  : 'Save a look to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {visible.map((insp) => {
                const isAnalysed = !!insp.analysis;
                const garmentList = isAnalysed ? (insp.analysis.garments || []) : [];
                const matchCount = garmentList.filter((g) => g.matchedItemId).length;
                const totalGarments = garmentList.length;
                const cardPalette = isAnalysed
                  ? derivePaletteFromGarments(garmentList).slice(0, 5)
                  : [];
                const sourceHost = (() => {
                  const src = insp.sourceUrl || insp.caption || '';
                  return parseSourceUrl(src)?.hostname || null;
                })();
                return (
                  <div key={insp.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onOpenInspiration(insp.id)}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/60 transition-all duration-300 lg:group-hover:border-brass-300 lg:group-hover:shadow-lg lg:group-hover:scale-[1.015]">
                        {insp.image ? (
                          <img
                            src={insp.image}
                            alt={insp.caption || ''}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover transition-transform duration-700 ease-out lg:group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300">
                            <Bookmark size={32} strokeWidth={1} />
                          </div>
                        )}

                        {/* Top-left: analysis state */}
                        <div className="absolute top-2.5 left-2.5">
                          {isAnalysed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-sm text-[9px] tracking-[0.22em] uppercase font-medium text-stone-800">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brass-500" aria-hidden="true" />
                              Analysed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900/80 backdrop-blur-sm text-[9px] tracking-[0.22em] uppercase font-medium text-white animate-pulse">
                              <Sparkles size={9} strokeWidth={2} />
                              Tap to analyse
                            </span>
                          )}
                        </div>

                        {/* Top-right: source hostname (when imported from URL) */}
                        {sourceHost && (
                          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-white/85 backdrop-blur-sm text-[8px] tracking-[0.22em] uppercase text-stone-600">
                            {sourceHost}
                          </span>
                        )}

                        {/* Bottom gradient overlay: caption + palette dots + match chip */}
                        {(insp.caption || cardPalette.length > 0 || (isAnalysed && totalGarments > 0)) && (
                          <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                            {insp.caption && !parseSourceUrl(insp.caption) && (
                              <p className="font-display text-white text-[13px] sm:text-sm leading-snug truncate mb-1.5 drop-shadow-sm">
                                {insp.caption}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1">
                                {cardPalette.map((color, i) => {
                                  const swatch = COLOR_SWATCHES[color];
                                  const style = swatch
                                    ? (swatch.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch })
                                    : { backgroundColor: '#d6d3d1' };
                                  return (
                                    <span
                                      key={`${color}-${i}`}
                                      className="block w-3 h-3 rounded-full border border-white/40 shrink-0"
                                      style={style}
                                      aria-label={color}
                                    />
                                  );
                                })}
                              </div>
                              {isAnalysed && totalGarments > 0 && (
                                <span className={`text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full shrink-0 ${
                                  matchCount === 0
                                    ? 'bg-amber-500/20 text-amber-100'
                                    : matchCount === totalGarments
                                      ? 'bg-emerald-500/30 text-emerald-50'
                                      : 'bg-white/15 text-white'
                                }`}>
                                  {matchCount} / {totalGarments} owned
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Desktop hover quick-action: Delete */}
                    {onDelete && (
                      <div className="hidden lg:flex absolute -top-3 right-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDelete(insp.id); }}
                          className="w-7 h-7 rounded-full bg-white shadow-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:text-red-600 hover:border-red-200 transition-colors"
                          aria-label="Delete inspiration"
                          title="Delete inspiration"
                        >
                          <Trash2 size={12} strokeWidth={1.75} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

