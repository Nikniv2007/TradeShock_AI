"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import {
  Card, SectionTitle, MetricCard, RiskBadge, StatusBadge, Button, DisclaimerBox,
} from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { HBarChart, CHART_COLORS } from "@/components/charts";
import { calculateLandedCost } from "@/lib/finance/calculations";
import { scoreSupplierRisk, supplierConcentration } from "@/lib/finance/riskScoring";
import { requestAI } from "@/lib/ai/actions";
import { useStore } from "@/lib/store/useStore";
import { fmtCurrency, fmtPercent, fmtDays, fmtNumber, riskLevelFromScore } from "@/lib/utils/formatters";
import { safeDiv } from "@/lib/utils/validators";
import type { Product, Supplier, RiskRecommendation } from "@/lib/types";
import { Map as MapIcon, Sparkles, Globe2, Landmark, Users2, AlertOctagon, ShieldAlert } from "lucide-react";

const COUNTRY_COLORS = ["#7c8cff", "#3ec7e0", "#2dd4a7", "#f5a623", "#ff5b6a", "#a78bfa", "#f472b6", "#60a5fa"];

function landedFor(p: Product) {
  const qty = Math.max(1, p.monthlyDemand);
  return calculateLandedCost({
    incoterm: "FOB", supplierUnitCost: p.supplierUnitCost, quantity: qty,
    freightTotal: p.freightPerUnit * qty, insuranceTotal: 0, brokerFees: 0, portFees: 0,
    handlingFees: 0, warehouseFees: 0, domesticDeliveryFees: 0, inspectionFees: 0,
    otherFees: p.otherFeesPerUnit * qty, tariffRate: p.currentTariffRate,
    additionalTariffRate: p.additionalTariffRate, sellingPrice: p.sellingPrice,
    targetMargin: p.targetMargin, currency: "USD",
  });
}

interface CountryExposure {
  country: string;
  color: string;
  spendExposure: number; // landed * monthlyDemand
  tariffExposure: number; // duty * monthlyDemand
  avgLeadTime: number;
  avgMargin: number;
  productCount: number;
  supplierCount: number;
  riskScore: number;
  share: number;
  products: Product[];
  suppliers: Supplier[];
}

export default function SupplierMapPage() {
  return (
    <>
      <PageHeader
        title="Supplier Country Exposure Map"
        description="Where your landed-cost, tariff, and margin exposure is concentrated by sourcing country — and which alternate origins can de-risk it."
        icon={MapIcon}
      />
      <NoDataGate>
        <SupplierMapBody />
      </NoDataGate>
    </>
  );
}

function SupplierMapBody() {
  const { dataset } = useStore();
  const { products, suppliers } = dataset;

  const conc = React.useMemo(() => supplierConcentration(products, suppliers), [products, suppliers]);

  const countries = React.useMemo<CountryExposure[]>(() => {
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    const groups = new Map<string, { products: Product[]; suppliers: Set<string> }>();

    for (const p of products) {
      const country = supplierById.get(p.supplierId)?.country ?? p.countryOfOrigin;
      const g = groups.get(country) ?? { products: [], suppliers: new Set<string>() };
      g.products.push(p);
      if (supplierById.has(p.supplierId)) g.suppliers.add(p.supplierId);
      groups.set(country, g);
    }
    // Ensure suppliers with no products still register their country.
    for (const s of suppliers) {
      if (!groups.has(s.country)) groups.set(s.country, { products: [], suppliers: new Set([s.id]) });
      else groups.get(s.country)!.suppliers.add(s.id);
    }

    let totalSpend = 0;
    const rows = [...groups.entries()].map(([country, g]) => {
      let spend = 0, tariff = 0, marginSum = 0, leadSum = 0;
      for (const p of g.products) {
        const l = landedFor(p);
        const demand = Math.max(1, p.monthlyDemand);
        spend += l.landedCostPerUnit * demand;
        tariff += (l.dutyPerUnit + l.additionalTariffPerUnit) * demand;
        marginSum += l.grossMargin;
        leadSum += p.leadTimeDays;
      }
      totalSpend += spend;
      const countrySuppliers = suppliers.filter((s) => g.suppliers.has(s.id));
      return { country, g, spend, tariff, marginSum, leadSum, countrySuppliers };
    });

    return rows
      .map((r): CountryExposure => {
        const share = safeDiv(r.spend, totalSpend, 0);
        const riskScores = r.countrySuppliers.map((s) => scoreSupplierRisk(s, share).score);
        const riskScore = riskScores.length ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length) : 0;
        return {
          country: r.country,
          color: COUNTRY_COLORS[Math.abs(hashStr(r.country)) % COUNTRY_COLORS.length] ?? COUNTRY_COLORS[0],
          spendExposure: Math.round(r.spend),
          tariffExposure: Math.round(r.tariff),
          avgLeadTime: r.g.products.length ? r.leadSum / r.g.products.length : 0,
          avgMargin: r.g.products.length ? r.marginSum / r.g.products.length : 0,
          productCount: r.g.products.length,
          supplierCount: r.countrySuppliers.length,
          riskScore,
          share,
          products: r.g.products,
          suppliers: r.countrySuppliers,
        };
      })
      .sort((a, b) => b.spendExposure - a.spendExposure);
  }, [products, suppliers]);

  const totals = React.useMemo(() => ({
    spend: countries.reduce((s, c) => s + c.spendExposure, 0),
    tariff: countries.reduce((s, c) => s + c.tariffExposure, 0),
    suppliers: suppliers.length,
  }), [countries, suppliers]);

  const [ai, setAi] = React.useState<{ data: RiskRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  async function diversify() {
    setLoadingAi(true);
    const topProducts = [...products]
      .map((p) => ({ p, l: landedFor(p) }))
      .filter(({ p }) => (dataset.suppliers.find((s) => s.id === p.supplierId)?.country ?? p.countryOfOrigin) === conc.topCountry)
      .sort((a, b) => b.l.grossMargin - a.l.grossMargin)
      .slice(0, 5)
      .map(({ p }) => p.name);

    const recommendation = `${(conc.topCountryShare * 100).toFixed(0)}% of landed-cost exposure is tied to ${conc.topCountry}. Qualify at least one alternate supplier for the top 5 high-margin SKUs before the next PO cycle.`;
    const keyFindings = [
      `${conc.topCountry} carries ${fmtPercent(conc.topCountryShare)} of total landed-cost exposure across ${countries.find((c) => c.country === conc.topCountry)?.productCount ?? 0} SKUs.`,
      `Total monthly tariff exposure across all origins is ${fmtCurrency(totals.tariff, "USD", { compact: true })}.`,
      `Highest-risk origin: ${[...countries].sort((a, b) => b.riskScore - a.riskScore)[0]?.country ?? "—"} (risk ${[...countries].sort((a, b) => b.riskScore - a.riskScore)[0]?.riskScore ?? 0}/100).`,
      topProducts.length ? `Priority SKUs to dual-source in ${conc.topCountry}: ${topProducts.join(", ")}.` : "",
    ].filter(Boolean) as string[];
    const topDrivers = countries.slice(0, 4).map((c) => ({
      label: `${c.country} · ${fmtPercent(c.share)} of exposure`,
      detail: `${fmtCurrency(c.spendExposure, "USD", { compact: true })} landed / mo · ${c.productCount} SKUs · risk ${c.riskScore}/100.`,
    }));

    const res = await requestAI("supplier_switch", {
      recommendation,
      riskLevel: conc.topCountryShare > 0.5 ? "warning" : "watch",
      keyFindings,
      topDrivers,
      recommendedAction: recommendation,
    });
    setAi({ data: res.data as RiskRecommendation, source: res.source, warning: res.warning });
    setLoadingAi(false);
  }

  const riskRanked = React.useMemo(() => [...countries].sort((a, b) => b.riskScore - a.riskScore), [countries]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Landed Exposure" value={fmtCurrency(totals.spend, "USD", { compact: true })} tone="cyan" icon={Landmark} sub="per month" />
        <MetricCard label="Tariff Exposure" value={fmtCurrency(totals.tariff, "USD", { compact: true })} tone="amber" icon={Landmark} sub="monthly duties" />
        <MetricCard label="Sourcing Countries" value={fmtNumber(countries.length)} icon={Globe2} />
        <MetricCard label="Suppliers" value={fmtNumber(totals.suppliers)} icon={Users2} />
        <MetricCard label="Top-Country Share" value={fmtPercent(conc.topCountryShare)} tone={conc.topCountryShare > 0.5 ? "danger" : "neutral"} icon={AlertOctagon} sub={conc.topCountry} />
      </div>

      {/* Diversification banner */}
      <Card className="border-slateaccent/25 bg-gradient-to-b from-slateaccent/[0.06] to-transparent">
        <div className="flex flex-wrap items-start gap-3">
          <div className="rounded-lg bg-slateaccent/15 p-2 text-slateaccent ring-1 ring-slateaccent/25"><Globe2 className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">Concentration Risk</h3>
              <RiskBadge level={conc.topCountryShare > 0.5 ? "warning" : "watch"} />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              {fmtPercent(conc.topCountryShare)} of landed-cost exposure is tied to <span className="font-medium text-ink">{conc.topCountry}</span>.
              Qualify at least one alternate supplier for the top high-margin SKUs before the next PO cycle to reduce single-origin dependence.
            </p>
          </div>
          <Button variant="primary" onClick={diversify} disabled={loadingAi}>
            <Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Analyzing…" : ai ? "Re-run AI" : "AI Diversification Plan"}
          </Button>
        </div>
      </Card>

      {/* Country cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {countries.map((c) => {
          const alternates = suppliers
            .filter((s) => s.country !== c.country)
            .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
            .slice(0, 3);
          return (
            <Card key={c.country} className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold text-white" style={{ background: c.color }}>
                    {c.country.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{c.country}</p>
                    <p className="text-[11px] text-ink-faint">{fmtPercent(c.share)} of total exposure</p>
                  </div>
                </div>
                <RiskBadge level={riskLevelFromScore(c.riskScore)} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Landed / mo" value={fmtCurrency(c.spendExposure, "USD", { compact: true })} tone="cyan" />
                <Stat label="Tariff / mo" value={fmtCurrency(c.tariffExposure, "USD", { compact: true })} tone="amber" />
                <Stat label="Avg Margin" value={fmtPercent(c.avgMargin)} tone={c.avgMargin >= 0.35 ? "emerald" : "amber"} />
                <Stat label="Avg Lead Time" value={fmtDays(c.avgLeadTime)} />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted">
                <span>{c.productCount} SKUs affected</span>
                <span>{c.supplierCount} supplier{c.supplierCount === 1 ? "" : "s"}</span>
              </div>

              {/* Concentration share bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base-700">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.share * 100)}%`, background: c.color }} />
              </div>

              <div className="mt-3 border-t border-white/[0.06] pt-2.5">
                <p className="stat-label mb-1.5">Alternate origins</p>
                <div className="flex flex-wrap gap-1.5">
                  {alternates.length === 0 ? (
                    <span className="text-[11px] text-ink-faint">No alternate-country suppliers on file.</span>
                  ) : (
                    alternates.map((s) => (
                      <StatusBadge key={s.id} tone="neutral" className="text-[10px]">
                        {s.country} · {s.name.split(" ")[0]}
                      </StatusBadge>
                    ))
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Concentration chart + risk ranking */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={Landmark} title="Landed-Cost Exposure by Country" subtitle="Monthly landed spend concentrated by sourcing origin." />
          {countries.length > 0 && (
            <HBarChart
              data={countries.map((c) => ({ label: c.country, value: c.spendExposure }))}
              color={CHART_COLORS.cyan}
              format={(v) => fmtCurrency(v, "USD", { compact: true })}
            />
          )}
        </Card>
        <Card>
          <SectionTitle icon={ShieldAlert} title="Country Risk Ranking" subtitle="Average supplier risk, weighted by concentration exposure." />
          <div className="space-y-2">
            {riskRanked.map((c) => (
              <div key={c.country} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-base-900/50 p-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.country}</p>
                    <p className="text-[11px] text-ink-faint">{fmtCurrency(c.spendExposure, "USD", { compact: true })}/mo · {fmtPercent(c.share)} share</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm tabular-nums text-ink-muted">{c.riskScore}</span>
                  <RiskBadge level={riskLevelFromScore(c.riskScore)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {ai && <AIRecommendationPanel title="AI Supplier Diversification Plan" data={ai.data} source={ai.source} warning={ai.warning} loading={loadingAi} />}

      <DisclaimerBox variant="general">
        TradeShock AI provides informational business analysis only. It does not provide legal, customs, tax, accounting,
        investment, or financial advice. Exposure, risk, and concentration figures are estimates based on demo data and
        assumptions, not guarantees. Verify sourcing, tariff, and supplier decisions with qualified professionals. All demo data is fictional.
      </DisclaimerBox>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "amber" | "emerald" | "danger" | "cyan" }) {
  const toneText: Record<string, string> = {
    neutral: "text-ink", amber: "text-amber", emerald: "text-emerald", danger: "text-danger", cyan: "text-cyan",
  };
  return (
    <div className="rounded-lg border border-white/[0.06] bg-base-900/40 px-2.5 py-2">
      <div className="stat-label">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${toneText[tone]}`}>{value}</div>
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
