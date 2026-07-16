import { useCallback, useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  MainMenu,
  getSceneVersion,
  loadFromBlob,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { pickOpenPath, pickSavePath, readDocument, saveDocument } from "./lib/document";
import {
  basename,
  deletePath,
  dirname,
  joinPath,
  newNote,
  pickWorkspaceFolder,
  readNote,
  readWorkspaceDir,
  renamePath,
  saveNote,
  type Entry,
} from "./lib/workspace";
import { exportScene } from "./lib/export";
import { windowTitle } from "./lib/title";
import { useTheme } from "./lib/useTheme";
import { useCustomTheme } from "./lib/useCustomTheme";
import { useAgentBridge } from "./lib/agentBridge/useAgentBridge";
import { SettingsPanel } from "./components/SettingsPanel";
import { RenameDialog } from "./components/RenameDialog";
import { Sidebar } from "./components/Sidebar";
import { EditorTabs, type TabItem } from "./components/EditorTabs";
import { NoteEditor } from "./components/NoteEditor";
import "@excalidraw/excalidraw/index.css";
import "./App.css";

const CANVAS_KEY = "canvas";
const WORKSPACE_STORAGE_KEY = "lousa_workspace";

const gearIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    width="16"
    height="16"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/** An open Note tab. The file on disk is the source of truth; `savedContent`
 *  mirrors it so `content !== savedContent` is the tab's dirty flag. */
interface NoteTab {
  path: string;
  content: string;
  savedContent: string;
}

const isNoteDirty = (t: NoteTab) => t.content !== t.savedContent;

function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Workspace + tabs.
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(() =>
    localStorage.getItem(WORKSPACE_STORAGE_KEY),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [noteTabs, setNoteTabs] = useState<NoteTab[]>([]);
  const [activeKey, setActiveKey] = useState<string>(CANVAS_KEY);
  const [renaming, setRenaming] = useState<Entry | null>(null);

  const theme = useTheme();
  const customTheme = useCustomTheme();
  const bridge = useAgentBridge(api);
  // Stable identity (useCallback in the hook) — safe as an effect dependency.
  const dropCheckpoint = bridge.keep;

  const isCanvasActive = activeKey === CANVAS_KEY;
  const activeNote = noteTabs.find((t) => t.path === activeKey) ?? null;

  // Scene version of the last saved (or freshly loaded/empty) Canvas state.
  const savedVersion = useRef(0);
  // Close-guard/shortcut listeners must see the latest dirty flags without
  // re-subscribing, so mirror them into refs each render.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const anyDirty = dirty || noteTabs.some(isNoteDirty);
  const anyDirtyRef = useRef(anyDirty);
  anyDirtyRef.current = anyDirty;

  const currentVersion = useCallback(
    () => (api ? getSceneVersion(api.getSceneElementsIncludingDeleted()) : 0),
    [api],
  );

  const markClean = useCallback(() => {
    savedVersion.current = currentVersion();
    setDirty(false);
  }, [currentVersion]);

  const reportError = useCallback(
    (message: string, err: unknown) => {
      api?.setToast({ message: `${message}: ${String(err)}`, closable: true, duration: 5000 });
    },
    [api],
  );

  // Asks the user to confirm discarding unsaved work. Callers gate on their own
  // dirty flag (the Canvas tab, a Note tab, or any tab for the window close).
  const confirmDiscard = useCallback(async () => {
    return await ask("There are unsaved changes. Discard them?", {
      title: "Lousa",
      kind: "warning",
    });
  }, []);

  const writeScene = useCallback(
    async (path: string) => {
      if (!api) return false;
      const contents = serializeAsJSON(
        api.getSceneElements(),
        api.getAppState(),
        api.getFiles(),
        "local",
      );
      try {
        await saveDocument(path, contents);
      } catch (err) {
        reportError("Save failed", err);
        return false;
      }
      markClean();
      return true;
    },
    [api, markClean, reportError],
  );

  const saveAs = useCallback(async () => {
    const path = await pickSavePath(filePath);
    if (!path) return false;
    const ok = await writeScene(path);
    if (ok) setFilePath(path);
    return ok;
  }, [filePath, writeScene]);

  const save = useCallback(
    async () => (filePath ? writeScene(filePath) : saveAs()),
    [filePath, writeScene, saveAs],
  );

  // Load an .excalidraw document into the single, always-mounted Canvas.
  const loadCanvasFromPath = useCallback(
    async (path: string) => {
      if (!api) return;
      try {
        const contents = await readDocument(path);
        const restored = await loadFromBlob(
          new Blob([contents], { type: "application/json" }),
          null,
          null,
        );
        // Theme is an app-wide preference (ADR-0008), not a document property —
        // keep the current one instead of adopting whatever the file was saved in.
        api.updateScene({
          elements: restored.elements,
          appState: { ...restored.appState, theme: theme.resolved },
        });
        api.addFiles(Object.values(restored.files ?? {}));
        api.history.clear();
        setFilePath(path);
        markClean();
        // A checkpoint belongs to the Canvas it snapshotted — never let Revert
        // inject a previous Document's elements into this one.
        dropCheckpoint();
      } catch (err) {
        reportError("Open failed", err);
      }
    },
    [api, markClean, reportError, theme.resolved, dropCheckpoint],
  );

  const openDocument = useCallback(async () => {
    if (!api || (dirtyRef.current && !(await confirmDiscard()))) return;
    const path = await pickOpenPath();
    if (!path) return;
    await loadCanvasFromPath(path);
    setActiveKey(CANVAS_KEY);
  }, [api, confirmDiscard, loadCanvasFromPath]);

  const newDocument = useCallback(async () => {
    if (!api || (dirtyRef.current && !(await confirmDiscard()))) return;
    api.resetScene();
    setFilePath(null);
    markClean();
    dropCheckpoint(); // same reason as loadCanvasFromPath
    setActiveKey(CANVAS_KEY);
  }, [api, confirmDiscard, markClean, dropCheckpoint]);

  const runExport = useCallback(
    async (format: "svg" | "png" | "jpeg" | "pdf") => {
      if (!api) return;
      try {
        const path = await exportScene(api, format);
        if (path) {
          api.setToast({ message: `Exported ${format.toUpperCase()}`, duration: 3000 });
        }
      } catch (err) {
        reportError(`${format.toUpperCase()} export failed`, err);
      }
    },
    [api, reportError],
  );

  // --- Notes -------------------------------------------------------------

  const openNote = useCallback(
    async (path: string) => {
      if (noteTabs.some((t) => t.path === path)) {
        setActiveKey(path);
        return;
      }
      try {
        const content = await readNote(path);
        setNoteTabs((prev) =>
          prev.some((t) => t.path === path)
            ? prev
            : [...prev, { path, content, savedContent: content }],
        );
        setActiveKey(path);
      } catch (err) {
        reportError("Open note failed", err);
      }
    },
    [noteTabs, reportError],
  );

  const handleOpenFile = useCallback(
    async (entry: Entry) => {
      if (entry.kind === "note") {
        await openNote(entry.path);
      } else if (entry.kind === "document") {
        if (dirtyRef.current && !(await confirmDiscard())) return;
        await loadCanvasFromPath(entry.path);
        setActiveKey(CANVAS_KEY);
      }
    },
    [openNote, confirmDiscard, loadCanvasFromPath],
  );

  const updateActiveNote = useCallback(
    (next: string) => {
      setNoteTabs((prev) => prev.map((t) => (t.path === activeKey ? { ...t, content: next } : t)));
    },
    [activeKey],
  );

  const saveActiveNote = useCallback(async () => {
    const note = noteTabs.find((t) => t.path === activeKey);
    if (!note) return false;
    try {
      await saveNote(note.path, note.content);
      setNoteTabs((prev) =>
        prev.map((t) => (t.path === note.path ? { ...t, savedContent: note.content } : t)),
      );
      return true;
    } catch (err) {
      reportError("Save note failed", err);
      return false;
    }
  }, [noteTabs, activeKey, reportError]);

  // Ctrl+S saves whatever tab is active — the Canvas or the current Note.
  const saveActive = useCallback(
    async () => (isCanvasActive ? save() : saveActiveNote()),
    [isCanvasActive, save, saveActiveNote],
  );

  const closeTab = useCallback(
    async (key: string) => {
      if (key === CANVAS_KEY) return; // the Canvas is always present.
      const note = noteTabs.find((t) => t.path === key);
      if (note && isNoteDirty(note) && !(await confirmDiscard())) return;
      setNoteTabs((prev) => prev.filter((t) => t.path !== key));
      setActiveKey((k) => (k === key ? CANVAS_KEY : k));
    },
    [noteTabs, confirmDiscard],
  );

  // --- Workspace file operations ----------------------------------------

  const handleOpenFolder = useCallback(async () => {
    const dir = await pickWorkspaceFolder();
    if (dir) setWorkspaceRoot(dir);
  }, []);

  const handleNewNote = useCallback(
    async (dir: string) => {
      try {
        const path = await newNote(dir);
        setRefreshToken((n) => n + 1);
        await openNote(path);
      } catch (err) {
        reportError("New note failed", err);
      }
    },
    [openNote, reportError],
  );

  const handleDelete = useCallback(
    async (entry: Entry) => {
      const ok = await ask(`Delete ${entry.name}? This cannot be undone.`, {
        title: "Lousa",
        kind: "warning",
      });
      if (!ok) return;
      try {
        await deletePath(entry.path);
        setNoteTabs((prev) => prev.filter((t) => t.path !== entry.path));
        setActiveKey((k) => (k === entry.path ? CANVAS_KEY : k));
        if (entry.path === filePath) setFilePath(null);
        setRefreshToken((n) => n + 1);
      } catch (err) {
        reportError("Delete failed", err);
      }
    },
    [filePath, reportError],
  );

  const commitRename = useCallback(
    async (rawName: string) => {
      if (!renaming) return;
      // Keep the original extension: without it the file would fall out of the
      // workspace filter (.md/.excalidraw) while its tab stayed open.
      const dot = renaming.name.lastIndexOf(".");
      const ext = dot > 0 ? renaming.name.slice(dot) : "";
      const name =
        ext && !rawName.toLowerCase().endsWith(ext.toLowerCase()) ? rawName + ext : rawName;
      if (name === renaming.name) {
        setRenaming(null);
        return;
      }
      const to = joinPath(dirname(renaming.path), name);
      try {
        await renamePath(renaming.path, to);
        setNoteTabs((prev) => prev.map((t) => (t.path === renaming.path ? { ...t, path: to } : t)));
        setActiveKey((k) => (k === renaming.path ? to : k));
        if (renaming.path === filePath) setFilePath(to);
        setRefreshToken((n) => n + 1);
      } catch (err) {
        reportError("Rename failed", err);
      } finally {
        setRenaming(null);
      }
    },
    [renaming, filePath, reportError],
  );

  // --- Effects -----------------------------------------------------------

  // Remember the open workspace across launches.
  useEffect(() => {
    if (workspaceRoot) localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceRoot);
    else localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  }, [workspaceRoot]);

  // A remembered workspace can vanish between launches; fall back to the
  // "no folder open" state instead of showing a phantom empty tree.
  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    readWorkspaceDir(workspaceRoot).catch(() => {
      if (!cancelled) setWorkspaceRoot(null);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  // Native window title reflects the active tab and its dirty state.
  useEffect(() => {
    const path = isCanvasActive ? filePath : activeKey;
    const isDirty = isCanvasActive ? dirty : activeNote ? isNoteDirty(activeNote) : false;
    void getCurrentWindow().setTitle(windowTitle(path, isDirty));
  }, [isCanvasActive, filePath, activeKey, dirty, activeNote]);

  // Excalidraw is display:none while a Note tab is active; nudge it to
  // re-measure its container the moment the Canvas tab is shown again.
  useEffect(() => {
    if (!isCanvasActive) return;
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, [isCanvasActive]);

  // Guard the native close button against unsaved changes in ANY tab.
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (anyDirtyRef.current && !(await confirmDiscard())) event.preventDefault();
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [confirmDiscard]);

  // File shortcuts, capture-phase so they win over Excalidraw's own bindings.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        event.stopPropagation();
        void (event.shiftKey && isCanvasActive ? saveAs() : saveActive());
      } else if (key === "o") {
        event.preventDefault();
        event.stopPropagation();
        void openDocument();
      } else if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        void newDocument();
      } else if (key === ",") {
        event.preventDefault();
        event.stopPropagation();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [saveActive, saveAs, openDocument, newDocument, isCanvasActive]);

  const tabs: TabItem[] = [
    {
      key: CANVAS_KEY,
      label: filePath ? basename(filePath) : "Canvas",
      dirty,
      closable: false,
    },
    ...noteTabs.map((t) => ({
      key: t.path,
      label: basename(t.path),
      dirty: isNoteDirty(t),
      closable: true,
    })),
  ];

  return (
    <div className={`app-shell theme-${theme.resolved}`}>
      <Sidebar
        root={workspaceRoot}
        activePath={isCanvasActive ? filePath : activeKey}
        collapsed={sidebarCollapsed}
        refreshToken={refreshToken}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        onOpenFolder={handleOpenFolder}
        onOpenFile={handleOpenFile}
        onNewNote={handleNewNote}
        onRename={setRenaming}
        onDelete={handleDelete}
      />

      <div className="workspace-main">
        <EditorTabs
          tabs={tabs}
          activeKey={activeKey}
          onActivate={setActiveKey}
          onClose={closeTab}
        />

        <div className="workspace-content">
          {/* Always mounted; hidden (not unmounted) when a Note tab is active. */}
          <div className="workspace-canvas" style={{ display: isCanvasActive ? "block" : "none" }}>
            <Excalidraw
              excalidrawAPI={setApi}
              theme={theme.resolved}
              onChange={() => setDirty(currentVersion() !== savedVersion.current)}
            >
              <MainMenu>
                <MainMenu.Item onSelect={() => void newDocument()} shortcut="Ctrl+N">
                  New
                </MainMenu.Item>
                <MainMenu.Item onSelect={() => void openDocument()} shortcut="Ctrl+O">
                  Open…
                </MainMenu.Item>
                <MainMenu.Item onSelect={() => void save()} shortcut="Ctrl+S">
                  Save
                </MainMenu.Item>
                <MainMenu.Item onSelect={() => void saveAs()} shortcut="Ctrl+Shift+S">
                  Save As…
                </MainMenu.Item>
                <MainMenu.Separator />
                <MainMenu.Group title="Export">
                  <MainMenu.Item onSelect={() => void runExport("svg")}>Export SVG…</MainMenu.Item>
                  <MainMenu.Item onSelect={() => void runExport("png")}>
                    Export PNG (high-res)…
                  </MainMenu.Item>
                  <MainMenu.Item onSelect={() => void runExport("jpeg")}>
                    Export JPEG (high-res)…
                  </MainMenu.Item>
                  <MainMenu.Item onSelect={() => void runExport("pdf")}>Export PDF…</MainMenu.Item>
                </MainMenu.Group>
                <MainMenu.Separator />
                <MainMenu.DefaultItems.ChangeCanvasBackground />
                <MainMenu.Item
                  icon={gearIcon}
                  onSelect={() => setSettingsOpen(true)}
                  shortcut="Ctrl+,"
                >
                  Settings…
                </MainMenu.Item>
              </MainMenu>
            </Excalidraw>
          </div>

          {activeNote && (
            <div className="workspace-note">
              <NoteEditor content={activeNote.content} onChange={updateActiveNote} />
            </div>
          )}
        </div>
      </div>

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          customTheme={customTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {bridge.revertAvailable && (
        <div className="agent-banner" role="status">
          <span>AI changed the Canvas</span>
          <button type="button" onClick={bridge.revert}>
            Revert AI changes
          </button>
          <button type="button" className="agent-banner-keep" onClick={bridge.keep}>
            Keep
          </button>
        </div>
      )}

      {renaming && (
        <RenameDialog
          name={renaming.name}
          onCancel={() => setRenaming(null)}
          onSubmit={(name) => void commitRename(name)}
        />
      )}
    </div>
  );
}

export default App;
