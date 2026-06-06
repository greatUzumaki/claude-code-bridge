import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "WebTerm",
        short_name: "WebTerm",
        description: "Self-hosted terminal + project file browser",
        theme_color: "#0d0f12",
        background_color: "#0d0f12",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
  build: { outDir: "../internal/server/dist", emptyOutDir: true },
  server: {
    proxy: {
      "/api": "http://localhost:7070",
      "/ws": { target: "ws://localhost:7070", ws: true },
    },
  },
});
