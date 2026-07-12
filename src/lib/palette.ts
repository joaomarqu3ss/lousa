/**
 * Lousa's built-in interface palette — the single source of truth for the
 * default colors shown as swatches when a Custom-theme channel is unset.
 *
 * The accent and background values here MUST match the chalk-teal `--color-*`
 * rules baked into App.css (`.excalidraw` / `.excalidraw.theme--dark`); the text
 * values are the on-surface text colors Excalidraw ships. Change them in both.
 */

/** Near-black interface text, legible on light surfaces. */
export const TEXT_ON_LIGHT = "#1b1b1f";
/** Near-white interface text, legible on dark surfaces. */
export const TEXT_ON_DARK = "#e3e3e8";

export const DEFAULT_PALETTE = {
  light: { accent: "#2f8f83", background: "#ffffff", text: TEXT_ON_LIGHT },
  dark: { accent: "#7fd4c6", background: "#232329", text: TEXT_ON_DARK },
} as const;
