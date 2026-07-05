// ─────────────────────────────────────────────────────────────
// Client-side helper to call the AI API route. Always resolves — on any
// failure it returns a deterministic mock so the UI never breaks.
// ─────────────────────────────────────────────────────────────

"use client";

import type { AIActionKind } from "./schemas";
import { mockAIResponse } from "./mockProvider";
import type { AIResult } from "./provider";

export async function requestAI(action: AIActionKind, context: Record<string, unknown>): Promise<AIResult> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, context }),
    });
    if (!res.ok) throw new Error(`AI route ${res.status}`);
    return (await res.json()) as AIResult;
  } catch {
    return {
      data: mockAIResponse(action, context),
      source: "mock",
      model: "mock",
      warning: "AI provider unavailable. Showing deterministic demo recommendation.",
    };
  }
}
