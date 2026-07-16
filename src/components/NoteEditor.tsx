import "./workspace.css";

export interface NoteEditorProps {
  content: string;
  onChange: (next: string) => void;
}

/**
 * Placeholder note editor. Issue #7 replaces the internals with a CodeMirror 6
 * markdown editor and live preview; for now it is a plain controlled textarea.
 */
export function NoteEditor({ content, onChange }: NoteEditorProps) {
  return (
    <div className="note-editor">
      <textarea
        className="note-editor__textarea"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label="Note content"
      />
      <span className="note-editor__hint" aria-hidden="true">
        live preview coming in #7
      </span>
    </div>
  );
}
