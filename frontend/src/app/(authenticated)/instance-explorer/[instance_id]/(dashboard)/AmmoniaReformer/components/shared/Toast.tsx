"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

type ToastVariant = "success" | "error" | "warning" | "info";

const TONE: Record<ToastVariant, string> = {
  success: "border-accent-green text-accent-green",
  error: "border-accent-red text-accent-red",
  warning: "border-accent-yellow text-accent-yellow",
  info: "border-border text-text-primary",
};

/**
 * Fixed-position container for transient action-feedback toasts. Lives outside
 * normal document flow (bottom-right) so showing/hiding toasts never displaces
 * surrounding UI; stacks multiple toasts upward with a gap. `pointer-events-none`
 * keeps the (possibly empty) container from intercepting clicks — individual
 * toasts re-enable pointer events for their close buttons.
 */
export function ToastStack({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[60] flex flex-col-reverse items-end gap-2 pointer-events-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface Props {
  message?: string;
  children?: ReactNode;
  variant?: ToastVariant;
  onClose?: () => void;
  className?: string;
}

/** A single toast chip. Render inside a {@link ToastStack}. */
export default function Toast({ message, children, variant = "success", onClose, className = "" }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex items-center gap-2 px-3 py-2 bg-surface border rounded-lg shadow-lg text-xs max-w-sm",
        TONE[variant],
        className,
      )}
    >
      <span className="min-w-0 break-words">
        {children ?? (
          <>
            {variant === "success" ? "✓ " : ""}
            {message}
          </>
        )}
      </span>
      {onClose && (
        <button className="ml-auto shrink-0" onClick={onClose} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
