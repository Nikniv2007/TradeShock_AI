"use client";

import * as React from "react";
import { ErrorState } from "@/components/ui/primitives";
import { parseCSV, type EntityKind, type ParseResult } from "@/lib/data/csvParser";
import { TEMPLATE_LABELS } from "@/lib/data/templates";
import { UploadCloud } from "lucide-react";

// Drag-and-drop styled CSV dropzone. Reads the selected file client-side, parses it
// for the given entity kind, and hands the ParseResult back via onParsed.
export function CSVUploader({
  kind,
  onParsed,
}: {
  kind: EntityKind;
  onParsed: (result: ParseResult) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState("");

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        onParsed(parseCSV(text, kind));
      } catch {
        setError("We couldn't parse that file. Make sure it's a valid, comma-separated CSV and try again.");
      }
    };
    reader.onerror = () => {
      setError("We couldn't read that file. Check that it isn't open in another program and try again.");
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors " +
          (dragging
            ? "border-slateaccent bg-slateaccent/10"
            : "border-white/15 bg-base-900/50 hover:border-slateaccent/50 hover:bg-base-800/60")
        }
      >
        <div className="rounded-full bg-base-700 p-2.5 text-slateaccent ring-1 ring-slateaccent/20">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="text-sm font-medium text-ink">
          Drop your {TEMPLATE_LABELS[kind]} CSV here
        </div>
        <div className="text-xs text-ink-muted">
          or <span className="text-slateaccent">click to browse</span> — parsed instantly in your browser
        </div>
        {fileName && <div className="mt-1 text-[11px] text-ink-faint">Loaded: {fileName}</div>}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="hidden"
        />
      </div>
      {error && <ErrorState message={error} />}
    </div>
  );
}
