import { Loader2 } from "lucide-react";

type LoaderProps = {
  text?: string;
  className?: string;
};

export function Loader({ text = "Loading...", className = "" }: LoaderProps) {
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-8 text-text-secondary min-h-[400px] ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-4" />
      <p className="text-sm font-medium animate-pulse">{text}</p>
    </div>
  );
}

// Default export for direct use in loading.tsx files if needed
export default function DefaultLoader() {
  return <Loader />;
}
