"use client";

import * as React from "react";
import { ScoreBadge, RiskBadge } from "@/components/ui/primitives";
import { fmtCurrency, fmtPercent } from "@/lib/utils/formatters";
import type { SupplierComparison, SupplierEvaluation } from "@/lib/finance/supplierScoring";

/**
 * Props-driven supplier comparison table. Renders a SupplierComparison from
 * compareSuppliers() — landed margin, cash-flow, and operational-risk view side
 * by side. Best-margin and best-cashflow rows are highlighted.
 */
export function SupplierComparisonTable({ comparison }: { comparison: SupplierComparison }) {
  const { evaluations, bestByMargin, bestByCashFlow } = comparison;

  if (evaluations.length === 0) {
    return <p className="text-sm text-ink-faint">Add at least two suppliers to compare.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-3 font-medium">Supplier</th>
            <th className="px-2 py-2 text-right font-medium">Landed / unit</th>
            <th className="px-2 py-2 text-right font-medium">Defect-adj cost</th>
            <th className="px-2 py-2 text-right font-medium">Gross margin</th>
            <th className="px-2 py-2 text-right font-medium">Cash in MOQ</th>
            <th className="px-2 py-2 text-right font-medium">Working capital</th>
            <th className="px-2 py-2 text-right font-medium">Payment burden</th>
            <th className="px-2 py-2 text-center font-medium">Supplier</th>
            <th className="px-2 py-2 text-center font-medium">Risk</th>
            <th className="px-2 py-2 text-center font-medium">Cash flow</th>
            <th className="px-2 py-2 text-right font-medium">Payback</th>
            <th className="px-2 py-2 text-right font-medium">Δ Margin</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((e: SupplierEvaluation) => {
            const isBestMargin = bestByMargin?.option.id === e.option.id;
            const isBestCash = bestByCashFlow?.option.id === e.option.id;
            const rowTone = isBestMargin
              ? "bg-emerald/[0.06]"
              : isBestCash
                ? "bg-cyan/[0.06]"
                : "";
            const improved = e.marginImprovementVsCurrent > 0;
            return (
              <tr key={e.option.id} className={`border-b border-white/[0.04] ${rowTone}`}>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5 font-medium text-ink">
                    {isBestMargin && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald align-middle" title="Best margin" />}
                    {isBestCash && <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan align-middle" title="Best cash flow" />}
                    {e.option.name}
                    {e.option.isCurrent && <span className="ml-1 text-[10px] uppercase tracking-wide text-ink-faint">current</span>}
                  </div>
                  <div className="text-[11px] text-ink-faint">{e.option.country} · {e.option.currency}</div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtCurrency(e.landedCostPerUnit)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtCurrency(e.defectAdjustedCost)}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-medium ${isBestMargin ? "text-emerald" : "text-ink"}`}>{fmtPercent(e.grossMargin)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtCurrency(e.cashTiedInMOQ)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtCurrency(e.workingCapital)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{e.paymentTermCashBurden}</td>
                <td className="px-2 py-2 text-center"><ScoreBadge score={100 - e.supplierScore} /></td>
                <td className="px-2 py-2 text-center"><RiskBadge level={e.riskLevel} /></td>
                <td className="px-2 py-2 text-center"><ScoreBadge score={100 - e.cashFlowScore} /></td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{e.switchingPaybackMonths > 0 ? `${e.switchingPaybackMonths} mo` : "—"}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-medium ${improved ? "text-emerald" : e.marginImprovementVsCurrent < 0 ? "text-danger" : "text-ink-muted"}`}>
                  {improved ? "+" : ""}{fmtPercent(e.marginImprovementVsCurrent)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
