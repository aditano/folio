type TessWorker = {
  recognize: (
    image: Blob | HTMLCanvasElement | File,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ) => Promise<{ data: { text: string } }>;
  reinitialize: (langs: string, oem?: number) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

let worker: TessWorker | null = null;
let workerLang = "";
let starting: Promise<TessWorker> | null = null;
/** Mutable so reused workers report progress to the active recognize call. */
let activeProgress: ((status: string, progress: number) => void) | undefined;

export async function getTesseractWorker(lang: string): Promise<TessWorker> {
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
        activeProgress?.(m.status, m.progress ?? 0);
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
): Promise<{ text: string }> {
  activeProgress = onProgress;
  try {
    const w = await getTesseractWorker(lang);
    const { data } = await w.recognize(image, {}, { text: true });
    return {
      text: (data.text ?? "").replaceAll("\u000c", "").trimEnd(),
    };
  } finally {
    if (activeProgress === onProgress) activeProgress = undefined;
  }
}

export async function terminateTesseract() {
  activeProgress = undefined;
  if (!worker) return;
  const current = worker;
  worker = null;
  workerLang = "";
  starting = null;
  try {
    await current.terminate();
  } catch {
    /* ignore */
  }
}
