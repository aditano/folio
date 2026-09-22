import { cn } from "@/lib/utils";
import type { PageResult } from "@/lib/ocr/types";

export function PagePreview({ page }: { page: PageResult }) {
  if (!page.previewUrl) return null;
  return (
    <img
      src={page.previewUrl}
      alt={`Page ${page.index + 1}`}
      className="block h-auto w-full rounded-lg bg-elevated"
    />
  );
}

export function PageThumbs({
  pages,
  active,
  onSelect,
}: {
  pages: PageResult[];
  active: number;
  onSelect: (index: number) => void;
}) {
  if (pages.length < 2) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {pages.map((page, i) => (
        <button
          key={page.id}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Page ${i + 1}`}
          aria-current={i === active}
          className={cn(
            "relative h-20 w-14 shrink-0 overflow-hidden rounded-sm bg-elevated",
            i === active
              ? "shadow-[0_0_0_2px_var(--color-primary)]"
              : "shadow-[var(--shadow-border)]",
          )}
        >
          <img src={page.previewUrl} alt="" className="size-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-bg/70 py-0.5 text-center text-[10px] tabular-nums text-fg">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
