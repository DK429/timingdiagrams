# BUGS — v1.0.24.2 delta

- Fixed: Point overlays (stage start/end) incorrectly behaved like full interval overlays. Now they render only the forward path and a small arrival tick at the destination.
- Guard: Rendering checks `seg.startAbs === seg.endAbs` to treat as point-mode and skip polygon/band.
