# Changelog
## v1.1.4-alpha — 2025-10-15 UTC
- Gated draw: no canvas updates until Validate (OK) + Plot
- Buttons highlight when data changes; validation/plot state reset
- Added stage transition legality check vs intergreen (including wrap)
- Prevent redraw during error alerts (since redraws are gated)
