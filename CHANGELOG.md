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
