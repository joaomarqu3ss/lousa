# Modules are independent tools that place results onto the Canvas

Study tools (function plotter, geometry, …) are independent Modules that run in their own UI beside the Canvas and push their output onto it as ordinary canvas elements — they are neither live interactive widgets embedded in the canvas, nor disconnected sibling tools in a suite. This hybrid keeps everything composing on one surface without betting the platform on Excalidraw's limited custom-element internals.

## Considered options

- **Live on-canvas widgets** — the most magical product, but requires fighting Excalidraw's renderer and element model. May be adopted later per-Module where it proves worth the pain; never a platform-wide bet.
- **Separate sibling tools** — simplest, but results never compose on one surface, which defeats the point of a whiteboard platform.

## Consequences

- Module output is re-editable only by round-tripping through its Live State (ADR-0004), not by direct on-canvas manipulation.
- Each Module must be buildable and testable in isolation from the Canvas.
