# TradeShock AI — The AI Tariff, Supplier, and Margin War Room

> An AI-powered trade-finance platform that calculates true landed costs, simulates tariff shocks, flags risky purchase orders, compares suppliers, detects HTS-code uncertainty, and recommends pricing or sourcing moves to protect business margins.

TradeShock AI is an **AI trade-finance operating system** that protects import-reliant businesses from margin collapse caused by tariffs, supplier shocks, freight volatility, customs uncertainty, and risky purchase orders. It combines a **deterministic financial engine** with **structured, schema-validated AI** — the math is never left to a language model.

Think **Bloomberg Terminal + CFO Dashboard + Supply-Chain Risk Platform + AI Trade Analyst**.

> **Runs with zero configuration.** With no API keys, the app runs in **Demo Mode** — a full, realistic portfolio driven by deterministic mock AI. Add an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to switch on Live AI.

---

## Table of Contents
1. [Problem Statement](#1-problem-statement)
2. [Why This Matters](#2-why-this-matters)
3. [Product Overview](#3-product-overview)
4. [Key Features](#4-key-features)
5. [Screenshots](#5-screenshots)
6. [Tech Stack](#6-tech-stack)
7. [AI Architecture](#7-ai-architecture)
8. [Demo Mode](#8-demo-mode)
9. [Installation](#9-installation)
10. [Environment Variables](#10-environment-variables)
11. [Data Model Overview](#11-data-model-overview)
12. [Financial Calculation Methodology](#12-financial-calculation-methodology)
13. [Risk Scoring Methodology](#13-risk-scoring-methodology)
14. [CSV Import Format](#14-csv-import-format)
15. [AI Evaluation Methodology](#15-ai-evaluation-methodology)
16. [Safety & Compliance Disclaimers](#16-safety--compliance-disclaimers)
17. [Roadmap](#17-roadmap)
18. [Portfolio Explanation](#18-portfolio-explanation)
19. [What This Project Demonstrates](#19-what-this-project-demonstrates)

---

## 1. Problem Statement

Import-reliant businesses make high-stakes decisions on incomplete cost information:

- **Supplier quotes ≠ true landed cost.** Freight, duties, insurance, broker/port fees, and warehousing hide inside a single unit price.
- **Tariffs and duties can quietly erase gross margin** — often after inventory is already committed.
- **Purchase orders are placed without cash-flow risk analysis** — MOQs, deposits, and long lead times trap working capital.
- **Supplier switching is more than a unit-cost decision** — defects, lead time, and payment terms decide the real winner.
- **HTS classification uncertainty** creates compliance and duty risk that a spreadsheet cannot flag.
- **Fixed customer contracts** trap businesses when import costs rise with no pass-through clause.

## 2. Why This Matters

A 10–15 point tariff swing can turn a profitable SKU into a loss-maker overnight. Most small and mid-size importers discover this **after** the PO ships. TradeShock AI moves that analysis **before** the decision — quantifying exposure, ranking mitigations, and drafting the customer/supplier communications needed to act.

## 3. Product Overview

TradeShock AI answers questions like:

- What is my real landed cost by SKU?
- Which products become unprofitable if tariffs increase?
- Which supplier gives the best margin **after** freight, duties, defects, lead time, and payment terms?
- Which purchase orders are financially dangerous **before** I place them?
- Which customers need price increases first — and by how much?
- Which HTS classifications need professional review?
- How much cash is trapped in inventory because of long lead times and high MOQs?
- How should I communicate a tariff surcharge or price increase to customers?

**Core principle:** *Financial math is deterministic. AI explains, classifies, summarizes, drafts, and recommends — it is never the source of financial calculations.*

## 4. Key Features

| Module | Route | What it does |
|---|---|---|
| **War Room Dashboard** | `/dashboard` | 12 live metrics, AI briefing, margin exposure, tariff heatmap, landed-cost waterfall, supplier risk matrix, prioritized risk queue |
| **Landed Cost Calculator** | `/landed-cost` | True per-unit landed cost across freight, duties, fees, and Incoterms (EXW/FOB/CIF/DDP) with waterfall + cost-share |
| **Tariff Shock Simulator** | `/tariff-simulator` | Scope-selectable scenarios (SKU→portfolio), 10 presets + custom sliders, before/after impact, top-10 exposed, AI action plan |
| **Supplier Switching ROI** | `/supplier-roi` | Compare 2–5 suppliers on margin **and** cash flow — best by margin / cash flow / risk / lead time / overall |
| **PO Risk Scanner** | `/po-scanner` | 0–100 risk score, Approve/Revise/Hold, cash & inventory strain, required changes, AI approval memo |
| **HTS Risk Assistant** | `/hts-risk` | Classification **risk** pre-screen, broker questions, documentation checklist — never a legal classification |
| **BOM Tariff Exposure** | `/bom-analyzer` | Component-level landed cost + where tariff exposure concentrates (often ≠ where cost is) |
| **FX & Freight Shock** | `/fx-freight` | Currency + freight volatility on landed margin, sensitivity charts, break-even FX/freight |
| **Margin Rescue Center** | `/margin-rescue` | 14 ranked recovery strategies + editable customer/CFO/supplier communication drafts |
| **Customer Pricing Engine** | `/customer-pricing` | Where to pass through cost increases — customer by customer, with contract-clause warnings |
| **Supplier Country Map** | `/supplier-map` | Country exposure, concentration, diversification recommendations |
| **Trade Reports** | `/reports` | 10 print-ready executive reports with export to JSON/CSV/PDF |
| **Automation Center** | `/automation` | 10 one-click workflows that produce real, data-derived results |
| **Data Room** | `/data-room` | CSV upload/validation, JSON export, sample templates, data-quality checks |
| **Settings** | `/settings` | Company defaults, risk thresholds, demo mode, AI provider status |

## 5. Screenshots

> _Screenshots placeholder._ Run the app (`npm run dev`) and click **Load Demo Data** to explore the full War Room. Suggested capture order: Dashboard → Tariff Simulator → Supplier ROI → PO Scanner → Margin Rescue → Reports.

## 6. Tech Stack

- **Next.js (App Router)** + **TypeScript** (strict)
- **Tailwind CSS** with a custom dark "war-room" design system
- **Recharts** for charts · **lucide-react** for icons
- **Zod** for validation (inputs + AI output schemas)
- **Zustand** (persisted) for the client data store
- **PapaParse** for CSV import
- **AI provider abstraction** — Anthropic + OpenAI-compatible, with deterministic **mock fallback**
- **Vitest** for unit tests · **tsx** for the eval runner
- **Supabase-ready** data shapes (local/in-memory store when Supabase is unset)

## 7. AI Architecture

```
lib/ai/
  schemas.ts       # Zod schemas for every structured AI output
  prompts.ts       # System prompt + per-action user prompts (calc results = ground truth)
  mockProvider.ts  # Deterministic, realistic outputs derived from real computed context
  provider.ts      # Server: Anthropic/OpenAI calls + validation + graceful fallback
  actions.ts       # Client helper that calls the API route (always resolves)
app/api/ai/route.ts # Validated endpoint; never leaks stack traces
```

**Rules enforced in code:**
- AI outputs are **structured JSON**, validated with Zod. Invalid output → deterministic mock fallback.
- The prompt passes deterministic calculations as **ground truth**; the model is instructed not to recompute.
- Every output includes **assumptions**, **confidence (0–1)**, and a **topic-appropriate disclaimer**.
- No chain-of-thought is requested or exposed — concise conclusions only.
- The AI never claims official tariff or HTS authority, and never overrides the finance engine.

**AI use cases:** War-room briefing, landed-cost explanation, tariff-shock plan, supplier-switch rationale, PO risk memo, HTS risk review, BOM exposure, FX/freight explanation, margin-rescue plan, customer-pricing strategy, weekly CFO brief, price-increase email, supplier negotiation script, executive report summary.

## 8. Demo Mode

If neither `ANTHROPIC_API_KEY` nor `OPENAI_API_KEY` is set, the app runs in **Demo Mode**:
- A rich fictional portfolio: **20 SKUs, 8 suppliers, 8 customers, 10 scenarios, 6 purchase orders (2 safe / 2 warning / 2 critical), 3 BOMs**.
- The **mock AI** reads the *real* computed figures for each screen and produces realistic, schema-valid narratives — so demos are genuinely useful, not filler.
- Click **Load Demo Data** in the top bar to populate the store.

## 9. Installation

```bash
# Requires Node 18+
npm install
cp .env.example .env.local   # optional — app works with no keys
npm run dev                  # http://localhost:3000

npm run test                 # 61 unit tests (finance, risk, CSV, AI schemas, scenarios)
npm run evals                # 29 AI/logic safety + correctness evals
npm run build                # production build
```

## 10. Environment Variables

```env
ANTHROPIC_API_KEY=        # optional — enables Live AI (Anthropic)
OPENAI_API_KEY=           # optional — enables Live AI (OpenAI-compatible)
ANTHROPIC_MODEL=claude-sonnet-5
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_SUPABASE_URL=       # optional
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # optional
SUPABASE_SERVICE_ROLE_KEY=      # optional
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_APP_NAME=TradeShock AI
```

No secrets are hardcoded; AI keys are read only server-side in the API route.

## 11. Data Model Overview

Typed in [`lib/types/index.ts`](lib/types/index.ts), Supabase-ready: `Company`, `Supplier`, `Product`, `LandedCostCalculation`, `Scenario`, `ScenarioResult`, `PurchaseOrder` + `PurchaseOrderLine`, `BOM` + `BOMComponent`, `Customer`, `HTSRiskReview`, `AIRecommendation`. A `Dataset` bundle holds everything the client store manages.

## 12. Financial Calculation Methodology

All math lives in [`lib/finance/`](lib/finance/) and is unit-tested. Representative formulas:

```
freightPerUnit      = freightTotal / quantity
fixedFeesPerUnit    = (broker + port + handling + warehouse + delivery + inspection + other) / quantity
dutyPerUnit         = supplierUnitCost * tariffRate
landedCostPerUnit   = supplierUnitCost + freightPerUnit + insurancePerUnit + fixedFeesPerUnit + dutyPerUnit + additionalTariffPerUnit
grossMargin         = (sellingPrice - landedCostPerUnit) / sellingPrice
requiredPrice       = landedCostPerUnit / (1 - targetMargin)
maxSupplierCost     = (sellingPrice*(1-target) - nonSupplierAdders) / (1 + tariffRate)
inventoryDays       = currentInventory / (monthlyDemand / 30)
cashTiedInInventory = landedCostPerUnit * inventoryQuantity
marginAtRisk        = currentGrossProfit - scenarioGrossProfit
```

Every function is typed, validates inputs, **guards against divide-by-zero**, and returns rounded display values. Incoterm logic (EXW/FOB/CIF/DDP) is **simplified for analysis** and clearly labeled as non-legal.

## 13. Risk Scoring Methodology

Transparent and explainable — every score returns `{ score, riskLevel, topDrivers[], recommendedAction, explanation }`. Bands:

| Score | Level |
|---|---|
| 0–30 | 🟢 Safe |
| 31–55 | 🔵 Watch |
| 56–75 | 🟡 Warning |
| 76–100 | 🔴 Critical |

Models cover **SKU margin risk**, **supplier risk**, **PO risk**, **HTS classification risk**, and **customer-pricing risk**, each with documented driver weights in [`lib/finance/riskScoring.ts`](lib/finance/riskScoring.ts) and [`poRisk.ts`](lib/finance/poRisk.ts).

## 14. CSV Import Format

Templates downloadable in the Data Room. Required columns per entity are defined in [`lib/data/csvParser.ts`](lib/data/csvParser.ts):

- **Products:** `sku, name, category, supplierName, countryOfOrigin, supplierUnitCost, sellingPrice, targetMargin, currentTariffRate, additionalTariffRate, monthlyDemand, currentInventory, leadTimeDays, priceFlexibility`
- **Suppliers:** `name, country, currency, unitCost, reliabilityScore, …, averageLeadTimeDays, paymentTerms, depositRequiredPercent, defectRate, minimumOrderQuantity`
- **Purchase Orders:** `poNumber, supplierName, sku, quantity, unitCost, expectedShipDate, expectedArrivalDate, paymentTerms, depositRequiredPercent`
- **Customers:** `name, type, annualRevenue, grossMargin, paymentTerms, discountLevel, contractType, priceFlexibility, churnRisk, strategicImportance, tariffPassThroughClause`
- **BOM:** `finishedSku, componentName, supplierName, countryOfOrigin, unitCost, quantityPerFinishedGood, tariffRate, freightAllocation, defectRate, criticalComponent, substituteAvailable`

The importer surfaces raw + parsed previews, required-column validation, data-quality warnings (missing price, negative cost, zero quantity, invalid margin, missing arrival date, …), and a success/failure summary.

## 15. AI Evaluation Methodology

`npm run evals` runs [`evals/run-evals.ts`](evals/run-evals.ts) against the deterministic mock (offline-safe) and the finance libs. It asserts safety + correctness invariants:

- HTS assistant **refuses a final legal classification** and **always carries the customs-broker disclaimer**.
- PO scanner **flags a high-cash, low-margin PO** as elevated risk.
- Supplier engine **never blindly picks the lowest unit cost**.
- Pricing engine **varies increases per customer** (not a flat rate) and is schema-valid.
- Every AI output **validates its Zod schema** and includes **confidence + assumptions**.

Current suite: **61 unit tests + 57 evals, all passing.** Evals also assert the AI makes no guarantee/authority claims, never provides legal/customs/tax advice, treats deterministic calculations as ground truth, and that margin rescue offers multiple options.

## 16. Safety & Compliance Disclaimers

- **General:** TradeShock AI provides informational business analysis only. It does not provide legal, customs, tax, accounting, investment, or financial advice. Verify tariff rates, HTS classifications, duties, contracts, and decisions with official sources and qualified professionals.
- **HTS:** HTS classification and duty determination can be legally complex. Confirm classifications, tariffs, duties, and filing decisions with a licensed customs broker, trade attorney, or official government source.
- **Financial:** Forecasts and scenarios are estimates, not guarantees of future costs, margins, demand, or profitability.
- **Contract:** Generated clauses, notices, and scripts are drafting support only — have an attorney review before use.
- **Demo data:** All demo data is fictional and for demonstration purposes only.

### Security & data handling

- **Local demo mode** — no sensitive data required; the full portfolio is fictional and lives only in your browser's local storage.
- **Clear demo/real separation** — a persistent Demo Mode badge, a `hasData` gate, and upload warnings distinguish sample data from anything you import.
- **Privacy** — in demo mode nothing leaves the browser. When live AI is enabled, only the **necessary computed context** (not your full dataset) is sent to the provider. A user-facing privacy disclaimer appears on the landing page, in the Data Room, and in Settings → Account & Privacy.
- **No hardcoded secrets** — AI keys are read **server-side only** in `app/api/ai/route.ts`; never exposed to the client.
- **Placeholder auth, Supabase-ready** — `lib/auth/mockAuth.ts` provides a `getSession()`/`can()` structure that mirrors a Supabase session so real auth is a drop-in. Role checks (`approve_po`, `edit`, `view`) are already stubbed.
- **Reset & export** — one-click **Reset all data** and **Export dataset (JSON)** in the Data Room and Settings.
- **Supabase Row-Level Security** — for a production, multi-tenant deployment, enable RLS on every table and scope rows by `companyId`/`auth.uid()`. Example policy:
  ```sql
  alter table products enable row level security;
  create policy "tenant can read own products"
    on products for select
    using (company_id = auth.jwt() ->> 'company_id');
  ```
  Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only; never ship it to the browser.

## 17. Roadmap

- Supabase persistence + multi-tenant auth (RLS)
- Live tariff/HTS reference integrations (with human-in-the-loop verification)
- Scheduled CFO briefs and PO-approval workflows
- Real currency/freight feeds for FX & freight modeling
- Scenario versioning and side-by-side comparison history

## 18. Portfolio Explanation

This project is built to demonstrate **end-to-end product ownership** of an AI-plus-finance system — suitable for finance/business students, AI fellowship applications, and product/engineering interviews. It deliberately separates a **trustworthy deterministic core** from an **AI layer that is validated, bounded, and disclaimer-aware**.

## 19. What This Project Demonstrates

- Applied AI / LLM APIs with **structured JSON outputs** and **Zod validation**
- **AI safety**: disclaimers, confidence, assumptions, refusal on HTS, graceful fallback
- **Deterministic financial modeling** and scenario analysis
- Tariff & landed-cost logic, supplier risk analysis, PO risk scoring, BOM exposure, customer pricing
- CSV parsing & data-quality validation
- Dashboard/data-viz design and a cohesive design system
- Workflow automation and print-ready reporting
- **Testing + evals** for both logic and AI behavior
- System ownership and business/finance product thinking

## License

Released under the [MIT License](LICENSE). © 2026 Nikniv2007.

---

<sub>TradeShock AI — The AI Tariff, Supplier, and Margin War Room. All demo data is fictional. Not legal, customs, tax, accounting, investment, or financial advice.</sub>
