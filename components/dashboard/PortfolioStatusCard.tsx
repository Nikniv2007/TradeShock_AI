"use client";

import * as React from "react";
import { Card, SectionTitle, RiskBadge, RiskMeter } from "@/components/ui/primitives";
import type { PortfolioStatus } from "@/lib/store/useStore";
import { fmtCurrency, fmtPercent, fmtNumber } from "@/lib/utils/formatters";
import { Activity, ShieldAlert, TrendingDown, Landmark, Users2 } from "lucide-react";

/** Overall portfolio health card driven by a computed PortfolioStatus. */
export function PortfolioStatusCard({ status }: { status: PortfolioStatus }) {
  return (
    <Card>
      <SectionTitle
        icon={Activity}
        title="Portfolio Status"
        subtitle="Deterministic health across margin, tariff, and concentration risk."
        right={<RiskBadge level={status.status} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCell
          icon={ShieldAlert}
          label="Margin at Risk"
          value={fmtCurrency(status.marginAtRisk, "USD", { compact: true })}
          tone="text-danger"
        />
        <StatCell
          icon={TrendingDown}
          label="SKUs Below Target"
          value={`${fmtNumber(status.skusBelowTarget)} / ${fmtNumber(status.totalSkus)}`}
          tone={status.skusBelowTarget > 0 ? "text-amber" : "text-emerald"}
        />
        <StatCell
          icon={Landmark}
          label="Tariff Exposure"
          value={fmtCurrency(status.tariffExposure, "USD", { compact: true })}
          tone="text-amber"
        />
        <StatCell
          icon={Users2}
          label="Concentration"
          value={fmtPercent(status.topCountryShare)}
          tone={status.topCountryShare > 0.5 ? "text-danger" : "text-ink"}
          sub={status.topCountry}
        />
      </div>

      <div className="mt-4">
        <RiskMeter value={status.avgMargin} target={0.35} label="Average gross margin vs target" />
      </div>
    </Card>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
  tone = "text-ink",
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: React.ReactNode;
  tone?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
      <div className="flex items-center gap-1.5 text-ink-faint">
        <Icon className="h-3.5 w-3.5" />
        <span className="stat-label">{label}</span>
      </div>
      <div className={`mt-1.5 text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}
