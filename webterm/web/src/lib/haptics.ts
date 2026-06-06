export function haptic(enabled: boolean) {
  if (enabled && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
}
