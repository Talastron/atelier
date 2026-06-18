// packages/design-tokens/tokens.js
// Same values as the CSS custom properties, exposed for cases where tokens
// must be referenced in JS/JSX (e.g. SVG `fill` attributes computed in code).

export const colors = {
  cream: '#F7F5F2',
  ink: '#1c1917',
  brass: {
    200: '#E2C896',
    300: '#D4B378',
    600: '#A8884C',
  },
  stone: {
    50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1',
    400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c',
    800: '#292524', 900: '#1c1917',
  },
  emerald: { 700: '#047857' },
};

export const fonts = {
  display: "'Playfair Display', 'Times New Roman', Georgia, serif",
  sans: "'Jost', 'Helvetica Neue', Arial, sans-serif",
};
