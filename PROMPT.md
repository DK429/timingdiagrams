# PROMPT — Signal Plan Checker (v1.1.7-alpha)
Prepare the app for transferring the hidden canvas to a visible canvas (no behaviour change otherwise).
- Keep **min-green/queued logic** as-is (hidden renderer).
- Add a **visible canvas** and a **Transfer to Visible** button.
- After **Validate → Plot**, clicking **Transfer** copies the window spanning cycles **1..(1+viewCycles)** from the hidden canvas to the visible canvas at 1:1 scale.
- Do not change defaults or other features.
