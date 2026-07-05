// ─────────────────────────────────────────────────────────────
// Unified finance library surface. Import from "@/lib/finance" to get
// the full deterministic API in one place. Kept as a barrel (no logic)
// to avoid circular dependencies between the individual modules.
// ─────────────────────────────────────────────────────────────

export * from "./calculations";
export * from "./riskScoring";
export * from "./scenarioEngine";
export * from "./supplierScoring";
export * from "./poRisk";
export * from "./bomCalculations";
export * from "./customerPricing";
export * from "./fxFreight";

// Spec-named aliases (§14) that map to the canonical implementations.
export { scanPurchaseOrder as calculatePORisk } from "./poRisk";
