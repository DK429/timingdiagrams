# Changelog
## v1.1.7-alpha — 2025-10-15 UTC
- Added visible canvas and **Transfer to Visible** button.
- Copies hidden canvas window (cycles 1..1+N) to visible at 1:1.
- No changes to logic or defaults.

## v1.6.4-alpha.1 — 2025-10-16T04:19:59Z UTC
- Fixed top axis: ticks remain at **t × pxPerSec**, but labels now show **t − mainCycle** (Clock B). Bottom axis remains Clock A (t).

## v1.6.5-alpha — 2025-10-16T04:30:21Z UTC
- Top axis labels now correctly show **(t − mainCycle)** while ticks remain at **t × pxPerSec**.
- Fully scrubbed any **Visible canvas** leftovers (tabs, markup, functions, calls).

## v1.6.6-alpha — 2025-10-16T04:38:59Z UTC
- Top axis labels: **t − mainCycle** (raw integers), **black**, **centered above** tick. Ticks remain at t·pxPerSec.
- Bottom testing axis: **t** (raw integers), **black**, **centered below** tick.
