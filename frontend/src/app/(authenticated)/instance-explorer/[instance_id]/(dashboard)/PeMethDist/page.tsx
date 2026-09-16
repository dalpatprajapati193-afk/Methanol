import { JotaiProvider } from "@/shared/libs/JotaiProvider";
import prisma from "@/shared/libs/Prisma";
import { DistillationDashboard } from "./components/DistillationDashboard";

export const metadata = { title: "Methanol Distillation LBM · Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

export default async function DistillationPage({ params }: Props) {
  const { instance_id } = await params;
  const instanceId = parseInt(instance_id, 10);

  let info = null;
  try {
    if (!isNaN(instanceId)) {
      info = await prisma.instance.findUnique({ where: { instanceId } });
    }
  } catch (err) {
    console.warn("[DistillationPage Warning]: Failed to query instance info from DB:", err);
  }

  const instanceName = info?.instanceName ?? `Instance ${instance_id}`;

  return (
    <JotaiProvider>
      <DistillationDashboard id={instance_id} instanceName={instanceName} />
    </JotaiProvider>
  );
}
