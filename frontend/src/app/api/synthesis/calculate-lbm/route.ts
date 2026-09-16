import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import util from "util";

const execFileAsync = util.promisify(execFile);
const synthesisLbmCache = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = body.date || "2025-12-29 12:30:00";
    const strategy = body.strategy || body.settings?.strategy || "capacity";
    const matchTags = body.matchTags || body.settings?.matchTags || [
      "Catalyst_Age",
      "Methanol_Production",
      "Ambient_Temperature",
      "System_MUG_Gas_N2_Mole_Concentration",
      "System_MUG_Gas_CH4_Mole_Concentration"
    ];
    
    const overrides = {
      strategy: strategy,
      matchTags: matchTags,
      ...(body.settings || {})
    };

    const cacheKey = `${date}_${JSON.stringify(overrides)}`;
    if (synthesisLbmCache.has(cacheKey)) {
      return NextResponse.json(synthesisLbmCache.get(cacheKey));
    }

    const scriptPath = path.resolve(process.cwd(), "..", "..", "server", "live_benchmarking.py");
    const serverDir = path.resolve(process.cwd(), "..", "..", "server");

    const { stdout, stderr } = await execFileAsync("python", [
      scriptPath,
      "--date",
      date,
      "--overrides",
      JSON.stringify(overrides)
    ], {
      timeout: 30000,
      windowsHide: true,
      cwd: serverDir
    });

    if (stderr && stderr.includes("Traceback")) {
      console.error("[synthesis-lbm] Python error:", stderr);
      return NextResponse.json({ status: "error", error: stderr }, { status: 500 });
    }

    const result = JSON.parse(stdout);
    synthesisLbmCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[synthesis-lbm] Execution failure:", err);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "2025-12-29 12:30:00";
  const strategy = url.searchParams.get("strategy") || "capacity";
  const refresh = url.searchParams.get("refresh") === "true";
  const matchTags = [
    "Catalyst_Age",
    "Methanol_Production",
    "Ambient_Temperature",
    "System_MUG_Gas_N2_Mole_Concentration",
    "System_MUG_Gas_CH4_Mole_Concentration"
  ];
  const overrides = {
    strategy: strategy,
    matchTags: matchTags
  };

  const cacheKey = `${date}_${JSON.stringify(overrides)}`;
  if (!refresh && synthesisLbmCache.has(cacheKey)) {
    const cached = synthesisLbmCache.get(cacheKey);
    if (cached && cached.status !== "error" && cached.status !== "data_unavailable") {
      return NextResponse.json(cached);
    }
  }

  const scriptPath = path.resolve(process.cwd(), "..", "..", "server", "live_benchmarking.py");
  const serverDir = path.resolve(process.cwd(), "..", "..", "server");

  try {
    const { stdout, stderr } = await execFileAsync("python", [
      scriptPath,
      "--date",
      date,
      "--overrides",
      JSON.stringify(overrides)
    ], {
      timeout: 30000,
      windowsHide: true,
      cwd: serverDir
    });

    if (stderr && stderr.includes("Traceback")) {
      console.error("[synthesis-lbm] Python error:", stderr);
      return NextResponse.json({ status: "error", error: stderr }, { status: 500 });
    }

    const result = JSON.parse(stdout);
    if (result.status === "success" || result.status === "shutdown_detected") {
      synthesisLbmCache.set(cacheKey, result);
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[synthesis-lbm] GET failure:", err);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
