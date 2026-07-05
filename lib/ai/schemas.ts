// ─────────────────────────────────────────────────────────────
// Zod schemas for all structured AI outputs. Every AI response is
// validated against these before it reaches the UI; on failure the
// caller falls back to the deterministic mock.
// ─────────────────────────────────────────────────────────────

import { z } from "zod";

export const RecommendedActionSchema = z.object({
  action: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  expectedImpact: z.string(),
  effort: z.enum(["low", "medium", "high"]),
  owner: z.enum(["finance", "supply_chain", "sales", "executive", "broker", "legal", "operations"]),
});

export const RiskRecommendationSchema = z.object({
  riskLevel: z.enum(["safe", "watch", "warning", "critical"]),
  confidence: z.number().min(0).max(1),
  executiveSummary: z.string(),
  keyFindings: z.array(z.string()),
  recommendedActions: z.array(RecommendedActionSchema),
  assumptions: z.array(z.string()),
  risksIfIgnored: z.array(z.string()),
  disclaimer: z.string(),
});

export const HTSRiskSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  classificationConcern: z.string(),
  descriptionQualityScore: z.number().min(0).max(100),
  missingInformation: z.array(z.string()),
  brokerQuestions: z.array(z.string()),
  documentationChecklist: z.array(z.string()),
  nextBestAction: z.string(),
  disclaimer: z.string(),
});

export const PricingRecommendationSchema = z.object({
  summary: z.string(),
  requiredPriceIncreasePercent: z.number(),
  recommendedStrategy: z.enum([
    "raise_price",
    "add_surcharge",
    "bundle",
    "renegotiate_supplier",
    "pause_sku",
    "absorb_temporarily",
    "switch_supplier",
    "redesign_product",
    "customer_specific_pricing",
  ]),
  customerMessage: z.string(),
  internalMemo: z.string(),
  risks: z.array(z.string()),
  actionPlan: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  disclaimer: z.string(),
});

export const ExecutiveBriefSchema = z.object({
  title: z.string(),
  summary: z.string(),
  portfolioStatus: z.enum(["safe", "watch", "warning", "critical"]),
  topRisks: z.array(
    z.object({
      risk: z.string(),
      financialImpact: z.string(),
      urgency: z.enum(["low", "medium", "high", "urgent"]),
    })
  ),
  recommendedDecisions: z.array(z.string()),
  questionsForLeadership: z.array(z.string()),
  nextSevenDays: z.array(z.string()),
  disclaimer: z.string(),
});

export type AIActionKind =
  | "war_room_brief"
  | "landed_cost_explain"
  | "tariff_shock"
  | "supplier_switch"
  | "po_risk"
  | "hts_risk"
  | "bom_exposure"
  | "fx_freight"
  | "margin_rescue"
  | "customer_pricing"
  | "cfo_brief"
  | "executive_report";

export const SCHEMA_BY_ACTION = {
  war_room_brief: ExecutiveBriefSchema,
  cfo_brief: ExecutiveBriefSchema,
  executive_report: ExecutiveBriefSchema,
  hts_risk: HTSRiskSchema,
  margin_rescue: PricingRecommendationSchema,
  customer_pricing: PricingRecommendationSchema,
  landed_cost_explain: RiskRecommendationSchema,
  tariff_shock: RiskRecommendationSchema,
  supplier_switch: RiskRecommendationSchema,
  po_risk: RiskRecommendationSchema,
  bom_exposure: RiskRecommendationSchema,
  fx_freight: RiskRecommendationSchema,
} as const;
