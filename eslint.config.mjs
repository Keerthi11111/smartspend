/**
 * FILE: eslint.config.mjs
 * ROUTE: n/a (config)
 *
 * WHAT IT DOES: Sets up ESLint, which checks the code for mistakes and bad patterns.
 * WHERE IT FITS: Used by `npm run lint` and by editor plugins. It is not part of the app.
 * WHY THIS CODE: Uses ESLint's "flat config" format with Next.js's ready-made rule sets:
 * Core Web Vitals (React/Next best practices) and TypeScript rules. Build output
 * folders are ignored because they are generated files.
 *
 * See PROJECT_GUIDE.md for the full project flow.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // Next.js recommended rules + performance (Core Web Vitals) rules.
  ...nextVitals,
  // Extra rules for TypeScript files.
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
