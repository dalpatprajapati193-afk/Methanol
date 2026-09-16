import { StatsShell } from "./components/Index";
import { JotaiProvider } from "@/shared/libs/JotaiProvider";
import prisma from "@/shared/libs/Prisma";

export const metadata = { title: "Test PI Pulling — Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

export default async function TestPiPullingPage({ params }: Props) {
  const { instance_id } = await params;
  const instanceId = parseInt(instance_id, 10);

  const info = !isNaN(instanceId)
    ? await prisma.instance.findUnique({ where: { instanceId } })
    : null;

  const instanceName = info?.instanceName ?? `Instance ${instance_id}`;

  return (
    <JotaiProvider>
      <StatsShell id={instance_id} instanceName={instanceName} />
    </JotaiProvider>
  );
}
