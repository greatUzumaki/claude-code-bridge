import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Keep Playwright e2e specs out of the vitest run; they live in e2e/
    // and use @playwright/test, which is incompatible with vitest's test runner.
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
