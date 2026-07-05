"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import {
  Card, SectionTitle, Field, NumberInput, Select, Button, MetricCard,
  RiskBadge, ScoreBadge, DisclaimerBox, EmptyState,
} from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { HBarChart } from "@/components/charts";
import { scanPurchaseOrder } from "@/lib/finance/poRisk";
import { supplierConcentration } from "@/lib/finance/riskScoring";
import { requestAI } from "@/lib/ai/actions";
import { useStore } from "@/lib/store/useStore";
import { fmtCurrency, fmtPercent, fmtNumber, fmtDays, titleCase } from "@/lib/utils/formatters";
import type { PurchaseOrder, PaymentTerms, RiskRecommendation } from "@/lib/types";
import {
  ScanLine, Sparkles, PackageOpen, Wallet, Landmark, TrendingUp, ShieldCheck,
  Timer, Gauge, Scissors, AlertTriangle, CheckCircle2, ListChecks,
} from "lucide-react";

const PAYMENT_TERMS: PaymentTerms[] = ["prepaid", "deposit_50_50", "deposit_30_70", "net_15", "net_30", "net_60"];
const CONFIDENCE: PurchaseOrder["forecastConfidence"][] = ["low", "medium", "high"];

const SEVERITY_TONE: Record<string, string> = {
  critical: "border-danger/30 bg-danger/[0.06] text-danger",
  warning: "border-amber/30 bg-amber/[0.06] text-amber",
  info: "border-cyan/30 bg-cyan/[0.06] text-cyan",
};
const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-danger", warning: "bg-amber", info: "bg-cyan",
};

const RECO_BANNER: Record<PurchaseOrder["recommendation"], { label: string; sub: string; cls: string; Icon: typeof ScanLine }> = {
  approve: { label: "APPROVE", sub: "Risk is within tolerance — release under standard controls.", cls: "border-emerald/30 bg-emerald/[0.08] text-emerald", Icon: CheckCircle2 },
  revise: { label: "REVISE", sub: "Rework terms or quantity before releasing deposits.", cls: "border-amber/30 bg-amber/[0.08] text-amber", Icon: AlertTriangle },
  hold: { label: "HOLD", sub: "Do not release. Cash, inventory, or margin risk is unacceptable.", cls: "border-danger/30 bg-danger/[0.08] text-danger", Icon: ShieldCheck },
};

export default function POScannerPage() {
  return (
    <>
      <PageHeader
        title="Purchase Order Risk Scanner"
        description="Stress-test a PO for cash strain, inventory bloat, and margin collapse before you commit capital. Every figure is deterministic — AI only writes the memo."
        icon={ScanLine}
      />
      <NoDataGate>
        <ScannerBody />
      </NoDataGate>
    </>
  );
}

function ScannerBody() {
  const { dataset } = useStore();
  const { purchaseOrders, products, suppliers } = dataset;

  const [poId, setPoId] = React.useState(purchaseOrders[0]?.id ?? "");
  const [working, setWorking] = React.useState<PurchaseOrder | null>(purchaseOrders[0] ?? null);
  const [targetInventoryDays, setTargetInventoryDays] = React.useState(90);
  const [ai, setAi] = React.useState<{ data: RiskRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  const conc = React.useMemo(() => supplierConcentration(products, suppliers), [products, suppliers]);

  function selectPo(id: string) {
    setPoId(id);
    setAi(null);
    setWorking(purchaseOrders.find((p) => p.id === id) ?? null);
  }
  function patch<K extends keyof PurchaseOrder>(k: K, v: PurchaseOrder[K]) {
    setWorking((s) => (s ? { ...s, [k]: v } : s));
  }

  const supplier = working ? suppliers.find((s) => s.id === working.supplierId) : undefined;

  const scan = React.useMemo(
    () => (working ? scanPurchaseOrder(working, products, suppliers, { targetInventoryDays, supplierCountryShare: conc.topCountryShare }) : null),
    [working, products, suppliers, targetInventoryDays, conc.topCountryShare]
  );

  if (!working || !scan) {
    return <EmptyState title="No purchase orders" message="This portfolio has no open purchase orders to scan." icon={PackageOpen} />;
  }

  const totalUnits = working.lines.reduce((sum, l) => sum + l.quantity, 0);
  const recommendedQty = Math.round(scan.recommendedQuantityFactor * totalUnits);
  const cutPercent = 1 - scan.recommendedQuantityFactor;
  const triggered = scan.checks.filter((c) => c.triggered);
  const clean = scan.checks.filter((c) => !c.triggered);
  const banner = RECO_BANNER[scan.recommendation];
  const recommendationText = `${scan.recommendation.toUpperCase()} — ties up ${fmtCurrency(scan.totalCashNeeded, "USD", { compact: true })}, ${scan.inventoryDaysCreated}d inventory`;

  // Required changes derived from triggered checks + price/quantity levers.
  const requiredChanges: string[] = [
    ...triggered.map((c) => `${c.label}: ${c.detail}`),
    scan.minPriceIncreaseNeeded > 0
      ? `Raise price by at least ${fmtPercent(scan.minPriceIncreaseNeeded)} to keep units above target margin under a tariff shock.`
      : "",
    cutPercent > 0.001
      ? `Cut order quantity by ~${fmtPercent(cutPercent)} to ${fmtNumber(recommendedQty)} units — freeing ${fmtCurrency(scan.suggestedHoldAmount, "USD", { compact: true })} of cash and pulling inventory toward the ${targetInventoryDays}-day target.`
      : "",
    scan.recommendation === "hold" ? "Do not release deposits until the flagged items are resolved and re-scanned." : "",
  ].filter(Boolean);

  async function generateMemo() {
    if (!scan) return;
    setLoadingAi(true);
    const res = await requestAI("po_risk", {
      riskScore: scan.riskScore,
      riskLevel: scan.riskLevel,
      recommendationText,
      summary: `${working!.poNumber} for ${supplier?.name ?? "supplier"} scores ${scan.riskScore}/100 (${scan.riskLevel}). Recommendation: ${scan.recommendation.toUpperCase()}.`,
      keyFindings: triggered.map((c) => c.detail),
      topDrivers: triggered.map((c) => ({ label: c.label, detail: c.detail })),
      recommendedAction: requiredChanges[0] ?? "Approve under standard controls and monitor cash.",
      totalCashNeeded: scan.totalCashNeeded,
      inventoryDaysCreated: scan.inventoryDaysCreated,
      cashConversionStrain: scan.cashConversionStrain,
      suggestedHoldAmount: scan.suggestedHoldAmount,
    });
    setAi(res as never);
    setLoadingAi(false);
  }

  return (
    <div className="space-y-6">
      {/* Selector + editable inputs */}
      <Card>
        <SectionTitle
          icon={PackageOpen}
          title="Select & Tune the Purchase Order"
          subtitle="Load a demo PO, then override the cash, terms, and capacity assumptions to see the risk react live."
          right={
            <Select className="max-w-[220px]" value={poId} onChange={(e) => selectPo(e.target.value)}>
              {purchaseOrders.map((p) => {
                const sup = suppliers.find((s) => s.id === p.supplierId);
                return <option key={p.id} value={p.id}>{p.poNumber} · {sup?.name ?? "—"}</option>;
              })}
            </Select>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Cash available" hint="Working capital on hand for this PO.">
            <NumberInput value={working.currentCashAvailable} onChange={(v) => patch("currentCashAvailable", v)} />
          </Field>
          <Field label="Payment terms">
            <Select value={working.paymentTerms} onChange={(e) => patch("paymentTerms", e.target.value as PaymentTerms)}>
              {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </Select>
          </Field>
          <Field label="Deposit required" hint="0.30 = 30% upfront.">
            <NumberInput value={working.depositRequiredPercent} onChange={(v) => patch("depositRequiredPercent", v)} step="0.05" />
          </Field>
          <Field label="Forecast confidence">
            <Select value={working.forecastConfidence} onChange={(e) => patch("forecastConfidence", e.target.value as PurchaseOrder["forecastConfidence"])}>
              {CONFIDENCE.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </Select>
          </Field>
          <Field label="Warehouse capacity (units)">
            <NumberInput value={working.warehouseCapacityUnits} onChange={(v) => patch("warehouseCapacityUnits", v)} step="100" />
          </Field>
          <Field label="Target inventory days" hint="Days-of-cover ceiling before flagging bloat.">
            <NumberInput value={targetInventoryDays} onChange={(v) => setTargetInventoryDays(Number.isFinite(v) ? v : 90)} step="5" />
          </Field>
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          {working.lines.length} line(s) · {fmtNumber(totalUnits)} units · supplier {supplier?.name ?? "—"} ({supplier?.country ?? "—"}) · lead time {fmtDays(supplier?.averageLeadTimeDays ?? 0)}.
        </p>
      </Card>

      {/* Score + recommendation */}
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
        <Card className="flex flex-col items-center justify-center text-center">
          <span className="stat-label">PO Risk Score</span>
          <div className="mt-2 text-6xl font-bold tabular-nums text-ink">{scan.riskScore}<span className="text-2xl text-ink-faint">/100</span></div>
          <div className="mt-3 flex items-center gap-2">
            <ScoreBadge score={scan.riskScore} />
            <RiskBadge level={scan.riskLevel} />
          </div>
          <p className="mt-3 text-xs text-ink-muted">{triggered.length} of {scan.checks.length} risk checks triggered</p>
        </Card>

        <div className={`card flex items-center gap-4 border p-5 ${banner.cls}`}>
          <banner.Icon className="h-10 w-10 shrink-0" />
          <div>
            <div className="text-3xl font-bold tracking-tight">{banner.label}</div>
            <p className="mt-1 text-sm opacity-90">{banner.sub}</p>
            <p className="mt-2 text-xs opacity-80">{recommendationText}</p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Total Supplier Cost" value={fmtCurrency(scan.totalSupplierCost, "USD", { compact: true })} icon={PackageOpen} />
        <MetricCard label="Est. Landed Cost" value={fmtCurrency(scan.estimatedLandedCost, "USD", { compact: true })} tone="cyan" icon={Landmark} />
        <MetricCard label="Total Cash Needed" value={fmtCurrency(scan.totalCashNeeded, "USD", { compact: true })} tone="amber" icon={Wallet} />
        <MetricCard label="Gross Profit Expected" value={fmtCurrency(scan.grossProfitExpected, "USD", { compact: true })} tone={scan.grossProfitExpected > 0 ? "emerald" : "danger"} icon={TrendingUp} />
        <MetricCard label="Risk-Adj. Gross Profit" value={fmtCurrency(scan.riskAdjustedGrossProfit, "USD", { compact: true })} tone={scan.riskAdjustedGrossProfit > 0 ? "emerald" : "danger"} icon={ShieldCheck} sub="discounted for risk" />
        <MetricCard label="Inventory Days Created" value={fmtDays(scan.inventoryDaysCreated)} tone={scan.inventoryDaysCreated > targetInventoryDays ? "amber" : "neutral"} icon={Timer} sub={`${targetInventoryDays}d target`} />
        <MetricCard label="Cash Conversion Strain" value={fmtPercent(scan.cashConversionStrain)} tone={scan.cashConversionStrain > 0.9 ? "danger" : scan.cashConversionStrain > 0.6 ? "amber" : "emerald"} icon={Gauge} sub="of cash on hand" />
        <MetricCard label="Scenario Margin" value={fmtPercent(scan.scenarioMargin)} tone={scan.scenarioMargin < 0.2 ? "danger" : scan.scenarioMargin < 0.3 ? "amber" : "emerald"} icon={AlertTriangle} sub="under +10pt tariff" />
        <MetricCard label="Suggested Hold" value={fmtCurrency(scan.suggestedHoldAmount, "USD", { compact: true })} tone={scan.suggestedHoldAmount > 0 ? "amber" : "emerald"} icon={Wallet} sub="cash to defer" />
        <MetricCard label="Recommended Qty" value={fmtNumber(recommendedQty)} tone={cutPercent > 0.001 ? "amber" : "emerald"} icon={Scissors} sub={cutPercent > 0.001 ? `cut ${fmtPercent(cutPercent)}` : "no cut needed"} />
      </div>

      {/* Risk breakdown + required changes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={ListChecks} title="Risk Breakdown" subtitle="Triggered checks first, with the points each adds to the score." />
          <div className="space-y-2">
            {triggered.map((c) => (
              <div key={c.label} className={`rounded-lg border p-3 ${SEVERITY_TONE[c.severity]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[c.severity]}`} />
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="mt-0.5 text-xs opacity-80">{c.detail}</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs tabular-nums">+{c.contribution}</span>
                </div>
              </div>
            ))}
            {clean.length > 0 && (
              <div className="pt-1">
                <p className="stat-label mb-1.5">Passed checks</p>
                <div className="space-y-1">
                  {clean.map((c) => (
                    <div key={c.label} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-ink-faint">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald/70" />
                      <span className="line-through decoration-white/20">{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle icon={AlertTriangle} title="Required Changes Before Approval" subtitle="Actionable levers derived from the triggered checks, pricing, and quantity." />
            {requiredChanges.length === 0 ? (
              <p className="text-sm text-emerald">No blocking changes — the PO is clear to approve under standard controls.</p>
            ) : (
              <ul className="space-y-2 text-sm text-ink-muted">
                {requiredChanges.map((r, i) => (
                  <li key={i} className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />{r}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <SectionTitle icon={Gauge} title="Score Contribution" subtitle="Points contributed by each triggered check." />
            {triggered.length > 0 ? (
              <HBarChart data={triggered.map((c) => ({ label: c.label, value: c.contribution }))} format={(v) => `${v} pts`} />
            ) : (
              <p className="text-sm text-ink-faint">No triggered checks to chart.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Line table */}
      <Card>
        <SectionTitle icon={PackageOpen} title="PO Line Detail" subtitle="Per-SKU quantities, costs, and projected margin." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-medium">SKU</th>
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 text-right font-medium">Qty</th>
                <th className="py-2 pr-3 text-right font-medium">Unit Cost</th>
                <th className="py-2 pr-3 text-right font-medium">Est. Landed</th>
                <th className="py-2 pr-3 text-right font-medium">Proj. Margin</th>
                <th className="py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {working.lines.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.04]">
                  <td className="py-2.5 pr-3 font-mono text-xs text-ink-muted">{l.sku}</td>
                  <td className="py-2.5 pr-3 text-ink">{l.name}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtNumber(l.quantity)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(l.unitCost)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtCurrency(l.estimatedLandedCost)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtPercent(l.projectedMargin)}</td>
                  <td className="py-2.5 text-right"><RiskBadge level={l.riskLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI memo */}
      <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
        <SectionTitle
          icon={Sparkles}
          title="AI Approval Memo & Negotiation Checklist"
          subtitle="Turns the deterministic scan into a memo and supplier negotiation script."
          right={<Button variant="primary" onClick={generateMemo} disabled={loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Drafting…" : ai ? "Regenerate" : "Draft Memo"}</Button>}
        />
        {!ai && !loadingAi && <p className="text-sm text-ink-muted">Click “Draft Memo” to generate an approval memo and negotiation checklist from the scan above.</p>}
        {(ai || loadingAi) && (
          <AIRecommendationPanel
            title="AI Approval Memo & Negotiation Checklist"
            data={ai?.data}
            source={ai?.source}
            warning={ai?.warning}
            loading={loadingAi}
          />
        )}
      </Card>

      <DisclaimerBox variant="financial">
        This PO scan is a deterministic decision-support estimate based on demo data and stated assumptions. It is not financial, credit, or
        procurement advice, and does not guarantee future cash, demand, or margin outcomes. All demo data is fictional.
      </DisclaimerBox>
    </div>
  );
}
