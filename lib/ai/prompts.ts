// ─────────────────────────────────────────────────────────────
// Prompt construction. Deterministic calculations are passed in as
// GROUND TRUTH; the model explains and recommends but never recomputes.
// ─────────────────────────────────────────────────────────────

import type { AIActionKind } from "./schemas";

export const SYSTEM_PROMPT = `You are the TradeShock AI trade-finance analysis assistant.

ROLE: Act as a trade-finance analyst, CFO assistant, supply-chain risk analyst, and margin-protection strategist.
YOU ARE NOT: an attorney, a licensed customs broker, a tax advisor, an investment advisor, or a government authority.

GROUND RULES:
- The deterministic calculations provided in the user message are GROUND TRUTH. Do NOT recompute or contradict them.
- Explain financial risk clearly and give practical, prioritized business actions.
- Always include assumptions and a confidence value (0..1).
- Always include a disclaimer appropriate to the topic.
- Never provide legal, customs, tax, or investment advice. For HTS/customs, only help prepare questions and documents.
- Do not expose chain-of-thought. Provide concise conclusions only.
- Respond with a SINGLE JSON object that matches the requested schema exactly. No markdown, no prose outside the JSON.`;

export const DISCLAIMERS: Record<string, string> = {
  general:
    "TradeShock AI provides informational business analysis only. It does not provide legal, customs, tax, accounting, investment, or financial advice. Verify tariff rates, HTS classifications, duties, contracts, and decisions with official sources and qualified professionals.",
  hts:
    "TradeShock AI does not provide customs, legal, tax, or compliance advice. HTS classification and duty determination can be legally complex. Use this tool only to prepare questions and documents. Confirm classifications, tariffs, duties, and filing decisions with a licensed customs broker, trade attorney, or official government source.",
  financial:
    "Forecasts and scenarios are estimates based on user-provided data and assumptions. They are not guarantees of future costs, margins, demand, or profitability.",
  contract:
    "Generated clauses, customer notices, and supplier scripts are drafting support only. Have an attorney review before use.",
  fx:
    "This is not investment or hedging advice. Consult a qualified financial professional before making currency hedging or financing decisions.",
};

export function buildUserPrompt(action: AIActionKind, context: Record<string, unknown>): string {
  const schemaHint = SCHEMA_HINTS[action];
  return `TASK: ${TASK_DESCRIPTIONS[action]}

DETERMINISTIC CALCULATIONS (ground truth — do not recompute):
${JSON.stringify(context, null, 2)}

Return ONLY a JSON object with exactly these fields:
${schemaHint}

Include a "disclaimer" field with topic-appropriate language. Include "confidence" (0..1) where the schema requires it. Do not add fields not listed.`;
}

const TASK_DESCRIPTIONS: Record<AIActionKind, string> = {
  war_room_brief: "Summarize portfolio-wide trade-finance risk into an executive war-room brief.",
  cfo_brief: "Write a weekly CFO trade brief covering margin-at-risk, tariff exposure, and PO risk.",
  executive_report: "Summarize the report data into an executive brief.",
  landed_cost_explain: "Explain the landed-cost result and what protects or threatens its margin.",
  tariff_shock: "Explain the tariff-shock results and recommend prioritized mitigations.",
  supplier_switch: "Explain the supplier comparison and recommend a choice considering margin AND cash flow — never just the cheapest unit cost.",
  po_risk: "Explain the PO risk score and give an approve/revise/hold recommendation with required changes.",
  hts_risk: "Prepare an HTS classification RISK review: concerns, missing info, broker questions, checklist. Do NOT give a final classification.",
  bom_exposure: "Explain where tariff exposure concentrates in the BOM and suggest sourcing/redesign moves.",
  fx_freight: "Explain the FX and freight shock impact and required pricing response. No hedging advice.",
  margin_rescue: "Recommend the best margin-recovery strategy and draft customer + internal communications.",
  customer_pricing: "Recommend where to pass through cost increases by customer and draft messaging.",
};

const SCHEMA_HINTS: Record<AIActionKind, string> = {
  war_room_brief: EXEC_HINT(),
  cfo_brief: EXEC_HINT(),
  executive_report: EXEC_HINT(),
  hts_risk: `{ riskLevel: "low"|"medium"|"high", confidence, classificationConcern, descriptionQualityScore (0-100), missingInformation[], brokerQuestions[], documentationChecklist[], nextBestAction, disclaimer }`,
  margin_rescue: PRICING_HINT(),
  customer_pricing: PRICING_HINT(),
  landed_cost_explain: RISK_HINT(),
  tariff_shock: RISK_HINT(),
  supplier_switch: RISK_HINT(),
  po_risk: RISK_HINT(),
  bom_exposure: RISK_HINT(),
  fx_freight: RISK_HINT(),
};

function RISK_HINT() {
  return `{ riskLevel: "safe"|"watch"|"warning"|"critical", confidence, executiveSummary, keyFindings[], recommendedActions[{action, priority, expectedImpact, effort, owner}], assumptions[], risksIfIgnored[], disclaimer }`;
}
function PRICING_HINT() {
  return `{ summary, requiredPriceIncreasePercent, recommendedStrategy, customerMessage, internalMemo, risks[], actionPlan[], confidence, disclaimer }`;
}
function EXEC_HINT() {
  return `{ title, summary, portfolioStatus, topRisks[{risk, financialImpact, urgency}], recommendedDecisions[], questionsForLeadership[], nextSevenDays[], disclaimer }`;
}
