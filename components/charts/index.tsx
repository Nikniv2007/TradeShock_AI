"use client";

import * as React from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, ZAxis,
} from "recharts";
import { fmtCurrency, fmtPercent } from "@/lib/utils/formatters";

export const CHART_COLORS = {
  slate: "#7c8cff",
  cyan: "#3ec7e0",
  amber: "#f5a623",
  emerald: "#2dd4a7",
  danger: "#ff5b6a",
  grid: "rgba(255,255,255,0.06)",
  axis: "#6b7890",
};

const CATEGORICAL = [CHART_COLORS.slate, CHART_COLORS.cyan, CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.danger, "#a78bfa", "#f472b6", "#60a5fa"];

const tooltipStyle = {
  contentStyle: {
    background: "#0d121d",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    fontSize: 12,
    color: "#e6edf7",
  },
  labelStyle: { color: "#9aa7bd", marginBottom: 4 },
  itemStyle: { color: "#e6edf7" },
};

// ─── Landed Cost Waterfall ───
export function LandedCostWaterfall({ data }: { data: { label: string; value: number }[] }) {
  // Build cumulative floating bars.
  let cumulative = 0;
  const bars = data.map((d, i) => {
    const start = cumulative;
    cumulative += d.value;
    const isTotal = i === data.length - 1;
    return { label: d.label, base: isTotal ? 0 : start, value: isTotal ? cumulative : d.value, isTotal };
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={50} />
        <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={(v) => fmtCurrency(v, "USD", { compact: true, decimals: 0 })} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
          {bars.map((b, i) => (
            <Cell key={i} fill={b.isTotal ? CHART_COLORS.slate : i === 0 ? CHART_COLORS.cyan : CHART_COLORS.amber} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Cost breakdown donut ───
export function CostBreakdownDonut({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9aa7bd" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Margin exposure by category ───
export function MarginExposureChart({ data }: { data: { category: string; margin: number; atRisk: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="category" tick={{ fill: CHART_COLORS.axis, fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={50} />
        <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip {...tooltipStyle} formatter={(v: number, n) => (n === "margin" ? `${v}%` : fmtCurrency(v, "USD", { compact: true }))} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar name="Avg Margin %" dataKey="margin" fill={CHART_COLORS.emerald} radius={[3, 3, 0, 0]} />
        <Bar name="Margin at Risk" dataKey="atRisk" fill={CHART_COLORS.danger} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Scenario line chart ───
export function ScenarioImpactChart({ data }: { data: { name: string; current: number; scenario: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: CHART_COLORS.axis, fontSize: 9 }} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtPercent(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke={CHART_COLORS.danger} strokeDasharray="3 3" />
        <Line name="Current Margin" dataKey="current" stroke={CHART_COLORS.cyan} strokeWidth={2} dot={false} />
        <Line name="Scenario Margin" dataKey="scenario" stroke={CHART_COLORS.amber} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Supplier risk matrix (scatter) ───
export function SupplierRiskMatrix({ data }: { data: { name: string; cost: number; reliability: number; exposure: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 20 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} />
        <XAxis type="number" dataKey="cost" name="Cost competitiveness" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} domain={[0, 100]} label={{ value: "Cost competitiveness →", fill: CHART_COLORS.axis, fontSize: 10, position: "bottom" }} />
        <YAxis type="number" dataKey="reliability" name="Reliability" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} domain={[0, 100]} label={{ value: "Reliability →", angle: -90, fill: CHART_COLORS.axis, fontSize: 10, position: "insideLeft" }} />
        <ZAxis type="number" dataKey="exposure" range={[60, 400]} name="Exposure" />
        <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: "3 3" }} formatter={(v: number, n) => (n === "Exposure" ? fmtPercent(v) : v)} />
        <Scatter data={data} fill={CHART_COLORS.slate}>
          {data.map((d, i) => <Cell key={i} fill={d.reliability < 75 ? CHART_COLORS.danger : d.reliability < 85 ? CHART_COLORS.amber : CHART_COLORS.emerald} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── Generic horizontal bar ───
export function HBarChart({ data, color = CHART_COLORS.slate, format }: { data: { label: string; value: number }[]; color?: string; format?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={format} />
        <YAxis type="category" dataKey="label" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} width={130} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => (format ? format(v) : v)} />
        <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Sensitivity line (FX / freight) ───
export function SensitivityChart({ data, xLabel, color = CHART_COLORS.amber }: { data: { x: number; margin: number }[]; xLabel: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="x" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} label={{ value: xLabel, fill: CHART_COLORS.axis, fontSize: 10, position: "bottom" }} />
        <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtPercent(v)} />
        <ReferenceLine y={0} stroke={CHART_COLORS.danger} strokeDasharray="3 3" />
        <Line dataKey="margin" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Heatmap cell grid (products × scenarios) ───
export function MarginHeatmap({
  rows,
  cols,
  cell,
}: {
  rows: string[];
  cols: string[];
  cell: (r: number, c: number) => { margin: number; level: "safe" | "watch" | "warning" | "critical" };
}) {
  const bg: Record<string, string> = {
    safe: "bg-emerald/20 text-emerald",
    watch: "bg-cyan/20 text-cyan",
    warning: "bg-amber/20 text-amber",
    critical: "bg-danger/25 text-danger",
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-base-850 px-2 py-1.5 text-left font-medium text-ink-faint"></th>
            {cols.map((c) => (
              <th key={c} className="px-2 py-1.5 text-center font-medium text-ink-muted">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <td className="sticky left-0 z-10 max-w-[160px] truncate bg-base-850 px-2 py-1.5 font-medium text-ink" title={r}>{r}</td>
              {cols.map((_, ci) => {
                const { margin, level } = cell(ri, ci);
                return (
                  <td key={ci} className={`rounded px-2 py-1.5 text-center font-mono tabular-nums ${bg[level]}`}>
                    {(margin * 100).toFixed(0)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
