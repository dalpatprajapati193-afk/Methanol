"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

interface Props {
  level: string;
  currentCount: number;
  minRequired?: number;
  isSilent?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export default function CountCard({
  level,
  currentCount,
  minRequired = 0,
  isSilent = false,
  onIncrement,
  onDecrement,
  disabled = false,
}: Props) {
  const isViolating = !isSilent && minRequired > 0 && currentCount < minRequired;
  return (
    <div
      className={cn(
        "border rounded-xl p-3 flex flex-col gap-2.5 bg-surface shadow-sm",
        isViolating ? "border-accent-red/60" : "border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-text-primary truncate">{level}</span>
        {isViolating && (
          <span
            className="w-2 h-2 rounded-full bg-accent-red shrink-0"
            title={`Min: ${minRequired}`}
          />
        )}
      </div>

      {isSilent ? (
        <p className="text-xs text-text-secondary italic">Auto-applied</p>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            {minRequired > 0 ? `Required: ≥${minRequired}` : "Optional"}
          </p>

          {/* Connected stepper control */}
          <div
            className="flex items-center border border-border rounded-lg overflow-hidden w-fit mt-0.5"
          >
            <button
              onClick={onDecrement}
              disabled={disabled || currentCount <= 0}
              className="w-[28px] h-[28px] flex items-center justify-center bg-surface text-text-secondary text-base leading-none hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              −
            </button>
            <span className="w-9 h-[28px] flex items-center justify-center text-sm font-semibold text-text-primary border-l border-r border-border">
              {currentCount}
            </span>
            <button
              onClick={onIncrement}
              disabled={disabled}
              className="w-[28px] h-[28px] flex items-center justify-center bg-surface text-text-secondary text-base leading-none hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>
        </>
      )}
    </div>
  );
}
