import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import util from "util";

const execFileAsync = util.promisify(execFile);
const lbmCache = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = body.date || "2025-03-12 10:30:00";
    const strategy = body.strategy || "efficiency";
    const cacheKey = `${date}_${strategy}`;

    if (lbmCache.has(cacheKey)) {
      return NextResponse.json(lbmCache.get(cacheKey));
    }

    const scriptPath = path.resolve(process.cwd(), "src", "shared", "reformer_lbm_engine.py");

    const { stdout, stderr } = await execFileAsync("python", [scriptPath, "--date", date, "--strategy", strategy], {
      timeout: 15000,
      windowsHide: true,
      cwd: process.cwd()
    });

    if (stderr && stderr.includes("Traceback")) {
      console.error("[reformer-lbm] Python error:", stderr);
      return NextResponse.json({ status: "error", error: stderr }, { status: 500 });
    }

    const result = JSON.parse(stdout);
    lbmCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[reformer-lbm] Execution failure:", err);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "2025-03-12 10:30:00";
  const strategy = url.searchParams.get("strategy") || "efficiency";
  const cacheKey = `${date}_${strategy}`;

  if (lbmCache.has(cacheKey)) {
    return NextResponse.json(lbmCache.get(cacheKey));
  }

  const scriptPath = path.resolve(process.cwd(), "src", "shared", "reformer_lbm_engine.py");

  try {
    const { stdout } = await execFileAsync("python", [scriptPath, "--date", date, "--strategy", strategy], {
      timeout: 15000,
      windowsHide: true,
      cwd: process.cwd()
    });
    const result = JSON.parse(stdout);
    lbmCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
