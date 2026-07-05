import Link from "next/link";
import {
  TrendingUp, Calculator, Zap, GitCompareArrows, ScanLine, FileWarning, Boxes,
  Waves, HeartPulse, Users, FileText, ArrowRight, ShieldCheck, AlertTriangle,
  TriangleAlert, Anchor, DollarSign, Ship, Scale, FileSignature,
} from "lucide-react";

const FEATURES = [
  { icon: Calculator, title: "AI Landed Cost Calculator", desc: "True per-SKU landed cost across freight, duties, fees, and Incoterms." },
  { icon: Zap, title: "Tariff Shock Simulator", desc: "Stress the whole portfolio against tariff, freight, FX, and demand shocks." },
  { icon: GitCompareArrows, title: "Supplier Switching ROI", desc: "Compare suppliers on margin AND cash flow — not just unit cost." },
  { icon: ScanLine, title: "Purchase Order Risk Scanner", desc: "Approve / revise / hold decisions before you place a dangerous PO." },
  { icon: FileWarning, title: "HTS Risk Assistant", desc: "Prepare broker questions and documents — never a legal classification." },
  { icon: Boxes, title: "BOM Tariff Exposure", desc: "Find the component driving duty exposure, not just cost." },
  { icon: Waves, title: "FX & Freight Shock Modeler", desc: "Model currency and freight volatility on landed margin." },
  { icon: HeartPulse, title: "Margin Rescue Center", desc: "Recover lost margin with ranked strategies and ready-to-send drafts." },
  { icon: Users, title: "Customer Pricing Engine", desc: "Pass cost through where it belongs — customer by customer." },
  { icon: FileText, title: "Executive Trade Reports", desc: "Print-ready CFO briefs, exposure reports, and action plans." },
];

const PROBLEMS = [
  { icon: DollarSign, text: "Supplier quotes do not equal true landed cost." },
  { icon: Scale, text: "Tariffs and duties can quietly erase gross margin." },
  { icon: Ship, text: "Freight and warehousing costs are often hidden." },
  { icon: TriangleAlert, text: "Businesses place POs without knowing cash-flow risk." },
  { icon: GitCompareArrows, text: "Supplier switching is more than a unit-cost decision." },
  { icon: FileWarning, text: "HTS classification uncertainty creates compliance and cost risk." },
  { icon: FileSignature, text: "Fixed customer contracts trap you when import costs rise." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base-950">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-base-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slateaccent to-cyan text-white shadow-glow">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-ink">TradeShock<span className="text-slateaccent"> AI</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-lg bg-cyan/10 px-2.5 py-1 text-xs font-medium text-cyan ring-1 ring-cyan/30 sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" /> Works in Demo Mode — no API key
            </span>
            <Link href="/dashboard" className="btn-primary text-xs">Open War Room <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-grid-faint [background-size:40px_40px] opacity-40" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber/25 bg-amber/10 px-3 py-1 text-xs font-medium text-amber">
              <AlertTriangle className="h-3.5 w-3.5" /> Bloomberg Terminal × CFO Dashboard × Supply-Chain Risk × AI Trade Analyst
            </span>
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-ink sm:text-6xl">
              TradeShock<span className="bg-gradient-to-r from-slateaccent to-cyan bg-clip-text text-transparent"> AI</span>
            </h1>
            <p className="mt-3 text-xl font-semibold text-ink-muted sm:text-2xl">The AI Tariff, Supplier, and Margin War Room</p>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-muted">
              TradeShock AI helps import-reliant businesses calculate true landed costs, simulate tariff shocks, compare
              suppliers, scan risky purchase orders, and protect margins before global trade changes destroy profitability.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/dashboard" className="btn-primary">Open War Room <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/tariff-simulator" className="btn-amber">Run Demo Scenario</Link>
              <Link href="/reports" className="btn-ghost">View Sample Report</Link>
            </div>
          </div>

          {/* Demo preview */}
          <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PreviewCard tone="danger" label="Portfolio Status" value="Warning" sub="$184,200 margin at risk · 14 SKUs" />
            <PreviewCard tone="amber" label="Steel Storage Shelf" value="+11.8%" sub="price increase to hold target margin" />
            <PreviewCard tone="cyan" label="Supplier Concentration" value="61%" sub="of exposure in one country" />
            <PreviewCard tone="danger" label="PO-1042" value="Critical" sub="Week-7 cash deficit risk" />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink">The margin killers you can&apos;t see on a quote</h2>
          <p className="mt-3 text-ink-muted">Import economics hide risk in places a spreadsheet rarely models.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
          {PROBLEMS.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-base-850/60 p-4">
              <div className="rounded-lg bg-danger/10 p-2 text-danger"><p.icon className="h-4 w-4" /></div>
              <p className="text-sm text-ink-muted">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-white/[0.06] bg-base-900/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink">One operating system for trade-finance risk</h2>
            <p className="mt-3 text-ink-muted">Deterministic financial modeling, explained and actioned by AI.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="group rounded-xl border border-white/[0.06] bg-base-850/60 p-5 transition-colors hover:border-slateaccent/30">
                <div className="mb-3 inline-flex rounded-lg bg-slateaccent/10 p-2.5 text-slateaccent ring-1 ring-slateaccent/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink">Deterministic math. AI judgment.</h2>
          <p className="mt-3 text-ink-muted">Financial calculations are never left to a language model.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          <StepCard n="01" title="Deterministic engine" desc="Landed cost, margins, risk scores, and scenarios are computed in a typed, tested finance library." icon={Calculator} />
          <StepCard n="02" title="AI explains & recommends" desc="Structured, schema-validated AI turns numbers into prioritized actions and drafts — with disclaimers." icon={Zap} />
          <StepCard n="03" title="You decide" desc="Every recommendation names an owner: CFO, supply chain, sales, broker, or legal." icon={ShieldCheck} />
        </div>
      </section>

      {/* CTA + disclaimer */}
      <section className="border-t border-white/[0.06] bg-base-900/40">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <Anchor className="mx-auto h-8 w-8 text-slateaccent" />
          <h2 className="mt-4 text-2xl font-bold text-ink">Protect your margin before the next trade shock</h2>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/dashboard" className="btn-primary">Open the War Room <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 rounded-xl border border-amber/20 bg-amber/[0.04] p-4 text-left">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
              <p className="text-xs leading-relaxed text-ink-muted">
                <span className="font-semibold text-amber">Disclaimer.</span> TradeShock AI provides informational business
                analysis only. It does not provide legal, customs, tax, accounting, investment, or financial advice. Users must
                verify tariff rates, HTS classifications, customs duties, contracts, and business decisions with official sources
                and qualified professionals. All demo data is fictional and for demonstration purposes only.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-ink-faint">
        TradeShock AI — The AI Tariff, Supplier, and Margin War Room · Demo build
      </footer>
    </div>
  );
}

function PreviewCard({ tone, label, value, sub }: { tone: "danger" | "amber" | "cyan" | "emerald"; label: string; value: string; sub: string }) {
  const toneText = { danger: "text-danger", amber: "text-amber", cyan: "text-cyan", emerald: "text-emerald" }[tone];
  return (
    <div className="card p-4 text-left">
      <div className="stat-label">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold ${toneText}`}>{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{sub}</div>
    </div>
  );
}

function StepCard({ n, title, desc, icon: Icon }: { n: string; title: string; desc: string; icon: typeof Calculator }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-base-850/60 p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xl font-bold text-slateaccent/40">{n}</span>
        <Icon className="h-5 w-5 text-slateaccent" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-muted">{desc}</p>
    </div>
  );
}
