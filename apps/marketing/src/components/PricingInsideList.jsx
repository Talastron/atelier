import React from 'react';

/**
 * The "Behind the keys" list on /pricing — six short rows that name what
 * membership unlocks. Composed as a printed table-of-contents: each item
 * carries a Roman numeral set in display serif italic, the title baseline-
 * aligned with the numeral, and a single sentence beneath. Brass hairlines
 * separate rows so the list reads as part of the same editorial grammar
 * as the rest of /pricing rather than a SaaS feature-icon block.
 *
 * Order mirrors the studio sidebar — Concierge first as the headline
 * feature, then the spaces you'll live in, then the quieter background
 * tools (Insights, Manifesto).
 *
 * Lives in React rather than Astro frontmatter as a leftover from when
 * the list used dynamically-destructured Lucide icons (Astro's static
 * analyser couldn't resolve them inside a .map(...) loop). The icons are
 * gone now; the component stays in React for symmetry with siblings.
 */
const INSIDE = [
  {
    title: 'The Concierge',
    line: 'A private stylist who knows everything in your wardrobe and how you have worn it.',
  },
  {
    title: 'The Wardrobe',
    line: 'Every piece accounted for: brand, colour, material, cost, and the days you wore it.',
  },
  {
    title: 'Suggest a Look',
    line: 'One tap and the Concierge composes a head-to-toe outfit from your wardrobe, with the reasoning attached.',
  },
  {
    title: 'The Lookbook',
    line: 'Editorial outfits saved and revisited. A private archive of how you dress.',
  },
  {
    title: 'Packing Capsules',
    line: 'A destination and a forecast become a capsule pulled from your closet. Built in seconds.',
  },
  {
    title: 'Insights & Manifesto',
    line: 'True cost per wear. The gaps in your collection. A private brief of your aesthetic, refreshed at your pace.',
  },
];

// Roman numerals, with the trailing period that signals chapter-mark
// rather than digital ordered-list. Magazines punctuate; UIs strip it.
const ROMAN = ['I.', 'II.', 'III.', 'IV.', 'V.', 'VI.'];

// Brass hairline — matches the inner border-rule on the pricing cards
// (rgba(212, 179, 120, 0.22)), so the list reads as part of the same
// printed series rather than a stone-grey utility table.
const HAIRLINE = '1px solid rgba(212, 179, 120, 0.22)';

export function PricingInsideList() {
  return (
    <ul
      className="mx-auto grid grid-cols-1 md:grid-cols-2"
      style={{ maxWidth: 880, gap: 0 }}
    >
      {INSIDE.map(({ title, line }, i) => {
        // Last two items on desktop need a bottom rule too so the list
        // closes cleanly. On mobile the single-column rules handle it.
        const isLastTwoOnDesktop = i >= INSIDE.length - 2;
        return (
          <li
            key={title}
            className="flex items-baseline gap-5 py-6"
            style={{
              borderTop: HAIRLINE,
              borderBottom: isLastTwoOnDesktop ? HAIRLINE : 'none',
            }}
          >
            {/* Roman numeral — display serif italic, brass, fixed width so
                every title aligns on the same x-axis. The :is selector on
                width keeps Concierge ('I.') and Insights ('VI.') in column. */}
            <span
              className="flex-shrink-0 text-right"
              style={{
                width: 32,
                fontFamily: 'var(--atelier-font-display)',
                fontStyle: 'italic',
                fontSize: '1.0625rem',
                color: 'var(--atelier-brass-text)',
                letterSpacing: '0.02em',
                fontWeight: 400,
              }}
            >
              {ROMAN[i]}
            </span>
            <div className="min-w-0">
              <h3
                className="mb-1"
                style={{
                  fontFamily: 'var(--atelier-font-display)',
                  fontSize: '1.0625rem',
                  color: 'var(--atelier-stone-900)',
                  letterSpacing: '-0.005em',
                  lineHeight: 1.2,
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  color: 'var(--atelier-stone-600)',
                }}
              >
                {line}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
