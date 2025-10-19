// Signal Plan Checker v2.6.1h - Configuration
// Extracted from embedded JSON config

export const DEFAULT_CONFIG = {
  "appName": "Signal Plan Checker",
  "ui": {
    "debug": {
      "enabled": true,
      "dock": { "showOnLoad": true },
      "logLevel": "info",
      "validationOnActions": false,
      "perfMarkers": true
    }
  },
  "mainCycleTime": { "default": 60, "min": 1, "max": 240, "mustBeEvenWhenAnyDouble": true },
  "junctionCount": { "default": 3, "min": 2, "max": 5 },
  "doubleCycle": { "allowed": true, "requireAtLeastOneMainCycle": true },
  "stageCount": { "default": 2, "min": 2 },
  "stage": { "minGreen": { "default": 7, "min": 1 } },
  "intergreen": {
    "diagonalLockedValue": -1,
    "allowNotPermittedValue": -1,
    "defaults": { "offDiagonal": 5 },
    "domain": { "min": 0, "max": 60 }
  },
  "journeyTime": { "default": 20, "min": 0, "max": 60 },
  "utcPlan": {
    "requireAtLeastOneChange": true,
    "markRequestsBlue": true,
    "showQueuedChangeMarkers": true,
    "warnOnDelay": true,
    "alertOnMissedChange": true,
    "defaults": [
      { "to": "S1", "at": 0 },
      { "to": "S2", "at": 30 }
    ]
  },
  "plot": {
    "hiddenWindowMultiplier": 5,
    "viewCycles": { "options": [1, 2, 3], "default": 2 },
    "grid10s": true,
    "ticks1s": true,
    "ticks5s": true,
    "rowHeight": 48,
    "rowGap": 18,
    "leftMargin": 120,
    "topMargin": 24,
    "pxPerSec": 4
  },
  "overlays": {
    "adjacentOnly": true,
    "defaultOpacity": 0.8,
    "shadeAlpha": 0.15,
    "repeatByCycle": true,
    "allowCustomIntervals": true
  },
  "packaging": { "includeDocs": true }
};
