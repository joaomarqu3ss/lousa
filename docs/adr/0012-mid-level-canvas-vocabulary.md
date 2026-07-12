# Agents read and write the Canvas through a mid-level node/edge vocabulary

The Agent Bridge (ADR-0011) exposes neither raw Excalidraw geometry nor a full diagramming engine, but a **mid-level vocabulary of typed nodes and labeled connections**. The agent creates a `service` / `datastore` / `queue` / `external` / `boundary` / `note` node with a label (the `type` is an open string, so it can go off-palette), and connects nodes with directed, optionally-labeled edges (sync solid / async dashed). **Lousa owns coordinates**: it runs an elkjs layered auto-layout in the webview (TypeScript, ADR-0003), binds arrows with Excalidraw's native shape-binding so they reflow when nodes move, and places a freshly generated graph in an empty region found by scanning the current Canvas bounding boxes so it never lands on existing user work. Every element the agent creates stores its node/edge **Live State in `customData`** (ADR-0004), so the diagram reads back as a clean graph, re-edits, and round-trips. When the agent reads the Canvas it receives **both** this structured graph **and** a rendered PNG snapshot (via the existing export pipeline), so a vision model can also perceive freehand human sketches that carry no structure and formalize them.

## Considered options

- **Raw Excalidraw primitives** (rectangle/text/arrow at explicit x,y) — least to build, but the agent must compute all layout, output is misaligned, and elements carry no Live State — the dead-picture outcome ADR-0004 exists to reject.
- **A full semantic graph Module** with a rich typed palette and its own layout/routing engine — best fidelity, but a large domain Module; the mid-level vocabulary captures most of the value as platform capability, and a dedicated Module can grow on top later.

## Consequences

- The agent never sets coordinates; layout quality is Lousa's responsibility, which keeps the agent's attention on design rather than geometry.
- The node `type` being an open string lets the palette grow without a schema migration; unknown types get default styling.
- Reading returns structure + image, so both "author from scratch" and "formalize my sketch" workflows are supported.
