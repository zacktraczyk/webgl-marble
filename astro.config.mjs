// @ts-check
import { defineConfig, envField } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      PUBLIC_ANALYTICS_MODE: envField.enum({
        context: "client",
        access: "public",
        values: ["off", "console", "posthog"],
        default: "off",
      }),
      PUBLIC_ANALYTICS_ENVIRONMENT: envField.string({
        context: "client",
        access: "public",
        default: "unknown",
      }),
      PUBLIC_POSTHOG_PROJECT_TOKEN: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
      PUBLIC_POSTHOG_HOST: envField.string({
        context: "client",
        access: "public",
        optional: true,
      }),
    },
  },
  vite: {
    plugins: [tailwindcss(), glsl()],
  },
});
