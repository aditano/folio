import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropzone, filterAccepted } from "./dropzone";
import { PagePreview, PageThumbs } from "./page-preview";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { canvasToBlob, drawBitmapToCanvas, fileToBitmap } from "@/lib/ocr/image";
import { OCR_LANGUAGES } from "@/lib/ocr/languages";
import { renderPdfPages } from "@/lib/ocr/pdf";
import { useOcrSettings } from "@/lib/ocr/store";
import { recognizeLocal } from "@/lib/ocr/tesseract";
import { MAX_PDF_PAGES, type DocumentJob, type PageResult } from "@/lib/ocr/types";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function prettyStatus(status: string) {
  if (status.includes("loading language")) return "Loading language data";
  if (status.includes("initializing")) return "Starting the reader";
  if (status.includes("recognizing")) return "Reading characters";
  if (status.includes("loaded")) return "Preparing the page";
  return status.replace(/_/g, " ");
}

function languageLabel(code: string) {
  return OCR_LANGUAGES.find((lang) => lang.code === code)?.label ?? code;
}

function documentText(job: DocumentJob) {
  return job.pages
    .map((page, index) =>
      job.pages.length > 1 ? `--- Page ${index + 1} ---\n${page.text}` : page.text,
    )
    .join("\n\n");
}

export function OcrStudio() {
  const { language, setLanguage } = useOcrSettings();
  const [job, setJob] = useState<DocumentJob | null>(null);
  const [sources, setSources] = useState<Record<string, Blob>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [copied, setCopied] = useState(false);
  const [readLanguage, setReadLanguage] = useState(language);
  const runId = useRef(0);
  const objectUrls = useRef<string[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const page = job?.pages[pageIndex] ?? null;
  const overall = useMemo(() => {
    if (!job?.pages.length) return 0;
    const sum = job.pages.reduce(
      (acc, item) => acc + (item.status === "done" || item.status === "error" ? 1 : item.progress),
      0,
    );
    return Math.round((sum / job.pages.length) * 100);
  }, [job]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const trackUrl = useCallback((url: string) => {
    objectUrls.current.push(url);
    return url;
  }, []);

  const updatePage = useCallback((pageId: string, patch: Partial<PageResult>) => {
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((item) => (item.id === pageId ? { ...item, ...patch } : item)),
      };
    });
  }, []);

  const runPages = useCallback(
    async (nextJob: DocumentJob, blobs: Record<string, Blob>, lang: string, generation: number) => {
      setBusy(true);
      setReadLanguage(lang);

      for (const nextPage of nextJob.pages) {
        if (runId.current !== generation) return;
        const blob = blobs[nextPage.id];
        if (!blob) {
          updatePage(nextPage.id, {
            status: "error",
            error: "The page data was lost.",
            progress: 1,
          });
          continue;
        }

        updatePage(nextPage.id, {
          status: "running",
          progress: 0.05,
          progressLabel: "Starting the reader",
        });

        try {
          const result = await recognizeLocal(blob, lang, (status, progress) => {
            if (runId.current !== generation) return;
            updatePage(nextPage.id, {
              progress: Math.max(0.05, progress),
              progressLabel: prettyStatus(status),
            });
          });
          if (runId.current !== generation) return;
          updatePage(nextPage.id, {
            status: "done",
            text: result.text,
            progress: 1,
            progressLabel: "Done",
          });
        } catch (err) {
          if (runId.current !== generation) return;
          updatePage(nextPage.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Reading failed.",
            progress: 1,
          });
        }
      }

      if (runId.current === generation) setBusy(false);
    },
    [updatePage],
  );

  const ingestCanvases = useCallback(
    async (
      name: string,
      kind: DocumentJob["kind"],
      canvases: HTMLCanvasElement[],
      lang: string,
      generation: number,
    ) => {
      const pages: PageResult[] = [];
      const blobs: Record<string, Blob> = {};
      for (const [index, canvas] of canvases.entries()) {
        const blob = await canvasToBlob(canvas);
        const id = uid();
        blobs[id] = blob;
        pages.push({
          id,
          index,
          previewUrl: trackUrl(URL.createObjectURL(blob)),
          text: "",
          status: "queued",
          progress: 0,
          progressLabel: "Waiting",
        });
      }
      const nextJob: DocumentJob = { id: uid(), name, kind, pages, createdAt: Date.now() };
      setJob(nextJob);
      setSources(blobs);
      setPageIndex(0);
      await runPages(nextJob, blobs, lang, generation);
    },
    [runPages, trackUrl],
  );

  const ingestFile = useCallback(
    async (file: File) => {
      const generation = ++runId.current;
      const lang = language;
      setNotice(null);
      setCopied(false);
      setBusy(true);

      try {
        if (isPdf(file)) {
          const rendered = await renderPdfPages(file, MAX_PDF_PAGES);
          if (runId.current !== generation) return;
          if (rendered.truncated) {
            setNotice({
              tone: "info",
              text: `Reading the first ${rendered.pages.length} of ${rendered.totalPages} pages.`,
            });
          }
          const pages: PageResult[] = [];
          const blobs: Record<string, Blob> = {};
          rendered.pages.forEach((item, index) => {
            const id = uid();
            trackUrl(item.previewUrl);
            blobs[id] = item.blob;
            pages.push({
              id,
              index,
              previewUrl: item.previewUrl,
              text: "",
              status: "queued",
              progress: 0,
              progressLabel: "Waiting",
            });
          });
          const nextJob: DocumentJob = {
            id: uid(),
            name: file.name,
            kind: "pdf",
            pages,
            createdAt: Date.now(),
          };
          setJob(nextJob);
          setSources(blobs);
          setPageIndex(0);
          await runPages(nextJob, blobs, lang, generation);
        } else {
          const bitmap = await fileToBitmap(file);
          const canvas = drawBitmapToCanvas(bitmap);
          bitmap.close();
          if (runId.current !== generation) return;
          await ingestCanvases(file.name, "image", [canvas], lang, generation);
        }
      } catch (err) {
        if (runId.current !== generation) return;
        setBusy(false);
        setNotice({
          tone: "error",
          text: err instanceof Error ? err.message : "Could not open that file.",
        });
      }
    },
    [ingestCanvases, language, runPages, trackUrl],
  );

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (busy) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (!files.length) return;
      const { accepted, rejected } = filterAccepted(files);
      if (rejected[0]) setNotice({ tone: "error", text: rejected[0] });
      if (accepted[0]) {
        event.preventDefault();
        void ingestFile(accepted[0]);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, ingestFile]);

  function handleFiles(files: File[]) {
    const { accepted, rejected } = filterAccepted(files);
    if (rejected[0]) setNotice({ tone: "error", text: rejected[0] });
    else setNotice(null);
    if (accepted[0]) void ingestFile(accepted[0]);
  }

  function handleStop() {
    runId.current += 1;
    setBusy(false);
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((item) =>
          item.status === "queued" || item.status === "running"
            ? { ...item, status: "error", error: "Stopped.", progress: 1, progressLabel: "Stopped" }
            : item,
        ),
      };
    });
  }

  function handleClear() {
    runId.current += 1;
    setBusy(false);
    setJob(null);
    setSources({});
    setPageIndex(0);
    setCopied(false);
    setNotice(null);
  }

  async function rerun() {
    if (!job || busy || !Object.keys(sources).length) return;
    const generation = ++runId.current;
    const reset: DocumentJob = {
      ...job,
      pages: job.pages.map((item) => ({
        ...item,
        text: "",
        status: "queued" as const,
        progress: 0,
        progressLabel: "Waiting",
        error: undefined,
      })),
    };
    setJob(reset);
    setNotice(null);
    await runPages(reset, sources, language, generation);
  }

  async function copyText() {
    if (!page?.text) return;
    try {
      await navigator.clipboard.writeText(page.text);
      setCopied(true);
      setNotice(null);
    } catch {
      textRef.current?.focus();
      textRef.current?.select();
      setNotice({ tone: "error", text: "Select the text and copy it." });
    }
  }

  function downloadText() {
    if (!job) return;
    const blob = new Blob([documentText(job)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${job.name.replace(/\.[^.]+$/, "") || "folio"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canRerun =
    !!job &&
    !busy &&
    Object.keys(sources).length > 0 &&
    (readLanguage !== language || job.pages.some((item) => item.status === "error"));
  const hasText = !!job?.pages.some((item) => item.text);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Folio</h1>
          <p className="mt-1 text-sm text-muted">
            Drop an image or PDF. The file stays in this browser.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted" htmlFor="folio-lang">
          Language
          <select
            id="folio-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-11 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {OCR_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {notice && (
        <p
          className={cn("mb-4 text-sm", notice.tone === "error" ? "text-danger" : "text-muted")}
          role="status"
        >
          {notice.text}
        </p>
      )}

      {!job && (
        <div>
          <Dropzone disabled={busy} onFiles={handleFiles} />
          {busy && (
            <div className="mt-3 flex items-center gap-3">
              <p className="text-sm text-muted">Opening the file…</p>
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {job && page && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-sm">{job.name}</p>
            {busy && (
              <Button type="button" variant="ghost" size="sm" onClick={handleStop}>
                Stop
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>
              New file
            </Button>
          </div>

          {busy && (
            <div className="flex items-center gap-3">
              <Progress value={overall} aria-label="Reading progress" />
              <span className="text-xs tabular-nums text-muted">
                {page.progressLabel || "Reading…"}
              </span>
            </div>
          )}

          <div className="grid items-start gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]">
                <PagePreview page={page} />
              </div>
              <PageThumbs pages={job.pages} active={pageIndex} onSelect={setPageIndex} />
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <label className="text-sm text-muted" htmlFor="folio-text">
                {job.pages.length > 1 ? `Page ${pageIndex + 1} of ${job.pages.length}` : "Text"}
              </label>
              {page.status === "error" && <p className="text-sm text-danger">{page.error}</p>}
              <Textarea
                ref={textRef}
                id="folio-text"
                value={page.text}
                onChange={(e) => updatePage(page.id, { text: e.target.value })}
                readOnly={page.status !== "done"}
                spellCheck={false}
                placeholder={
                  page.status === "done"
                    ? "No text found on this page."
                    : page.progressLabel || "Reading…"
                }
                className="min-h-80 bg-surface"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void copyText()} disabled={!page.text}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={downloadText}
                  disabled={!hasText}
                >
                  Download .txt
                </Button>
                {canRerun && (
                  <Button type="button" variant="ghost" onClick={() => void rerun()}>
                    {readLanguage !== language ? `Read in ${languageLabel(language)}` : "Try again"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
