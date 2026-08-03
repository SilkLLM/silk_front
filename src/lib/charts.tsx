/**
 * charts.tsx
 * The chart layer: one place that owns colour, chrome, and the tooltip so every
 * chart in the dashboard reads as the same system.
 *
 * The categorical order below is not cosmetic - it was chosen by enumerating
 * orderings and keeping only those that clear the colour-vision-deficiency and
 * normal-vision separation gates on *both* surfaces. Worst adjacent pair:
 * CVD dE 9.2, normal-vision dE 18.2 (OKLab x100). Dark is its own set of steps
 * for the dark surface, not an automatic flip of the light one.
 *
 * Three of the light steps sit under 3:1 against white. That is allowed here
 * because every chart ships identity through a legend or a direct label and the
 * underlying numbers are always available as a table or tooltip - colour is
 * never the only channel.
 */

// File: silkllm-frontend/src/lib/charts.tsx

import React from "react";
import { useTheme } from "@/hooks/useTheme";

export const CHART_SERIES = {
  light: ["#D29A2D", "#e87ba4", "#008300", "#2a78d6", "#e34948", "#4a3aa7", "#1baf7a", "#eb6834"],
  dark:  ["#BC8A20", "#d55181", "#008300", "#3987e5", "#e66767", "#9085e9", "#199e70", "#d95926"],
} as const;

const CHROME = {
  light: { grid: "#E8E5DE", axis: "#D5D1C7", tick: "#8A857D", surface: "#FFFFFF", ink: "#1A1918", ink2: "#57534E", line: "#E5E2DB" },
  dark:  { grid: "#24282A", axis: "#343A3C", tick: "#7C7872", surface: "#1E2122", ink: "#F2F1EE", ink2: "#A8A49C", line: "#2A2E30" },
} as const;

export function useChartTheme() {
  const { resolved } = useTheme();
  const series = CHART_SERIES[resolved];
  const chrome = CHROME[resolved];

  return {
    mode: resolved,
    series,
    /** Colour for slot `i`. Assigned in fixed order and never cycled past 8 -
     *  callers with more entities fold the tail into "Other". */
    seriesAt: (i: number) => series[Math.min(i, series.length - 1)],
    ...chrome,
    /** Props shared by every axis so chrome stays recessive and consistent. */
    axisProps: {
      tick: { fontSize: 11, fill: chrome.tick },
      tickLine: false,
      axisLine: { stroke: chrome.axis },
      stroke: chrome.axis,
    },
    gridProps: {
      stroke: chrome.grid,
      strokeDasharray: "0", // hairline solid, never dashed
      vertical: false,
    },
  };
}

/**
 * A shared tooltip. Values wear text tokens; identity comes from the colour
 * swatch beside the label, never from colouring the text itself.
 */
export function ChartTooltip({
  active, payload, label, formatter, labelFormatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
  formatter?: (value: any, name?: string) => string;
  labelFormatter?: (label: any) => string;
}) {
  const t = useChartTheme();
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-raised text-xs"
      style={{ background: t.surface, borderColor: t.line, color: t.ink }}
    >
      {label !== undefined && label !== null && (
        <p className="font-medium mb-1" style={{ color: t.ink }}>
          {labelFormatter ? labelFormatter(label) : String(label)}
        </p>
      )}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: p.color || p.fill || t.tick }}
            />
            <span style={{ color: t.ink2 }}>{p.name}</span>
            <span className="ml-auto font-medium num" style={{ color: t.ink }}>
              {formatter ? formatter(p.value, p.name) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A legend built from text tokens plus a colour swatch. Present whenever a chart
 * carries two or more series.
 */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ── Number formatting ──────────────────────────────────────────────────────
// Re-exported from lib/money so the sixty-odd call sites that import these from
// here keep working, while the rule itself lives in exactly one place. Printing
// per-request costs at six decimals is what pushed money out of its card on
// several pages; the rule is now capped at four and bounded at both ends.

export { usd, usdPrecise, usdShort, compact, percent } from "@/lib/money";

// EOF silkllm-frontend/src/lib/charts.tsx
