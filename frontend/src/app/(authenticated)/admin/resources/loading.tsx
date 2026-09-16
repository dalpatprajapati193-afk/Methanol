export default function ResourcesLoading() {
  return (
    <div className="flex flex-col gap-4 h-full animate-pulse">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 bg-surface rounded" />
          <div className="h-3 w-60 bg-surface rounded" />
        </div>
        <div className="h-9 w-28 bg-surface rounded-lg" />
      </div>
      <div className="border border-border rounded-xl flex-1 bg-background overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border">
            <div className="h-4 w-32 bg-surface rounded" />
            <div className="h-4 w-48 bg-surface rounded" />
            <div className="h-4 w-20 bg-surface rounded" />
            <div className="h-4 w-20 bg-surface rounded" />
            <div className="h-4 w-16 bg-surface rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
