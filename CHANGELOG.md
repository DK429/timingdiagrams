# Changelog — Signal Plan Checker

## v1.0.24.6 — Wrapfix
**Date:** 2025-10-15 (UTC)

### Fixed
- Whole-stage overlays no longer "print backwards" on later occurrences: lines are split at the horizon wrap with correct slope.
- Destination shaded band is split across the wrap, so the polygon/area is no longer missing beyond the boundary.

### Notes
- This is a focused hotfix; broader overlay polygon fill across channels will be handled separately.

## v1.0.24.5 — Plot render hotfix
- Reliable first render, width fallback, deferred render on tab activation.
