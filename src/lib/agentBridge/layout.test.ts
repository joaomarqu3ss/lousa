import { describe, expect, it } from "vitest";
import { buildElkGraph, layoutGraph, nodeSize } from "./layout";
import type { AgentGraph } from "./types";

const graph: AgentGraph = {
  nodes: [
    { id: "web", type: "service", label: "Web" },
    { id: "api", type: "service", label: "API" },
    { id: "db", type: "datastore", label: "Postgres" },
  ],
  edges: [
    { id: "web-to-api", from: "web", to: "api", kind: "sync" },
    { id: "api-to-db", from: "api", to: "db", kind: "sync" },
  ],
  groups: [{ id: "backend", label: "Backend", members: ["api", "db"] }],
};

describe("buildElkGraph", () => {
  it("nests grouped nodes under their boundary and keeps the rest at root", () => {
    const elk = buildElkGraph(graph);
    const ids = (elk.children ?? []).map((child) => child.id);
    expect(ids).toEqual(["backend", "web"]);
    const backend = elk.children?.find((child) => child.id === "backend");
    expect(backend?.children?.map((child) => child.id)).toEqual(["api", "db"]);
    expect(elk.edges).toHaveLength(2);
  });

  it("sizes nodes from their label", () => {
    expect(nodeSize("DB").width).toBe(150); // clamped to minimum
    expect(nodeSize("A very long service name indeed").width).toBeGreaterThan(150);
  });
});

describe("layoutGraph", () => {
  it("returns non-overlapping absolute boxes with members inside their group", async () => {
    const layout = await layoutGraph(graph);
    expect(layout.nodes.size).toBe(3);
    const backend = layout.groups.get("backend")!;
    for (const member of ["api", "db"]) {
      const box = layout.nodes.get(member)!;
      expect(box.x).toBeGreaterThanOrEqual(backend.x);
      expect(box.y).toBeGreaterThanOrEqual(backend.y);
      expect(box.x + box.width).toBeLessThanOrEqual(backend.x + backend.width);
      expect(box.y + box.height).toBeLessThanOrEqual(backend.y + backend.height);
    }
    // Flow direction is RIGHT: web feeds api, so web sits left of api.
    expect(layout.nodes.get("web")!.x).toBeLessThan(layout.nodes.get("api")!.x);
  });

  it("lays out an empty graph without exploding", async () => {
    const layout = await layoutGraph({ nodes: [], edges: [], groups: [] });
    expect(layout.nodes.size).toBe(0);
  });
});
