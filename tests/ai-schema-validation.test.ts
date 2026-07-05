import { describe, it, expect } from "vitest";
import {
  RiskRecommendationSchema,
  HTSRiskSchema,
  PricingRecommendationSchema,
  ExecutiveBriefSchema,
  SCHEMA_BY_ACTION,
} from "@/lib/ai/schemas";
import { mockAIResponse } from "@/lib/ai/mockProvider";
import { DISCLAIMERS } from "@/lib/ai/prompts";

describe("AI schema validation of the mock provider", () => {
  it("war room / cfo brief validates as ExecutiveBrief", () => {
    const out = mockAIResponse("war_room_brief", { portfolioStatus: "warning", marginAtRisk: 100000, skusBelowTarget: 14 });
    expect(() => ExecutiveBriefSchema.parse(out)).not.toThrow();
  });

  it("hts risk validates and always includes the HTS disclaimer", () => {
    const out = mockAIResponse("hts_risk", { descriptionQualityScore: 40, riskLevel: "high" });
    const parsed = HTSRiskSchema.parse(out);
    // HARD REQUIREMENT: HTS output must carry the customs-broker disclaimer.
    expect(parsed.disclaimer).toBe(DISCLAIMERS.hts);
    expect(parsed.disclaimer.toLowerCase()).toContain("customs broker");
  });

  it("hts risk NEVER omits broker questions / next best action", () => {
    const out = HTSRiskSchema.parse(mockAIResponse("hts_risk", {}));
    expect(out.brokerQuestions.length).toBeGreaterThan(0);
    expect(out.nextBestAction).toBeTruthy();
  });

  it("margin rescue validates as PricingRecommendation with confidence + disclaimer", () => {
    const out = mockAIResponse("margin_rescue", { requiredPriceIncrease: 0.09, recommendedStrategy: "add_surcharge" });
    const parsed = PricingRecommendationSchema.parse(out);
    expect(parsed.confidence).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence).toBeLessThanOrEqual(1);
    expect(parsed.disclaimer.length).toBeGreaterThan(10);
  });

  it("risk-style actions validate as RiskRecommendation with assumptions", () => {
    for (const action of ["tariff_shock", "supplier_switch", "po_risk", "bom_exposure", "fx_freight", "landed_cost_explain"] as const) {
      const out = mockAIResponse(action, { riskLevel: "warning" });
      const parsed = RiskRecommendationSchema.parse(out);
      expect(parsed.assumptions.length).toBeGreaterThan(0);
      expect(parsed.recommendedActions.length).toBeGreaterThan(0);
      expect(parsed.disclaimer).toBeTruthy();
    }
  });

  it("SCHEMA_BY_ACTION maps every action to a schema that accepts its mock", () => {
    (Object.keys(SCHEMA_BY_ACTION) as (keyof typeof SCHEMA_BY_ACTION)[]).forEach((action) => {
      const schema = SCHEMA_BY_ACTION[action];
      const out = mockAIResponse(action, {});
      expect(() => schema.parse(out), `schema for ${action}`).not.toThrow();
    });
  });

  it("rejects malformed AI output (missing required fields)", () => {
    expect(() => RiskRecommendationSchema.parse({ riskLevel: "warning" })).toThrow();
    expect(() => HTSRiskSchema.parse({ riskLevel: "banana" })).toThrow();
  });
});
