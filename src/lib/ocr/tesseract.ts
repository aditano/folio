import type { WordBox } from "./types";

type TessWorker = {
  recognize: (
    image: Blob | HTMLCanvasElement | File,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ) => Promise<{
    data: {
      text: string;
      confidence: number;
      blocks: Array<{
        paragraphs: Array<{
          lines: Array<{
            words: Array<{
              text: string;
              confidence: number;
              bbox: { x0: number; y0: number; x1: number; y1: number };
            }>;
          }>;
        }>;
      }> | null;
    };
  }>;
  reinitialize: (langs: string, oem?: number) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

let worker: TessWorker | null = null;
let workerLang = "";
let starting: Promise<TessWorker> | null = null;

function flattenWords(blocks: NonNullable<Awaited<ReturnType<TessWorker["recognize"]>>["data"]["blocks"]>): WordBox[] {
  const words: WordBox[] = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          const text = word.text.trim();
          if (!text) continue;
          words.push({
            text,
            confidence: word.confidence,
            bbox: word.bbox,
          });
        }
      }
    }
  }
  return words;
}

export async function getTesseractWorker(
  lang: string,
  onProgress?: (status: string, progress: number) => void,
): Promise<TessWorker> {
  if (worker && workerLang === lang) return worker;
  if (starting) {
    const w = await starting;
    if (workerLang === lang) return w;
  }

  starting = (async () => {
    const { createWorker } = await import("tesseract.js");
    if (worker) {
      try {
        await worker.reinitialize(lang, 1);
        workerLang = lang;
        return worker;
      } catch {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
        worker = null;
      }
    }

    const next = (await createWorker(lang, 1, {
      logger: (m: { status: string; progress: number }) => {
        onProgress?.(m.status, m.progress ?? 0);
      },
    })) as TessWorker;
    worker = next;
    workerLang = lang;
    return next;
  })();

  try {
    return await starting;
  } finally {
    starting = null;
  }
}

export async function recognizeLocal(
  image: Blob | HTMLCanvasElement | File,
  lang: string,
  onProgress?: (status: string, progress: number) => void,
): Promise<{ text: string; confidence: number; words: WordBox[] }> {
  const w = await getTesseractWorker(lang, onProgress);
  const { data } = await w.recognize(image, {}, { text: true, blocks: true });
  return {
    text: (data.text ?? "").replace(/\u000c/g, "").trimEnd(),
    confidence: data.confidence ?? 0,
    words: data.blocks ? flattenWords(data.blocks) : [],
  };
}

export async function terminateTesseract() {
  if (!worker) return;
  const current = worker;
  worker = null;
  workerLang = "";
  try {
    await current.terminate();
  } catch {
    /* ignore */
  }
}
