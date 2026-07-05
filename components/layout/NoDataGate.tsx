"use client";

import * as React from "react";
import { useStore } from "@/lib/store/useStore";
import { EmptyState, Button } from "@/components/ui/primitives";
import { DownloadCloud, Database } from "lucide-react";
import Link from "next/link";

/**
 * Wrap page content that requires a dataset. Shows a polished prompt to load
 * demo data (or upload) when the store is empty. Avoids hydration mismatch by
 * waiting for the persisted store to rehydrate.
 */
export function NoDataGate({ children, message }: { children: React.ReactNode; message?: string }) {
  const { hasData, loaded, loadDemoData } = useStore();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted || !loaded) {
    return <div className="h-40 animate-pulse rounded-xl bg-base-850" />;
  }

  if (!hasData) {
    return (
      <EmptyState
        icon={Database}
        title="No data loaded yet"
        message={message ?? "Load the demo portfolio to explore the war room, or upload your own catalog in the Data Room."}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="amber" onClick={loadDemoData}><DownloadCloud className="h-4 w-4" /> Load Demo Data</Button>
            <Link href="/data-room"><Button>Go to Data Room</Button></Link>
          </div>
        }
      />
    );
  }

  return <>{children}</>;
}
