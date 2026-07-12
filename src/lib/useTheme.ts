/**
 * React binding for the app-wide theme preference.
 *
 * Owns the two moving parts the pure theme module (./theme) deliberately does
 * not: the persisted preference and the live OS theme, read from Tauri's native
 * window API rather than CSS `prefers-color-scheme` — the latter is unreliable
 * on Linux WebKitGTK, and the native signal is authoritative on every platform.
 */

import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

export interface ThemeControl {
  /** The user's choice, including "system". Drives the menu's active state. */
  preference: ThemePreference;
  /** The concrete theme to hand to Excalidraw. */
  resolved: ResolvedTheme;
  /** Change and persist the preference. */
  setPreference: (preference: ThemePreference) => void;
}

/** Tauri reports null when the OS theme is indeterminate; treat that as light. */
function toResolved(theme: "light" | "dark" | null): ResolvedTheme {
  return theme === "dark" ? "dark" : "light";
}

export function useTheme(): ThemeControl {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadThemePreference);
  const [osTheme, setOsTheme] = useState<ResolvedTheme>("light");

  // Read the OS theme once and keep it in sync so a "system" preference tracks
  // the desktop live. Guard against the async setup resolving after unmount.
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    const window = getCurrentWindow();
    void window.theme().then((theme) => {
      if (active) setOsTheme(toResolved(theme));
    });
    void window
      .onThemeChanged(({ payload }) => setOsTheme(toResolved(payload)))
      .then((fn) => {
        if (active) unlisten = fn;
        else fn();
      });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    saveThemePreference(next);
  }, []);

  return { preference, resolved: resolveTheme(preference, osTheme), setPreference };
}
