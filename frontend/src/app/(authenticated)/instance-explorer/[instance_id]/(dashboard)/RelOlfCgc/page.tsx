import { ConfigWizard } from "./Index";
import { JotaiProvider } from "@/shared/libs/JotaiProvider";
import prisma from "@/shared/libs/Prisma";
import type { OnboardingSnapshot } from "./store/Types";

export const metadata = { title: "AFP Onboarding — Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

export default async function RelOlfCgcPage({ params }: Props) {
  const { instance_id } = await params;
  const instanceId = parseInt(instance_id, 10);

  let instanceName = `Instance ${instance_id}`;
  let initialSnapshot: OnboardingSnapshot | null = null;

  if (!Number.isNaN(instanceId)) {
    const [instance, snapshot] = await Promise.all([
      prisma.instance.findUnique({ where: { instanceId } }),
      prisma.instanceConfiguration.findFirst({ where: { instanceId } }),
    ]);
    if (instance) instanceName = instance.instanceName;
    if (snapshot?.ui_config_data) {
      initialSnapshot = snapshot.ui_config_data as unknown as OnboardingSnapshot;
    }
  }

  return (
    <JotaiProvider>
      <ConfigWizard instanceId={instanceId} instanceName={instanceName} initialSnapshot={initialSnapshot} />
    </JotaiProvider>
  );
}
