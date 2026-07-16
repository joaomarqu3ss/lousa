import { useState } from "react";
import "./workspace.css";

export interface RenameDialogProps {
  /** Current file name, used as the input's starting value. */
  name: string;
  onCancel: () => void;
  /** Called with the trimmed new name; only fires when it passes validation. */
  onSubmit: (name: string) => void;
}

/**
 * Modal prompting for a new file name. Rejects empty names and path
 * separators (a separator would silently move the file elsewhere in — or out
 * of — the workspace tree). Extension and collision policy stay with the
 * caller: the parent preserves the original extension and Rust refuses to
 * overwrite an existing target.
 */
export function RenameDialog({ name, onCancel, onSubmit }: RenameDialogProps) {
  const [value, setValue] = useState(name);
  const trimmed = value.trim();
  const error =
    trimmed.length === 0
      ? "Name cannot be empty."
      : /[/\\]/.test(trimmed)
        ? "Name cannot contain / or \\."
        : null;

  const submit = () => {
    if (!error) onSubmit(trimmed);
  };

  return (
    <div className="settings-backdrop" onClick={onCancel}>
      <div className="rename-modal" onClick={(e) => e.stopPropagation()}>
        <label className="rename-modal__label" htmlFor="rename-input">
          Rename
        </label>
        <input
          id="rename-input"
          className="rename-modal__input"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            else if (e.key === "Escape") onCancel();
          }}
        />
        {error && <p className="rename-modal__error">{error}</p>}
        <div className="rename-modal__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rename-modal__confirm"
            disabled={error !== null}
            onClick={submit}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
