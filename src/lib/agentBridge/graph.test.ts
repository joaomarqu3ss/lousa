import { describe, expect, it } from "vitest";
import { extractGraph, isAgentElement, slugId, summarizeUserContent } from "./graph";
import type { SceneElementLike } from "./graph";

const nodeElement: SceneElementLike = {
  type: "rectangle",
  customData: {
    lousa: { kind: "agent-node", node: { id: "api", type: "service", label: "API" } },
  },
};
const edgeElement: SceneElementLike = {
  type: "arrow",
  customData: {
    lousa: { kind: "agent-edge", edge: { id: "api-to-db", from: "api", to: "db", kind: "sync" } },
  },
};
const userRect: SceneElementLike = { type: "rectangle" };
const userText: SceneElementLike = { type: "text", text: "auth flow?" };
const boundLabel: SceneElementLike = { type: "text", text: "API", containerId: "lousa-node-api" };

describe("extractGraph", () => {
  it("rebuilds the graph from Live State and ignores user elements", () => {
    const graph = extractGraph([nodeElement, edgeElement, userRect, userText]);
    expect(graph.nodes).toEqual([{ id: "api", type: "service", label: "API" }]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.groups).toHaveLength(0);
  });

  it("ignores foreign customData", () => {
    const foreign: SceneElementLike = { type: "rectangle", customData: { other: true } };
    expect(extractGraph([foreign]).nodes).toHaveLength(0);
  });
});

describe("isAgentElement", () => {
  it("claims bridge elements and their bound labels, not user work", () => {
    expect(isAgentElement(nodeElement)).toBe(true);
    expect(isAgentElement(boundLabel)).toBe(true);
    expect(isAgentElement(userRect)).toBe(false);
    expect(isAgentElement(userText)).toBe(false);
  });
});

describe("summarizeUserContent", () => {
  it("counts only user shapes and collects their text", () => {
    const summary = summarizeUserContent([nodeElement, boundLabel, userRect, userText]);
    expect(summary.shapeCounts).toEqual({ rectangle: 1, text: 1 });
    expect(summary.texts).toEqual(["auth flow?"]);
  });
});

describe("slugId", () => {
  it("slugifies labels", () => {
    expect(slugId("Auth Service", new Set())).toBe("auth-service");
  });

  it("uniquifies against taken ids", () => {
    expect(slugId("API", new Set(["api"]))).toBe("api-2");
    expect(slugId("API", new Set(["api", "api-2"]))).toBe("api-3");
  });

  it("never returns an empty id", () => {
    expect(slugId("!!!", new Set())).toBe("node");
  });
});
