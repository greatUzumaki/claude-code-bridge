// Service-worker registration with aggressive update so every release is picked
// up without a manual cache clear. We register manually (vite-plugin-pwa's
// injectRegister is off) to control the update behaviour:
//   - updateViaCache:"none" → the browser never serves sw.js from the HTTP
//     cache during update checks, so a changed SW is always detected.
//   - periodic + on-focus reg.update() → checks for a new SW promptly (matters
//     on mobile / installed PWAs where the default ~24h check is too slow).
//   - sw.ts calls skipWaiting()+clientsClaim(), so a new SW activates and takes
//     control immediately; controllerchange then reloads once to the new build.
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  // Reload once when a *new* SW takes over (not on the first install, which has
  // no prior controller and is already the fresh build).
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((reg) => {
      const check = () => {
        void reg.update().catch(() => {});
      };
      setInterval(check, 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    })
    .catch(() => {});
}

// Manual hard reset for stuck installs: drop all service workers + Cache API
// caches, then reload. The HTTP cache keeps the immutable /assets/* so the
// reload re-downloads almost nothing.
export async function forceUpdate(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    window.location.reload();
  }
}
