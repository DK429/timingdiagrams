# Signal Plan Checker — v1.1.4-alpha
Gated rendering so editing/validation is safe:
- Editing any data highlights **Validate** and **Plot**, and disables drawing until Validate passes and Plot is pressed.
- Validation now checks **stage transitions** against the intergreen matrix (wrap-around included).
- Hidden extended canvas remains the development surface with zoom and Fit.
