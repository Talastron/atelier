// apps/marketing/src/components/Features.jsx
import React from 'react';
import { Sparkles, Wand2, Calendar, BarChart3, Bookmark, Lock } from 'lucide-react';
import { EditorialHeader, FeatureCard } from '@atelier/ui';

const FEATURES = [
  {
    icon: <Sparkles size={24} className="text-brass-600" />,
    title: 'Identify with AI',
    description:
      'Snap a single photo. Our vision artificial intelligence automatically categorises the brand, colours, and materials instantly.',
  },
  {
    icon: <Wand2 size={24} className="text-stone-700" />,
    title: 'Editorial Styling',
    description:
      'Drag and drop your pieces onto a clean canvas to compose layered outfits. Ask Gemini to suggest looks based on the daily weather forecast.',
  },
  {
    icon: <Calendar size={24} className="text-stone-700" />,
    title: 'Travel Planning',
    description:
      'Type any destination in the world. Atelier fetches the forecast and packs a dedicated capsule collection from your existing wardrobe.',
  },
  {
    icon: <BarChart3 size={24} className="text-emerald-700" />,
    title: 'Investment Insights',
    description:
      'Track your true cost per wear. Spot the gaps in your collection and see exactly which pieces deliver the highest value.',
  },
  {
    icon: <Bookmark size={24} className="text-stone-700" />,
    title: 'Style Manifesto',
    description:
      'Atelier analyses your most worn pieces and saved inspirations to write a private three paragraph brief of your true aesthetic.',
  },
  {
    icon: <Lock size={24} className="text-stone-700" />,
    title: 'Private by Design',
    description:
      'Your collection is entirely your own. Share specific looks with friends using read only links while keeping your data perfectly secure.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      style={{
        paddingBlock: 'var(--atelier-section-padding-y)',
        paddingInline: 'var(--atelier-page-padding)',
      }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: 'var(--atelier-container-max)' }}
      >
        <EditorialHeader
          eyebrow="The Toolkit"
          title="Master your aesthetic."
          subtitle="Built for professionals who treat their wardrobe as an investment portfolio."
          align="center"
          className="mb-16"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </div>
    </section>
  );
}
