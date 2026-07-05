"use client";

import * as React from "react";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { Sparkles } from "lucide-react";

/** Premium bulleted briefing card summarizing deterministic findings. */
export function WarRoomBriefing({ findings }: { findings: string[] }) {
  return (
    <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
      <SectionTitle
        icon={Sparkles}
        title="War Room Briefing"
        subtitle="Deterministic risk figures, summarized for leadership."
      />
      {findings.length === 0 ? (
        <p className="text-sm text-ink-muted">No findings to report under current assumptions.</p>
      ) : (
        <ul className="space-y-2 text-sm text-ink-muted">
          {findings.map((f, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slateaccent" />
              {f}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
