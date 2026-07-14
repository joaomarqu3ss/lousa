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
import { exportScene } from "./lib/export";
import { windowTitle } from "./lib/title";
import { useTheme } from "./lib/useTheme";
import { useCustomTheme } from "./lib/useCustomTheme";
import { useAgentBridge } from "./lib/agentBridge/useAgentBridge";
import { SettingsPanel } from "./components/SettingsPanel";
import ReactMarkdown from "react-markdown";
import "@excalidraw/excalidraw/index.css";
import "./App.css";

const gearIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

interface Note {
  id: string;
  title: string;
  content: string;
}

function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"quadro" | "notas">("quadro");
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem("lousa_notas");
    return saved ? JSON.parse(saved) : [
      { 
        id: "1", 
        title: "Explicação Arquitetura", 
        content: "# Arquitetura do Sistema 🚀\n\nUse este espaço para explicar como os sistemas funcionam.\n\n## Componentes Principais:\n- **Frontend**: Desenvolvido em React e Vite.\n- **Backend**: Feito em Rust com Tauri para alto desempenho." 
      }
    ];
  });
  const [selectedNoteId, setSelectedNoteId] = useState<string>("1");

  const theme = useTheme();
  const customTheme = useCustomTheme();
  const bridge = useAgentBridge(api);
  const dropCheckpoint = bridge.keep;

  const savedVersion = useRef(0);
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

  // 1. Declaramos o confirmDiscard primeiro
  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true;
    return await ask("There are unsaved changes. Discard them?", {
      title: "Lousa",
      kind: "warning",
    });
  }, []);

  // 2. Agora o openDocument (com confirmDiscard mapeado e dependência adicionada)
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
      api.updateScene({
        elements: restored.elements,
        appState: { ...restored.appState, theme: theme.resolved },
      });
      api.addFiles(Object.values(restored.files ?? {}));
      api.history.clear();
      setFilePath(path);
      markClean();
      dropCheckpoint();
    } catch (err) {
      reportError("Open failed", err);
    }
  }, [api, markClean, reportError, theme.resolved, dropCheckpoint, confirmDiscard]);

  // 3. E o newDocument (com confirmDiscard mapeado e dependência adicionada)
  const newDocument = useCallback(async () => {
    if (!api || !(await confirmDiscard())) return;
    api.resetScene();
    setFilePath(null);
    markClean();
    dropCheckpoint();
  }, [api, markClean, dropCheckpoint, confirmDiscard]);

  // 4. E o runExport segue normalmente abaixo deles
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

  useEffect(() => {
    void getCurrentWindow().setTitle(windowTitle(filePath, dirty));
  }, [filePath, dirty]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (dirtyRef.current && !(await confirmDiscard())) event.preventDefault();
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [confirmDiscard]);

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
      } else if (key === ",") {
        event.preventDefault();
        event.stopPropagation();
        setSettingsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [save, saveAs, openDocument, newDocument]);

  useEffect(() => {
    localStorage.setItem("lousa_notas", JSON.stringify(notes));
  }, [notes]);

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const createNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "Nova Nota " + (notes.length + 1),
      content: "# Nova Nota\nComece a editar em Markdown!"
    };
    setNotes([...notes, newNote]);
    setSelectedNoteId(newNote.id);
  };

  const updateNoteContent = (newContent: string) => {
    setNotes(notes.map(note => {
      if (note.id === selectedNoteId) {
        const firstLine = newContent.trim().split("\n")[0] || "";
        const cleanTitle = firstLine.replace(/[#*`]/g, "").trim() || "Nota sem título";
        return { ...note, content: newContent, title: cleanTitle };
      }
      return note;
    }));
  };

  const exportarNotaComoArquivo = async () => {
    if (!selectedNote) return;
    const path = await pickSavePath(selectedNote.title.toLowerCase().replace(/\s+/g, "_") + ".md");
    if (!path) return;
    try {
      await saveDocument(path, selectedNote.content);
      api?.setToast({ message: "Nota exportada com sucesso!", duration: 3000 });
    } catch (err) {
      reportError("Erro ao exportar nota", err);
    }
  };

  const isDark = theme.resolved === "dark";
  const bgColor = isDark ? "#121214" : "#ffffff";
  const sidebarColor = isDark ? "#1a1a1e" : "#f4f4f5";
  const textColor = isDark ? "#ffffff" : "#000000";
  const borderColor = isDark ? "#2d2d34" : "#e4e4e7";

  return (
    <div className="canvas-root" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ 
        display: "flex", 
        gap: "10px", 
        padding: "10px", 
        backgroundColor: isDark ? "#1e1e24" : "#e4e4e7", 
        borderBottom: `1px solid ${isDark ? "#2d2d34" : "#d4d4d8"}` 
      }}>
        <button 
          onClick={() => setActiveTab("quadro")}
          style={{ 
            padding: "8px 16px", 
            background: activeTab === "quadro" ? (isDark ? "#3f3f46" : "#cbd5e1") : "transparent", 
            color: isDark ? "#fff" : "#000", 
            border: `1px solid ${isDark ? "#52525b" : "#cbd5e1"}`, 
            borderRadius: "6px", 
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          🎨 Quadro
        </button>
        <button 
          onClick={() => setActiveTab("notas")}
          style={{ 
            padding: "8px 16px", 
            background: activeTab === "notas" ? (isDark ? "#3f3f46" : "#cbd5e1") : "transparent", 
            color: isDark ? "#fff" : "#000", 
            border: `1px solid ${isDark ? "#52525b" : "#cbd5e1"}`, 
            borderRadius: "6px", 
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          📝 Notas Markdown
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {activeTab === "quadro" ? (
          <Excalidraw
            excalidrawAPI={setApi}
            theme={theme.resolved}
            onChange={() => setDirty(currentVersion() !== savedVersion.current)}
          >
            <MainMenu>
              <MainMenu.Item onSelect={() => void newDocument()} shortcut="Ctrl+N">New</MainMenu.Item>
              <MainMenu.Item onSelect={() => void openDocument()} shortcut="Ctrl+O">Open…</MainMenu.Item>
              <MainMenu.Item onSelect={() => void save()} shortcut="Ctrl+S">Save</MainMenu.Item>
              <MainMenu.Item onSelect={() => void saveAs()} shortcut="Ctrl+Shift+S">Save As…</MainMenu.Item>
              <MainMenu.Separator />
              <MainMenu.Group title="Export">
                <MainMenu.Item onSelect={() => void runExport("svg")}>Export SVG…</MainMenu.Item>
                <MainMenu.Item onSelect={() => void runExport("png")}>Export PNG (high-res)…</MainMenu.Item>
                <MainMenu.Item onSelect={() => void runExport("jpeg")}>Export JPEG (high-res)…</MainMenu.Item>
                <MainMenu.Item onSelect={() => void runExport("pdf")}>Export PDF…</MainMenu.Item>
              </MainMenu.Group>
              <MainMenu.Separator />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
              <MainMenu.Item icon={gearIcon} onSelect={() => setSettingsOpen(true)} shortcut="Ctrl+,">Settings…</MainMenu.Item>
            </MainMenu>
          </Excalidraw>
        ) : (
          <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: bgColor, color: textColor }}>
            <div style={{ width: "230px", backgroundColor: sidebarColor, borderRight: `1px solid ${borderColor}`, display: "flex", flexDirection: "column", padding: "10px" }}>
              <button 
                onClick={createNewNote}
                style={{ padding: "10px", backgroundColor: "#6366f1", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginBottom: "10px" }}
              >
                ➕ Nova Nota
              </button>

              <button 
                onClick={exportarNotaComoArquivo}
                style={{ padding: "10px", backgroundColor: "#10b981", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", marginBottom: "15px" }}
              >
                💾 Salvar Arquivo .md
              </button>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "5px" }}>
                {notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    style={{
                      padding: "10px",
                      borderRadius: "4px",
                      backgroundColor: note.id === selectedNoteId ? (isDark ? "#2d2d34" : "#e4e4e7") : "transparent",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    📄 {note.title}
                  </div>
                ))}
              </div>
            </div>

            {selectedNote ? (
              <div style={{ flex: 1, display: "flex", gap: "15px", padding: "15px" }}>
                <textarea
                  value={selectedNote.content}
                  onChange={(e) => updateNoteContent(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? "#1a1a1e" : "#f9fafb",
                    color: textColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: "8px",
                    padding: "15px",
                    fontFamily: "monospace",
                    fontSize: "14px",
                    resize: "none",
                    outline: "none"
                  }}
                />

                <div style={{
                  flex: 1,
                  backgroundColor: isDark ? "#1a1a1e" : "#ffffff",
                  border: `1px solid ${borderColor}`,
                  borderRadius: "8px",
                  padding: "15px",
                  overflowY: "auto"
                }}>
                  <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flex: 1, color: "#888" }}>
                Selecione ou crie uma nota para começar.
              </div>
            )}
          </div>
        )}
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
          <button type="button" onClick={bridge.revert}>Revert AI changes</button>
          <button type="button" className="agent-banner-keep" onClick={bridge.keep}>Keep</button>
        </div>
      )}
    </div>
  );
}

export default App;