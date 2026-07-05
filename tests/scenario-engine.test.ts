import { describe, it, expect } from "vitest";
import { runScenario } from "@/lib/finance/scenarioEngine";
import { scanPurchaseOrder } from "@/lib/finance/poRisk";
import { compareSuppliers, type SupplierOption } from "@/lib/finance/supplierScoring";
import { analyzeBOM } from "@/lib/finance/bomCalculations";
import { analyzeCustomerPricing } from "@/lib/finance/customerPricing";
import { demoProducts, demoSuppliers, demoScenarios, demoPurchaseOrders, demoBOMs, demoCustomers } from "@/lib/data/demoData";

describe("scenario engine", () => {
  it("a severe tariff shock lowers margins vs current", () => {
    const severe = demoScenarios.find((s) => s.name === "Severe Tariff Shock")!;
    const roll = runScenario(demoProducts, severe);
    expect(roll.portfolio.avgScenarioMargin).toBeLessThan(roll.portfolio.avgCurrentMargin);
    expect(roll.results.length).toBe(demoProducts.length);
  });

  it("worse scenarios push more SKUs below target than mild ones", () => {
    const mild = demoScenarios.find((s) => s.name === "Mild Tariff Shock")!;
    const severe = demoScenarios.find((s) => s.name === "Severe Tariff Shock")!;
    const mildBelow = runScenario(demoProducts, mild).portfolio.productsBelowTarget;
    const severeBelow = runScenario(demoProducts, severe).portfolio.productsBelowTarget;
    expect(severeBelow).toBeGreaterThanOrEqual(mildBelow);
  });

  it("every result carries a recommended action", () => {
    const roll = runScenario(demoProducts, demoScenarios[6]);
    expect(roll.results.every((r) => r.recommendedAction.length > 0)).toBe(true);
  });
});

describe("PO risk scoring", () => {
  it("flags a high-cash, high-deposit, low-forecast PO as elevated risk", () => {
    // PO-1043 (deposit_50_50, low confidence, big qty) should score worse than PO-1039 (safe)
    const safe = scanPurchaseOrder(demoPurchaseOrders[0], demoProducts, demoSuppliers);
    const risky = scanPurchaseOrder(demoPurchaseOrders[4], demoProducts, demoSuppliers);
    expect(risky.riskScore).toBeGreaterThan(safe.riskScore);
  });

  it("recommendation is one of approve/revise/hold and scales with score", () => {
    for (const po of demoPurchaseOrders) {
      const scan = scanPurchaseOrder(po, demoProducts, demoSuppliers);
      expect(["approve", "revise", "hold"]).toContain(scan.recommendation);
      if (scan.riskScore > 75) expect(scan.recommendation).toBe("hold");
    }
  });

  it("recommends cutting quantity when inventory days exceed target", () => {
    const scan = scanPurchaseOrder(demoPurchaseOrders[4], demoProducts, demoSuppliers, { targetInventoryDays: 60 });
    expect(scan.recommendedQuantityFactor).toBeLessThanOrEqual(1);
  });
});

describe("supplier switching does not blindly pick cheapest", () => {
  it("a cheaper-but-defective supplier can lose to a pricier reliable one", () => {
    const cheapBad: SupplierOption = {
      id: "a", name: "CheapCo", country: "X", currency: "CNY", unitCost: 5, moq: 1000, freightPerUnit: 1,
      tariffRate: 0.1, additionalTariffRate: 0, leadTimeDays: 60, paymentTerms: "prepaid", depositPercent: 0.5,
      defectRate: 0.15, reliabilityScore: 55, qualityScore: 55, communicationScore: 50, capacityScore: 60,
      complianceScore: 50, currencyRisk: "high", isCurrent: false, switchingCost: 0, toolingCost: 0, sampleCost: 0, onboardingDays: 30,
    };
    const pricierGood: SupplierOption = {
      ...cheapBad, id: "b", name: "SolidCo", unitCost: 6.5, leadTimeDays: 25, paymentTerms: "net_30",
      depositPercent: 0.1, defectRate: 0.02, reliabilityScore: 90, qualityScore: 90, complianceScore: 90, currencyRisk: "low", isCurrent: true,
    };
    const cmp = compareSuppliers([cheapBad, pricierGood], { sellingPrice: 20, targetMargin: 0.35, monthlyDemand: 300, financingCostPercent: 0.11 });
    // Overall best should not be the cheap/defective one on unit cost alone.
    expect(cmp.bestOverall?.option.name).toBe("SolidCo");
    expect(cmp.bestByCashFlow?.option.name).toBe("SolidCo");
    expect(cmp.recommendation.length).toBeGreaterThan(20);
  });
});

describe("BOM analysis", () => {
  it("tariff exposure can concentrate away from cost", () => {
    const a = analyzeBOM(demoBOMs[2]); // Patio Chair (aluminum bracket)
    expect(a.totalBOMCost).toBeGreaterThan(0);
    expect(a.mostExposedComponents.length).toBeGreaterThan(0);
    // Shocked margin should be below finished margin.
    expect(a.shockedMargin).toBeLessThan(a.finishedGrossMargin);
  });
});

describe("customer pricing", () => {
  it("computes different price increases across customers", () => {
    const results = demoCustomers.map((c) => analyzeCustomerPricing(c, 0.12));
    const increases = new Set(results.map((r) => r.priceIncreaseNeeded));
    expect(increases.size).toBeGreaterThan(1); // not a flat rate
    results.forEach((r) => {
      expect(r.priceIncreaseNeeded).toBeGreaterThanOrEqual(0);
      expect(r.priorityScore).toBeGreaterThanOrEqual(0);
    });
  });
});
