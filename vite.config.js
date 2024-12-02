// vite.config.js
import glsl from "vite-plugin-glsl";
// import eslint from "vite-plugin-eslint";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [glsl()],
});
