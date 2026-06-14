import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false, // we register manually in swManager.ts (aggressive update)
      useCredentials: true,
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "notification-badge.png",
      ],
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
          {
            src: "android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // Long-press the installed app icon → jump straight to an action.
        shortcuts: [
          {
            name: "Multiscreen",
            short_name: "Grid",
            url: "/terminal?action=multi",
          },
          {
            name: "Projects",
            short_name: "Projects",
            url: "/terminal?action=projects",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
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
