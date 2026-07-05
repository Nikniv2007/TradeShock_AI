"use client";

import * as React from "react";
import Link from "next/link";
import { useStore } from "@/lib/store/useStore";
import { NoDataGate } from "@/components/layout/NoDataGate";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card, SectionTitle, MetricCard, Button, Select, NumberInput, Slider,
  Field, DisclaimerBox, EmptyState,
} from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { SensitivityChart, MarginHeatmap, CHART_COLORS } from "@/components/charts";
import { modelFXFreight, type FXFreightInput } from "@/lib/finance/fxFreight";
import { requestAI } from "@/lib/ai/actions";
import { fmtCurrency, fmtPercent } from "@/lib/utils/formatters";
import { num, clamp01 } from "@/lib/utils/validators";
import type { Currency, FreightMode, RiskLevel, RiskRecommendation, Product } from "@/lib/types";
import {
  Waves, Sparkles, DollarSign, Ship, TrendingDown, Percent, Wallet, Anchor,
  Gauge, Zap, ArrowRight,
} from "lucide-react";

type FXState = FXFreightInput & { currency: Currency; freightMode: FreightMode; containerUtilization: number };

const FX_STEPS = [0, 0.05, 0.1, 0.15, 0.2, 0.25];
const FREIGHT_STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

export default function FxFreightPage() {
  return (
    <>
      <PageHeader
        title="FX & Freight Shock Modeler"
        description="Stress a landed cost against a weakening dollar and a freight spike — see the margin, cash, and pricing response, live."
        icon={Waves}
      />
      <NoDataGate>
        <FxFreightBody />
      </NoDataGate>
    </>
  );
}

function seedFromProduct(p: Product, currency: Currency): FXState {
  const duty = p.supplierUnitCost * p.currentTariffRate;
  return {
    supplierUnitCostLocal: p.supplierUnitCost,
    baseExchangeRate: 1,
    currentExchangeRate: 1,
    currencyShockPercent: 0,
    freightBaseCost: p.freightPerUnit,
    freightShockPercent: 0,
    otherLandedPerUnit: Math.round((p.otherFeesPerUnit + duty) * 100) / 100,
    sellingPrice: p.sellingPrice,
    targetMargin: p.targetMargin,
    quantity: Math.max(1, p.monthlyDemand),
    inventoryFinancingCostPercent: 0.11,
    leadTimeDays: p.leadTimeDays,
    currency,
    freightMode: "ocean",
    containerUtilization: 0.78,
  };
}

function marginLevel(m: number, target: number): RiskLevel {
  if (m >= target) return "safe";
  if (m >= target - 0.05) return "watch";
  if (m >= target - 0.12) return "warning";
  return "critical";
}

function FxFreightBody() {
  const { dataset } = useStore();
  const { products, suppliers } = dataset;
  if (products.length === 0) {
    return <EmptyState title="No products available" message="This dataset has no products to model." icon={Waves} />;
  }
  return <FxFreightModeler products={products} suppliers={suppliers} />;
}

function FxFreightModeler({ products, suppliers }: { products: Product[]; suppliers: { id: string; currency: Currency }[] }) {
  const supplierCurrency = (id: string): Currency => suppliers.find((s) => s.id === id)?.currency ?? "USD";

  const [productId, setProductId] = React.useState(products[0].id);
  const [state, setState] = React.useState<FXState>(() => seedFromProduct(products[0], supplierCurrency(products[0].supplierId)));
  const [ai, setAi] = React.useState<{ data: RiskRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  const set = <K extends keyof FXState>(k: K, v: FXState[K]) => setState((s) => ({ ...s, [k]: v }));
  const setNum = (k: keyof FXState, v: number) => setState((s) => ({ ...s, [k]: num(v, 0) }));

  function loadProduct(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setProductId(id);
    setState(seedFromProduct(p, supplierCurrency(p.supplierId)));
    setAi(null);
  }

  const result = React.useMemo(() => modelFXFreight(state), [state]);

  const fxSensitivity = React.useMemo(() => {
    const pts: { x: number; margin: number }[] = [];
    for (let s = 0; s <= 0.2501; s += 0.025) {
      const r = modelFXFreight({ ...state, currencyShockPercent: s });
      pts.push({ x: Math.round(s * 1000) / 10, margin: r.shockedMargin });
    }
    return pts;
  }, [state]);

  const freightSensitivity = React.useMemo(() => {
    const pts: { x: number; margin: number }[] = [];
    for (let s = 0; s <= 1.0001; s += 0.1) {
      const r = modelFXFreight({ ...state, freightShockPercent: s });
      pts.push({ x: Math.round(s * 100), margin: r.shockedMargin });
    }
    return pts;
  }, [state]);

  const selected = products.find((p) => p.id === productId);
  const belowTarget = result.shockedMargin < state.targetMargin;

  async function explain() {
    setLoadingAi(true);
    const res = await requestAI("fx_freight", {
      productName: selected?.name,
      riskLevel: belowTarget ? "warning" : "watch",
      combinedImpactPerUnit: result.combinedImpactPerUnit,
      marginImpact: result.marginImpact,
      requiredPriceIncrease: result.requiredPriceIncrease,
      baseMargin: result.baseMargin,
      shockedMargin: result.shockedMargin,
      cashImpact: result.cashImpact,
      summary: `A ${fmtPercent(clamp01(state.currencyShockPercent))} currency shock and ${fmtPercent(clamp01(state.freightShockPercent))} freight shock raise landed cost by ${fmtCurrency(result.combinedImpactPerUnit)}/unit, cutting margin from ${fmtPercent(result.baseMargin)} to ${fmtPercent(result.shockedMargin)}.`,
      keyFindings: [
        `Combined shock adds ${fmtCurrency(result.combinedImpactPerUnit)}/unit (${fmtCurrency(result.cashImpact, "USD", { compact: true })} across ${state.quantity} units).`,
        `Margin falls ${fmtPercent(result.marginImpact)} to ${fmtPercent(result.shockedMargin)} vs a ${fmtPercent(state.targetMargin)} target.`,
        `Holding target margin needs a ${fmtPercent(result.requiredPriceIncrease)} price increase.`,
        `Break-even freight is ${fmtCurrency(result.breakEvenFreightPerUnit)}/unit; financing drag ≈ ${fmtCurrency(result.financingCostImpact, "USD", { compact: true })}.`,
      ],
      recommendedAction: belowTarget
        ? `Stage a price increase near ${fmtPercent(result.requiredPriceIncrease)} or rebalance freight mode/volume before the shock compounds.`
        : "Margin holds under the modeled shock — monitor FX and freight indices and keep the pricing lever ready.",
    });
    setAi({ data: res.data as RiskRecommendation, source: res.source, warning: res.warning });
    setLoadingAi(false);
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <SectionTitle
            icon={Ship}
            title="Shipment & Shock Inputs"
            subtitle="Seed from a demo SKU, then drive the FX and freight shocks."
            right={
              <Select className="max-w-[200px]" value={productId} onChange={(e) => loadProduct(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            }
          />

          <div className="space-y-4">
            <Slider label="Currency shock (weaker USD)" value={state.currencyShockPercent} min={0} max={0.25} step={0.005} onChange={(v) => set("currencyShockPercent", v)} format={(v) => fmtPercent(v)} />
            <Slider label="Freight shock" value={state.freightShockPercent} min={0} max={1} step={0.02} onChange={(v) => set("freightShockPercent", v)} format={(v) => fmtPercent(v)} />
            <Slider label="Inventory financing cost (annual)" value={state.inventoryFinancingCostPercent} min={0} max={0.3} step={0.005} onChange={(v) => set("inventoryFinancingCostPercent", v)} format={(v) => fmtPercent(v)} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Supplier currency" hint="display only">
              <Select value={state.currency} onChange={(e) => set("currency", e.target.value as Currency)}>
                {(["USD", "CNY", "VND", "MXN", "INR", "TRY", "EUR"] as Currency[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Freight mode">
              <Select value={state.freightMode} onChange={(e) => set("freightMode", e.target.value as FreightMode)}>
                {(["ocean", "air", "truck"] as FreightMode[]).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Container utilization" hint="context only">
              <NumberInput value={state.containerUtilization} onChange={(v) => setNum("containerUtilization", v)} step="0.01" />
            </Field>

            <Field label="Supplier unit cost (local)"><NumberInput value={state.supplierUnitCostLocal} onChange={(v) => setNum("supplierUnitCostLocal", v)} step="0.1" /></Field>
            <Field label="Base exchange rate" hint="USD per local unit"><NumberInput value={state.baseExchangeRate} onChange={(v) => setNum("baseExchangeRate", v)} step="0.01" /></Field>
            <Field label="Current exchange rate"><NumberInput value={state.currentExchangeRate} onChange={(v) => setNum("currentExchangeRate", v)} step="0.01" /></Field>

            <Field label="Freight base cost / unit"><NumberInput value={state.freightBaseCost} onChange={(v) => setNum("freightBaseCost", v)} step="0.1" /></Field>
            <Field label="Other landed / unit" hint="duty + fees"><NumberInput value={state.otherLandedPerUnit} onChange={(v) => setNum("otherLandedPerUnit", v)} step="0.1" /></Field>
            <Field label="Shipment volume (units)"><NumberInput value={state.quantity} onChange={(v) => setNum("quantity", v)} step="1" /></Field>

            <Field label="Lead time (days)"><NumberInput value={state.leadTimeDays} onChange={(v) => setNum("leadTimeDays", v)} step="1" /></Field>
            <Field label="Selling price"><NumberInput value={state.sellingPrice} onChange={(v) => setNum("sellingPrice", v)} step="0.1" /></Field>
            <Field label="Target margin" hint="e.g. 0.35 = 35%"><NumberInput value={state.targetMargin} onChange={(v) => setNum("targetMargin", v)} step="0.01" /></Field>
          </div>
        </Card>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3">
          <MetricCard label="FX-Adjusted Supplier Cost" value={fmtCurrency(result.currencyAdjustedSupplierCost)} tone="cyan" icon={DollarSign} sub={`base ${fmtCurrency(state.supplierUnitCostLocal * state.baseExchangeRate)}`} />
          <MetricCard label="Freight-Adjusted / Unit" value={fmtCurrency(result.freightAdjustedPerUnit)} tone="amber" icon={Ship} sub={`base ${fmtCurrency(state.freightBaseCost)}`} />
          <MetricCard label="Combined Impact / Unit" value={fmtCurrency(result.combinedImpactPerUnit)} tone="danger" icon={Zap} />
          <MetricCard label="Base Landed Cost" value={fmtCurrency(result.baseLandedCost)} icon={Anchor} />
          <MetricCard label="Shocked Landed Cost" value={fmtCurrency(result.shockedLandedCost)} tone="danger" icon={Zap} />
          <MetricCard label="Cash Impact" value={fmtCurrency(result.cashImpact, "USD", { compact: true })} tone="amber" icon={Wallet} sub={`${state.quantity} units`} />
          <MetricCard label="Base Margin" value={fmtPercent(result.baseMargin)} tone="emerald" icon={Percent} />
          <MetricCard label="Shocked Margin" value={fmtPercent(result.shockedMargin)} tone={belowTarget ? "danger" : "amber"} icon={TrendingDown} sub={`target ${fmtPercent(state.targetMargin)}`} />
          <MetricCard label="Margin Impact" value={`−${fmtPercent(result.marginImpact)}`} tone="danger" icon={TrendingDown} />
          <MetricCard label="Required Price Increase" value={fmtPercent(result.requiredPriceIncrease)} tone={result.requiredPriceIncrease > 0 ? "amber" : "emerald"} icon={ArrowRight} sub="to hold target" />
          <MetricCard label="Break-even FX Rate" value={result.breakEvenFXRate.toFixed(3)} icon={Gauge} sub={`now ${state.currentExchangeRate.toFixed(3)}`} />
          <MetricCard label="Break-even Freight / Unit" value={fmtCurrency(result.breakEvenFreightPerUnit)} icon={Ship} />
          <MetricCard label="Financing Cost Impact" value={fmtCurrency(result.financingCostImpact, "USD", { compact: true })} tone="cyan" icon={Wallet} sub="lead-time carry" />
        </div>
      </div>

      {/* Sensitivity charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={DollarSign} title="FX Sensitivity" subtitle="Shocked margin as the dollar weakens (freight held at current shock)." />
          <SensitivityChart data={fxSensitivity} xLabel="Currency shock %" color={CHART_COLORS.cyan} />
        </Card>
        <Card>
          <SectionTitle icon={Ship} title="Freight Sensitivity" subtitle="Shocked margin as freight spikes (FX held at current shock)." />
          <SensitivityChart data={freightSensitivity} xLabel="Freight shock %" color={CHART_COLORS.amber} />
        </Card>
      </div>

      {/* Combined shock matrix */}
      <Card>
        <SectionTitle icon={Gauge} title="Combined Shock Matrix" subtitle="Resulting margin across FX shock (rows) × freight shock (columns). Cell color grades against your target margin." />
        <MarginHeatmap
          rows={FX_STEPS.map((s) => `FX ${(s * 100).toFixed(0)}%`)}
          cols={FREIGHT_STEPS.map((s) => `Frt ${(s * 100).toFixed(0)}%`)}
          cell={(ri, ci) => {
            const r = modelFXFreight({ ...state, currencyShockPercent: FX_STEPS[ri], freightShockPercent: FREIGHT_STEPS[ci] });
            return { margin: r.shockedMargin, level: marginLevel(r.shockedMargin, state.targetMargin) };
          }}
        />
        <p className="mt-3 text-xs text-ink-muted">
          Green holds target · cyan within 5 pts · amber within 12 pts · red is a deep margin breach. Read across a row to see how freight compounds an FX move.
        </p>
      </Card>

      {/* AI */}
      <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
        <SectionTitle
          icon={Sparkles}
          title="AI Shock Analyst"
          subtitle="Deterministic FX and freight math, narrated into a pricing and cash response."
          right={<Button variant="primary" onClick={explain} disabled={loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Analyzing…" : ai ? "Regenerate" : "Analyze Shock"}</Button>}
        />
        {!ai && !loadingAi && (
          <p className="text-sm text-ink-muted">
            The metrics and matrix above are the deterministic result. Click <span className="text-ink">Analyze Shock</span> for a prioritized pricing and cash-flow response — or
            <Link href="/margin-rescue" className="ml-1 inline-flex items-center gap-1 text-slateaccent hover:underline">draft a price-increase plan <ArrowRight className="h-3 w-3" /></Link>.
          </p>
        )}
      </Card>

      {(ai || loadingAi) && (
        <AIRecommendationPanel title="AI FX & Freight Recommendation" data={ai?.data} source={ai?.source} warning={ai?.warning} loading={loadingAi} />
      )}

      <DisclaimerBox variant="fx">
        This is not investment or hedging advice. FX and freight scenarios are estimates based on demo assumptions and simplified
        conversion logic — not forecasts of actual rates, costs, or margins. Consult a qualified financial professional before making
        currency hedging or financing decisions.
      </DisclaimerBox>
    </div>
  );
}
