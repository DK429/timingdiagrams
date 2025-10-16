/**
 * TimeConverter.js
 *
 * Utility class for converting and normalizing time values in seconds.
 * Operates exclusively on whole seconds (no decimals, no hh:mm:ss).
 *
 * Usage:
 *   const tc = new TimeConverter(60);  // mainCycle = 60 s
 *   tc.toRelative(125);     // → { num: 65, str: "65" }
 *   tc.toAbsolute(65);      // → { num: 125, str: "125" }
 *   tc.wrapCycle(185, 90);  // → { num: 5,  str: "5"  }
 */

export class TimeConverter {
  /**
   * @param {number} [mainCycle=0] - Reference offset in seconds.
   */
  constructor(mainCycle = 0) {
    if (typeof mainCycle !== 'number' || isNaN(mainCycle)) {
      throw new Error('TimeConverter: mainCycle must be a valid number');
    }
    this.mainCycle = Math.round(mainCycle);
  }

  /**
   * Convert absolute → relative: (t - mainCycle).
   * @param {number} t - Absolute time in seconds.
   * @returns {{ num: number, str: string }}
   */
  toRelative(t) {
    const n = this.#validateAndRound(t - this.mainCycle);
    return { num: n, str: String(n) };
  }

  /**
   * Convert relative → absolute: (t + mainCycle).
   * @param {number} t - Relative time in seconds.
   * @returns {{ num: number, str: string }}
   */
  toAbsolute(t) {
    const n = this.#validateAndRound(t + this.mainCycle);
    return { num: n, str: String(n) };
  }

  /**
   * Wrap (t - mainCycle) into [0, cycleLength) via modular arithmetic.
   * Example: t=185, cycleLength=90 → 5
   * @param {number} t - Time in seconds (absolute or relative context).
   * @param {number} cycleLength - Positive cycle length in seconds.
   * @returns {{ num: number, str: string }}
   */
  wrapCycle(t, cycleLength) {
    if (typeof cycleLength !== 'number' || cycleLength <= 0) {
      throw new Error('wrapCycle: cycleLength must be a positive number');
    }
    const shifted = t - this.mainCycle;
    const wrapped = ((shifted % cycleLength) + cycleLength) % cycleLength;
    const n = this.#validateAndRound(wrapped);
    return { num: n, str: String(n) };
  }

  /**
   * Internal validator/rounder to ensure whole seconds.
   * @private
   */
  #validateAndRound(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('TimeConverter: input must be a valid number');
    }
    return Math.round(value);
  }
}
