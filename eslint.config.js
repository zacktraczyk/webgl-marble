import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Layer boundaries (pages → scenes|debug|ui → game|editor|raceLibrary → engine).
 * Patterns match import paths as written (including relative ../../game/...).
 */
const deny = (groups, message) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: groups.map((group) => ({
        group: [group],
        message,
      })),
    },
  ],
});

/** @type {import('eslint').Linter.Config[]} */
export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  tseslint.configs.eslintRecommended,
  ...eslintPluginAstro.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-case-declarations": "warn",
      "prefer-const": "warn",
    },
  },
  { languageOptions: { globals: globals.browser } },
  {
    files: ["src/engine/**/*.{ts,js}"],
    rules: deny(
      [
        "**/game/**",
        "**/editor/**",
        "**/raceLibrary/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "engine is a leaf layer and must not import from game/editor/raceLibrary/scenes/debug/pages/ui"
    ),
  },
  {
    files: ["src/game/**/*.{ts,js}"],
    rules: deny(
      [
        "**/editor/**",
        "**/raceLibrary/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "game may only import engine (not editor/raceLibrary/scenes/debug/pages/ui)"
    ),
  },
  {
    files: ["src/editor/**/*.{ts,js}"],
    rules: deny(
      [
        "**/raceLibrary/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "editor may only import game and engine (not raceLibrary/scenes/debug/pages/ui)"
    ),
  },
  {
    files: ["src/raceLibrary/**/*.{ts,js}"],
    rules: deny(
      [
        "**/editor/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "raceLibrary may only import game and engine (not editor/scenes/debug/pages/ui)"
    ),
  },
  {
    files: ["src/debug/**/*.{ts,js}"],
    rules: deny(
      ["**/scenes/**", "**/editor/**", "**/raceLibrary/**", "**/pages/**", "**/ui/**"],
      "debug demos may import game/engine only (not product scenes/editor/raceLibrary/pages/ui)"
    ),
  },
  {
    files: ["src/scenes/**/*.{ts,js}"],
    rules: deny(
      ["**/pages/**", "**/debug/**"],
      "scenes may import game/editor/raceLibrary/engine/ui (not pages or debug)"
    ),
  },
  {
    files: ["src/pages/**/*.{ts,js,astro}"],
    // Underscore-prefixed files are page-local chrome (not routes); they may
    // read game constants for form defaults. Route shells stay thin.
    ignores: ["src/pages/**/_*.astro"],
    rules: deny(
      ["**/game/**", "**/editor/**", "**/engine/**", "**/raceLibrary/**"],
      "pages should mount via scenes/debug/ui only (not game/editor/engine/raceLibrary)"
    ),
  },
  {
    files: ["src/pages/dev/**/*.{ts,js,astro}"],
    rules: deny(
      [
        "**/game/**",
        "**/editor/**",
        "**/engine/**",
        "**/raceLibrary/**",
        "**/scenes/**",
      ],
      "dev pages should use debug/ + ui only"
    ),
  },
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**", "bun.lockb"],
  },
];
