// ─────────────────────────────────────────────────────────────
// TradeShock AI — Core domain types (Supabase-ready shapes)
// ─────────────────────────────────────────────────────────────

export type RiskLevel = "safe" | "watch" | "warning" | "critical";
export type HTSRiskLevel = "low" | "medium" | "high";
export type Priority = "low" | "medium" | "high" | "urgent";
export type Owner =
  | "finance"
  | "supply_chain"
  | "sales"
  | "executive"
  | "broker"
  | "legal"
  | "operations";

export type Incoterm = "EXW" | "FOB" | "CIF" | "DDP";
export type Currency = "USD" | "CNY" | "VND" | "MXN" | "INR" | "TRY" | "EUR";
export type PaymentTerms =
  | "prepaid"
  | "deposit_50_50"
  | "deposit_30_70"
  | "net_15"
  | "net_30"
  | "net_60";
export type FreightMode = "ocean" | "air" | "truck";

export interface Company {
  id: string;
  name: string;
  defaultCurrency: Currency;
  destinationCountry: string;
  defaultTargetMargin: number; // 0..1
  riskTolerance: "conservative" | "balanced" | "aggressive";
  inventoryCarryingCostPercent: number; // annual, 0..1
  financingCostPercent: number; // annual, 0..1
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  country: string;
  currency: Currency;
  reliabilityScore: number; // 0..100
  qualityScore: number; // 0..100
  communicationScore: number; // 0..100
  capacityScore: number; // 0..100
  complianceScore: number; // 0..100
  averageLeadTimeDays: number;
  paymentTerms: PaymentTerms;
  depositRequiredPercent: number; // 0..1
  defectRate: number; // 0..1
  minimumOrderQuantity: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: string;
  supplierId: string;
  countryOfOrigin: string;
  currentHTSCode?: string;
  currentTariffRate: number; // 0..1
  additionalTariffRate: number; // 0..1
  supplierUnitCost: number;
  freightPerUnit: number;
  otherFeesPerUnit: number;
  sellingPrice: number;
  targetMargin: number; // 0..1
  currentInventory: number;
  monthlyDemand: number;
  leadTimeDays: number;
  priceFlexibility: "low" | "medium" | "high";
  customerType: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LandedCostInput {
  productName?: string;
  sku?: string;
  category?: string;
  supplierName?: string;
  supplierCountry?: string;
  destinationCountry?: string;
  incoterm: Incoterm;
  supplierUnitCost: number;
  quantity: number;
  freightTotal: number;
  insuranceTotal: number;
  brokerFees: number;
  portFees: number;
  handlingFees: number;
  warehouseFees: number;
  domesticDeliveryFees: number;
  inspectionFees: number;
  otherFees: number;
  tariffRate: number; // 0..1
  additionalTariffRate: number; // 0..1
  sellingPrice: number;
  targetMargin: number; // 0..1
  currency: Currency;
  notes?: string;
}

export interface LandedCostResult {
  freightPerUnit: number;
  insurancePerUnit: number;
  fixedFeesPerUnit: number;
  dutyPerUnit: number;
  additionalTariffPerUnit: number;
  landedCostPerUnit: number;
  totalLandedCost: number;
  grossProfitPerUnit: number;
  grossMargin: number; // 0..1
  marginGap: number; // targetMargin - grossMargin
  requiredPrice: number;
  breakEvenPrice: number;
  maxSupplierCost: number;
  maxFreightTotal: number;
  totalCashNeeded: number;
  costShare: CostShareItem[];
  riskLevel: RiskLevel;
}

export interface CostShareItem {
  label: string;
  value: number; // per unit
  percent: number; // 0..1 of landed cost
  kind:
    | "supplier"
    | "freight"
    | "insurance"
    | "duty"
    | "additional_tariff"
    | "fees";
}

// Persistence-shaped record of a saved landed-cost calculation (§12.4).
// The live calculator uses LandedCostInput/LandedCostResult; this is the
// Supabase-ready row you would store.
export interface LandedCostCalculation {
  id: string;
  companyId: string;
  productId: string;
  supplierId: string;
  incoterm: Incoterm;
  supplierUnitCost: number;
  quantity: number;
  freightTotal: number;
  insuranceTotal: number;
  brokerFees: number;
  portFees: number;
  handlingFees: number;
  warehouseFees: number;
  domesticDeliveryFees: number;
  inspectionFees: number;
  otherFees: number;
  tariffRate: number;
  additionalTariffRate: number;
  landedCostPerUnit: number;
  totalLandedCost: number;
  grossMargin: number;
  requiredPrice: number;
  marginGap: number;
  createdAt: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  tariffIncreasePercent: number; // absolute points added to rate, e.g. 0.10
  additionalDutyPercent: number;
  freightIncreasePercent: number; // multiplier delta, e.g. 0.25 = +25%
  supplierCostIncreasePercent: number;
  currencyImpactPercent: number;
  insuranceCostIncreasePercent: number;
  warehouseCostIncreasePercent: number;
  demandDropPercent: number;
  leadTimeIncreaseDays: number;
  targetMargin: number;
  priceIncreaseAllowedPercent: number; // cap on price increase, 0..1
  customerPriceSensitivity: "low" | "medium" | "high";
  createdAt?: string;
}

export interface ScenarioResult {
  // Optional persistence fields (§12.6) — populated when a result is stored.
  id?: string;
  scenarioId?: string;
  createdAt?: string;
  productId: string;
  sku: string;
  name: string;
  category: string;
  currentLandedCost: number;
  scenarioLandedCost: number;
  currentMargin: number;
  scenarioMargin: number;
  marginLoss: number;
  profitLossPerUnit: number;
  requiredPriceIncrease: number; // 0..1
  revenueAtRisk: number;
  grossProfitAtRisk: number;
  riskLevel: RiskLevel;
  recommendedAction: string;
}

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  estimatedLandedCost: number;
  targetMargin: number;
  projectedMargin: number;
  scenarioMargin: number;
  riskLevel: RiskLevel;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  poNumber: string;
  supplierId: string;
  status: "draft" | "pending" | "approved" | "on_hold";
  orderDate: string;
  expectedShipDate: string;
  expectedArrivalDate: string;
  incoterm: Incoterm;
  paymentTerms: PaymentTerms;
  depositRequiredPercent: number;
  currentCashAvailable: number;
  monthlyDemandUnits: number;
  forecastConfidence: "low" | "medium" | "high";
  warehouseCapacityUnits: number;
  lines: PurchaseOrderLine[];
  totalSupplierCost: number;
  estimatedLandedCost: number;
  riskScore: number;
  riskLevel: RiskLevel;
  recommendation: "approve" | "revise" | "hold";
  createdAt: string;
  updatedAt: string;
}

export interface BOMComponent {
  id: string;
  bomId: string;
  componentName: string;
  supplierId?: string;
  supplierName?: string;
  countryOfOrigin: string;
  unitCost: number;
  quantityPerFinishedGood: number;
  tariffRate: number;
  freightAllocation: number; // per finished good
  defectRate: number;
  criticalComponent: boolean;
  substituteAvailable: boolean;
  notes?: string;
}

export interface BOM {
  id: string;
  companyId: string;
  finishedProductId?: string;
  finishedSku: string;
  name: string;
  sellingPrice: number;
  targetMargin: number;
  components: BOMComponent[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  type: "retail" | "wholesale" | "marketplace" | "distributor" | "b2b";
  annualRevenue: number;
  grossMargin: number; // 0..1
  paymentTerms: PaymentTerms;
  discountLevel: number; // 0..1
  contractType: "fixed" | "flexible" | "spot";
  priceFlexibility: "low" | "medium" | "high";
  volumeCommitment: number;
  churnRisk: "low" | "medium" | "high";
  strategicImportance: "low" | "medium" | "high";
  serviceCost: number; // annual $
  tariffPassThroughClause: boolean;
  tariffExposure: number; // 0..1 share of revenue exposed
  notes?: string;
}

export interface HTSRiskReview {
  id: string;
  companyId: string;
  productId?: string;
  productName: string;
  productDescription: string;
  materials: string;
  primaryUse: string;
  secondaryUse?: string;
  components?: string;
  countryOfOrigin: string;
  currentHTSCode?: string;
  currentTariffRate?: number;
  supplierInvoiceDescription?: string;
  packagingDescription?: string;
  endCustomerType?: string;
  similarProductReferences?: string;
  createdAt: string;
}

// ─── AI output shapes (mirrored by Zod schemas in lib/ai/schemas.ts) ───

export interface RecommendedAction {
  action: string;
  priority: Priority;
  expectedImpact: string;
  effort: "low" | "medium" | "high";
  owner: Owner;
}

export interface RiskRecommendation {
  riskLevel: RiskLevel;
  confidence: number;
  executiveSummary: string;
  keyFindings: string[];
  recommendedActions: RecommendedAction[];
  assumptions: string[];
  risksIfIgnored: string[];
  disclaimer: string;
}

export interface HTSRiskOutput {
  riskLevel: HTSRiskLevel;
  confidence: number;
  classificationConcern: string;
  descriptionQualityScore: number; // 0..100
  missingInformation: string[];
  brokerQuestions: string[];
  documentationChecklist: string[];
  nextBestAction: string;
  disclaimer: string;
}

export type PricingStrategy =
  | "raise_price"
  | "add_surcharge"
  | "bundle"
  | "renegotiate_supplier"
  | "pause_sku"
  | "absorb_temporarily"
  | "switch_supplier"
  | "redesign_product"
  | "customer_specific_pricing";

export interface PricingRecommendation {
  summary: string;
  requiredPriceIncreasePercent: number;
  recommendedStrategy: PricingStrategy;
  customerMessage: string;
  internalMemo: string;
  risks: string[];
  actionPlan: string[];
  confidence: number;
  disclaimer: string;
}

export interface ExecutiveBrief {
  title: string;
  summary: string;
  portfolioStatus: RiskLevel;
  topRisks: { risk: string; financialImpact: string; urgency: Priority }[];
  recommendedDecisions: string[];
  questionsForLeadership: string[];
  nextSevenDays: string[];
  disclaimer: string;
}

export interface RiskQueueItem {
  id: string;
  type:
    | "critical_po"
    | "unprofitable_sku"
    | "hts_uncertainty"
    | "supplier_concentration"
    | "price_action";
  title: string;
  financialImpact: number;
  priority: Priority;
  recommendedAction: string;
  route: string;
}

// Bundle of everything held in the client store.
export interface Dataset {
  company: Company;
  suppliers: Supplier[];
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  customers: Customer[];
  boms: BOM[];
  scenarios: Scenario[];
}
