import { JotaiProvider } from "@/shared/libs/JotaiProvider";
import prisma from "@/shared/libs/Prisma";
import { SynthesisDashboard } from "./components/SynthesisDashboard";

export const metadata = { title: "Methanol Synthesis LBM · Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

export default async function SynthesisPage({ params }: Props) {
  const { instance_id } = await params;
  const instanceId = parseInt(instance_id, 10);

  let info = null;
  try {
    if (!isNaN(instanceId)) {
      info = await prisma.instance.findUnique({ where: { instanceId } });
    }
  } catch (err) {
    console.warn("[SynthesisPage Warning]: Failed to query instance info from DB:", err);
  }

  const instanceName = info?.instanceName ?? `Instance ${instance_id}`;

  return (
    <JotaiProvider>
      <SynthesisDashboard id={instance_id} instanceName={instanceName} />
    </JotaiProvider>
  );
}
