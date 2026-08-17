import { canvasToBlob, drawBitmapToCanvas } from "./image";

const PDFJS_VERSION = "6.2.108";

export type RenderedPage = {
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
};

export async function renderPdfPages(file: File, maxPages: number): Promise<{
  pages: RenderedPage[];
  totalPages: number;
  truncated: boolean;
}> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const totalPages = doc.numPages;
  const count = Math.min(totalPages, maxPages);
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= count; i += 1) {
    const page = await doc.getPage(i);
    const unscaled = page.getViewport({ scale: 1 });
    const target = 1800 / Math.max(unscaled.width, unscaled.height);
    const scale = Math.min(2.4, Math.max(1.4, target));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not open a drawing surface.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const prepared = drawBitmapToCanvas(canvas);
    const blob = await canvasToBlob(prepared);
    pages.push({
      blob,
      width: prepared.width,
      height: prepared.height,
      previewUrl: URL.createObjectURL(blob),
    });
  }

  return { pages, totalPages, truncated: totalPages > maxPages };
}
