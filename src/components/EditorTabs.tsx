import "./workspace.css";

export interface TabItem {
  key: string;
  label: string;
  dirty: boolean;
  closable: boolean;
}

export interface EditorTabsProps {
  tabs: TabItem[];
  activeKey: string;
  onActivate: (key: string) => void;
  onClose: (key: string) => void;
}

/**
 * Presentational tab strip. Renders labels only — it does not own or render the
 * editors themselves; the parent maps the active key to a view.
 */
export function EditorTabs({ tabs, activeKey, onActivate, onClose }: EditorTabsProps) {
  return (
    <div className="editor-tabs" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            className={"editor-tab" + (isActive ? " editor-tab--active" : "")}
            title={tab.label}
            onClick={() => onActivate(tab.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(tab.key);
              }
            }}
          >
            {tab.dirty && (
              <span className="editor-tab__dirty" aria-label="Unsaved changes">
                ●
              </span>
            )}
            <span className="editor-tab__label">{tab.label}</span>
            {tab.closable && (
              <button
                type="button"
                className="editor-tab__close"
                aria-label={`Close ${tab.label}`}
                title="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.key);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
