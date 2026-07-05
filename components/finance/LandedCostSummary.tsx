"use client";

import * as React from "react";
import { MetricCard, RiskMeter, RiskBadge } from "@/components/ui/primitives";
import type { LandedCostResult } from "@/lib/types";
import { fmtCurrency, fmtPercent } from "@/lib/utils/formatters";
import { Boxes, Percent, TrendingUp, Wallet } from "lucide-react";

/** Summary tiles + margin meter for a computed LandedCostResult. */
export function LandedCostSummary({
  result,
  targetMargin,
}: {
  result: LandedCostResult;
  targetMargin: number;
}) {
  const marginTone = result.grossMargin >= targetMargin ? "emerald" : result.grossMargin > 0 ? "amber" : "danger";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Landed Cost / Unit" value={fmtCurrency(result.landedCostPerUnit)} icon={Boxes} />
        <MetricCard
          label="Gross Margin"
          value={fmtPercent(result.grossMargin)}
          tone={marginTone}
          icon={Percent}
          sub={`Target ${fmtPercent(targetMargin)}`}
        />
        <MetricCard label="Gross Profit / Unit" value={fmtCurrency(result.grossProfitPerUnit)} tone="emerald" icon={TrendingUp} />
        <MetricCard label="Total Cash Needed" value={fmtCurrency(result.totalCashNeeded, "USD", { compact: true })} tone="cyan" icon={Wallet} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="stat-label">Margin vs Target</span>
          <RiskBadge level={result.riskLevel} />
        </div>
        <RiskMeter value={result.grossMargin} target={targetMargin} label="Gross margin" />
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <SummaryStat label="Required Price" value={fmtCurrency(result.requiredPrice)} />
          <SummaryStat label="Break-Even Price" value={fmtCurrency(result.breakEvenPrice)} />
          <SummaryStat label="Max Supplier Cost" value={fmtCurrency(result.maxSupplierCost)} />
          <SummaryStat
            label="Margin Gap"
            value={fmtPercent(result.marginGap)}
            tone={result.marginGap > 0 ? "text-danger" : "text-emerald"}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-2.5">
      <div className="stat-label">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
