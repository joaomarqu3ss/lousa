/** Pure helpers for the window title and document file naming. */

export function documentBaseName(path: string | null): string {
  if (!path) return "Untitled";
  // Handle both / (Linux) and \ (Windows) separators.
  return path.split(/[\\/]/).pop() || "Untitled";
}

export function windowTitle(path: string | null, dirty: boolean): string {
  return `${dirty ? "● " : ""}${documentBaseName(path)} — Lousa`;
}

/** Save dialogs don't reliably append the extension on every OS — do it ourselves. */
export function ensureExcalidrawExtension(path: string): string {
  return path.toLowerCase().endsWith(".excalidraw") ? path : `${path}.excalidraw`;
}
