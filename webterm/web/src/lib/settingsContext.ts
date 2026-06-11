import { createContext, useContext } from "react";
import type { Settings } from "./settings";

// Context + hook live here (separate from the SettingsProvider component) so the
// settings module stays a clean component-only Fast Refresh boundary.
export type SettingsContextValue = {
  settings: Settings;
  update: (partial: Partial<Settings>) => void;
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
