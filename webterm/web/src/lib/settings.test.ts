import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { SettingsProvider, useSettings } from "./settings";

const STORAGE_KEY = "webterm_settings";

function wrapper({ children }: { children: ReactNode }) {
  return React.createElement(SettingsProvider, null, children);
}

beforeEach(() => {
  localStorage.clear();
  // Reset CSS vars that may have been set by previous tests.
  document.documentElement.removeAttribute("style");
});

describe("SettingsProvider defaults", () => {
  it("has dark theme by default", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.theme).toBe("dark");
  });

  it("has correct default accent color", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.accent).toBe("#5b9dd9");
  });

  it("has haptics true by default", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.haptics).toBe(true);
  });

  it("has all 8 key ids by default", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.keys).toHaveLength(8);
    const expectedIds = ["esc", "tab", "enter", "ctrlc", "left", "up", "down", "right"];
    expect(result.current.settings.keys).toEqual(expectedIds);
  });
});

describe("SettingsProvider update", () => {
  it("persists updated theme to localStorage", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.update({ theme: "light" });
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      theme?: string;
    };
    expect(stored.theme).toBe("light");
  });

  it("applies --color-bg CSS var when switching to light theme", () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.update({ theme: "light" });
    });
    const bg = document.documentElement.style.getPropertyValue("--color-bg");
    expect(bg).toBe("#f6f7f9");
  });

  it("applies dark --color-bg by default", () => {
    renderHook(() => useSettings(), { wrapper });
    const bg = document.documentElement.style.getPropertyValue("--color-bg");
    expect(bg).toBe("#0d0f12");
  });
});

describe("SettingsProvider malformed localStorage", () => {
  it("falls back to defaults on JSON parse error", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.theme).toBe("dark");
    expect(result.current.settings.accent).toBe("#5b9dd9");
  });

  it("merges partial stored values with defaults", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "light" }));
    const { result } = renderHook(() => useSettings(), { wrapper });
    // theme was overridden
    expect(result.current.settings.theme).toBe("light");
    // everything else stays default
    expect(result.current.settings.haptics).toBe(true);
    expect(result.current.settings.accent).toBe("#5b9dd9");
  });
});
