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
  const size =
    targetWidth && targetHeight
      ? { width: targetWidth, height: targetHeight }
      : scaleForOcr(srcW, srcH);
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

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.88,
): Promise<Blob> {
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
