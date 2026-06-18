import React from 'react';
import { Sparkles, Camera, BarChart3, Lock, ChevronRight, Wand2, Calendar, Bookmark } from 'lucide-react';

export default function AtelierLandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F2] font-sans text-stone-900 selection:bg-brass-200 selection:text-stone-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Jost', sans-serif; }
        .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        .brass-rule { display: inline-block; width: 24px; height: 1.5px; background-color: #D4B378; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F7F5F2]/90 backdrop-blur-md border-b border-stone-200/60">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtelierMark size={32} />
            <span className="font-display text-2xl tracking-tight">Atelier.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://app.myatelier.style" className="hidden md:block text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">
              Sign In
            </a>
            <a href="https://app.myatelier.style" className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-95">
              Open Studio
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 max-w-6xl mx-auto text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="brass-rule" aria-hidden="true"></span>
          <p className="text-xs tracking-[0.3em] uppercase text-stone-500 font-semibold">
            Your Digital Collection
          </p>
          <span className="brass-rule" aria-hidden="true"></span>
        </div>
        <h1 className="font-display text-5xl md:text-7xl text-stone-900 leading-[1.05] tracking-tight max-w-4xl mx-auto mb-8">
          The quiet luxury of a beautifully organised wardrobe.
        </h1>
        <p className="text-lg md:text-xl text-stone-500 max-w-2xl mx-auto leading-relaxed mb-10">
          Digitise your fashion investments in seconds using artificial intelligence. Compose editorial outfits, track cost per wear, and plan your weekly styling with absolute precision.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="https://app.myatelier.style" className="bg-stone-900 text-white px-8 py-4 rounded-full text-base font-medium hover:bg-stone-700 transition-all shadow-lg active:scale-95 inline-flex items-center gap-2">
            Start Curating <ChevronRight size={18} />
          </a>
          <a href="#features" className="text-sm font-medium text-stone-600 hover:text-stone-900 px-6 py-4 transition-colors">
            Discover the features
          </a>
        </div>
        
        {/* Abstract Hero Visual */}
        <div className="mt-20 aspect-[16/9] md:aspect-[21/9] bg-white rounded-[2rem] border border-stone-200/60 overflow-hidden relative smooth-shadow flex items-center justify-center group cursor-pointer">
           <div className="absolute inset-0 bg-gradient-to-br from-stone-50 to-stone-200/50 opacity-80"></div>
           <div className="text-center z-10 transition-transform duration-500 group-hover:scale-105">
             <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mx-auto mb-4">
               <Camera size={28} strokeWidth={1.5} className="text-stone-900" />
             </div>
             <p className="font-display text-2xl text-stone-900">Experience the Studio</p>
             <p className="text-sm text-stone-500 mt-2">Product interface preview</p>
           </div>
        </div>
      </section>

      {/* Primary Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <EditorialHeader 
            eyebrow="The Toolkit" 
            title="Master your aesthetic." 
            subtitle="Built for professionals who treat their wardrobe as an investment portfolio." 
            className="mb-16 md:text-center md:items-center"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Sparkles size={24} className="text-brass-600" />}
              title="Identify with AI"
              description="Snap a single photo. Our vision artificial intelligence automatically categorises the brand, colours, and materials instantly."
            />
            <FeatureCard 
              icon={<Wand2 size={24} className="text-stone-700" />}
              title="Editorial Styling"
              description="Drag and drop your pieces onto a clean canvas to compose layered outfits. Ask Gemini to suggest looks based on the daily weather forecast."
            />
            <FeatureCard 
              icon={<Calendar size={24} className="text-stone-700" />}
              title="Travel Planning"
              description="Type any destination in the world. Atelier fetches the forecast and packs a dedicated capsule collection from your existing wardrobe."
            />
            <FeatureCard 
              icon={<BarChart3 size={24} className="text-emerald-700" />}
              title="Investment Insights"
              description="Track your true cost per wear. Spot the gaps in your collection and see exactly which pieces deliver the highest value."
            />
            <FeatureCard 
              icon={<Bookmark size={24} className="text-stone-700" />}
              title="Style Manifesto"
              description="Atelier analyses your most worn pieces and saved inspirations to write a private three paragraph brief of your true aesthetic."
            />
            <FeatureCard 
              icon={<Lock size={24} className="text-stone-700" />}
              title="Private by Design"
              description="Your collection is entirely your own. Share specific looks with friends using read only links while keeping your data perfectly secure."
            />
          </div>
        </div>
      </section>

      {/* The Lifestyle Statement */}
      <section className="py-24 px-6 bg-stone-900 text-white rounded-[3rem] mx-4 sm:mx-8 mb-24 relative overflow-hidden shadow-2xl">
        <div className="absolute -right-20 -bottom-20 opacity-[0.03] pointer-events-none">
          <Sparkles size={400} strokeWidth={0.5} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-medium">The Philosophy</span>
            <span className="brass-rule" aria-hidden="true"></span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.1] mb-8">
            Buy less. Wear better. Curate a collection that lasts a lifetime.
          </h2>
          <p className="text-stone-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-12">
            We believe that true style comes from understanding what you own. Stop losing beautiful pieces in the back of the closet and start styling with intention.
          </p>
          <a href="https://app.myatelier.style" className="bg-brass-300 text-stone-900 px-8 py-4 rounded-full text-base font-medium hover:bg-brass-200 transition-all shadow-lg active:scale-95 inline-flex items-center gap-2">
            Begin your curation
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#F7F5F2] border-t border-stone-200/60 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <AtelierMark size={28} />
            <span className="font-display text-xl text-stone-900 tracking-tight">Atelier.</span>
          </div>
          <div className="flex gap-6 text-sm text-stone-500 font-medium">
            <a href="https://app.myatelier.style" className="hover:text-stone-900 transition-colors">Sign In</a>
            <a href="mailto:contact@myatelier.style" className="hover:text-stone-900 transition-colors">Support</a>
            <a href="#" className="hover:text-stone-900 transition-colors">Privacy</a>
          </div>
          <p className="text-xs text-stone-400 tracking-wider uppercase">
            © {new Date().getFullYear()} Atelier Digital. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white border border-stone-200/60 p-8 rounded-[2rem] smooth-shadow hover:-translate-y-1 transition-all duration-300 group">
      <div className="w-14 h-14 bg-stone-50 border border-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="font-display text-2xl text-stone-900 mb-3">{title}</h3>
      <p className="text-stone-500 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  );
}

function EditorialHeader({ eyebrow, title, subtitle, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 ${className}`}>
      {eyebrow && (
        <div className="flex items-center gap-3 mb-1">
          <span className="brass-rule" aria-hidden="true"></span>
          <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">{eyebrow}</span>
        </div>
      )}
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-display text-stone-900 tracking-tight leading-[1.05]">{title}</h2>
      {subtitle && <p className="text-stone-500 mt-2 text-base md:text-lg tracking-wide max-w-xl leading-relaxed">{subtitle}</p>}
    </header>
  );
}

function AtelierMark({ size = 40, light = false }) {
  const bg = light ? "#292524" : "#1c1917";
  const line = light ? "#a8a29e" : "#F7F5F2";
  const brass = "#D4B378";
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="256" height="256" fill={bg} rx="56" />
      <g fill="none" stroke={line} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110" />
        <path d="M 128 110 L 62 184 L 194 184 Z" />
      </g>
      <line x1="128" y1="184" x2="128" y2="206" stroke={brass} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="128" cy="212" r="5" fill={brass} />
    </svg>
  );
}