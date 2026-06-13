import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSettings } from "../lib/settingsContext";
import {
  pushSupported,
  pushPermission,
  isSubscribed,
  enablePush,
  disablePush,
  sendTestPush,
} from "../lib/push";

const ACCENT_PRESETS = [
  { color: "#5b9dd9", label: "Blue" },
  { color: "#8b5cf6", label: "Violet" },
  { color: "#22c55e", label: "Green" },
  { color: "#f59e0b", label: "Amber" },
  { color: "#ef4444", label: "Red" },
];

const KEY_LABELS: Record<string, string> = {
  esc: "Esc",
  tab: "Tab",
  enter: "Enter",
  ctrlc: "Ctrl C",
  left: "Arrow Left",
  up: "Arrow Up",
  down: "Arrow Down",
  right: "Arrow Right",
};

const ALL_KEY_IDS = ["esc", "tab", "enter", "ctrlc", "left", "up", "down", "right"];

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();

  const toggleKey = (id: string) => {
    const current = settings.keys;
    const next = current.includes(id) ? current.filter((k) => k !== id) : [...current, id];
    update({ keys: next });
  };

  // --- Push notifications state ---
  const supported = pushSupported();
  const permission = pushPermission();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // --- Test push state ---
  const [testDelay, setTestDelay] = useState(0);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const handleTestPush = async () => {
    if (testBusy) return;
    setTestBusy(true);
    setTestMsg(null);
    try {
      const r = await sendTestPush(testDelay);
      if (r.subscribers === 0) {
        setTestMsg("No subscription — turn push On above first.");
      } else if (testDelay > 0) {
        setTestMsg(`Scheduled in ${testDelay}s — lock your screen and wait.`);
      } else {
        setTestMsg("Sent — it should arrive now.");
      }
    } catch {
      setTestMsg("Failed to send test push.");
    } finally {
      setTestBusy(false);
    }
  };

  useEffect(() => {
    if (!supported) return;
    isSubscribed()
      .then(setPushOn)
      .catch(() => {
        /* ignore */
      });
  }, [supported]);

  const handlePushToggle = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushOn) {
        await disablePush();
      } else {
        const ok = await enablePush();
        if (!ok) setPushError("Failed to enable push notifications.");
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      // Always re-sync toggle state from ground truth to avoid desync.
      isSubscribed()
        .then(setPushOn)
        .catch(() => {});
      setPushBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-lg border border-border bg-panel p-5 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-text text-sm font-medium">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex items-center justify-center rounded w-9 h-9 text-muted hover:bg-white/5 active:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Theme */}
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Theme</div>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => update({ theme: "dark" })}
              aria-pressed={settings.theme === "dark"}
              className={[
                "flex-1 min-h-11 text-[14px] transition-colors",
                settings.theme === "dark"
                  ? "bg-accent text-bg font-medium"
                  : "text-text hover:bg-white/5 active:bg-white/10",
              ].join(" ")}
            >
              Dark
            </button>
            <button
              onClick={() => update({ theme: "light" })}
              aria-pressed={settings.theme === "light"}
              className={[
                "flex-1 min-h-11 text-[14px] transition-colors border-l border-border",
                settings.theme === "light"
                  ? "bg-accent text-bg font-medium"
                  : "text-text hover:bg-white/5 active:bg-white/10",
              ].join(" ")}
            >
              Light
            </button>
          </div>
        </div>

        {/* Accent color */}
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Accent color</div>
          <div className="flex items-center gap-3">
            {ACCENT_PRESETS.map(({ color, label }) => {
              const isActive = settings.accent === color;
              return (
                <button
                  key={color}
                  onClick={() => update({ accent: color })}
                  aria-label={`Accent ${label}${isActive ? " (selected)" : ""}`}
                  aria-pressed={isActive}
                  className="relative flex items-center justify-center w-11 h-11 rounded-full transition-transform active:scale-90"
                  style={{ backgroundColor: color }}
                >
                  {isActive && (
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{ boxShadow: `0 0 0 2px var(--color-panel), 0 0 0 4px ${color}` }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Haptics */}
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Haptics</div>
          <button
            onClick={() => update({ haptics: !settings.haptics })}
            role="switch"
            aria-checked={settings.haptics}
            aria-label="Haptic feedback"
            className="flex items-center gap-3 min-h-11 text-[14px] text-text"
          >
            <span
              className={[
                "relative inline-flex shrink-0 w-11 h-6 rounded-full transition-colors",
                settings.haptics ? "bg-accent" : "bg-border",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  settings.haptics ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
            </span>
            <span>{settings.haptics ? "On" : "Off"}</span>
          </button>
        </div>

        {/* Key bar */}
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Key bar</div>
          <div className="flex flex-col">
            {ALL_KEY_IDS.map((id) => {
              const enabled = settings.keys.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleKey(id)}
                  className="flex items-center gap-3 min-h-11 rounded-sm px-1 transition-colors hover:bg-white/5 active:bg-white/10 text-left"
                >
                  <span
                    className={[
                      "shrink-0 flex items-center justify-center w-5 h-5 rounded border text-[11px]",
                      enabled
                        ? "bg-accent border-accent text-bg"
                        : "border-border text-transparent",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="text-[14px] text-text">{KEY_LABELS[id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted mb-2">Notifications</div>
          {!supported ? (
            <p className="text-[13px] text-muted">Not supported in this browser.</p>
          ) : permission === "denied" ? (
            <p className="text-[13px] text-muted">
              Blocked — allow notifications in browser settings.
            </p>
          ) : (
            <button
              onClick={handlePushToggle}
              role="switch"
              aria-checked={pushOn}
              aria-label="Push notifications"
              disabled={pushBusy}
              className="flex items-center gap-3 min-h-11 text-[14px] text-text disabled:opacity-60"
            >
              <span
                className={[
                  "relative inline-flex shrink-0 w-11 h-6 rounded-full transition-colors",
                  pushOn ? "bg-accent" : "bg-border",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    pushOn ? "translate-x-6" : "translate-x-1",
                  ].join(" ")}
                />
              </span>
              <span>{pushOn ? "On" : "Off"}</span>
            </button>
          )}
          {pushError && (
            <p className="mt-1 text-[12px] text-red-400 leading-relaxed">{pushError}</p>
          )}
          <p className="mt-2 text-[12px] text-muted leading-relaxed">
            iOS: works only as an installed PWA (Add to Home Screen). Requires HTTPS.
          </p>

          {/* Test push — pick a delay, send, verify it arrives (lock screen to test background delivery) */}
          {pushOn && (
            <div className="mt-3">
              <div className="text-[12px] text-muted mb-1">Test push</div>
              <div className="flex items-center gap-2">
                <select
                  value={testDelay}
                  onChange={(e) => setTestDelay(Number(e.target.value))}
                  aria-label="Test push delay"
                  className="min-h-9 rounded border border-border bg-panel text-text text-[13px] px-2 focus:outline-none focus:border-accent"
                >
                  <option value={0}>Now</option>
                  <option value={5}>In 5s</option>
                  <option value={30}>In 30s</option>
                  <option value={60}>In 1 min</option>
                  <option value={300}>In 5 min</option>
                </select>
                <button
                  onClick={handleTestPush}
                  disabled={testBusy}
                  className="min-h-9 px-3 rounded-md text-[13px] font-medium bg-accent text-bg transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {testBusy ? "Sending…" : "Send test push"}
                </button>
              </div>
              {testMsg && <p className="mt-1 text-[12px] text-muted leading-relaxed">{testMsg}</p>}
            </div>
          )}

          {/* Mute all notifications */}
          <button
            onClick={() => update({ notif: { ...settings.notif, mute: !settings.notif.mute } })}
            role="switch"
            aria-checked={settings.notif.mute}
            aria-label="Mute notifications"
            className="flex items-center gap-3 min-h-11 text-[14px] text-text mt-1"
          >
            <span
              className={[
                "relative inline-flex shrink-0 w-11 h-6 rounded-full transition-colors",
                settings.notif.mute ? "bg-accent" : "bg-border",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  settings.notif.mute ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
            </span>
            <span>Mute notifications</span>
          </button>

          {/* Quiet hours */}
          <button
            onClick={() =>
              update({ notif: { ...settings.notif, quietEnabled: !settings.notif.quietEnabled } })
            }
            role="switch"
            aria-checked={settings.notif.quietEnabled}
            aria-label="Quiet hours"
            className="flex items-center gap-3 min-h-11 text-[14px] text-text"
          >
            <span
              className={[
                "relative inline-flex shrink-0 w-11 h-6 rounded-full transition-colors",
                settings.notif.quietEnabled ? "bg-accent" : "bg-border",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  settings.notif.quietEnabled ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
            </span>
            <span>Quiet hours</span>
          </button>

          {settings.notif.quietEnabled && (
            <div className="flex items-center gap-3 mt-1 pl-1">
              <label className="text-[13px] text-muted shrink-0">From</label>
              <input
                type="time"
                value={settings.notif.quietFrom}
                onChange={(e) =>
                  update({ notif: { ...settings.notif, quietFrom: e.target.value } })
                }
                className="min-h-9 rounded border border-border bg-panel text-text text-[13px] px-2 focus:outline-none focus:border-accent"
              />
              <label className="text-[13px] text-muted shrink-0">To</label>
              <input
                type="time"
                value={settings.notif.quietTo}
                onChange={(e) => update({ notif: { ...settings.notif, quietTo: e.target.value } })}
                className="min-h-9 rounded border border-border bg-panel text-text text-[13px] px-2 focus:outline-none focus:border-accent"
              />
            </div>
          )}

          <p className="mt-2 text-[12px] text-muted leading-relaxed">
            Silence threshold is set on the server (--silence-seconds).
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
