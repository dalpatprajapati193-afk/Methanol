"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

interface Props {
  errors?: string[];
  warnings?: string[];
  className?: string;
}

export default function ValidationAlert({ errors = [], warnings = [], className = "" }: Props) {
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {errors.map((e, i) => (
        <div
          key={i}
          className="flex gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-accent-red items-start"
        >
          <span className="shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold">Error:</span>{" "}
            <span className="text-red-700">{e}</span>
          </div>
        </div>
      ))}
      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex gap-2.5 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm items-start"
        >
          <span className="shrink-0 mt-0.5 text-accent-yellow">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5L13 12.5H1L7 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M7 5.5v3M7 10v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-accent-yellow">Warning:</span>{" "}
            <span className="text-yellow-800">{w}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
