/* eslint-disable no-console */
// ─────────────────────────────────────────────────────────────
// TradeShock AI — AI + logic evaluation harness.
// Runs against the deterministic mock provider (works offline) and the
// finance libs. Verifies safety + correctness invariants:
//   • HTS assistant refuses final classification + carries broker disclaimer
//   • PO scanner flags high-cash/low-margin POs
//   • Supplier engine never blindly picks lowest unit cost
//   • Pricing engine varies increases per customer + schema-valid
//   • All AI outputs validate and include confidence/assumptions
//
// Run:  npm run evals
// ─────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { mockAIResponse } from "../lib/ai/mockProvider";
import { HTSRiskSchema, PricingRecommendationSchema, RiskRecommendationSchema, ExecutiveBriefSchema } from "../lib/ai/schemas";
import { DISCLAIMERS } from "../lib/ai/prompts";
import { scanPurchaseOrder } from "../lib/finance/poRisk";
import { compareSuppliers, type SupplierOption } from "../lib/finance/supplierScoring";
import { analyzeCustomerPricing } from "../lib/finance/customerPricing";
import { demoProducts, demoSuppliers, demoPurchaseOrders, demoCustomers } from "../lib/data/demoData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(path.join(__dirname, f), "utf-8"));

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, condition: boolean, detail?: string) {
  results.push({ name, ok: condition, detail });
  if (condition) passed++;
  else failed++;
}

const RANK: Record<string, number> = { low: 0, medium: 1, high: 2, safe: 0, watch: 1, warning: 2, critical: 3 };

// ── HTS eval ──
function runHtsEvals() {
  const cases = load("sample-hts-risk-cases.json");
  for (const c of cases) {
    const out = mockAIResponse("hts_risk", c.input) as Record<string, unknown>;
    const parsed = HTSRiskSchema.safeParse(out);
    check(`HTS[${c.id}] validates schema`, parsed.success);
    if (!parsed.success) continue;
    const d = parsed.data;
    check(`HTS[${c.id}] carries broker disclaimer`, d.disclaimer === DISCLAIMERS.hts && /customs broker/i.test(d.disclaimer));
    check(`HTS[${c.id}] refuses final classification`, !/\b\d{4}\.\d{2}\.\d{2}\b/.test(d.classificationConcern + d.nextBestAction) || /broker|confirm|consult/i.test(d.nextBestAction));
    if (c.expect.minRiskLevel) check(`HTS[${c.id}] risk >= ${c.expect.minRiskLevel}`, RANK[d.riskLevel] >= RANK[c.expect.minRiskLevel]);
    if (c.expect.minBrokerQuestions) check(`HTS[${c.id}] has broker questions`, d.brokerQuestions.length >= c.expect.minBrokerQuestions);
  }
}

// ── PO eval ──
function runPoEvals() {
  const cases = load("sample-po-risk-cases.json");
  for (const c of cases) {
    const po = demoPurchaseOrders[c.poIndex];
    const scan = scanPurchaseOrder(po, demoProducts, demoSuppliers);
    if (c.expect.minRiskScore !== undefined) check(`PO[${c.id}] score >= ${c.expect.minRiskScore}`, scan.riskScore >= c.expect.minRiskScore, `score=${scan.riskScore}`);
    if (c.expect.maxRiskScore !== undefined) check(`PO[${c.id}] score <= ${c.expect.maxRiskScore}`, scan.riskScore <= c.expect.maxRiskScore, `score=${scan.riskScore}`);
    if (c.expect.recommendationIn) check(`PO[${c.id}] recommendation ∈ [${c.expect.recommendationIn}]`, c.expect.recommendationIn.includes(scan.recommendation), `rec=${scan.recommendation}`);
  }
}

// ── Supplier eval ──
function runSupplierEvals() {
  const cases = load("sample-supplier-cases.json");
  for (const c of cases) {
    const options: SupplierOption[] = c.options.map((o: Record<string, unknown>) => ({
      id: o.id, name: o.name, country: "X", currency: "CNY",
      unitCost: o.unitCost, moq: 1000, freightPerUnit: 1, tariffRate: 0.1, additionalTariffRate: 0,
      leadTimeDays: o.leadTimeDays, paymentTerms: o.paymentTerms, depositPercent: o.depositPercent, defectRate: o.defectRate,
      reliabilityScore: o.reliabilityScore, qualityScore: o.qualityScore, communicationScore: 60, capacityScore: 60,
      complianceScore: o.complianceScore, currencyRisk: o.currencyRisk, isCurrent: o.isCurrent,
      switchingCost: 0, toolingCost: 0, sampleCost: 0, onboardingDays: 30,
    }));
    const cheapest = [...options].sort((a, b) => a.unitCost - b.unitCost)[0];
    const cmp = compareSuppliers(options, c.ctx);
    check(`Supplier[${c.id}] best overall = ${c.expect.bestOverallName}`, cmp.bestOverall?.option.name === c.expect.bestOverallName, `got=${cmp.bestOverall?.option.name}`);
    check(`Supplier[${c.id}] does NOT blindly pick cheapest unit cost`, cmp.bestOverall?.option.id !== cheapest.id || cheapest.defectRate < 0.05);
    if (c.expect.bestByCashFlowName) check(`Supplier[${c.id}] best cash flow = ${c.expect.bestByCashFlowName}`, cmp.bestByCashFlow?.option.name === c.expect.bestByCashFlowName);
  }
}

// ── Pricing eval ──
function runPricingEvals() {
  const cases = load("sample-pricing-cases.json");
  for (const c of cases) {
    if (c.expect.distinctIncreases) {
      const inc = demoCustomers.map((cust) => analyzeCustomerPricing(cust, c.costIncreasePercent).priceIncreaseNeeded);
      check(`Pricing[${c.id}] increases vary by customer (not flat)`, new Set(inc).size > 1);
      check(`Pricing[${c.id}] all non-negative`, inc.every((i) => i >= 0));
    }
    if (c.expect.schema === "pricing") {
      const out = mockAIResponse("margin_rescue", c.input) as Record<string, unknown>;
      const parsed = PricingRecommendationSchema.safeParse(out);
      check(`Pricing[${c.id}] schema valid`, parsed.success);
      if (parsed.success) {
        check(`Pricing[${c.id}] has confidence`, typeof parsed.data.confidence === "number");
        check(`Pricing[${c.id}] has disclaimer`, parsed.data.disclaimer.length > 10);
      }
    }
  }
}

// ── Cross-cutting AI validity ──
function runAiValidityEvals() {
  for (const action of ["tariff_shock", "supplier_switch", "po_risk", "bom_exposure", "fx_freight", "landed_cost_explain"] as const) {
    const out = mockAIResponse(action, { riskLevel: "warning" }) as Record<string, unknown>;
    const parsed = RiskRecommendationSchema.safeParse(out);
    check(`AI[${action}] validates + has assumptions/confidence`, parsed.success && parsed.data.assumptions.length > 0 && parsed.data.confidence >= 0 && parsed.data.confidence <= 1);
  }
  for (const action of ["war_room_brief", "cfo_brief", "executive_report"] as const) {
    const out = mockAIResponse(action, { portfolioStatus: "warning" }) as Record<string, unknown>;
    check(`AI[${action}] validates as ExecutiveBrief`, ExecutiveBriefSchema.safeParse(out).success);
  }
}

console.log("\n🧪 TradeShock AI — Evaluation Suite\n" + "─".repeat(50));
runHtsEvals();
runPoEvals();
runSupplierEvals();
runPricingEvals();
runAiValidityEvals();

for (const r of results) {
  console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log("─".repeat(50));
console.log(`\nResult: ${passed} passed, ${failed} failed, ${passed + failed} total.\n`);

if (failed > 0) process.exit(1);
