// ─────────────────────────────────────────────────────────────
// AI API route. Validates the request, runs the action through the
// provider (live or mock), and returns a validated AIResult.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { z } from "zod";
import { runAIAction } from "@/lib/ai/provider";
import { mockAIResponse } from "@/lib/ai/mockProvider";
import type { AIActionKind } from "@/lib/ai/schemas";

export const runtime = "nodejs";

const RequestSchema = z.object({
  action: z.enum([
    "war_room_brief",
    "landed_cost_explain",
    "tariff_shock",
    "supplier_switch",
    "po_risk",
    "hts_risk",
    "bom_exposure",
    "fx_freight",
    "margin_rescue",
    "customer_pricing",
    "cfo_brief",
    "executive_report",
  ]),
  context: z.record(z.unknown()).default({}),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { action, context } = parsed.data;
  try {
    const result = await runAIAction(action as AIActionKind, context);
    return NextResponse.json(result);
  } catch {
    // Absolute last resort — never leak a stack trace.
    return NextResponse.json({
      data: mockAIResponse(action as AIActionKind, context),
      source: "mock",
      model: "mock",
      warning: "AI processing error. Showing deterministic demo recommendation.",
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    providers: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
  });
}
