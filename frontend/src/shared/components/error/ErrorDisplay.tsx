import React from "react";

type ErrorDisplayProps = {
  title?: string;
  message?: string;
  errorDetail?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function ErrorDisplay({
  title = "Something went wrong!",
  message = "We encountered an unexpected error while loading this page.",
  errorDetail,
  onRetry,
  retryLabel = "Try again",
  className = "",
}: ErrorDisplayProps) {
  return (
    <div className={`flex flex-col items-center justify-center h-full w-full gap-4 p-8 bg-background min-h-[400px] ${className}`}>
      <div className="text-accent-red bg-red-100 p-3 rounded-full">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-text-primary">{title}</h2>
      <p className="text-text-secondary text-center max-w-md">
        {message}
      </p>
      {errorDetail && (
        <div className="text-sm text-text-secondary bg-surface p-4 rounded-md w-full max-w-xl overflow-auto border border-border">
          <code className="break-all">{errorDetail}</code>
        </div>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-6 py-2 bg-accent-blue text-white rounded-md hover:opacity-90 transition-opacity"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
