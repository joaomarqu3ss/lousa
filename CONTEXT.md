# Lousa

Lousa is a desktop study platform: an infinite whiteboard for freehand thinking that domain tools (plotting, geometry, simulations) build on top of. The whiteboard is the floor, not the ceiling.

## Language

**Canvas**:
The central infinite drawing surface where all content lives — freehand strokes, text, and Module Elements alike.
_Avoid_: whiteboard, board, scene

**Document**:
A single Canvas saved as one file on disk; the unit a user opens, edits, and saves.
_Avoid_: drawing, sketch, project

**Workspace**:
The folder Lousa opens, surfaced through a minimizable sidebar that shows only the files Lousa understands — Documents (`.excalidraw`) and Notes (`.md`) — while ignoring everything else in the folder.
_Avoid_: vault, project, repository

**Note**:
A single Markdown file (`.md`) in the Workspace, edited in Lousa with inline live preview. The file on disk is the source of truth; Lousa keeps no separate copy and never transforms it into the Canvas format.
_Avoid_: page, card, document (that is the Canvas)

**Link**:
A connection Lousa reads as a graph edge — a Canvas element pointing at a Note (`element.link`), or one Note referencing another through a standard Markdown link. The structure the raw files don't carry, which the Agent Bridge exposes to the agent.
_Avoid_: reference, backlink, tag

**Module**:
An independent domain tool for a field of study (e.g. the Cartesian function plotter) that runs beside the Canvas and places its results onto it.
_Avoid_: plugin, extension, tool

**Module Element**:
A Canvas element produced by a Module, carrying its Live State so the Module can later re-open and re-edit it.
_Avoid_: widget, embed, output

**Live State**:
The re-editable parameters behind a Module Element (e.g. the equation and axis range behind a plotted graph), as opposed to its baked visual appearance.
_Avoid_: metadata, source data

**Agent Bridge**:
The platform capability that exposes the live Canvas to an external AI agent over MCP, letting it read the Canvas and place or edit elements on it.
_Avoid_: plugin, AI Module, assistant

**Checkpoint**:
The snapshot taken before an Agent Bridge turn's first write — the Canvas, and any Note files the turn touches — restored atomically by "Revert AI changes".
_Avoid_: backup, save point, undo
