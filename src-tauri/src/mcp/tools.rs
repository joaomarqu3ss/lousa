//! The MCP tool catalog. Served by the proxy's `tools/list`; the behavior
//! lives in the webview (`src/lib/agentBridge/tools.ts`) — keep both in sync.
//! Descriptions are written for the agent: they teach the mid-level
//! vocabulary (ADR-0012) and steer it toward improving designs, not just
//! transcribing them.

use serde_json::{json, Value};

pub fn catalog() -> Value {
    json!([
        {
            "name": "read_canvas",
            "description": "Read the user's current Lousa canvas. Returns two parts. (1) TEXT: the structured diagram graph previously created through this bridge — typed nodes, directed edges, and groups, all with stable ids you can edit — plus a summary of user-drawn content (text strings and shape counts). (2) IMAGE: a PNG snapshot of the whole canvas, the only way to see freehand strokes and shapes the user drew by hand. Always call this before your first edit of a session, and re-read after the user says they changed something. When asked to improve or formalize what the user drew, study the image for boxes, arrows, and labels that are not yet in the structured graph, recreate them as proper nodes and edges, and tell the user what you inferred.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "includeImage": {
                        "type": "boolean",
                        "description": "Set false to skip the PNG snapshot when you only need the structured graph.",
                        "default": true
                    }
                },
                "additionalProperties": false
            }
        },
        {
            "name": "create_node",
            "description": "Add a typed node to the system-design diagram on the canvas. Lousa lays the diagram out automatically and keeps arrows attached — never think about coordinates. Types with distinct visuals: 'service' (rounded blue box), 'datastore' (green ellipse), 'queue' (orange diamond — brokers, queues, topics), 'external' (dashed gray box — third-party systems and human actors), 'note' (yellow sticky — commentary, decisions, trade-offs), 'boundary' (empty dashed container — prefer the group tool to wrap existing nodes instead). Any other string is allowed and renders in a default style. Keep the label to 1–4 words; put longer explanations in 'description', which is stored with the node and returned by read_canvas but not painted on the canvas.",
            "inputSchema": {
                "type": "object",
                "required": ["type", "label"],
                "properties": {
                    "id": { "type": "string", "description": "Optional stable id (lowercase slug). Generated from the label if omitted." },
                    "type": { "type": "string", "description": "service | datastore | queue | external | note — or any custom string." },
                    "label": { "type": "string", "description": "Short name painted on the node (1–4 words)." },
                    "description": { "type": "string", "description": "Longer explanation stored in the node's Live State, not painted." }
                },
                "additionalProperties": false
            }
        },
        {
            "name": "connect",
            "description": "Draw a directed, bound arrow between two existing nodes or groups. The arrow stays attached when the diagram is re-laid-out or the user drags a node. Label it with the interaction ('REST', 'publishes', 'reads replica'). kind 'sync' renders solid; 'async' renders dashed — use async for queues, events, and fire-and-forget flows.",
            "inputSchema": {
                "type": "object",
                "required": ["from", "to"],
                "properties": {
                    "from": { "type": "string", "description": "Source node or group id." },
                    "to": { "type": "string", "description": "Target node or group id." },
                    "label": { "type": "string", "description": "Interaction painted on the arrow." },
                    "kind": { "type": "string", "enum": ["sync", "async"], "default": "sync" }
                },
                "additionalProperties": false
            }
        },
        {
            "name": "group",
            "description": "Draw a labeled boundary (dashed container) around existing nodes — a bounded context, VPC, cluster, or subsystem. Members are laid out together inside it. A node can belong to at most one group.",
            "inputSchema": {
                "type": "object",
                "required": ["label", "members"],
                "properties": {
                    "id": { "type": "string", "description": "Optional stable id (lowercase slug). Generated from the label if omitted." },
                    "label": { "type": "string" },
                    "members": { "type": "array", "items": { "type": "string" }, "minItems": 1, "description": "Ids of the nodes inside the boundary." }
                },
                "additionalProperties": false
            }
        },
        {
            "name": "update_node",
            "description": "Change the label, type, or description of an existing node or group, by id. Use this to refine a diagram in place instead of deleting and recreating.",
            "inputSchema": {
                "type": "object",
                "required": ["id"],
                "properties": {
                    "id": { "type": "string" },
                    "label": { "type": "string" },
                    "type": { "type": "string", "description": "Nodes only; groups have no type." },
                    "description": { "type": "string" }
                },
                "additionalProperties": false
            }
        },
        {
            "name": "delete",
            "description": "Delete nodes, edges, or groups by id. Deleting a node also removes the edges attached to it. Deleting a group removes only the boundary; its member nodes stay.",
            "inputSchema": {
                "type": "object",
                "required": ["ids"],
                "properties": {
                    "ids": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
                },
                "additionalProperties": false
            }
        }
    ])
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_tool_has_name_description_and_schema() {
        let tools = super::catalog();
        let tools = tools.as_array().expect("catalog is an array");
        assert_eq!(tools.len(), 6);
        for tool in tools {
            assert!(tool["name"].is_string());
            assert!(tool["description"].as_str().unwrap().len() > 40);
            assert_eq!(tool["inputSchema"]["type"], "object");
        }
    }
}
