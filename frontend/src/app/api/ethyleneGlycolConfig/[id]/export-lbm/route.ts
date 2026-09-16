export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/shared/libs/Prisma";
import { fetchFastAPI } from "@/shared/libs/FastApiClient";

const FASTAPI_BASE = process.env.FASTAPI_URL ?? "http://localhost:8000/api/";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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

  const config = await fetchFastAPI("eg-config/parse-config", {
    method: "POST",
    body: JSON.stringify({
      config_data: Buffer.from(row.pipeline_config_data).toString("base64"),
    }),
  });

  const body = await req.json().catch(() => ({}));
  const base = FASTAPI_BASE.endsWith("/") ? FASTAPI_BASE.slice(0, -1) : FASTAPI_BASE;
  const upstream = await fetch(`${base}/eg-config/generate-lbm-export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, sheet_overrides: (body as Record<string, unknown>).sheet_overrides ?? {} }),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: await upstream.text() }, { status: upstream.status });
  }

  const blob = await upstream.blob();
  const disposition =
    upstream.headers.get("Content-Disposition") ?? `attachment; filename="lbm_export.xlsx"`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": disposition,
    },
  });
}
