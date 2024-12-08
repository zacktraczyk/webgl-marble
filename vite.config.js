// vite.config.js
import { defineConfig } from "vite";
import eslint from "vite-plugin-eslint";
import glsl from "vite-plugin-glsl";

export default defineConfig({
  plugins: [glsl(), eslint()],
});
