import { useState, useEffect, useCallback, type ReactNode } from "react";
import { syncNotifPrefs } from "./notifPrefs";
import { SettingsContext } from "./settingsContext";

export type NotifSettings = {
  mute: boolean;
  quietEnabled: boolean;
  quietFrom: string;
  quietTo: string;
};

export type Settings = {
  theme: "dark" | "light";
  accent: string;
  haptics: boolean;
  keys: string[];
  notif: NotifSettings;
};

const NOTIF_DEFAULTS: NotifSettings = {
  mute: false,
  quietEnabled: false,
  quietFrom: "22:00",
  quietTo: "08:00",
};

const DEFAULTS: Settings = {
  theme: "dark",
  accent: "#5b9dd9",
  haptics: true,
  keys: ["esc", "tab", "enter", "ctrlc", "left", "up", "down", "right"],
  notif: NOTIF_DEFAULTS,
};

const STORAGE_KEY = "webterm_settings";

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        ...DEFAULTS,
        ...parsed,
        // Merge notif sub-object so older stored data missing `notif` still
        // gets the correct defaults rather than being overwritten by undefined.
        notif: parsed.notif ? { ...NOTIF_DEFAULTS, ...parsed.notif } : { ...NOTIF_DEFAULTS },
      };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULTS };
}

function save(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore storage errors
  }
}

const PALETTES = {
  dark: {
    bg: "#0d0f12",
    panel: "#14171c",
    border: "#232830",
    text: "#d7dce3",
    muted: "#7a828e",
  },
  light: {
    bg: "#f6f7f9",
    panel: "#ffffff",
    border: "#e3e6eb",
    text: "#1b1e23",
    muted: "#6a7280",
  },
};

function applyTheme(settings: Settings) {
  const el = document.documentElement;
  const p = PALETTES[settings.theme];
  el.style.setProperty("--color-bg", p.bg);
  el.style.setProperty("--color-panel", p.panel);
  el.style.setProperty("--color-border", p.border);
  el.style.setProperty("--color-text", p.text);
  el.style.setProperty("--color-muted", p.muted);
  el.style.setProperty("--color-accent", settings.accent);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // Keep service-worker notif prefs in the Cache API in sync.
  useEffect(() => {
    void syncNotifPrefs(settings.notif);
  }, [settings.notif]);

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      save(next);
      return next;
    });
  }, []);

  return <SettingsContext value={{ settings, update }}>{children}</SettingsContext>;
}
