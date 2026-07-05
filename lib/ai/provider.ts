// ─────────────────────────────────────────────────────────────
// Server-side AI provider abstraction. Supports Anthropic and OpenAI-
// compatible APIs. Falls back to the deterministic mock whenever no key
// is set OR the live call fails / returns invalid JSON.
// ─────────────────────────────────────────────────────────────

import { z } from "zod";
import type { AIActionKind } from "./schemas";
import { SCHEMA_BY_ACTION } from "./schemas";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { mockAIResponse } from "./mockProvider";

export interface AIResult<T = unknown> {
  data: T;
  source: "live-anthropic" | "live-openai" | "mock";
  model: string;
  warning?: string;
}

export function aiConfigured(): { anthropic: boolean; openai: boolean } {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}

function extractJSON(text: string): unknown {
  // Tolerate models that wrap JSON in prose or code fences.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callAnthropic(action: AIActionKind, context: Record<string, unknown>): Promise<unknown> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(action, context) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const json = await res.json();
  const text = json?.content?.[0]?.text ?? "";
  return extractJSON(text);
}

async function callOpenAI(action: AIActionKind, context: Record<string, unknown>): Promise<unknown> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(action, context) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return extractJSON(text);
}

/**
 * Run an AI action with validation + graceful fallback. This is the single
 * entry point used by the API route. It never throws to the caller.
 */
export async function runAIAction<K extends AIActionKind>(
  action: K,
  context: Record<string, unknown>
): Promise<AIResult> {
  const schema = SCHEMA_BY_ACTION[action] as z.ZodTypeAny;
  const cfg = aiConfigured();

  const tryLive = async (): Promise<AIResult | null> => {
    try {
      if (cfg.anthropic) {
        const raw = await callAnthropic(action, context);
        return { data: schema.parse(raw), source: "live-anthropic", model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5" };
      }
      if (cfg.openai) {
        const raw = await callOpenAI(action, context);
        return { data: schema.parse(raw), source: "live-openai", model: process.env.OPENAI_MODEL || "gpt-4o-mini" };
      }
    } catch (err) {
      // Fall through to mock; attach a warning so the UI can surface it.
      const warning =
        err instanceof z.ZodError
          ? "AI output failed schema validation; showing deterministic recommendation."
          : "AI provider unavailable; showing deterministic recommendation.";
      const mock = mockAIResponse(action, context);
      return { data: schema.parse(mock), source: "mock", model: "mock", warning };
    }
    return null;
  };

  const live = await tryLive();
  if (live) return live;

  // No keys configured — deterministic mock (validated for safety).
  const mock = mockAIResponse(action, context);
  return { data: schema.parse(mock), source: "mock", model: "mock" };
}
