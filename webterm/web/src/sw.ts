/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event: PushEvent) => {
  let data: { title?: string; body?: string; tag?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* ignore */
  }
  const title = data.title || "WebTerm";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const focused = wins.some((c) => c.focused || c.visibilityState === "visible");
      if (focused) return; // user is looking — don't interrupt
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag,
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.length) {
        await wins[0].focus();
        return;
      }
      await self.clients.openWindow("/");
    })(),
  );
});
