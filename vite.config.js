import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/<repo>/
  base: process.env.GITHUB_PAGES === "true" ? "/lila-website/" : "/",
  plugins: [react()],
  server: {
    // Dev server may pick the next free port if the default is busy — use the URL printed in the terminal.
    port: 5173,
    strictPort: false,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
