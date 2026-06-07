import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { pushSupported, pushPermission } from "./push";

// jsdom does NOT provide Notification, PushManager, or serviceWorker by default.
// We add them per-test and clean up afterwards.

afterEach(() => {
  vi.unstubAllGlobals();
  // Remove any keys we may have attached to window.
  for (const key of ["Notification", "PushManager"] as const) {
    if (key in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any)[key];
    }
  }
});

// Replicate the pure urlBase64ToUint8Array logic from push.ts so we can unit-test it
// without exporting it from the production module.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

describe("urlBase64ToUint8Array", () => {
  it("decodes a known base64url string to the correct byte length", () => {
    // "hello" base64url → "aGVsbG8" (padded to "aGVsbG8=")
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBe(5); // "hello" is 5 bytes
  });

  it("decodes correctly to expected byte values", () => {
    // "hello" → [104, 101, 108, 108, 111]
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it("handles base64url dashes and underscores (url-safe alphabet)", () => {
    // 0xFB 0xFF → standard base64 "+/8=" → base64url "-_8"
    const result = urlBase64ToUint8Array("-_8");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBe(2);
    expect(result[0]).toBe(0xfb);
    expect(result[1]).toBe(0xff);
  });

  it("round-trips an arbitrary 65-byte buffer (typical VAPID key length)", () => {
    const bytes = new Uint8Array(65);
    for (let i = 0; i < 65; i++) bytes[i] = i;
    const b64 = btoa(String.fromCharCode(...bytes));
    const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const result = urlBase64ToUint8Array(b64url);
    expect(result.byteLength).toBe(65);
    expect(Array.from(result)).toEqual(Array.from(bytes));
  });
});

// Define sentinel stubs at module scope.
const PUSH_MANAGER_STUB = { subscribe: () => {} };
const NOTIFICATION_STUB = { permission: "default" as const };

// Attach globals that simulate a fully capable push-capable browser.
function setupPushEnv() {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", { ...navigator, serviceWorker: {} });
  Object.defineProperty(window, "PushManager", {
    value: PUSH_MANAGER_STUB,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "Notification", {
    value: NOTIFICATION_STUB,
    configurable: true,
    writable: true,
  });
}

describe("pushSupported", () => {
  beforeEach(() => {
    // Ensure a clean baseline (nothing push-related on window).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).PushManager;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Notification;
  });

  it("returns true when serviceWorker, PushManager, and Notification are all present", () => {
    setupPushEnv();
    expect(pushSupported()).toBe(true);
  });

  it("returns false when serviceWorker is absent from navigator", () => {
    // No serviceWorker on navigator (default jsdom navigator doesn't have it).
    Object.defineProperty(window, "PushManager", {
      value: PUSH_MANAGER_STUB,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "Notification", {
      value: NOTIFICATION_STUB,
      configurable: true,
      writable: true,
    });
    expect("serviceWorker" in navigator).toBe(false);
    expect(pushSupported()).toBe(false);
  });

  it("returns false when PushManager is absent from window", () => {
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: {} });
    Object.defineProperty(window, "Notification", {
      value: NOTIFICATION_STUB,
      configurable: true,
      writable: true,
    });
    // PushManager is absent (deleted in beforeEach).
    expect("PushManager" in window).toBe(false);
    expect(pushSupported()).toBe(false);
  });

  it("returns false when Notification is absent from window", () => {
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: {} });
    Object.defineProperty(window, "PushManager", {
      value: PUSH_MANAGER_STUB,
      configurable: true,
      writable: true,
    });
    // Notification absent (deleted in beforeEach).
    expect("Notification" in window).toBe(false);
    expect(pushSupported()).toBe(false);
  });

  it("returns false when isSecureContext is false (plain HTTP)", () => {
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", { ...navigator, serviceWorker: {} });
    Object.defineProperty(window, "PushManager", {
      value: PUSH_MANAGER_STUB,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "Notification", {
      value: NOTIFICATION_STUB,
      configurable: true,
      writable: true,
    });
    expect(pushSupported()).toBe(false);
  });
});

describe("pushPermission", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Notification;
  });

  it("returns the Notification.permission value when Notification is present", () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted" },
      configurable: true,
      writable: true,
    });
    expect(pushPermission()).toBe("granted");
  });

  it("returns 'denied' when permission is denied", () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "denied" },
      configurable: true,
      writable: true,
    });
    expect(pushPermission()).toBe("denied");
  });

  it("returns 'unsupported' when Notification is absent from window", () => {
    expect("Notification" in window).toBe(false);
    expect(pushPermission()).toBe("unsupported");
  });
});
