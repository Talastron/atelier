# The Concierge Reel — homepage hero

_Design spec · 2026-07-14 · branch `feat/homepage-concierge-reel-hero`_

## Summary

Replace the homepage hero (the Suggest-a-Look `StudioFrame`) with a live
Concierge conversation. A chat bar types a question; the answer composes onto
a foreground card in a **three-card depth carousel** that shuffles: the right
card moves in and zooms up to centre, the centre card moves left and zooms
down into the background. Four real interactions cycle. Inspired by
ActiveCampaign's product-forward hero, but at a measured, luxurious pace.

Validated through ten in-browser motion iterations (v1–v10) with the user.

## Placement

- **Becomes the hero** (top of `index.astro`), replacing `Hero` / `StudioFrame`.
- Because it demonstrates the Concierge, outfit-building, packing and
  cost-per-wear, it lets us **retire three now-redundant sections**:
  `ConciergeDemo`, `SuggestALookDemo`, `TravelCapsuleDemo`.
- **Kept:** What Atelier does · Filling the wardrobe (WaysIn) · Inside Atelier ·
  Annual Report (InvestmentLens) · Share a look · Journal · Founder · FAQ · CTA.

## Hero composition (one viewport, top → bottom)

1. Masthead eyebrow — "The Atelier Studio · MMXXVI".
2. H1 — "Ask. It answers from _your_ closet." (display serif).
3. Kicker/subhead — a plain-language purpose line kept for SEO / Google-OAuth
   review ("An AI stylist that styles you from the clothes you already own").
4. **Chat bar** — Concierge avatar, the typing question + cursor, send button.
5. **Depth carousel** — three equal cards; foreground = the answer.
6. CTAs — _Begin curating_ (→ /pricing) and _See the studio_ (→ /studio).

Card sizes are viewport-relative so the hero fits; content clips if a card
runs long. Cards use real `/wardrobe/*` photography via `@atelier/ui` `Pic`.

## The four interactions (real data)

| Q | Answer | Pieces (real images) |
|---|--------|----------------------|
| What should I wear today? | outfit (2×2) | gene-silk-…-champagne, gael-wool-blend-trousers, suedette-…-block-heel-sandals, fine-chain-necklace-… |
| Pack me for Tokyo, 5 days | capsule (3×2) | pippa-silk-…-colourblock-vest, belt-shirt-dress, gael-wool-blend-trousers, merisa-gold-…-sandals, hackness-jacket, robin-jumper |
| What have I worn least? | 3 rows + reasons | claire-pleat-detail-dress (2×, bought in haste), sequin-embellished-vest (1×, a gift), marina-single-breasted-blazer (3×, inherited) |
| What's my wardrobe costing? | 3 rows, cost/wear | gael-wool-blend-trousers (48 wears, £2.29), robin-jumper (36, £2.19), claire-pleat-detail-dress (3, £75) |

## Motion & timing (locked)

- Depth carousel: centre `scale 1` (z-front), sides `scale 0.80` (set back,
  sharp, symmetric, clear gap — no overlap), off/recycle card parked
  off-frame and clipped by a bounded stage (never fades, never peeks).
- Recycle: the wrapping card snaps to the off-frame side (transition off,
  clipped) then glides in — no fade.
- Transition ≈ 1.15s `cubic-bezier(0.22,1,0.36,1)`; hold ≈ 7s; auto-advance.
- Chat: question types ~40ms/char with a blinking cursor.
- Compose reveal: staggered settle of the focus card's answer (~0.6s eased,
  ~0.14s stagger) — see open refinement.
- Controls: hover-to-pause; clickable dots (also keyboard-focusable tabs).

## Open refinement (finalise live in dev)

The compose-on-focus currently starts the focus card empty, but that card was
already populated while waiting on the right — an inconsistency. Options to
try in-browser: (a) a skeleton/ghost state on the side cards that fills crisply
at centre; (b) compose only on first entry from off-frame; (c) drop per-piece
compose, keep a subtle whole-card settle. **Initial build ships (c)** (content
always visible, gentle settle) as the safe non-broken default; we tune from
there.

## Accessibility & performance

- `prefers-reduced-motion`: no auto-cycle, no typewriter, no compose; renders
  the first answer statically; dots remain operable to switch answers. (Matches
  the AA contrast pass already shipped.)
- Pause when the tab is hidden (`visibilitychange`) — battery.
- Keyboard: dots are real buttons; arrow-key support between them.
- Preload the outfit images.
- All new text (chat, captions, reply) meets WCAG AA on its ground.

## Files

- `apps/marketing/src/components/landing/ConciergeReel.jsx` — new island.
- `apps/marketing/src/styles/global.css` — `.cr-*` classes + keyframes
  (in the main linked stylesheet, per the delivery lesson from the FAQ fix).
- `apps/marketing/src/pages/index.astro` — swap hero; remove three sections.

## Verification

Build passes (23 pages); desktop + mobile widths; reduced-motion path;
computed-style contrast check on new text; visual sign-off in the dev server.
