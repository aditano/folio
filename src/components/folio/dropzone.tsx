import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_EXT, ACCEPTED_MIME, MAX_FILE_BYTES } from "@/lib/ocr/types";

function isAccepted(file: File) {
  return ACCEPTED_MIME.has(file.type) || ACCEPTED_EXT.test(file.name);
}

export function filterAccepted(files: FileList | File[]): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of Array.from(files)) {
    if (!isAccepted(file)) {
      rejected.push(`${file.name} is not an image or PDF.`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push(`${file.name} is larger than 20 MB.`);
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}

export function Dropzone({
  disabled,
  onFiles,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function emit(list: FileList | null) {
    if (!list || disabled || !list.length) return;
    onFiles(Array.from(list));
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        emit(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl bg-surface p-1.5 shadow-[var(--shadow-border)]",
        over && "shadow-[var(--shadow-border-hover)]",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center",
          over ? "border-primary/50 bg-elevated" : "border-border bg-bg/40",
          disabled && "opacity-50",
        )}
      >
        <FileUp className="size-5 text-muted" strokeWidth={1.75} />
        <span className="text-lg font-medium text-fg">Drop a file here</span>
        <span className="text-sm text-muted">PNG, JPG, WebP, or PDF. You can also paste.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
