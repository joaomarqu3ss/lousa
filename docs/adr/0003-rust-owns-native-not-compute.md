# Rust owns native OS work, not computation — until a Module proves otherwise

The Rust backend's job is native OS integration: file I/O with atomic saves, native dialogs, and vector PDF export (ADR-0005). All Module computation (plotting, geometry, simulation) stays in TypeScript in the webview, next to the Canvas that renders it — pushing math through IPC would add latency and serialization overhead for no benefit at today's workloads. The IPC command layer is structured so a compute-heavy Module can add Rust commands cheaply the day one provably needs them.
