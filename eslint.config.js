import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Layer boundaries (pages → scenes|debug|ui → game|editor|races → engine).
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
        "**/races/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "engine is a leaf layer and must not import from game/editor/races/scenes/debug/pages/ui"
    ),
  },
  {
    files: ["src/game/**/*.{ts,js}"],
    rules: deny(
      [
        "**/editor/**",
        "**/races/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "game may only import engine (not editor/races/scenes/debug/pages/ui)"
    ),
  },
  {
    files: ["src/editor/**/*.{ts,js}"],
    rules: deny(
      [
        "**/races/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "editor may only import game and engine (not races/scenes/debug/pages/ui)"
    ),
  },
  {
    files: ["src/races/**/*.{ts,js}"],
    rules: deny(
      [
        "**/editor/**",
        "**/scenes/**",
        "**/debug/**",
        "**/pages/**",
        "**/ui/**",
      ],
      "races may only import game and engine (not editor/scenes/debug/pages/ui)"
    ),
  },
  {
    files: ["src/debug/**/*.{ts,js}"],
    rules: deny(
      ["**/scenes/**", "**/editor/**", "**/races/**", "**/pages/**", "**/ui/**"],
      "debug demos may import game/engine only (not product scenes/editor/races/pages/ui)"
    ),
  },
  {
    files: ["src/scenes/**/*.{ts,js}"],
    rules: deny(
      ["**/pages/**", "**/debug/**"],
      "scenes may import game/editor/races/engine/ui (not pages or debug)"
    ),
  },
  {
    files: ["src/pages/**/*.{ts,js,astro}"],
    rules: deny(
      ["**/game/**", "**/editor/**", "**/engine/**", "**/races/**"],
      "pages should mount via scenes/debug/ui only (not game/editor/engine/races)"
    ),
  },
  {
    files: ["src/pages/dev/**/*.{ts,js,astro}"],
    rules: deny(
      [
        "**/game/**",
        "**/editor/**",
        "**/engine/**",
        "**/races/**",
        "**/scenes/**",
      ],
      "dev pages should use debug/ + ui only"
    ),
  },
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**", "bun.lockb"],
  },
];
