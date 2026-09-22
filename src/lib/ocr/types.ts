export type FileKind = "image" | "pdf";

export type PageStatus = "queued" | "running" | "done" | "error";

export type PageResult = {
  id: string;
  index: number;
  previewUrl: string;
  text: string;
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
export const MAX_PDF_PAGES = 25;
