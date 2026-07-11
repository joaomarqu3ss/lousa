import { describe, expect, it } from "vitest";
import { documentBaseName, ensureExcalidrawExtension, windowTitle } from "./title";

describe("documentBaseName", () => {
  it("returns Untitled for an unsaved document", () => {
    expect(documentBaseName(null)).toBe("Untitled");
  });

  it("extracts the file name from a Linux path", () => {
    expect(documentBaseName("/home/me/notes/physics.excalidraw")).toBe("physics.excalidraw");
  });

  it("extracts the file name from a Windows path", () => {
    expect(documentBaseName("C:\\Users\\me\\physics.excalidraw")).toBe("physics.excalidraw");
  });
});

describe("windowTitle", () => {
  it("marks unsaved changes with a bullet", () => {
    expect(windowTitle(null, true)).toBe("● Untitled — Lousa");
  });

  it("shows the clean document name", () => {
    expect(windowTitle("/tmp/a.excalidraw", false)).toBe("a.excalidraw — Lousa");
  });
});

describe("ensureExcalidrawExtension", () => {
  it("appends the extension when missing", () => {
    expect(ensureExcalidrawExtension("/tmp/notes")).toBe("/tmp/notes.excalidraw");
  });

  it("keeps an existing extension, case-insensitively", () => {
    expect(ensureExcalidrawExtension("/tmp/a.excalidraw")).toBe("/tmp/a.excalidraw");
    expect(ensureExcalidrawExtension("/tmp/a.EXCALIDRAW")).toBe("/tmp/a.EXCALIDRAW");
  });
});
