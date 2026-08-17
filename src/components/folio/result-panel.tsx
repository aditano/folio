import { useMemo } from "react";
import { Check, Copy, Download, Pencil, ScanText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentJob, PageResult } from "@/lib/ocr/types";

function confidenceVariant(value: number) {
  if (value >= 80) return "success" as const;
  if (value >= 60) return "warn" as const;
  return "danger" as const;
}

export function ResultPanel({
  job,
  page,
  pageIndex,
  editing,
  onEditing,
  onText,
  activeWord,
}: {
  job: DocumentJob;
  page: PageResult;
  pageIndex: number;
  editing: boolean;
  onEditing: (next: boolean) => void;
  onText: (text: string) => void;
  activeWord: number | null;
}) {
  const allText = useMemo(
    () =>
      job.pages
        .map((p, i) => (job.pages.length > 1 ? `--- Page ${i + 1} ---\n${p.text}` : p.text))
        .join("\n\n"),
    [job.pages],
  );

  const word = activeWord != null ? page.words[activeWord] : null;

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Could not copy.");
    }
  }

  function downloadText() {
    const blob = new Blob([allText || page.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.name.replace(/\.[^.]+$/, "") || "folio"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const done = page.status === "done";
  const running = page.status === "running" || page.status === "queued";

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] sm:p-2.5">
      <div className="flex flex-wrap items-center gap-2 px-2 pt-2 pb-3">
        <h2 className="font-display text-lg font-medium tracking-tight">Extracted text</h2>
        {done && page.confidence > 0 && (
          <Badge variant={confidenceVariant(page.confidence)}>{Math.round(page.confidence)}% confident</Badge>
        )}
        {job.pages.length > 1 && (
          <span className="text-xs tabular-nums text-subtle">
            Page {pageIndex + 1} of {job.pages.length}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => onEditing(!editing)}
            disabled={!done}
          >
            {editing ? <ScanText /> : <Pencil />}
            {editing ? "Read" : "Edit"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => copyText(page.text, "Page copied")}
            disabled={!done || !page.text}
          >
            <Copy />
            Copy page
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => copyText(allText, "Document copied")}
            disabled={!job.pages.every((p) => p.status === "done")}
          >
            <Check />
            Copy all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={downloadText}
            disabled={!job.pages.some((p) => p.text)}
          >
            <Download />
            .txt
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-bg">
        {running && (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="folio-shimmer font-display text-xl">Reading the page</p>
            <p className="text-sm text-muted">{page.progressLabel || "Preparing…"}</p>
          </div>
        )}
        {page.status === "error" && (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-display text-xl text-fg">Could not read this page</p>
            <p className="max-w-sm text-sm text-muted">{page.error}</p>
          </div>
        )}
        {done && editing && (
          <Textarea
            value={page.text}
            onChange={(e) => onText(e.target.value)}
            className="h-full min-h-72 resize-none rounded-lg border-0 bg-transparent shadow-none"
            spellCheck={false}
          />
        )}
        {done && !editing && (
          <div className="h-full min-h-72 overflow-auto px-4 py-4 sm:px-5">
            {page.text.trim() ? (
              <pre className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-fg">
                {word ? highlightWord(page.text, word.text) : page.text}
              </pre>
            ) : (
              <p className="text-sm text-muted">No text found on this page.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function highlightWord(text: string, word: string) {
  if (!word) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(word)})`, "g"));
  return parts.map((part, i) =>
    part === word ? (
      <mark key={`${part}-${i}`} className="rounded-sm bg-primary/25 text-fg">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${i}`}>{part}</span>
    ),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
