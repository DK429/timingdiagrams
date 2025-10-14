# Signals Explorer v3 — Full (DataTab Fix)

This build fixes Data tab population and keeps all features:

- Junction editor (A–D), stages + intergreens, start offsets, cycle validation.
- Journey matrix (directional travel times).
- Plot: stage bars with per-stage green shades, labels; 1s short ticks + 5s long ticks; 10s channel grid.
- **Per-row cycle markers & labels**: red cycle-end lines through each row; row-level bottom `(t mod cycle)` labels every 5s.
- Overlays: **stage-based** and **custom** (start/end), both with directional arrowheads; interval shading and arrival windows.
- Custom overlays can **repeat each cycle** (anchored at 0, no extra delay).
- Overrun handling: **Skip/Clip**.
- Save/Load `.td`, plus JSON import/export.
- Print Preview: exact paper sizes + orientation, auto-fit with manual scale, optional legend/readout.

Open `index.html` directly in your browser.
