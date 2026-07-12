import React from 'react';

// "What the Concierge saw" — a small transparency panel explaining the inputs
// behind an AI suggestion (item count, weather, style profile, temperature).
// Shared by the Daily Brief card and the Styling Studio.
export default function WhyThisPanel({ weather, season, styleProfile, temperature, itemCount, onEditPreferences }) {
  const tempLabel = temperature <= 0.4 ? 'Safe' : temperature >= 0.9 ? 'Surprise' : 'Balanced';
  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
      <p className="mb-2 text-xs uppercase tracking-widest text-stone-500">What the Concierge saw</p>
      <ul className="space-y-1">
        <li>· {itemCount} owned, in-wardrobe pieces</li>
        {weather && (
          <li>· {weather.temp != null ? `${Math.round(weather.temp)}°C` : 'no forecast'} · {season}</li>
        )}
        {styleProfile?.styleFormality && <li>· Formality: {styleProfile.styleFormality}</li>}
        {styleProfile?.stylePalette && <li>· Palette: {styleProfile.stylePalette}</li>}
        <li>· Temperature: {tempLabel}</li>
      </ul>
      <p className="mt-2 text-xs italic text-stone-500">
        Composed from your closet. Your data stays with you.
      </p>
      {onEditPreferences && (
        <button
          type="button"
          onClick={onEditPreferences}
          className="mt-3 text-[10px] tracking-widest uppercase text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 underline-offset-4 hover:underline"
        >
          Update preferences →
        </button>
      )}
    </div>
  );
}
