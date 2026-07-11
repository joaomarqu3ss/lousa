/**
 * IPC wrappers for document file operations. Rust owns all file I/O and
 * native dialogs (ADR-0003); this module is the only place the frontend
 * touches those commands.
 */

import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ensureExcalidrawExtension } from "./title";

const FILTERS = [{ name: "Excalidraw document", extensions: ["excalidraw"] }];

export function readDocument(path: string): Promise<string> {
  return invoke<string>("read_document", { path });
}

export function saveDocument(path: string, contents: string): Promise<void> {
  return invoke<void>("save_document", { path, contents });
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
