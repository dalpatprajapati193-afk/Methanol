import { DcuShell } from "./components/DcuShell";
import { JotaiProvider } from "@/shared/libs/JotaiProvider";
import prisma from "@/shared/libs/Prisma";

export const metadata = { title: "DCU Dashboard Configuration — Ingenero360" };

type Props = { params: Promise<{ instance_id: string }> };

export default async function PeRefDCUPage({ params }: Props) {
  const { instance_id } = await params;
  const instanceId = parseInt(instance_id, 10);

  const info = !isNaN(instanceId)
    ? await prisma.instance.findUnique({ where: { instanceId } })
    : null;

  const instanceName = info?.instanceName ?? `Instance ${instance_id}`;

  return (
    <JotaiProvider>
      <DcuShell instanceId={instance_id} instanceName={instanceName} />
    </JotaiProvider>
  );
}
