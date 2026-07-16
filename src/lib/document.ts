/**
 * IPC wrappers for Document file operations. Rust owns all file I/O and native
 * dialogs (ADR-0003); its `read_text_file`/`save_text_file` commands are
 * generic primitives that each frontend module wraps in its own domain
 * vocabulary — Documents here, Notes in `workspace.ts` (CONTEXT.md language).
 */

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ensureExcalidrawExtension } from "./title";

const FILTERS = [{ name: "Excalidraw document", extensions: ["excalidraw"] }];

export function readDocument(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export function saveDocument(path: string, contents: string): Promise<void> {
  return invoke<void>("save_text_file", { path, contents });
}

export async function pickOpenPath(): Promise<string | null> {
  return await open({ multiple: false, filters: FILTERS });
}

export async function pickSavePath(currentPath: string | null): Promise<string | null> {
  const picked = await save({
    defaultPath: currentPath ?? "untitled.excalidraw",
    filters: FILTERS,
  });
  return picked === null ? null : ensureExcalidrawExtension(picked);
}
