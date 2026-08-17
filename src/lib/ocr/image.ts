const MIN_EDGE = 1400;
const MAX_EDGE = 2400;

export async function fileToBitmap(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export function scaleForOcr(width: number, height: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  let scale = 1;
  if (longEdge < MIN_EDGE) scale = MIN_EDGE / longEdge;
  if (longEdge > MAX_EDGE) scale = MAX_EDGE / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function drawBitmapToCanvas(
  source: ImageBitmap | HTMLCanvasElement,
  targetWidth?: number,
  targetHeight?: number,
): HTMLCanvasElement {
  const srcW = source.width;
  const srcH = source.height;
  const size = targetWidth && targetHeight ? { width: targetWidth, height: targetHeight } : scaleForOcr(srcW, srcH);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not open a drawing surface.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not encode the page."));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function canvasToJpegDataUrl(
  source: HTMLCanvasElement,
  maxEdge = 1280,
  quality = 0.78,
): Promise<string> {
  const longEdge = Math.max(source.width, source.height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not open a drawing surface.");
  ctx.drawImage(source, 0, 0, w, h);
  return out.toDataURL("image/jpeg", quality);
}

export async function blobToJpegDataUrl(blob: Blob, maxEdge = 1280, quality = 0.78): Promise<string> {
  const bitmap = await fileToBitmap(blob);
  const canvas = drawBitmapToCanvas(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return canvasToJpegDataUrl(canvas, maxEdge, quality);
}

export function makeSampleMemo(): HTMLCanvasElement {
  const width = 1275;
  const height = 1650;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not open a drawing surface.");

  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#1a1612";
  ctx.textBaseline = "top";

  ctx.font = "600 42px Georgia, 'Times New Roman', serif";
  ctx.fillText("FOLIO MEMORANDUM", 120, 150);

  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(120, 210);
  ctx.lineTo(width - 120, 210);
  ctx.stroke();

  ctx.font = "500 28px Georgia, 'Times New Roman', serif";
  const meta = [
    "To: The Reading Room",
    "From: Desk 4, West Window",
    "Date: 16 August 2026",
    "Re: Morning pages for the archive",
  ];
  meta.forEach((line, i) => {
    ctx.fillText(line, 120, 250 + i * 44);
  });

  ctx.font = "400 30px Georgia, 'Times New Roman', serif";
  const body = [
    "The enclosed pages were photographed this morning",
    "before the light left the oak table. Please extract",
    "the text exactly as written and file a clean copy.",
    "",
    "We counted thirty-two volumes waiting on the cart.",
    "None of them should leave this room. The brass",
    "magnifier stays with the ledger on the second shelf.",
    "",
    "If a line is faint, read it twice. Prefer the ink",
    "that is still wet to the stamp that is already dry.",
    "",
    "Return the typescript by four o'clock.",
  ];
  body.forEach((line, i) => {
    ctx.fillText(line, 120, 470 + i * 46);
  });

  ctx.font = "italic 28px Georgia, 'Times New Roman', serif";
  ctx.fillText("M. Calder, keeper of papers", 120, 1120);

  ctx.font = "400 22px Georgia, 'Times New Roman', serif";
  ctx.fillStyle = "#4a433b";
  ctx.fillText("Folio internal  ·  not for circulation", 120, 1480);

  return canvas;
}
