# Theme is an app-wide preference, resolved from the native OS signal

The light/dark theme is a tri-state application preference — `system` (follow the OS), `light`, or `dark` — persisted in `localStorage` and applied by driving Excalidraw's controlled `theme` prop. Even though Excalidraw stores `theme` inside a document's `appState`, Lousa treats it as a property of the app, not the document: opening a file keeps the current preference rather than adopting whatever theme the file was saved in. When the preference is `system`, the concrete theme is resolved from Tauri's native window theme (`theme()` + `onThemeChanged`), not CSS `prefers-color-scheme`.

## Considered options

- **Per-document theme (Excalidraw default)** — free, but a study platform's chrome flickering between light and dark as the user opens different files is jarring; theme is a workspace preference, not document content. Rejected.
- **CSS `prefers-color-scheme` for OS detection** — standard on the web, but unreliable under WebKitGTK on Linux (the same renderer we already work around in the shell), so the native Tauri signal is authoritative on every platform.
- **Excalidraw's built-in `ToggleTheme` (light/dark flip)** — evaluated as the UI control (its `allowSystemTheme` mode offers the same tri-state), but the control now lives in Lousa's own Settings dialog (ADR-0009) so all theme configuration sits in one discoverable place rather than buried in Excalidraw's menu; resolution and persistence are ours regardless.

## Consequences

- Pure resolution/persistence lives in `src/lib/theme.ts` (unit-tested); the OS side effects live in the `useTheme` hook.
- A document still serializes whatever `theme` it happens to hold; that value is ignored on open, so no migration is needed.
- The Lousa "chalk teal" accent is layered on top by re-tinting Excalidraw's `--color-primary` variable family in `App.css`, independent of this decision.
