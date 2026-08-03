/**
 * money.ts
 * One way to write a dollar amount, everywhere.
 *
 * Costs in this product span six orders of magnitude, from a $0.000004 request
 * to a $500 top-up, and the old answer was to print per-request costs at six
 * decimal places. That is unreadable, and worse, it is unbounded: "$0.000004"
 * next to "$1,234.567890" inside a fixed-width card pushes straight out of it.
 * Several pages overflowed for exactly that reason.
 *
 * The rule, in one place so nothing can drift from it:
 *
 *   $0.00            zero
 *   <$0.0001         smaller than four decimals can show
 *   $0.0042          under a cent, four decimals
 *   $12.34           ordinary money, two decimals, grouped
 *   $123.4K          a hundred thousand and up
 *   $1.2M            a million and up
 *
 * Four decimal places is the ceiling and two is the norm, so the widest string
 * this can produce is "-$99,999.99". Nothing here can grow without limit, in
 * either direction, which is the property the cards actually depend on.
 *
 * Amounts are **truncated toward zero**, not rounded. A balance of $99.9989
 * shown as "$100.00" invites someone to set a $100 limit and be refused for
 * money they were told they had. Truncating never claims more than exists, and
 * never claims a bigger saving than was made.
 */

// File: silkllm-frontend/src/lib/money.ts

/** Below this, four decimal places cannot say anything useful. */
const SMALLEST_SHOWN = 0.0001;
/** At or above this, switch to compact notation to keep the width bounded. */
const COMPACT_FROM = 100_000;

/**
 * Cut to `places` decimals without rounding up.
 *
 * Scaling a float then truncating is wrong on its own: 1.005 * 100 is
 * 100.49999999999999, which would truncate to 1.00 through pure binary noise
 * rather than intent. Fixing the scaled value to six decimals first removes the
 * noise while leaving a genuine 1.0049 to be cut as intended.
 */
function truncate(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.trunc(Number((value * factor).toFixed(6))) / factor;
}

function group(value: number, places: number): string {
  return truncate(value, places).toLocaleString("en-US", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

/**
 * Format a dollar amount for display.
 *
 * @param n The amount. Null, undefined and NaN are treated as zero, because a
 *   missing figure should read as nothing rather than crash a card.
 */
export function usd(n: number | null | undefined): string {
  const value = Number(n);
  if (!Number.isFinite(value) || value === 0) return "$0.00";

  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);

  // Tiers run all the way up. Stopping at millions makes the output grow again
  // past a billion, where "$1,000,000.0M" is longer than the figure it was
  // meant to shorten. Past trillions it is clamped, because no real balance
  // goes there and an unbounded string is the thing being avoided.
  if (size >= 1e15) return `${sign}>$999T`;
  for (const [threshold, suffix] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [COMPACT_FROM, "K"]] as const) {
    if (size >= threshold) {
      const scale = suffix === "K" ? 1_000 : threshold;
      return `${sign}$${group(size / scale, 1)}${suffix}`;
    }
  }
  if (size >= 0.01) return `${sign}$${group(size, 2)}`;

  // Under a cent. Four decimals is the most that will ever be shown, so
  // anything finer is described rather than printed as a row of zeros, which
  // would read as "nothing" for an amount that is not nothing.
  if (size < SMALLEST_SHOWN) return `${sign}<$0.0001`;
  return `${sign}$${group(size, 4)}`;
}

/**
 * The same rule. Kept as a separate name because call sites use it to mean
 * "this is a small per-request figure", and that intent is worth keeping even
 * though the formatting no longer differs.
 */
export const usdPrecise = usd;

/** Compact money for headline figures: $12.34, $1.2K, $3.4M. */
export function usdShort(n: number | null | undefined): string {
  const value = Number(n);
  if (!Number.isFinite(value) || value === 0) return "$0";

  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);

  if (size >= 1e15) return `${sign}>$999T`;
  for (const [threshold, suffix] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1_000, "K"]] as const) {
    if (size >= threshold) return `${sign}$${group(size / threshold, 1)}${suffix}`;
  }
  if (size >= 1) return `${sign}$${group(size, 2)}`;
  return usd(value);
}

/** Compact counts, not money: 1,284 / 12.9K / 3.4M. */
export function compact(n: number | null | undefined): string {
  const value = Number(n);
  if (!Number.isFinite(value)) return "0";

  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);

  if (size >= 1_000_000) return `${sign}${group(size / 1_000_000, 1)}M`;
  if (size >= 10_000) return `${sign}${group(size / 1_000, 1)}K`;
  return Math.trunc(value).toLocaleString("en-US");
}

/**
 * A percentage that cannot run away either.
 *
 * Spend against a limit can exceed 100% by a hair when the final request lands
 * slightly over, and "103.7%" is fine while "103.66666666%" is not.
 */
export function percent(n: number | null | undefined): string {
  const value = Number(n);
  if (!Number.isFinite(value)) return "0%";
  return `${group(value, value % 1 === 0 ? 0 : 1)}%`;
}

// EOF silkllm-frontend/src/lib/money.ts
