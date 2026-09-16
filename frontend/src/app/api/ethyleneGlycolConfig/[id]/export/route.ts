export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/shared/libs/Prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const instanceId = parseInt(id, 10);
  if (isNaN(instanceId)) {
    return NextResponse.json({ error: "Invalid instance ID" }, { status: 400 });
  }

  const row = await prisma.instanceConfiguration.findFirst({
    where: { instanceId },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) {
    return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
  }

  return new NextResponse(row.pipeline_config_data, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="instance_${instanceId}_config.xlsx"`,
    },
  });
}
