// ─────────────────────────────────────────────────────────────
// Deterministic mock AI. Reads the REAL computed context and produces
// realistic, schema-valid narratives — so Demo Mode is genuinely useful,
// never fake filler. No randomness (reproducible).
// ─────────────────────────────────────────────────────────────

import type { AIActionKind } from "./schemas";
import { DISCLAIMERS } from "./prompts";

function pct(n: unknown, d = 1): string {
  const v = typeof n === "number" ? n : 0;
  return `${(v * 100).toFixed(d)}%`;
}
function money(n: unknown): string {
  const v = typeof n === "number" ? n : 0;
  return `$${Math.round(v).toLocaleString()}`;
}
function g<T = unknown>(ctx: Record<string, unknown>, key: string, fallback: T): T {
  const v = ctx[key];
  return (v === undefined || v === null ? fallback : v) as T;
}

export function mockAIResponse(action: AIActionKind, ctx: Record<string, unknown>): unknown {
  switch (action) {
    case "war_room_brief":
    case "cfo_brief":
    case "executive_report":
      return mockExecBrief(action, ctx);
    case "hts_risk":
      return mockHTS(ctx);
    case "margin_rescue":
    case "customer_pricing":
      return mockPricing(action, ctx);
    default:
      return mockRisk(action, ctx);
  }
}

function mockExecBrief(action: AIActionKind, ctx: Record<string, unknown>) {
  const belowTarget = g(ctx, "skusBelowTarget", 0);
  const marginAtRisk = g<number>(ctx, "marginAtRisk", 0);
  const tariffExposure = g<number>(ctx, "tariffExposure", 0);
  const topCountry = g<string>(ctx, "topCountry", "one country");
  const topCountryShare = g<number>(ctx, "topCountryShare", 0);
  const criticalPOs = g(ctx, "criticalPOs", 0);
  const worstSku = g<string>(ctx, "worstSku", "a key SKU");
  const worstPriceIncrease = g<number>(ctx, "worstPriceIncrease", 0);
  const status = g<"safe" | "watch" | "warning" | "critical">(ctx, "portfolioStatus", "warning");

  return {
    title: action === "cfo_brief" ? "Weekly CFO Trade Brief" : "War Room Executive Briefing",
    summary: `Portfolio status is ${status.toUpperCase()}. An estimated ${money(marginAtRisk)} of gross margin is at risk, with ${belowTarget} SKUs below target margin under the severe tariff scenario. Supplier concentration in ${topCountry} (${pct(topCountryShare)} of landed-cost exposure) is the largest structural risk.`,
    portfolioStatus: status,
    topRisks: [
      { risk: `${belowTarget} SKUs fall below target margin under a severe tariff shock`, financialImpact: `${money(marginAtRisk)} gross profit at risk`, urgency: "high" },
      { risk: `${worstSku} requires a ${pct(worstPriceIncrease)} price increase to hold target margin`, financialImpact: "Margin compression if not repriced", urgency: "high" },
      { risk: `Supplier concentration: ${pct(topCountryShare)} of exposure tied to ${topCountry}`, financialImpact: `${money(tariffExposure)} tariff exposure`, urgency: "medium" },
      { risk: `${criticalPOs} purchase order(s) flagged critical for cash/inventory strain`, financialImpact: "Cash-flow deficit risk", urgency: criticalPOs > 0 ? "urgent" : "low" },
    ],
    recommendedDecisions: [
      `Approve targeted price increases on the ${belowTarget} below-target SKUs, led by ${worstSku}.`,
      `Qualify at least one alternate supplier outside ${topCountry} for the top 5 high-margin SKUs.`,
      criticalPOs > 0 ? "Hold or revise the critical PO(s) before releasing deposits." : "Maintain current PO pipeline with standard controls.",
    ],
    questionsForLeadership: [
      "What price increase can we pass to customers without material churn?",
      `Are we willing to accept longer payback to diversify away from ${topCountry}?`,
      "What is our cash ceiling for open POs this quarter?",
    ],
    nextSevenDays: [
      "Run the severe tariff scenario and export the SKU risk table.",
      "Draft price-increase notices for the top exposed customers.",
      "Request revised payment terms on the highest-cash PO.",
    ],
    disclaimer: DISCLAIMERS.general,
  };
}

function mockHTS(ctx: Record<string, unknown>) {
  const score = g<number>(ctx, "descriptionQualityScore", 40);
  const missing = g<string[]>(ctx, "missingInformation", []);
  const concern = g<string>(ctx, "classificationConcern", "The product description may be too broad to support a single, confident classification.");
  const level = g<"low" | "medium" | "high">(ctx, "riskLevel", score < 50 ? "high" : score < 75 ? "medium" : "low");
  return {
    riskLevel: level,
    confidence: 0.62,
    classificationConcern: concern,
    descriptionQualityScore: score,
    missingInformation: missing.length ? missing : ["Material composition", "Primary intended use", "Component breakdown"],
    brokerQuestions: [
      "Should classification be driven by material, function, or intended use?",
      "Does the country of origin affect the applicable duty rate or any trade-remedy measures?",
      "Are there packaging or set-composition rules that change the heading?",
    ],
    documentationChecklist: [
      "Detailed material composition by weight/percentage",
      "Product photos showing construction and finish",
      "Supplier's technical spec sheet",
      "Statement of primary and secondary use",
      "Sample commercial invoice with full description",
    ],
    nextBestAction: level === "high"
      ? "Do not self-classify. Compile the missing details and consult a licensed customs broker before filing."
      : "Confirm the tentative classification and duty rate with a licensed customs broker.",
    disclaimer: DISCLAIMERS.hts,
  };
}

function mockPricing(action: AIActionKind, ctx: Record<string, unknown>) {
  const increase = g<number>(ctx, "requiredPriceIncrease", 0.08);
  const strategy = g<string>(ctx, "recommendedStrategy", "raise_price");
  const product = g<string>(ctx, "productName", "the affected products");
  const maxAbsorb = g<number>(ctx, "maxAbsorbableCostIncrease", 0);
  const customer = g<string>(ctx, "customerName", "your customers");

  return {
    summary: `To restore target margin on ${product}, a price adjustment of about ${pct(increase)} is required. The recommended path is "${strategy.replace(/_/g, " ")}" given competitive position and contract flexibility. Costs above ${money(maxAbsorb)} per unit cannot be absorbed without breaching the margin floor.`,
    requiredPriceIncreasePercent: Number((increase * 100).toFixed(1)),
    recommendedStrategy: strategy as never,
    customerMessage: `Dear ${customer},\n\nDue to sustained increases in import duties and freight, we are adjusting pricing on select items by approximately ${pct(increase)}, effective in 30 days. This change reflects documented tariff and logistics cost increases outside our control. We remain committed to reliable supply and competitive value, and we're glad to discuss volume options that can offset the impact.\n\nThank you for your partnership.`,
    internalMemo: `MEMO — Margin action on ${product}\n\nLanded cost has risen enough to push margin below our ${pct(g(ctx, "targetMargin", 0.35))} target. Recommendation: ${strategy.replace(/_/g, " ")} (~${pct(increase)}). Alternatives considered: surcharge, supplier switch, and temporary absorption. Absorption is only viable up to ${money(maxAbsorb)}/unit. Requesting approval to proceed with notices this week.`,
    risks: [
      "Price-sensitive customers may reduce order volume.",
      "Fixed-contract customers may require a surcharge structure instead of a base-price change.",
      "Competitor response could pressure the increase.",
    ],
    actionPlan: [
      "Segment customers by tariff exposure and contract flexibility.",
      "Send tiered notices: surcharge for fixed contracts, base increase for flexible.",
      "Brief the sales team with talking points before notices go out.",
      "Track acceptance and churn weekly for 60 days.",
    ],
    confidence: 0.68,
    disclaimer: `${DISCLAIMERS.financial} ${DISCLAIMERS.contract}`,
  };
}

function mockRisk(action: AIActionKind, ctx: Record<string, unknown>) {
  const level = g<"safe" | "watch" | "warning" | "critical">(ctx, "riskLevel", "warning");
  const summary = g<string>(ctx, "summary", "");
  const findings = g<string[]>(ctx, "keyFindings", []);
  const disclaimer = action === "fx_freight" ? `${DISCLAIMERS.financial} ${DISCLAIMERS.fx}` : DISCLAIMERS.general;

  const defaultSummaries: Partial<Record<AIActionKind, string>> = {
    tariff_shock: `Under this scenario, ${g(ctx, "productsBelowTarget", 0)} SKUs fall below target margin and ${money(g(ctx, "grossProfitAtRisk", 0))} of gross profit is at risk. Prioritize repricing and supplier diversification on the most exposed items.`,
    supplier_switch: g<string>(ctx, "recommendation", "Compare suppliers on landed margin AND cash flow, not unit cost alone."),
    po_risk: `This PO scored ${g(ctx, "riskScore", 0)}/100 (${level}). ${g(ctx, "recommendationText", "Review cash strain, inventory days, and margin under shock before approval.")}`,
    landed_cost_explain: `Landed cost is ${money(g(ctx, "landedCostPerUnit", 0))}/unit at a ${pct(g(ctx, "grossMargin", 0))} gross margin. ${g<number>(ctx, "marginGap", 0) > 0 ? "This trails target — protect it with pricing or freight action." : "This meets target under current assumptions."}`,
    bom_exposure: `Tariff exposure concentrates in a few components. The most exposed component drives a disproportionate share of duty relative to its cost share — target it first.`,
    fx_freight: `A combined FX and freight shock raises landed cost by ${money(g(ctx, "combinedImpactPerUnit", 0))}/unit, cutting margin by ${pct(g(ctx, "marginImpact", 0))}. A price increase near ${pct(g(ctx, "requiredPriceIncrease", 0))} restores target.`,
  };

  return {
    riskLevel: level,
    confidence: 0.66,
    executiveSummary: summary || defaultSummaries[action] || "Deterministic analysis complete. Review the drivers below and act on the highest-impact items first.",
    keyFindings: findings.length ? findings : buildFindings(action, ctx),
    recommendedActions: buildActions(action, ctx, level),
    assumptions: [
      "Demand and selling prices are held constant unless a scenario specifies otherwise.",
      "Tariff and freight inputs reflect user-provided values, not official rates.",
      "Working-capital costs use the company's configured financing rate.",
    ],
    risksIfIgnored: [
      "Margin erosion compounds as inventory turns at higher landed cost.",
      "Cash can be trapped in slow-moving, low-margin inventory.",
      "Concentrated sourcing amplifies any single-country policy change.",
    ],
    disclaimer,
  };
}

function buildFindings(action: AIActionKind, ctx: Record<string, unknown>): string[] {
  const drivers = g<{ label: string; detail: string }[]>(ctx, "topDrivers", []);
  if (drivers.length) return drivers.map((d) => `${d.label}: ${d.detail}`);
  return [
    "Deterministic finance model complete — see driver breakdown.",
    "Highest-impact action is listed first below.",
  ];
}

function buildActions(action: AIActionKind, ctx: Record<string, unknown>, level: string) {
  const base = [
    { action: g<string>(ctx, "recommendedAction", "Reprice or renegotiate the most exposed items."), priority: level === "critical" ? "urgent" : "high", expectedImpact: "Restores or protects target margin", effort: "medium", owner: "finance" },
    { action: "Qualify an alternate supplier for the top exposed SKUs.", priority: "medium", expectedImpact: "Reduces single-source and tariff concentration", effort: "high", owner: "supply_chain" },
    { action: "Prepare customer-facing notices and internal talking points.", priority: "medium", expectedImpact: "Smoother pass-through, less churn", effort: "low", owner: "sales" },
  ];
  if (action === "hts_risk" || action === "bom_exposure") {
    base.push({ action: "Consult a licensed customs broker before filing.", priority: "high", expectedImpact: "Reduces compliance and duty risk", effort: "low", owner: "broker" });
  }
  return base as never[];
}
