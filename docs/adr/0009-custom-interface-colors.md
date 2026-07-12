# Custom interface colors derive Excalidraw's variables, injected as one style tag

Users can recolor Lousa's own chrome by picking three base colors — Accent, Background, Text — in the Settings dialog. Rather than expose Excalidraw's ~30 UI variables directly, each base color is expanded by color math (`src/lib/color.ts`) into the full variable family it drives (`src/lib/customTheme.ts`): an accent becomes the `--color-primary` family, a background becomes the surface/island/input family, text becomes the on-surface family. The result is serialized to CSS targeting both `.excalidraw` and `.excalidraw.theme--dark` and written into a single managed `<style>` element in `<head>`, so edits restyle the UI live and override both the stock and chalk-teal defaults by source order — without Lousa ever reaching into the DOM Excalidraw owns.

## Considered options

- **Expose every Excalidraw variable individually** — maximal control, but incoherent (users would have to hand-tune a dozen related shades) and tightly coupled to Excalidraw's internal variable set. Rejected in favor of three semantic knobs.
- **Fork/patch Excalidraw's theme** — rejected by ADR-0001 (embed, don't fork); the CSS-variable surface is Excalidraw's supported theming seam.
- **Per-mode custom colors (separate light and dark pickers)** — more precise but doubles the UI; instead one picked color is auto-adjusted per mode (accent legibility) or applied to both (background/text), with auto-contrast text so a dark custom background never keeps dark text.

## Consequences

- Custom colors are an app-wide preference (localStorage), consistent with the theme mode (ADR-0008); a channel left unset still follows light/dark per mode.
- Drawing content colors are unaffected — those remain Excalidraw's native per-element Stroke/Background and Canvas background controls, which the Settings dialog points users to.
- Derivation is approximate, not pixel-perfect; "Reset all" and per-channel "Default" always restore the built-in look.
