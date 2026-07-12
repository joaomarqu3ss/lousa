import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { normalizeHex } from "../lib/color";
import { DEFAULT_PALETTE } from "../lib/palette";
import type { CustomTheme } from "../lib/customTheme";
import type { CustomThemeControl } from "../lib/useCustomTheme";
import type { ThemeControl } from "../lib/useTheme";

const MODES: { value: ThemeControl["preference"]; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const CHANNELS: { key: keyof CustomTheme; label: string; hint: string }[] = [
  { key: "accent", label: "Accent", hint: "Selected tools, active buttons, highlights" },
  { key: "background", label: "Background", hint: "Toolbars, menus and panels" },
  { key: "text", label: "Text", hint: "Interface labels and menu text" },
];

/** Swatch shown for a channel that hasn't been customized, per active mode. */
function channelDefault(key: keyof CustomTheme, dark: boolean): string {
  return DEFAULT_PALETTE[dark ? "dark" : "light"][key];
}

interface ColorFieldProps {
  label: string;
  hint: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
}

function ColorField({ label, hint, value, fallback, onChange }: ColorFieldProps) {
  const current = value ?? fallback;
  return (
    <div className="settings-color">
      <div className="settings-color__meta">
        <span className="settings-color__label">{label}</span>
        <span className="settings-color__hint">{hint}</span>
      </div>
      <div className="settings-color__controls">
        <input
          type="color"
          aria-label={`${label} color`}
          value={current}
          onChange={(e) => onChange(normalizeHex(e.target.value))}
        />
        <input
          type="text"
          className="settings-color__hex"
          aria-label={`${label} hex value`}
          value={current}
          spellCheck={false}
          onChange={(e) => {
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
        />
        <button
          type="button"
          className="settings-color__default"
          disabled={value === null}
          onClick={() => onChange(null)}
        >
          Default
        </button>
      </div>
    </div>
  );
}

/** One copyable configuration line with visual copied feedback. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="settings-copy">
      <span className="settings-copy__label">{label}</span>
      <code className="settings-copy__value">{value}</code>
      <button
        type="button"
        className="settings-copy__button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function AgentBridgeSection() {
  const [binaryPath, setBinaryPath] = useState<string | null>(null);
  useEffect(() => {
    void invoke<string>("mcp_binary_path").then(setBinaryPath, () => setBinaryPath(""));
  }, []);
  if (binaryPath === null) return null;
  const command = binaryPath || "lousa";
  const mcpJson = JSON.stringify({ mcpServers: { lousa: { command, args: ["--mcp"] } } });
  return (
    <section className="settings-section">
      <h3>Agent Bridge</h3>
      <p className="settings-note-text">
        Let an AI agent (Claude Code, Codex) read this Canvas and draw system designs onto it.
        Register Lousa as an MCP server — Lousa must be open while the agent works, and every AI
        change set can be reverted from the banner.
      </p>
      <CopyRow label="Claude Code" value={`claude mcp add lousa -- "${command}" --mcp`} />
      <CopyRow label="JSON config" value={mcpJson} />
    </section>
  );
}

interface SettingsPanelProps {
  theme: ThemeControl;
  customTheme: CustomThemeControl;
  onClose: () => void;
}

export function SettingsPanel({ theme, customTheme, onClose }: SettingsPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on open, restore it to the trigger on close, and
  // let Escape close from anywhere.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const dark = theme.resolved === "dark";
  const { custom, setChannel, reset } = customTheme;

  return (
    <div className="settings-backdrop" onPointerDown={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="settings-header">
          <h2>Settings</h2>
          <button
            type="button"
            className="settings-close"
            aria-label="Close settings"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="settings-modes" role="radiogroup" aria-label="Theme mode">
            {MODES.map((m) => (
              <label key={m.value}>
                <input
                  type="radio"
                  name="lousa-theme-mode"
                  checked={theme.preference === m.value}
                  onChange={() => theme.setPreference(m.value)}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__head">
            <h3>Interface colors</h3>
            <button type="button" className="settings-reset" onClick={reset}>
              Reset all
            </button>
          </div>
          {CHANNELS.map((c) => (
            <ColorField
              key={c.key}
              label={c.label}
              hint={c.hint}
              value={custom[c.key]}
              fallback={channelDefault(c.key, dark)}
              onChange={(value) => setChannel(c.key, value)}
            />
          ))}
        </section>

        <AgentBridgeSection />

        <section className="settings-section settings-note">
          <h3>Canvas colors</h3>
          <p>
            To recolor an element on the Canvas, select it and use the <strong>Stroke</strong> and{" "}
            <strong>Background</strong> swatches in the left panel. Set the page color from the
            menu&apos;s <strong>Canvas background</strong>.
          </p>
        </section>
      </div>
    </div>
  );
}
