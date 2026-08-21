# Atelier — Instagram Playbook

_Last updated: 2026-07-14_
_Companion to [atelier-gtm-strategy.md](./atelier-gtm-strategy.md). Instagram is a **visual-first showroom** — judged on the grid at a glance. Seed it before sharing the handle anywhere; an empty grid undoes the quiet-luxury positioning._

---

## Account setup

Do this on **desktop at instagram.com** (upload the profile pic + tiles straight from the repo).

1. **Sign up** with a brand-appropriate email.
2. **Handle** (first that's free): `myatelier.style` → `my.atelier` → `myatelier` → `atelier.edit`. Grab the same on TikTok + Pinterest even if unused (name-squatting insurance).
3. **Switch to a Business account** (Settings → Account type → Business — unlocks Meta Business Suite scheduling + insights). Link a Facebook Page later for free scheduling.
4. **Profile photo:** `apps/marketing/public/brand/icon-512.png` (same brass mark as LinkedIn — cross-channel recognition).
5. **Name field** (bold, searchable, 30 char): `Atelier · Personal Style`
6. **Bio** (150 char):
   > An archive of everything you own.
   > An AI that reads your taste.
   > Quiet luxury for your wardrobe ↓
7. **Link:** `myatelier.style` (add the Journal as a second link later).
8. **Category:** `Software` or `Product/Service`.

---

## The three surfaces (each a different job)

| Surface | Job | Content |
|---|---|---|
| **Reels** | Reach (the only part shown to non-followers) | Style DNA reveals, "AI wrote my style manifesto," wardrobe tours, build-in-public |
| **Grid/feed** | Credibility (the showroom people scroll before trusting you) | The cohesive editorial tiles, still lifes, quote-graphics |
| **Stories** | Intimacy/retention (for existing followers) | Behind-the-build, daily concierge brief, reader Style DNA reshares, polls |

Most content is **repurposed**, not net-new: a short-form video → a Reel; a Style DNA card → a grid post + a Story; a Journal essay → a carousel. Pull from the [30-day content calendar](./content-calendar-30-day.md).

---

## The starter grid (built 2026-07-14)

9 cohesive tiles (1080×1350) live in `apps/marketing/public/brand/instagram/` (PNG + editable SVG). Preview: `_grid-preview.png`. Ink tiles (01/05/09) fall on a diagonal so the grid reads as one object.

**Regenerate/edit:** the tiles are generated from brand tokens + verbatim Journal quotes. All display serif is **true Playfair Display**, rendered from `apps/studio/scripts/assets/PlayfairDisplay-Medium.ttf` via opentype.js → vector paths (librsvg ignores `@font-face`, so text is baked to paths). Note: opentype's compact `toPathData()` emits number tokens librsvg mis-parses and drops glyphs — the generator serializes paths with every number space-separated + 2dp to avoid this. Only Playfair *Medium* is available locally, so there are no italics (roman throughout).

**Posting order — post `09 → 08 → … → 01`** so the cover (01) lands top-left and the grid displays in numeric reading order. Seed **6–9 before sharing the handle**. At ~0 followers you can post across a day or two without flooding anyone.

### Captions (Instagram captions aren't clickable → CTA = "link in bio")

- **01 Cover:** Atelier. Quiet luxury for your wardrobe — an archive of everything you own, and an AI that reads your taste back to you. Glad you're here. 🕯️ · `#QuietLuxury #PersonalStyle`
- **02 On Colour:** Lay every garment on the floor and the wardrobe confesses: it is three colours, maybe four. The palette is involuntary — it tells the truth before the mirror does. From the Atelier Journal. · `#QuietLuxury #PersonalStyle`
- **03 The Palette:** Cream, stone, brass, ink, a little claret. The Atelier palette — the colours we dress the app in, and quietly, the ones most of us already live in. · `#QuietLuxury #ConsideredWardrobe`
- **04 On Value:** Cost-per-wear isn't really about money. It's about attention. The expensive thing you wear constantly grows cheaper every Tuesday; the bargain worn once grows dear. · `#CostPerWear #QuietLuxury`
- **05 Your Style DNA:** Add the pieces you already own and Atelier reads your taste back to you — your colours, your palette, your Style DNA. It's oddly moving to see. · `#PersonalStyle #QuietLuxury`
- **06 On Self-Knowledge:** A wardrobe is the most honest document we keep — written involuntarily, dated by purchase, edited only by attrition. The closest thing most of us have to a private autobiography. · `#QuietLuxury #PersonalStyle`
- **07 Cost Per Wear:** A £300 coat worn 200 times has cost you £1.50 a wearing. The number is a small, honest reckoning of whether you chose well. · `#CostPerWear #ConsideredWardrobe`
- **08 On Intention:** A wardrobe is meant to be a small library — walked past each morning with some idea of what sits on its shelves. Most are a warehouse. The difference is intention. · `#QuietLuxury #CapsuleWardrobe`
- **09 Invitation:** See your own Style DNA. A 14-day free trial is live — add a few favourite pieces and meet your wardrobe properly. Link in bio. 🕯️ · `#QuietLuxury #PersonalStyle`

---

## Rules

- **2–3 hashtags per post, not 10** — LinkedIn-style restraint; a wall of tags reads as spam and suppresses reach.
- **Desire first, conversion last** — tiles are the hook, captions the depth; only tile 09 mentions the trial. If every post sells, none seduce.
- **Automate production, not connection** — schedule assets via Meta Business Suite/Later; keep DMs, comments, follows **manual** (bots get throttled and kill a founder-led taste brand).
- **Seed the grid before promoting the handle** — then add it to the LinkedIn profile + site.
