/**
 * Read side of the bridge: reconstruct the semantic graph from the scene's
 * Live State, and summarize user-drawn (non-bridge) content so the agent
 * knows what the image snapshot will show.
 */

import type { AgentElementData, AgentGraph } from "./types";

/** The minimal element shape graph extraction needs (keeps tests DOM-free). */
export interface SceneElementLike {
  type: string;
  customData?: Record<string, unknown> | null;
  text?: string;
  containerId?: string | null;
}

export function agentDataOf(element: SceneElementLike): AgentElementData | null {
  const data = element.customData?.lousa as AgentElementData | undefined;
  return data && ["agent-node", "agent-edge", "agent-group"].includes(data.kind) ? data : null;
}

export function isAgentElement(element: SceneElementLike): boolean {
  if (agentDataOf(element)) return true;
  // Label text elements are bound to a bridge container/arrow and carry no
  // customData of their own; they are identified by their container's id.
  return Boolean(element.containerId?.startsWith("lousa-"));
}

export function extractGraph(elements: readonly SceneElementLike[]): AgentGraph {
  const graph: AgentGraph = { nodes: [], edges: [], groups: [] };
  for (const element of elements) {
    const data = agentDataOf(element);
    if (!data) continue;
    if (data.kind === "agent-node") graph.nodes.push(data.node);
    else if (data.kind === "agent-edge") graph.edges.push(data.edge);
    else graph.groups.push(data.group);
  }
  return graph;
}

export interface UserContentSummary {
  shapeCounts: Record<string, number>;
  /** Text the user wrote on the canvas — high-signal context for the agent. */
  texts: string[];
}

const MAX_TEXTS = 50;

export function summarizeUserContent(elements: readonly SceneElementLike[]): UserContentSummary {
  const summary: UserContentSummary = { shapeCounts: {}, texts: [] };
  for (const element of elements) {
    if (isAgentElement(element)) continue;
    summary.shapeCounts[element.type] = (summary.shapeCounts[element.type] ?? 0) + 1;
    if (element.text && summary.texts.length < MAX_TEXTS) summary.texts.push(element.text);
  }
  return summary;
}

/** Derive a unique lowercase slug id, e.g. "Auth Service" -> "auth-service". */
export function slugId(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "node";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
