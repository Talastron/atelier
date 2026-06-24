import React, { useState } from 'react';
import { LayoutGrid, Camera, Calendar, BookOpen, Sparkles } from 'lucide-react';

function MobileNavItem({ icon: Icon, label, id, activeTab, setTab, onScrollTop }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => {
        // iOS pattern: tapping the active tab again scrolls that view to top.
        if (isActive) onScrollTop?.();
        else setTab(id);
      }}
      className="flex flex-col items-center gap-1 px-3 py-2 w-[68px] min-h-[56px] transition-all active:scale-95 relative"
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={22} strokeWidth={isActive ? 2 : 1.5} className={`transition-all duration-200 ${isActive ? 'text-stone-900 scale-110' : 'text-stone-400'}`} />
      <span className={`text-[10px] tracking-wide transition-colors ${isActive ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>{label}</span>
      {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-stone-900" />}
    </button>
  );
}

// Mobile bottom-nav FAB — central button with two gestures:
//   • Tap    → onTap()        (default: open the Add-Item modal)
//   • Hold   → onLongPress()  (default: open the Atelier Concierge)
//
// The double action lets a single button serve both flagship paths
// (capture a new piece / consult the AI stylist) without crowding the
// nav. Discoverability comes from three sources:
//   1. The 5th onboarding step explicitly teaches the gesture.
//   2. A mid-press tooltip appears after ~180ms of holding, confirming
//      what releasing now would do. This self-teaches the long-press
//      to anyone who naturally tries holding it later.
//   3. Haptic buzz at the trigger moment (navigator.vibrate) — on
//      Android, makes the gesture feel intentional.
const FAB_LONG_PRESS_MS = 550;
const FAB_MOVE_THRESHOLD_PX = 12; // iOS HIG drag threshold — below this is jitter
function MobileFAB({ onTap, onLongPress }) {
  const [holdActive, setHoldActive] = useState(false);
  const longPressTimer = React.useRef(null);
  const tooltipTimer = React.useRef(null);
  const triggered = React.useRef(false);
  const moved = React.useRef(false);
  const startX = React.useRef(0);
  const startY = React.useRef(0);

  const cleanup = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (tooltipTimer.current)   { clearTimeout(tooltipTimer.current);   tooltipTimer.current   = null; }
    setHoldActive(false);
  };

  const onPointerDown = (e) => {
    // Mouse: only react to primary button.
    if (e.button !== undefined && e.button !== 0) return;

    // setPointerCapture is the FIX for the broken hold gesture: without
    // it, the tiniest subpixel finger jitter during touch fires
    // `pointerleave` and kills the timer before 550ms. Capturing binds
    // all further pointer events (move/up/cancel) to THIS element
    // regardless of finger position. A real drag is still caught by the
    // distance check in onPointerMove below.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ }

    triggered.current = false;
    moved.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;

    // Delay the tooltip slightly so a normal tap doesn't flash it.
    tooltipTimer.current = setTimeout(() => {
      if (!triggered.current && !moved.current) setHoldActive(true);
    }, 180);

    longPressTimer.current = setTimeout(() => {
      triggered.current = true;
      try { navigator.vibrate?.(20); } catch { /* iOS Safari ignores; that's fine */ }
      cleanup();
      onLongPress?.();
    }, FAB_LONG_PRESS_MS);
  };

  const onPointerMove = (e) => {
    if (!longPressTimer.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.hypot(dx, dy) > FAB_MOVE_THRESHOLD_PX) {
      moved.current = true;
      cleanup();
    }
  };

  const onPointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const fired = triggered.current;
    const wasMoved = moved.current;
    cleanup();
    if (!fired && !wasMoved) onTap?.();
  };

  const onPointerCancel = (e) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    moved.current = true;
    cleanup();
  };

  return (
    <div className="flex justify-center -mt-7 relative">
      {/* Mid-press tooltip — brass label confirming the gesture. */}
      {holdActive && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-bottom-1 duration-150 z-10">
          <div className="text-[10px] tracking-[0.25em] uppercase text-stone-900 bg-brass-100 ring-1 ring-brass-300 px-3 py-1.5 rounded-full shadow-md font-medium">
            Your stylist ✦
          </div>
        </div>
      )}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        className={`w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center text-white transition-all duration-200 active:scale-90 hover:scale-105 ring-4 ${holdActive ? 'ring-brass-300 scale-105' : 'ring-[#F7F5F2]'}`}
        style={{
          boxShadow: '0 10px 30px -8px rgba(28, 25, 23, 0.45)',
          // Disables iOS Safari's long-press callout (the "copy / share" menu)
          // and the double-tap-zoom delay so our gesture feels native-native.
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          touchAction: 'manipulation',
        }}
        aria-label="Open the Concierge — your private stylist"
      >
        {/* The centre FAB is now the Concierge — brass Sparkles to match the
            desktop sidebar's Concierge entry. Tap or hold opens the stylist. */}
        <Sparkles size={30} strokeWidth={1.5} className="text-brass-300" />
      </button>
    </div>
  );
}

export default function BottomBar({ activeTab, setActiveTab, onScrollTop, onOpenConcierge }) {
  return (
    <div className="grid grid-cols-5 max-w-lg mx-auto py-1 items-center">
      <MobileNavItem id="wardrobe" icon={LayoutGrid} label="Wardrobe" activeTab={activeTab} setTab={setActiveTab} onScrollTop={onScrollTop} />
      <MobileNavItem id="outfits" icon={Camera} label="Studio" activeTab={activeTab} setTab={setActiveTab} onScrollTop={onScrollTop} />
      <MobileFAB onTap={onOpenConcierge} onLongPress={onOpenConcierge} />
      <MobileNavItem id="calendar" icon={Calendar} label="Calendar" activeTab={activeTab} setTab={setActiveTab} onScrollTop={onScrollTop} />
      <MobileNavItem id="lookbook" icon={BookOpen} label="Lookbook" activeTab={activeTab} setTab={setActiveTab} onScrollTop={onScrollTop} />
    </div>
  );
}
