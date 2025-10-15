# Changelog
## v1.1.7-alpha — 2025-10-15 UTC
- Added visible canvas and **Transfer to Visible** button.
- Copies hidden canvas window (cycles 1..1+N) to visible at 1:1.
- No changes to logic or defaults.

## v1.4.0-alpha — 2025-10-15T22:26:43Z UTC
- Dual clocks: **A** drives plotting (unchanged), **B** drives the **visible** top-axis labels.
- Visible transfer is now a **B-window**: start at B0 = max(0, A_left − mainCycle) and width = (viewCycles × mainCycle).
- Axis overlay masks A-label artefacts and writes clean B labels (every 10s) over the visible span.
- Scrolling/zooming the hidden canvas shifts **B0**, so you can pan left/right and re-Transfer to update.
