/** Convert a base64url VAPID public key to a Uint8Array. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

/** True when the browser supports the Web Push stack. */
export function pushSupported(): boolean {
  // Push requires a secure context (HTTPS or localhost) in addition to API presence.
  return (
    !!window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current notification permission, or "unsupported" if the API is absent. */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** True if the SW has an active push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub !== null;
}

/**
 * Request notification permission, subscribe to push, and POST the
 * subscription to /api/push/subscribe. Returns true on success.
 */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  // Fetch the VAPID public key from the backend.
  const res = await fetch("/api/push/vapid");
  if (!res.ok) return false;
  const { publicKey } = (await res.json()) as { publicKey: string };

  const reg = await navigator.serviceWorker.ready;

  // Drop any existing subscription first. A leftover sub may be bound to a stale
  // VAPID key (e.g. the server re-keyed), which the push service then rejects on
  // send (Apple: BadJwtToken) — and Safari throws InvalidStateError if you call
  // subscribe() with a different applicationServerKey. Re-subscribing rebinds to
  // the current key. Best-effort server cleanup so the dead endpoint doesn't linger.
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: existing.endpoint }),
    }).catch(() => {});
    await existing.unsubscribe().catch(() => {});
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const subRes = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!subRes.ok) return false;

  return true;
}

/**
 * Ask the server to send a test push to all subscribers, optionally after a
 * delay (seconds). Returns the subscriber count so the caller can warn when
 * there are none. Used by the "Send test push" control in settings.
 */
export async function sendTestPush(
  delaySec: number,
): Promise<{ ok: boolean; subscribers: number; delay: number }> {
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delay: delaySec }),
  });
  if (!res.ok) throw new Error("test push request failed");
  return res.json();
}

/** Unsubscribe from push and notify the backend. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });

  await sub.unsubscribe();
}
