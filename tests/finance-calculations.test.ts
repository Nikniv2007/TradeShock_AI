import { describe, it, expect } from "vitest";
import {
  calculateLandedCost,
  calculateGrossMargin,
  calculateRequiredPrice,
  calculateBreakEvenPrice,
  calculateFreightPerUnit,
  calculateDutyPerUnit,
  calculateInventoryDays,
  calculateCashTiedInInventory,
  calculateDefectAdjustedCost,
  calculatePriceIncreaseNeeded,
  calculateMaxSupplierCost,
} from "@/lib/finance/calculations";
import type { LandedCostInput } from "@/lib/types";

const base: LandedCostInput = {
  incoterm: "FOB",
  supplierUnitCost: 10,
  quantity: 100,
  freightTotal: 200,
  insuranceTotal: 50,
  brokerFees: 100,
  portFees: 50,
  handlingFees: 0,
  warehouseFees: 0,
  domesticDeliveryFees: 0,
  inspectionFees: 0,
  otherFees: 0,
  tariffRate: 0.1,
  additionalTariffRate: 0,
  sellingPrice: 25,
  targetMargin: 0.35,
  currency: "USD",
};

describe("landed cost math", () => {
  it("computes per-unit adders correctly", () => {
    expect(calculateFreightPerUnit(200, 100)).toBe(2);
    expect(calculateDutyPerUnit(10, 0.1)).toBeCloseTo(1, 5);
  });

  it("builds landed cost from all components", () => {
    const r = calculateLandedCost(base);
    // 10 supplier + 2 freight + 0.5 insurance + 1.5 fees + 1 duty = 15
    expect(r.landedCostPerUnit).toBeCloseTo(15, 4);
    expect(r.totalLandedCost).toBeCloseTo(1500, 2);
  });

  it("computes gross margin and profit", () => {
    const r = calculateLandedCost(base);
    const { grossMargin, grossProfitPerUnit } = calculateGrossMargin(25, r.landedCostPerUnit);
    expect(grossProfitPerUnit).toBeCloseTo(10, 4);
    expect(grossMargin).toBeCloseTo(0.4, 4);
  });

  it("required price hits target margin exactly", () => {
    const price = calculateRequiredPrice(15, 0.35);
    // 15 / 0.65
    expect(price).toBeCloseTo(23.0769, 3);
    const { grossMargin } = calculateGrossMargin(price, 15);
    expect(grossMargin).toBeCloseTo(0.35, 3);
  });

  it("break-even equals landed cost", () => {
    expect(calculateBreakEvenPrice(15)).toBe(15);
  });

  it("max supplier cost preserves target margin", () => {
    // selling 25, target 0.35 => allowed landed = 16.25; non-supplier adders = 4 (freight2+ins0.5+fees1.5), tariff 0.1
    const max = calculateMaxSupplierCost(25, 0.35, 4, 0.1);
    // (16.25 - 4) / 1.1 = 11.136...
    expect(max).toBeCloseTo(11.1364, 3);
  });

  it("DDP includes freight/insurance/duty per profile note (still computes)", () => {
    const r = calculateLandedCost({ ...base, incoterm: "DDP" });
    expect(r.landedCostPerUnit).toBeGreaterThan(0);
  });

  it("EXW applies an origin-handling uplift making it >= FOB", () => {
    const fob = calculateLandedCost({ ...base, incoterm: "FOB" }).landedCostPerUnit;
    const exw = calculateLandedCost({ ...base, incoterm: "EXW" }).landedCostPerUnit;
    expect(exw).toBeGreaterThanOrEqual(fob);
  });
});

describe("divide-by-zero and invalid inputs", () => {
  it("freight per unit with zero quantity does not blow up", () => {
    expect(calculateFreightPerUnit(200, 0)).toBe(0);
  });

  it("landed cost coerces zero quantity to 1", () => {
    const r = calculateLandedCost({ ...base, quantity: 0 });
    expect(Number.isFinite(r.landedCostPerUnit)).toBe(true);
  });

  it("gross margin with zero selling price returns 0, not NaN", () => {
    const { grossMargin } = calculateGrossMargin(0, 15);
    expect(grossMargin).toBe(0);
  });

  it("inventory days with zero demand and zero inventory is 0", () => {
    expect(calculateInventoryDays(0, 0)).toBe(0);
  });

  it("inventory days with inventory but zero demand is Infinity-guarded", () => {
    expect(calculateInventoryDays(100, 0)).toBe(Infinity);
  });

  it("defect-adjusted cost rises with defects", () => {
    expect(calculateDefectAdjustedCost(10, 0)).toBe(10);
    expect(calculateDefectAdjustedCost(10, 0.1)).toBeCloseTo(11.111, 2);
  });

  it("cash tied in inventory never negative", () => {
    expect(calculateCashTiedInInventory(-5, 100)).toBe(0);
    expect(calculateCashTiedInInventory(5, -100)).toBe(0);
  });
});

describe("price increase needed", () => {
  it("is zero when new cost already supports target", () => {
    expect(calculatePriceIncreaseNeeded(25, 10, 0.35)).toBe(0);
  });
  it("is positive when landed cost rises", () => {
    const inc = calculatePriceIncreaseNeeded(25, 20, 0.35);
    expect(inc).toBeGreaterThan(0);
  });
});
