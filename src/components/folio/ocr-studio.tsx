import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, ImagePlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "./app-header";
import { Dropzone, filterAccepted } from "./dropzone";
import { EngineToggle } from "./engine-toggle";
import { PagePreview, PageThumbs } from "./page-preview";
import { ResultPanel } from "./result-panel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { extractTextWithAi, isAiAvailable } from "@/lib/ocr/ai";
import { blobToJpegDataUrl, canvasToBlob, drawBitmapToCanvas, fileToBitmap, makeSampleMemo } from "@/lib/ocr/image";
import { OCR_LANGUAGES } from "@/lib/ocr/languages";
import { renderPdfPages } from "@/lib/ocr/pdf";
import { useOcrHistory, useOcrSettings } from "@/lib/ocr/store";
import { recognizeLocal } from "@/lib/ocr/tesseract";
import {
  MAX_PDF_PAGES_AI,
  MAX_PDF_PAGES_LOCAL,
  type DocumentJob,
  type Engine,
  type PageResult,
} from "@/lib/ocr/types";
import { cn } from "@/lib/utils";

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

export function OcrStudio() {
  const { engine, language, showBoxes, setEngine, setLanguage, setShowBoxes } = useOcrSettings();
  const history = useOcrHistory();
  const [aiAvailable, setAiAvailable] = useState(false);
  const [job, setJob] = useState<DocumentJob | null>(null);
  const [sources, setSources] = useState<Record<string, Blob>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [activeWord, setActiveWord] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState<"page" | "text">("page");
  const [historyOpen, setHistoryOpen] = useState(false);
  const cancelRef = useRef(false);
  const objectUrls = useRef<string[]>([]);

  const page = job?.pages[pageIndex] ?? null;
  const overall = useMemo(() => {
    if (!job?.pages.length) return 0;
    const sum = job.pages.reduce((acc, p) => acc + (p.status === "done" || p.status === "error" ? 1 : p.progress), 0);
    return Math.round((sum / job.pages.length) * 100);
  }, [job]);

  useEffect(() => {
    void isAiAvailable()
      .then((ok) => setAiAvailable(Boolean(ok)))
      .catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const trackUrl = useCallback((url: string) => {
    objectUrls.current.push(url);
    return url;
  }, []);

  const updatePage = useCallback((pageId: string, patch: Partial<PageResult>) => {
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
      };
    });
  }, []);

  const runPages = useCallback(
    async (nextJob: DocumentJob, blobs: Record<string, Blob>, selectedEngine: Engine, lang: string) => {
      cancelRef.current = false;
      setBusy(true);
      setEditing(false);
      setMobileTab("page");

      for (const nextPage of nextJob.pages) {
        if (cancelRef.current) break;
        const blob = blobs[nextPage.id];
        if (!blob) {
          updatePage(nextPage.id, { status: "error", error: "The page data was lost.", progress: 1 });
          continue;
        }

        updatePage(nextPage.id, {
          status: "running",
          progress: 0.05,
          progressLabel: selectedEngine === "ai" ? "Sending the page" : "Starting the reader",
        });

        try {
          if (selectedEngine === "ai") {
            const imageDataUrl = await blobToJpegDataUrl(blob);
            if (cancelRef.current) break;
            const result = await extractTextWithAi({ data: { imageDataUrl } });
            if (!result.ok) throw new Error(result.error);
            updatePage(nextPage.id, {
              status: "done",
              text: result.text,
              confidence: 0,
              words: [],
              progress: 1,
              progressLabel: "Done",
            });
          } else {
            const result = await recognizeLocal(blob, lang, (status, progress) => {
              updatePage(nextPage.id, {
                progress: Math.max(0.05, progress),
                progressLabel: prettyStatus(status),
              });
            });
            updatePage(nextPage.id, {
              status: "done",
              text: result.text,
              confidence: result.confidence,
              words: result.words,
              progress: 1,
              progressLabel: "Done",
            });
          }
        } catch (err) {
          updatePage(nextPage.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Reading failed.",
            progress: 1,
          });
        }
      }

      setBusy(false);
      setMobileTab("text");
    },
    [updatePage],
  );

  const ingestCanvases = useCallback(
    async (name: string, kind: DocumentJob["kind"], canvases: HTMLCanvasElement[], selectedEngine: Engine, lang: string) => {
      const pages: PageResult[] = [];
      const blobs: Record<string, Blob> = {};
      for (const [index, canvas] of canvases.entries()) {
        const blob = await canvasToBlob(canvas);
        const id = uid();
        const previewUrl = trackUrl(URL.createObjectURL(blob));
        blobs[id] = blob;
        pages.push({
          id,
          index,
          previewUrl,
          width: canvas.width,
          height: canvas.height,
          text: "",
          confidence: 0,
          words: [],
          status: "queued",
          progress: 0,
          progressLabel: "Waiting",
        });
      }
      const nextJob: DocumentJob = { id: uid(), name, kind, pages, createdAt: Date.now() };
      setJob(nextJob);
      setSources(blobs);
      setPageIndex(0);
      setActiveWord(null);
      await runPages(nextJob, blobs, selectedEngine, lang);
    },
    [runPages, trackUrl],
  );

  const ingestFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || busy) return;
      const file = files[0];
      const selectedEngine = engine;
      const lang = language;
      const maxPages = selectedEngine === "ai" ? MAX_PDF_PAGES_AI : MAX_PDF_PAGES_LOCAL;

      try {
        setBusy(true);
        if (isPdf(file)) {
          const rendered = await renderPdfPages(file, maxPages);
          if (rendered.truncated) {
            toast.message(`Reading the first ${rendered.pages.length} of ${rendered.totalPages} pages.`);
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
              width: item.width,
              height: item.height,
              text: "",
              confidence: 0,
              words: [],
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
          setActiveWord(null);
          await runPages(nextJob, blobs, selectedEngine, lang);
        } else {
          const bitmap = await fileToBitmap(file);
          const canvas = drawBitmapToCanvas(bitmap);
          bitmap.close();
          await ingestCanvases(file.name, "image", [canvas], selectedEngine, lang);
        }
      } catch (err) {
        setBusy(false);
        toast.error(err instanceof Error ? err.message : "Could not open that file.");
      }
    },
    [busy, engine, ingestCanvases, language, runPages, trackUrl],
  );

  const savedJobId = useRef<string | null>(null);

  useEffect(() => {
    if (!job || busy) return;
    if (savedJobId.current === job.id) return;
    if (!job.pages.every((p) => p.status === "done" || p.status === "error")) return;
    const text = job.pages
      .map((p, i) => (job.pages.length > 1 ? `--- Page ${i + 1} ---\n${p.text}` : p.text))
      .join("\n\n")
      .trim();
    if (!text) return;
    savedJobId.current = job.id;
    const first = job.pages[0];
    const pushHistory = useOcrHistory.getState().push;
    if (first?.previewUrl) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 96 / Math.max(img.width, 1);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        let thumbnail: string | null = null;
        try {
          thumbnail = canvas.toDataURL("image/jpeg", 0.6);
        } catch {
          thumbnail = null;
        }
        pushHistory({
          id: job.id,
          name: job.name,
          kind: job.kind,
          pageCount: job.pages.length,
          text,
          thumbnail,
          createdAt: job.createdAt,
          engine,
        });
      };
      img.src = first.previewUrl;
    } else {
      pushHistory({
        id: job.id,
        name: job.name,
        kind: job.kind,
        pageCount: job.pages.length,
        text,
        thumbnail: null,
        createdAt: job.createdAt,
        engine,
      });
    }
  }, [busy, engine, job]);

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
      const { accepted, rejected } = filterAccepted(files);
      rejected.forEach((msg) => toast.error(msg));
      if (accepted.length) {
        event.preventDefault();
        void ingestFiles(accepted);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, ingestFiles]);

  function handleFiles(files: File[]) {
    const { accepted, rejected } = filterAccepted(files);
    rejected.forEach((msg) => toast.error(msg));
    if (accepted.length > 1) toast.message(`Reading ${accepted[0].name}. Extra files were ignored.`);
    if (accepted[0]) void ingestFiles([accepted[0]]);
  }

  async function handleSample() {
    if (busy) return;
    const canvas = makeSampleMemo();
    await ingestCanvases("folio-memorandum.png", "image", [canvas], engine, language);
  }

  function handleClear() {
    cancelRef.current = true;
    savedJobId.current = null;
    setBusy(false);
    setJob(null);
    setSources({});
    setPageIndex(0);
    setActiveWord(null);
    setEditing(false);
  }

  function restoreHistory(item: (typeof history.items)[number]) {
    const id = uid();
    const previewUrl = item.thumbnail ?? "";
    const next: DocumentJob = {
      id,
      name: item.name,
      kind: item.kind,
      createdAt: Date.now(),
      pages: [
        {
          id,
          index: 0,
          previewUrl,
          width: 1,
          height: 1,
          text: item.text,
          confidence: 0,
          words: [],
          status: "done",
          progress: 1,
          progressLabel: "Done",
        },
      ],
    };
    setJob(next);
    setSources({});
    setPageIndex(0);
    setHistoryOpen(false);
    setMobileTab("text");
  }

  async function rerun() {
    if (!job || busy) return;
    const reset: DocumentJob = {
      ...job,
      pages: job.pages.map((p) => ({
        ...p,
        text: "",
        words: [],
        confidence: 0,
        status: "queued" as const,
        progress: 0,
        progressLabel: "Waiting",
        error: undefined,
      })),
    };
    setJob(reset);
    await runPages(reset, sources, engine, language);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <AppHeader>
        <div className="hidden items-center gap-2 md:flex">
          <EngineToggle
            value={aiAvailable ? engine : "local"}
            onChange={setEngine}
            aiAvailable={aiAvailable}
          />
          <label className="sr-only" htmlFor="folio-lang">
            Language
          </label>
          <select
            id="folio-lang"
            value={language}
            disabled={engine === "ai"}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-11 max-w-40 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
          >
            {OCR_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Recent documents"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <Clock />
          </Button>
          {historyOpen && (
            <div className="absolute top-12 right-0 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg bg-surface p-2 shadow-[var(--shadow-border),var(--shadow-lift)]">
              <div className="flex items-center justify-between px-2 py-1.5">
                <p className="text-sm font-medium">Recent</p>
                {history.items.length > 0 && (
                  <button type="button" className="text-xs text-subtle hover:text-fg" onClick={() => history.clear()}>
                    Clear
                  </button>
                )}
              </div>
              {history.items.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted">Nothing saved yet.</p>
              ) : (
                <ul className="max-h-80 overflow-auto">
                  {history.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => restoreHistory(item)}
                        className="flex min-h-11 flex-1 items-center gap-2 rounded-sm px-2 text-left hover:bg-elevated"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{item.name}</span>
                          <span className="block text-xs text-subtle">
                            {item.pageCount} page{item.pageCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="grid size-11 place-items-center text-subtle hover:text-fg"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => history.remove(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </AppHeader>

      {busy && (
        <div className="sticky top-16 z-20 bg-bg/90 px-4 py-2 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            <Progress value={overall} className="flex-1" />
            <span className="text-xs tabular-nums text-muted">{overall}%</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => { cancelRef.current = true; }}>
              <X />
              Stop
            </Button>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        {!job && (
          <EmptyState
            busy={busy}
            engine={aiAvailable ? engine : "local"}
            aiAvailable={aiAvailable}
            onFiles={handleFiles}
            onSample={() => void handleSample()}
          />
        )}

        {job && page && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col gap-3 md:hidden">
              <EngineToggle
                value={aiAvailable ? engine : "local"}
                onChange={setEngine}
                aiAvailable={aiAvailable}
              />
              <select
                value={language}
                disabled={engine === "ai"}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-11 rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              >
                {OCR_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-medium">{job.name}</p>
              <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={showBoxes}
                  onChange={(e) => setShowBoxes(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Word boxes
              </label>
              <Button type="button" variant="secondary" size="sm" disabled={busy || !Object.keys(sources).length} onClick={() => void rerun()}>
                Read again
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleClear}>
                New file
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,application/pdf,.pdf"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFiles([e.target.files[0]]);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex h-9 items-center gap-2 rounded-sm bg-transparent px-3 text-sm font-medium text-fg shadow-[var(--shadow-border)] hover:bg-elevated">
                  <ImagePlus className="size-4" />
                  Replace
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-md bg-elevated p-1 md:hidden">
              {(["page", "text"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMobileTab(tab)}
                  className={cn(
                    "min-h-11 rounded-sm text-sm font-medium",
                    mobileTab === tab ? "bg-primary text-primary-fg" : "text-muted",
                  )}
                >
                  {tab === "page" ? "Page" : "Text"}
                </button>
              ))}
            </div>

            <div className="grid flex-1 gap-4 lg:grid-cols-2">
              <div className={cn("flex min-w-0 flex-col gap-3", mobileTab === "text" && "hidden md:flex")}>
                <div className="rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] sm:p-2.5">
                  <PagePreview page={page} showBoxes={showBoxes && engine === "local"} activeWord={activeWord} onWord={setActiveWord} />
                </div>
                <PageThumbs pages={job.pages} active={pageIndex} onSelect={setPageIndex} />
              </div>
              <div className={cn("flex min-h-0 min-w-0", mobileTab === "page" && "hidden md:flex")}>
                <ResultPanel
                  job={job}
                  page={page}
                  pageIndex={pageIndex}
                  editing={editing}
                  onEditing={setEditing}
                  activeWord={activeWord}
                  onText={(text) => updatePage(page.id, { text })}
                />
              </div>
            </div>
            {engine === "ai" && aiAvailable && (
              <p className="text-xs text-subtle">
                AI mode sends each page to Grok to read. On-device mode never leaves this browser.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  busy,
  engine,
  aiAvailable,
  onFiles,
  onSample,
}: {
  busy: boolean;
  engine: Engine;
  aiAvailable: boolean;
  onFiles: (files: File[]) => void;
  onSample: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-10">
      <div className="folio-enter space-y-3 pt-4 text-center sm:pt-8">
        <p className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Private document reader</p>
        <h1 className="font-display text-4xl leading-tight font-medium tracking-[-0.03em] text-fg sm:text-5xl">
          Read any page.
        </h1>
        <p className="mx-auto max-w-md text-base text-muted">
          Drop an image or PDF. Folio extracts the words
          {engine === "local" ? " in your browser — the file never leaves this device." : " with Grok, one page at a time."}
        </p>
      </div>

      <div className="folio-enter folio-enter-delay-1">
        <Dropzone disabled={busy} onFiles={onFiles} />
      </div>

      <div className="folio-enter folio-enter-delay-2 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="secondary" onClick={onSample} disabled={busy}>
          Try a sample page
        </Button>
        <p className="text-sm text-subtle">PNG, JPG, WebP, or PDF · paste from the clipboard</p>
      </div>

      <figure className="folio-enter folio-enter-delay-3 overflow-hidden rounded-xl bg-surface p-1.5 shadow-[var(--shadow-border)]">
        <img
          src={`${import.meta.env.BASE_URL}empty-desk.jpg`}
          alt="A blank sheet of paper and a brass magnifying glass on a walnut desk"
          className="aspect-4/3 w-full rounded-lg object-cover"
        />
      </figure>

      <dl className="folio-enter folio-enter-delay-4 grid gap-4 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-surface px-4 py-4 shadow-[var(--shadow-border)]">
          <dt className="font-medium text-fg">On device</dt>
          <dd className="mt-1 text-muted">Tesseract reads print locally. Language packs load as needed.</dd>
        </div>
        <div className="rounded-lg bg-surface px-4 py-4 shadow-[var(--shadow-border)]">
          <dt className="font-medium text-fg">{aiAvailable ? "AI when you want it" : "PDF pages"}</dt>
          <dd className="mt-1 text-muted">
            {aiAvailable
              ? "Switch to AI for handwriting, stamps, and messy scans."
              : "Each page is rendered, then read in order."}
          </dd>
        </div>
        <div className="rounded-lg bg-surface px-4 py-4 shadow-[var(--shadow-border)]">
          <dt className="font-medium text-fg">Copy or keep</dt>
          <dd className="mt-1 text-muted">Edit the text, copy a page, or download a clean .txt file.</dd>
        </div>
      </dl>
    </div>
  );
}
