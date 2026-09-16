"use client";

import { useRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

interface Props {
  accept?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
  tooltip?: string;
}

export default function FileUpload({
  accept,
  onFile,
  disabled = false,
  className = "",
  tooltip,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative inline-flex group">
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { onFile(f); e.target.value = ""; }
        }}
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center w-8 h-8 border border-border rounded-[7px] bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-45 disabled:cursor-not-allowed",
          className
        )}
        onClick={() => ref.current?.click()}
      >
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
          <path d="M6 8V1M3 4l3-3 3 3M1 9v1.5A1.5 1.5 0 0 0 2.5 12h7A1.5 1.5 0 0 0 11 10.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {tooltip && (
        <div className="absolute top-full left-0 mt-2 z-50 w-max max-w-60 px-2.5 py-1.5 bg-surface border border-border rounded-lg shadow-md text-xs text-text-primary pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line leading-relaxed">
          {tooltip}
          <div className="absolute bottom-full left-3 border-4 border-transparent border-b-border" />
        </div>
      )}
    </div>
  );
}
