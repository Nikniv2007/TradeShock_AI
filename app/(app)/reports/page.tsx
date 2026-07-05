"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import { useStore, computePortfolioStatus } from "@/lib/store/useStore";
import {
  Card, SectionTitle, MetricCard, Button, RiskBadge, StatusBadge,
  DisclaimerBox, LoadingState,
} from "@/components/ui/primitives";
import { MarginExposureChart, SupplierRiskMatrix, HBarChart, ScenarioImpactChart, CostBreakdownDonut, CHART_COLORS } from "@/components/charts";
import { runScenario } from "@/lib/finance/scenarioEngine";
import { scanPurchaseOrder } from "@/lib/finance/poRisk";
import { scoreHtsRisk, scoreSupplierRisk, supplierConcentration } from "@/lib/finance/riskScoring";
import { analyzeBOM } from "@/lib/finance/bomCalculations";
import { modelFXFreight } from "@/lib/finance/fxFreight";
import { analyzePortfolioPricing } from "@/lib/finance/customerPricing";
import { requestAI } from "@/lib/ai/actions";
import { downloadJSON, downloadText, toCSV } from "@/lib/data/templates";
import { fmtCurrency, fmtPercent, fmtNumber, titleCase } from "@/lib/utils/formatters";
import type { Dataset, ExecutiveBrief, RiskLevel } from "@/lib/types";
import type { PortfolioStatus } from "@/lib/store/useStore";
import {
  FileText, Landmark, TrendingDown, GitCompareArrows, PackageOpen, ShieldAlert, Boxes,
  DollarSign, Users2, LifeBuoy, CalendarClock, Printer, Copy, Download, FileJson, Sparkles,
  ClipboardList, type LucideIcon,
} from "lucide-react";

type Tone = "neutral" | "amber" | "emerald" | "danger" | "cyan";
type Row = Record<string, string | number>;

interface ReportModel {
  title: string;
  summary: string;
  metrics: { label: string; value: string; sub?: string; tone?: Tone }[];
  chartTitle: string;
  chart: React.ReactNode;
  tableTitle: string;
  columns: string[];
  rows: Row[];
  actions: string[];
  assumptions: string[];
  confidence: number;
  disclaimerVariant: "general" | "hts" | "financial" | "contract" | "fx";
  disclaimerText: string;
  aiContext: Record<string, unknown>;
}

interface ReportMeta {
  id: string;
  title: string;
  icon: LucideIcon;
  blurb: string;
  audience: string;
}

const REPORTS: ReportMeta[] = [
  { id: "exec_tariff", title: "Executive Tariff Exposure", icon: Landmark, blurb: "Portfolio-wide duty exposure and gross profit at risk under a severe tariff shock.", audience: "CEO / Board" },
  { id: "sku_margin", title: "SKU Margin Risk", icon: TrendingDown, blurb: "Which SKUs lose the most margin under stress and how much repricing they need.", audience: "Merchandising" },
  { id: "supplier_switch", title: "Supplier Switching Recommendation", icon: GitCompareArrows, blurb: "Supplier risk scores, concentration, and where to qualify an alternate.", audience: "Sourcing" },
  { id: "po_risk", title: "Purchase Order Risk", icon: PackageOpen, blurb: "Open PO cash strain, inventory days, and approve / revise / hold calls.", audience: "Finance / Ops" },
  { id: "hts_prep", title: "HTS Preparation", icon: ShieldAlert, blurb: "Classification description-quality pre-screen to prepare broker questions.", audience: "Compliance" },
  { id: "bom_exposure", title: "BOM Tariff Exposure", icon: Boxes, blurb: "Component-level tariff exposure across finished goods with substitute savings.", audience: "Engineering / Sourcing" },
  { id: "fx_freight", title: "FX & Freight Shock", icon: DollarSign, blurb: "Currency and freight sensitivity on landed cost, margin, and cash.", audience: "Treasury" },
  { id: "customer_pricing", title: "Customer Pricing Action Plan", icon: Users2, blurb: "Where to pass through cost increases by customer priority and churn risk.", audience: "Sales" },
  { id: "margin_rescue", title: "Margin Rescue Plan", icon: LifeBuoy, blurb: "The unprofitable-under-shock SKUs and the actions to restore target margin.", audience: "Finance" },
  { id: "cfo_brief", title: "Weekly CFO Trade Brief", icon: CalendarClock, blurb: "One-page executive rollup of the week's tariff, supplier, and cash risk.", audience: "CFO" },
];

const GENERAL_DISCLAIMER = "TradeShock AI provides informational business analysis only. It does not provide legal, customs, tax, accounting, investment, or financial advice. All figures are estimates based on demo data and stated assumptions and are not guarantees of future costs, margins, or profitability.";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Trade Reports"
        description="Board-ready, print-friendly reports built from your live portfolio and the deterministic finance engine — AI adds the narrative on top."
        icon={FileText}
      />
      <NoDataGate>
        <ReportsBody />
      </NoDataGate>
    </>
  );
}

function ReportsBody() {
  const { dataset } = useStore();
  const status = React.useMemo(() => computePortfolioStatus(dataset), [dataset]);
  const [selectedId, setSelectedId] = React.useState<string>("exec_tariff");
  const [generatedAt, setGeneratedAt] = React.useState("");
  const [ai, setAi] = React.useState<{ data: ExecutiveBrief; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const model = React.useMemo(() => buildReport(selectedId, dataset, status), [selectedId, dataset, status]);

  React.useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }));
    setAi(null);
  }, [selectedId]);

  async function generateNarrative() {
    setLoadingAi(true);
    const res = await requestAI("executive_report", {
      reportTitle: model.title,
      portfolioStatus: status.status,
      marginAtRisk: status.marginAtRisk,
      tariffExposure: status.tariffExposure,
      skusBelowTarget: status.skusBelowTarget,
      totalSkus: status.totalSkus,
      criticalPOs: status.criticalPOs,
      topCountry: status.topCountry,
      topCountryShare: status.topCountryShare,
      ...model.aiContext,
    });
    setAi({ data: res.data as ExecutiveBrief, source: res.source, warning: res.warning });
    setLoadingAi(false);
  }

  function reportText(): string {
    const lines = [
      `${model.title} — ${dataset.company.name}`,
      `Generated: ${generatedAt} · DEMO DATA`,
      "",
      "EXECUTIVE SUMMARY",
      model.summary,
      "",
      "KEY METRICS",
      ...model.metrics.map((m) => `- ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`),
      "",
      "RECOMMENDED ACTIONS",
      ...model.actions.map((a, i) => `${i + 1}. ${a}`),
      "",
      "ASSUMPTIONS",
      ...model.assumptions.map((a) => `- ${a}`),
      "",
      model.disclaimerText,
    ];
    return lines.join("\n");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  function exportJSON() {
    downloadJSON(`${selectedId}-report.json`, {
      report: model.title, company: dataset.company.name, generatedAt, demoData: true,
      summary: model.summary, metrics: model.metrics, actions: model.actions,
      assumptions: model.assumptions, confidence: model.confidence, table: { columns: model.columns, rows: model.rows },
    });
  }

  function exportCSV() {
    downloadText(`${selectedId}-table.csv`, toCSV(model.rows));
  }

  return (
    <div className="space-y-6">
      {/* Report selector */}
      <div className="no-print">
        <SectionTitle icon={ClipboardList} title="Choose a report" subtitle="Each report is generated live from your portfolio — select one to preview and print." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {REPORTS.map((r) => {
            const active = r.id === selectedId;
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`card p-4 text-left transition-colors ${active ? "border-slateaccent/50 ring-1 ring-slateaccent/40" : "card-hover"}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`rounded-lg p-2 ${active ? "bg-slateaccent/20 text-slateaccent" : "bg-base-700 text-ink-faint"}`}><Icon className="h-4 w-4" /></div>
                  <span className="text-sm font-semibold text-ink">{r.title}</span>
                </div>
                <p className="mt-2 text-xs text-ink-muted">{r.blurb}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-ink-faint">{r.audience}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print to PDF</Button>
        <Button onClick={copyReport}><Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy report text"}</Button>
        <Button onClick={exportJSON}><FileJson className="h-3.5 w-3.5" /> Export JSON</Button>
        <Button onClick={exportCSV}><Download className="h-3.5 w-3.5" /> Download CSV</Button>
        <Button variant="amber" onClick={generateNarrative} disabled={loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Writing…" : ai ? "Regenerate narrative" : "Generate AI narrative"}</Button>
      </div>

      {/* Report page */}
      <div className="print-page card space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink">{model.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{dataset.company.name} · Prepared by TradeShock AI</p>
            <p className="mt-0.5 text-xs text-ink-faint">Generated {generatedAt || "…"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge tone="amber">DEMO DATA</StatusBadge>
            <div className="flex items-center gap-2">
              <RiskBadge level={status.status} />
              <span className="text-xs text-ink-faint">{Math.round(model.confidence * 100)}% confidence</span>
            </div>
          </div>
        </div>

        {/* Executive summary */}
        <div>
          <h3 className="stat-label mb-1.5">Executive Summary</h3>
          <p className="text-sm leading-relaxed text-ink-muted">{model.summary}</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {model.metrics.map((m) => (
            <MetricCard key={m.label} label={m.label} value={m.value} sub={m.sub} tone={m.tone ?? "neutral"} />
          ))}
        </div>

        {/* Chart */}
        <Card>
          <SectionTitle title={model.chartTitle} />
          {model.chart}
        </Card>

        {/* Table */}
        <Card>
          <SectionTitle title={model.tableTitle} subtitle={`${model.rows.length} rows`} />
          <DataTable columns={model.columns} rows={model.rows} />
        </Card>

        {/* AI narrative */}
        {loadingAi && <Card><LoadingState label="Generating executive narrative…" /></Card>}
        {ai && <ExecBrief data={ai.data} source={ai.source} warning={ai.warning} />}

        {/* Recommended actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="stat-label mb-2">Recommended Actions</h3>
            <ol className="space-y-1.5 text-sm text-ink-muted">
              {model.actions.map((a, i) => (
                <li key={i} className="flex gap-2"><span className="font-mono text-slateaccent">{i + 1}.</span>{a}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="stat-label mb-2">Assumptions</h3>
            <ul className="space-y-1.5 text-xs text-ink-muted">
              {model.assumptions.map((a, i) => (
                <li key={i} className="flex gap-2"><span className="text-ink-faint">·</span>{a}</li>
              ))}
            </ul>
          </div>
        </div>

        <DisclaimerBox variant={model.disclaimerVariant}>{model.disclaimerText}</DisclaimerBox>
      </div>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Row[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-faint">No rows for this report.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.08]">
            {columns.map((c) => <th key={c} className="stat-label px-3 py-2 text-left">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/[0.04]">
              {columns.map((c) => <td key={c} className="px-3 py-2 tabular-nums text-ink-muted">{r[c]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExecBrief({ data, source, warning }: { data: ExecutiveBrief; source: string; warning?: string }) {
  return (
    <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-slateaccent/15 p-2 text-slateaccent ring-1 ring-slateaccent/25"><Sparkles className="h-4 w-4" /></div>
        <h3 className="text-sm font-semibold text-ink">{data.title}</h3>
      </div>
      {warning && <div className="mb-3 text-[11px] text-amber">{warning}</div>}
      {source && source !== "mock" && <div className="mb-3 text-[11px] text-emerald">Live AI · {source.replace("live-", "")}</div>}
      <p className="text-sm leading-relaxed text-ink-muted">{data.summary}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <h5 className="stat-label mb-2">Top Risks</h5>
          <div className="space-y-1.5">
            {data.topRisks.map((r, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-base-900/50 p-2.5 text-xs">
                <div className="flex justify-between gap-2"><span className="text-ink">{r.risk}</span><span className="shrink-0 text-amber">{r.urgency}</span></div>
                <div className="mt-0.5 text-ink-faint">{r.financialImpact}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h5 className="stat-label mb-2">Recommended Decisions</h5>
          <ul className="space-y-1 text-xs text-ink-muted">{data.recommendedDecisions.map((d, i) => <li key={i} className="flex gap-2"><span className="text-emerald">✓</span>{d}</li>)}</ul>
        </div>
        <div>
          <h5 className="stat-label mb-2">Next 7 Days</h5>
          <ul className="space-y-1 text-xs text-ink-muted">{data.nextSevenDays.map((d, i) => <li key={i} className="flex gap-2"><span className="text-cyan">→</span>{d}</li>)}</ul>
        </div>
      </div>
      <div className="mt-4"><DisclaimerBox>{data.disclaimer}</DisclaimerBox></div>
    </Card>
  );
}

// ─── Report builders ───────────────────────────────────────────

function buildReport(id: string, dataset: Dataset, status: PortfolioStatus): ReportModel {
  const { products, suppliers, purchaseOrders, customers, boms } = dataset;
  const severe = dataset.scenarios.find((s) => s.name === "Severe Tariff Shock") ?? dataset.scenarios[1] ?? dataset.scenarios[0];
  const conc = supplierConcentration(products, suppliers);

  switch (id) {
    case "sku_margin": {
      const rollup = runScenario(products, severe);
      const sorted = [...rollup.results].sort((a, b) => b.marginLoss - a.marginLoss);
      const worst = sorted[0];
      return {
        title: "SKU Margin Risk",
        summary: `Under the ${severe.name}, ${rollup.portfolio.productsBelowTarget} of ${products.length} SKUs fall below target margin. Average portfolio margin compresses from ${fmtPercent(rollup.portfolio.avgCurrentMargin)} to ${fmtPercent(rollup.portfolio.avgScenarioMargin)}. ${worst ? `${worst.name} is the most exposed, losing ${fmtPercent(worst.marginLoss)} of margin and requiring a ${fmtPercent(worst.requiredPriceIncrease)} price increase to recover target.` : ""}`,
        metrics: [
          { label: "SKUs Below Target", value: fmtNumber(rollup.portfolio.productsBelowTarget), tone: "amber" },
          { label: "Avg Margin (shock)", value: fmtPercent(rollup.portfolio.avgScenarioMargin), tone: "danger" },
          { label: "Gross Profit at Risk", value: fmtCurrency(rollup.portfolio.totalGrossProfitAtRisk, "USD", { compact: true }), tone: "danger" },
          { label: "Most Exposed SKU", value: worst?.sku ?? "—", sub: worst?.name },
        ],
        chartTitle: "Margin Loss by SKU (top 8)",
        chart: <HBarChart data={sorted.slice(0, 8).map((r) => ({ label: r.name, value: Number((r.marginLoss * 100).toFixed(1)) }))} color={CHART_COLORS.danger} format={(v) => `${v}%`} />,
        tableTitle: "SKU Margin Detail",
        columns: ["SKU", "Product", "Current", "Under Shock", "Price Increase", "Risk"],
        rows: sorted.slice(0, 12).map((r) => ({ SKU: r.sku, Product: r.name, Current: fmtPercent(r.currentMargin), "Under Shock": fmtPercent(r.scenarioMargin), "Price Increase": fmtPercent(r.requiredPriceIncrease), Risk: titleCase(r.riskLevel) })),
        actions: [
          worst ? `Reprice ${worst.name} by ${fmtPercent(worst.requiredPriceIncrease)} or add a tariff surcharge.` : "Review the SKUs flagged below target.",
          "Prioritize the top-5 margin-loss SKUs for supplier renegotiation.",
          "Freeze promotions on SKUs already below target margin.",
        ],
        assumptions: [`Stress scenario: ${severe.name} (${severe.description}).`, "Landed cost computed FOB with per-unit freight and other fees from the catalog.", "Demand held constant except where the scenario applies a demand drop."],
        confidence: 0.82,
        disclaimerVariant: "financial",
        disclaimerText: GENERAL_DISCLAIMER,
        aiContext: { belowTarget: rollup.portfolio.productsBelowTarget, worstSku: worst?.name, worstPriceIncrease: worst?.requiredPriceIncrease, grossProfitAtRisk: rollup.portfolio.totalGrossProfitAtRisk },
      };
    }

    case "supplier_switch": {
      const scored = suppliers.map((s) => ({ s, r: scoreSupplierRisk(s, s.country === conc.topCountry ? conc.topCountryShare : 0.15) }));
      scored.sort((a, b) => b.r.score - a.r.score);
      const matrix = suppliers.map((s) => ({ name: s.name, cost: Math.round(100 - s.defectRate * 200 - (s.averageLeadTimeDays > 40 ? 15 : 0)), reliability: s.reliabilityScore, exposure: s.country === conc.topCountry ? conc.topCountryShare : 0.15 }));
      const worst = scored[0];
      return {
        title: "Supplier Switching Recommendation",
        summary: `${status.highRiskSuppliers} of ${suppliers.length} suppliers exceed the high-risk threshold. Sourcing is concentrated in ${conc.topCountry} at ${fmtPercent(conc.topCountryShare)} of landed-cost exposure. ${worst ? `${worst.s.name} carries the highest risk score (${worst.r.score}/100): ${worst.r.recommendedAction}` : ""}`,
        metrics: [
          { label: "High-Risk Suppliers", value: fmtNumber(status.highRiskSuppliers), tone: status.highRiskSuppliers > 0 ? "amber" : "emerald" },
          { label: "Top Country", value: conc.topCountry, sub: fmtPercent(conc.topCountryShare) },
          { label: "Top Supplier", value: conc.topSupplier, sub: fmtPercent(conc.topSupplierShare) },
          { label: "Worst Risk Score", value: worst ? `${worst.r.score}/100` : "—", tone: "danger" },
        ],
        chartTitle: "Supplier Risk Matrix — cost vs reliability (bubble = country exposure)",
        chart: <SupplierRiskMatrix data={matrix} />,
        tableTitle: "Supplier Risk Ranking",
        columns: ["Supplier", "Country", "Risk Score", "Reliability", "Defect Rate", "Lead Time", "Action"],
        rows: scored.map(({ s, r }) => ({ Supplier: s.name, Country: s.country, "Risk Score": r.score, Reliability: `${s.reliabilityScore}/100`, "Defect Rate": fmtPercent(s.defectRate), "Lead Time": `${s.averageLeadTimeDays}d`, Action: r.recommendedAction })),
        actions: [
          conc.topCountryShare > 0.4 ? `Qualify an alternate source outside ${conc.topCountry} to cut concentration below 40%.` : "Maintain diversified sourcing; concentration is within tolerance.",
          worst ? `Address ${worst.s.name} first — ${worst.r.recommendedAction.toLowerCase()}` : "Review supplier scorecards quarterly.",
          "Request updated defect and on-time data from the two highest-risk suppliers.",
        ],
        assumptions: ["Country exposure derived from landed-cost-weighted supplier concentration.", "Risk score weights reliability and defect rate most heavily, then cash and compliance factors.", "Cost-competitiveness proxy blends defect rate and lead time."],
        confidence: 0.79,
        disclaimerVariant: "general",
        disclaimerText: GENERAL_DISCLAIMER,
        aiContext: { highRiskSuppliers: status.highRiskSuppliers, topCountry: conc.topCountry, topCountryShare: conc.topCountryShare, worstSupplier: worst?.s.name },
      };
    }

    case "po_risk": {
      const scans = purchaseOrders.map((po) => ({ po, scan: scanPurchaseOrder(po, products, suppliers, { supplierCountryShare: conc.topCountryShare }) }));
      scans.sort((a, b) => b.scan.riskScore - a.scan.riskScore);
      const totalCash = scans.reduce((s, x) => s + x.scan.totalCashNeeded, 0);
      const holds = scans.filter((x) => x.scan.recommendation === "hold").length;
      return {
        title: "Purchase Order Risk",
        summary: `${purchaseOrders.length} open purchase orders tie up ${fmtCurrency(totalCash, "USD", { compact: true })} in landed cost. ${status.criticalPOs} are critical and ${holds} are recommended for hold. Cash strain and inventory days are the dominant risk drivers across the book.`,
        metrics: [
          { label: "Open POs", value: fmtNumber(purchaseOrders.length) },
          { label: "Critical POs", value: fmtNumber(status.criticalPOs), tone: status.criticalPOs > 0 ? "danger" : "emerald" },
          { label: "Total Cash Needed", value: fmtCurrency(totalCash, "USD", { compact: true }), tone: "amber" },
          { label: "Recommended Holds", value: fmtNumber(holds), tone: holds > 0 ? "danger" : "emerald" },
        ],
        chartTitle: "Cash Required by Purchase Order",
        chart: <HBarChart data={scans.map((x) => ({ label: x.po.poNumber, value: Math.round(x.scan.totalCashNeeded) }))} color={CHART_COLORS.amber} format={(v) => fmtCurrency(v, "USD", { compact: true })} />,
        tableTitle: "Purchase Order Scan Results",
        columns: ["PO", "Cash Needed", "Inventory Days", "Cash Strain", "Risk", "Recommendation"],
        rows: scans.map((x) => ({ PO: x.po.poNumber, "Cash Needed": fmtCurrency(x.scan.totalCashNeeded, "USD", { compact: true }), "Inventory Days": `${x.scan.inventoryDaysCreated}d`, "Cash Strain": fmtPercent(x.scan.cashConversionStrain), Risk: titleCase(x.scan.riskLevel), Recommendation: x.scan.recommendation.toUpperCase() })),
        actions: [
          holds > 0 ? `Hold or resize the ${holds} PO(s) flagged critical to free up cash.` : "No PO holds required under current assumptions.",
          "Renegotiate deposit terms on POs where cash strain exceeds 60%.",
          "Stagger arrival dates to smooth inventory days below the 90-day target.",
        ],
        assumptions: ["Cash strain = landed cost ÷ cash available on the PO.", "Stress test adds a +10pt tariff shock to the supplier portion.", "Target inventory coverage is 90 days."],
        confidence: 0.83,
        disclaimerVariant: "financial",
        disclaimerText: GENERAL_DISCLAIMER,
        aiContext: { openPOs: purchaseOrders.length, criticalPOs: status.criticalPOs, totalCash, holds },
      };
    }

    case "hts_prep": {
      const scored = products.map((p) => ({ p, r: scoreHtsRisk({ productDescription: p.name, materials: "", primaryUse: p.category, components: "", currentHTSCode: p.currentHTSCode, supplierInvoiceDescription: p.name }) }));
      scored.sort((a, b) => b.r.score - a.r.score);
      const highRisk = scored.filter((x) => x.r.riskLevel === "warning" || x.r.riskLevel === "critical").length;
      const avgQuality = Math.round(scored.reduce((s, x) => s + x.r.descriptionQualityScore, 0) / Math.max(1, scored.length));
      return {
        title: "HTS Preparation",
        summary: `A deterministic description-quality pre-screen flags ${highRisk} SKUs with elevated classification risk. Average description-completeness across the catalog is ${avgQuality}/100. This report prepares broker questions and documentation — it is not a classification and must be confirmed with a licensed customs broker.`,
        metrics: [
          { label: "SKUs Screened", value: fmtNumber(products.length) },
          { label: "Elevated Risk", value: fmtNumber(highRisk), tone: highRisk > 0 ? "amber" : "emerald" },
          { label: "Avg Description Quality", value: `${avgQuality}/100`, tone: avgQuality < 60 ? "danger" : "cyan" },
          { label: "Missing Material Data", value: fmtNumber(products.length), sub: "add for accurate prep" },
        ],
        chartTitle: "Classification Risk Score by SKU (top 8)",
        chart: <HBarChart data={scored.slice(0, 8).map((x) => ({ label: x.p.name, value: x.r.score }))} color={CHART_COLORS.amber} format={(v) => `${v}`} />,
        tableTitle: "HTS Pre-Screen Detail",
        columns: ["SKU", "Product", "Current HTS", "Desc Quality", "Risk Score", "Level"],
        rows: scored.map((x) => ({ SKU: x.p.sku, Product: x.p.name, "Current HTS": x.p.currentHTSCode ?? "—", "Desc Quality": `${x.r.descriptionQualityScore}/100`, "Risk Score": x.r.score, Level: titleCase(x.r.riskLevel) })),
        actions: [
          "Capture material composition and primary use for every SKU before broker review.",
          "Do not self-classify high-risk SKUs — prepare questions and consult a licensed customs broker.",
          "Attach commercial invoice descriptions and spec sheets to each classification request.",
        ],
        assumptions: ["Score reflects description completeness only, not the correctness of any HTS code.", "Material and use fields are unavailable in demo data, which inflates risk.", "Vague or generic wording is penalized as a misclassification driver."],
        confidence: 0.7,
        disclaimerVariant: "hts",
        disclaimerText: "TradeShock AI does not provide customs, legal, tax, or compliance advice. HTS classification and duty determination can be legally complex. Use this tool only to prepare questions and documents. Confirm classifications, tariffs, duties, and filing decisions with a licensed customs broker, trade attorney, or official government source.",
        aiContext: { highRisk, avgQuality, totalSkus: products.length },
      };
    }

    case "bom_exposure": {
      const analyses = boms.map((b) => ({ b, a: analyzeBOM(b) }));
      const totalTariff = analyses.reduce((s, x) => s + x.a.totalTariffExposure, 0);
      const rows: Row[] = [];
      for (const { b, a } of analyses) {
        for (const c of a.mostExposedComponents) {
          rows.push({ "Finished Good": b.name, Component: c.component.componentName, Country: c.component.countryOfOrigin, "Tariff/Unit": fmtCurrency(c.tariffCostPerFinishedGood), "Cost Share": fmtPercent(c.costSharePercent), "Tariff Share": fmtPercent(c.tariffSharePercent), Substitute: c.component.substituteAvailable ? "Yes" : "No" });
        }
      }
      const first = analyses[0];
      const donut = first ? first.a.components.filter((c) => c.tariffCostPerFinishedGood > 0).map((c) => ({ label: c.component.componentName, value: c.tariffCostPerFinishedGood })) : [];
      return {
        title: "BOM Tariff Exposure",
        summary: `Across ${boms.length} bills of materials, tariff exposure concentrates in a handful of components — often not the most expensive ones. Total per-finished-good tariff exposure is ${fmtCurrency(totalTariff)}. ${first ? `For ${first.b.name}, a +10pt tariff shock moves finished margin from ${fmtPercent(first.a.finishedGrossMargin)} to ${fmtPercent(first.a.shockedMargin)}.` : ""}`,
        metrics: [
          { label: "BOMs Analyzed", value: fmtNumber(boms.length) },
          { label: "Total Tariff/Unit", value: fmtCurrency(totalTariff), tone: "amber" },
          { label: "Finished Margin", value: first ? fmtPercent(first.a.finishedGrossMargin) : "—" },
          { label: "Under +10pt Shock", value: first ? fmtPercent(first.a.shockedMargin) : "—", tone: "danger" },
        ],
        chartTitle: first ? `Tariff Cost by Component — ${first.b.name}` : "Tariff Cost by Component",
        chart: donut.length > 0 ? <CostBreakdownDonut data={donut} /> : <p className="text-sm text-ink-faint">No component tariff data.</p>,
        tableTitle: "Most Tariff-Exposed Components",
        columns: ["Finished Good", "Component", "Country", "Tariff/Unit", "Cost Share", "Tariff Share", "Substitute"],
        rows,
        actions: [
          "Target substitute sourcing on the highest tariff-share components first — they cut duty faster than cost.",
          "Requalify critical components before switching to protect finished-good quality.",
          "Model a country-of-origin change on the top-exposed component to quantify duty savings.",
        ],
        assumptions: ["Tariff cost applied to the dutiable component base per finished good.", "Substitute savings estimate the tariff plus 15% of component cost.", "Shock scenario is a +10pt tariff increase applied to the component base."],
        confidence: 0.77,
        disclaimerVariant: "general",
        disclaimerText: GENERAL_DISCLAIMER,
        aiContext: { boms: boms.length, totalTariff },
      };
    }

    case "fx_freight": {
      const financing = dataset.company.financingCostPercent || 0.11;
      const modeled = products.map((p) => ({ p, r: modelFXFreight({ supplierUnitCostLocal: p.supplierUnitCost, baseExchangeRate: 1, currentExchangeRate: 1, currencyShockPercent: 0.08, freightBaseCost: p.freightPerUnit, freightShockPercent: 0.25, otherLandedPerUnit: p.otherFeesPerUnit + p.supplierUnitCost * p.currentTariffRate, sellingPrice: p.sellingPrice, targetMargin: p.targetMargin, quantity: Math.max(1, p.monthlyDemand), inventoryFinancingCostPercent: financing, leadTimeDays: p.leadTimeDays }) }));
      const totalCashImpact = modeled.reduce((s, x) => s + x.r.cashImpact, 0);
      const avgMarginImpact = modeled.reduce((s, x) => s + x.r.marginImpact, 0) / Math.max(1, modeled.length);
      const sorted = [...modeled].sort((a, b) => b.r.marginImpact - a.r.marginImpact);
      return {
        title: "FX & Freight Shock",
        summary: `Modeling an 8% currency weakening alongside a 25% ocean-freight spike, blended landed cost rises enough to compress average margin by ${fmtPercent(avgMarginImpact)}. The combined shock adds ${fmtCurrency(totalCashImpact, "USD", { compact: true })} of monthly cash outlay across the catalog before financing costs.`,
        metrics: [
          { label: "Monthly Cash Impact", value: fmtCurrency(totalCashImpact, "USD", { compact: true }), tone: "danger" },
          { label: "Avg Margin Impact", value: fmtPercent(avgMarginImpact), tone: "amber" },
          { label: "Currency Shock", value: "8%", sub: "USD weakening" },
          { label: "Freight Shock", value: "25%", sub: "ocean spot" },
        ],
        chartTitle: "Base vs Shocked Margin by SKU (top 10)",
        chart: <ScenarioImpactChart data={sorted.slice(0, 10).map((x) => ({ name: x.p.name, current: x.r.baseMargin, scenario: x.r.shockedMargin }))} />,
        tableTitle: "FX & Freight Sensitivity Detail",
        columns: ["SKU", "Product", "Base Margin", "Shocked Margin", "Price Increase", "Cash Impact"],
        rows: sorted.map((x) => ({ SKU: x.p.sku, Product: x.p.name, "Base Margin": fmtPercent(x.r.baseMargin), "Shocked Margin": fmtPercent(x.r.shockedMargin), "Price Increase": fmtPercent(x.r.requiredPriceIncrease), "Cash Impact": fmtCurrency(x.r.cashImpact, "USD", { compact: true }) })),
        actions: [
          "Lock freight capacity on the highest-impact lanes before spot rates move.",
          "Evaluate partial forward cover on the most FX-exposed sourcing currencies — with a qualified advisor.",
          "Stage price increases on SKUs where the shocked margin falls below target.",
        ],
        assumptions: ["Exchange rate modeled as USD per local unit; a weaker dollar raises cost.", "Freight treated per unit; other landed cost includes duty and fees.", "Financing cost applied over the lead-time window."],
        confidence: 0.74,
        disclaimerVariant: "fx",
        disclaimerText: "This is not investment or hedging advice. Consult a qualified financial professional before making currency hedging or financing decisions.",
        aiContext: { totalCashImpact, avgMarginImpact },
      };
    }

    case "customer_pricing": {
      const costIncrease = severe.tariffIncreasePercent || 0.1;
      const results = analyzePortfolioPricing(customers, costIncrease);
      const highPriority = results.filter((r) => r.priorityLevel === "warning" || r.priorityLevel === "critical").length;
      const top = results[0];
      return {
        title: "Customer Pricing Action Plan",
        summary: `Passing through a ${fmtPercent(costIncrease)} blended cost increase should not be uniform. ${highPriority} of ${customers.length} customers are high priority for action. ${top ? `${top.customer.name} tops the list (priority ${top.priorityScore}/100) — recommended strategy: ${titleCase(top.recommendedStrategy)} at ${fmtPercent(top.priceIncreaseNeeded)}.` : ""}`,
        metrics: [
          { label: "Customers", value: fmtNumber(customers.length) },
          { label: "High Priority", value: fmtNumber(highPriority), tone: "amber" },
          { label: "Top Account", value: top?.customer.name ?? "—", sub: top ? `${top.priorityScore}/100` : undefined },
          { label: "Avg Increase Needed", value: fmtPercent(results.reduce((s, r) => s + r.priceIncreaseNeeded, 0) / Math.max(1, results.length)) },
        ],
        chartTitle: "Churn-Adjusted Revenue Impact by Customer",
        chart: <HBarChart data={results.map((r) => ({ label: r.customer.name, value: Math.round(r.churnAdjustedImpact) }))} color={CHART_COLORS.emerald} format={(v) => fmtCurrency(v, "USD", { compact: true })} />,
        tableTitle: "Customer Pricing Priorities",
        columns: ["Customer", "Type", "Priority", "Price Increase", "Strategy", "Churn Impact"],
        rows: results.map((r) => ({ Customer: r.customer.name, Type: titleCase(r.customer.type), Priority: `${r.priorityScore}/100`, "Price Increase": fmtPercent(r.priceIncreaseNeeded), Strategy: titleCase(r.recommendedStrategy), "Churn Impact": fmtCurrency(r.churnAdjustedImpact, "USD", { compact: true }) })),
        actions: [
          top ? `Open with ${top.customer.name}: ${top.negotiationNote}` : "Sequence outreach by priority score.",
          "Apply surcharges (reversible) before base-price hikes on exposed, no-clause accounts.",
          "Route fixed-contract accounts without a pass-through clause to legal before adjusting price.",
        ],
        assumptions: [`Blended cost increase of ${fmtPercent(costIncrease)} from the ${severe.name}.`, "Price increase needed scales with each customer's tariff exposure and COGS share.", "Churn factor reduces expected impact for higher-churn accounts."],
        confidence: 0.76,
        disclaimerVariant: "contract",
        disclaimerText: "Generated clauses, customer notices, and supplier scripts are drafting support only. Have an attorney review before use.",
        aiContext: { highPriority, topAccount: top?.customer.name, costIncrease },
      };
    }

    case "margin_rescue": {
      const rollup = runScenario(products, severe);
      const needing = rollup.results.filter((r) => r.scenarioMargin < (severe.targetMargin || r.currentMargin) || r.requiredPriceIncrease > 0).sort((a, b) => b.requiredPriceIncrease - a.requiredPriceIncrease);
      const avgInc = needing.reduce((s, r) => s + r.requiredPriceIncrease, 0) / Math.max(1, needing.length);
      return {
        title: "Margin Rescue Plan",
        summary: `${needing.length} SKUs need pricing or sourcing action to restore target margin under the ${severe.name}. The average required price increase is ${fmtPercent(avgInc)}. This plan sequences the highest-leverage fixes first and pairs each with a recommended action.`,
        metrics: [
          { label: "SKUs Needing Action", value: fmtNumber(needing.length), tone: "amber" },
          { label: "Avg Price Increase", value: fmtPercent(avgInc), tone: "danger" },
          { label: "Gross Profit at Risk", value: fmtCurrency(rollup.portfolio.totalGrossProfitAtRisk, "USD", { compact: true }), tone: "danger" },
          { label: "Portfolio Margin", value: fmtPercent(rollup.portfolio.avgScenarioMargin) },
        ],
        chartTitle: "Required Price Increase by SKU (top 8)",
        chart: <HBarChart data={needing.slice(0, 8).map((r) => ({ label: r.name, value: Number((r.requiredPriceIncrease * 100).toFixed(1)) }))} color={CHART_COLORS.danger} format={(v) => `${v}%`} />,
        tableTitle: "Margin Rescue Actions",
        columns: ["SKU", "Product", "Shocked Margin", "Price Increase", "Recommended Action"],
        rows: needing.slice(0, 14).map((r) => ({ SKU: r.sku, Product: r.name, "Shocked Margin": fmtPercent(r.scenarioMargin), "Price Increase": fmtPercent(r.requiredPriceIncrease), "Recommended Action": r.recommendedAction })),
        actions: [
          "Execute price increases on the top-5 SKUs by required increase within 30 days.",
          "Pair each price move with a supplier renegotiation or freight review to reduce the needed increase.",
          "Pause or redesign any SKU that remains unprofitable after a feasible price increase.",
        ],
        assumptions: [`Stress scenario: ${severe.name}.`, "Required price increase restores each SKU to its target margin.", "Actions assume price flexibility per the catalog's priceFlexibility flag."],
        confidence: 0.8,
        disclaimerVariant: "financial",
        disclaimerText: GENERAL_DISCLAIMER,
        aiContext: { needing: needing.length, avgIncrease: avgInc, grossProfitAtRisk: rollup.portfolio.totalGrossProfitAtRisk },
      };
    }

    case "cfo_brief": {
      const rollup = runScenario(products, severe);
      const category = categoryExposure(rollup);
      const scans = purchaseOrders.map((po) => scanPurchaseOrder(po, products, suppliers, { supplierCountryShare: conc.topCountryShare }));
      const rows: Row[] = [];
      for (const s of scans.filter((x) => x.riskLevel === "critical" || x.riskLevel === "warning").slice(0, 4)) rows.push({ Item: `${s.poNumber} — ${s.recommendation.toUpperCase()}`, Type: "Purchase Order", Impact: fmtCurrency(s.totalCashNeeded, "USD", { compact: true }), Severity: titleCase(s.riskLevel) });
      for (const r of [...rollup.results].sort((a, b) => a.scenarioMargin - b.scenarioMargin).slice(0, 4)) rows.push({ Item: `${r.name} margin ${fmtPercent(r.scenarioMargin)} under shock`, Type: "SKU Margin", Impact: fmtCurrency(r.grossProfitAtRisk, "USD", { compact: true }), Severity: titleCase(r.riskLevel) });
      if (conc.topCountryShare > 0.45) rows.push({ Item: `Concentration in ${conc.topCountry}`, Type: "Supplier", Impact: fmtCurrency(status.tariffExposure, "USD", { compact: true }), Severity: "Warning" });
      return {
        title: "Weekly CFO Trade Brief",
        summary: `Portfolio status is ${titleCase(status.status)}. Under the ${severe.name}, ${status.skusBelowTarget} of ${status.totalSkus} SKUs fall below target and roughly ${fmtCurrency(status.marginAtRisk, "USD", { compact: true })} of gross profit is at risk. Monthly duty exposure is ${fmtCurrency(status.tariffExposure, "USD", { compact: true })}, with ${status.criticalPOs} critical PO(s) and ${fmtPercent(conc.topCountryShare)} concentration in ${conc.topCountry}.`,
        metrics: [
          { label: "Margin at Risk", value: fmtCurrency(status.marginAtRisk, "USD", { compact: true }), tone: "danger" },
          { label: "Tariff Exposure", value: fmtCurrency(status.tariffExposure, "USD", { compact: true }), tone: "amber" },
          { label: "SKUs Below Target", value: fmtNumber(status.skusBelowTarget), tone: "amber" },
          { label: "Cash in Inventory", value: fmtCurrency(status.cashTiedInInventory, "USD", { compact: true }), tone: "cyan" },
        ],
        chartTitle: "Margin Exposure by Category (severe scenario)",
        chart: category.length > 0 ? <MarginExposureChart data={category} /> : <p className="text-sm text-ink-faint">No category data.</p>,
        tableTitle: "This Week's Risk Queue",
        columns: ["Item", "Type", "Impact", "Severity"],
        rows,
        actions: [
          status.criticalPOs > 0 ? `Decide on ${status.criticalPOs} critical PO(s) this week.` : "No critical PO decisions outstanding.",
          "Approve the margin-rescue price moves on the most exposed SKUs.",
          conc.topCountryShare > 0.5 ? `Advance the plan to diversify away from ${conc.topCountry}.` : "Continue monitoring supplier concentration.",
        ],
        assumptions: [`Stress scenario: ${severe.name}.`, "Figures aggregate the deterministic finance engine across the live portfolio.", "Cash-in-inventory uses current on-hand units at landed cost."],
        confidence: 0.81,
        disclaimerVariant: "financial",
        disclaimerText: GENERAL_DISCLAIMER,
        aiContext: { status: status.status, marginAtRisk: status.marginAtRisk, skusBelowTarget: status.skusBelowTarget },
      };
    }

    case "exec_tariff":
    default: {
      const rollup = runScenario(products, severe);
      const category = categoryExposure(rollup);
      const top = [...rollup.results].sort((a, b) => b.grossProfitAtRisk - a.grossProfitAtRisk).slice(0, 12);
      return {
        title: "Executive Tariff Exposure",
        summary: `Monthly duty exposure across the portfolio is ${fmtCurrency(status.tariffExposure, "USD", { compact: true })}. Under the ${severe.name}, ${status.skusBelowTarget} of ${status.totalSkus} SKUs fall below target margin and approximately ${fmtCurrency(status.marginAtRisk, "USD", { compact: true })} of gross profit is exposed. Sourcing concentration in ${status.topCountry} (${fmtPercent(status.topCountryShare)}) amplifies the shock.`,
        metrics: [
          { label: "Tariff Exposure", value: fmtCurrency(status.tariffExposure, "USD", { compact: true }), sub: "monthly duties", tone: "amber" },
          { label: "Gross Profit at Risk", value: fmtCurrency(status.marginAtRisk, "USD", { compact: true }), tone: "danger" },
          { label: "SKUs Below Target", value: `${status.skusBelowTarget}/${status.totalSkus}`, tone: "amber" },
          { label: "Avg Margin", value: fmtPercent(status.avgMargin), tone: status.avgMargin >= 0.35 ? "emerald" : "amber" },
        ],
        chartTitle: "Margin & Profit-at-Risk by Category",
        chart: category.length > 0 ? <MarginExposureChart data={category} /> : <p className="text-sm text-ink-faint">No category data.</p>,
        tableTitle: "Top Gross-Profit-at-Risk SKUs",
        columns: ["SKU", "Product", "Category", "Current", "Under Shock", "Profit at Risk"],
        rows: top.map((r) => ({ SKU: r.sku, Product: r.name, Category: r.category, Current: fmtPercent(r.currentMargin), "Under Shock": fmtPercent(r.scenarioMargin), "Profit at Risk": fmtCurrency(r.grossProfitAtRisk, "USD", { compact: true }) })),
        actions: [
          "Prioritize repricing or surcharges on the highest profit-at-risk SKUs.",
          `Diversify sourcing away from ${status.topCountry} to reduce concentrated tariff exposure.`,
          "Model a supplier switch on the two most exposed categories.",
        ],
        assumptions: [`Stress scenario: ${severe.name} (${severe.description}).`, "Tariff exposure is monthly duty on current demand at catalog rates.", "Profit-at-risk compares current vs shocked per-unit profit across monthly demand."],
        confidence: 0.84,
        disclaimerVariant: "financial",
        disclaimerText: GENERAL_DISCLAIMER,
        aiContext: { tariffExposure: status.tariffExposure, marginAtRisk: status.marginAtRisk, skusBelowTarget: status.skusBelowTarget },
      };
    }
  }
}

function categoryExposure(rollup: ReturnType<typeof runScenario>) {
  const map = new Map<string, { marginSum: number; count: number; atRisk: number }>();
  for (const r of rollup.results) {
    const cur = map.get(r.category) ?? { marginSum: 0, count: 0, atRisk: 0 };
    cur.marginSum += r.currentMargin;
    cur.count += 1;
    cur.atRisk += r.grossProfitAtRisk;
    map.set(r.category, cur);
  }
  return [...map.entries()].map(([category, v]) => ({ category, margin: Math.round((v.marginSum / v.count) * 100), atRisk: Math.round(v.atRisk) }));
}
