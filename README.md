# Signals Explorer v3p (channels) — fix 2

What’s new in this build:
- **Double vertical space** for the plot (bigger canvas, larger inter-row channels).
- Correct routing of hop segments to their **proper channels** using the hop id (e.g., **C→B** draws in **B–C**, not A–B).
- Journey lines stay **diagonal** across channels; both directions share the same channel.
- 10‑second vertical grid drawn **inside channels** only.
- Multi‑overlays (point or interval), with arrival window highlight on destination row.

## Use
1. Open `index.html` (no server needed).
2. Data tab: set junctions (stages + intergreens must sum to cycle) and journey times matrix.
3. Plot tab: pick horizon, then add overlays (Origin, Stage, Mode, Destination, Color). Lines for each hop render in the correct inter-row channel.
