"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import {
  Card, SectionTitle, MetricCard, RiskBadge, Button, Select, Slider, Field,
  DisclaimerBox, EmptyState, Tabs, StatusBadge,
} from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { HBarChart, ScenarioImpactChart, MarginHeatmap, CHART_COLORS } from "@/components/charts";
import { runScenario } from "@/lib/finance/scenarioEngine";
import { requestAI } from "@/lib/ai/actions";
import { fmtCurrency, fmtPercent, fmtNumber } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import { useStore } from "@/lib/store/useStore";
import type { Scenario, Product, RiskLevel, RiskRecommendation } from "@/lib/types";
import {
  Zap, Sparkles, RotateCcw, ArrowRightLeft, Table2, Flame, ListChecks,
  SlidersHorizontal, TrendingDown, Target, Boxes,
} from "lucide-react";

// ── Scope ─────────────────────────────────────────────────────────
type ScopeId = "sku" | "category" | "supplier" | "country" | "portfolio" | "po";
const SCOPE_TABS: { id: ScopeId; label: string }[] = [
  { id: "sku", label: "One SKU" },
  { id: "category", label: "Category" },
  { id: "supplier", label: "Supplier" },
  { id: "country", label: "Country" },
  { id: "portfolio", label: "Entire Portfolio" },
  { id: "po", label: "Open POs" },
];

// ── Scenario control form (values in slider units — %/pts/days) ────
interface Form {
  tariff: number;      // pts added to duty rate
  addlDuty: number;    // pts surcharge
  freight: number;     // %
  supplier: number;    // %
  currency: number;    // %
  insurance: number;   // %
  warehouse: number;   // %
  leadTime: number;    // days
  demandDrop: number;  // %
  targetMargin: number;// %
  priceAllowed: number;// %
  sensitivity: "low" | "medium" | "high";
}

function scenarioToForm(s: Scenario): Form {
  const r = (n: number) => Math.round(n * 1000) / 10; // ratio → pts, 1 decimal
  return {
    tariff: r(s.tariffIncreasePercent),
    addlDuty: r(s.additionalDutyPercent),
    freight: r(s.freightIncreasePercent),
    supplier: r(s.supplierCostIncreasePercent),
    currency: r(s.currencyImpactPercent),
    insurance: r(s.insuranceCostIncreasePercent),
    warehouse: r(s.warehouseCostIncreasePercent),
    leadTime: s.leadTimeIncreaseDays,
    demandDrop: r(s.demandDropPercent),
    targetMargin: r(s.targetMargin),
    priceAllowed: r(s.priceIncreaseAllowedPercent),
    sensitivity: s.customerPriceSensitivity,
  };
}

function formToScenario(f: Form, name: string): Scenario {
  const p = (n: number) => n / 100;
  return {
    id: "sim-custom",
    name,
    description: "Interactive tariff-shock simulation.",
    tariffIncreasePercent: p(f.tariff),
    additionalDutyPercent: p(f.addlDuty),
    freightIncreasePercent: p(f.freight),
    supplierCostIncreasePercent: p(f.supplier),
    currencyImpactPercent: p(f.currency),
    insuranceCostIncreasePercent: p(f.insurance),
    warehouseCostIncreasePercent: p(f.warehouse),
    demandDropPercent: p(f.demandDrop),
    leadTimeIncreaseDays: f.leadTime,
    targetMargin: p(f.targetMargin),
    priceIncreaseAllowedPercent: p(f.priceAllowed),
    customerPriceSensitivity: f.sensitivity,
  };
}

function deriveRisk(belowShare: number, avgScenarioMargin: number): RiskLevel {
  if (avgScenarioMargin < 0.1 || belowShare > 0.4) return "critical";
  if (belowShare > 0.2) return "warning";
  if (belowShare > 0) return "watch";
  return "safe";
}

type SortKey = "grossProfitAtRisk" | "scenarioMargin" | "marginLoss" | "requiredPriceIncrease" | "revenueAtRisk";

export default function TariffSimulatorPage() {
  return (
    <>
      <PageHeader
        title="Tariff Shock Simulator"
        description="Stress-test any slice of the portfolio against tariff, freight, supplier, and FX shocks — every number recomputes live from the deterministic finance engine."
        icon={Zap}
      />
      <NoDataGate>
        <SimulatorBody />
      </NoDataGate>
    </>
  );
}

function SimulatorBody() {
  const { dataset } = useStore();
  const { products, suppliers, purchaseOrders, scenarios } = dataset;

  // Default scenario = Severe Tariff Shock (or first).
  const baseScenario = React.useMemo(
    () => scenarios.find((s) => s.name === "Severe Tariff Shock") ?? scenarios[0],
    [scenarios],
  );

  // Scope selection
  const [scope, setScope] = React.useState<ScopeId>("portfolio");
  const categories = React.useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);
  const countries = React.useMemo(() => [...new Set(products.map((p) => p.countryOfOrigin))].sort(), [products]);
  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const [category, setCategory] = React.useState(categories[0] ?? "");
  const [supplierId, setSupplierId] = React.useState(suppliers[0]?.id ?? "");
  const [country, setCountry] = React.useState(countries[0] ?? "");

  const filtered = React.useMemo<Product[]>(() => {
    switch (scope) {
      case "sku": return products.filter((p) => p.id === productId);
      case "category": return products.filter((p) => p.category === category);
      case "supplier": return products.filter((p) => p.supplierId === supplierId);
      case "country": return products.filter((p) => p.countryOfOrigin === country);
      case "po": {
        const ids = new Set(purchaseOrders.flatMap((po) => po.lines.map((l) => l.productId)));
        return products.filter((p) => ids.has(p.id));
      }
      default: return products;
    }
  }, [scope, products, purchaseOrders, productId, category, supplierId, country]);

  // Scenario controls
  const [form, setForm] = React.useState<Form>(() => scenarioToForm(baseScenario));
  const [activePreset, setActivePreset] = React.useState<string>(baseScenario.id);

  function setField<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    setActivePreset("custom");
  }
  function loadPreset(s: Scenario) {
    setForm(scenarioToForm(s));
    setActivePreset(s.id);
  }

  const scenarioName = activePreset === "custom"
    ? "Custom Scenario"
    : scenarios.find((s) => s.id === activePreset)?.name ?? "Custom Scenario";
  const scenario = React.useMemo(() => formToScenario(form, scenarioName), [form, scenarioName]);

  // Live rollup
  const { results, portfolio } = React.useMemo(() => runScenario(filtered, scenario), [filtered, scenario]);
  const hasResults = results.length > 0;
  const belowShare = hasResults ? portfolio.productsBelowTarget / results.length : 0;
  const riskLevel = deriveRisk(belowShare, portfolio.avgScenarioMargin);

  const avgLandedIncrease = hasResults
    ? results.reduce((s, r) => s + (r.scenarioLandedCost - r.currentLandedCost), 0) / results.length
    : 0;
  const avgMarginDrop = portfolio.avgCurrentMargin - portfolio.avgScenarioMargin;

  // Active drivers (for note + AI)
  const drivers = [
    { label: "Tariff Increase", v: form.tariff, detail: `+${form.tariff} pts added to the duty rate` },
    { label: "Additional Duty", v: form.addlDuty, detail: `+${form.addlDuty} pts import surcharge` },
    { label: "Freight", v: form.freight, detail: `+${form.freight}% ocean / air freight` },
    { label: "Supplier Cost", v: form.supplier, detail: `+${form.supplier}% ex-works cost` },
    { label: "Currency", v: form.currency, detail: `${form.currency}% USD weakness vs sourcing FX` },
    { label: "Insurance", v: form.insurance, detail: `+${form.insurance}% cargo insurance` },
    { label: "Warehouse", v: form.warehouse, detail: `+${form.warehouse}% warehousing` },
    { label: "Demand Drop", v: form.demandDrop, detail: `-${form.demandDrop}% unit volume` },
    { label: "Lead Time", v: form.leadTime, detail: `+${form.leadTime} days in transit` },
  ].filter((d) => d.v > 0);

  // Sorted table
  const [sortKey, setSortKey] = React.useState<SortKey>("grossProfitAtRisk");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const sorted = React.useMemo(() => {
    const arr = [...results];
    arr.sort((a, b) => (sortDir === "asc" ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return arr;
  }, [results, sortKey, sortDir]);
  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  // Top 10 most exposed by gross profit at risk
  const topExposed = React.useMemo(
    () => [...results].sort((a, b) => b.grossProfitAtRisk - a.grossProfitAtRisk).slice(0, 10)
      .map((r) => ({ label: r.sku, value: r.grossProfitAtRisk })),
    [results],
  );

  // Scenario impact (current vs scenario margin per SKU)
  const impactData = React.useMemo(
    () => sorted.slice(0, 14).map((r) => ({ name: r.sku, current: r.currentMargin, scenario: r.scenarioMargin })),
    [sorted],
  );

  // Heatmap: products × first 6 scenarios
  const heatProducts = filtered.slice(0, 10);
  const heatScenarios = scenarios.slice(0, 6);

  // Recommended-action rollup
  const actionCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of results) m.set(r.recommendedAction, (m.get(r.recommendedAction) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [results]);

  // AI
  const [ai, setAi] = React.useState<{ data: RiskRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  async function generatePlan() {
    setLoadingAi(true);
    const worst = portfolio.worstProduct;
    const keyFindings = [
      `${portfolio.productsBelowTarget} of ${results.length} SKUs fall below target margin under "${scenarioName}".`,
      `Average margin compresses from ${fmtPercent(portfolio.avgCurrentMargin)} to ${fmtPercent(portfolio.avgScenarioMargin)} (${fmtPercent(avgMarginDrop)} of points lost).`,
      `Landed cost rises by an average of ${fmtCurrency(avgLandedIncrease)} per unit.`,
      worst && `${worst.name} is the most exposed SKU — margin falls to ${fmtPercent(worst.scenarioMargin)}, needing a ${fmtPercent(worst.requiredPriceIncrease)} price increase.`,
    ].filter(Boolean) as string[];

    const res = await requestAI("tariff_shock", {
      scenario: scenarioName,
      scope,
      productsBelowTarget: portfolio.productsBelowTarget,
      grossProfitAtRisk: portfolio.totalGrossProfitAtRisk,
      revenueAtRisk: portfolio.totalRevenueAtRisk,
      riskLevel,
      summary: `Under "${scenarioName}", ${portfolio.productsBelowTarget} SKUs drop below target and ${fmtCurrency(portfolio.totalGrossProfitAtRisk)} of gross profit is at risk across the ${scope === "portfolio" ? "portfolio" : "selected scope"}.`,
      keyFindings,
      topDrivers: drivers.map((d) => ({ label: d.label, detail: d.detail })),
      recommendedAction: worst?.recommendedAction ?? "Reprice or renegotiate the most exposed SKUs to restore target margin.",
    });
    setAi(res as never);
    setLoadingAi(false);
  }

  // Scope-specific selector control
  const scopeSelector = (() => {
    if (scope === "sku") return (
      <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="max-w-[240px]">
        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
    );
    if (scope === "category") return (
      <Select value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-[240px]">
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
    );
    if (scope === "supplier") return (
      <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="max-w-[240px]">
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
    );
    if (scope === "country") return (
      <Select value={country} onChange={(e) => setCountry(e.target.value)} className="max-w-[240px]">
        {countries.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
    );
    return null;
  })();

  return (
    <div className="space-y-6">
      {/* Scope */}
      <Card>
        <SectionTitle
          icon={Boxes}
          title="Simulation Scope"
          subtitle="Choose which slice of the catalog to shock. All outputs below react instantly."
          right={<StatusBadge tone="cyan">{fmtNumber(filtered.length)} SKUs in scope</StatusBadge>}
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="overflow-x-auto">
            <Tabs tabs={SCOPE_TABS} active={scope} onChange={setScope} />
          </div>
          {scopeSelector}
        </div>
      </Card>

      {/* Preset scenarios */}
      <Card>
        <SectionTitle
          icon={Flame}
          title="Preset Scenarios"
          subtitle="Load a curated shock, then fine-tune the drivers below. Any edit switches to a Custom Scenario."
          right={
            <Button variant="ghost" onClick={() => loadPreset(baseScenario)}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <PresetPill key={s.id} active={activePreset === s.id} onClick={() => loadPreset(s)} title={s.description}>
              {s.name}
            </PresetPill>
          ))}
          <PresetPill active={activePreset === "custom"} onClick={() => setActivePreset("custom")} title="Hand-tuned scenario">
            Custom Scenario
          </PresetPill>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Controls */}
        <Card>
          <SectionTitle
            icon={SlidersHorizontal}
            title="Scenario Controls"
            subtitle={`Active: ${scenarioName}`}
            right={<RiskBadge level={riskLevel} />}
          />
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Slider label="Tariff increase" value={form.tariff} min={0} max={40} step={0.5} onChange={(v) => setField("tariff", v)} format={(v) => `+${v} pts`} />
            <Slider label="Additional duty" value={form.addlDuty} min={0} max={25} step={0.5} onChange={(v) => setField("addlDuty", v)} format={(v) => `+${v} pts`} />
            <Slider label="Freight increase" value={form.freight} min={0} max={100} step={1} onChange={(v) => setField("freight", v)} format={(v) => `+${v}%`} />
            <Slider label="Supplier cost increase" value={form.supplier} min={0} max={50} step={1} onChange={(v) => setField("supplier", v)} format={(v) => `+${v}%`} />
            <Slider label="Currency impact" value={form.currency} min={0} max={25} step={1} onChange={(v) => setField("currency", v)} format={(v) => `+${v}%`} />
            <Slider label="Insurance cost increase" value={form.insurance} min={0} max={50} step={1} onChange={(v) => setField("insurance", v)} format={(v) => `+${v}%`} />
            <Slider label="Warehouse cost increase" value={form.warehouse} min={0} max={50} step={1} onChange={(v) => setField("warehouse", v)} format={(v) => `+${v}%`} />
            <Slider label="Lead time increase" value={form.leadTime} min={0} max={60} step={1} onChange={(v) => setField("leadTime", v)} format={(v) => `+${v} d`} />
            <Slider label="Demand drop" value={form.demandDrop} min={0} max={50} step={1} onChange={(v) => setField("demandDrop", v)} format={(v) => `-${v}%`} />
            <Slider label="Target margin" value={form.targetMargin} min={10} max={60} step={1} onChange={(v) => setField("targetMargin", v)} format={(v) => `${v}%`} />
            <Slider label="Price increase allowed" value={form.priceAllowed} min={0} max={40} step={1} onChange={(v) => setField("priceAllowed", v)} format={(v) => `${v}%`} />
            <Field label="Customer price sensitivity">
              <Select value={form.sensitivity} onChange={(e) => setField("sensitivity", e.target.value as Form["sensitivity"])}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </div>
        </Card>

        {/* Before / after summary + note */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCard label="SKUs Below Target" value={fmtNumber(portfolio.productsBelowTarget)} sub={`of ${fmtNumber(results.length)} in scope`} tone={portfolio.productsBelowTarget > 0 ? "amber" : "emerald"} icon={TrendingDown} />
            <MetricCard label="Gross Profit at Risk" value={fmtCurrency(portfolio.totalGrossProfitAtRisk, "USD", { compact: true })} tone="danger" icon={Flame} sub="monthly" />
            <MetricCard label="Revenue at Risk" value={fmtCurrency(portfolio.totalRevenueAtRisk, "USD", { compact: true })} tone="amber" sub="below-target SKUs" />
            <MetricCard label="Avg Current Margin" value={fmtPercent(portfolio.avgCurrentMargin)} tone="cyan" icon={Target} />
            <MetricCard label="Avg Scenario Margin" value={fmtPercent(portfolio.avgScenarioMargin)} tone={portfolio.avgScenarioMargin >= form.targetMargin / 100 ? "emerald" : "danger"} icon={Target} />
            <MetricCard label="Avg Margin Loss" value={fmtPercent(avgMarginDrop)} sub={`+${fmtCurrency(avgLandedIncrease)}/unit landed`} tone="danger" />
          </div>

          <Card>
            <SectionTitle icon={ArrowRightLeft} title="Before → After" subtitle="Deterministic waterfall difference for the active scenario." />
            {hasResults ? (
              <div className="space-y-3 text-sm">
                <p className="text-ink-muted">
                  {`"${scenarioName}" lifts landed cost by an average of `}
                  <span className="font-semibold text-amber">{fmtCurrency(avgLandedIncrease)}</span>
                  {" per unit, compressing average margin from "}
                  <span className="font-semibold text-cyan">{fmtPercent(portfolio.avgCurrentMargin)}</span>
                  {" to "}
                  <span className="font-semibold text-danger">{fmtPercent(portfolio.avgScenarioMargin)}</span>
                  {`. ${portfolio.productsBelowTarget} SKU(s) drop below target, putting `}
                  <span className="font-semibold text-danger">{fmtCurrency(portfolio.totalGrossProfitAtRisk)}</span>
                  {" of monthly gross profit at risk."}
                </p>
                {drivers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {drivers.map((d) => (
                      <span key={d.label} className="pill bg-base-800 text-ink-muted ring-1 ring-white/10" title={d.detail}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint">No shock applied — move a slider or load a preset.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">No SKUs in the current scope.</p>
            )}
          </Card>
        </div>
      </div>

      {!hasResults ? (
        <EmptyState
          icon={Boxes}
          title="No SKUs in scope"
          message="This scope selection matches no products. Pick a different scope or selection to run the simulation."
        />
      ) : (
        <>
          {/* SKU impact table */}
          <Card>
            <SectionTitle
              icon={Table2}
              title="SKU-Level Impact"
              subtitle="Sortable — click a numeric column header. Colored by scenario risk."
              right={<StatusBadge tone="neutral">{fmtNumber(results.length)} rows</StatusBadge>}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3 font-medium">SKU</th>
                    <th className="py-2 pr-3 font-medium">Product</th>
                    <th className="py-2 pr-3 text-right font-medium">Cur. Landed</th>
                    <th className="py-2 pr-3 text-right font-medium">Scn. Landed</th>
                    <th className="py-2 pr-3 text-right font-medium">Cur. Margin</th>
                    <SortTh label="Scn. Margin" k="scenarioMargin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Margin Loss" k="marginLoss" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="Price +" k="requiredPriceIncrease" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="GP at Risk" k="grossProfitAtRisk" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="py-2 pr-3 font-medium">Risk</th>
                    <th className="py-2 font-medium">Recommended Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.productId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2 pr-3 font-mono text-xs text-ink-muted">{r.sku}</td>
                      <td className="py-2 pr-3 text-ink">{r.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">{fmtCurrency(r.currentLandedCost)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-amber">{fmtCurrency(r.scenarioLandedCost)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">{fmtPercent(r.currentMargin)}</td>
                      <td className={cn("py-2 pr-3 text-right tabular-nums font-medium", r.scenarioMargin < 0 ? "text-danger" : r.scenarioMargin < r.currentMargin ? "text-amber" : "text-emerald")}>{fmtPercent(r.scenarioMargin)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-danger">{fmtPercent(r.marginLoss)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-cyan">{r.requiredPriceIncrease > 0 ? `+${fmtPercent(r.requiredPriceIncrease)}` : "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-danger">{fmtCurrency(r.grossProfitAtRisk, "USD", { compact: true })}</td>
                      <td className="py-2 pr-3"><RiskBadge level={r.riskLevel} /></td>
                      <td className="py-2 max-w-[280px] text-xs text-ink-muted">{r.recommendedAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle icon={Flame} title="Top 10 Most Exposed SKUs" subtitle="Ranked by monthly gross profit at risk." />
              {topExposed.some((d) => d.value > 0)
                ? <HBarChart data={topExposed} color={CHART_COLORS.danger} format={(v) => fmtCurrency(v, "USD", { compact: true })} />
                : <p className="py-8 text-center text-sm text-ink-faint">No gross profit at risk under this scenario.</p>}
            </Card>
            <Card>
              <SectionTitle icon={ArrowRightLeft} title="Current vs Scenario Margin" subtitle="Per-SKU margin compression (top rows by current sort)." />
              <ScenarioImpactChart data={impactData} />
            </Card>
          </div>

          {/* Heatmap */}
          <Card>
            <SectionTitle icon={Zap} title="Margin Heatmap" subtitle="Resulting margin per in-scope SKU across the six core preset scenarios." />
            {heatProducts.length > 0 && (
              <MarginHeatmap
                rows={heatProducts.map((p) => p.name)}
                cols={heatScenarios.map((s) => s.name.replace(/ (Tariff |Shock|Crisis|Surge)/g, " ").trim().slice(0, 14))}
                cell={(ri, ci) => {
                  const rr = runScenario([heatProducts[ri]], heatScenarios[ci]).results[0];
                  return { margin: rr.scenarioMargin, level: rr.riskLevel };
                }}
              />
            )}
          </Card>

          {/* Recommended action rollup */}
          <Card>
            <SectionTitle icon={ListChecks} title="Recommended Actions" subtitle="Deterministic mitigation per SKU, grouped by play." />
            <div className="space-y-2">
              {actionCounts.map(([action, count]) => (
                <div key={action} className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2 text-sm">
                  <span className="text-ink-muted">{action}</span>
                  <StatusBadge tone="neutral">{count} SKU{count === 1 ? "" : "s"}</StatusBadge>
                </div>
              ))}
            </div>
          </Card>

          {/* AI action plan */}
          <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
            <SectionTitle
              icon={Sparkles}
              title="AI Action Plan"
              subtitle="Turns the deterministic shock results into a prioritized mitigation plan."
              right={
                <Button variant="primary" onClick={generatePlan} disabled={loadingAi}>
                  <Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Generating…" : ai ? "Regenerate" : "Generate AI Action Plan"}
                </Button>
              }
            />
            {!ai && !loadingAi && (
              <p className="text-sm text-ink-muted">
                Every metric above is already computed deterministically. Generate a plan to summarize the {portfolio.productsBelowTarget} at-risk SKU(s)
                and {fmtCurrency(portfolio.totalGrossProfitAtRisk)} of gross profit exposure into owner-assigned actions.
              </p>
            )}
            {(ai || loadingAi) && (
              <AIRecommendationPanel title="AI Tariff-Shock Mitigation Plan" data={ai?.data} source={ai?.source} warning={ai?.warning} loading={loadingAi} />
            )}
          </Card>
        </>
      )}

      <DisclaimerBox variant="financial">
        Forecasts and scenarios are estimates based on demo data and user-provided assumptions. They are not guarantees of future
        costs, margins, demand, or profitability, and are not legal, customs, tax, or financial advice. All demo data is fictional.
      </DisclaimerBox>
    </div>
  );
}

function PresetPill({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-slateaccent text-white ring-1 ring-slateaccent" : "bg-base-800 text-ink-muted ring-1 ring-white/10 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function SortTh({ label, k, sortKey, sortDir, onSort }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="py-2 pr-3 text-right font-medium">
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-ink", active ? "text-slateaccent" : "")}>
        {label}{active && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}
