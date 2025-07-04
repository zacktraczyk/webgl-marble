import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import tailwind from "eslint-plugin-tailwindcss";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  tseslint.configs.eslintRecommended,
  ...tailwind.configs["flat/recommended"],
  ...eslintPluginAstro.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  { languageOptions: { globals: globals.browser } },
];
