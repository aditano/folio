import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PageResult, WordBox } from "@/lib/ocr/types";

export function PagePreview({
  page,
  showBoxes,
  activeWord,
  onWord,
}: {
  page: PageResult;
  showBoxes: boolean;
  activeWord: number | null;
  onWord: (index: number | null) => void;
}) {
  const [natural, setNatural] = useState({ w: page.width, h: page.height });

  return (
    <div className="relative overflow-hidden rounded-lg bg-elevated">
      <img
        src={page.previewUrl}
        alt={`Page ${page.index + 1}`}
        className="block h-auto w-full"
        onLoad={(e) => {
          const img = e.currentTarget;
          setNatural({ w: img.naturalWidth || page.width, h: img.naturalHeight || page.height });
        }}
      />
      {showBoxes && page.words.length > 0 && (
        <div className="absolute inset-0">
          {page.words.map((word, i) => (
            <WordHit
              key={`${word.text}-${i}`}
              word={word}
              width={natural.w}
              height={natural.h}
              active={activeWord === i}
              onEnter={() => onWord(i)}
              onLeave={() => onWord(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WordHit({
  word,
  width,
  height,
  active,
  onEnter,
  onLeave,
}: {
  word: WordBox;
  width: number;
  height: number;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  if (!width || !height) return null;
  const left = (word.bbox.x0 / width) * 100;
  const top = (word.bbox.y0 / height) * 100;
  const w = ((word.bbox.x1 - word.bbox.x0) / width) * 100;
  const h = ((word.bbox.y1 - word.bbox.y0) / height) * 100;
  return (
    <button
      type="button"
      title={word.text}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={cn(
        "absolute rounded-[2px] transition-colors duration-150",
        active ? "bg-primary/30 ring-1 ring-primary/70" : "bg-primary/0 hover:bg-primary/20",
      )}
      style={{ left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%` }}
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
          className={cn(
            "relative h-20 w-14 shrink-0 overflow-hidden rounded-sm bg-elevated transition-[box-shadow] duration-150",
            i === active ? "shadow-[0_0_0_2px_var(--color-primary)]" : "shadow-[var(--shadow-border)]",
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
