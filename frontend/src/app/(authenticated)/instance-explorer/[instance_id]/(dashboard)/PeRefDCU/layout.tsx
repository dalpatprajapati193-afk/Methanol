export default function PeRefDCULayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full overflow-hidden bg-background">
      {children}
    </div>
  );
}
