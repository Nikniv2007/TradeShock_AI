"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import {
  Card, SectionTitle, MetricCard, RiskBadge, ScoreBadge, StatusBadge, Button,
  Field, NumberInput, Select, Toggle, DisclaimerBox,
} from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { SupplierRiskMatrix } from "@/components/charts";
import { compareSuppliers, type SupplierOption } from "@/lib/finance/supplierScoring";
import { requestAI } from "@/lib/ai/actions";
import { useStore } from "@/lib/store/useStore";
import { fmtCurrency, fmtPercent, fmtDays } from "@/lib/utils/formatters";
import { num } from "@/lib/utils/validators";
import type { Product, Supplier, Currency, PaymentTerms, RiskRecommendation } from "@/lib/types";
import {
  GitCompareArrows, Sparkles, Plus, Trash2, Crown, TrendingUp, Wallet,
  ShieldCheck, Timer, Trophy, AlertTriangle,
} from "lucide-react";

const PAYMENT_TERMS: PaymentTerms[] = ["prepaid", "deposit_50_50", "deposit_30_70", "net_15", "net_30", "net_60"];
const PAYMENT_LABEL: Record<PaymentTerms, string> = {
  prepaid: "Prepaid", deposit_50_50: "50/50 deposit", deposit_30_70: "30/70 deposit",
  net_15: "Net 15", net_30: "Net 30", net_60: "Net 60",
};
const CURRENCY_RISK: Record<Currency, "low" | "medium" | "high"> = {
  USD: "low", EUR: "low", MXN: "low", CNY: "medium", VND: "high", INR: "high", TRY: "high",
};

/** Deterministic per-supplier unit cost for a product. Current supplier keeps its
 *  real cost; alternates are derived so the CHEAPEST is usually the lowest-quality
 *  source — the exact trap this engine is designed to expose. */
function derivedUnitCost(product: Product, supplier: Supplier): number {
  if (supplier.id === product.supplierId) return product.supplierUnitCost;
  const factor = 0.75 + (supplier.qualityScore - 70) / 90; // ~0.79–0.95
  return Math.round(product.supplierUnitCost * factor * 100) / 100;
}

function toOption(product: Product, supplier: Supplier): SupplierOption {
  const isCurrent = supplier.id === product.supplierId;
  return {
    id: supplier.id,
    name: supplier.name,
    country: supplier.country,
    currency: supplier.currency,
    unitCost: derivedUnitCost(product, supplier),
    moq: supplier.minimumOrderQuantity,
    freightPerUnit: product.freightPerUnit,
    tariffRate: product.currentTariffRate,
    additionalTariffRate: product.additionalTariffRate,
    leadTimeDays: supplier.averageLeadTimeDays,
    paymentTerms: supplier.paymentTerms,
    depositPercent: supplier.depositRequiredPercent,
    defectRate: supplier.defectRate,
    reliabilityScore: supplier.reliabilityScore,
    qualityScore: supplier.qualityScore,
    communicationScore: supplier.communicationScore,
    capacityScore: supplier.capacityScore,
    complianceScore: supplier.complianceScore,
    currencyRisk: CURRENCY_RISK[supplier.currency] ?? "medium",
    isCurrent,
    switchingCost: isCurrent ? 0 : 2500,
    toolingCost: isCurrent ? 0 : 3500,
    sampleCost: isCurrent ? 0 : 600,
    onboardingDays: isCurrent ? 0 : Math.max(20, supplier.averageLeadTimeDays),
  };
}

function seedOptions(product: Product, suppliers: Supplier[]): SupplierOption[] {
  const current = suppliers.find((s) => s.id === product.supplierId);
  const alternates = suppliers.filter((s) => s.id !== product.supplierId).slice(0, 2);
  const chosen = [current, ...alternates].filter((s): s is Supplier => Boolean(s));
  return chosen.map((s) => toOption(product, s));
}

export default function SupplierRoiPage() {
  return (
    <>
      <PageHeader
        title="Supplier Switching ROI Engine"
        description="Compare 2–5 suppliers for one SKU across landed margin, cash flow, and operational risk. The recommendation balances margin against working capital — it never blindly picks the cheapest unit cost."
        icon={GitCompareArrows}
      />
      <NoDataGate>
        <SupplierRoiBody />
      </NoDataGate>
    </>
  );
}

function SupplierRoiBody() {
  const { dataset } = useStore();
  const { products, suppliers, company } = dataset;

  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId) ?? products[0];

  const [options, setOptions] = React.useState<SupplierOption[]>(() => seedOptions(product, suppliers));
  const [ai, setAi] = React.useState<{ data: RiskRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  // Reseed whenever the product changes.
  const lastProduct = React.useRef(product.id);
  React.useEffect(() => {
    if (lastProduct.current !== product.id) {
      lastProduct.current = product.id;
      setOptions(seedOptions(product, suppliers));
      setAi(null);
    }
  }, [product, suppliers]);

  const ctx = React.useMemo(
    () => ({
      sellingPrice: product.sellingPrice,
      targetMargin: product.targetMargin,
      monthlyDemand: product.monthlyDemand,
      financingCostPercent: company.financingCostPercent,
    }),
    [product, company]
  );

  const comparison = React.useMemo(() => compareSuppliers(options, ctx), [options, ctx]);
  const evals = comparison.evaluations;

  function update(id: string, patch: Partial<SupplierOption>) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function removeOption(id: string) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((o) => o.id !== id)));
  }
  function addOption() {
    if (options.length >= 5) return;
    const used = new Set(options.map((o) => o.id));
    const next = suppliers.find((s) => !used.has(s.id));
    if (next) setOptions((prev) => [...prev, { ...toOption(product, next), isCurrent: false }]);
  }
  function setCurrent(id: string) {
    setOptions((prev) => prev.map((o) => ({ ...o, isCurrent: o.id === id })));
  }

  // Per-column winners for cell highlighting.
  const bestId = React.useCallback(
    (sel: (e: (typeof evals)[number]) => number, dir: "min" | "max") => {
      if (evals.length === 0) return undefined;
      return [...evals].sort((a, b) => (dir === "max" ? sel(b) - sel(a) : sel(a) - sel(b)))[0].option.id;
    },
    [evals]
  );
  const winners = {
    landed: bestId((e) => e.landedCostPerUnit, "min"),
    defect: bestId((e) => e.defectAdjustedCost, "min"),
    margin: bestId((e) => e.grossMargin, "max"),
    moqCash: bestId((e) => e.cashTiedInMOQ, "min"),
    wc: bestId((e) => e.workingCapital, "min"),
    burden: bestId((e) => e.paymentTermCashBurden, "min"),
    supplier: bestId((e) => e.supplierScore, "max"),
    risk: bestId((e) => e.riskScore, "min"),
    cash: bestId((e) => e.cashFlowScore, "max"),
    payback: bestId((e) => e.switchingPaybackMonths, "min"),
    improve: bestId((e) => e.marginImprovementVsCurrent, "max"),
  };

  const cheapest = React.useMemo(
    () => [...evals].sort((a, b) => a.option.unitCost - b.option.unitCost)[0],
    [evals]
  );
  const matrixData = evals.map((e) => ({
    name: e.option.name,
    cost: e.supplierScore,
    reliability: e.option.reliabilityScore,
    exposure: e.riskScore / 100,
  }));

  async function analyze() {
    setLoadingAi(true);
    const { bestByMargin, bestByCashFlow, bestByOperationalRisk, bestByLeadTime, bestOverall, current } = comparison;
    const keyFindings = [
      bestByMargin && `Strongest landed margin: ${bestByMargin.option.name} at ${fmtPercent(bestByMargin.grossMargin)}.`,
      bestByCashFlow && `Best cash-flow profile: ${bestByCashFlow.option.name} (cash-flow score ${bestByCashFlow.cashFlowScore}/100).`,
      bestByOperationalRisk && `Lowest operational risk: ${bestByOperationalRisk.option.name} (risk ${bestByOperationalRisk.riskScore}/100).`,
      cheapest && bestOverall && cheapest.option.id !== bestOverall.option.id
        && `Cheapest unit cost is ${cheapest.option.name} (${fmtCurrency(cheapest.option.unitCost)}/u) — but it is NOT the best choice once defects, freight, tariffs, and cash terms are included.`,
      current && `Current supplier ${current.option.name}: margin ${fmtPercent(current.grossMargin)}, risk ${current.riskScore}/100, ${fmtDays(current.option.leadTimeDays)} lead time.`,
    ].filter(Boolean) as string[];
    const topDrivers = [
      bestOverall && { label: "Landed margin vs cash flow trade-off", detail: `${bestOverall.option.name} balances a ${fmtPercent(bestOverall.grossMargin)} margin with a ${bestOverall.cashFlowScore}/100 cash-flow score.` },
      { label: "Defect-adjusted cost, not sticker price", detail: "Effective cost includes scrap from defect rates, so the lowest quote is rarely the lowest true cost." },
      { label: "Working capital & payment terms", detail: `Financing cost assumed at ${fmtPercent(company.financingCostPercent)} annually on cash tied in MOQ and pipeline inventory.` },
    ].filter(Boolean) as { label: string; detail: string }[];

    const res = await requestAI("supplier_switch", {
      recommendation: comparison.recommendation,
      riskLevel: "watch",
      productName: product.name,
      keyFindings,
      topDrivers,
      recommendedAction: comparison.recommendation,
    });
    setAi({ data: res.data as RiskRecommendation, source: res.source, warning: res.warning });
    setLoadingAi(false);
  }

  return (
    <div className="space-y-6">
      {/* Product context */}
      <Card>
        <SectionTitle
          icon={GitCompareArrows}
          title="Sourcing Context"
          subtitle="Pick the SKU to size the comparison. Selling price, target margin, and monthly demand drive every score."
          right={
            <Select className="max-w-[240px]" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          }
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Selling Price" value={fmtCurrency(product.sellingPrice)} tone="cyan" />
          <MetricCard label="Target Margin" value={fmtPercent(product.targetMargin)} tone="emerald" />
          <MetricCard label="Monthly Demand" value={`${product.monthlyDemand}/mo`} />
          <MetricCard label="Financing Cost" value={fmtPercent(company.financingCostPercent)} tone="amber" sub="annual, on tied cash" />
        </div>
      </Card>

      {/* Editable supplier options */}
      <Card>
        <SectionTitle
          title="Supplier Options"
          subtitle="Seeded from your supplier list. Edit any driver; toggle which one is the incumbent. Compare 2–5."
          right={
            <Button variant="primary" onClick={addOption} disabled={options.length >= 5 || options.length >= suppliers.length}>
              <Plus className="h-3.5 w-3.5" /> Add Supplier
            </Button>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {options.map((o) => (
            <div key={o.id} className="rounded-xl border border-white/[0.07] bg-base-900/50 p-3.5">
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{o.name}</p>
                  <p className="text-[11px] text-ink-faint">{o.country} · {o.currency}{o.isCurrent ? " · incumbent" : ""}</p>
                </div>
                <button
                  onClick={() => removeOption(o.id)}
                  disabled={options.length <= 2}
                  className="shrink-0 rounded-md p-1 text-ink-faint hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                  title="Remove supplier"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Unit cost"><NumberInput value={o.unitCost} step="0.01" onChange={(v) => update(o.id, { unitCost: num(v) })} /></Field>
                <Field label="MOQ"><NumberInput value={o.moq} onChange={(v) => update(o.id, { moq: num(v) })} /></Field>
                <Field label="Freight/u"><NumberInput value={o.freightPerUnit} step="0.01" onChange={(v) => update(o.id, { freightPerUnit: num(v) })} /></Field>
                <Field label="Tariff rate"><NumberInput value={o.tariffRate} step="0.01" onChange={(v) => update(o.id, { tariffRate: num(v) })} /></Field>
                <Field label="Lead time (d)"><NumberInput value={o.leadTimeDays} onChange={(v) => update(o.id, { leadTimeDays: num(v) })} /></Field>
                <Field label="Defect rate"><NumberInput value={o.defectRate} step="0.005" onChange={(v) => update(o.id, { defectRate: num(v) })} /></Field>
                <Field label="Switching $"><NumberInput value={o.switchingCost} onChange={(v) => update(o.id, { switchingCost: num(v) })} /></Field>
                <Field label="Tooling $"><NumberInput value={o.toolingCost} onChange={(v) => update(o.id, { toolingCost: num(v) })} /></Field>
                <Field label="Sample $"><NumberInput value={o.sampleCost} onChange={(v) => update(o.id, { sampleCost: num(v) })} /></Field>
                <Field label="Payment terms">
                  <Select value={o.paymentTerms} onChange={(e) => update(o.id, { paymentTerms: e.target.value as PaymentTerms })}>
                    {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{PAYMENT_LABEL[t]}</option>)}
                  </Select>
                </Field>
                <Field label="Currency risk">
                  <Select value={o.currencyRisk} onChange={(e) => update(o.id, { currencyRisk: e.target.value as "low" | "medium" | "high" })}>
                    {(["low", "medium", "high"] as const).map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                </Field>
                <div className="flex items-end pb-1">
                  <Toggle checked={o.isCurrent} onChange={() => setCurrent(o.id)} label="Incumbent" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recommendation */}
      <Card className="border-slateaccent/25 bg-gradient-to-b from-slateaccent/[0.06] to-transparent">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slateaccent/15 p-2 text-slateaccent ring-1 ring-slateaccent/25"><Trophy className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">Recommendation</h3>
              {comparison.bestOverall && <StatusBadge tone="emerald">Best overall: {comparison.bestOverall.option.name}</StatusBadge>}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{comparison.recommendation}</p>
            {cheapest && comparison.bestOverall && cheapest.option.id !== comparison.bestOverall.option.id && (
              <p className="mt-2 flex items-start gap-2 text-xs text-amber">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The cheapest quote ({cheapest.option.name}, {fmtCurrency(cheapest.option.unitCost)}/u) is not the best overall choice once defects, cash, and risk are priced in.
              </p>
            )}
          </div>
          <div className="ml-auto shrink-0">
            <Button variant="primary" onClick={analyze} disabled={loadingAi}>
              <Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Analyzing…" : ai ? "Re-run AI" : "AI Analysis"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Category winner cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <WinnerCard icon={TrendingUp} tone="emerald" label="Best by Margin"
          name={comparison.bestByMargin?.option.name} metric={comparison.bestByMargin ? fmtPercent(comparison.bestByMargin.grossMargin) : "—"} sub="landed gross margin" />
        <WinnerCard icon={Wallet} tone="cyan" label="Best by Cash Flow"
          name={comparison.bestByCashFlow?.option.name} metric={comparison.bestByCashFlow ? `${comparison.bestByCashFlow.cashFlowScore}/100` : "—"} sub="cash-flow score" />
        <WinnerCard icon={ShieldCheck} tone="emerald" label="Best by Op Risk"
          name={comparison.bestByOperationalRisk?.option.name} metric={comparison.bestByOperationalRisk ? `${comparison.bestByOperationalRisk.riskScore}/100` : "—"} sub="lower is better" />
        <WinnerCard icon={Timer} tone="cyan" label="Best by Lead Time"
          name={comparison.bestByLeadTime?.option.name} metric={comparison.bestByLeadTime ? fmtDays(comparison.bestByLeadTime.option.leadTimeDays) : "—"} sub="fastest" />
        <WinnerCard icon={Crown} tone="amber" label="Best Overall"
          name={comparison.bestOverall?.option.name} metric={comparison.bestOverall ? fmtPercent(comparison.bestOverall.grossMargin) : "—"} sub="margin · cash · risk" />
        <WinnerCard icon={AlertTriangle} tone={comparison.current && comparison.current.riskScore > 55 ? "danger" : "neutral"} label="Current Supplier Risk"
          name={comparison.current?.option.name} metric={comparison.current ? `${comparison.current.riskScore}/100` : "—"} sub={comparison.current ? comparison.current.riskLevel : "no incumbent"} />
      </div>

      {/* Comparison table */}
      <Card>
        <SectionTitle title="Full Comparison" subtitle="Best value in each column is highlighted. Margins are defect-adjusted; cash figures use your financing cost." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-ink-faint">
                <th className="px-2 py-2 font-medium">Supplier</th>
                <th className="px-2 py-2 text-right font-medium">Landed/u</th>
                <th className="px-2 py-2 text-right font-medium">Defect-adj/u</th>
                <th className="px-2 py-2 text-right font-medium">Gross Margin</th>
                <th className="px-2 py-2 text-right font-medium">Cash in MOQ</th>
                <th className="px-2 py-2 text-right font-medium">Working Cap.</th>
                <th className="px-2 py-2 text-right font-medium">Pay Burden</th>
                <th className="px-2 py-2 text-center font-medium">Supplier</th>
                <th className="px-2 py-2 text-center font-medium">Risk</th>
                <th className="px-2 py-2 text-right font-medium">Cash Flow</th>
                <th className="px-2 py-2 text-right font-medium">Payback</th>
                <th className="px-2 py-2 text-right font-medium">Δ Margin vs Cur.</th>
              </tr>
            </thead>
            <tbody>
              {evals.map((e) => {
                const id = e.option.id;
                return (
                  <tr key={id} className="border-b border-white/[0.05]">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-ink">{e.option.name}</span>
                        {e.option.isCurrent && <StatusBadge tone="neutral" className="text-[9px]">now</StatusBadge>}
                      </div>
                      <div className="text-[10px] text-ink-faint">{e.option.country}</div>
                    </td>
                    <td className={cellCls(id === winners.landed)}>{fmtCurrency(e.landedCostPerUnit)}</td>
                    <td className={cellCls(id === winners.defect)}>{fmtCurrency(e.defectAdjustedCost)}</td>
                    <td className={cellCls(id === winners.margin)}>{fmtPercent(e.grossMargin)}</td>
                    <td className={cellCls(id === winners.moqCash)}>{fmtCurrency(e.cashTiedInMOQ, "USD", { compact: true })}</td>
                    <td className={cellCls(id === winners.wc)}>{fmtCurrency(e.workingCapital, "USD", { compact: true })}</td>
                    <td className={cellCls(id === winners.burden)}>{e.paymentTermCashBurden}</td>
                    <td className={`px-2 py-2 text-center ${id === winners.supplier ? "bg-emerald/10" : ""}`}><ScoreBadge score={100 - e.supplierScore} /></td>
                    <td className={`px-2 py-2 text-center ${id === winners.risk ? "bg-emerald/10" : ""}`}><ScoreBadge score={e.riskScore} /></td>
                    <td className={cellCls(id === winners.cash)}>{e.cashFlowScore}</td>
                    <td className={cellCls(id === winners.payback)}>{e.option.isCurrent ? "—" : `${e.switchingPaybackMonths} mo`}</td>
                    <td className={cellCls(id === winners.improve)}>
                      <span className={e.marginImprovementVsCurrent > 0 ? "text-emerald" : e.marginImprovementVsCurrent < 0 ? "text-danger" : "text-ink-muted"}>
                        {e.marginImprovementVsCurrent > 0 ? "+" : ""}{fmtPercent(e.marginImprovementVsCurrent)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">Supplier column shows a quality-inverted score badge (lower badge = stronger supplier) so all badges read “lower is safer”.</p>
      </Card>

      {/* Risk matrix */}
      <Card>
        <SectionTitle title="Supplier Risk Matrix" subtitle="Supplier quality score vs reliability. Bubble size = risk exposure (higher = riskier)." />
        {matrixData.length > 0 && <SupplierRiskMatrix data={matrixData} />}
      </Card>

      {ai && <AIRecommendationPanel title="AI Supplier Switching Analysis" data={ai.data} source={ai.source} warning={ai.warning} loading={loadingAi} />}

      <DisclaimerBox variant="financial">
        Supplier comparisons use demo cost, quality, and lead-time assumptions and are estimates only — not guarantees of
        future cost, margin, or reliability. Validate quotes, defect rates, and payment terms with each supplier and run a
        sample order before switching. This is not financial advice. All demo data is fictional.
      </DisclaimerBox>
    </div>
  );
}

function cellCls(best: boolean): string {
  return `px-2 py-2 text-right tabular-nums ${best ? "bg-emerald/10 font-semibold text-emerald" : "text-ink"}`;
}

function WinnerCard({ icon: Icon, tone, label, name, metric, sub }: {
  icon: typeof Trophy;
  tone: "neutral" | "amber" | "emerald" | "danger" | "cyan";
  label: string;
  name?: string;
  metric: string;
  sub: string;
}) {
  const toneText: Record<string, string> = {
    neutral: "text-ink", amber: "text-amber", emerald: "text-emerald", danger: "text-danger", cyan: "text-cyan",
  };
  return (
    <div className="card p-3.5">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <Icon className={`h-4 w-4 ${toneText[tone]}`} />
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-ink" title={name}>{name ?? "—"}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${toneText[tone]}`}>{metric}</div>
      <div className="text-[11px] text-ink-faint">{sub}</div>
    </div>
  );
}
