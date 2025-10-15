# Signal Plan Checker

**Version:** v1.0.24.2 (clipboard)  
**Base:** v1.0.24.1 (stage dropdown refresh)  
**Runtime:** Pure HTML/CSS/JS — no server required.

## New
- **Copy plot to clipboard** button (on the Plot tab).
  - Tries to copy as **PNG image** using the async Clipboard API.
  - If not supported (some iOS versions / permissions), it falls back to copying the **SVG markup text**.
  - Shows status in the readout and debug log.

> Note: Safari/iPadOS may ask for permission the first time. If image copy is blocked by policy, you’ll see the SVG-text fallback message.
