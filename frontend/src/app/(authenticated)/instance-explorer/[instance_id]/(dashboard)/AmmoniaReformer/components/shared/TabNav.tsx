"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(...args));

type TabStatus = "ok" | "error" | "warning" | "none";

interface Props {
  labels: string[];
  activeTab: number;
  onTabChange: (i: number) => void;
  statuses?: TabStatus[];
  disabledTabs?: number[];
}

const statusDot: Record<TabStatus, string | null> = {
  ok: "bg-accent-green",
  error: "bg-accent-red",
  warning: "bg-accent-yellow",
  none: null,
};

function LockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-50 shrink-0"
    >
      <rect x="1" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function TabNav({
  labels,
  activeTab,
  onTabChange,
  statuses = [],
  disabledTabs = [],
}: Props) {
  const disabledSet = new Set(disabledTabs);

  return (
    <nav className="bg-surface border-b border-border shrink-0 overflow-x-auto">
      <div className="flex px-3" style={{ gap: "1px" }}>
        {labels.map((label, i) => {
          const isActive = i === activeTab;
          const isDisabled = disabledSet.has(i);
          const dot = statusDot[statuses[i] ?? "none"];
          return (
            <button
              key={label}
              onClick={() => {
                if (!isDisabled) onTabChange(i);
              }}
              disabled={isDisabled}
              className={cn(
                "relative px-3.5 h-[41px] text-[12.5px] whitespace-nowrap transition-all duration-200 border-b-2 flex items-center gap-1.5 -mb-px rounded-t",
                isDisabled
                  ? "border-transparent text-text-tertiary cursor-not-allowed"
                  : isActive
                  ? "border-accent-blue text-accent-blue font-semibold bg-surface"
                  : "border-transparent text-text-secondary font-medium hover:text-text-primary hover:bg-surface-hover"
              )}
            >
              {label}
              {dot && (
                <span className={cn("inline-block w-[5px] h-[5px] rounded-full shrink-0", dot)} />
              )}
              {isDisabled && <LockIcon />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
