import prisma from "@/shared/libs/Prisma";

export default async function cgcMethanol({ params }: { params: Promise<{ instance_id: string }> }) {
    const instanceId = parseInt((await params).instance_id, 10);
    const instance = await prisma.instance.findUnique({
        where: { instanceId },
    });
    if (!instance) return <h1>Instance not found</h1>;
    return <h1> Selected instance is {instance.instanceName}</h1>;
}