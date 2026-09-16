import AdminTabs from "./components/AdminTabs";
import PageGuard from "@/shared/components/PageGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageGuard resourceId="/admin">
      <div className="flex flex-col h-full w-full bg-background overflow-hidden">
        <div className="flex-none px-6 pt-6 pb-4 border-b border-border bg-surface shadow-sm z-10">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Security & Admin</h1>
          <p className="text-sm text-text-secondary max-w-3xl">
          Manage your system&apos;s Security Groups, User Mappings, Resources, and Access Control Entries.
          </p>
        </div>

        <div className="flex-none px-6 pt-4 border-b border-border bg-surface/50">
          <AdminTabs />
        </div>

        <div className="flex-1 overflow-auto p-6 relative">
          {children}
        </div>
      </div>
    </PageGuard>
  );
}
