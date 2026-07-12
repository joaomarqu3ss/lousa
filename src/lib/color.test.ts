import { describe, expect, it } from "vitest";
import {
  hexToHsl,
  hslToHex,
  isHexColor,
  isLight,
  normalizeHex,
  readableTextOn,
  shiftLightness,
  withLightness,
} from "./color";

describe("isHexColor / normalizeHex", () => {
  it("accepts 3- and 6-digit hex, rejects the rest", () => {
    expect(isHexColor("#abc")).toBe(true);
    expect(isHexColor("#2f8f83")).toBe(true);
    expect(isHexColor("2f8f83")).toBe(false);
    expect(isHexColor("#12g")).toBe(false);
  });

  it("expands shorthand and lowercases", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#2F8F83")).toBe("#2f8f83");
    expect(normalizeHex("nope")).toBeNull();
  });
});

describe("hexToHsl / hslToHex round-trip", () => {
  it("survives a round-trip within rounding tolerance", () => {
    for (const hex of ["#2f8f83", "#6965db", "#ffffff", "#000000", "#121212"]) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });

  it("reads pure primaries correctly", () => {
    expect(hexToHsl("#ff0000").h).toBeCloseTo(0, 0);
    expect(Math.round(hexToHsl("#ffffff").l)).toBe(100);
    expect(Math.round(hexToHsl("#000000").l)).toBe(0);
  });
});

describe("withLightness / shiftLightness", () => {
  it("sets an absolute lightness", () => {
    expect(Math.round(hexToHsl(withLightness("#2f8f83", 90)).l)).toBe(90);
  });

  it("clamps shifts to the valid range", () => {
    expect(shiftLightness("#ffffff", 20)).toBe("#ffffff");
    expect(shiftLightness("#000000", -20)).toBe("#000000");
  });
});

describe("isLight / readableTextOn", () => {
  it("classifies obvious light and dark colors", () => {
    expect(isLight("#ffffff")).toBe(true);
    expect(isLight("#121212")).toBe(false);
  });

  it("returns dark text on light backgrounds and vice versa", () => {
    expect(readableTextOn("#ffffff")).toBe("#1b1b1f");
    expect(readableTextOn("#121212")).toBe("#e3e3e8");
  });
});
