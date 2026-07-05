"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import {
  Card, SectionTitle, Slider, Button, MetricCard, ScoreBadge, StatusBadge, DisclaimerBox,
} from "@/components/ui/primitives";
import { EditableDraftBox } from "@/components/ai/AIPanel";
import { HBarChart, CHART_COLORS } from "@/components/charts";
import { analyzePortfolioPricing } from "@/lib/finance/customerPricing";
import { fmtCurrency, fmtPercent, titleCase } from "@/lib/utils/formatters";
import { requestAI } from "@/lib/ai/actions";
import { useStore } from "@/lib/store/useStore";
import type { PricingRecommendation } from "@/lib/types";
import {
  Users, Sparkles, FileWarning, Info, ChevronDown, Percent, Landmark, DollarSign, Target, Mail,
} from "lucide-react";

export default function CustomerPricingPage() {
  return (
    <>
      <PageHeader
        title="Customer Pricing Strategy Engine"
        description="Never apply a flat increase to everyone. Given a blended cost increase, analyze each customer's margin, exposure, and contract to decide who gets a price rise, who gets a surcharge, and who needs a tailored deal."
        icon={Users}
      />
      <NoDataGate>
        <CustomerPricingBody />
      </NoDataGate>
    </>
  );
}

function CustomerPricingBody() {
  const { dataset } = useStore();
  const customers = dataset.customers;
  const [costIncrease, setCostIncrease] = React.useState(12); // percent points
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [ai, setAi] = React.useState<{ data: PricingRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  const results = React.useMemo(
    () => analyzePortfolioPricing(customers, costIncrease / 100),
    [customers, costIncrease]
  );

  const top = results[0];
  const warnings = results.filter((r) => r.contractWarning);
  const totalChurnAdjusted = results.reduce((sum, r) => sum + r.churnAdjustedImpact, 0);
  const surcharge = results.filter((r) => r.recommendedStrategy === "add_surcharge");
  const avgIncrease = results.length
    ? results.reduce((s, r) => s + r.priceIncreaseNeeded, 0) / results.length
    : 0;

  // Illustrative spread: lowest vs highest increase vs a surcharge case.
  const sorted = [...results].sort((a, b) => a.priceIncreaseNeeded - b.priceIncreaseNeeded);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const surchargeCase = surcharge[0];

  const increaseBars = results.map((r) => ({ label: r.customer.name, value: r.priceIncreaseNeeded }));
  const exposureBars = results.map((r) => ({ label: r.customer.name, value: r.tariffExposure }));

  async function generate() {
    if (!top) return;
    setLoadingAi(true);
    const res = await requestAI("customer_pricing", {
      customerName: top.customer.name,
      requiredPriceIncrease: top.priceIncreaseNeeded,
      recommendedStrategy: top.recommendedStrategy,
      targetMargin: 0.35,
    });
    setAi({ data: res.data as PricingRecommendation, source: res.source, warning: res.warning });
    setLoadingAi(false);
  }

  return (
    <div className="space-y-6">
      {/* Intro + control */}
      <Card>
        <SectionTitle
          icon={Info}
          title="Portfolio Cost Pass-Through"
          subtitle="Set the blended landed-cost increase to pass through, then let the engine differentiate by customer."
        />
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <p className="text-sm leading-relaxed text-ink-muted">
            A flat increase overcharges price-sensitive, low-exposure accounts and undercharges high-exposure ones — bleeding
            margin on both ends. The engine below computes the increase <span className="text-ink">each</span> customer actually
            needs from their contribution margin, tariff exposure, contract type, and churn risk, then ranks who to act on first.
          </p>
          <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-4">
            <Slider
              label="Blended landed-cost increase"
              value={costIncrease}
              min={0}
              max={30}
              step={1}
              onChange={setCostIncrease}
              format={(v) => `${v}%`}
            />
          </div>
        </div>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Customers Analyzed" value={String(results.length)} icon={Users} />
        <MetricCard label="Avg Increase Needed" value={fmtPercent(avgIncrease)} sub="not applied flat" tone="amber" icon={Percent} />
        <MetricCard label="Need Surcharge / Tailored" value={String(results.filter((r) => r.recommendedStrategy !== "raise_price").length)} tone="cyan" icon={Target} />
        <MetricCard label="Churn-Adjusted Upside" value={fmtCurrency(totalChurnAdjusted, "USD", { compact: true })} sub="expected annual" tone="emerald" icon={DollarSign} />
      </div>

      {/* Example insight */}
      {lowest && highest && (
        <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
          <SectionTitle title="Why Not a Flat Increase?" subtitle="Same portfolio, very different answers." />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
              <div className="text-xs text-ink-faint">{lowest.customer.name}</div>
              <div className="mt-1 text-lg font-semibold text-emerald">{fmtPercent(lowest.priceIncreaseNeeded)}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">Low exposure — small, quiet increase.</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
              <div className="text-xs text-ink-faint">{highest.customer.name}</div>
              <div className="mt-1 text-lg font-semibold text-amber">{fmtPercent(highest.priceIncreaseNeeded)}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">High exposure — larger pass-through required.</div>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
              <div className="text-xs text-ink-faint">{surchargeCase ? surchargeCase.customer.name : "Fixed-contract accounts"}</div>
              <div className="mt-1 text-lg font-semibold text-cyan">{surchargeCase ? "Surcharge" : "Tailored"}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">{surchargeCase ? "No pass-through clause — use a tariff surcharge." : "Contract limits base-price change."}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Customer table */}
      <Card>
        <SectionTitle title="Customer Pricing Plan" subtitle="Sorted by priority — act top-down. Click a row for the negotiation note." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 text-right font-medium">Annual Rev</th>
                <th className="py-2 pr-3 text-right font-medium">Contrib %</th>
                <th className="py-2 pr-3 text-right font-medium">Exposure</th>
                <th className="py-2 pr-3 text-right font-medium">Increase</th>
                <th className="py-2 pr-3 text-right font-medium">Churn-Adj $</th>
                <th className="py-2 pr-3 text-center font-medium">Priority</th>
                <th className="py-2 pr-3 font-medium">Strategy</th>
                <th className="py-2 pr-1 text-center font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isOpen = expanded === r.customer.id;
                return (
                  <React.Fragment key={r.customer.id}>
                    <tr
                      className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                      onClick={() => setExpanded(isOpen ? null : r.customer.id)}
                    >
                      <td className="py-2.5 pr-3">
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          {r.contractWarning && <FileWarning className="h-3.5 w-3.5 shrink-0 text-amber" />}
                          {r.customer.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-muted">{titleCase(r.customer.type)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-muted">{fmtCurrency(r.customer.annualRevenue, "USD", { compact: true })}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-muted">{fmtPercent(r.contributionMarginPercent)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-muted">{fmtPercent(r.tariffExposure)}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-amber">{fmtPercent(r.priceIncreaseNeeded)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-emerald">{fmtCurrency(r.churnAdjustedImpact, "USD", { compact: true })}</td>
                      <td className="py-2.5 pr-3 text-center"><ScoreBadge score={r.priorityScore} /></td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge tone={r.recommendedStrategy === "add_surcharge" ? "amber" : r.recommendedStrategy === "customer_specific_pricing" ? "cyan" : "neutral"}>
                          {titleCase(r.recommendedStrategy)}
                        </StatusBadge>
                      </td>
                      <td className="py-2.5 pr-1 text-center">
                        <ChevronDown className={`inline h-4 w-4 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-white/[0.04] bg-base-900/40">
                        <td colSpan={10} className="px-3 py-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <div className="stat-label mb-1">Negotiation Note</div>
                              <p className="text-xs text-ink-muted">{r.negotiationNote}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div><span className="text-ink-faint">Contribution margin: </span><span className="text-ink">{fmtCurrency(r.contributionMargin, "USD", { compact: true })}</span></div>
                              <div><span className="text-ink-faint">Contract: </span><span className="text-ink">{titleCase(r.customer.contractType)}</span></div>
                              <div><span className="text-ink-faint">Churn risk: </span><span className="text-ink">{titleCase(r.customer.churnRisk)}</span></div>
                              <div><span className="text-ink-faint">Pass-through clause: </span><span className="text-ink">{r.customer.tariffPassThroughClause ? "Yes" : "No"}</span></div>
                            </div>
                          </div>
                          {r.contractWarning && (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber/25 bg-amber/5 p-2.5 text-[11px] text-amber">
                              <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r.contractWarning}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Risk maps */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={Percent} title="Price Increase Needed by Customer" subtitle="Differentiated pass-through, not a flat rate." />
          <HBarChart data={increaseBars} color={CHART_COLORS.amber} format={(v) => fmtPercent(v)} />
        </Card>
        <Card>
          <SectionTitle icon={Landmark} title="Tariff Exposure by Customer" subtitle="Share of revenue exposed to import duties." />
          <HBarChart data={exposureBars} color={CHART_COLORS.cyan} format={(v) => fmtPercent(v)} />
        </Card>
      </div>

      {/* Contract warnings */}
      <Card>
        <SectionTitle icon={FileWarning} title="Contract Clause Warnings" subtitle="Fixed contracts without a tariff pass-through clause — legal review before repricing." />
        {warnings.length === 0 ? (
          <p className="text-sm text-emerald">No blocking contract clauses detected at this cost-increase level.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {warnings.map((r) => (
              <div key={r.customer.id} className="rounded-lg border border-amber/25 bg-amber/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-amber"><FileWarning className="h-4 w-4" /> {r.customer.name}</span>
                  <StatusBadge tone="amber">{titleCase(r.customer.contractType)}</StatusBadge>
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">{r.contractWarning}</p>
                <p className="mt-1 text-[11px] text-ink-faint">Recommended: {titleCase(r.recommendedStrategy)} · needs {fmtPercent(r.priceIncreaseNeeded)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI drafts for top-priority customer */}
      {top && (
        <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.04] to-transparent">
          <SectionTitle
            icon={Sparkles}
            title="AI Drafts — Top-Priority Customer"
            subtitle={`${top.customer.name} · priority ${top.priorityScore}/100 · ${titleCase(top.recommendedStrategy)} (~${fmtPercent(top.priceIncreaseNeeded)})`}
            right={<Button variant="primary" onClick={generate} disabled={loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Generating…" : ai ? "Regenerate" : "Generate Drafts"}</Button>}
          />
          {!ai ? (
            <p className="text-sm text-ink-muted">
              Generate an editable customer email and internal account-manager notes for <span className="text-ink">{top.customer.name}</span>,
              the highest-priority account to act on at a {costIncrease}% blended cost increase.
            </p>
          ) : (
            <div className="space-y-4">
              {ai.warning && <div className="text-[11px] text-amber">{ai.warning}</div>}
              {ai.source && ai.source !== "mock" && <div className="text-[11px] text-emerald">Live AI · {ai.source.replace("live-", "")}</div>}
              <p className="text-sm leading-relaxed text-ink-muted">{ai.data.summary}</p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex items-center gap-1.5 text-xs text-ink-muted"><Mail className="h-3.5 w-3.5" /> Customer &amp; internal drafts — edit before sending.</div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <EditableDraftBox label={`Customer Email — ${top.customer.name}`} value={ai.data.customerMessage} />
                <EditableDraftBox label="Internal Account-Manager Notes" value={ai.data.internalMemo} />
              </div>
            </div>
          )}
        </Card>
      )}

      <DisclaimerBox variant="contract">
        Generated clauses, customer notices, and supplier scripts are drafting support only. Have an attorney review before use.
      </DisclaimerBox>
    </div>
  );
}
