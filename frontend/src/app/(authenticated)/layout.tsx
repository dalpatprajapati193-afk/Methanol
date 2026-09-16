import { Sidebar, Header } from "@/shared/components/Index";
import { auth } from "@/auth";
import { getUserAllowedResources } from "@/shared/libs/AccessControl";

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const userId = parseInt(session?.user?.id || "0", 10);

    // Get all resources the user can read across all their groups
    const allowedResources = await getUserAllowedResources(userId);

    // If no resources at all → user has no access configured yet
    if (allowedResources.length === 0) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background text-text-primary p-8 text-center">
                <div className="max-w-md border border-border bg-surface p-8 rounded-xl shadow-lg flex flex-col gap-4">
                    <h1 className="text-xl font-bold text-accent-red">Access Denied</h1>
                    <p className="text-sm text-text-secondary">
                        You&apos;re logged in, but you do not have permission to view any resources.
                        Kindly contact your administrator to get access to the application.
                    </p>
                </div>
            </div>
        );
    }

    // Sidebar nav: URL resources in the "sidebar" area
    const sidebarItems = allowedResources
        .filter((r) => r.resourceType?.toLowerCase() === "url" && r.resourceArea?.toLowerCase() === "sidebar")
        .map((r) => ({ title: r.title, url: r.url ?? "/", icon: r.icon }));

    // Show Admin link if user has access to the /admin resource
    const showAdmin = allowedResources.some((r) => r.url === "/admin" || (r.url === "*" && r.resourceArea === "*"));

    return (
        <div className="h-screen w-full flex text-text-primary overflow-hidden">
            {/* sidebar */}
            <Sidebar navItems={sidebarItems} showAdmin={showAdmin} />

            {/* main content */}
            <section className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
                <div className="h-16 w-full shrink-0">
                    <Header />
                </div>
                <div className="flex-1 w-full overflow-y-auto p-4">
                    {children}
                </div>
            </section>
        </div>
    );
}
