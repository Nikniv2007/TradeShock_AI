"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import {
  Card, SectionTitle, Field, Input, NumberInput, Select, Toggle, Button, MetricCard,
  RiskMeter, RiskBadge, StatusBadge, DisclaimerBox,
} from "@/components/ui/primitives";
import { EditableDraftBox } from "@/components/ai/AIPanel";
import { HBarChart, CHART_COLORS } from "@/components/charts";
import {
  calculateLandedCost, calculateGrossMargin, calculateRequiredPrice,
  calculatePriceIncreaseNeeded, marginRiskLevel,
} from "@/lib/finance/calculations";
import { fmtCurrency, fmtPercent, fmtPoints, titleCase } from "@/lib/utils/formatters";
import { num, round, clamp01 } from "@/lib/utils/validators";
import { requestAI } from "@/lib/ai/actions";
import { useStore } from "@/lib/store/useStore";
import type { Product, PricingStrategy, PricingRecommendation, RiskLevel } from "@/lib/types";
import {
  HeartPulse, Sparkles, TrendingUp, ShieldAlert, Gauge, Trophy, ListOrdered, Mail,
} from "lucide-react";

type Level = "low" | "medium" | "high";

interface Form {
  currentLandedCost: number;
  newLandedCost: number;
  currentPrice: number;
  targetMargin: number;
  customerType: string;
  competitiveCeiling: number;
  demandSensitivity: Level;
  brandStrength: Level;
  canChangeSupplier: boolean;
  canRedesign: boolean;
  contractFlexibility: "fixed" | "flexible" | "spot";
  urgency: Level;
}

function currentLandedFor(p: Product): number {
  const qty = Math.max(1, p.monthlyDemand);
  return calculateLandedCost({
    incoterm: "FOB", supplierUnitCost: p.supplierUnitCost, quantity: qty,
    freightTotal: p.freightPerUnit * qty, insuranceTotal: qty * 0.1, brokerFees: qty * 0.15,
    portFees: qty * 0.1, handlingFees: qty * 0.08, warehouseFees: qty * 0.05,
    domesticDeliveryFees: qty * 0.12, inspectionFees: qty * 0.05, otherFees: p.otherFeesPerUnit * qty,
    tariffRate: p.currentTariffRate, additionalTariffRate: p.additionalTariffRate,
    sellingPrice: p.sellingPrice, targetMargin: p.targetMargin, currency: "USD",
  }).landedCostPerUnit;
}

function initForm(p: Product): Form {
  const landed = currentLandedFor(p);
  const demandSensitivity: Level = p.priceFlexibility === "high" ? "low" : p.priceFlexibility === "low" ? "high" : "medium";
  return {
    currentLandedCost: round(landed, 2),
    newLandedCost: round(landed * 1.15, 2),
    currentPrice: p.sellingPrice,
    targetMargin: p.targetMargin,
    customerType: p.customerType,
    competitiveCeiling: round(p.sellingPrice * 1.1, 2),
    demandSensitivity,
    brandStrength: "medium",
    canChangeSupplier: true,
    canRedesign: false,
    contractFlexibility: "flexible",
    urgency: "medium",
  };
}

interface Derived {
  requiredPriceIncrease: number; // 0..1
  requiredPriceForNew: number;
  newMarginAtCurrentPrice: number; // 0..1
  marginGap: number; // target - new
  maxAbsorbable: number; // $/unit of extra cost still holding target from current baseline
  riskLevel: RiskLevel;
}

function derive(f: Form): Derived {
  const requiredPriceIncrease = calculatePriceIncreaseNeeded(f.currentPrice, f.newLandedCost, f.targetMargin);
  const requiredPriceForNew = calculateRequiredPrice(f.newLandedCost, f.targetMargin);
  const newMarginAtCurrentPrice = calculateGrossMargin(f.currentPrice, f.newLandedCost).grossMargin;
  const marginGap = round(f.targetMargin - newMarginAtCurrentPrice, 4);
  const maxAbsorbable = round(f.currentPrice * (1 - clamp01(f.targetMargin)) - f.currentLandedCost, 2);
  return {
    requiredPriceIncrease, requiredPriceForNew, newMarginAtCurrentPrice, marginGap, maxAbsorbable,
    riskLevel: marginRiskLevel(newMarginAtCurrentPrice, f.targetMargin),
  };
}

interface StrategyEval {
  key: string;
  label: string;
  aiKey: PricingStrategy;
  score: number;
  rationale: string;
  risk: string;
  impact: string;
}

const LVL: Record<Level, number> = { low: 0, medium: 1, high: 2 };

function rankStrategies(f: Form, d: Derived, p: Product): StrategyEval[] {
  const dsens = LVL[f.demandSensitivity];
  const brand = LVL[f.brandStrength];
  const urg = LVL[f.urgency];
  const bigIncrease = d.requiredPriceIncrease > 0.1;
  const priceRoomTight = f.competitiveCeiling <= d.requiredPriceForNew;
  const canAbsorb = d.maxAbsorbable > 0;
  const underwater = d.newMarginAtCurrentPrice < 0;
  const contractBias = f.contractFlexibility === "flexible" ? 8 : f.contractFlexibility === "spot" ? 4 : -10;
  const demand = Math.max(1, p.monthlyDemand);
  const monthlyGain = Math.max(0, d.requiredPriceForNew - f.currentPrice) * demand;
  const surchargeFit = p.additionalTariffRate > 0 ? 12 : 4;

  const raw: StrategyEval[] = [
    {
      key: "raise_price", label: "Raise Price", aiKey: "raise_price",
      score: 60 - dsens * 12 - (priceRoomTight ? 25 : 0) + brand * 8 + contractBias - (bigIncrease ? 6 : 0),
      rationale: `Lift list price ${fmtPercent(d.requiredPriceIncrease)} to ${fmtCurrency(d.requiredPriceForNew)} to fully restore the ${fmtPercent(f.targetMargin)} target margin.${priceRoomTight ? ` Note: this exceeds the ${fmtCurrency(f.competitiveCeiling)} competitive ceiling.` : ""}`,
      risk: dsens >= 2 ? "High demand sensitivity — real volume/churn risk." : dsens === 1 ? "Moderate volume risk; monitor acceptance." : "Low sensitivity — increase likely to stick.",
      impact: `Restores full margin; ~${fmtCurrency(monthlyGain, "USD", { compact: true })}/mo gross profit recovered.`,
    },
    {
      key: "add_surcharge", label: "Add Tariff Surcharge", aiKey: "add_surcharge",
      score: 55 + urg * 10 + (f.contractFlexibility === "fixed" ? 15 : 0) + surchargeFit - dsens * 5,
      rationale: `Introduce a ~${fmtPercent(d.requiredPriceIncrease)} surcharge tied to published tariff rates — transparent, itemized, and reversible if duties fall.`,
      risk: "Customers may resist open-ended surcharges; needs a clear sunset trigger.",
      impact: "Passes through duty cost without a permanent base-price change.",
    },
    {
      key: "switch_supplier", label: "Change Supplier", aiKey: "switch_supplier",
      score: f.canChangeSupplier ? 50 + (bigIncrease ? 12 : 0) - urg * 10 : 10,
      rationale: f.canChangeSupplier
        ? "Qualify an alternate origin to structurally reduce landed cost below the shocked level."
        : "Currently constrained — enable supplier change to unlock this lever.",
      risk: "Switching cost, tooling, lead-time, and quality re-validation.",
      impact: "Durable cost reduction rather than a one-time price fix.",
    },
    {
      key: "renegotiate_supplier", label: "Renegotiate Supplier Cost", aiKey: "renegotiate_supplier",
      score: 48 + (bigIncrease ? 8 : 0) + (f.canChangeSupplier ? 8 : 0),
      rationale: "Press the current supplier for a cost concession using volume commitments and alternate quotes as leverage.",
      risk: "Limited upside if single-sourced with weak leverage.",
      impact: "Partial cost relief with no customer-facing change.",
    },
    {
      key: "redesign_product", label: "Redesign Product", aiKey: "redesign_product",
      score: f.canRedesign ? 45 - urg * 12 + (bigIncrease ? 8 : 0) : 8,
      rationale: f.canRedesign
        ? "Value-engineer the BOM (materials, components, tolerances) to cut landed cost at the source."
        : "Requires enabling redesign; typically too slow for an acute shock.",
      risk: "Engineering time and retooling; slow to realize.",
      impact: "Lowest long-run landed cost if demand justifies the investment.",
    },
    {
      key: "bundle", label: "Bundle with High-Margin Item", aiKey: "bundle",
      score: 40 + dsens * 8 + brand * 6,
      rationale: "Pair the SKU with a high-margin companion to lift blended margin without a headline price hike.",
      risk: "Operational complexity; discount leakage if mispriced.",
      impact: "Protects volume while recovering margin at the basket level.",
    },
    {
      key: "reduce_discounts", label: "Reduce Discounts", aiKey: "raise_price",
      score: 42 + (2 - dsens) * 6 + (f.contractFlexibility === "flexible" ? 6 : 0),
      rationale: "Trim standard discount allowances to recover margin quietly, without changing list price.",
      risk: "Channel friction with discount-dependent accounts.",
      impact: "Immediate margin recovery on discounted volume.",
    },
    {
      key: "change_packaging", label: "Change Packaging", aiKey: "redesign_product",
      score: 30 + (f.canRedesign ? 10 : 0),
      rationale: "Lighter or lower-cost packaging shaves freight and material cost per unit.",
      risk: "Possible brand-perception and protection trade-offs.",
      impact: "Small but fast per-unit cost reduction.",
    },
    {
      key: "increase_moq", label: "Increase MOQ if Justified", aiKey: "renegotiate_supplier",
      score: 28 + (bigIncrease ? 6 : 0),
      rationale: "Larger order runs amortize freight and duty per unit — only where demand clearly supports it.",
      risk: "More cash tied in inventory; obsolescence risk.",
      impact: "Modest landed-cost dilution on high-velocity SKUs.",
    },
    {
      key: "pause_sku", label: "Pause SKU", aiKey: "pause_sku",
      score: 20 + (underwater ? 30 : 0) + (brand === 0 ? 8 : 0),
      rationale: "Temporarily pause reorders while margin is underwater and a structural fix is pursued.",
      risk: "Lost sales and potential stockouts.",
      impact: "Stops the bleed on unprofitable units immediately.",
    },
    {
      key: "discontinue_sku", label: "Discontinue SKU", aiKey: "pause_sku",
      score: 12 + (underwater ? 25 : 0) + (brand === 0 ? 6 : 0),
      rationale: "Retire the SKU if margin cannot be restored and strategic value is low.",
      risk: "Permanent revenue loss; assortment gaps.",
      impact: "Frees working capital for higher-margin lines.",
    },
    {
      key: "made_to_order", label: "Move to Made-to-Order", aiKey: "pause_sku",
      score: 22 + (underwater ? 8 : 0),
      rationale: "Shift to made-to-order to eliminate inventory carrying and demand risk.",
      risk: "Longer customer lead times may reduce conversion.",
      impact: "Removes inventory cash exposure on a shaky SKU.",
    },
    {
      key: "customer_specific_pricing", label: "Customer-Specific Price Adjustment", aiKey: "customer_specific_pricing",
      score: 45 + (f.contractFlexibility === "flexible" ? 10 : 0) + brand * 4 - dsens * 3,
      rationale: "Negotiate tailored increases per account by exposure and contract type rather than a blanket hike.",
      risk: "Slower to execute; requires per-account effort.",
      impact: "Maximizes pass-through while protecting key relationships.",
    },
    {
      key: "absorb_temporarily", label: "Temporary Absorption", aiKey: "absorb_temporarily",
      score: canAbsorb ? 38 + urg * 10 - (bigIncrease ? 10 : 0) : 8,
      rationale: canAbsorb
        ? `Absorb the increase short-term — up to ${fmtCurrency(d.maxAbsorbable)}/unit still holds the margin floor — while a durable fix lands.`
        : "Not viable: the shocked cost already breaches the margin floor at current price.",
      risk: "Compounding margin drag if prolonged.",
      impact: "Buys time and preserves customer relationships briefly.",
    },
  ];

  return raw
    .map((s) => ({ ...s, score: Math.round(Math.min(100, Math.max(0, s.score))) }))
    .sort((a, b) => b.score - a.score);
}

// ─── Deterministic draft templates (editable) ───
function retailDraft(p: Product, d: Derived): string {
  return `Subject: Upcoming price adjustment on ${p.name}\n\nHello,\n\nStarting in 30 days, the price of ${p.name} will change by approximately ${fmtPercent(d.requiredPriceIncrease)} (new price ${fmtCurrency(d.requiredPriceForNew)}). This reflects sustained increases in import duties and freight that are outside our control.\n\nWe've held pricing as long as possible and remain committed to the quality and availability you expect. Orders placed before the effective date will be honored at the current price.\n\nThank you for your continued business.`;
}
function surchargeDraft(p: Product, d: Derived): string {
  return `Subject: Temporary tariff surcharge — ${p.name}\n\nDear valued customer,\n\nEffective on your next order, a tariff surcharge of approximately ${fmtPercent(d.requiredPriceIncrease)} will apply to ${p.name}. The surcharge is itemized separately, tied directly to published import-duty rates, and will be reduced or removed if those rates fall.\n\nThis approach lets us keep base pricing stable while transparently passing through documented duty costs. We're happy to review volume options that can offset the impact.\n\nSincerely,\nPricing Team`;
}
function salesTalkTrack(f: Form, p: Product, d: Derived, best: StrategyEval): string {
  return `Sales talking points — ${p.name}\n\n• Why now: import duties and freight raised landed cost from ${fmtCurrency(f.currentLandedCost)} to ${fmtCurrency(f.newLandedCost)}/unit, compressing margin below our ${fmtPercent(f.targetMargin)} target.\n• The ask: ~${fmtPercent(d.requiredPriceIncrease)} (to ${fmtCurrency(d.requiredPriceForNew)}), lead with "${best.label}".\n• Objection — "competitors are cheaper": emphasize reliability, lead time, and total cost of ownership; offer volume tiers, not discounts on list.\n• Objection — "budget is fixed": propose a phased increase or the surcharge structure.\n• Walk-away: below break-even we cannot supply profitably; escalate to account-specific pricing.\n• Always confirm contract terms before quoting a firm new price.`;
}
function supplierScript(f: Form, p: Product, d: Derived): string {
  return `Supplier negotiation script — ${p.name}\n\nObjective: reduce landed cost or offset the recent increase.\n\n1. Context: "Recent duty and freight moves pushed our landed cost from ${fmtCurrency(f.currentLandedCost)} to ${fmtCurrency(f.newLandedCost)}/unit — unsustainable for this program."\n2. Ask: a unit-cost concession, extended payment terms, or freight support in exchange for a firm volume commitment.\n3. Leverage: reference alternate-origin quotes and our willingness to consolidate volume with the best partner.\n4. Fallback: staged price steps, longer PO horizon for better pricing, or shared tooling investment to lower future cost.\n5. Close: confirm any agreement in writing with effective dates and volume conditions.`;
}

export default function MarginRescuePage() {
  return (
    <>
      <PageHeader
        title="Margin Rescue Center"
        description="A landed-cost shock hit a SKU. Model the damage deterministically, then rank 14 rescue strategies against your constraints — and draft the customer and internal communications."
        icon={HeartPulse}
      />
      <NoDataGate>
        <MarginRescueBody />
      </NoDataGate>
    </>
  );
}

function MarginRescueBody() {
  const { dataset } = useStore();
  const products = dataset.products;
  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const product = products.find((p) => p.id === productId) ?? products[0];

  const [form, setForm] = React.useState<Form>(() => initForm(product));
  const [ai, setAi] = React.useState<{ data: PricingRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  // Reset the form when the selected product changes.
  const lastProduct = React.useRef(productId);
  React.useEffect(() => {
    if (lastProduct.current !== productId) {
      lastProduct.current = productId;
      setForm(initForm(product));
      setAi(null);
    }
  }, [productId, product]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((s) => ({ ...s, [k]: v }));

  const safeForm: Form = {
    ...form,
    currentLandedCost: num(form.currentLandedCost),
    newLandedCost: num(form.newLandedCost),
    currentPrice: Math.max(0.01, num(form.currentPrice, 0.01)),
    targetMargin: clamp01(num(form.targetMargin)),
    competitiveCeiling: num(form.competitiveCeiling),
  };

  const d = React.useMemo(() => derive(safeForm), [safeForm]);
  const strategies = React.useMemo(() => rankStrategies(safeForm, d, product), [safeForm, d, product]);
  const best = strategies[0];
  const shockPct = safeForm.currentLandedCost > 0 ? safeForm.newLandedCost / safeForm.currentLandedCost - 1 : 0;

  async function generate() {
    setLoadingAi(true);
    const res = await requestAI("margin_rescue", {
      productName: product.name,
      requiredPriceIncrease: d.requiredPriceIncrease,
      recommendedStrategy: best.aiKey,
      maxAbsorbableCostIncrease: d.maxAbsorbable,
      targetMargin: safeForm.targetMargin,
    });
    setAi({ data: res.data as PricingRecommendation, source: res.source, warning: res.warning });
    setLoadingAi(false);
  }

  const scoreBars = strategies.slice(0, 8).map((s) => ({ label: s.label, value: s.score }));

  return (
    <div className="space-y-6">
      {/* Product picker */}
      <Card>
        <SectionTitle
          title="Affected SKU"
          subtitle="Pick a product — current landed cost is prefilled from the deterministic model, then simulate the cost shock."
          right={
            <Select className="max-w-[240px]" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
            </Select>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Current landed cost ($/u)" hint="From landed-cost model">
            <NumberInput value={form.currentLandedCost} onChange={(v) => set("currentLandedCost", v)} step="0.01" />
          </Field>
          <Field label="NEW landed cost ($/u)" hint={`Shock: ${fmtPercent(shockPct)}`}>
            <NumberInput value={form.newLandedCost} onChange={(v) => set("newLandedCost", v)} step="0.01" />
          </Field>
          <Field label="Current selling price ($)">
            <NumberInput value={form.currentPrice} onChange={(v) => set("currentPrice", v)} step="0.01" />
          </Field>
          <Field label="Target margin" hint="e.g. 0.35 = 35%">
            <NumberInput value={form.targetMargin} onChange={(v) => set("targetMargin", v)} step="0.01" />
          </Field>
          <Field label="Competitive price ceiling ($)" hint="Max the market will bear">
            <NumberInput value={form.competitiveCeiling} onChange={(v) => set("competitiveCeiling", v)} step="0.01" />
          </Field>
          <Field label="Customer type">
            <Select value={form.customerType} onChange={(e) => set("customerType", e.target.value)}>
              {["wholesale", "retail", "marketplace", "distributor", "b2b"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </Select>
          </Field>
          <Field label="Demand sensitivity">
            <Select value={form.demandSensitivity} onChange={(e) => set("demandSensitivity", e.target.value as Level)}>
              {(["low", "medium", "high"] as Level[]).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </Select>
          </Field>
          <Field label="Brand strength">
            <Select value={form.brandStrength} onChange={(e) => set("brandStrength", e.target.value as Level)}>
              {(["low", "medium", "high"] as Level[]).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </Select>
          </Field>
          <Field label="Contract flexibility">
            <Select value={form.contractFlexibility} onChange={(e) => set("contractFlexibility", e.target.value as Form["contractFlexibility"])}>
              {(["fixed", "flexible", "spot"] as const).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </Select>
          </Field>
          <Field label="Urgency">
            <Select value={form.urgency} onChange={(e) => set("urgency", e.target.value as Level)}>
              {(["low", "medium", "high"] as Level[]).map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </Select>
          </Field>
          <div className="flex items-end pb-2"><Toggle checked={form.canChangeSupplier} onChange={(v) => set("canChangeSupplier", v)} label="Can change supplier" /></div>
          <div className="flex items-end pb-2"><Toggle checked={form.canRedesign} onChange={(v) => set("canRedesign", v)} label="Can redesign product" /></div>
        </div>
      </Card>

      {/* Deterministic metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Required Price Increase" value={fmtPercent(d.requiredPriceIncrease)} sub={`to ${fmtCurrency(d.requiredPriceForNew)}`} tone={d.requiredPriceIncrease > 0.1 ? "danger" : d.requiredPriceIncrease > 0 ? "amber" : "emerald"} icon={TrendingUp} />
        <MetricCard label="Max Absorbable Cost" value={fmtCurrency(d.maxAbsorbable)} sub="per unit, holds target" tone={d.maxAbsorbable > 0 ? "cyan" : "danger"} icon={Gauge} />
        <MetricCard label="New Margin @ Current Price" value={fmtPercent(d.newMarginAtCurrentPrice)} tone={d.newMarginAtCurrentPrice >= safeForm.targetMargin ? "emerald" : d.newMarginAtCurrentPrice > 0 ? "amber" : "danger"} />
        <MetricCard label="Margin Gap vs Target" value={fmtPercent(d.marginGap)} sub={d.marginGap > 0 ? "below target" : "at/above target"} tone={d.marginGap > 0.05 ? "danger" : d.marginGap > 0 ? "amber" : "emerald"} icon={ShieldAlert} />
      </div>

      <Card>
        <SectionTitle title="Margin After Shock" right={<RiskBadge level={d.riskLevel} />} />
        <RiskMeter value={Math.max(0, d.newMarginAtCurrentPrice)} target={safeForm.targetMargin} label={`${product.name} margin at current price`} />
        <p className="mt-2 text-xs text-ink-muted">
          The {fmtPercent(shockPct)} cost shock ({fmtCurrency(safeForm.currentLandedCost)} → {fmtCurrency(safeForm.newLandedCost)}/unit) drops margin to {fmtPercent(d.newMarginAtCurrentPrice)}.
          {d.requiredPriceIncrease > 0
            ? ` Raising price ${fmtPercent(d.requiredPriceIncrease)} to ${fmtCurrency(d.requiredPriceForNew)} restores the ${fmtPercent(safeForm.targetMargin)} target.`
            : " Margin still meets target — no price action strictly required."}
        </p>
      </Card>

      {/* Best strategy + ranking */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="border-slateaccent/25 bg-gradient-to-b from-slateaccent/[0.06] to-transparent">
          <SectionTitle icon={Trophy} title="Recommended Strategy" subtitle="Highest-scoring lever for your constraints." right={<StatusBadge tone="emerald">Score {best.score}</StatusBadge>} />
          <h3 className="text-lg font-semibold text-ink">{best.label}</h3>
          <p className="mt-1.5 text-sm text-ink-muted">{best.rationale}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
              <div className="stat-label mb-1 text-emerald">Estimated Impact</div>
              <p className="text-xs text-ink-muted">{best.impact}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
              <div className="stat-label mb-1 text-amber">Risk / Trade-off</div>
              <p className="text-xs text-ink-muted">{best.risk}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="primary" onClick={generate} disabled={loadingAi}>
              <Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Generating…" : ai ? "Regenerate Plan & Drafts" : "Generate AI Plan & Drafts"}
            </Button>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={ListOrdered} title="Strategy Ranking" subtitle="All 14 levers scored against your inputs (top 8 charted)." />
          <HBarChart data={scoreBars} color={CHART_COLORS.slate} format={(v) => `${v}`} />
        </Card>
      </div>

      <Card>
        <SectionTitle icon={ListOrdered} title="Full Playbook" subtitle="Ranked alternatives with rationale, risk, and impact." />
        <div className="space-y-2">
          {strategies.map((s, i) => (
            <div key={s.key} className="rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-base-700 text-[11px] font-semibold text-ink-muted tabular-nums">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{s.label}</span>
                      {i === 0 && <StatusBadge tone="emerald">Best</StatusBadge>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{s.rationale}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
                      <span className="text-emerald">↑ {s.impact}</span>
                      <span className="text-amber">! {s.risk}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums text-slateaccent">{s.score}</div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-faint">score</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* AI narrative + drafts */}
      {ai && (
        <>
          <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.04] to-transparent">
            <SectionTitle icon={Sparkles} title="AI Rescue Plan" subtitle={`Strategy: ${titleCase(ai.data.recommendedStrategy)} · required increase ${fmtPoints(ai.data.requiredPriceIncreasePercent)}`} right={<StatusBadge tone="cyan">{Math.round(ai.data.confidence * 100)}% confidence</StatusBadge>} />
            {ai.warning && <div className="mb-3 text-[11px] text-amber">{ai.warning}</div>}
            {ai.source && ai.source !== "mock" && <div className="mb-3 text-[11px] text-emerald">Live AI · {ai.source.replace("live-", "")}</div>}
            <p className="text-sm leading-relaxed text-ink-muted">{ai.data.summary}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h5 className="stat-label mb-1.5 flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Risks</h5>
                <ul className="space-y-1 text-xs text-ink-muted">
                  {ai.data.risks.map((r, i) => <li key={i} className="flex gap-2"><span className="text-danger">!</span>{r}</li>)}
                </ul>
              </div>
              <div>
                <h5 className="stat-label mb-1.5">Action Plan</h5>
                <ol className="space-y-1 text-xs text-ink-muted">
                  {ai.data.actionPlan.map((a, i) => <li key={i} className="flex gap-2"><span className="text-cyan tabular-nums">{i + 1}.</span>{a}</li>)}
                </ol>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={Mail} title="Communication Drafts" subtitle="Editable — copy into your CRM, email, or memo. Have counsel review before sending." />
            <div className="grid gap-4 lg:grid-cols-2">
              <EditableDraftBox label="B2B Price Increase Email" value={ai.data.customerMessage} />
              <EditableDraftBox label="Internal CFO Memo" value={ai.data.internalMemo} />
              <EditableDraftBox label="Retail Customer Price Update" value={retailDraft(product, d)} />
              <EditableDraftBox label="Tariff Surcharge Notice" value={surchargeDraft(product, d)} />
              <EditableDraftBox label="Sales Team Talking Points" value={salesTalkTrack(safeForm, product, d, best)} />
              <EditableDraftBox label="Supplier Negotiation Script" value={supplierScript(safeForm, product, d)} />
            </div>
          </Card>
        </>
      )}

      <DisclaimerBox variant="contract">
        Generated clauses, customer notices, and supplier scripts are drafting support only. Have an attorney review before use.
      </DisclaimerBox>
      <DisclaimerBox variant="financial">
        Forecasts and scenarios are estimates based on demo data and assumptions. They are not guarantees of future costs, margins, demand, or profitability. All demo data is fictional.
      </DisclaimerBox>
    </div>
  );
}
