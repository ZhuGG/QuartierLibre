import { defineConfig } from "vite";
import { offlineApp } from "./scripts/pwa.js";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true"
    ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] || "QuartierLibre"}/`
    : "/",
  plugins: [offlineApp()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "three", test: /node_modules[\\/]three/ }],
        },
      },
    },
  },
});
