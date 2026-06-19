import React from 'react';

/**
 * DeviceFrame — a brand-tuned browser-window chrome around any child.
 *
 * What we take from shots.so:
 *   - The device sits on its own coloured backdrop (not the page background),
 *     which gives the screenshot the dignity of a framed object rather than
 *     a screenshot pasted into a page.
 *   - A soft, far-thrown shadow under the device, warmer than the default
 *     gray drop-shadow, so the device reads as warm-lit rather than studio-flat.
 *
 * What we don't take from shots.so:
 *   - The 3D perspective tilts and "floating tab" looks. Luxury brands sit flat.
 *   - The default rainbow gradients. We use a quiet cream-to-warm-stone wash.
 *   - The generic browser chrome. Ours has a small brass dot before the URL
 *     so it reads as "Atelier" not "any SaaS landing page."
 */
export function DeviceFrame({ url = 'edit.myatelier.style', caption, children }) {
  return (
    <div
      className="relative"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, #efeae3 0%, var(--atelier-cream) 55%, #ece7df 100%)',
        padding: 'clamp(2rem, 5vw, 4.5rem) clamp(1rem, 3vw, 3rem) clamp(2.5rem, 5vw, 4rem)',
        borderRadius: 'clamp(1rem, 1.5vw, 1.75rem)',
        overflow: 'hidden',
      }}
    >
      {/* Faint decorative brass arc, top-right */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: '-40%',
          right: '-20%',
          width: '60%',
          height: '120%',
          background:
            'radial-gradient(circle, rgba(212, 179, 120, 0.10) 0%, transparent 60%)',
        }}
      />

      {/* The device itself */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'var(--atelier-stone-100)',
          boxShadow:
            '0 60px 140px -30px rgba(40, 28, 12, 0.22), 0 22px 60px -20px rgba(28, 25, 23, 0.14), 0 1px 0 rgba(255, 255, 255, 0.5) inset',
          border: '1px solid var(--atelier-stone-200)',
          borderRadius: 'clamp(0.625rem, 1vw, 1rem)',
          maxWidth: '1280px',
          marginInline: 'auto',
        }}
      >
        {/* Browser chrome */}
        <div
          className="flex items-center gap-4 px-4 py-3"
          style={{
            background: 'var(--atelier-stone-50)',
            borderBottom: '1px solid var(--atelier-stone-200)',
          }}
        >
          {/* Traffic lights */}
          <div className="flex gap-2 shrink-0">
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
          </div>

          {/* URL pill */}
          <div className="flex-1 flex justify-center">
            <div
              className="px-4 py-1 rounded-full text-[11px] flex items-center gap-2"
              style={{
                background: '#ffffff',
                border: '1px solid var(--atelier-stone-200)',
                minWidth: '280px',
                maxWidth: '420px',
                color: 'var(--atelier-stone-500)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--atelier-brass-300)',
                  flexShrink: 0,
                }}
              />
              <span className="font-medium tracking-wide truncate">{url}</span>
            </div>
          </div>

          {/* Right-side spacer for visual balance */}
          <div style={{ width: '52px' }} className="shrink-0" />
        </div>

        {/* Content area — where the app shell renders */}
        <div style={{ background: 'var(--atelier-cream)' }}>{children}</div>
      </div>

      {/* Caption row below the device — brass-rule + small label */}
      {caption !== false && (
        <div
          className="relative flex items-center justify-center gap-3"
          style={{ marginTop: 'clamp(1.5rem, 2.5vw, 2.25rem)' }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '24px',
              height: '1.5px',
              background: 'var(--atelier-brass-300)',
            }}
          />
          <p
            className="text-[10px] uppercase font-medium"
            style={{
              letterSpacing: '0.28em',
              color: 'var(--atelier-stone-500)',
            }}
          >
            {caption || 'The Studio — live'}
          </p>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '24px',
              height: '1.5px',
              background: 'var(--atelier-brass-300)',
            }}
          />
        </div>
      )}
    </div>
  );
}
