// ─────────────────────────────────────────────────────────────
// Input guards shared by finance functions and forms.
// Keep these dependency-free so calculations stay pure.
// ─────────────────────────────────────────────────────────────

/** Coerce to a finite number, falling back to `fallback` (default 0). */
export function num(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? parseFloat(value) : (value as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

/** Positive number or fallback — used to avoid divide-by-zero. */
export function positive(value: unknown, fallback = 1): number {
  const n = num(value, fallback);
  return n > 0 ? n : fallback;
}

/** Safe division that never returns NaN/Infinity. */
export function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Ratio expressed 0..1. Accepts either 0.3 or 30 (auto-normalizes >1). */
export function asRatio(value: unknown): number {
  const n = num(value, 0);
  return n > 1 ? n / 100 : n;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface FieldIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/** Basic landed-cost input sanity checks used by the calculator UI. */
export function validateLandedCostInputs(input: {
  supplierUnitCost: number;
  quantity: number;
  sellingPrice: number;
}): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (input.quantity <= 0)
    issues.push({ field: "quantity", message: "Quantity must be greater than zero.", severity: "error" });
  if (input.sellingPrice <= 0)
    issues.push({
      field: "sellingPrice",
      message: "Selling price must be greater than zero to calculate margin.",
      severity: "error",
    });
  if (input.supplierUnitCost < 0)
    issues.push({ field: "supplierUnitCost", message: "Supplier unit cost cannot be negative.", severity: "error" });
  return issues;
}
