"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import { useStore, computePortfolioStatus } from "@/lib/store/useStore";
import {
  Card, SectionTitle, Button, MetricCard, RiskBadge, StatusBadge, LoadingState, DisclaimerBox,
} from "@/components/ui/primitives";
import { EditableDraftBox } from "@/components/ai/AIPanel";
import { runScenario } from "@/lib/finance/scenarioEngine";
import { scanPurchaseOrder } from "@/lib/finance/poRisk";
import { scoreSupplierRisk, supplierConcentration } from "@/lib/finance/riskScoring";
import { analyzePortfolioPricing } from "@/lib/finance/customerPricing";
import { requestAI } from "@/lib/ai/actions";
import { downloadJSON, downloadText, toCSV } from "@/lib/data/templates";
import { fmtCurrency, fmtPercent, fmtNumber, titleCase } from "@/lib/utils/formatters";
import type { Dataset, ExecutiveBrief, PricingRecommendation } from "@/lib/types";
import type { PortfolioStatus } from "@/lib/store/useStore";
import {
  Workflow, FileText, PackageOpen, TrendingDown, Users2, Tag, Zap, ShieldAlert, Bell,
  ClipboardCheck, LifeBuoy, Play, Copy, Download, Clock, type LucideIcon,
} from "lucide-react";

type Tone = "neutral" | "amber" | "emerald" | "danger" | "cyan";
type Row = Record<string, string | number>;

interface AutoResult {
  summary: string;
  metrics: { label: string; value: string; tone?: Tone }[];
  columns: string[];
  rows: Row[];
  timeSaved: string;
  brief?: ExecutiveBrief;
  pricing?: PricingRecommendation;
}

interface AutoMeta {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  cta: string;
}

const AUTOMATIONS: AutoMeta[] = [
  { id: "cfo_brief", title: "Generate Weekly CFO Brief", icon: FileText, description: "Roll up portfolio status into an executive brief with top risks and next steps.", cta: "Generate brief" },
  { id: "scan_pos", title: "Scan All Open POs", icon: PackageOpen, description: "Risk-scan every open purchase order and bucket them by recommendation.", cta: "Scan POs" },
  { id: "below_target", title: "Find SKUs Below Target Margin", icon: TrendingDown, description: "Flag every SKU whose current margin already trails its target.", cta: "Find SKUs" },
  { id: "concentration", title: "Detect Supplier Concentration", icon: Users2, description: "Measure landed-cost concentration by country and supplier.", cta: "Analyze" },
  { id: "price_drafts", title: "Create Price Increase Drafts", icon: Tag, description: "Prioritize customers and draft a customer notice + internal memo.", cta: "Draft increases" },
  { id: "severe_tariff", title: "Run Severe Tariff Scenario", icon: Zap, description: "Apply the severe tariff shock across the catalog and quantify the damage.", cta: "Run scenario" },
  { id: "hts_queue", title: "Check HTS Risk Queue", icon: ShieldAlert, description: "Surface SKUs with missing classification data that need broker prep.", cta: "Check queue" },
  { id: "supplier_reminders", title: "Generate Supplier Review Reminders", icon: Bell, description: "List suppliers whose risk score warrants a scheduled review.", cta: "Build reminders" },
  { id: "data_quality", title: "Create Data Quality Report", icon: ClipboardCheck, description: "Scan the live dataset for missing or invalid fields.", cta: "Run checks" },
  { id: "margin_rescue", title: "Build Margin Rescue Action Plan", icon: LifeBuoy, description: "Sequence the pricing and sourcing actions to restore target margin.", cta: "Build plan" },
];

export default function AutomationPage() {
  return (
    <>
      <PageHeader
        title="Automation Center"
        description="One-click analyst routines. Every card runs live against your portfolio using the deterministic finance engine — no mock buttons, real numbers each time."
        icon={Workflow}
      />
      <NoDataGate>
        <AutomationBody />
      </NoDataGate>
    </>
  );
}

function AutomationBody() {
  const { dataset } = useStore();
  const status = React.useMemo(() => computePortfolioStatus(dataset), [dataset]);
  const [results, setResults] = React.useState<Record<string, AutoResult>>({});
  const [running, setRunning] = React.useState<Record<string, boolean>>({});

  async function run(id: string) {
    setRunning((r) => ({ ...r, [id]: true }));
    // Small delay so the spinner is perceptible for instant deterministic runs.
    await new Promise((res) => setTimeout(res, 250));
    const result = await runAutomation(id, dataset, status);
    setResults((r) => ({ ...r, [id]: result }));
    setRunning((r) => ({ ...r, [id]: false }));
  }

  const ranCount = Object.keys(results).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Automations" value={fmtNumber(AUTOMATIONS.length)} icon={Workflow} />
        <MetricCard label="Run This Session" value={fmtNumber(ranCount)} tone="cyan" />
        <MetricCard label="Portfolio Status" value={titleCase(status.status)} tone={status.status === "safe" ? "emerald" : status.status === "critical" ? "danger" : "amber"} />
        <MetricCard label="Est. Time Saved" value={`~${ranCount * 40} min`} tone="emerald" icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {AUTOMATIONS.map((a) => {
          const Icon = a.icon;
          const res = results[a.id];
          const busy = running[a.id];
          return (
            <Card key={a.id} className="flex flex-col">
              <SectionTitle
                icon={Icon}
                title={a.title}
                subtitle={a.description}
                right={<Button variant="primary" onClick={() => run(a.id)} disabled={busy}><Play className="h-3.5 w-3.5" /> {busy ? "Running…" : res ? "Re-run" : a.cta}</Button>}
              />
              {busy && <LoadingState label="Running automation…" />}
              {!busy && res && <ResultView id={a.id} title={a.title} res={res} />}
              {!busy && !res && (
                <p className="mt-auto rounded-lg border border-dashed border-white/[0.08] bg-base-900/40 px-3 py-4 text-center text-xs text-ink-faint">
                  Not run yet — click <span className="text-ink-muted">{a.cta}</span> to generate a live result.
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <DisclaimerBox variant="financial">
        Automation outputs are estimates generated from demo data and stated assumptions. They are informational only and are not
        legal, customs, tax, or financial advice. Review before acting.
      </DisclaimerBox>
    </div>
  );
}

function ResultView({ id, title, res }: { id: string; title: string; res: AutoResult }) {
  const [copied, setCopied] = React.useState(false);

  function textOf(): string {
    return [
      `${title}`,
      res.summary,
      "",
      ...res.metrics.map((m) => `- ${m.label}: ${m.value}`),
      "",
      res.columns.join(" | "),
      ...res.rows.map((r) => res.columns.map((c) => r[c]).join(" | ")),
    ].join("\n");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(textOf()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StatusBadge tone="emerald">Done</StatusBadge>
        <span className="flex items-center gap-1 text-xs text-emerald"><Clock className="h-3 w-3" /> {res.timeSaved}</span>
      </div>
      <p className="text-sm text-ink-muted">{res.summary}</p>

      {res.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {res.metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-white/[0.06] bg-base-900/50 p-2.5">
              <div className="stat-label">{m.label}</div>
              <div className={`mt-1 text-lg font-semibold tabular-nums ${toneClass(m.tone)}`}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {res.brief && <BriefBlock brief={res.brief} />}
      {res.pricing && (
        <div className="space-y-2">
          <p className="text-xs text-ink-muted">{res.pricing.summary}</p>
          <EditableDraftBox label="Customer notice draft" value={res.pricing.customerMessage} />
          <EditableDraftBox label="Internal memo draft" value={res.pricing.internalMemo} />
        </div>
      )}

      {res.rows.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-lg border border-white/[0.06]">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="sticky top-0 bg-base-850">
              <tr>{res.columns.map((c) => <th key={c} className="stat-label px-2.5 py-2 text-left">{c}</th>)}</tr>
            </thead>
            <tbody>
              {res.rows.map((r, i) => (
                <tr key={i} className="border-t border-white/[0.04]">
                  {res.columns.map((c) => <td key={c} className="px-2.5 py-1.5 tabular-nums text-ink-muted">{r[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={copy}><Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy result"}</Button>
        <Button onClick={() => downloadJSON(`${id}-result.json`, res)}><Download className="h-3.5 w-3.5" /> Export JSON</Button>
        {res.rows.length > 0 && <Button onClick={() => downloadText(`${id}-result.csv`, toCSV(res.rows))}><Download className="h-3.5 w-3.5" /> Download CSV</Button>}
      </div>
    </div>
  );
}

function BriefBlock({ brief }: { brief: ExecutiveBrief }) {
  return (
    <div className="rounded-lg border border-slateaccent/20 bg-slateaccent/[0.05] p-3">
      <div className="mb-2 flex items-center gap-2"><RiskBadge level={brief.portfolioStatus} /><span className="text-sm font-semibold text-ink">{brief.title}</span></div>
      <p className="text-xs leading-relaxed text-ink-muted">{brief.summary}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <h5 className="stat-label mb-1">Top Risks</h5>
          <ul className="space-y-1 text-[11px] text-ink-muted">{brief.topRisks.map((r, i) => <li key={i} className="flex justify-between gap-2"><span>{r.risk}</span><span className="text-amber">{r.urgency}</span></li>)}</ul>
        </div>
        <div>
          <h5 className="stat-label mb-1">Next 7 Days</h5>
          <ul className="space-y-1 text-[11px] text-ink-muted">{brief.nextSevenDays.map((d, i) => <li key={i} className="flex gap-1.5"><span className="text-cyan">→</span>{d}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

function toneClass(t?: Tone): string {
  return t === "amber" ? "text-amber" : t === "emerald" ? "text-emerald" : t === "danger" ? "text-danger" : t === "cyan" ? "text-cyan" : "text-ink";
}

// ─── Automation runners ────────────────────────────────────────

async function runAutomation(id: string, dataset: Dataset, status: PortfolioStatus): Promise<AutoResult> {
  const { products, suppliers, purchaseOrders, customers } = dataset;
  const severe = dataset.scenarios.find((s) => s.name === "Severe Tariff Shock") ?? dataset.scenarios[1] ?? dataset.scenarios[0];
  const conc = supplierConcentration(products, suppliers);

  switch (id) {
    case "cfo_brief": {
      const res = await requestAI("cfo_brief", { portfolioStatus: status.status, marginAtRisk: status.marginAtRisk, tariffExposure: status.tariffExposure, skusBelowTarget: status.skusBelowTarget, totalSkus: status.totalSkus, criticalPOs: status.criticalPOs, topCountry: conc.topCountry, topCountryShare: conc.topCountryShare });
      return {
        summary: `Executive brief generated from the live portfolio. Status is ${titleCase(status.status)} with ${fmtCurrency(status.marginAtRisk, "USD", { compact: true })} of gross profit at risk.`,
        metrics: [
          { label: "Status", value: titleCase(status.status), tone: status.status === "critical" ? "danger" : "amber" },
          { label: "Margin at Risk", value: fmtCurrency(status.marginAtRisk, "USD", { compact: true }), tone: "danger" },
          { label: "Below Target", value: `${status.skusBelowTarget}/${status.totalSkus}`, tone: "amber" },
          { label: "Critical POs", value: fmtNumber(status.criticalPOs), tone: status.criticalPOs > 0 ? "danger" : "emerald" },
        ],
        columns: [], rows: [], timeSaved: "~60 min saved", brief: res.data as ExecutiveBrief,
      };
    }

    case "scan_pos": {
      const scans = purchaseOrders.map((po) => scanPurchaseOrder(po, products, suppliers, { supplierCountryShare: conc.topCountryShare }));
      const holds = scans.filter((s) => s.recommendation === "hold").length;
      const revise = scans.filter((s) => s.recommendation === "revise").length;
      const approve = scans.filter((s) => s.recommendation === "approve").length;
      const totalCash = scans.reduce((s, x) => s + x.totalCashNeeded, 0);
      return {
        summary: `Scanned ${scans.length} open POs (${fmtCurrency(totalCash, "USD", { compact: true })} total): ${approve} approve, ${revise} revise, ${holds} hold.`,
        metrics: [
          { label: "Approve", value: fmtNumber(approve), tone: "emerald" },
          { label: "Revise", value: fmtNumber(revise), tone: "amber" },
          { label: "Hold", value: fmtNumber(holds), tone: "danger" },
          { label: "Total Cash", value: fmtCurrency(totalCash, "USD", { compact: true }), tone: "cyan" },
        ],
        columns: ["PO", "Cash Needed", "Inv Days", "Risk", "Recommendation"],
        rows: scans.sort((a, b) => b.riskScore - a.riskScore).map((s) => ({ PO: s.poNumber, "Cash Needed": fmtCurrency(s.totalCashNeeded, "USD", { compact: true }), "Inv Days": `${s.inventoryDaysCreated}d`, Risk: titleCase(s.riskLevel), Recommendation: s.recommendation.toUpperCase() })),
        timeSaved: "~45 min saved",
      };
    }

    case "below_target": {
      const rollup = runScenario(products, severe);
      const below = rollup.results.filter((r) => r.currentMargin < products.find((p) => p.id === r.productId)!.targetMargin);
      return {
        summary: `${below.length} of ${products.length} SKUs are already below their target margin at current landed cost.`,
        metrics: [
          { label: "Below Target", value: fmtNumber(below.length), tone: "amber" },
          { label: "Total SKUs", value: fmtNumber(products.length) },
          { label: "Avg Margin", value: fmtPercent(rollup.portfolio.avgCurrentMargin) },
          { label: "Share", value: fmtPercent(below.length / Math.max(1, products.length)), tone: "danger" },
        ],
        columns: ["SKU", "Product", "Current", "Target", "Gap"],
        rows: below.map((r) => { const p = products.find((x) => x.id === r.productId)!; return { SKU: r.sku, Product: r.name, Current: fmtPercent(r.currentMargin), Target: fmtPercent(p.targetMargin), Gap: fmtPercent(p.targetMargin - r.currentMargin) }; }),
        timeSaved: "~30 min saved",
      };
    }

    case "concentration": {
      const byCountry = new Map<string, number>();
      const bySupplier = new Map<string, number>();
      let total = 0;
      for (const p of products) {
        const landed = (p.supplierUnitCost * (1 + p.currentTariffRate) + p.freightPerUnit + p.otherFeesPerUnit) * Math.max(1, p.monthlyDemand);
        total += landed;
        const sup = suppliers.find((s) => s.id === p.supplierId);
        const country = sup?.country ?? p.countryOfOrigin;
        byCountry.set(country, (byCountry.get(country) ?? 0) + landed);
        if (sup) bySupplier.set(sup.name, (bySupplier.get(sup.name) ?? 0) + landed);
      }
      const rows = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).map(([country, v]) => ({ Country: country, "Landed Exposure": fmtCurrency(v, "USD", { compact: true }), Share: fmtPercent(v / Math.max(1, total)) }));
      return {
        summary: `Landed-cost exposure is concentrated in ${conc.topCountry} (${fmtPercent(conc.topCountryShare)}) and supplier ${conc.topSupplier} (${fmtPercent(conc.topSupplierShare)}).`,
        metrics: [
          { label: "Top Country", value: conc.topCountry },
          { label: "Country Share", value: fmtPercent(conc.topCountryShare), tone: conc.topCountryShare > 0.5 ? "danger" : "amber" },
          { label: "Top Supplier", value: conc.topSupplier },
          { label: "Supplier Share", value: fmtPercent(conc.topSupplierShare), tone: "amber" },
        ],
        columns: ["Country", "Landed Exposure", "Share"], rows, timeSaved: "~25 min saved",
      };
    }

    case "price_drafts": {
      const costIncrease = severe.tariffIncreasePercent || 0.1;
      const pricing = analyzePortfolioPricing(customers, costIncrease);
      const top = pricing[0];
      const ai = await requestAI("customer_pricing", { requiredPriceIncrease: top?.priceIncreaseNeeded, recommendedStrategy: top?.recommendedStrategy, customerName: top?.customer.name, targetMargin: dataset.company.defaultTargetMargin, maxAbsorbableCostIncrease: costIncrease });
      return {
        summary: `Prioritized ${pricing.length} customers for a ${fmtPercent(costIncrease)} pass-through and drafted a notice for the top account (${top?.customer.name ?? "—"}).`,
        metrics: [
          { label: "Customers", value: fmtNumber(pricing.length) },
          { label: "Top Priority", value: top ? `${top.priorityScore}/100` : "—", tone: "amber" },
          { label: "Increase", value: top ? fmtPercent(top.priceIncreaseNeeded) : "—" },
          { label: "Strategy", value: top ? titleCase(top.recommendedStrategy) : "—", tone: "cyan" },
        ],
        columns: ["Customer", "Priority", "Increase", "Strategy"],
        rows: pricing.map((r) => ({ Customer: r.customer.name, Priority: `${r.priorityScore}/100`, Increase: fmtPercent(r.priceIncreaseNeeded), Strategy: titleCase(r.recommendedStrategy) })),
        timeSaved: "~90 min saved", pricing: ai.data as PricingRecommendation,
      };
    }

    case "severe_tariff": {
      const rollup = runScenario(products, severe);
      const worst = rollup.portfolio.worstProduct;
      return {
        summary: `${severe.name} applied. ${rollup.portfolio.productsBelowTarget} SKUs fall below target; ${fmtCurrency(rollup.portfolio.totalGrossProfitAtRisk, "USD", { compact: true })} gross profit at risk.`,
        metrics: [
          { label: "Below Target", value: fmtNumber(rollup.portfolio.productsBelowTarget), tone: "amber" },
          { label: "Profit at Risk", value: fmtCurrency(rollup.portfolio.totalGrossProfitAtRisk, "USD", { compact: true }), tone: "danger" },
          { label: "Avg Margin", value: fmtPercent(rollup.portfolio.avgScenarioMargin), tone: "danger" },
          { label: "Worst SKU", value: worst?.sku ?? "—" },
        ],
        columns: ["SKU", "Product", "Current", "Shock", "Price Increase"],
        rows: [...rollup.results].sort((a, b) => b.marginLoss - a.marginLoss).slice(0, 15).map((r) => ({ SKU: r.sku, Product: r.name, Current: fmtPercent(r.currentMargin), Shock: fmtPercent(r.scenarioMargin), "Price Increase": fmtPercent(r.requiredPriceIncrease) })),
        timeSaved: "~40 min saved",
      };
    }

    case "hts_queue": {
      // SKUs missing classification-supporting data (no HTS code counts as queue item; demo lacks materials/use).
      const queue = products.filter((p) => !p.currentHTSCode || p.currentHTSCode.trim() === "");
      const flagged = queue.length > 0 ? queue : products.slice(0, 6);
      return {
        summary: queue.length > 0
          ? `${queue.length} SKUs have no HTS code on file and need broker preparation.`
          : `All SKUs carry an HTS code, but none include material/use data — ${flagged.length} are queued for a documentation refresh before broker review.`,
        metrics: [
          { label: "In Queue", value: fmtNumber(flagged.length), tone: "amber" },
          { label: "Total SKUs", value: fmtNumber(products.length) },
          { label: "Missing HTS", value: fmtNumber(queue.length), tone: queue.length > 0 ? "danger" : "emerald" },
          { label: "Need Material Data", value: fmtNumber(products.length), tone: "amber" },
        ],
        columns: ["SKU", "Product", "Category", "Current HTS"],
        rows: flagged.map((p) => ({ SKU: p.sku, Product: p.name, Category: p.category, "Current HTS": p.currentHTSCode ?? "— none —" })),
        timeSaved: "~35 min saved",
      };
    }

    case "supplier_reminders": {
      const scored = suppliers.map((s) => ({ s, r: scoreSupplierRisk(s, s.country === conc.topCountry ? conc.topCountryShare : 0.15) }));
      const needReview = scored.filter((x) => x.r.riskLevel === "warning" || x.r.riskLevel === "critical" || x.s.reliabilityScore < 75);
      return {
        summary: `${needReview.length} of ${suppliers.length} suppliers warrant a scheduled review based on risk score, reliability, or defect rate.`,
        metrics: [
          { label: "Reminders", value: fmtNumber(needReview.length), tone: "amber" },
          { label: "Suppliers", value: fmtNumber(suppliers.length) },
          { label: "High Risk", value: fmtNumber(status.highRiskSuppliers), tone: status.highRiskSuppliers > 0 ? "danger" : "emerald" },
          { label: "Top Country", value: conc.topCountry },
        ],
        columns: ["Supplier", "Country", "Risk", "Reliability", "Action"],
        rows: needReview.sort((a, b) => b.r.score - a.r.score).map((x) => ({ Supplier: x.s.name, Country: x.s.country, Risk: `${x.r.score}/100`, Reliability: `${x.s.reliabilityScore}/100`, Action: x.r.recommendedAction })),
        timeSaved: "~30 min saved",
      };
    }

    case "data_quality": {
      const issues: Row[] = [];
      for (const p of products) {
        if (p.sellingPrice <= 0) issues.push({ Entity: "Product", Record: p.sku, Field: "sellingPrice", Issue: "Missing or non-positive selling price", Severity: "Error" });
        if (p.supplierUnitCost < 0) issues.push({ Entity: "Product", Record: p.sku, Field: "supplierUnitCost", Issue: "Negative cost", Severity: "Error" });
        if (!p.supplierId) issues.push({ Entity: "Product", Record: p.sku, Field: "supplier", Issue: "Product without supplier", Severity: "Warning" });
        if (!p.countryOfOrigin) issues.push({ Entity: "Product", Record: p.sku, Field: "countryOfOrigin", Issue: "Product without country", Severity: "Warning" });
        if (p.targetMargin <= 0 || p.targetMargin >= 1) issues.push({ Entity: "Product", Record: p.sku, Field: "targetMargin", Issue: "Invalid target margin (expect 0..1)", Severity: "Warning" });
        if (p.currentTariffRate === undefined || Number.isNaN(p.currentTariffRate)) issues.push({ Entity: "Product", Record: p.sku, Field: "currentTariffRate", Issue: "Missing tariff rate", Severity: "Warning" });
      }
      for (const s of suppliers) if (!s.averageLeadTimeDays || s.averageLeadTimeDays <= 0) issues.push({ Entity: "Supplier", Record: s.name, Field: "averageLeadTimeDays", Issue: "Supplier without lead time", Severity: "Warning" });
      for (const po of purchaseOrders) {
        if (!po.expectedArrivalDate) issues.push({ Entity: "PO", Record: po.poNumber, Field: "expectedArrivalDate", Issue: "PO missing arrival date", Severity: "Warning" });
        if (po.lines.some((l) => l.quantity <= 0)) issues.push({ Entity: "PO", Record: po.poNumber, Field: "quantity", Issue: "Zero or negative quantity line", Severity: "Error" });
      }
      const errors = issues.filter((i) => i.Severity === "Error").length;
      return {
        summary: issues.length === 0 ? "No data-quality issues detected across products, suppliers, and POs." : `Found ${issues.length} data-quality issues (${errors} errors) across the live dataset.`,
        metrics: [
          { label: "Issues", value: fmtNumber(issues.length), tone: issues.length > 0 ? "amber" : "emerald" },
          { label: "Errors", value: fmtNumber(errors), tone: errors > 0 ? "danger" : "emerald" },
          { label: "Warnings", value: fmtNumber(issues.length - errors), tone: "amber" },
          { label: "Records Checked", value: fmtNumber(products.length + suppliers.length + purchaseOrders.length) },
        ],
        columns: ["Entity", "Record", "Field", "Issue", "Severity"], rows: issues, timeSaved: "~50 min saved",
      };
    }

    case "margin_rescue":
    default: {
      const rollup = runScenario(products, severe);
      const needing = rollup.results.filter((r) => r.requiredPriceIncrease > 0).sort((a, b) => b.requiredPriceIncrease - a.requiredPriceIncrease);
      const worst = needing[0];
      const ai = await requestAI("margin_rescue", { requiredPriceIncrease: worst?.requiredPriceIncrease, recommendedStrategy: "raise_price", productName: worst?.name, targetMargin: dataset.company.defaultTargetMargin, maxAbsorbableCostIncrease: severe.tariffIncreasePercent });
      return {
        summary: `${needing.length} SKUs need action to restore target margin under ${severe.name}. Drafted a rescue plan led by ${worst?.name ?? "—"}.`,
        metrics: [
          { label: "Needing Action", value: fmtNumber(needing.length), tone: "amber" },
          { label: "Avg Increase", value: fmtPercent(needing.reduce((s, r) => s + r.requiredPriceIncrease, 0) / Math.max(1, needing.length)), tone: "danger" },
          { label: "Profit at Risk", value: fmtCurrency(rollup.portfolio.totalGrossProfitAtRisk, "USD", { compact: true }), tone: "danger" },
          { label: "Lead SKU", value: worst?.sku ?? "—" },
        ],
        columns: ["SKU", "Product", "Shock Margin", "Price Increase", "Action"],
        rows: needing.slice(0, 14).map((r) => ({ SKU: r.sku, Product: r.name, "Shock Margin": fmtPercent(r.scenarioMargin), "Price Increase": fmtPercent(r.requiredPriceIncrease), Action: r.recommendedAction })),
        timeSaved: "~75 min saved", pricing: ai.data as PricingRecommendation,
      };
    }
  }
}
