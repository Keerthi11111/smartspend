/**
 * FILE: postcss.config.mjs
 * ROUTE: n/a (config)
 *
 * WHAT IT DOES: Sets up PostCSS, the tool that processes our CSS during the build.
 * WHERE IT FITS: Next.js uses it automatically when it compiles app/globals.css.
 * WHY THIS CODE: Tailwind CSS 4 runs as a PostCSS plugin. It reads the
 * `@import "tailwindcss"` in globals.css and creates only the utility classes
 * (bg-slate-900, p-4, ...) that our components actually use.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
const config = {
  plugins: {
    // Tailwind CSS v4 plugin (no tailwind.config.js needed; settings live in globals.css).
    "@tailwindcss/postcss": {},
  },
};

export default config;
