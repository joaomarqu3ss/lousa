<p align="center">
  <img src="assets/logo.svg" width="120" alt="Lousa logo" />
</p>

<h1 align="center">Lousa</h1>

<p align="center">
  An extensible study &amp; whiteboard desktop app — an infinite Excalidraw
  canvas as the floor, with domain tools built on top.
</p>

---

Lousa wraps the [Excalidraw](https://github.com/excalidraw/excalidraw) canvas in
a native desktop shell (Tauri 2 + React) and grows it into a platform for many
fields of study — from freehand sketching to plotting equations on the Cartesian
plane. The whiteboard is the floor, not the ceiling.

## Status

**v1 — native whiteboard.** A proper native document editor for `.excalidraw`
files: draw, open/save with native dialogs, and export. Study modules (the
function plotter first) land in M2. See [issue #1](https://github.com/joaomarqu3ss/lousa/issues/1)
for the full v1 scope.

## Stack

- **Tauri 2** — Rust backend, system webview, Windows + Linux (macOS later)
- **React 19 + TypeScript** (Vite, pnpm) — embeds `@excalidraw/excalidraw`, fully offline
- Rust owns native work: file I/O with atomic saves, and vector PDF export

The architecture and its rationale live in [`CONTEXT.md`](./CONTEXT.md) and
[`docs/adr/`](./docs/adr).

## Develop

```sh
pnpm install
pnpm tauri dev
```

Prerequisites: Node 22+, pnpm, the Rust toolchain, and the
[Tauri system dependencies](https://tauri.app/start/prerequisites/) for your OS.

## Build

```sh
pnpm tauri build
```

Produces installers per OS: NSIS (Windows); AppImage, `.deb`, and `.rpm` (Linux).

## License

The Excalidraw canvas is MIT-licensed by the Excalidraw team. Lousa is a distinct
application and is not affiliated with or endorsed by Excalidraw.
