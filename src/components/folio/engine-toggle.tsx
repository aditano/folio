import { cn } from "@/lib/utils";
import type { Engine } from "@/lib/ocr/types";

const OPTIONS: { id: Engine; label: string }[] = [
  { id: "local", label: "On device" },
  { id: "ai", label: "AI" },
];

export function EngineToggle({
  value,
  onChange,
  aiAvailable,
}: {
  value: Engine;
  onChange: (engine: Engine) => void;
  aiAvailable: boolean;
}) {
  const options = aiAvailable ? OPTIONS : OPTIONS.filter((o) => o.id === "local");
  const index = Math.max(0, options.findIndex((o) => o.id === value));

  if (options.length === 1) {
    return (
      <div className="flex h-11 items-center rounded-md bg-elevated px-3 text-sm text-muted shadow-[var(--shadow-border)]">
        On device
      </div>
    );
  }

  return (
    <div
      className="relative grid h-11 grid-cols-2 rounded-md bg-elevated p-1 shadow-[var(--shadow-border)]"
      role="tablist"
      aria-label="Reading engine"
    >
      <span
        className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-sm bg-primary transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "relative z-10 min-h-9 rounded-sm px-3 text-sm font-medium transition-colors duration-150",
              active ? "text-primary-fg" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
