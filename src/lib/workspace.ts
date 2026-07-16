/**
 * IPC wrappers for workspace (file-tree) operations. Rust owns all file I/O and
 * native dialogs (ADR-0003); this module is the only place the frontend touches
 * those commands.
 */

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type EntryKind = "dir" | "document" | "note";

export interface Entry {
  name: string;
  path: string;
  kind: EntryKind;
}

export interface DirListing {
  path: string;
  entries: Entry[];
}

export function readWorkspaceDir(path: string): Promise<DirListing> {
  return invoke<DirListing>("read_workspace_dir", { path });
}

// A Note is not a Document (CONTEXT.md), so it gets its own vocabulary over
// the same generic Rust text-file primitives that `document.ts` wraps.
export function readNote(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export function saveNote(path: string, contents: string): Promise<void> {
  return invoke<void>("save_text_file", { path, contents });
}

export function newNote(dir: string): Promise<string> {
  return invoke<string>("new_note", { dir });
}

export function renamePath(from: string, to: string): Promise<void> {
  return invoke<void>("rename_path", { from, to });
}

export function deletePath(path: string): Promise<void> {
  return invoke<void>("delete_path", { path });
}

export async function pickWorkspaceFolder(): Promise<string | null> {
  return await open({ directory: true });
}

/** Last path segment, splitting on both POSIX (/) and Windows (\) separators. */
export function basename(p: string): string {
  const segments = p.split(/[/\\]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : p;
}

/** Everything before the last separator (the parent directory of `p`). */
export function dirname(p: string): string {
  const sep = p.includes("\\") ? "\\" : "/";
  const idx = p.lastIndexOf(sep);
  return idx > 0 ? p.slice(0, idx) : sep;
}

/** Join `name` onto `dir` using whatever separator `dir` already uses (\ if present, else /). */
export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}
