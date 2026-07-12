/**
 * Layout side of the bridge: the agent never places anything (ADR-0012) —
 * elkjs computes positions from the graph alone. Groups become compound elk
 * nodes so members lay out inside their boundary.
 */

import type { ElkNode } from "elkjs/lib/elk.bundled.js";
import type { AgentGraph } from "./types";

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramLayout {
  nodes: Map<string, LayoutBox>;
  groups: Map<string, LayoutBox>;
}

const NODE_HEIGHT = 72;
const CHAR_WIDTH = 10; // generous estimate for the hand-drawn font at 20px
const NODE_MIN_WIDTH = 150;
const NODE_MAX_WIDTH = 340;

export function nodeSize(label: string): { width: number; height: number } {
  const width = Math.min(NODE_MAX_WIDTH, Math.max(NODE_MIN_WIDTH, 48 + label.length * CHAR_WIDTH));
  return { width, height: NODE_HEIGHT };
}

const ROOT_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "48",
  "elk.layered.spacing.nodeNodeBetweenLayers": "110",
  // Edges may cross group boundaries, so elk must layout the hierarchy as one.
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
};

// Room at the top of a boundary for its label.
const GROUP_PADDING = "[top=64,left=32,bottom=32,right=32]";

/** Pure graph -> elk input mapping, exported for tests. */
export function buildElkGraph(graph: AgentGraph): ElkNode {
  const grouped = new Set(graph.groups.flatMap((group) => group.members));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const toElkNode = (id: string): ElkNode => {
    const node = graph.nodes.find((candidate) => candidate.id === id);
    return { id, ...nodeSize(node?.label ?? id) };
  };
  const children: ElkNode[] = [
    ...graph.groups.map((group) => ({
      id: group.id,
      layoutOptions: { "elk.padding": GROUP_PADDING },
      children: group.members.filter((member) => nodeIds.has(member)).map(toElkNode),
    })),
    ...graph.nodes.filter((node) => !grouped.has(node.id)).map((node) => toElkNode(node.id)),
  ];
  return {
    id: "root",
    layoutOptions: ROOT_OPTIONS,
    children,
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to],
    })),
  };
}

/** Flatten elk's nested relative coordinates into absolute boxes (for tests). */
export function flattenElkResult(root: ElkNode, graph: AgentGraph): DiagramLayout {
  const groupIds = new Set(graph.groups.map((group) => group.id));
  const layout: DiagramLayout = { nodes: new Map(), groups: new Map() };
  const walk = (node: ElkNode, dx: number, dy: number) => {
    for (const child of node.children ?? []) {
      const box: LayoutBox = {
        x: (child.x ?? 0) + dx,
        y: (child.y ?? 0) + dy,
        width: child.width ?? 0,
        height: child.height ?? 0,
      };
      (groupIds.has(child.id) ? layout.groups : layout.nodes).set(child.id, box);
      walk(child, box.x, box.y);
    }
  };
  walk(root, 0, 0);
  return layout;
}

// elkjs is ~1.4MB and only needed once an agent actually draws — load it
// lazily so it stays out of the startup path (and startup module graph).
let elkModule: Promise<typeof import("elkjs/lib/elk.bundled.js")> | null = null;

export async function layoutGraph(graph: AgentGraph): Promise<DiagramLayout> {
  elkModule ??= import("elkjs/lib/elk.bundled.js");
  const { default: ELK } = await elkModule;
  const elk = new ELK();
  const result = await elk.layout(buildElkGraph(graph));
  return flattenElkResult(result, graph);
}
