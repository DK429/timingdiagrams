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

## v1.5.0-alpha — 2025-10-15T22:34:26Z UTC
- Simplified UI to a **single** zoomable/scrollable canvas (Hidden ext canvas tab). 
- Removed Visible canvas tab and the transfer/render code.
- Wheel zoom (Cmd/Ctrl + wheel or pinch) remains; horizontal scrolling preserved.

## v1.5.1-alpha — 2025-10-15T22:35:42Z UTC
- The canvas' **visible width** now locks to **View Cycles × mainCycle**:
  - New `fitToViewCycles()` computes px/sec so exactly N cycles fill the available width.
  - Auto-fits when View Cycles changes, on window resize, when opening the Hidden tab, and once at boot.
  - The existing Fit button now performs this N-cycle fit.

## v1.5.1-alpha — 2025-10-15T22:38:17Z UTC
- Viewport fit: the hidden canvas now fits exactly **(viewCycles × mainCycle)** seconds into the viewport width.
- Added `fitVisibleCycles()` and wired it to the Fit button, the view-cycles control, tab switch to Hidden, and window resize.
