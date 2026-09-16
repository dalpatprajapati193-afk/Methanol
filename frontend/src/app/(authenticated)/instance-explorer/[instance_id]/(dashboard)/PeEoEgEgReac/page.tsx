/**
 * Sample capability landing page — central-team onboarding template.
 *
 * Copy this file to:
 *   src/app/(authenticated)/instance-explorer/[instance_id]/(dashboard)/<capability_name>/page.tsx
 *
 * Its only job is to confirm the capability is registered correctly and the
 * developer's environment is wired up: it receives `instance_id` from the route
 * and shows a static welcome. Replace it with your real UI once verified.
 *
 * This is a Server Component — `instance_id` arrives via `params` (see
 * documentation/02_instance_id_and_routing.md). No client state is needed for a
 * static page, so there is no JotaiProvider here yet.
 */

export const metadata = { title: "Capability — Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

export default async function CapabilityWelcomePage({ params }: Props) {
  const { instance_id } = await params;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg rounded-lg border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary">
          Welcome to your capability instance.
        </h1>

        <p className="mt-4 text-sm text-text-secondary">
          You are now working on instance{" "}
          <span className="font-medium text-text-primary">#{instance_id}</span> of this
          capability.
        </p>

        <p className="mt-2 text-sm text-text-secondary">
          Please refer to the documentation available in the{" "}
          <code className="rounded border border-border bg-background px-1 py-0.5 text-text-primary">
            documentation
          </code>{" "}
          folder to get started.
        </p>

        <p className="mt-4 text-sm text-text-secondary">Thank you.</p>
      </div>
    </div>
  );
}
