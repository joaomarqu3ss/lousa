# The Agent Bridge exposes the live Canvas to external agents over MCP

Lousa ships an **Agent Bridge**: a platform capability (not a Module) that exposes the running Document's Canvas to an external AI agent — Claude Code, Codex, Claude Desktop — through a Model Context Protocol server. The intelligence stays in the user's own agent and subscription; Lousa manages no API keys and carries no model cost. Transport is **stdio bridged to a local socket**: the Lousa binary invoked as `lousa --mcp` runs as the MCP stdio proxy the agent spawns, and forwards each call to the running app over a Unix domain socket (named pipe on Windows). The Rust backend owns the socket (native I/O, ADR-0003) and bridges each tool call into the webview, where TypeScript reads and mutates the Excalidraw scene. There is no network port and no auth token — nothing is listening for other local processes or web pages to reach — and if no Lousa app is open, tool calls fail cleanly. The agent has full write authority over the Canvas, made safe the way IDE coding agents are: Lousa snapshots the scene before an agent turn's first write (a **Checkpoint**) and offers "Revert AI changes" to restore it atomically, while each step also feeds Excalidraw's native undo.

## Considered options

- **HTTP/SSE port on loopback with an auth token** — the MCP-standard remote shape, but opens a network port that holds full Canvas authority; rejected for a stdio/socket bridge that is never network-reachable and needs no token.
- **Headless file-based server over `.excalidraw` files, no running app** — CI-friendly and app-independent, but loses the live-watching moment and cannot see unsaved freehand work; may return later as a second transport over the same vocabulary.
- **In-app assistant calling the Claude API directly** — makes Lousa own keys and model cost; deferred in favor of riding the user's existing agent, and can layer on later over the same read/write layer.

## Consequences

- The Agent Bridge requires the app to be open; it operates on the live Document, not files.
- Read and write both go through the mid-level Canvas vocabulary (ADR-0012), so agent output is re-editable Live State, not a baked picture.
- The bridge adds Rust IPC commands but no computation, honoring ADR-0003.
