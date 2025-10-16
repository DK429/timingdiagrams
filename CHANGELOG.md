# Changelog
## v1.1.7-alpha — 2025-10-15 UTC
- Added visible canvas and **Transfer to Visible** button.
- Copies hidden canvas window (cycles 1..1+N) to visible at 1:1.
- No changes to logic or defaults.

## v1.6.0-alpha — 2025-10-15T22:45:00Z UTC
- Restored robust **two-tab** layout: Data and Hidden ext canvas.
- Ensured hidden canvas sits inside its **own tab** (`#tab-hidden`) with scroll/zoom.
- Kept wheel-zoom and View-Cycles fit; auto-fit when opening Hidden tab or resizing.

## v1.6.1-alpha — 2025-10-15T22:56:31Z UTC
- **Testing only:** added a bottom timeline that shows **Clock A** (0..T) in seconds under the plot.

## v1.6.2-alpha — 2025-10-15T23:01:39Z UTC
- TOP axis now shows **Clock B** = (t − mainCycle) labels. Pre-origin (negative) labels render in grey. 
- Bottom testing axis remains **Clock A** (0..T) for comparison.

## v1.6.3-alpha — 2025-10-15T23:08:13Z UTC
- Auto-scroll the hidden canvas so **B=0** (i.e., **A = mainCycle**) is positioned at the **left edge** after Fit, on Hidden-tab open, and at boot.
- Top axis remains **Clock B = t − mainCycle**; bottom axis stays **Clock A** for testing.
