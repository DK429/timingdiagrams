# Signals Explorer v3p (channels + overlays)

- Plots all junctions together (A–D) with thin stage bands.
- **Channels** between adjacent rows (A–B, B–C, C–D) hold **all journey lines for that pair** (both directions).  
- **10‑second vertical grid** rendered **inside channels** only.
- **Multiple overlays**: add stage→stage plots (point or whole stage interval). Non‑adjacent pairs route via multi‑hop channels (e.g., A→C uses A–B then B–C).
- Static, no server. Export/Import JSON.

## Use
1. Open `index.html`.
2. Data tab: configure junctions and journey matrix.
3. Plot tab: set horizon, add overlays (Origin + Stage + Mode + Destination + Color), click **Add overlay**.
4. The legend lists overlays and lets you remove them.  
5. Interval overlays draw **front/back** lines in channels and highlight the arrival window on the destination row.

Enjoy!
