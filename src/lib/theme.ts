/**
 * App-wide theme preference: pure resolution logic plus its persistence.
 *
 * A preference is tri-state — "system" follows the OS, "light"/"dark" pin it.
 * The OS-detection side effects live in the useTheme hook (ADR-0008); this
 * module stays pure so the resolution rules can be unit-tested without a DOM.
 */

/** What the user chose. "system" defers to the live OS theme. */
export type ThemePreference = "system" | "light" | "dark";

/** What Excalidraw actually renders — always concrete, never "system". */
export type ResolvedTheme = "light" | "dark";

/** localStorage key for the app-wide (not per-document) preference. */
const STORAGE_KEY = "lousa:theme-preference";

/** Narrow an untrusted string to a ThemePreference, defaulting to "system". */
export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** Fold a preference and the current OS theme into the theme to render. */
export function resolveTheme(preference: ThemePreference, osTheme: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? osTheme : preference;
}

/** Read the saved preference; falls back to "system" if unset or unavailable. */
export function loadThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be disabled/blocked; a missing preference is not an error.
    return "system";
  }
}

/** Persist the preference app-wide. Best-effort — storage failures are ignored. */
export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Persistence is best-effort; the in-memory choice still applies this session.
  }
}
