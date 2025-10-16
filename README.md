# TimeConverter

A tiny, dependency-free utility for **seconds-only** time math used in plotting and scheduling UIs.  
It performs conversions between **absolute seconds**, **cycle‑relative seconds** (`t - mainCycle`), and **wrapped seconds** within a cycle window — always returning **whole numbers** and a **matching string**.

---

## Why this exists

In SATFlow / overlay rendering you’re working purely in seconds (no `HH:MM:SS`), and labels/logic should be integer-aligned with your tick grid (`t * pxPerSec`). This class enforces that discipline to avoid rounding drift and mixed units.

---

## Installation

Just drop the file into your project and import it.

```js
// ES modules
import { TimeConverter } from './TimeConverter.js';
```

> **Note:** If you use bundlers that default to CJS, enable ESM or adjust your build to transpile `export class` syntax.

---

## Quick start

```js
import { TimeConverter } from './TimeConverter.js';

const tc = new TimeConverter(60); // mainCycle = 60 s

tc.toRelative(125);     // → { num: 65,  str: "65" }
tc.toAbsolute(65);      // → { num: 125, str: "125" }
tc.wrapCycle(185, 90);  // → { num: 5,   str: "5" }
```

---

## API

### `new TimeConverter(mainCycle = 0)`
- `mainCycle` — integer seconds used as the reference cycle offset. Stored internally as `Math.round(mainCycle)`.

### `.toRelative(t)`
- **Input:** `t` absolute seconds.  
- **Returns:** `{ num, str }` where `num = Math.round(t - mainCycle)` and `str = String(num)`.

### `.toAbsolute(t)`
- **Input:** `t` relative seconds.  
- **Returns:** `{ num, str }` where `num = Math.round(t + mainCycle)` and `str = String(num)`.

### `.wrapCycle(t, cycleLength)`
- **Input:** `t` seconds (absolute or relative); `cycleLength` > 0 seconds.  
- **Returns:** `{ num, str }` where  
  `num = (((t - mainCycle) % cycleLength) + cycleLength) % cycleLength` rounded to whole seconds.

All methods **validate inputs** and throw helpful errors if misused.

---

## Integration with `drawAxesDualClock`

If you’re using the dual-axis renderer from `axes-dual-clock.js`, you can wire it like this:

```js
import { drawAxesDualClock } from './axes-dual-clock.js';
import { TimeConverter } from './TimeConverter.js';

const tc = new TimeConverter(60); // e.g., M = 60 s

drawAxesDualClock(ctx, {
  originX: 0,
  horizonSec: 180,
  stepSec: 10,
  pxPerSec: 6,
  tick: { size: 6, strokeStyle: '#000', lineWidth: 1 },
  labels: {
    font: '11px ui-monospace, monospace',
    fillStyle: '#000',
    topOffset: -8,
    bottomOffset: +14,
    formatterTop: (t, M) => tc.toRelative(t).num, // or .str if you render text directly
    formatterBottom: (t) => t // or String(t) if your renderer expects text
  },
  lanes: { topY: 18, bottomY: 28 },
  mainCycle: 60
});
```

> Choose `.num` when feeding math or layout, `.str` when placing text. Both are always the same integer value.

---

## Edge cases & behavior

- **Whole seconds only:** All results are `Math.round(...)` to avoid fractional drift.
- **Negative inputs:** Supported. For example, `new TimeConverter(100).toRelative(40)` → `{ num: -60, str: "-60" }`.
- **Wrapping semantics:** `.wrapCycle(t, L)` always returns a value in `[0, L)` regardless of sign of `t - mainCycle`.
- **No hidden formatting:** No `HH:MM:SS` conversions — this is strictly seconds arithmetic.

---

## Examples

```js
const tc = new TimeConverter(45);

// Dual labels for a tick at t=130 s
const rel = tc.toRelative(130); // { num: 85, str: "85" }
const abs = { num: 130, str: "130" };

// Use in draw callbacks
formatterTop: (t, M) => tc.toRelative(t).str; // "85"
formatterBottom: (t) => String(t);            // "130"

// Wrap into a 90 s phase window
tc.wrapCycle(185, 90); // { num: 50, str: "50" } when mainCycle = 45
```

---

## Error messages

- `TimeConverter: mainCycle must be a valid number`
- `TimeConverter: input must be a valid number`
- `wrapCycle: cycleLength must be a positive number`

These are thrown to help you catch misuse early during integration/tests.

---

## Versioning

- **v1.0.0**
  - Initial release (seconds-only math; returns `{ num, str }`; input validation; modular wrapping).

---

## License

MIT — do what you like, no warranty.
