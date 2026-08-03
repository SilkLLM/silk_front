/**
 * audit-money.mjs
 * The money formatter, checked against the rule it exists to enforce.
 *
 * Money in this product spans a $0.000004 request and a $500 top-up, and the
 * old formatter printed per-request costs at six decimal places. That is both
 * unreadable and unbounded, and it pushed figures out of the cards holding them
 * on every page that showed a cost.
 *
 * The property worth protecting is the width. Two decimals normally, four at
 * most, compact notation once the integer part grows, so nothing this returns
 * can outgrow its container in either direction.
 */

// File: silkllm-frontend/scripts/audit-money.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "silk-money-")), "money.mjs");
execFileSync("npx", ["--yes", "esbuild", "src/lib/money.ts", "--bundle",
                     "--format=esm", `--outfile=${out}`, "--log-level=error"]);
const { usd, usdShort, compact, percent } = await import(out);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${actual}${ok ? "" : `  (expected ${expected})`}`);
};

console.log("\nThe rule:");
check("zero",                        usd(0),          "$0.00");
check("finer than four decimals",    usd(0.000002),   "<$0.0001");
check("smallest shown",              usd(0.0001),     "$0.0001");
check("under a cent",                usd(0.0042),     "$0.0042");
check("ordinary money",              usd(12.34),      "$12.34");
check("grouped thousands",           usd(1234.56),    "$1,234.56");
check("a hundred thousand",          usd(123456),     "$123.4K");
check("a million",                   usd(5e6),        "$5.0M");
check("a billion",                   usd(2.5e9),      "$2.5B");
check("a trillion",                  usd(1e12),       "$1.0T");
check("beyond anything real",        usd(1e15),       ">$999T");
check("negative, sign before symbol", usd(-12.345),   "-$12.34");

console.log("\nTruncated, never rounded up:");
check("a balance just under a round number", usd(99.9989),  "$99.99");
check("a cost just under a cent",            usd(1234.5678), "$1,234.56");

console.log("\nMissing values do not crash a card:");
check("null",      usd(null),      "$0.00");
check("undefined", usd(undefined), "$0.00");
check("NaN",       usd(NaN),       "$0.00");

console.log("\nOther formatters:");
check("usdShort",  usdShort(1234.5),   "$1.2K");
check("compact",   compact(12900),     "12.9K");
check("percent",   percent(103.6666),  "103.6%");

// The property that actually keeps figures inside their cards.
const extremes = [0, 1e-12, 0.000002, 0.0001, 0.5, 99_999.99, 1e5, 1e6, 1e9,
                  1e12, 1e15, 1e18, -1e12, -0.000001, -99_999.99];
const longest = extremes.map(usd).reduce((a, b) => (b.length > a.length ? b : a));
console.log(`\nlongest output across extremes: ${longest} (${longest.length} chars)`);
if (longest.length > 11) {
  console.log("FAIL: the formatter can still produce an unbounded string.");
  failures++;
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
if (failures) process.exitCode = 1;

// EOF silkllm-frontend/scripts/audit-money.mjs
