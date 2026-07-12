/**
 * Write side of the bridge: turn the semantic graph + elk layout into real
 * Excalidraw elements via the skeleton API. Element ids are deterministic
 * (`lousa-node-<id>` etc., with regenerateIds: false) so rebuilds replace
 * elements in place, and every element carries its Live State (ADR-0004).
 */

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { AgentGraph } from "./types";
import type { DiagramLayout, LayoutBox } from "./layout";

type NodeStyle = {
  shape: "rectangle" | "ellipse" | "diamond";
  backgroundColor: string;
  strokeColor: string;
  strokeStyle?: "solid" | "dashed";
  rounded?: boolean;
};

const NODE_STYLES: Record<string, NodeStyle> = {
  service: {
    shape: "rectangle",
    backgroundColor: "#a5d8ff",
    strokeColor: "#1971c2",
    rounded: true,
  },
  datastore: { shape: "ellipse", backgroundColor: "#b2f2bb", strokeColor: "#2f9e44" },
  queue: { shape: "diamond", backgroundColor: "#ffec99", strokeColor: "#f08c00" },
  external: {
    shape: "rectangle",
    backgroundColor: "transparent",
    strokeColor: "#868e96",
    strokeStyle: "dashed",
  },
  note: { shape: "rectangle", backgroundColor: "#fff9db", strokeColor: "#e6a23c" },
  // Same look as a group boundary (ADR-0012 lists it in the vocabulary);
  // the group tool is the preferred way to get one around existing nodes.
  boundary: {
    shape: "rectangle",
    backgroundColor: "transparent",
    strokeColor: "#868e96",
    strokeStyle: "dashed",
  },
};

const DEFAULT_STYLE: NodeStyle = {
  shape: "rectangle",
  backgroundColor: "#e9ecef",
  strokeColor: "#495057",
  rounded: true,
};

export const nodeElementId = (id: string) => `lousa-node-${id}`;
export const groupElementId = (id: string) => `lousa-group-${id}`;
export const edgeElementId = (id: string) => `lousa-edge-${id}`;

const center = (box: LayoutBox) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

export function materialize(
  graph: AgentGraph,
  layout: DiagramLayout,
  origin: { x: number; y: number },
) {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  const placed = (box: LayoutBox): LayoutBox => ({
    ...box,
    x: box.x + origin.x,
    y: box.y + origin.y,
  });

  // Z-order is skeleton order: boundaries behind nodes, arrows on top.
  for (const group of graph.groups) {
    const box = layout.groups.get(group.id);
    if (!box) continue;
    const { x, y, width, height } = placed(box);
    skeletons.push({
      type: "rectangle",
      id: groupElementId(group.id),
      x,
      y,
      width,
      height,
      backgroundColor: "transparent",
      strokeColor: "#868e96",
      strokeStyle: "dashed",
      label: { text: group.label, verticalAlign: "top", fontSize: 16 },
      customData: { lousa: { kind: "agent-group", group } },
    });
  }

  for (const node of graph.nodes) {
    const box = layout.nodes.get(node.id);
    if (!box) continue;
    const style = NODE_STYLES[node.type] ?? DEFAULT_STYLE;
    const { x, y, width, height } = placed(box);
    skeletons.push({
      type: style.shape,
      id: nodeElementId(node.id),
      x,
      y,
      width,
      height,
      backgroundColor: style.backgroundColor,
      strokeColor: style.strokeColor,
      strokeStyle: style.strokeStyle ?? "solid",
      strokeWidth: 2,
      roundness: style.rounded ? { type: 3 } : null,
      label: { text: node.label, fontSize: 20 },
      customData: { lousa: { kind: "agent-node", node } },
    });
  }

  const boxOf = (id: string) => layout.nodes.get(id) ?? layout.groups.get(id);
  const elementIdOf = (id: string) =>
    layout.nodes.has(id) ? nodeElementId(id) : groupElementId(id);

  for (const edge of graph.edges) {
    const fromBox = boxOf(edge.from);
    const toBox = boxOf(edge.to);
    if (!fromBox || !toBox) continue;
    const from = center(placed(fromBox));
    const to = center(placed(toBox));
    skeletons.push({
      type: "arrow",
      id: edgeElementId(edge.id),
      x: from.x,
      y: from.y,
      points: [
        [0, 0],
        [to.x - from.x, to.y - from.y],
      ],
      strokeColor: "#343a40",
      strokeStyle: edge.kind === "async" ? "dashed" : "solid",
      start: { id: elementIdOf(edge.from) },
      end: { id: elementIdOf(edge.to) },
      ...(edge.label ? { label: { text: edge.label, fontSize: 16 } } : {}),
      customData: { lousa: { kind: "agent-edge", edge } },
    } as ExcalidrawElementSkeleton);
  }

  return convertToExcalidrawElements(skeletons, { regenerateIds: false });
}
