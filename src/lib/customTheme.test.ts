import { describe, expect, it } from "vitest";
import {
  buildCustomThemeCss,
  EMPTY_CUSTOM_THEME,
  hasCustomization,
  type CustomTheme,
} from "./customTheme";

describe("hasCustomization", () => {
  it("is false only when every channel is null", () => {
    expect(hasCustomization(EMPTY_CUSTOM_THEME)).toBe(false);
    expect(hasCustomization({ accent: "#2f8f83", background: null, text: null })).toBe(true);
  });
});

describe("buildCustomThemeCss", () => {
  it("emits nothing for an empty theme", () => {
    expect(buildCustomThemeCss(EMPTY_CUSTOM_THEME)).toBe("");
  });

  it("targets both light and dark roots when a channel is set", () => {
    const css = buildCustomThemeCss({ accent: "#2f8f83", background: null, text: null });
    expect(css).toContain(".excalidraw {");
    expect(css).toContain(".excalidraw.theme--dark {");
    expect(css).toContain("--color-primary:");
  });

  it("derives the whole accent family, not just --color-primary", () => {
    const css = buildCustomThemeCss({ accent: "#2f8f83", background: null, text: null });
    for (const v of [
      "--color-primary-hover",
      "--color-brand-active",
      "--color-on-primary-container",
    ]) {
      expect(css).toContain(v);
    }
  });

  it("gives a dark background legible auto-contrast text without an explicit text color", () => {
    const css = buildCustomThemeCss({ accent: null, background: "#101418", text: null });
    // readableTextOn a dark background is the near-white default.
    expect(css).toContain("--color-on-surface: #e3e3e8");
  });

  it("lets an explicit text color win over the auto-contrast fallback", () => {
    const theme: CustomTheme = { accent: null, background: "#101418", text: "#ffcc00" };
    expect(buildCustomThemeCss(theme)).toContain("--color-on-surface: #ffcc00");
  });
});
