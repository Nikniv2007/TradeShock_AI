import { describe, it, expect } from "vitest";
import { scoreSkuMarginRisk, scoreSupplierRisk, scoreHtsRisk, supplierConcentration } from "@/lib/finance/riskScoring";
import { riskLevelFromScore } from "@/lib/utils/formatters";
import { demoProducts, demoSuppliers } from "@/lib/data/demoData";
import type { Supplier } from "@/lib/types";

describe("risk level thresholds", () => {
  it("maps scores to the documented bands", () => {
    expect(riskLevelFromScore(10)).toBe("safe");
    expect(riskLevelFromScore(40)).toBe("watch");
    expect(riskLevelFromScore(65)).toBe("warning");
    expect(riskLevelFromScore(90)).toBe("critical");
  });
});

describe("SKU margin risk", () => {
  it("flags a below-target, collapsing SKU as high risk", () => {
    const r = scoreSkuMarginRisk({
      grossMargin: 0.1, targetMargin: 0.35, scenarioMargin: -0.05, tariffRate: 0.2,
      freightSharePercent: 0.3, supplierConcentration: 0.6, leadTimeDays: 50,
      priceFlexibility: "low", demandSensitivity: "high",
    });
    expect(r.score).toBeGreaterThan(55);
    expect(r.topDrivers.length).toBeGreaterThan(0);
    expect(r.recommendedAction).toBeTruthy();
  });

  it("keeps a healthy SKU low risk", () => {
    const r = scoreSkuMarginRisk({
      grossMargin: 0.45, targetMargin: 0.35, scenarioMargin: 0.4, tariffRate: 0.05,
      freightSharePercent: 0.1, supplierConcentration: 0.2, leadTimeDays: 20,
      priceFlexibility: "high", demandSensitivity: "low",
    });
    expect(r.score).toBeLessThan(31);
    expect(r.riskLevel).toBe("safe");
  });
});

describe("supplier risk", () => {
  it("scores a high-defect, unreliable supplier worse", () => {
    const bad: Supplier = { ...demoSuppliers[0], reliabilityScore: 55, defectRate: 0.12, complianceScore: 50 };
    const good: Supplier = { ...demoSuppliers[6] }; // Guadalajara Metalworks (strong)
    expect(scoreSupplierRisk(bad).score).toBeGreaterThan(scoreSupplierRisk(good).score);
  });

  it("always returns drivers and an action", () => {
    const r = scoreSupplierRisk(demoSuppliers[0], 0.4);
    expect(r.recommendedAction).toBeTruthy();
    expect(r.explanation).toBeTruthy();
  });
});

describe("HTS pre-screen", () => {
  it("scores a vague, incomplete description as higher risk", () => {
    const vague = scoreHtsRisk({ productDescription: "decorative storage box", materials: "", primaryUse: "", components: "", currentHTSCode: "", supplierInvoiceDescription: "assorted goods" });
    const detailed = scoreHtsRisk({ productDescription: "Powder-coated cold-rolled steel 5-shelf storage unit for garage use", materials: "Cold-rolled steel, epoxy powder coat", primaryUse: "Residential garage shelving", components: "Steel uprights, shelves, plastic feet", currentHTSCode: "9403.20.00", supplierInvoiceDescription: "Steel storage shelving unit" });
    expect(vague.score).toBeGreaterThan(detailed.score);
    expect(vague.descriptionQualityScore).toBeLessThan(detailed.descriptionQualityScore);
  });

  it("returns a description quality score 0..100", () => {
    const r = scoreHtsRisk({ productDescription: "x", materials: "", primaryUse: "", components: "" });
    expect(r.descriptionQualityScore).toBeGreaterThanOrEqual(0);
    expect(r.descriptionQualityScore).toBeLessThanOrEqual(100);
  });
});

describe("supplier concentration", () => {
  it("returns a top country with a valid 0..1 share", () => {
    const c = supplierConcentration(demoProducts, demoSuppliers);
    expect(c.topCountry).toBeTruthy();
    expect(c.topCountryShare).toBeGreaterThan(0);
    expect(c.topCountryShare).toBeLessThanOrEqual(1);
  });
});
