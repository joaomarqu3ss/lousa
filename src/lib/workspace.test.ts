import { describe, expect, it } from "vitest";
import { basename, dirname, joinPath } from "./workspace";

describe("basename", () => {
  it("extracts the file name from a Linux path", () => {
    expect(basename("/home/me/notes/auth.md")).toBe("auth.md");
  });

  it("extracts the file name from a Windows path", () => {
    expect(basename("C:\\Users\\me\\auth.md")).toBe("auth.md");
  });

  it("ignores a trailing separator", () => {
    expect(basename("/home/me/notes/")).toBe("notes");
  });

  it("returns the input when there is no separator", () => {
    expect(basename("auth.md")).toBe("auth.md");
  });
});

describe("dirname", () => {
  it("returns the parent of a Linux path", () => {
    expect(dirname("/home/me/notes/auth.md")).toBe("/home/me/notes");
  });

  it("returns the parent of a Windows path", () => {
    expect(dirname("C:\\Users\\me\\auth.md")).toBe("C:\\Users\\me");
  });

  it("returns the root for a file directly under it", () => {
    expect(dirname("/auth.md")).toBe("/");
  });
});

describe("joinPath", () => {
  it("joins with / for a Linux directory", () => {
    expect(joinPath("/home/me/notes", "auth.md")).toBe("/home/me/notes/auth.md");
  });

  it("joins with \\ for a Windows directory", () => {
    expect(joinPath("C:\\Users\\me", "auth.md")).toBe("C:\\Users\\me\\auth.md");
  });

  it("does not double a trailing separator", () => {
    expect(joinPath("/home/me/notes/", "auth.md")).toBe("/home/me/notes/auth.md");
  });

  it("round-trips with dirname and basename", () => {
    const path = "/home/me/notes/auth.md";
    expect(joinPath(dirname(path), basename(path))).toBe(path);
  });
});
