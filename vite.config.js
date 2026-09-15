import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["graphql"],
  },
  server: {
    port: 3000,
  },
  test: {
    environment: "jsdom",
    server: {
      deps: {
        inline: ["graphql"],
      },
    },
  },
});
