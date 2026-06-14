/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { isInQuietWindow } from "./lib/quietWindow";

declare const self: ServiceWorkerGlobalScope;

// Activate the new SW immediately without waiting for all tabs to close.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

type NotifPrefs = {
  mute: boolean;
  quietEnabled: boolean;
  quietFrom: string;
  quietTo: string;
};

/** base64url VAPID public key → Uint8Array for pushManager applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

/** Read notification prefs written by notifPrefs.ts via the Cache API. */
async function readPrefs(): Promise<NotifPrefs | null> {
  try {
    const r = await caches.match("/__notif_prefs");
    return r ? ((await r.json()) as NotifPrefs) : null;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event: PushEvent) => {
  let data: { title?: string; body?: string; tag?: string; test?: boolean } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* ignore */
  }
  const title = data.title || "WebTerm";
  event.waitUntil(
    (async () => {
      // Test pushes (from Settings) always show — they verify delivery, so they
      // bypass the focus check and mute / quiet-hours prefs.
      if (!data.test) {
        const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const focused = wins.some((c) => c.focused || c.visibilityState === "visible");
        if (focused) return; // user is looking — don't interrupt

        // Enforce client-side notification prefs.
        const prefs = await readPrefs();
        if (prefs?.mute) return;
        if (prefs?.quietEnabled) {
          const now = new Date();
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          if (isInQuietWindow(prefs.quietFrom, prefs.quietTo, nowMinutes)) return;
        }
      }

      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag,
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
      });
    })(),
  );
});

// Chrome/FCM rotate or invalidate push subscriptions periodically; when they do, the browser
// fires `pushsubscriptionchange` and expects us to re-subscribe and re-register the new
// endpoint. Without this the old endpoint goes 410 Gone and the device silently stops receiving
// — which is why only iOS (which rarely rotates) kept getting pushes. Re-bind to the current
// VAPID key and POST the fresh subscription so the server's endpoint stays live.
self.addEventListener("pushsubscriptionchange", (event) => {
  (event as ExtendableEvent).waitUntil(
    (async () => {
      try {
        const res = await fetch("/api/push/vapid");
        if (!res.ok) return;
        const { publicKey } = (await res.json()) as { publicKey: string };
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        /* best-effort — nothing actionable to surface from the SW */
      }
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
