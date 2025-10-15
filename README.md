# Signal Plan Checker

**Version:** v1.0.24.4 (overlayfix)  
**What’s fixed**
- Add overlay buttons now work and push overlays into app state.
- Minimal overlay rendering restored: sloped front/back lines and shaded arrival band at destination row.
- Clipboard button now logs attempts and tries PNG → SVG image → SVG text → legacy execCommand.

**Note** (intentional, to keep this a safe step from 1.0.24):
- No horizon-wrap splitting of overlays yet (that’s a later patch).
- Point overlays render a single arrival line (no band).
