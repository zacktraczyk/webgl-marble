// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import glsl from "vite-plugin-glsl";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss(), glsl()],
  },
});
