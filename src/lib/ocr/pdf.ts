import { canvasToBlob, drawBitmapToCanvas } from "./image";

export type RenderedPage = {
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
  /** Embedded PDF text when the page has a usable text layer. */
  textLayer?: string;
};

export async function renderPdfPages(file: File, maxPages: number): Promise<{
  pages: RenderedPage[];
  totalPages: number;
  truncated: boolean;
}> {
  const pdfjs = await import("pdfjs-dist");
  // Bundle the worker with the app instead of loading from jsDelivr at runtime.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const totalPages = doc.numPages;
  const count = Math.min(totalPages, maxPages);
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= count; i += 1) {
    const page = await doc.getPage(i);
    const unscaled = page.getViewport({ scale: 1 });
    const target = 1800 / Math.max(unscaled.width, unscaled.height);
    // Floor at 1.0 (not 1.4) so already-large pages stay manageable.
    const scale = Math.min(2.4, Math.max(1.0, target));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not open a drawing surface.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    let textLayer: string | undefined;
    try {
      const textContent = await page.getTextContent();
      const joined = textContent.items
        .map((item) => ("str" in item ? String(item.str) : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (joined.length >= 8) textLayer = joined;
    } catch {
      /* fall through to OCR */
    }

    const prepared = drawBitmapToCanvas(canvas);
    const blob = await canvasToBlob(prepared);
    pages.push({
      blob,
      width: prepared.width,
      height: prepared.height,
      previewUrl: URL.createObjectURL(blob),
      textLayer,
    });
  }

  return { pages, totalPages, truncated: totalPages > maxPages };
}
