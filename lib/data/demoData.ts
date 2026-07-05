// ─────────────────────────────────────────────────────────────
// Deterministic demo dataset. All fictional — see disclaimers.
// Fixed timestamps (no Date.now) so the dataset is reproducible.
// ─────────────────────────────────────────────────────────────

import type {
  Company,
  Supplier,
  Product,
  Customer,
  PurchaseOrder,
  BOM,
  Scenario,
  Dataset,
} from "@/lib/types";

const NOW = "2026-06-01T00:00:00.000Z";

export const demoCompany: Company = {
  id: "co-1",
  name: "Harbor & Pine Goods",
  defaultCurrency: "USD",
  destinationCountry: "United States",
  defaultTargetMargin: 0.35,
  riskTolerance: "balanced",
  inventoryCarryingCostPercent: 0.22,
  financingCostPercent: 0.11,
  createdAt: NOW,
  updatedAt: NOW,
};

export const demoSuppliers: Supplier[] = [
  s("sup-1", "Shenzhen Brightline Manufacturing", "China", "CNY", 84, 82, 78, 88, 80, 42, "deposit_30_70", 0.3, 0.035, 500),
  s("sup-2", "Hanoi FlexGoods Co.", "Vietnam", "VND", 78, 80, 74, 76, 76, 34, "net_30", 0.2, 0.028, 300),
  s("sup-3", "Monterrey Home Products", "Mexico", "MXN", 88, 85, 86, 72, 90, 16, "net_30", 0.15, 0.02, 200),
  s("sup-4", "Pune Utility Exports", "India", "INR", 72, 74, 70, 80, 72, 46, "deposit_50_50", 0.35, 0.05, 600),
  s("sup-5", "Istanbul Design Supply", "Turkey", "TRY", 76, 83, 80, 70, 78, 30, "net_30", 0.25, 0.03, 250),
  s("sup-6", "Ho Chi Minh Outdoor Goods", "Vietnam", "VND", 80, 79, 76, 82, 77, 38, "deposit_30_70", 0.3, 0.032, 400),
  s("sup-7", "Guadalajara Metalworks", "Mexico", "MXN", 90, 88, 84, 74, 92, 14, "net_30", 0.1, 0.018, 150),
  s("sup-8", "Ningbo Everyday Products", "China", "CNY", 82, 78, 75, 90, 79, 40, "deposit_30_70", 0.3, 0.04, 500),
];

function s(
  id: string, name: string, country: string, currency: Supplier["currency"],
  reliability: number, quality: number, comms: number, capacity: number, compliance: number,
  leadTime: number, terms: Supplier["paymentTerms"], deposit: number, defect: number, moq: number
): Supplier {
  return {
    id, companyId: "co-1", name, country, currency,
    reliabilityScore: reliability, qualityScore: quality, communicationScore: comms,
    capacityScore: capacity, complianceScore: compliance, averageLeadTimeDays: leadTime,
    paymentTerms: terms, depositRequiredPercent: deposit, defectRate: defect, minimumOrderQuantity: moq,
    createdAt: NOW, updatedAt: NOW,
  };
}

// [name, category, supplierId, unitCost, freight/u, otherFees/u, price, tariff, addlTariff, target, inventory, monthlyDemand, lead, priceFlex, hts]
const P: [string, string, string, number, number, number, number, number, number, number, number, number, number, Product["priceFlexibility"], string][] = [
  ["LED Desk Lamp", "Lighting", "sup-1", 6.4, 1.1, 0.5, 18.0, 0.08, 0.0, 0.4, 900, 420, 42, "medium", "9405.20.60"],
  ["Steel Storage Shelf", "Storage", "sup-7", 22.0, 4.2, 1.4, 49.0, 0.12, 0.075, 0.35, 320, 180, 30, "low", "9403.20.00"],
  ["Bamboo Organizer Box", "Storage", "sup-2", 3.1, 0.8, 0.3, 11.0, 0.06, 0.0, 0.4, 1400, 650, 34, "high", "4602.11.00"],
  ["Yoga Mat", "Fitness", "sup-4", 4.8, 1.0, 0.4, 16.0, 0.09, 0.0, 0.42, 1100, 520, 46, "high", "3918.10.00"],
  ["Ceramic Mug Set", "Kitchen", "sup-5", 5.5, 1.4, 0.6, 17.0, 0.1, 0.0, 0.38, 700, 300, 30, "medium", "6912.00.48"],
  ["Cotton Tote Bag", "Accessories", "sup-2", 2.2, 0.5, 0.2, 9.0, 0.07, 0.0, 0.45, 2000, 900, 34, "high", "4202.92.30"],
  ["Phone Stand", "Electronics", "sup-1", 2.9, 0.6, 0.3, 12.0, 0.08, 0.0, 0.44, 1600, 780, 42, "high", "8302.50.00"],
  ["Kitchen Knife Block", "Kitchen", "sup-8", 9.6, 2.1, 0.7, 27.0, 0.11, 0.0, 0.36, 420, 210, 40, "low", "8211.10.00"],
  ["Patio Chair", "Outdoor", "sup-6", 18.5, 6.4, 1.8, 44.0, 0.13, 0.05, 0.33, 260, 140, 38, "low", "9401.79.00"],
  ["Decorative Wall Mirror", "Decor", "sup-5", 12.0, 3.8, 1.1, 34.0, 0.1, 0.0, 0.37, 300, 160, 30, "medium", "7009.92.10"],
  ["Reusable Water Bottle", "Kitchen", "sup-1", 3.4, 0.7, 0.3, 14.0, 0.08, 0.0, 0.46, 1800, 850, 42, "high", "9617.00.60"],
  ["Office Storage Cart", "Storage", "sup-7", 26.0, 5.6, 1.6, 58.0, 0.12, 0.075, 0.34, 210, 120, 30, "low", "9403.20.00"],
  ["Aluminum Laptop Riser", "Electronics", "sup-8", 8.2, 1.6, 0.6, 23.0, 0.11, 0.075, 0.38, 540, 260, 40, "medium", "8473.30.51"],
  ["Glass Food Container Set", "Kitchen", "sup-1", 7.1, 1.9, 0.7, 21.0, 0.1, 0.0, 0.37, 650, 320, 42, "medium", "7010.90.50"],
  ["Wooden Drawer Organizer", "Storage", "sup-2", 3.8, 0.9, 0.4, 12.5, 0.06, 0.0, 0.41, 1200, 560, 34, "high", "4420.90.80"],
  ["Stainless Steel Mixing Bowl", "Kitchen", "sup-8", 6.0, 1.5, 0.6, 18.0, 0.11, 0.0, 0.39, 780, 360, 40, "medium", "7323.93.00"],
  ["Silicone Baking Mat", "Kitchen", "sup-4", 2.6, 0.6, 0.3, 10.0, 0.09, 0.0, 0.45, 1500, 700, 46, "high", "3924.10.40"],
  ["Metal Garden Planter", "Outdoor", "sup-3", 9.0, 2.4, 0.9, 25.0, 0.05, 0.0, 0.38, 400, 190, 16, "medium", "7326.90.86"],
  ["Fabric Laundry Hamper", "Storage", "sup-6", 4.2, 1.1, 0.5, 15.0, 0.07, 0.0, 0.42, 1000, 480, 38, "high", "6307.90.98"],
  ["Desk Cable Tray", "Electronics", "sup-3", 3.0, 0.7, 0.3, 12.0, 0.05, 0.0, 0.44, 1300, 600, 16, "high", "8302.42.30"],
];

export const demoProducts: Product[] = P.map((p, i) => ({
  id: `prod-${i + 1}`,
  companyId: "co-1",
  sku: `TS-${String(1001 + i)}`,
  name: p[0],
  category: p[1],
  supplierId: p[2],
  countryOfOrigin: demoSuppliers.find((s) => s.id === p[2])?.country ?? "China",
  currentHTSCode: p[14],
  currentTariffRate: p[7],
  additionalTariffRate: p[8],
  supplierUnitCost: p[3],
  freightPerUnit: p[4],
  otherFeesPerUnit: p[5],
  sellingPrice: p[6],
  targetMargin: p[9],
  currentInventory: p[10],
  monthlyDemand: p[11],
  leadTimeDays: p[12],
  priceFlexibility: p[13],
  customerType: "wholesale",
  createdAt: NOW,
  updatedAt: NOW,
}));

export const demoCustomers: Customer[] = [
  c("cust-1", "NorthPeak Retail", "retail", 1_800_000, 0.32, "net_30", 0.12, "flexible", "medium", 0.6, "low", "high", 42000, false, 0.55),
  c("cust-2", "UrbanNest Home", "wholesale", 3_200_000, 0.28, "net_60", 0.18, "fixed", "low", 0.75, "medium", "high", 68000, false, 0.7),
  c("cust-3", "BrightCart Marketplace", "marketplace", 2_400_000, 0.22, "net_15", 0.05, "flexible", "high", 0.9, "high", "medium", 51000, true, 0.4),
  c("cust-4", "HomeBase Wholesale", "distributor", 4_100_000, 0.3, "net_60", 0.2, "fixed", "low", 0.8, "low", "high", 82000, true, 0.5),
  c("cust-5", "OfficePro Supply", "b2b", 1_200_000, 0.35, "net_30", 0.1, "flexible", "medium", 0.5, "medium", "medium", 30000, false, 0.45),
  c("cust-6", "GreenShelf Stores", "retail", 900_000, 0.4, "net_15", 0.08, "spot", "high", 0.3, "low", "low", 18000, false, 0.35),
  c("cust-7", "MetroMart Distribution", "distributor", 5_600_000, 0.26, "net_60", 0.22, "fixed", "low", 0.85, "high", "high", 110000, false, 0.65),
  c("cust-8", "Local Design Co.", "b2b", 480_000, 0.44, "net_30", 0.06, "flexible", "high", 0.2, "medium", "low", 9000, false, 0.3),
];

function c(
  id: string, name: string, type: Customer["type"], revenue: number, margin: number,
  terms: Customer["paymentTerms"], discount: number, contract: Customer["contractType"],
  flex: Customer["priceFlexibility"], volume: number, churn: Customer["churnRisk"],
  strategic: Customer["strategicImportance"], serviceCost: number, passThrough: boolean, exposure: number
): Customer {
  return {
    id, companyId: "co-1", name, type, annualRevenue: revenue, grossMargin: margin,
    paymentTerms: terms, discountLevel: discount, contractType: contract, priceFlexibility: flex,
    volumeCommitment: volume, churnRisk: churn, strategicImportance: strategic, serviceCost,
    tariffPassThroughClause: passThrough, tariffExposure: exposure,
  };
}

export const demoScenarios: Scenario[] = [
  scn("scn-1", "Mild Tariff Shock", "A 5-point tariff increase across imports.", { tariffIncreasePercent: 0.05 }),
  scn("scn-2", "Severe Tariff Shock", "A 15-point tariff increase — a major policy shift.", { tariffIncreasePercent: 0.15 }),
  scn("scn-3", "Country-Specific Tariff Surge", "A 25-point surge concentrated on one origin.", { tariffIncreasePercent: 0.25, priceIncreaseAllowedPercent: 0.1 }),
  scn("scn-4", "Freight Crisis", "Ocean freight spikes 60%.", { freightIncreasePercent: 0.6 }),
  scn("scn-5", "Supplier Cost Inflation", "Supplier prices rise 12%.", { supplierCostIncreasePercent: 0.12 }),
  scn("scn-6", "Currency Weakness", "USD weakens 8% vs sourcing currencies.", { currencyImpactPercent: 0.08 }),
  scn("scn-7", "Combined Worst Case", "Tariffs, freight, supplier, and FX all move against you.", { tariffIncreasePercent: 0.12, freightIncreasePercent: 0.4, supplierCostIncreasePercent: 0.08, currencyImpactPercent: 0.06, demandDropPercent: 0.1 }),
  scn("scn-8", "No Price Increase Allowed", "Severe tariff shock with a hard price freeze.", { tariffIncreasePercent: 0.15, priceIncreaseAllowedPercent: 0 }),
  scn("scn-9", "High Demand Drop", "A 25% demand contraction on top of a mild shock.", { tariffIncreasePercent: 0.05, demandDropPercent: 0.25 }),
  scn("scn-10", "Lead-Time Crisis", "Lead times extend 30 days; freight +25%.", { freightIncreasePercent: 0.25, leadTimeIncreaseDays: 30 }),
];

function scn(id: string, name: string, description: string, over: Partial<Scenario>): Scenario {
  return {
    id, name, description,
    tariffIncreasePercent: 0, additionalDutyPercent: 0, freightIncreasePercent: 0,
    supplierCostIncreasePercent: 0, currencyImpactPercent: 0, insuranceCostIncreasePercent: 0,
    warehouseCostIncreasePercent: 0, demandDropPercent: 0, leadTimeIncreaseDays: 0,
    targetMargin: 0.35, priceIncreaseAllowedPercent: 0.2, customerPriceSensitivity: "medium",
    createdAt: NOW, ...over,
  };
}

// ─── Purchase orders: 2 safe, 2 warning, 2 critical ───
export const demoPurchaseOrders: PurchaseOrder[] = [
  po("po-1", "PO-1039", "sup-3", "net_30", 0.15, 620000, "2026-06-10", "2026-07-05", [["prod-18", 400, 9.0], ["prod-20", 600, 3.0]], "high", 5000, 820),
  po("po-2", "PO-1040", "sup-7", "net_30", 0.15, 480000, "2026-06-12", "2026-07-12", [["prod-2", 300, 22.0]], "high", 3000, 200),
  po("po-3", "PO-1041", "sup-1", "deposit_30_70", 0.3, 60000, "2026-06-15", "2026-07-28", [["prod-1", 1200, 6.4], ["prod-11", 1500, 3.4]], "medium", 2600, 700),
  po("po-4", "PO-1042", "sup-8", "deposit_30_70", 0.3, 40000, "2026-06-18", "2026-08-05", [["prod-8", 1500, 9.6], ["prod-13", 1400, 8.2]], "medium", 2000, 520),
  po("po-5", "PO-1043", "sup-4", "deposit_50_50", 0.5, 25000, "2026-06-20", "2026-08-12", [["prod-4", 3000, 4.8], ["prod-17", 3500, 2.6]], "low", 2000, 900),
  po("po-6", "PO-1044", "sup-6", "deposit_50_50", 0.5, 18000, "2026-06-22", "2026-08-18", [["prod-9", 900, 18.5]], "low", 800, 130),
];

function po(
  id: string, poNumber: string, supplierId: string, terms: PurchaseOrder["paymentTerms"], deposit: number,
  cash: number, ship: string, arrive: string, lines: [string, number, number][],
  confidence: PurchaseOrder["forecastConfidence"], warehouse: number, monthlyDemand: number
): PurchaseOrder {
  const built = lines.map((l, i) => {
    const product = demoProducts.find((p) => p.id === l[0]);
    const landed = (product?.supplierUnitCost ?? l[2]) * (1 + (product?.currentTariffRate ?? 0.1)) + (product?.freightPerUnit ?? 1) + (product?.otherFeesPerUnit ?? 0.5);
    return {
      id: `${id}-l${i + 1}`,
      productId: l[0],
      sku: product?.sku ?? l[0],
      name: product?.name ?? l[0],
      quantity: l[1],
      unitCost: l[2],
      estimatedLandedCost: Math.round(landed * 100) / 100,
      targetMargin: product?.targetMargin ?? 0.35,
      projectedMargin: product ? (product.sellingPrice - landed) / product.sellingPrice : 0.3,
      scenarioMargin: 0,
      riskLevel: "watch" as const,
    };
  });
  const totalSupplierCost = built.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
  const estimatedLandedCost = built.reduce((sum, l) => sum + l.estimatedLandedCost * l.quantity, 0);
  return {
    id, companyId: "co-1", poNumber, supplierId, status: "pending",
    orderDate: "2026-06-05", expectedShipDate: ship, expectedArrivalDate: arrive,
    incoterm: "FOB", paymentTerms: terms, depositRequiredPercent: deposit,
    currentCashAvailable: cash, monthlyDemandUnits: monthlyDemand, forecastConfidence: confidence,
    warehouseCapacityUnits: warehouse, lines: built,
    totalSupplierCost: Math.round(totalSupplierCost), estimatedLandedCost: Math.round(estimatedLandedCost),
    riskScore: 0, riskLevel: "watch", recommendation: "approve",
    createdAt: NOW, updatedAt: NOW,
  };
}

// ─── BOMs: Office Storage Cart, LED Desk Lamp, Patio Chair ───
export const demoBOMs: BOM[] = [
  bom("bom-1", "prod-12", "TS-1012", "Office Storage Cart", 58.0, 0.34, [
    ["Steel Frame", "sup-7", "Mexico", 9.5, 1, 0.12, 1.2, 0.02, true, false],
    ["Caster Wheels (set)", "sup-8", "China", 3.2, 1, 0.11, 0.4, 0.03, false, true],
    ["Plastic Bins", "sup-1", "China", 4.4, 3, 0.08, 0.6, 0.04, false, true],
    ["Aluminum Handle", "sup-7", "Mexico", 2.1, 1, 0.15, 0.2, 0.02, true, false],
    ["Fasteners & Hardware", "sup-8", "China", 1.1, 1, 0.1, 0.1, 0.01, false, true],
    ["Packaging", "sup-2", "Vietnam", 1.6, 1, 0.06, 0.2, 0.01, false, true],
  ]),
  bom("bom-2", "prod-1", "TS-1001", "LED Desk Lamp", 18.0, 0.4, [
    ["LED Module", "sup-1", "China", 1.9, 1, 0.08, 0.15, 0.03, true, false],
    ["Aluminum Housing", "sup-7", "Mexico", 1.6, 1, 0.15, 0.15, 0.02, true, true],
    ["Power Adapter", "sup-8", "China", 1.2, 1, 0.11, 0.1, 0.04, true, true],
    ["Flexible Arm", "sup-1", "China", 0.9, 1, 0.08, 0.08, 0.03, false, true],
    ["Base Weight", "sup-1", "China", 0.6, 1, 0.08, 0.06, 0.02, false, true],
    ["Packaging", "sup-2", "Vietnam", 0.4, 1, 0.06, 0.05, 0.01, false, true],
  ]),
  bom("bom-3", "prod-9", "TS-1009", "Patio Chair", 44.0, 0.33, [
    ["Aluminum Bracket", "sup-7", "Mexico", 3.4, 4, 0.15, 0.5, 0.02, true, false],
    ["Powder-Coated Frame", "sup-6", "Vietnam", 6.8, 1, 0.13, 0.9, 0.03, true, false],
    ["Sling Fabric", "sup-4", "India", 3.1, 2, 0.09, 0.4, 0.05, false, true],
    ["Plastic Feet", "sup-1", "China", 0.7, 4, 0.08, 0.1, 0.02, false, true],
    ["Fasteners", "sup-8", "China", 0.8, 1, 0.11, 0.1, 0.01, false, true],
    ["Packaging", "sup-2", "Vietnam", 1.2, 1, 0.06, 0.2, 0.01, false, true],
  ]),
];

function bom(
  id: string, finishedProductId: string, finishedSku: string, name: string, price: number, target: number,
  comps: [string, string, string, number, number, number, number, number, boolean, boolean][]
): BOM {
  return {
    id, companyId: "co-1", finishedProductId, finishedSku, name, sellingPrice: price, targetMargin: target,
    components: comps.map((cm, i) => ({
      id: `${id}-c${i + 1}`, bomId: id, componentName: cm[0],
      supplierId: cm[1], supplierName: demoSuppliers.find((s) => s.id === cm[1])?.name,
      countryOfOrigin: cm[2], unitCost: cm[3], quantityPerFinishedGood: cm[4],
      tariffRate: cm[5], freightAllocation: cm[6], defectRate: cm[7],
      criticalComponent: cm[8], substituteAvailable: cm[9],
    })),
    createdAt: NOW, updatedAt: NOW,
  };
}

export function buildDemoDataset(): Dataset {
  return {
    company: demoCompany,
    suppliers: demoSuppliers,
    products: demoProducts,
    purchaseOrders: demoPurchaseOrders,
    customers: demoCustomers,
    boms: demoBOMs,
    scenarios: demoScenarios,
  };
}

export function emptyDataset(): Dataset {
  return {
    company: demoCompany,
    suppliers: [],
    products: [],
    purchaseOrders: [],
    customers: [],
    boms: [],
    scenarios: demoScenarios,
  };
}
