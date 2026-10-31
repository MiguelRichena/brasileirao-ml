import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base relativa: funciona em GitHub Pages (subpasta) e em dominios proprios.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  css: {
    // ignora postcss.config.js de diretorios pais; o Tailwind roda via plugin.
    postcss: { plugins: [] },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
});
