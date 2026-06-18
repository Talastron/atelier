// apps/marketing/src/config.ts
// Site-wide configuration. Used across pages and components.

export const SITE = {
  name: 'Atelier',
  url: 'https://myatelier.style',
  supportEmail: 'contact@myatelier.style',
} as const;

/** URL of the app (signed-in experience). All "Open Studio" / "Sign In" CTAs link here. */
export const EDIT_URL = 'https://edit.myatelier.style';
