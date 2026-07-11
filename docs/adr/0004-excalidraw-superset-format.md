# Documents are .excalidraw files; Live State rides in customData

Documents are saved as standard `.excalidraw` JSON, with each Module Element's Live State stored in the element's `customData` field — Excalidraw's documented per-element extension point. Files therefore open in vanilla Excalidraw (Module output degrades gracefully to its baked visual), while Lousa reads `customData` back to restore re-editable Modules. This avoids owning a bespoke container format and its versioning/migration tax from day one.

## Considered options

- **Plain .excalidraw, bake-only** — perfect interop, but Module output is forever a static picture; rejected because re-editability is the point of a study platform.
- **Custom container format (e.g. `.study`)** — fully owned and future-proof, but sacrifices interop and takes on migrations immediately. If `customData` ever proves fragile, the superset degrades cleanly into this option: wrap the same JSON in our own container.

## Consequences

- v1 ships before any Module exists, so v1 writes vanilla `.excalidraw` with no `customData`.
- We depend on Excalidraw preserving `customData` through its restore cycle; a regression there triggers the container-format fallback.
