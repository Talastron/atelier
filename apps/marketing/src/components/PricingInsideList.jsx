import React from 'react';
import { MessageCircle, Shirt, Wand2, BookOpen, Layers, BarChart3 } from 'lucide-react';

/**
 * The "Behind the keys" list on /pricing — six short rows that name what
 * membership unlocks. Lives in React rather than Astro frontmatter because
 * Astro's static analyser can't resolve dynamically-destructured icon
 * components inside a {INSIDE.map(...)} loop (it only sees the direct
 * imports). Solving it once here keeps the icons declarative in the data.
 *
 * Order mirrors the studio sidebar — Concierge first as the headline
 * feature, then the spaces you'll live in, then the quieter background
 * tools (Insights, Manifesto).
 */
const INSIDE = [
  {
    icon: MessageCircle,
    title: 'The Concierge',
    line: 'A private stylist who has read every piece you own, every wear you logged, every look you saved.',
  },
  {
    icon: Shirt,
    title: 'The Wardrobe',
    line: 'Every piece accounted for. Brand, colour, material, cost, and every time you reached for it.',
  },
  {
    icon: Wand2,
    title: 'Suggest a Look',
    line: 'One tap and the Concierge composes a head-to-toe outfit from your wardrobe, with the reasoning attached.',
  },
  {
    icon: BookOpen,
    title: 'The Lookbook',
    line: 'Editorial outfits composed, saved, and revisited. A private archive of how you dress.',
  },
  {
    icon: Layers,
    title: 'Packing Capsules',
    line: 'A destination, a forecast, and a capsule pulled from your existing closet — built in seconds.',
  },
  {
    icon: BarChart3,
    title: 'Insights & Manifesto',
    line: 'True cost per wear, the gaps in your collection, and a private brief of your true aesthetic.',
  },
];

export function PricingInsideList() {
  return (
    <ul
      className="mx-auto grid grid-cols-1 md:grid-cols-2"
      style={{ maxWidth: 880, gap: 0 }}
    >
      {INSIDE.map(({ icon: Icon, title, line }, i) => {
        // Last two items on desktop need a bottom rule too so the list
        // closes cleanly. On mobile the single-column rules handle it.
        const isLastTwoOnDesktop = i >= INSIDE.length - 2;
        return (
          <li
            key={title}
            className="flex items-start gap-4 py-5"
            style={{
              borderTop: '1px solid var(--atelier-stone-200)',
              borderBottom: isLastTwoOnDesktop
                ? '1px solid var(--atelier-stone-200)'
                : 'none',
            }}
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(212, 179, 120, 0.08)',
                border: '1px solid rgba(212, 179, 120, 0.2)',
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.6}
                style={{ color: 'var(--atelier-brass-600)' }}
              />
            </span>
            <div className="min-w-0">
              <h3
                className="mb-1"
                style={{
                  fontFamily: 'var(--atelier-font-display)',
                  fontSize: '1.0625rem',
                  color: 'var(--atelier-stone-900)',
                  letterSpacing: '-0.005em',
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: '0.875rem',
                  lineHeight: 1.55,
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
