export type Engine = "local" | "ai";

export type FileKind = "image" | "pdf";

export type PageStatus = "queued" | "running" | "done" | "error";

export type WordBox = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type PageResult = {
  id: string;
  index: number;
  previewUrl: string;
  width: number;
  height: number;
  text: string;
  confidence: number;
  words: WordBox[];
  status: PageStatus;
  progress: number;
  progressLabel: string;
  error?: string;
};

export type DocumentJob = {
  id: string;
  name: string;
  kind: FileKind;
  pages: PageResult[];
  createdAt: number;
};

export type HistoryItem = {
  id: string;
  name: string;
  kind: FileKind;
  pageCount: number;
  text: string;
  thumbnail: string | null;
  createdAt: number;
  engine: Engine;
};

export const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "application/pdf",
]);

export const ACCEPTED_EXT = /\.(png|jpe?g|webp|gif|bmp|pdf)$/i;

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES_LOCAL = 25;
export const MAX_PDF_PAGES_AI = 8;
