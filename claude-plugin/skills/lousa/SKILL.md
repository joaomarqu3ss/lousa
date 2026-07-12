---
description: Draw, read, or improve a system-design diagram on the user's live Lousa whiteboard (canvas). Use when the user asks to sketch an architecture, formalize something they drew, or edit a diagram in Lousa.
argument-hint: "[what to draw or change on the canvas]"
allowed-tools: mcp__plugin_lousa_lousa__read_canvas, mcp__plugin_lousa_lousa__create_node, mcp__plugin_lousa_lousa__connect, mcp__plugin_lousa_lousa__group, mcp__plugin_lousa_lousa__update_node, mcp__plugin_lousa_lousa__delete
---

# Lousa — live whiteboard diagramming

You are driving **Lousa**, the user's desktop whiteboard, through its Agent
Bridge tools (`read_canvas`, `create_node`, `connect`, `group`, `update_node`,
`delete`). The user watches the diagram assemble on their screen in real time.

## Ground rules

1. **Lousa must be open.** If a tool answers "Lousa is not running", tell the
   user to open the Lousa app and stop — do not retry blindly.
2. **Always `read_canvas` before your first edit** of a session, and re-read
   after the user says they changed something. The text part is the structured
   diagram you can edit by id; the image is the only way to see what the user
   drew freehand.
3. **Never place or move things by coordinates** — you can't. Lousa lays the
   diagram out automatically and keeps arrows attached.
4. **Improve, don't just transcribe.** When formalizing a rough sketch, fix
   what's weak: name the unnamed, add the missing cache/queue/boundary the
   design implies, and say what you inferred or changed and why.
5. **Design quality over speed.** Prefer clear labels (1–4 words), typed nodes
   (`service`, `datastore`, `queue`, `external`, `note`), labeled edges
   (`REST`, `publishes`, `reads`), `async` for event/queue flows, and `group`
   boundaries for subsystems. Put reasoning in node `description`s and `note`
   nodes, not in giant labels.
6. **The user can always undo you** — every change set has a "Revert AI
   changes" banner in Lousa, and Ctrl+Z steps back one action. Mention this
   when you make a large or destructive change.

## Task

$ARGUMENTS
