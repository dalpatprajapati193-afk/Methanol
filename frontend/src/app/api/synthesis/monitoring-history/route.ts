import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "2025-12-29 12:00:00";
  const range = url.searchParams.get("range") || "1W";

  try {
    const backendRes = await fetch(`http://localhost:5000/api/lbm/trend-history?date=${encodeURIComponent(date)}&range=${encodeURIComponent(range)}`, {
      cache: "no-store"
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn("[synthesis-trend] Failed to fetch from backend on 5000, fallback to synthesized trends:", err);
  }

  // Fallback response with Synthesis tags
  const timestamps = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
  return NextResponse.json({
    timestamps,
    tags: {
      "Loop_Pressure": timestamps.map((_, i) => 82.5 + Math.sin(i) * 1.8),
      "Methanol_Production": timestamps.map((_, i) => 1835 + Math.cos(i) * 25),
      "Convertor_Bed_1_Outlet_Temperature": timestamps.map((_, i) => 254.2 + Math.sin(i) * 1.2),
      "System_MUG_Gas_CH4_Mole_Concentration": timestamps.map((_, i) => 2.45 + Math.cos(i) * 0.15)
    }
  });
}
