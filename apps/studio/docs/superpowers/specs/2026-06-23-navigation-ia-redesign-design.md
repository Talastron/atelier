# Atelier — Navigation / IA Redesign + Incremental Modularization

**Date:** 2026-06-23
**Status:** Design approved (brainstorming complete); ready to decompose into implementation plans.
**Author:** Sibylle + Claude (brainstorming session)

---

## 1. Problem

Two compounding problems:

1. **The navigation is a rabbit warren.** The Calendar — strategically central now that Google Calendar feeds the Concierge — is buried three levels deep:
   `Sidebar "Lookbook" → OutfitBuilder(mode=lookbook) → tab "Diary" → DiaryView → sub-tab "Calendar" → WearCalendar`.
   "Lookbook" is overloaded, doing quadruple duty: saved outfits **and** a wear journal **and** a calendar planner **and** trips. Wayfinding is poor — fatal for a luxury product where it should feel effortless.

2. **`src/App.jsx` is a 21,167-line single file.** It is the direct cause of the recurring white-screen bug class (a single un-imported identifier takes down the whole app), it's hard to hold in context, and it makes every change riskier than it should be. The redesign is the right moment to start splitting it — incrementally.

## 2. Strategy (the "why" that drives the IA)

The hero of the navigation is a *positioning* decision, not a layout preference. Atelier's moat is three compounding layers — and most wardrobe apps stop at layer 1:

1. **Your context** (the data moat): wardrobe + wear history + body + taste + **calendar**. Proprietary, compounding, hard to recreate → switching cost.
2. **Taste-grade intelligence**: the Concierge reasoning over that context with a couturier's voice.
3. **The daily outcome** (what customers pay for): *dressed for your actual life, effortlessly.*

"Planning vs styling" is a false choice — the product is their **fusion**: *"Here's what to wear Thursday for your Board Presentation, from your own wardrobe, because I know your schedule and your taste."* The Google Calendar integration shipped earlier today is the bridge that fuses them.

**Decision:** the app's centre of gravity is a daily **"Today"** home that fuses planning + styling. Wardrobe is the inventory; Studio is the styling engine; Calendar is the time/context surface; Lookbook/Insights are supporting archives/reflection.

## 3. Target information architecture (Approach A — "Today + 4 pillars")

**Primary pillars (desktop sidebar, in order):** Today · Wardrobe · Studio · Calendar · Lookbook
**Secondary tier (quieter — below a divider on desktop; behind the avatar/menu on mobile):** Inspiration · Insights · Directory · Profile
**Signature element:** **Concierge** — pinned, prominent. Center FAB on mobile; pinned sidebar entry on desktop. Present everywhere.

**Mobile bottom bar (5 slots):** Today · Wardrobe · ◆Concierge (center) · Calendar · Lookbook.
- **Studio is not in the mobile bar** — styling is a deliberate creative session, entered contextually ("Style a look" from Today; "Style around this" from a wardrobe item). It keeps its desktop sidebar slot.
- Quick "+add item" moves into Wardrobe (where adding items belongs), freeing the center slot for the Concierge — the differentiator deserves the most valuable real estate.

**Net effect:** Calendar goes from 3 clicks to 1 (top-level pillar). Diary and Trips cease to be separate destinations (folded into Calendar — see §4.2).

## 4. The surfaces

### 4.1 Today (the hero) — NEW
Promotes content currently scattered on the Wardrobe landing into one focused daily surface, enriched with the calendar. Top to bottom:
1. **Editorial greeting** — "Good evening, {firstName}" + today's weather.
2. **The Daily Brief** (centrepiece) — today's composed look; reasoning references the schedule ("for your date night this evening…"); item thumbnails; *Wear this · Compose another · Save*. (Reuses the existing `DailyBriefCard`; today-only calendar context, as built.)
3. **Your week** — a 7-day strip; each day flags events / a planned look; tapping a day → Calendar on that date. Today's events read inline.
4. **Ask your stylist** — a Concierge prompt card seeded with a smart suggestion derived from the calendar (e.g. "What should I wear Thursday?" when a Board Presentation is detected).

Consequence: Daily Brief + weather **move off** the Wardrobe landing → Wardrobe becomes purely the inventory.

### 4.2 Calendar (unified time surface) — PROMOTED + MERGED
One pillar owns the entire time axis. Dissolves the Diary/Journal/Trips tangle.
- **Month grid is the backbone, centred on today** — past to the left/up, future to the right/down. One timeline.
- **Each day carries its own truth:** past days show what was **worn** (the diary, rendered on the grid); today is highlighted; future days show the **planned look** + **calendar event** markers.
- **Selected-day panel** (existing in `WearCalendar`) adapts: future → events + planned look; past → what was actually worn.
- **Trips are ranges on the timeline** — a highlighted band across the trip's days with its eyebrow; planning = select a range → "Plan this trip" (existing range mode + `TravelPlannerModal` + `PackingListModal`). An "Upcoming trips" shortcut sits at the top of Calendar rather than as a buried tab.
- **One optional lens toggle — Month ↔ Feed** — the scrolling journal feed survives as a top-level lens on the same data, replacing the old three-levels-deep Journal/Calendar sub-toggle.

### 4.3 Lookbook (archive) — SLIMMED
Pure curated archive: **saved looks + collections** only. No Diary, no Trips, no Calendar. The existing saved-outfits grid + collections become the whole of Lookbook.

### 4.4 Wardrobe & Studio — LARGELY UNCHANGED
- **Wardrobe**: the inventory of pieces (gains the "+add item" entry; loses the Daily Brief/weather that move to Today).
- **Studio**: the create/style surface (manual + AI). Desktop pillar; mobile contextual entry.

### 4.5 Where displaced things go (summary)
| Was | Now |
|---|---|
| Diary tab (under Lookbook) | The **past** of the Calendar grid + the Calendar's "Feed" lens |
| Journal/Calendar sub-toggle | The Calendar's single Month/Feed lens (top-level) |
| Trips tab (under Lookbook) | **Ranges** on the Calendar timeline + "Upcoming trips" shortcut |
| Daily Brief + weather (on Wardrobe landing) | The **Today** home |
| Inspiration / Insights / Directory / Profile | Secondary tier |

## 5. Module structure (first-class goal: split the monolith)

Modularization is a **first-class goal**, executed **incrementally** — each redesign effort extracts the views it touches into clean files. No big-bang rewrite. Extraction forces clean prop interfaces (the "design for isolation" principle), which improves the architecture as a side effect.

**Target layout (established as views are moved):**
```
src/
  App.jsx                 # shrinks to: providers, auth gate, top-level state, nav shell wiring
  nav/
    Sidebar.jsx           # desktop primary + secondary + Concierge/profile
    BottomBar.jsx         # mobile 4 pillars + Concierge FAB
  views/
    Today.jsx             # the hero home
    Wardrobe.jsx          # inventory (extracted from WardrobeView)
    Studio.jsx            # create/style (extracted from OutfitBuilder mode=studio)
    Calendar.jsx          # unified time surface (WearCalendar + DiaryView merged)
    Lookbook.jsx          # slimmed archive (saved + collections)
    Insights.jsx, Inspiration.jsx, Directory.jsx, Profile.jsx  # as touched
  components/
    DailyBriefCard.jsx, WeekStrip.jsx, ConciergePrompt.jsx, ...  # shared pieces as extracted
```
Shared helpers (e.g. `todayISO`, item accessors), context (`useToast`), and the central state in `DigitalWardrobe` are passed as props / imported from small modules. Only views we touch are extracted; the leftover tail (small modals) is picked off opportunistically later.

## 6. Build sequence (4 efforts — each its own spec→plan→implement→verify cycle)

Each effort is independently shippable and deploys via the proven flow (build green → review → deploy hosting → verify on edit.myatelier.style).

1. **Effort 1 — Nav shell + routing (delivers ~80% of the user-visible win).**
   Introduce the new top-level structure: add the **Today** route, **promote Calendar to a top-level pillar** (lift `WearCalendar` out from under `OutfitBuilder → DiaryView`), slim Lookbook to saved+collections, restructure sidebar + bottom bar (+ Concierge FAB), move "+add" into Wardrobe. Mostly *moving* existing components + rewiring `activeTab`. Extract `nav/Sidebar.jsx`, `nav/BottomBar.jsx`, and the moved views into `src/views/`.
   *Kills the rabbit warren on its own.*

2. **Effort 2 — The Today home.**
   Build `views/Today.jsx`: promote Daily Brief + weather off the Wardrobe landing; add the `WeekStrip` + `ConciergePrompt`. Depends on Effort 1 routing.

3. **Effort 3 — Unify the Calendar surface.**
   Merge past-worn + planned + events onto the grid; add the Month/Feed lens; fold Trips in as ranges; retire the old Journal/Calendar sub-toggle and the Lookbook Diary/Trips tabs. The richest effort.

4. **Effort 4 — (woven through 1–3) targeted modularization.**
   As each view moves, extract it into its own file per §5. Not a separate big-bang pass.

## 7. Risks & constraints

- **White-screen bug class (memory: `reference-react-hooks-convention`).** Every identifier referenced must be imported; every hook in the line-1 React import. Extraction multiplies import surface — each extracted file must be import-audited; build must pass; deploy + live-verify each effort. Use subagent-driven-development with two-stage review per effort.
- **Gemini config (memory: `reference_gemini_25_flash_config`).** `thinkingConfig` inside `generationConfig`. Not directly touched here, but Today/Calendar reuse the Gemini wrappers — don't alter config.
- **Mobile bottom-bar constraint** — 5 slots; resolved by Concierge-as-FAB + Studio contextual.
- **Auth/App Check domain binding** — the app is bound to `edit.myatelier.style` (hardcoded `authDomain`; reCAPTCHA domains). Live testing happens on production, not preview channels (see calendar-feature learnings).
- **Don't regress the calendar feature** — the just-shipped Google Calendar integration (events on the day view, rolling-week Concierge) must keep working through the Calendar unification.

## 8. Out of scope / deferred
- Visual restyle of individual components beyond what the IA requires (this is structure/navigation, not a skin).
- Microsoft/Apple calendar, multi-calendar selection, write-back (separate calendar plans).
- OAuth app verification (separate workstream, already tracked).
- Full extraction of every modal from `App.jsx` (only touched views are extracted; tail is opportunistic).

## 9. Definition of done (overall)
1. Five primary pillars present; Calendar reachable in **one** click from anywhere.
2. A **Today** home is the default landing, carrying the Daily Brief, week strip, and Concierge prompt.
3. Calendar is one surface: past-worn + today + planned + events + trips; Month/Feed lens; no Journal/Calendar sub-toggle.
4. Lookbook contains only saved looks + collections.
5. Concierge is the mobile center FAB and a pinned desktop entry.
6. The touched views live in `src/views/` / `src/nav/` / `src/components/`, not inside `App.jsx`.
7. The Google Calendar feature still works end-to-end.
8. Each effort shipped green-built and live-verified; no white-screen regressions.
