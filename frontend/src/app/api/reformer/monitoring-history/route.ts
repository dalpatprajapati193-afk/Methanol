import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import util from "util";

const execFileAsync = util.promisify(execFile);
const trendCache = new Map<string, any>();

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "2025-03-12 10:30:00";
  const range = url.searchParams.get("range") || "1W";
  const cacheKey = `${date}_${range}`;

  if (trendCache.has(cacheKey)) {
    return NextResponse.json(trendCache.get(cacheKey));
  }

  const scriptPath = path.resolve(process.cwd(), "src", "shared", "reformer_trend_engine.py");

  try {
    const { stdout, stderr } = await execFileAsync("python", [scriptPath, "--date", date, "--range", range], {
      timeout: 15000,
      windowsHide: true,
      cwd: process.cwd()
    });

    if (stderr && stderr.includes("Traceback")) {
      console.error("[monitoring-history] Python error:", stderr);
      return NextResponse.json({ status: "error", error: stderr }, { status: 500 });
    }

    const result = JSON.parse(stdout);
    trendCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[monitoring-history] Execution error:", err);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
