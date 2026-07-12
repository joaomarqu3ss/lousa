/**
 * User-defined interface colors ("Custom theme").
 *
 * The user picks up to three base colors — Accent, Background, Text — and this
 * module expands each into the full family of Excalidraw CSS variables it drives
 * (ADR-0009), for both the light and dark roots, then serializes them to a CSS
 * string. Applying and persisting the result lives in the useCustomTheme hook;
 * everything here is pure so the derivation can be unit-tested.
 */

import { hexToHsl, hslToHex, normalizeHex, readableTextOn, shiftLightness } from "./color";

/** A base color per channel; null means "leave Excalidraw's default (per mode)". */
export interface CustomTheme {
  accent: string | null;
  background: string | null;
  text: string | null;
}

export const EMPTY_CUSTOM_THEME: CustomTheme = { accent: null, background: null, text: null };

const STORAGE_KEY = "lousa:custom-theme";

/** True when at least one channel is customized. */
export function hasCustomization(theme: CustomTheme): boolean {
  return Boolean(theme.accent || theme.background || theme.text);
}

type Decls = Record<string, string>;

/** Accent family for one mode; a mid-tone base is nudged to stay legible in each. */
function accentVars(base: string, mode: "light" | "dark"): Decls {
  const { h, s, l: baseL } = hexToHsl(base);
  const at = (l: number, sat = s) => hslToHex({ h, s: sat, l });
  if (mode === "light") {
    const l = Math.min(baseL, 62);
    return {
      "--color-primary": at(l),
      "--color-primary-hover": at(l - 6),
      "--color-primary-darker": at(l - 6),
      "--color-primary-darkest": at(l - 14),
      "--color-primary-light": at(92, s * 0.5),
      "--color-primary-light-darker": at(88, s * 0.5),
      "--color-brand-hover": at(l - 6),
      "--color-brand-active": at(l - 14),
      "--color-surface-primary-container": at(90, s * 0.5),
      "--color-on-primary-container": at(18),
    };
  }
  const l = Math.max(baseL, 72);
  return {
    "--color-primary": at(l),
    "--color-primary-hover": at(l + 6),
    "--color-primary-darker": at(l + 6),
    "--color-primary-darkest": at(l + 12),
    "--color-primary-light": at(32, s * 0.6),
    "--color-primary-light-darker": at(26, s * 0.6),
    "--color-brand-hover": at(l + 6),
    "--color-brand-active": at(l + 12),
    "--color-surface-primary-container": at(30, s * 0.6),
    "--color-on-primary-container": at(88),
  };
}

/** Surface/island/input/border family derived from one background color. */
function backgroundVars(base: string): Decls {
  // Higher "surfaces" move away from the base: darker on a light base, lighter
  // on a dark one — matching how Excalidraw's own light and dark roots behave.
  const dir = hexToHsl(base).l > 40 ? -1 : 1;
  return {
    "--default-bg-color": shiftLightness(base, -dir * 5),
    "--island-bg-color": base,
    "--popup-bg-color": base,
    "--input-bg-color": base,
    "--color-surface-lowest": base,
    "--color-surface-low": shiftLightness(base, dir * 3),
    "--color-surface-mid": shiftLightness(base, dir * 2),
    "--color-surface-high": shiftLightness(base, dir * 6),
    "--popup-secondary-bg-color": shiftLightness(base, dir * 3),
    "--input-hover-bg-color": shiftLightness(base, dir * 4),
    "--input-border-color": shiftLightness(base, dir * 12),
    "--color-border-outline-variant": shiftLightness(base, dir * 14),
  };
}

/** Primary-text family derived from one text color. */
function textVars(text: string): Decls {
  return {
    "--color-on-surface": text,
    "--text-primary-color": text,
    "--popup-text-color": text,
    "--input-label-color": text,
    "--popup-text-inverted-color": readableTextOn(text),
  };
}

/** Build the light- and dark-root declaration sets for a custom theme. */
function buildDecls(theme: CustomTheme): { light: Decls; dark: Decls } {
  const light: Decls = {};
  const dark: Decls = {};
  if (theme.accent) {
    Object.assign(light, accentVars(theme.accent, "light"));
    Object.assign(dark, accentVars(theme.accent, "dark"));
  }
  if (theme.background) {
    Object.assign(light, backgroundVars(theme.background));
    Object.assign(dark, backgroundVars(theme.background));
  }
  // A custom background needs legible text; fall back to auto-contrast if the
  // user didn't pick a text color, so a dark background never keeps dark text.
  const text = theme.text ?? (theme.background ? readableTextOn(theme.background) : null);
  if (text) {
    Object.assign(light, textVars(text));
    Object.assign(dark, textVars(text));
  }
  return { light, dark };
}

function rule(selector: string, decls: Decls): string {
  const body = Object.entries(decls)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return body ? `${selector} {\n${body}\n}` : "";
}

/**
 * Serialize a custom theme to CSS targeting both Excalidraw roots. The
 * `.theme--dark` selector matches Excalidraw's own dark specificity, so these
 * win at equal specificity by source order regardless of the active mode.
 */
export function buildCustomThemeCss(theme: CustomTheme): string {
  const { light, dark } = buildDecls(theme);
  return [rule(".excalidraw", light), rule(".excalidraw.theme--dark", dark)]
    .filter(Boolean)
    .join("\n");
}

function sanitizeChannel(value: unknown): string | null {
  return typeof value === "string" ? normalizeHex(value) : null;
}

export function loadCustomTheme(): CustomTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CUSTOM_THEME;
    const parsed = JSON.parse(raw) as Partial<CustomTheme>;
    return {
      accent: sanitizeChannel(parsed.accent),
      background: sanitizeChannel(parsed.background),
      text: sanitizeChannel(parsed.text),
    };
  } catch {
    return EMPTY_CUSTOM_THEME;
  }
}

export function saveCustomTheme(theme: CustomTheme): void {
  try {
    if (hasCustomization(theme)) localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort persistence; the in-memory theme still applies this session.
  }
}
