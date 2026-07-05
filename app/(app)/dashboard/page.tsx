"use client";

import * as React from "react";
import Link from "next/link";
import { useStore, computePortfolioStatus } from "@/lib/store/useStore";
import { NoDataGate } from "@/components/layout/NoDataGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard, Card, SectionTitle, RiskBadge, Button, DisclaimerBox } from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { MarginExposureChart, LandedCostWaterfall, SupplierRiskMatrix, MarginHeatmap, CostBreakdownDonut } from "@/components/charts";
import { fmtCurrency, fmtPercent, fmtDays, fmtNumber, titleCase } from "@/lib/utils/formatters";
import { calculateLandedCost } from "@/lib/finance/calculations";
import { runScenario } from "@/lib/finance/scenarioEngine";
import { scanPurchaseOrder } from "@/lib/finance/poRisk";
import { supplierConcentration } from "@/lib/finance/riskScoring";
import { requestAI } from "@/lib/ai/actions";
import type { RiskQueueItem, RiskLevel } from "@/lib/types";
import {
  LayoutDashboard, Boxes, Percent, TrendingDown, ShieldAlert, Landmark, Wallet,
  PackageOpen, Users2, Timer, AlertOctagon, Tag, Sparkles, ArrowRight, Activity,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="War Room Dashboard"
        description="Portfolio-wide command center for tariff, supplier, and margin risk."
        icon={LayoutDashboard}
      />
      <NoDataGate>
        <DashboardBody />
      </NoDataGate>
    </>
  );
}

function DashboardBody() {
  const { dataset } = useStore();
  const { products, suppliers, purchaseOrders, scenarios } = dataset;
  const status = React.useMemo(() => computePortfolioStatus(dataset), [dataset]);
  const [selectedProductId, setSelectedProductId] = React.useState(products[0]?.id);
  const [ai, setAi] = React.useState<Awaited<ReturnType<typeof requestAI>> | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  const conc = React.useMemo(() => supplierConcentration(products, suppliers), [products, suppliers]);
  const severe = scenarios.find((s) => s.name === "Severe Tariff Shock") ?? scenarios[1];
  const rollup = React.useMemo(() => runScenario(products, severe), [products, severe]);

  // Category margin exposure
  const categoryData = React.useMemo(() => {
    const map = new Map<string, { marginSum: number; count: number; atRisk: number }>();
    for (const r of rollup.results) {
      const cur = map.get(r.category) ?? { marginSum: 0, count: 0, atRisk: 0 };
      cur.marginSum += r.currentMargin;
      cur.count += 1;
      cur.atRisk += r.grossProfitAtRisk;
      map.set(r.category, cur);
    }
    return [...map.entries()].map(([category, v]) => ({
      category,
      margin: Math.round((v.marginSum / v.count) * 100),
      atRisk: Math.round(v.atRisk),
    }));
  }, [rollup]);

  // Selected product landed cost + waterfall
  const selected = products.find((p) => p.id === selectedProductId) ?? products[0];
  const landed = React.useMemo(() => {
    if (!selected) return null;
    const qty = Math.max(1, selected.monthlyDemand);
    return calculateLandedCost({
      incoterm: "FOB", supplierUnitCost: selected.supplierUnitCost, quantity: qty,
      freightTotal: selected.freightPerUnit * qty, insuranceTotal: qty * 0.1, brokerFees: qty * 0.15,
      portFees: qty * 0.1, handlingFees: qty * 0.08, warehouseFees: qty * 0.05, domesticDeliveryFees: qty * 0.12,
      inspectionFees: qty * 0.05, otherFees: selected.otherFeesPerUnit * qty, tariffRate: selected.currentTariffRate,
      additionalTariffRate: selected.additionalTariffRate, sellingPrice: selected.sellingPrice,
      targetMargin: selected.targetMargin, currency: "USD",
    });
  }, [selected]);

  const waterfall = landed
    ? [
        { label: "Supplier", value: selected!.supplierUnitCost },
        { label: "Freight", value: landed.freightPerUnit },
        { label: "Insurance", value: landed.insurancePerUnit },
        { label: "Duty/Tariff", value: landed.dutyPerUnit + landed.additionalTariffPerUnit },
        { label: "Fees", value: landed.fixedFeesPerUnit },
        { label: "Landed Cost", value: 0 },
      ]
    : [];

  // Supplier risk matrix
  const supplierMatrix = suppliers.map((s) => ({
    name: s.name,
    cost: Math.round(100 - s.defectRate * 200 - (s.averageLeadTimeDays > 40 ? 15 : 0)),
    reliability: s.reliabilityScore,
    exposure: s.country === conc.topCountry ? conc.topCountryShare : 0.15,
  }));

  // Heatmap: top products × scenarios
  const heatProducts = rollup.results.slice(0, 8);
  const heatScenarios = scenarios.slice(0, 6);

  // Risk queue
  const riskQueue = React.useMemo<RiskQueueItem[]>(() => {
    const items: RiskQueueItem[] = [];
    for (const po of purchaseOrders) {
      const scan = scanPurchaseOrder(po, products, suppliers, { supplierCountryShare: conc.topCountryShare });
      if (scan.riskLevel === "critical" || scan.riskLevel === "warning") {
        items.push({
          id: po.id, type: "critical_po", title: `${po.poNumber} — ${scan.recommendation.toUpperCase()}`,
          financialImpact: scan.totalCashNeeded, priority: scan.riskLevel === "critical" ? "urgent" : "high",
          recommendedAction: `Ties up ${fmtCurrency(scan.totalCashNeeded, "USD", { compact: true })} · ${scan.inventoryDaysCreated}d inventory`,
          route: "/po-scanner",
        });
      }
    }
    for (const r of rollup.results.filter((r) => r.scenarioMargin < 0).slice(0, 3)) {
      items.push({ id: r.productId, type: "unprofitable_sku", title: `${r.name} unprofitable under severe shock`, financialImpact: r.grossProfitAtRisk, priority: "high", recommendedAction: `Reprice +${fmtPercent(r.requiredPriceIncrease)} or switch supplier`, route: "/margin-rescue" });
    }
    if (conc.topCountryShare > 0.5) {
      items.push({ id: "conc", type: "supplier_concentration", title: `Supplier concentration in ${conc.topCountry}`, financialImpact: status.tariffExposure, priority: "medium", recommendedAction: `${fmtPercent(conc.topCountryShare)} exposure — qualify an alternate`, route: "/supplier-map" });
    }
    return items.sort((a, b) => b.financialImpact - a.financialImpact).slice(0, 6);
  }, [purchaseOrders, products, suppliers, conc, rollup, status]);

  async function generateBriefing() {
    setLoadingAi(true);
    const worst = [...rollup.results].sort((a, b) => a.scenarioMargin - b.scenarioMargin)[0];
    const res = await requestAI("war_room_brief", {
      portfolioStatus: status.status, skusBelowTarget: status.skusBelowTarget, marginAtRisk: status.marginAtRisk,
      tariffExposure: status.tariffExposure, topCountry: conc.topCountry, topCountryShare: conc.topCountryShare,
      criticalPOs: status.criticalPOs, worstSku: worst?.name, worstPriceIncrease: worst?.requiredPriceIncrease,
    });
    setAi(res);
    setLoadingAi(false);
  }

  return (
    <div className="space-y-6">
      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <MetricCard label="Total SKUs" value={fmtNumber(status.totalSkus)} icon={Boxes} />
        <MetricCard label="Avg Gross Margin" value={fmtPercent(status.avgMargin)} tone={status.avgMargin >= 0.35 ? "emerald" : "amber"} icon={Percent} />
        <MetricCard label="SKUs Below Target" value={fmtNumber(status.skusBelowTarget)} tone={status.skusBelowTarget > 0 ? "amber" : "emerald"} icon={TrendingDown} sub="under severe shock" />
        <MetricCard label="Margin at Risk" value={fmtCurrency(status.marginAtRisk, "USD", { compact: true })} tone="danger" icon={ShieldAlert} />
        <MetricCard label="Tariff Exposure" value={fmtCurrency(status.tariffExposure, "USD", { compact: true })} tone="amber" icon={Landmark} sub="monthly duties" />
        <MetricCard label="Open PO Value" value={fmtCurrency(status.openPOValue, "USD", { compact: true })} icon={PackageOpen} />
        <MetricCard label="Cash in Inventory" value={fmtCurrency(status.cashTiedInInventory, "USD", { compact: true })} tone="cyan" icon={Wallet} />
        <MetricCard label="Concentration" value={fmtPercent(conc.topCountryShare)} tone={conc.topCountryShare > 0.5 ? "danger" : "neutral"} icon={Activity} sub={conc.topCountry} />
        <MetricCard label="High-Risk Suppliers" value={fmtNumber(status.highRiskSuppliers)} tone={status.highRiskSuppliers > 0 ? "amber" : "emerald"} icon={Users2} />
        <MetricCard label="Critical POs" value={fmtNumber(status.criticalPOs)} tone={status.criticalPOs > 0 ? "danger" : "emerald"} icon={AlertOctagon} />
        <MetricCard label="Avg Lead Time" value={fmtDays(status.avgLeadTime)} icon={Timer} />
        <MetricCard label="Need Price Action" value={fmtNumber(status.productsNeedingPriceAction)} tone="amber" icon={Tag} />
      </div>

      {/* AI Briefing */}
      <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
        <SectionTitle
          icon={Sparkles}
          title="AI War Room Briefing"
          subtitle="Deterministic risk figures, summarized into an executive brief."
          right={<Button variant="primary" onClick={generateBriefing} disabled={loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Generating…" : ai ? "Regenerate" : "Generate Briefing"}</Button>}
        />
        {!ai ? (
          <StaticBriefing status={status} conc={conc} rollup={rollup} products={products} />
        ) : (
          <ExecBriefRender data={ai.data as never} source={ai.source} />
        )}
      </Card>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={Percent} title="Margin Exposure by Category" subtitle="Average margin vs gross profit at risk (severe scenario)." />
          {categoryData.length > 0 ? <MarginExposureChart data={categoryData} /> : <p className="text-sm text-ink-faint">No category data.</p>}
        </Card>
        <Card>
          <SectionTitle
            icon={Boxes}
            title="Landed Cost Waterfall"
            subtitle={`Per-unit cost build-up for ${selected?.name ?? "—"}.`}
            right={
              <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="input max-w-[180px] py-1 text-xs">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            }
          />
          {waterfall.length > 0 && <LandedCostWaterfall data={waterfall} />}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={Users2} title="Supplier Risk Matrix" subtitle="Cost competitiveness vs reliability. Bubble size = country exposure." />
          <SupplierRiskMatrix data={supplierMatrix} />
        </Card>
        <Card>
          <SectionTitle icon={ShieldAlert} title="Tariff Sensitivity Heatmap" subtitle="Resulting margin per SKU across scenarios." />
          {heatProducts.length > 0 && (
            <MarginHeatmap
              rows={heatProducts.map((p) => p.name)}
              cols={heatScenarios.map((s) => s.name.replace(/ (Tariff |Shock|Crisis)/g, " ").slice(0, 12))}
              cell={(ri, ci) => {
                const product = products.find((p) => p.id === heatProducts[ri].productId)!;
                const rr = runScenario([product], heatScenarios[ci]).results[0];
                return { margin: rr.scenarioMargin, level: rr.riskLevel };
              }}
            />
          )}
        </Card>
      </div>

      {/* Risk Queue */}
      <Card>
        <SectionTitle icon={AlertOctagon} title="Risk Queue" subtitle="Prioritized by financial impact." />
        {riskQueue.length === 0 ? (
          <p className="text-sm text-emerald">No urgent items — portfolio is stable under current assumptions.</p>
        ) : (
          <div className="space-y-2">
            {riskQueue.map((item) => (
              <Link key={item.id} href={item.route} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-base-900/50 p-3 transition-colors hover:border-slateaccent/30">
                <div className="flex min-w-0 items-center gap-3">
                  <QueueIcon type={item.type} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    <p className="truncate text-xs text-ink-muted">{item.recommendedAction}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-danger">{fmtCurrency(item.financialImpact, "USD", { compact: true })}</div>
                    <div className="text-[10px] uppercase tracking-wide text-ink-faint">{item.priority}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-faint" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <DisclaimerBox variant="financial">
        Forecasts and scenarios are estimates based on demo data and assumptions. They are not guarantees of future costs,
        margins, demand, or profitability. All demo data is fictional.
      </DisclaimerBox>
    </div>
  );
}

function QueueIcon({ type }: { type: RiskQueueItem["type"] }) {
  const map = {
    critical_po: { icon: PackageOpen, tone: "bg-danger/10 text-danger" },
    unprofitable_sku: { icon: TrendingDown, tone: "bg-amber/10 text-amber" },
    hts_uncertainty: { icon: ShieldAlert, tone: "bg-amber/10 text-amber" },
    supplier_concentration: { icon: Users2, tone: "bg-cyan/10 text-cyan" },
    price_action: { icon: Tag, tone: "bg-amber/10 text-amber" },
  } as const;
  const { icon: Icon, tone } = map[type];
  return <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></div>;
}

function StaticBriefing({ status, conc, rollup, products }: any) {
  const worst = [...rollup.results].sort((a: any, b: any) => a.scenarioMargin - b.scenarioMargin)[0];
  const needPrice = rollup.results.find((r: any) => r.requiredPriceIncrease > 0.1);
  const findings = [
    `${status.skusBelowTarget} SKUs fall below the target margin under the Severe Tariff scenario.`,
    needPrice && `${needPrice.name} requires a ${fmtPercent(needPrice.requiredPriceIncrease)} price increase to preserve target margin.`,
    `Supplier concentration is ${conc.topCountryShare > 0.5 ? "high" : "moderate"}: ${fmtPercent(conc.topCountryShare)} of landed-cost exposure is tied to ${conc.topCountry}.`,
    status.criticalPOs > 0 && `${status.criticalPOs} purchase order(s) create cash-deficit risk under current payment terms.`,
    worst && `${worst.name} is the most exposed SKU — margin falls to ${fmtPercent(worst.scenarioMargin)} under severe shock.`,
    `An estimated ${fmtCurrency(status.marginAtRisk)} of gross profit is at risk across the portfolio.`,
  ].filter(Boolean);
  return (
    <ul className="space-y-2 text-sm text-ink-muted">
      {findings.map((f: string, i: number) => (
        <li key={i} className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slateaccent" />{f}</li>
      ))}
    </ul>
  );
}

function ExecBriefRender({ data, source }: { data: any; source: string }) {
  return (
    <div className="space-y-4">
      {source && source !== "mock" && <div className="text-[11px] text-emerald">Live AI · {source.replace("live-", "")}</div>}
      <div className="flex items-center gap-2">
        <RiskBadge level={data.portfolioStatus} />
        <span className="text-sm font-semibold text-ink">{data.title}</span>
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">{data.summary}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h5 className="stat-label mb-2">Top Risks</h5>
          <div className="space-y-1.5">
            {data.topRisks.map((r: any, i: number) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-base-900/50 p-2.5 text-xs">
                <div className="flex justify-between gap-2"><span className="text-ink">{r.risk}</span><span className="shrink-0 text-amber">{r.urgency}</span></div>
                <div className="mt-0.5 text-ink-faint">{r.financialImpact}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h5 className="stat-label mb-1.5">Recommended Decisions</h5>
            <ul className="space-y-1 text-xs text-ink-muted">{data.recommendedDecisions.map((d: string, i: number) => <li key={i} className="flex gap-2"><span className="text-emerald">✓</span>{d}</li>)}</ul>
          </div>
          <div>
            <h5 className="stat-label mb-1.5">Next 7 Days</h5>
            <ul className="space-y-1 text-xs text-ink-muted">{data.nextSevenDays.map((d: string, i: number) => <li key={i} className="flex gap-2"><span className="text-cyan">→</span>{d}</li>)}</ul>
          </div>
        </div>
      </div>
      <DisclaimerBox>{data.disclaimer}</DisclaimerBox>
    </div>
  );
}
