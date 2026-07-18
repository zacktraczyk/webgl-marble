import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Layer boundaries (pages → scenes|debug → game|editor|races → engine).
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
        "**/components/**",
        "**/pages/**",
      ],
      "engine is a leaf layer and must not import from game/editor/races/scenes/debug/components/pages"
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
        "**/components/**",
        "**/pages/**",
      ],
      "game may only import engine (not editor/races/scenes/debug/components/pages)"
    ),
  },
  {
    files: ["src/editor/**/*.{ts,js}"],
    rules: deny(
      [
        "**/races/**",
        "**/scenes/**",
        "**/debug/**",
        "**/components/**",
        "**/pages/**",
      ],
      "editor may only import game and engine (not races/scenes/debug/components/pages)"
    ),
  },
  {
    files: ["src/races/**/*.{ts,js}"],
    rules: deny(
      [
        "**/editor/**",
        "**/scenes/**",
        "**/debug/**",
        "**/components/**",
        "**/pages/**",
      ],
      "races may only import game and engine (not editor/scenes/debug/components/pages)"
    ),
  },
  {
    files: ["src/debug/**/*.{ts,js}"],
    rules: deny(
      ["**/scenes/**", "**/editor/**", "**/races/**", "**/components/**", "**/pages/**"],
      "debug demos may import game/engine only (not product scenes/editor/races)"
    ),
  },
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**", "bun.lockb"],
  },
];
