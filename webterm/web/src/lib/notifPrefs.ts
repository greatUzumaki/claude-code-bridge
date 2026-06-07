export type NotifPrefs = {
  mute: boolean;
  quietEnabled: boolean;
  quietFrom: string;
  quietTo: string;
};

const CACHE_NAME = "webterm-prefs";
const PREFS_URL = "/__notif_prefs";

/**
 * Persist notification prefs to the Cache API so the service worker can read
 * them even when the main app is closed. No-op when the Cache API is absent.
 */
export async function syncNotifPrefs(p: NotifPrefs): Promise<void> {
  if (!("caches" in self)) return;
  try {
    const c = await caches.open(CACHE_NAME);
    await c.put(
      PREFS_URL,
      new Response(JSON.stringify(p), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    // Non-fatal — best-effort sync.
  }
}
