/**
 * Tailwind v4 ships as a PostCSS plugin — no tailwind.config.js required.
 * Design tokens live in app/globals.css via the `@theme` directive instead.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
