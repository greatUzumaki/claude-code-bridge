import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";
import { SettingsProvider } from "./lib/settings.tsx";
import { queryClient } from "./lib/queryClient.ts";
import { registerServiceWorker } from "./lib/swManager.ts";
import { resyncPushSubscription } from "./lib/push.ts";

registerServiceWorker();
// Keep the server's stored endpoint in sync with the device's current subscription —
// Chrome rotates it without firing pushsubscriptionchange, which otherwise silently
// breaks delivery (see resyncPushSubscription).
void resyncPushSubscription();

// iOS Safari (browser tab) ignores `user-scalable=no` and still allows pinch zoom via its
// proprietary gesture events. Block them so zoom is off everywhere — meta covers Android + PWA.
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
