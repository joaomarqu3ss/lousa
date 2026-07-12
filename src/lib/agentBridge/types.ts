/**
 * Agent Bridge vocabulary (ADR-0012): the mid-level graph an external agent
 * reads and writes. Each canvas element the bridge creates carries its slice
 * of this graph as Live State in `customData.lousa` (ADR-0004), so the
 * diagram survives save/reopen and reads back without any in-memory store.
 */

/** Palette types get distinct visuals; any other string renders default. */
export type NodeType = "service" | "datastore" | "queue" | "external" | "note" | (string & {});

export interface AgentNode {
  id: string;
  type: NodeType;
  label: string;
  /** Longer explanation stored but not painted; returned by read_canvas. */
  description?: string;
}

export interface AgentEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** sync renders solid, async dashed. */
  kind: "sync" | "async";
}

export interface AgentGroup {
  id: string;
  label: string;
  /** Node ids inside the boundary; a node belongs to at most one group. */
  members: string[];
}

export interface AgentGraph {
  nodes: AgentNode[];
  edges: AgentEdge[];
  groups: AgentGroup[];
}

/** What `customData.lousa` holds on an element created by the bridge. */
export type AgentElementData =
  | { kind: "agent-node"; node: AgentNode }
  | { kind: "agent-edge"; edge: AgentEdge }
  | { kind: "agent-group"; group: AgentGroup };

export const EMPTY_GRAPH: AgentGraph = { nodes: [], edges: [], groups: [] };
