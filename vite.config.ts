import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    include: [
      "cubing/alg",
      "cubing/kpuzzle",
      "cubing/twisty",
      "cubing/puzzles",
      "cubing/search",
    ],
    esbuildOptions: {
      target: "esnext",
    },
  },
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
    commonjsOptions: {
      include: [/cubing/, /node_modules/],
    },
  },
  resolve: {
    alias: {
      cubing: "cubing",
    },
  },
});
