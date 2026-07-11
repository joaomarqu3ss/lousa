# Lousa

Lousa is a desktop study platform: an infinite whiteboard for freehand thinking that domain tools (plotting, geometry, simulations) build on top of. The whiteboard is the floor, not the ceiling.

## Language

**Canvas**:
The central infinite drawing surface where all content lives — freehand strokes, text, and Module Elements alike.
_Avoid_: whiteboard, board, scene

**Document**:
A single Canvas saved as one file on disk; the unit a user opens, edits, and saves.
_Avoid_: drawing, sketch, project

**Module**:
An independent domain tool for a field of study (e.g. the Cartesian function plotter) that runs beside the Canvas and places its results onto it.
_Avoid_: plugin, extension, tool

**Module Element**:
A Canvas element produced by a Module, carrying its Live State so the Module can later re-open and re-edit it.
_Avoid_: widget, embed, output

**Live State**:
The re-editable parameters behind a Module Element (e.g. the equation and axis range behind a plotted graph), as opposed to its baked visual appearance.
_Avoid_: metadata, source data
