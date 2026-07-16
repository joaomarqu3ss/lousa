import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  IoAddOutline,
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoColorPaletteOutline,
  IoDocumentTextOutline,
  IoFolderOpenOutline,
  IoFolderOutline,
  IoPencilOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { readWorkspaceDir, type Entry, type EntryKind } from "../lib/workspace";
import "./workspace.css";

export interface SidebarProps {
  root: string | null; // workspace root; null = none open
  activePath: string | null; // open file, to highlight
  collapsed: boolean;
  refreshToken?: number; // change it to force a re-read (after create/rename/delete)
  onToggleCollapsed: () => void;
  onOpenFolder: () => void;
  onOpenFile: (entry: Entry) => void; // clicked a note/document
  onNewNote: (dir: string) => void;
  onRename: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
}

const KIND_ICON: Record<EntryKind, ReactNode> = {
  dir: <IoFolderOutline />,
  note: <IoDocumentTextOutline />,
  document: <IoColorPaletteOutline />,
};

/** A directory we cannot read simply lists as empty rather than breaking the
 *  whole tree (the app resets a vanished workspace root separately). */
function readDirOrEmpty(path: string): Promise<Entry[]> {
  return readWorkspaceDir(path).then(
    (listing) => listing.entries,
    () => [],
  );
}

/**
 * Minimizable workspace file-tree. Owns its own expansion/listing state and
 * reads directories lazily: the top level on mount and whenever `root` changes,
 * and a directory's children the first time it is expanded. Bumping
 * `refreshToken` re-reads the root and every still-expanded directory so newly
 * created, renamed or deleted files appear.
 */
export function Sidebar({
  root,
  activePath,
  collapsed,
  refreshToken,
  onToggleCollapsed,
  onOpenFolder,
  onOpenFile,
  onNewNote,
  onRename,
  onDelete,
}: SidebarProps) {
  // Cache of directory path -> its listed entries. The root's entries live under
  // `entriesByDir[root]`; a missing key means "not loaded yet".
  const [entriesByDir, setEntriesByDir] = useState<Record<string, Entry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Live mirrors so callbacks and the effect can read the latest values without
  // re-subscribing (and re-running the reader) on every keystroke of state.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const entriesByDirRef = useRef(entriesByDir);
  entriesByDirRef.current = entriesByDir;
  const prevRootRef = useRef<string | null>(null);

  const loadDir = useCallback(async (path: string) => {
    const entries = await readDirOrEmpty(path);
    setEntriesByDir((prev) => ({ ...prev, [path]: entries }));
  }, []);

  // Load the root on mount / when it changes, and re-read the root plus every
  // still-expanded directory whenever `refreshToken` changes.
  useEffect(() => {
    if (root === null) {
      prevRootRef.current = null;
      setExpanded(new Set());
      setEntriesByDir({});
      return;
    }

    const rootChanged = prevRootRef.current !== root;
    prevRootRef.current = root;
    if (rootChanged) setExpanded(new Set());

    const dirs = rootChanged ? [root] : [root, ...expandedRef.current];

    let cancelled = false;
    void Promise.all(
      dirs.map((dir) => readDirOrEmpty(dir).then((entries) => [dir, entries] as const)),
    ).then((results) => {
      if (cancelled) return;
      setEntriesByDir((prev) => {
        const next = rootChanged ? {} : { ...prev };
        for (const [dir, entries] of results) next[dir] = entries;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [root, refreshToken]);

  const toggleDir = useCallback(
    (path: string) => {
      const willExpand = !expandedRef.current.has(path);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (willExpand) next.add(path);
        else next.delete(path);
        return next;
      });
      // Lazy-load children the first time this directory is opened.
      if (willExpand && entriesByDirRef.current[path] === undefined) {
        void loadDir(path);
      }
    },
    [loadDir],
  );

  function renderDir(dirPath: string, depth: number): ReactNode {
    const entries = entriesByDir[dirPath];
    const indent = { paddingLeft: `${8 + depth * 14}px` };

    if (entries === undefined) {
      return (
        <li className="workspace-tree__hint" style={indent}>
          Loading…
        </li>
      );
    }
    if (entries.length === 0) {
      return (
        <li className="workspace-tree__hint" style={indent}>
          {depth === 0 ? "This folder is empty" : "Empty"}
        </li>
      );
    }

    return entries.map((entry) => {
      const isDir = entry.kind === "dir";
      const isExpanded = isDir && expanded.has(entry.path);
      const isActive = entry.path === activePath;
      return (
        <li key={entry.path} className="workspace-tree__item">
          <div className="workspace-row-wrap">
            <button
              type="button"
              className={"workspace-row" + (isActive ? " workspace-row--active" : "")}
              style={indent}
              title={entry.name}
              aria-expanded={isDir ? isExpanded : undefined}
              onClick={() => (isDir ? toggleDir(entry.path) : onOpenFile(entry))}
            >
              <span className="workspace-row__caret" aria-hidden="true">
                {isDir ? (isExpanded ? "▾" : "▸") : ""}
              </span>
              <span className="workspace-row__icon" aria-hidden="true">
                {KIND_ICON[entry.kind]}
              </span>
              <span className="workspace-row__name">{entry.name}</span>
            </button>
            <span className="workspace-row__actions">
              {isDir ? (
                <button
                  type="button"
                  className="workspace-row__action"
                  aria-label={`New note in ${entry.name}`}
                  title="New note here"
                  onClick={() => onNewNote(entry.path)}
                >
                  <IoAddOutline />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="workspace-row__action"
                    aria-label={`Rename ${entry.name}`}
                    title="Rename"
                    onClick={() => onRename(entry)}
                  >
                    <IoPencilOutline />
                  </button>
                  <button
                    type="button"
                    className="workspace-row__action"
                    aria-label={`Delete ${entry.name}`}
                    title="Delete"
                    onClick={() => onDelete(entry)}
                  >
                    <IoTrashOutline />
                  </button>
                </>
              )}
            </span>
          </div>
          {isExpanded && (
            <ul className="workspace-tree__children">{renderDir(entry.path, depth + 1)}</ul>
          )}
        </li>
      );
    });
  }

  // One <aside> for both states so collapsing animates: the width transition
  // clips the fixed-width body (a slide, not a squish) while the expand
  // affordance cross-fades in. CSS keeps the hidden side unfocusable.
  return (
    <aside className={"workspace-sidebar" + (collapsed ? " workspace-sidebar--collapsed" : "")}>
      <button
        type="button"
        className="workspace-sidebar__expand"
        aria-label="Expand sidebar"
        title="Expand sidebar"
        onClick={onToggleCollapsed}
      >
        <IoChevronForwardOutline />
      </button>

      <div className="workspace-sidebar__body">
        <div className="workspace-sidebar__header">
          <span className="workspace-sidebar__title">Workspace</span>
          <div className="workspace-sidebar__actions">
            <button
              type="button"
              aria-label="Open folder"
              title="Open folder"
              onClick={onOpenFolder}
            >
              <IoFolderOpenOutline />
            </button>
            <button
              type="button"
              aria-label="New note"
              title="New note"
              disabled={root === null}
              onClick={() => root !== null && onNewNote(root)}
            >
              <IoAddOutline />
            </button>
            <button
              type="button"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={onToggleCollapsed}
            >
              <IoChevronBackOutline />
            </button>
          </div>
        </div>

        {root === null ? (
          <div className="workspace-empty">
            <p className="workspace-empty__text">No folder open</p>
            <button type="button" className="workspace-empty__button" onClick={onOpenFolder}>
              <IoFolderOpenOutline />
              Open folder
            </button>
          </div>
        ) : (
          <ul className="workspace-tree">{renderDir(root, 0)}</ul>
        )}
      </div>
    </aside>
  );
}
