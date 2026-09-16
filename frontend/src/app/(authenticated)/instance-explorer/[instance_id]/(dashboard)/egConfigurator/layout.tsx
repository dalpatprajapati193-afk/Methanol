/**
 * egConfigurator layout.
 * Ensures the mini-app always fills the full viewport — the root body is
 * `h-screen w-full flex` (row), so children need `flex-1 min-h-0 overflow-auto`
 * to stretch correctly.
 */
export default function EgConfiguratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-auto bg-background">
      {children}
    </div>
  );
}
