"use client";

import * as React from "react";
import { ScoreBadge, StatusBadge } from "@/components/ui/primitives";
import { fmtCurrency, fmtPercent, titleCase } from "@/lib/utils/formatters";
import type { CustomerPricingResult } from "@/lib/finance/customerPricing";
import { AlertTriangle } from "lucide-react";

/**
 * Props-driven customer pricing table. Renders sorted CustomerPricingResult[]
 * from analyzePortfolioPricing() — where to pass through cost increases first,
 * prioritized by exposure, thin margins, and missing pass-through clauses.
 */
export function CustomerPricingTable({ results }: { results: CustomerPricingResult[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-ink-faint">No customers to analyze.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-3 font-medium">Customer</th>
            <th className="px-2 py-2 font-medium">Type</th>
            <th className="px-2 py-2 text-right font-medium">Annual revenue</th>
            <th className="px-2 py-2 text-right font-medium">Contribution %</th>
            <th className="px-2 py-2 text-right font-medium">Tariff exposure</th>
            <th className="px-2 py-2 text-right font-medium">Price ↑ needed</th>
            <th className="px-2 py-2 text-right font-medium">Churn-adj impact</th>
            <th className="px-2 py-2 text-center font-medium">Priority</th>
            <th className="px-2 py-2 font-medium">Strategy</th>
            <th className="px-2 py-2 text-center font-medium">Contract</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r: CustomerPricingResult) => {
            const thin = r.contributionMarginPercent < 0.2;
            return (
              <tr key={r.customer.id} className="border-b border-white/[0.04]">
                <td className="py-2 pr-3">
                  <div className="font-medium text-ink">{r.customer.name}</div>
                  <div className="text-[11px] text-ink-faint">{titleCase(r.customer.contractType)} · {r.customer.churnRisk} churn</div>
                </td>
                <td className="px-2 py-2 text-ink-muted">{titleCase(r.customer.type)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtCurrency(r.customer.annualRevenue, "USD", { compact: true, decimals: 0 })}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-medium ${thin ? "text-amber" : "text-ink"}`}>{fmtPercent(r.contributionMarginPercent)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtPercent(r.tariffExposure)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-amber">{fmtPercent(r.priceIncreaseNeeded)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-cyan">{fmtCurrency(r.churnAdjustedImpact, "USD", { compact: true, decimals: 0 })}</td>
                <td className="px-2 py-2 text-center"><ScoreBadge score={r.priorityScore} /></td>
                <td className="px-2 py-2">
                  <StatusBadge tone={r.recommendedStrategy === "add_surcharge" ? "amber" : r.recommendedStrategy === "customer_specific_pricing" ? "cyan" : "neutral"}>
                    {titleCase(r.recommendedStrategy)}
                  </StatusBadge>
                </td>
                <td className="px-2 py-2 text-center">
                  {r.contractWarning ? (
                    <span className="inline-flex items-center gap-1 text-danger" title={r.contractWarning}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
