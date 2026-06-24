import React from 'react';

// Labelled text input — small-caps label above a warm-bordered field.
// The standard form control across modals and settings.
export default function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">{label}</label>
      <input className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors" {...props} />
    </div>
  );
}
