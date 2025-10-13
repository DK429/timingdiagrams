# 2‑Junction Signals Explorer (static, no-server)

This is a **standalone** web app. Open `index.html` directly in your browser — no build tools, no server.

## Features
- Define Junction **A** and **B**: cycle time, start offset, stages, and intergreens.
- Direction-specific journey times (A→B and B→A).
- SVG time–stage diagram across a chosen horizon.
- Click on the **top row** to pick a departure time; **Shift+drag** to select an interval.
- Readout shows which band at the destination you land in (and an estimate of wait if arriving during intergreen).
- **Validate**, **Export JSON**, and **Import JSON** of your configurations.

## Files
- `index.html` — UI scaffold
- `style.css` — styles
- `script.js` — logic (timing math + rendering)
- `README.md` — this file

## How timing works (summary)
For each junction we build a one‑cycle list of bands (stage and intergreen) with cumulative starts/ends. We tile those bands across the visible time horizon and render them as horizontal bars. For a given absolute departure time `t_dep` on the origin, we compute arrival `t_arr = t_dep + travelTime`. We then determine the destination band at `t_arr` using modulo arithmetic on the destination cycle with its start offset.

The validation enforces: `sum(stages) + sum(intergreens) == cycleTimeSec` for each junction.

## Notes
- Intergreens are displayed as grey bands and treated as non-serving.
- You can add/remove stages. Intergreens correspond row-for-row to each stage.
- For accessibility, text labels are kept high-contrast and the chart is keyboard-focusable (via page zoom / native).
- Everything runs 100% in-browser; you can use this offline.

## Next ideas (nice-to-have)
- Arrival distribution maps for a whole stage window (split by destination bands with percentages).
- Export to SVG/PNG.
- Named presets.
- Keyboard shortcuts (G grid toggle, R reset selection).
