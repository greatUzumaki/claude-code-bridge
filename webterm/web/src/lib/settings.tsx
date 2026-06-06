import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type Settings = {
  theme: "dark" | "light";
  accent: string;
  haptics: boolean;
  keys: string[];
};

const DEFAULTS: Settings = {
  theme: "dark",
  accent: "#5b9dd9",
  haptics: true,
  keys: ["esc", "tab", "enter", "ctrlc", "left", "up", "down", "right"],
};

const STORAGE_KEY = "webterm_settings";

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULTS, ...parsed };
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

type SettingsContextValue = {
  settings: Settings;
  update: (partial: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      save(next);
      return next;
    });
  }, []);

  return <SettingsContext value={{ settings, update }}>{children}</SettingsContext>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
