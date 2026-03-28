import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { injectGaMeasurementId } from "./vite.inject-ga-plugin";
import { injectSiteMeta } from "./vite.inject-site-meta";

// Vercel-compatible Vite config (without Manus-specific dev plugins)
export default defineConfig({
  plugins: [react(), tailwindcss(), injectSiteMeta(), injectGaMeasurementId()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
