# The Studio app types below its own floor

**Date:** 2026-09-04
**Status:** design agreed, not yet planned
**Related:** the text-size complaints that produced PR #83, which raised sizes on two
surfaces without asking why they were small everywhere

---

## The finding

### The type scale already exists, and the Studio was never plugged into it

`packages/design-tokens/type.css` defines a complete modular scale — base 16px, ratio
~1.25, every value in `rem`, floor `--atelier-text-xs: 0.75rem` (12px) — plus
`--atelier-tracking-eyebrow: 0.28em`, the letter-spacing the app's labels use inline.

The package ships a barrel, `index.css`, importing colours, type and space, commented
*"Apps consume this once in their global stylesheet."*

- `apps/marketing/src/styles/global.css` imports `@atelier/design-tokens/index.css` — the barrel.
- `apps/studio/src/index.css` imports `@atelier/design-tokens/colors.css` — **colours only**.

The marketing site has the type scale. The product does not. The Studio's own comment
claims marketing "consumes the same package the same way"; marketing consumes strictly
more.

### The result: 512 declarations below the system's own floor

| size | count |
|---|---|
| `text-[10px]` | 403 |
| `text-[11px]` | 64 |
| `text-[9px]` | 40 |
| `text-[8px]` | 5 |
| **total below 12px** | **512** |

Those 512 declarations occupy 505 lines. For scale: the app carries 601 arbitrary-px text
sizes in total and 888 Tailwind-scale classes (`text-sm`, `text-xs`…). Tailwind's scale is
rem-based and grows with the reader's browser text setting; the 601 are frozen. So raising
text size in the browser today moves 60% of the app's type and leaves 40% behind — a
half-scaling layout, which is often worse than none.

### The small type is one convention, hand-rolled

Of the 505 lines, **496 carry a tracking class** and **469 are uppercase**. Only **9** are
plain untracked content. This is not scattered carelessness; it is a single editorial
convention — the uppercase, letter-spaced eyebrow — reimplemented at every call site, two
pixels below the floor its own design system defines.

Every one of those sites also hardcodes its letter-spacing, so each is a partial copy of
`--atelier-tracking-eyebrow`: reimplementing half the token while violating the other half.

### Except it is eleven conventions, not one

| tracking | uses |
|---|---|
| `tracking-widest` (0.1em) | 215 |
| `tracking-wider` (0.05em) | 73 |
| `tracking-wide` (0.025em) | 66 |
| `tracking-[0.2em]` | 51 |
| `tracking-[0.28em]` | 45 |
| `tracking-[0.25em]` | 22 |
| `tracking-[0.3em]` | 7 |
| `tracking-[0.18em]` | 7 |
| `tracking-[0.22em]` | 6 |
| `tracking-[0.24em]` | 3 |
| `tracking-[0.14em]` | 1 |
| **total** | **496** |

`--atelier-tracking-eyebrow` describes 45 of 496 uses — 9%. The token did not capture the
convention; it captured one instance of it.

Sampling the bands shows they are not arbitrary. The widely-tracked band is section
headings ("Wear Log", "The Concierge's read", "Why this is on your wishlist", "Share this
look"). The 0.1em band is interactive labels — buttons, field labels, "Sign out". The
lightly-tracked band is helper text and quiet metadata. Three roles, drifted into eleven
values.

---

## Decisions

### 12px is the floor, and it is not a new number

Every declaration below 12px rises to 12px. This is not a taste applied to the app from
outside — it is `--atelier-text-xs`, already written down, already shipping on the
marketing site. The app stops contradicting its own design system.

Rejected: **11px**, a smaller step with roughly half the reflow. It reads better than 10px
and disrupts less, but it is not a value in the scale, so it would replace 512 bespoke
numbers with a 513th and leave the app still disagreeing with its tokens.

### `text-xs` is the migration target — no new utility

Tailwind's `text-xs` compiles to `0.75rem`: exactly `--atelier-text-xs`, exactly 12px,
rem-based, and already used 252 times in this app. Adopting it *is* adopting the token. A
bespoke `.eyebrow` class would be a second way to say the same thing, and would have to be
kept in sync with a scale that already exists.

The consequence worth naming: 512 sites that ignored the reader's browser text setting
begin to honour it.

### Eleven trackings become three, in this pass

| utility | value | absorbs | ~count | role |
|---|---|---|---|---|
| `tracking-meta` | 0.05em | `wide` (0.025), `wider` (0.05) | 139 | helper text, quiet metadata |
| `tracking-label` | 0.1em | `widest` (0.1), `[0.14em]` | 216 | buttons, field labels, controls |
| `tracking-eyebrow` | 0.28em | 0.18, 0.2, 0.22, 0.24, 0.25, 0.28, 0.3em | 141 | section headings |

139 + 216 + 141 = 496, which is every tracked line. The remaining 9 untracked lines get
`text-xs` and no tracking class.

`tracking-eyebrow` resolves to `var(--atelier-tracking-eyebrow)`, so the token becomes
load-bearing for 141 sites instead of decorative for 45.

Rejected: **change size only, leave tracking alone.** The conservative option, and it was
the initial recommendation — a pure legibility fix that alters no shapes. It was rejected
because it leaves eleven values in place and defers a decision that only gets harder as the
app grows. Rejected: **flatten everything to 0.28em.** Maximum consistency, but 0.28em on a
12px button label is very wide, and it would push several hundred interactive labels into
the truncation risk that currently touches 22 sites.

---

## Architecture

Three edits, then a mechanical migration.

### 1. `apps/studio/src/index.css` — consume the barrel

```css
@import '@atelier/design-tokens/index.css';
```

replacing the colours-only import. `colors.css`, `type.css` and `space.css` declare nothing
but `:root` custom properties — no element rules, no selectors — so this is purely
additive and renders nothing differently on its own. It makes the type and space tokens
available, and brings the Studio to parity with marketing.

The comment above that import, which wrongly states marketing consumes the package "the
same way", is corrected in the same edit.

### 2. `@theme` — register the three letter-spacings

```css
--tracking-meta:    0.05em;
--tracking-label:   0.1em;
--tracking-eyebrow: var(--atelier-tracking-eyebrow);
```

Tailwind 4 generates `tracking-*` utilities from this namespace, the same mechanism the
`--color-brass-*` tokens already use in this file. **This must be verified empirically
before the migration begins** — see Testing.

### 3. The call sites

Each migrated site reads:

```jsx
className="text-xs tracking-eyebrow uppercase text-stone-500"
```

Two classes replace two: the arbitrary size and the arbitrary tracking. Nothing else on the
element changes — not weight, not colour, not spacing.

---

## The exceptions, handled deliberately

**22 lines** combine a sub-12px size with `truncate` or `whitespace-nowrap`. A 12px label at
0.28em is roughly 20% wider than the same label at 10px, so these are where the change
bites. Each is inspected individually and fixed at the container, not by exempting the
label from the floor — an exemption would reintroduce the bespoke number this work removes.

**9 lines** carry no tracking. They take `text-xs` alone.

**The band-to-role mapping is an approximation.** It was derived from sampling, not from
classifying all 512 sites, and a handful will read wrong — a button that lands on
`tracking-eyebrow`, a section heading on `tracking-label`. These are found by eye at review
and corrected individually. The spec states this rather than pretending the mapping is
exact.

---

## Testing

No unit tests. These are views and CSS; no view in this codebase is tested, they need a DOM
and none is set up, and a test asserting a class string is present proves only that the
string was typed twice.

Verification is four things:

1. **The `@theme` assumption, first and separately.** Before migrating 512 sites, change one
   site and confirm in the browser that `tracking-eyebrow` computes to `0.28em`. If Tailwind 4
   does not generate utilities from `--tracking-*`, the whole architecture changes and it is
   far better to learn that at site one than at site 512.
2. **Build clean, 328 tests green.**
3. **Two mechanical greps:** zero `text-[Npx]` below 12px remain; zero bespoke
   `tracking-[…em]` remain in the migrated files.
4. **Sibylle's eye on the screen.** ~496 labels reflow at once; nothing else can tell us
   whether the result reads as the same product.

---

## Non-goals

- **Sizes already at or above 12px are untouched** — `text-[12px]`, `[13px]`, `[15px]`, and
  the whole Tailwind scale. This raises a floor; it does not restyle the app's typography.
- **No change to thumbnails, icons, the profile avatar, or tap targets.** Proportion was
  raised alongside text size and is a real problem, but it is a different pass with
  different risks.
- **No change to weight, colour, or the type scale itself.**
- **The marketing app is untouched.** It already consumes the barrel.
- **The 9 untracked content sites are not redesigned**, only resized.

---

## Risks

| Risk | Handling |
|---|---|
| Tailwind 4 may not generate utilities from `--tracking-*` | Verified on a single site before any migration; the architecture depends on it and it is unproven here |
| 22 sites truncate or clip at the wider size | Enumerated up front; each fixed at the container rather than exempted |
| The band-to-role mapping misfiles some sites | Stated as approximate; corrected individually at visual review |
| ~496 labels reflowing at once is a lot to judge | Reviewed on the branch, stacked above `brief-flatlay`, so the Daily Brief is seen once at final sizes rather than twice |
| Importing the barrel changes something unforeseen | All three token files contain only `:root` custom-property declarations; nothing consumes type or space tokens until step 2 |
