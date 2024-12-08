/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  arrowParens: "always",
  tabWidth: 2,
  useTabs: false,
  parser: "typescript",
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: "*.css",
      options: {
        parser: "css",
      },
    },
  ],
};

export default config;
