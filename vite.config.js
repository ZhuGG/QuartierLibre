import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/Neversmoonsun/" : "/",
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
