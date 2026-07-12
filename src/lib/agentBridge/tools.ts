/**
 * Tool handlers for the Agent Bridge. The catalog (names, schemas,
 * descriptions) lives in src-tauri/src/mcp/tools.rs — keep both in sync.
 * Results are MCP tool-result shaped so Rust can pass them through verbatim.
 */

import { CaptureUpdateAction, exportToBlob, getCommonBounds } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { blobToBase64 } from "../export";
import { extractGraph, isAgentElement, slugId, summarizeUserContent } from "./graph";
import { layoutGraph } from "./layout";
import { materialize } from "./materialize";
import type { AgentGraph } from "./types";

export type ToolContent =
  { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

export interface DispatchHooks {
  /** Called before any scene mutation — the checkpoint hook (ADR-0011). */
  beforeMutation: () => void;
}

type Args = Record<string, unknown>;

/** Longest edge of the PNG snapshot sent to the agent. */
const SNAPSHOT_MAX_DIM = 1600;
const PLACEMENT_GAP = 96;

const text = (value: unknown): ToolResult => ({
  content: [
    { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
  ],
});

function str(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requiredStr(args: Args, key: string): string {
  const value = str(args, key);
  if (value === undefined) throw new Error(`missing required string argument '${key}'`);
  return value;
}

const takenIds = (graph: AgentGraph): Set<string> =>
  new Set([...graph.nodes, ...graph.groups].map((entry) => entry.id));

export async function dispatchTool(
  api: ExcalidrawImperativeAPI,
  name: string,
  args: Args,
  hooks: DispatchHooks,
): Promise<ToolResult> {
  switch (name) {
    case "read_canvas":
      return readCanvas(api, args.includeImage !== false);
    case "create_node":
      return mutate(api, hooks, (graph) => {
        const label = requiredStr(args, "label");
        const description = str(args, "description");
        const taken = takenIds(graph);
        const id = str(args, "id") ?? slugId(label, taken);
        if (taken.has(id) || graph.edges.some((edge) => edge.id === id)) {
          throw new Error(`id '${id}' is already on the canvas — pick another or update_node it`);
        }
        graph.nodes.push({
          id,
          type: requiredStr(args, "type"),
          label,
          ...(description ? { description } : {}),
        });
        return `created node '${id}'`;
      });
    case "connect":
      return mutate(api, hooks, (graph) => {
        const from = requiredStr(args, "from");
        const to = requiredStr(args, "to");
        const label = str(args, "label");
        for (const endpoint of [from, to]) {
          if (
            !graph.nodes.some((node) => node.id === endpoint) &&
            !graph.groups.some((group) => group.id === endpoint)
          ) {
            throw new Error(
              `no node or group with id '${endpoint}' — read_canvas to see what exists`,
            );
          }
        }
        const id = slugId(`${from}-to-${to}`, new Set(graph.edges.map((edge) => edge.id)));
        graph.edges.push({
          id,
          from,
          to,
          kind: args.kind === "async" ? "async" : "sync",
          ...(label ? { label } : {}),
        });
        return `created edge '${id}' (${from} -> ${to})`;
      });
    case "group":
      return mutate(api, hooks, (graph) => {
        const label = requiredStr(args, "label");
        const members = Array.isArray(args.members)
          ? args.members.filter((m) => typeof m === "string")
          : [];
        if (members.length === 0) throw new Error("group needs at least one member node id");
        const grouped = new Set(graph.groups.flatMap((group) => group.members));
        for (const member of members) {
          if (!graph.nodes.some((node) => node.id === member)) {
            throw new Error(`no node with id '${member}' to group`);
          }
          if (grouped.has(member)) {
            throw new Error(
              `node '${member}' is already inside a group — a node fits one boundary`,
            );
          }
        }
        const taken = takenIds(graph);
        const id = str(args, "id") ?? slugId(label, taken);
        if (taken.has(id)) throw new Error(`id '${id}' is already on the canvas`);
        graph.groups.push({ id, label, members: members as string[] });
        return `created group '${id}' around ${members.length} node(s)`;
      });
    case "update_node":
      return mutate(api, hooks, (graph) => {
        const id = requiredStr(args, "id");
        const label = str(args, "label");
        const type = str(args, "type");
        const description = str(args, "description");
        const node = graph.nodes.find((candidate) => candidate.id === id);
        const group = graph.groups.find((candidate) => candidate.id === id);
        if (!node && !group) throw new Error(`no node or group with id '${id}'`);
        if (node) {
          if (label) node.label = label;
          if (type) node.type = type;
          if (description) node.description = description;
        } else if (group) {
          if (label) group.label = label;
          if (type) throw new Error("groups have no type — only label");
        }
        return `updated '${id}'`;
      });
    case "delete":
      return mutate(api, hooks, (graph) => {
        const ids = Array.isArray(args.ids)
          ? (args.ids.filter((i) => typeof i === "string") as string[])
          : [];
        if (ids.length === 0) throw new Error("delete needs at least one id");
        const gone = new Set(ids);
        const missing = ids.filter(
          (id) =>
            !graph.nodes.some((node) => node.id === id) &&
            !graph.edges.some((edge) => edge.id === id) &&
            !graph.groups.some((group) => group.id === id),
        );
        if (missing.length > 0)
          throw new Error(`nothing on the canvas with id(s): ${missing.join(", ")}`);
        graph.nodes = graph.nodes.filter((node) => !gone.has(node.id));
        // Edges die with either endpoint; groups shed deleted members.
        graph.edges = graph.edges.filter(
          (edge) => !gone.has(edge.id) && !gone.has(edge.from) && !gone.has(edge.to),
        );
        graph.groups = graph.groups
          .filter((group) => !gone.has(group.id))
          .map((group) => ({ ...group, members: group.members.filter((m) => !gone.has(m)) }));
        return `deleted: ${ids.join(", ")}`;
      });
    default:
      throw new Error(`unknown tool '${name}'`);
  }
}

async function mutate(
  api: ExcalidrawImperativeAPI,
  hooks: DispatchHooks,
  change: (graph: AgentGraph) => string,
): Promise<ToolResult> {
  const graph = extractGraph(api.getSceneElements());
  const message = change(graph); // validate BEFORE the checkpoint fires
  hooks.beforeMutation();
  await applyGraph(api, graph);
  return text(message);
}

/** Re-materialize the whole agent diagram and swap it into the scene. */
async function applyGraph(api: ExcalidrawImperativeAPI, graph: AgentGraph): Promise<void> {
  const layout = await layoutGraph(graph);
  const scene = api.getSceneElements();
  const userElements = scene.filter((element) => !isAgentElement(element));
  const generated = materialize(graph, layout, resolveOrigin(api));
  api.updateScene({
    elements: [...userElements, ...generated],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  if (generated.length > 0) {
    api.scrollToContent(generated, { fitToViewport: true, viewportZoomFactor: 0.7, animate: true });
  }
}

/**
 * Where the diagram's (0,0) lands on the canvas: wherever it already is, or
 * a free region to the right of the user's content — never on top of it.
 */
function resolveOrigin(api: ExcalidrawImperativeAPI): { x: number; y: number } {
  const scene = api.getSceneElements();
  const agentElements = scene.filter((element) => isAgentElement(element));
  if (agentElements.length > 0) {
    const [minX, minY] = getCommonBounds(agentElements);
    return { x: minX, y: minY };
  }
  const userElements = scene.filter((element) => !isAgentElement(element));
  if (userElements.length > 0) {
    const [, minY, maxX] = getCommonBounds(userElements);
    return { x: maxX + PLACEMENT_GAP, y: minY };
  }
  return { x: 100, y: 100 };
}

async function readCanvas(
  api: ExcalidrawImperativeAPI,
  includeImage: boolean,
): Promise<ToolResult> {
  const scene = api.getSceneElements();
  const report = {
    diagram: extractGraph(scene),
    userContent: summarizeUserContent(scene),
    canvas: { totalElements: scene.length },
  };
  const content: ToolContent[] = [{ type: "text", text: JSON.stringify(report, null, 2) }];
  if (includeImage && scene.length > 0) {
    const blob = await exportToBlob({
      elements: scene,
      appState: { ...api.getAppState(), exportBackground: true },
      files: api.getFiles(),
      exportPadding: 16,
      mimeType: "image/png",
      getDimensions: (width: number, height: number) => {
        const scale = Math.min(1, SNAPSHOT_MAX_DIM / Math.max(width, height));
        return { width, height, scale };
      },
    });
    content.push({ type: "image", data: await blobToBase64(blob), mimeType: "image/png" });
  }
  return { content };
}
