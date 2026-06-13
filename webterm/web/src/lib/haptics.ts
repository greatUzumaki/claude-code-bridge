const STORAGE_KEY = "webterm_settings";

// Reads the haptics pref straight from localStorage so haptic() can be called
// from any event handler without threading React context through.
function hapticsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true; // default on
    return JSON.parse(raw).haptics !== false;
  } catch {
    return true;
  }
}

/**
 * Short vibration tap on supported devices. No-op when the pref is off or the
 * Vibration API is absent — notably iOS Safari has no navigator.vibrate, so
 * haptics never fire on iPhone regardless of the toggle.
 */
export function haptic(): void {
  if (typeof navigator !== "undefined" && navigator.vibrate && hapticsEnabled()) {
    navigator.vibrate(8);
  }
}
