# Changelog
## v1.1.7-alpha — 2025-10-15 UTC
- Added visible canvas and **Transfer to Visible** button.
- Copies hidden canvas window (cycles 1..1+N) to visible at 1:1.
- No changes to logic or defaults.

## v1.1.8-alpha — 2025-10-15T20:53:10Z UTC
- Validation wording: "Stage X change point missed — request not achievable" for missed change conflicts.
- Logging: optional warn on queued delays when `utcPlan.warnOnDelay` is enabled (no behaviour change).
- No changes to timing logic; queued indicators remain as dashed blue with triangle marker.

## v1.1.9-alpha — 2025-10-15T20:58:05Z UTC
- Plot: stage labels drawn inside green bars in white, adaptively shortened (full → S# → #) based on available width.
- Plot: missed-change validation now shown as a red on-canvas badge for the affected junction row.
- Behaviour unchanged; this is purely visual.

## v1.1.9-alpha.1 — 2025-10-15T21:03:19Z UTC
- Hotfix: removed stray replacement token causing a syntax error near end-of-file.

## v1.1.9-alpha.2 — 2025-10-15T21:11:47Z UTC
- Hotfix: guarded queued-change annotations; now use local `_rqNext` and `_delay` so no ReferenceError if variables are not yet declared in this scope.
