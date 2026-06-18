// apps/marketing/src/components/Hero.jsx
import React from 'react';
import { Camera, ChevronRight } from 'lucide-react';
import { BrassRule } from '@atelier/ui';

export function Hero({ editUrl }) {
  return (
    <section
      className="text-center"
      style={{
        paddingTop: '10rem',
        paddingBottom: 'var(--atelier-section-padding-y)',
        paddingInline: 'var(--atelier-page-padding)',
        maxWidth: 'var(--atelier-container-max)',
        margin: '0 auto',
      }}
    >
      <div className="flex items-center justify-center gap-3 mb-6">
        <BrassRule />
        <p
          className="text-xs uppercase text-stone-500 font-semibold"
          style={{ letterSpacing: 'var(--atelier-tracking-eyebrow)' }}
        >
          Your Digital Collection
        </p>
        <BrassRule />
      </div>

      <h1
        className="text-5xl md:text-7xl text-stone-900 tracking-tight max-w-4xl mx-auto mb-8"
        style={{
          fontFamily: 'var(--atelier-font-display)',
          lineHeight: 'var(--atelier-leading-display)',
        }}
      >
        The quiet luxury of a beautifully organised wardrobe.
      </h1>

      <p
        className="text-lg md:text-xl text-stone-500 max-w-2xl mx-auto mb-10"
        style={{ lineHeight: 'var(--atelier-leading-body)' }}
      >
        Digitise your fashion investments in seconds using artificial intelligence.
        Compose editorial outfits, track cost per wear, and plan your weekly styling
        with absolute precision.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a
          href={editUrl}
          className="bg-stone-900 text-white px-8 py-4 rounded-full text-base font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-95 inline-flex items-center gap-2"
        >
          Start Curating <ChevronRight size={18} />
        </a>
        <a
          href="#features"
          className="text-sm font-medium text-stone-600 hover:text-stone-900 px-6 py-4 transition-colors"
        >
          Discover the features
        </a>
      </div>

      {/* Abstract hero visual */}
      <div className="mt-20 aspect-[16/9] md:aspect-[21/9] bg-white rounded-[2rem] border border-stone-200/60 overflow-hidden relative smooth-shadow flex items-center justify-center group cursor-pointer">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-50 to-stone-200/50 opacity-80"></div>
        <div className="text-center z-10 transition-transform duration-500 group-hover:scale-105">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4">
            <Camera size={28} strokeWidth={1.5} className="text-stone-900" />
          </div>
          <p
            className="text-2xl text-stone-900"
            style={{ fontFamily: 'var(--atelier-font-display)' }}
          >
            Experience the Studio
          </p>
          <p className="text-sm text-stone-500 mt-2">Product interface preview</p>
        </div>
      </div>
    </section>
  );
}
