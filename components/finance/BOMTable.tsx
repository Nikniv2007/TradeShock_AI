"use client";

import * as React from "react";
import { StatusBadge } from "@/components/ui/primitives";
import { fmtCurrency, fmtPercent } from "@/lib/utils/formatters";
import type { BOMAnalysis, ComponentAnalysis } from "@/lib/finance/bomCalculations";

/**
 * Props-driven BOM exposure table. Renders a BOMAnalysis from analyzeBOM() —
 * rolls each component up to the finished good and highlights rows where tariff
 * share noticeably exceeds cost share (exposure concentrated, not proportional).
 */
export function BOMTable({ analysis }: { analysis: BOMAnalysis }) {
  const { components } = analysis;

  if (components.length === 0) {
    return <p className="text-sm text-ink-faint">This BOM has no components to analyze.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-3 font-medium">Component</th>
            <th className="px-2 py-2 font-medium">Supplier</th>
            <th className="px-2 py-2 font-medium">Country</th>
            <th className="px-2 py-2 text-right font-medium">Landed / FG</th>
            <th className="px-2 py-2 text-right font-medium">Tariff / FG</th>
            <th className="px-2 py-2 text-right font-medium">Cost share</th>
            <th className="px-2 py-2 text-right font-medium">Tariff share</th>
            <th className="px-2 py-2 text-center font-medium">Critical</th>
            <th className="px-2 py-2 text-center font-medium">Substitute</th>
          </tr>
        </thead>
        <tbody>
          {components.map((a: ComponentAnalysis) => {
            const c = a.component;
            const skewed = a.tariffSharePercent > a.costSharePercent + 0.05;
            return (
              <tr key={c.id} className={`border-b border-white/[0.04] ${skewed ? "bg-amber/[0.06]" : ""}`}>
                <td className="py-2 pr-3 font-medium text-ink">
                  {skewed && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber align-middle" title="Tariff share exceeds cost share" />}
                  {c.componentName}
                </td>
                <td className="px-2 py-2 text-ink-muted">{c.supplierName ?? "—"}</td>
                <td className="px-2 py-2 text-ink-muted">{c.countryOfOrigin}</td>
                <td className="px-2 py-2 text-right tabular-nums text-cyan">{fmtCurrency(a.landedCostPerFinishedGood)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-amber">{fmtCurrency(a.tariffCostPerFinishedGood)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtPercent(a.costSharePercent)}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-medium ${skewed ? "text-amber" : "text-ink"}`}>{fmtPercent(a.tariffSharePercent)}</td>
                <td className="px-2 py-2 text-center">
                  {c.criticalComponent ? <StatusBadge tone="danger">Critical</StatusBadge> : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-2 py-2 text-center text-xs">
                  {c.substituteAvailable ? <span className="text-emerald">Yes</span> : <span className="text-ink-faint">No</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-left text-xs text-ink-muted">
            <td className="py-2 pr-3 font-semibold text-ink" colSpan={3}>Finished good</td>
            <td className="px-2 py-2 text-right tabular-nums font-semibold text-cyan">{fmtCurrency(analysis.totalBOMCost)}</td>
            <td className="px-2 py-2 text-right tabular-nums font-semibold text-amber">{fmtCurrency(analysis.totalTariffExposure)}</td>
            <td className="px-2 py-2 text-right tabular-nums">100%</td>
            <td className="px-2 py-2 text-right tabular-nums">100%</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
