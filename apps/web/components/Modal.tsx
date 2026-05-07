"use client";

import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = size === "xl" ? "max-w-5xl" : "max-w-3xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative my-12 w-full ${widthClass} rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:border-amd hover:text-amd"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
