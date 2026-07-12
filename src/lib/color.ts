/**
 * Small, dependency-free color math for deriving theme variable families from
 * a single user-picked color. All functions are pure and operate on `#rrggbb`
 * hex strings so they can be unit-tested without a DOM.
 */

import { TEXT_ON_DARK, TEXT_ON_LIGHT } from "./palette";

export interface Hsl {
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** True for a well-formed `#rgb` or `#rrggbb` string. */
export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Expand `#rgb` to `#rrggbb` and lowercase; returns null if not a hex color. */
export function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!isHexColor(v)) return null;
  if (v.length === 4) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
}

export function hexToHsl(hex: string): Hsl {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = ln - c / 2;
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Return `hex` with its lightness set to an absolute value (0..100). */
export function withLightness(hex: string, l: number): string {
  return hslToHex({ ...hexToHsl(hex), l });
}

/** Nudge lightness by a signed delta, clamped to the valid range. */
export function shiftLightness(hex: string, delta: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h, s, l: clamp(l + delta, 0, 100) });
}

/** Perceived luminance (0..1) via the sRGB relative-luminance formula. */
export function luminance(hex: string): number {
  const norm = normalizeHex(hex) ?? "#000000";
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(norm.slice(1, 3), 16));
  const g = channel(parseInt(norm.slice(3, 5), 16));
  const b = channel(parseInt(norm.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when a color is light enough to read dark text against. */
export function isLight(hex: string): boolean {
  return luminance(hex) > 0.4;
}

/** A near-black or near-white that stays readable on the given background. */
export function readableTextOn(background: string): string {
  return isLight(background) ? TEXT_ON_LIGHT : TEXT_ON_DARK;
}
