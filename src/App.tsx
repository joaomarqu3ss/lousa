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
import { windowTitle } from "./lib/title";
import "@excalidraw/excalidraw/index.css";
import "./App.css";

function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Scene version of the last saved (or freshly loaded/empty) state.
  const savedVersion = useRef(0);
  // Close-guard listener must see the current dirty flag without re-subscribing.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

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

  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true;
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

  const openDocument = useCallback(async () => {
    if (!api || !(await confirmDiscard())) return;
    const path = await pickOpenPath();
    if (!path) return;
    try {
      const contents = await readDocument(path);
      const restored = await loadFromBlob(
        new Blob([contents], { type: "application/json" }),
        null,
        null,
      );
      api.updateScene({ elements: restored.elements, appState: restored.appState });
      api.addFiles(Object.values(restored.files ?? {}));
      api.history.clear();
      setFilePath(path);
      markClean();
    } catch (err) {
      reportError("Open failed", err);
    }
  }, [api, confirmDiscard, markClean, reportError]);

  const newDocument = useCallback(async () => {
    if (!api || !(await confirmDiscard())) return;
    api.resetScene();
    setFilePath(null);
    markClean();
  }, [api, confirmDiscard, markClean]);

  // Native window title reflects the document and its dirty state.
  useEffect(() => {
    void getCurrentWindow().setTitle(windowTitle(filePath, dirty));
  }, [filePath, dirty]);

  // Guard the native close button against unsaved changes.
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (dirtyRef.current && !(await confirmDiscard())) event.preventDefault();
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
        void (event.shiftKey ? saveAs() : save());
      } else if (key === "o") {
        event.preventDefault();
        event.stopPropagation();
        void openDocument();
      } else if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        void newDocument();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [save, saveAs, openDocument, newDocument]);

  return (
    <div className="canvas-root">
      <Excalidraw
        excalidrawAPI={setApi}
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
          <MainMenu.DefaultItems.ToggleTheme />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}

export default App;
