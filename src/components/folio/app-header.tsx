import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AuthSlot } from "./auth-slot";

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-fg">
          <span className="grid size-8 place-items-center rounded-sm bg-primary text-primary-fg">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
              <path d="M3.2 1.6h6.4L13 5v9.4H3.2V1.6Z" fill="currentColor" opacity="0.95" />
              <path d="M9.5 1.6V5H13" fill="currentColor" opacity="0.55" />
            </svg>
          </span>
          <span className="font-display text-xl font-medium tracking-tight">Folio</span>
        </Link>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          {children}
          <AuthSlot />
        </div>
      </div>
    </header>
  );
}
