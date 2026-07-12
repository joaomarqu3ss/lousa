/**
 * App-side wiring of the Agent Bridge: listen for tool calls the Rust socket
 * server emits, run them against the Excalidraw API (serialized — the scene
 * is shared state), answer back, and hold the checkpoint for revert.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isNewTurn } from "./checkpoint";
import { dispatchTool, type ToolResult } from "./tools";

interface ToolCallEvent {
  callId: number;
  name: string;
  arguments: Record<string, unknown> | null;
}

export interface AgentBridge {
  /** True while an agent change set can be reverted. */
  revertAvailable: boolean;
  /** Restore the canvas to the pre-turn checkpoint. */
  revert: () => void;
  /** Accept the agent changes and drop the checkpoint. */
  keep: () => void;
}

export function useAgentBridge(api: ExcalidrawImperativeAPI | null): AgentBridge {
  const [revertAvailable, setRevertAvailable] = useState(false);
  const checkpointRef = useRef<readonly OrderedExcalidrawElement[] | null>(null);
  const lastMutationRef = useRef<number | null>(null);
  // Tool calls run one at a time: they all mutate the same scene.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!api) return;
    const beforeMutation = () => {
      const now = Date.now();
      if (isNewTurn(lastMutationRef.current, now)) {
        checkpointRef.current = api.getSceneElements();
        setRevertAvailable(true);
      }
      lastMutationRef.current = now;
    };
    const unlisten = listen<ToolCallEvent>("mcp-tool-call", (event) => {
      const { callId, name, arguments: args } = event.payload;
      queueRef.current = queueRef.current.then(async () => {
        let result: ToolResult;
        try {
          result = await dispatchTool(api, name, args ?? {}, { beforeMutation });
        } catch (err) {
          result = {
            content: [
              { type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` },
            ],
            isError: true,
          };
        }
        await invoke("mcp_tool_result", { callId, result });
      });
    });
    // A listen() rejection would otherwise fail silently.
    unlisten.catch((err: unknown) => console.error("agent bridge: listen failed", err));
    return () => {
      void unlisten.then((f) => f());
    };
  }, [api]);

  const clear = useCallback(() => {
    checkpointRef.current = null;
    lastMutationRef.current = null;
    setRevertAvailable(false);
  }, []);

  const revert = useCallback(() => {
    if (api && checkpointRef.current) {
      api.updateScene({
        elements: checkpointRef.current,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
    clear();
  }, [api, clear]);

  return { revertAvailable, revert, keep: clear };
}
