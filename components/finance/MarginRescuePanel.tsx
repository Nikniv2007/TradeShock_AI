"use client";

import * as React from "react";
import { Card, SectionTitle, MetricCard, StatusBadge } from "@/components/ui/primitives";
import { fmtPercent, fmtCurrency } from "@/lib/utils/formatters";
import { HeartPulse, TrendingUp, Shield } from "lucide-react";

/** Presentational rescue summary: required price move, absorbable cost, and strategy options. */
export function MarginRescuePanel({
  requiredPriceIncrease,
  maxAbsorbableCostIncrease,
  bestStrategy,
  alternatives,
}: {
  requiredPriceIncrease: number;
  maxAbsorbableCostIncrease: number;
  bestStrategy: string;
  alternatives: { strategy: string; rationale: string }[];
}) {
  return (
    <Card>
      <SectionTitle
        icon={HeartPulse}
        title="Margin Rescue Plan"
        subtitle="Deterministic price and cost levers to restore target margin."
        right={<StatusBadge tone="amber">{bestStrategy}</StatusBadge>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCard
          label="Required Price Increase"
          value={fmtPercent(requiredPriceIncrease)}
          tone="amber"
          icon={TrendingUp}
          sub="to restore target margin"
        />
        <MetricCard
          label="Max Absorbable Cost Increase"
          value={fmtCurrency(maxAbsorbableCostIncrease)}
          tone="cyan"
          icon={Shield}
          sub="before breaching target"
        />
      </div>

      {alternatives.length > 0 && (
        <div className="mt-4">
          <h5 className="stat-label mb-2">Alternative Strategies</h5>
          <div className="space-y-2">
            {alternatives.map((alt, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
                <div className="text-sm font-medium text-ink">{alt.strategy}</div>
                <div className="mt-0.5 text-xs text-ink-muted">{alt.rationale}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
