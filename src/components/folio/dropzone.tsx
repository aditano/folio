import { useCallback, useRef, useState } from "react";
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

  const handleList = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || disabled) return;
      const { accepted } = filterAccepted(list);
      if (accepted.length) onFiles(accepted);
    },
    [disabled, onFiles],
  );

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
        handleList(e.dataTransfer.files);
      }}
      className={cn(
        "relative rounded-xl bg-surface p-1.5 transition-[box-shadow,transform] duration-200 ease-out",
        over ? "scale-[1.01] shadow-[var(--shadow-border-hover)]" : "shadow-[var(--shadow-border)]",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors duration-200",
          over ? "border-primary/50 bg-elevated" : "border-border bg-bg/40",
          disabled && "opacity-50",
        )}
      >
        <span className="grid size-12 place-items-center rounded-md bg-elevated text-fg shadow-[var(--shadow-border)]">
          <FileUp className="size-5" strokeWidth={1.75} />
        </span>
        <span className="font-display text-2xl font-medium tracking-tight text-fg">Drop a page here</span>
        <span className="max-w-sm text-sm text-muted">
          Images or PDFs, up to 20 MB. Or click to choose a file.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,application/pdf,.pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          handleList(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
