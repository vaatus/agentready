"use client";

import { useState } from "react";

export function InfoTooltip({ children, label }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] font-bold text-zinc-400 transition-colors hover:border-amd hover:text-amd"
        aria-label={label ?? "info"}
        type="button"
      >
        ?
      </button>
      {open ? (
        <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-xl">
          {children}
        </span>
      ) : null}
    </span>
  );
}
