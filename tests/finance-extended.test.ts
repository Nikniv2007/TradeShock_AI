import { describe, it, expect } from "vitest";
import {
  calculateTariffShock,
  calculateSupplierScore,
  calculateSupplierRisk,
  calculateRecommendedPOQuantity,
  calculateCustomerContributionMargin,
  calculateCustomerPriceIncrease,
} from "@/lib/finance/calculations";
import { calculatePORisk } from "@/lib/finance";
import { demoPurchaseOrders, demoProducts, demoSuppliers } from "@/lib/data/demoData";

describe("§14 tariff shock", () => {
  it("adds duty points and raises landed cost", () => {
    const r = calculateTariffShock({ supplierUnitCost: 10, baseTariffRate: 0.1, nonSupplierLandedAdders: 3, tariffPointIncrease: 0.1 });
    expect(r.baseDutyPerUnit).toBeCloseTo(1, 4);
    expect(r.shockedDutyPerUnit).toBeCloseTo(2, 4);
    expect(r.dutyIncreasePerUnit).toBeCloseTo(1, 4);
    expect(r.landedCostIncreasePerUnit).toBeCloseTo(1, 4);
    expect(r.label).toContain("10pt");
  });
  it("clamps the shocked rate at 1 and never goes negative", () => {
    const r = calculateTariffShock({ supplierUnitCost: 10, baseTariffRate: 0.95, nonSupplierLandedAdders: 0, tariffPointIncrease: 0.5 });
    expect(r.shockedTariffRate).toBeLessThanOrEqual(1);
    expect(r.dutyIncreasePerUnit).toBeGreaterThanOrEqual(0);
  });
});

describe("§14 supplier score / risk", () => {
  it("score is 0..100 and rewards strong operations", () => {
    const strong = calculateSupplierScore({ reliabilityScore: 95, qualityScore: 92, complianceScore: 90, communicationScore: 88, capacityScore: 85, defectRate: 0.01 });
    const weak = calculateSupplierScore({ reliabilityScore: 55, qualityScore: 55, complianceScore: 55, communicationScore: 55, capacityScore: 55, defectRate: 0.12 });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(100);
    expect(weak).toBeGreaterThanOrEqual(0);
  });
  it("risk is inverse-ish and 0..100", () => {
    const risky = calculateSupplierRisk({ reliabilityScore: 55, complianceScore: 50, defectRate: 0.12, averageLeadTimeDays: 60, depositRequiredPercent: 0.5, countryExposure: 0.7 });
    const safe = calculateSupplierRisk({ reliabilityScore: 92, complianceScore: 90, defectRate: 0.01, averageLeadTimeDays: 18, depositRequiredPercent: 0.1, countryExposure: 0.1 });
    expect(risky).toBeGreaterThan(safe);
    expect(risky).toBeLessThanOrEqual(100);
  });
});

describe("§14 recommended PO quantity", () => {
  it("cuts quantity when it would exceed the target inventory days", () => {
    const r = calculateRecommendedPOQuantity({ orderQuantity: 6000, monthlyDemand: 900, targetInventoryDays: 90 });
    expect(r.recommendedQuantity).toBeLessThan(6000);
    expect(r.cutFactor).toBeLessThan(1);
  });
  it("keeps quantity when within target", () => {
    const r = calculateRecommendedPOQuantity({ orderQuantity: 500, monthlyDemand: 900, targetInventoryDays: 90 });
    expect(r.recommendedQuantity).toBe(500);
    expect(r.cutFactor).toBe(1);
  });
  it("handles zero demand without NaN", () => {
    const r = calculateRecommendedPOQuantity({ orderQuantity: 100, monthlyDemand: 0, targetInventoryDays: 90 });
    expect(Number.isNaN(r.recommendedQuantity)).toBe(false);
  });
});

describe("§14 customer functions", () => {
  it("contribution margin nets out service cost", () => {
    const r = calculateCustomerContributionMargin({ annualRevenue: 1_000_000, grossMargin: 0.3, serviceCost: 50_000 });
    expect(r.contributionMargin).toBeCloseTo(250_000, 0);
    expect(r.contributionMarginPercent).toBeCloseTo(0.25, 4);
  });
  it("price increase scales with exposure and COGS share (not flat)", () => {
    const exposed = calculateCustomerPriceIncrease({ costIncreasePercent: 0.12, grossMargin: 0.25, tariffExposure: 0.7 });
    const insulated = calculateCustomerPriceIncrease({ costIncreasePercent: 0.12, grossMargin: 0.45, tariffExposure: 0.2 });
    expect(exposed).toBeGreaterThan(insulated);
    expect(exposed).toBeGreaterThanOrEqual(0);
  });
});

describe("§14 calculatePORisk alias", () => {
  it("aliases scanPurchaseOrder and returns a scored result", () => {
    const scan = calculatePORisk(demoPurchaseOrders[4], demoProducts, demoSuppliers);
    expect(scan.riskScore).toBeGreaterThan(0);
    expect(["approve", "revise", "hold"]).toContain(scan.recommendation);
  });
});
