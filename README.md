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

## AI agents — draw on the Canvas from Claude Code or Codex

Lousa ships an **Agent Bridge** (ADR-0011/0012): an MCP server that lets an AI
agent read your live Canvas and draw system-design diagrams onto it — typed
nodes, bound arrows, auto-layout — while you watch. Every AI change set can be
reverted with one click.

### Claude Code (plugin, `/lousa`)

```sh
claude plugin marketplace add joaomarqu3ss/lousa
claude plugin install lousa@lousa
```

Then, with the Lousa app open:

```
/lousa draw the architecture of a URL shortener with a cache and click analytics
```

The plugin registers the MCP server automatically (it runs `lousa --mcp`, so
the `lousa` binary must be on your PATH — the Linux packages install it to
`/usr/bin`; on Windows add the install folder to PATH, or register the server
manually as below).

### Codex — or any MCP client

Register the stdio server (path shown in Lousa under **Settings → Agent
Bridge**, with copy buttons):

```toml
# ~/.codex/config.toml
[mcp_servers.lousa]
command = "lousa"
args = ["--mcp"]
```

For a `/lousa` prompt in Codex, save a prompt file at
`~/.codex/prompts/lousa.md` telling the agent to read the canvas first and use
the Lousa tools (see [`claude-plugin/skills/lousa/SKILL.md`](./claude-plugin/skills/lousa/SKILL.md)
for a template).

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
