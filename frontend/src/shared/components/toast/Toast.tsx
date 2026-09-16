type ToastVariant = "success" | "error" | "info";

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-accent-green text-white",
  error: "bg-accent-red text-white",
  info: "bg-accent-blue text-white",
};

type Props = {
  message: string;
  variant?: ToastVariant;
};

export function Toast({ message, variant = "success" }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "px-4 py-3 rounded-lg shadow-lg text-sm font-medium min-w-[240px]",
        variantStyles[variant],
      ].join(" ")}
    >
      {message}
    </div>
  );
}
