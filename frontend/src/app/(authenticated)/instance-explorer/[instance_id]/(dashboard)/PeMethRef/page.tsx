import { JotaiProvider } from "@/shared/libs/JotaiProvider";
import prisma from "@/shared/libs/Prisma";
import { ReformerDashboard } from "./components/ReformerDashboard";

export const metadata = { title: "Methanol Reformer LBM · Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

export default async function ReformerPage({ params }: Props) {
  const { instance_id } = await params;
  const instanceId = parseInt(instance_id, 10);

  let info = null;
  try {
    if (!isNaN(instanceId)) {
      info = await prisma.instance.findUnique({ where: { instanceId } });
    }
  } catch (err) {
    console.warn("[ReformerPage Warning]: Failed to query instance info from DB:", err);
  }

  const instanceName = info?.instanceName ?? `Instance ${instance_id}`;

  return (
    <JotaiProvider>
      <ReformerDashboard id={instance_id} instanceName={instanceName} />
    </JotaiProvider>
  );
}
