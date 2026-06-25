import React from 'react';
import { Sparkles, Home, LayoutGrid, Camera, Calendar, BookOpen, Bookmark, PoundSterling, Store, ChevronRight, LogOut } from 'lucide-react';
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
    <aside className="hidden lg:flex flex-col w-72 bg-[#F7F5F2] border-r border-stone-200/60 px-8 pb-8 h-full overflow-y-auto hide-scrollbar" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
      {/* Logo block height + this margin is tuned so the first nav pill
          (Wardrobe) sits at the same Y as the search bar in the main
          column. Math: main scroll-container has the page header
          (~144px tall) + 8px gap; sidebar has 48px top padding +
          ~42px logo. So mb ≈ 144 + 8 - 48 - 42 ≈ 62px → mb-[3.875rem]
          rounded to mb-16 (4rem) for the cleanest visual baseline. */}
      <div className="flex items-center gap-3 mb-16">
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
      <nav className="space-y-2 flex-1">
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

        {/* Secondary — quieter, below a hairline */}
        <div className="border-t border-stone-200/60 my-3" aria-hidden="true"></div>
        <DesktopNavItem id="inspiration" icon={Bookmark} label="Inspiration" activeTab={activeTab} setTab={(id) => { setInspirationDefaultFilter('all'); setActiveTab(id); }} />
        <DesktopNavItem id="finance" icon={PoundSterling} label="Insights" activeTab={activeTab} setTab={setActiveTab} />
        <DesktopNavItem id="shops" icon={Store} label="Directory" activeTab={activeTab} setTab={setActiveTab} />
      </nav>

      <div className="border-t border-stone-200/60 pt-5 mt-6">
        <button onClick={() => setActiveTab('profile')}
          // Same hover language as nav items: stone-200/70 on the
          // #F7F5F2 sidebar (stone-100 was invisible against #F7F5F2).
          className="w-full flex items-center gap-3.5 px-2 py-2.5 rounded-2xl hover:bg-stone-200/70 transition-colors duration-200 group"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full ring-2 ring-stone-100 shrink-0" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-stone-900 text-white flex items-center justify-center font-display text-base shrink-0">
              {(user?.displayName || user?.email || (demoMode ? 'D' : '?')).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-stone-900 truncate">{user?.displayName || (demoMode ? 'Demo guest' : 'Account')}</p>
            <p className="text-[11px] text-stone-500 truncate">{user?.email || (demoMode ? 'Sign up to save' : '')}</p>
          </div>
          <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" strokeWidth={1.5} />
        </button>
        {/* Sign out — left-aligned with profile-row content above (matches
            the 12px avatar + 14px gap so the icon lines up under the name). */}
        <button onClick={signOutUser} className="w-full flex items-center gap-2 mt-2 px-2 py-2 rounded-xl text-[10px] tracking-widest uppercase text-stone-400 hover:bg-stone-200/70 hover:text-stone-900 transition-colors duration-200">
          <span className="w-12 flex items-center justify-center shrink-0">
            <LogOut size={12} strokeWidth={1.5} />
          </span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
