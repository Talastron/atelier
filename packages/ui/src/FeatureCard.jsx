import React from 'react';

export function FeatureCard({ icon, title, description }) {
  return (
    <div
      className="bg-white border border-stone-200/60 p-8 rounded-[2rem] hover:-translate-y-1 transition-all duration-300 group"
      style={{ boxShadow: 'var(--atelier-shadow-smooth)' }}
    >
      <div className="w-14 h-14 bg-stone-50 border border-stone-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3
        className="text-2xl text-stone-900 mb-3"
        style={{ fontFamily: 'var(--atelier-font-display)' }}
      >
        {title}
      </h3>
      <p
        className="text-stone-500 text-sm"
        style={{ lineHeight: 'var(--atelier-leading-body)' }}
      >
        {description}
      </p>
    </div>
  );
}
