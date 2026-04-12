import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Production on https://lilagent.xyz/ uses base "/". GitHub Pages project sites: GITHUB_PAGES=true → /lila-website/
  base: process.env.GITHUB_PAGES === "true" ? "/lila-website/" : "/",
  plugins: [react()],
  server: {
    // Dev server may pick the next free port if the default is busy; use the URL printed in the terminal.
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
