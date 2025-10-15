# Changelog
## v1.1.7-alpha — 2025-10-15 UTC
- Added visible canvas and **Transfer to Visible** button.
- Copies hidden canvas window (cycles 1..1+N) to visible at 1:1.
- No changes to logic or defaults.

## v1.1.9-alpha.6 — 2025-10-15T21:24:36Z UTC
- Safari robustness: added cache-busting to `init.config.json` fetch and exposed APP_VERSION at runtime; status chip now shows version after Validate/Plot.

## v1.2.0-alpha — 2025-10-15T21:33:14Z UTC
- UI: Introduced master tabs (Data, Hidden ext canvas, Visible canvas). Hidden and visible canvases now occupy their own tabs for full-screen plotting.
- Plot: Improved stage-label visibility (thinner padding, lower width threshold, slightly larger font, guaranteed overdraw).

## v1.2.1-alpha — 2025-10-15T21:42:04Z UTC
- Visible canvas: overlay cycle-time counter now shows (N-1) × mainCycle (i.e., actual window minus one cycle). Clears and redraws per transfer.
- Full-screen fit: visible canvas auto-scales to fill the entire visible tab (both width and height) using CSS transform scaling, preserving crispness.
- Tab switch to "Visible canvas" now re-transfers and scales automatically.

## v1.3.0-alpha — 2025-10-15T21:50:38Z UTC
- Visible canvas now re-renders using the same plotting pipeline as hidden, but with an origin shift of one main cycle:
  - Grid/labels across the full widened horizon.
  - Plotting starts from cycle 2 (t ≥ mainCycle). Earlier grid remains visible with muted labels.
  - Time labels display (t - mainCycle), so 0 aligns with the start of cycle 2.
- Transfer action now re-renders rather than blitting and scales to the full tab.

## v1.3.1-alpha — 2025-10-15T21:59:39Z UTC
- Visible canvas alignment: origin now aligns with the left margin via context translation; eliminates left offset.
- Time axis on visible shows (t − mainCycle) labels only (no negatives); grid starts at cycle 2 to prevent hidden-canvas artefacts.
- Removed prior clamping/skips; rendering now mirrors hidden pipeline exactly with a translated origin.
