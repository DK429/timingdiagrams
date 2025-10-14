# Signals Explorer v3 — Clip/Skip + Print Preview (fixed)

## Fixes
- **Clip/Skip overlays** now behave correctly:
  - **Skip**: only renders occurrences fully inside the horizon.
  - **Clip**: includes partial occurrences and clamps lines, shaded quads, and arrival windows to the horizon.

## Printing (accurate PDF)
- **Print Preview** opens a clean window with ONLY the plot sheet (header + diagram + footer).
- Exact **paper sizes** (A4/A3/Letter/Legal) and **true** portrait/landscape layout.
- **Auto-fit** the SVG to the printable area with an optional **Scale** multiplier (80–140%).
- Optional **Legend** and **Readout** can be included on the sheet.

Open `index.html` locally in a browser.
