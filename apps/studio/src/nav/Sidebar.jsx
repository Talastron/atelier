import React from 'react';
import { Sparkles, Home, LayoutGrid, Camera, Calendar, BookOpen, Bookmark, FileText, Store, ChevronRight } from 'lucide-react';
import AtelierMark from '../components/AtelierMark.jsx';

function DesktopNavItem({ icon: Icon, label, id, activeTab, setTab }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setTab(id)}
      // Active state: white bg + bold text + chevron is plenty of signal
      // on the #F7F5F2 sidebar. No shadow — nav items should feel anchored
      // to the sidebar, not floating above it.
      // Hover: stone-200/70 — stone-100 was visually identical to the
      // #F7F5F2 sidebar bg (only 2 RGB points apart), so the hover read
      // as "no feedback at all." Stone-200/70 is a clear step down.
      className={`w-full h-12 flex items-center justify-between px-5 rounded-2xl transition-colors duration-200 ${
        isActive ? 'bg-white text-stone-900' : 'text-stone-500 hover:bg-stone-200/70 hover:text-stone-900'
      }`}
    >
      <div className="flex items-center gap-4">
        <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
        <span className={`text-sm tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>{label}</span>
      </div>
      {isActive && <ChevronRight size={16} className="text-stone-400" strokeWidth={1.5} />}
    </button>
  );
}

export default function Sidebar({ activeTab, setActiveTab, onOpenConcierge, user, demoMode, signOutUser, setInspirationDefaultFilter }) {
  return (
    <aside className="hidden lg:flex flex-col w-72 bg-cream border-r border-stone-200/60 px-8 pb-6 h-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>
      {/* Logo block. The account avatar lives as a fixed top-right pill (App.jsx,
          desktop) so the sidebar is a clean nav column and nothing clips. */}
      <div className="flex items-center gap-3 mb-8">
        <AtelierMark size={42} />
        <h1 className="text-3xl font-display font-medium tracking-wide">Atelier<span className="text-[#D4B378]">.</span></h1>
      </div>

      {/* Editorial eyebrow + brass rule above the nav — mirrors the
          "GOOD MORNING, SIBYLLE" + brass-rule pattern in every main
          column header. The sidebar now speaks the same typographic
          language instead of being a flat list floating in the page. */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <span className="brass-rule" aria-hidden="true"></span>
        <p className="text-stone-400 text-[10px] tracking-[0.28em] uppercase font-medium">
          Studio
        </p>
      </div>
      <nav className="space-y-2 flex-1 min-h-0 overflow-y-auto hide-scrollbar">
        {/* THE CONCIERGE — flagship AI feature, sits at the top of
            the sidebar as the most luxurious entry point. Not a
            destination tab (it's an overlay), so we use a plain
            button styled to match DesktopNavItem. Brass-coloured
            Sparkles icon signals 'special' without screaming. */}
        <button
          onClick={() => onOpenConcierge()}
          className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-stone-700 hover:bg-stone-200/70 hover:text-stone-900 transition-colors duration-200 group"
        >
          <span className="w-5 flex items-center justify-center text-brass-500 group-hover:text-brass-600 transition-colors">
            <Sparkles size={18} strokeWidth={1.5} />
          </span>
          <span className="text-sm font-medium">Concierge</span>
          <span className="ml-auto text-[9px] tracking-[0.25em] uppercase text-stone-400 group-hover:text-brass-500 transition-colors">Ask</span>
        </button>
        {/* Primary pillars */}
        <DesktopNavItem id="today" icon={Home} label="Today" activeTab={activeTab} setTab={setActiveTab} />
        <DesktopNavItem id="wardrobe" icon={LayoutGrid} label="Wardrobe" activeTab={activeTab} setTab={setActiveTab} />
        <DesktopNavItem id="outfits" icon={Camera} label="Styling Studio" activeTab={activeTab} setTab={setActiveTab} />
        <DesktopNavItem id="calendar" icon={Calendar} label="Calendar" activeTab={activeTab} setTab={setActiveTab} />
        <DesktopNavItem id="lookbook" icon={BookOpen} label="Lookbook" activeTab={activeTab} setTab={setActiveTab} />

        {/* Secondary — grouped under a "More" eyebrow (mirrors the "Studio"
            eyebrow above). "Account" identity actions live in the avatar menu at
            the top, so this group stays purely supporting destinations. */}
        <div className="flex items-center gap-3 mt-6 mb-3 px-1">
          <span className="brass-rule" aria-hidden="true"></span>
          <p className="text-stone-400 text-[10px] tracking-[0.28em] uppercase font-medium">More</p>
        </div>
        <DesktopNavItem id="inspiration" icon={Bookmark} label="Inspiration" activeTab={activeTab} setTab={(id) => { setInspirationDefaultFilter('all'); setActiveTab(id); }} />
        <DesktopNavItem id="insights" icon={FileText} label="Insights" activeTab={activeTab} setTab={setActiveTab} />
        <DesktopNavItem id="shops" icon={Store} label="Directory" activeTab={activeTab} setTab={setActiveTab} />
      </nav>
    </aside>
  );
}
