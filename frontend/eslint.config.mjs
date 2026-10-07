// ESLint 9 flat config (replaces .eslintrc.json, which ESLint 9 ignores).
// Mirrors the previous `next/core-web-vitals` setup plus the two rule-offs.
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "playwright-report/**"],
  },
  {
    // Playwright fixtures use the `use()` pattern, which is not a React Hook.
    files: ["e2e/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default config;
