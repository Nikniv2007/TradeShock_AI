// ─────────────────────────────────────────────────────────────
// Customer pricing strategy engine. Recommends WHERE to pass through
// cost increases — not a flat rate for everyone.
// ─────────────────────────────────────────────────────────────

import type { Customer, PricingStrategy } from "@/lib/types";
import { riskLevelFromScore, clamp } from "@/lib/utils/formatters";
import { clamp01, safeDiv } from "@/lib/utils/validators";
import type { RiskLevel } from "@/lib/types";

export interface CustomerPricingResult {
  customer: Customer;
  contributionMargin: number; // annual $
  contributionMarginPercent: number;
  costToServeAdjustedMargin: number;
  tariffExposure: number; // 0..1
  priceIncreaseNeeded: number; // 0..1
  churnAdjustedImpact: number; // annual $ expected after churn risk
  priorityScore: number; // 0..100 (higher = act first)
  priorityLevel: RiskLevel;
  recommendedStrategy: PricingStrategy;
  contractWarning?: string;
  negotiationNote: string;
}

/**
 * Analyze a customer given the portfolio-wide cost increase to pass through.
 * costIncreasePercent is the blended landed-cost increase (0..1).
 */
export function analyzeCustomerPricing(customer: Customer, costIncreasePercent: number): CustomerPricingResult {
  const grossProfit = customer.annualRevenue * clamp01(customer.grossMargin);
  const contributionMargin = grossProfit - customer.serviceCost;
  const contributionMarginPercent = safeDiv(contributionMargin, Math.max(1, customer.annualRevenue), 0);
  const costToServeAdjustedMargin = round4(contributionMarginPercent);

  // Price increase needed scales with this customer's tariff exposure and the
  // cost increase, dampened by their share of margin (COGS portion).
  const cogsShare = 1 - clamp01(customer.grossMargin);
  const exposure = clamp01(customer.tariffExposure);
  const priceIncreaseNeeded = round4(clamp01(costIncreasePercent * cogsShare * (0.5 + exposure)));

  const churnFactor = customer.churnRisk === "high" ? 0.7 : customer.churnRisk === "medium" ? 0.88 : 0.97;
  const churnAdjustedImpact = round2(customer.annualRevenue * priceIncreaseNeeded * churnFactor);

  // Priority: act first where exposure is high AND margin is thin AND no pass-through clause.
  const priorityScore = clamp(
    Math.round(
      exposure * 40 +
        (contributionMarginPercent < 0.25 ? 25 : contributionMarginPercent < 0.35 ? 12 : 0) +
        (!customer.tariffPassThroughClause ? 15 : 0) +
        clamp01(customer.discountLevel) * 20 +
        (customer.churnRisk === "high" ? -10 : 0)
    ),
    0,
    100
  );

  let recommendedStrategy: PricingStrategy = "raise_price";
  if (exposure > 0.5 && !customer.tariffPassThroughClause) recommendedStrategy = "add_surcharge";
  else if (customer.strategicImportance === "high" && customer.churnRisk === "high") recommendedStrategy = "customer_specific_pricing";
  else if (contributionMarginPercent < 0.2) recommendedStrategy = "customer_specific_pricing";

  const contractWarning =
    customer.contractType === "fixed" && !customer.tariffPassThroughClause
      ? "Fixed contract without a tariff pass-through clause — legal review recommended before adjusting price."
      : undefined;

  const negotiationNote =
    recommendedStrategy === "add_surcharge"
      ? `Introduce a tariff surcharge (~${(priceIncreaseNeeded * 100).toFixed(1)}%) tied to published rates; easier to reverse than a base-price hike.`
      : recommendedStrategy === "customer_specific_pricing"
        ? `Negotiate a tailored increase; protect the relationship given ${customer.strategicImportance} strategic importance.`
        : `Apply a ${(priceIncreaseNeeded * 100).toFixed(1)}% increase with 30–60 days notice.`;

  return {
    customer,
    contributionMargin: round2(contributionMargin),
    contributionMarginPercent: round4(contributionMarginPercent),
    costToServeAdjustedMargin,
    tariffExposure: exposure,
    priceIncreaseNeeded,
    churnAdjustedImpact,
    priorityScore,
    priorityLevel: riskLevelFromScore(priorityScore),
    recommendedStrategy,
    contractWarning,
    negotiationNote,
  };
}

export function analyzePortfolioPricing(customers: Customer[], costIncreasePercent: number): CustomerPricingResult[] {
  return customers
    .map((c) => analyzeCustomerPricing(c, costIncreasePercent))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
