# Embed @excalidraw/excalidraw rather than fork it

The Canvas is the official `@excalidraw/excalidraw` React package, embedded as a component and treated as an upstream dependency. We deliberately do not fork the Excalidraw codebase or build our own canvas: Lousa's value lives in the native shell and the study Modules around the Canvas, not in canvas internals, and a fork would trade years of upstream rendering/interaction work for a permanent maintenance burden.

## Consequences

- The package's public API is a hard boundary; features that require patching Excalidraw internals are out of bounds by default (see ADR-0002 for how Modules cope with this).
- Excalidraw's brand is not ours: the app is named Lousa.
- Excalidraw fetches fonts/assets from a CDN by default; a desktop app must bundle them locally or it breaks offline.
