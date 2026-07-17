# About page — founder profile copy revision

**Date:** 2026-07-17
**Scope:** `apps/marketing/src/pages/about.astro`, "The Maker" section (¶1 and ¶2 of the prose column) only.

## Problem

The founder bio's opening paragraph contained inaccuracies and claims Sibylle does not want public:

- "Technology has been my work for twenty years" — year count inaccurate.
- "By trade I'm a project and product manager" — she has not been building products for long; her trade is data and AI.
- "Most recently I was Head of Data and Systems" — reads as a past role; naming an employer-shaped title publicly is unwanted.
- "in 2024 I founded Talastron, my own AI consultancy" — Talastron is co-founded; "my own" overstates.
- "Microsoft platforms … are what I know" — vendor name off-register for the page.

## Decision

Rewrite ¶1 in the understated, no-titles register (approved by Sibylle after several iterations):

> My day work is data. I am the person organisations bring in to make sense of what they know: the reporting, the systems behind it, and lately the question of what AI should be allowed to do with it all. It is careful, exacting work, and it turns out to be very good training for keeping a wardrobe.

Harmonise ¶2's opening contraction to match: "I've always loved" → "I have always loved".

## Constraints (standing, encoded in a code comment at the edit site)

- No job titles, no employers, no year counts, no vendor names in the founder bio.
- Never frame Atelier as her "first product" — undermines willingness to pay.
- Voice: fluid, unhurried, comma-and-colon phrasing; **no em dashes** in her first-person copy.
- Talastron's relationship to Atelier stays where it already lives: Footer, legal pages, Base.astro schema.

## Explicitly unchanged

¶3 (packing-trip origin story) and ¶4 (barn, self-funded) — confirmed accurate. `FounderNote.astro` on the home page quotes only ¶3 and the barn line, so it needs no change.
