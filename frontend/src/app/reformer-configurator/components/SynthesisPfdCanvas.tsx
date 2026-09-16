"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

export interface SynthesisEquipmentHotspot {
  id: string;
  name: string;
  xPct: number;
  yPct: number;
  actual: string;
  optimum: string;
  uom: string;
  status: "ON TARGET" | "ACT TODAY" | "WATCH";
  type: "temp" | "pressure" | "flow" | "eq";
  description: string;
}

interface SynthesisPfdCanvasProps {
  reactorType?: "quench" | "tubular";
  loopConfig?: "single" | "double";
  currentKpis?: Record<string, any>;
  benchmarkKpis?: Record<string, any>;
  activeSection?: string;
  onSelectEquipment?: (id: string) => void;
}

const CompressorSymbol = ({ cx, cy, r = 18, color = "#38bdf8" }: { cx: number; cy: number; r?: number; color?: string }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="#0f172a" stroke={color} strokeWidth="1.8" />
    <path d={`M${cx - r * 0.55} ${cy} C${cx - r * 0.2} ${cy - r * 0.5},${cx + r * 0.2} ${cy + r * 0.5},${cx + r * 0.55} ${cy}`}
      fill="none" stroke={color} strokeWidth="1.4" />
  </g>
);

const HxSymbol = ({ cx, cy, r = 14, color = "#38bdf8" }: { cx: number; cy: number; r?: number; color?: string }) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="#0f172a" stroke={color} strokeWidth="1.6" />
    <line x1={cx - r * 0.65} y1={cy - r * 0.65} x2={cx + r * 0.65} y2={cy + r * 0.65} stroke={color} strokeWidth="1.3" />
    <line x1={cx + r * 0.65} y1={cy - r * 0.65} x2={cx - r * 0.65} y2={cy + r * 0.65} stroke={color} strokeWidth="1.3" />
  </g>
);

const VesselSymbol = ({ cx, cy, w = 22, h = 38, color = "#38bdf8" }: { cx: number; cy: number; w?: number; h?: number; color?: string }) => (
  <g>
    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="5" fill="#0f172a" stroke={color} strokeWidth="1.6" />
    <ellipse cx={cx} cy={cy - h / 2} rx={w / 2} ry="5" fill="#0f172a" stroke={color} strokeWidth="1.4" />
    <ellipse cx={cx} cy={cy + h / 2} rx={w / 2} ry="5" fill="#0f172a" stroke={color} strokeWidth="1.4" />
  </g>
);

const QuenchReactor = ({ cx, cy, w = 44, h = 90, color = "#38bdf8" }: { cx: number; cy: number; w?: number; h?: number; color?: string }) => (
  <g>
    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="6" fill="#0f172a" stroke={color} strokeWidth="1.8" />
    <rect x={cx - w / 2 + 4} y={cy - h / 2 + 12} width={w - 8} height={14} rx="2" fill="#1e3a5f" stroke={color} strokeWidth="1" />
    <rect x={cx - w / 2 + 4} y={cy - h / 2 + 36} width={w - 8} height={14} rx="2" fill="#1e3a5f" stroke={color} strokeWidth="1" />
    <rect x={cx - w / 2 + 4} y={cy - h / 2 + 60} width={w - 8} height={14} rx="2" fill="#1e3a5f" stroke={color} strokeWidth="1" />
    <line x1={cx - w / 2 - 14} y1={cy - h / 2 + 33} x2={cx - w / 2 + 4} y2={cy - h / 2 + 33} stroke="#fbbf24" strokeWidth="1.4" markerEnd="url(#arrowYellow)" />
    <line x1={cx - w / 2 - 14} y1={cy - h / 2 + 57} x2={cx - w / 2 + 4} y2={cy - h / 2 + 57} stroke="#fbbf24" strokeWidth="1.4" markerEnd="url(#arrowYellow)" />
    <text x={cx} y={cy + 6} textAnchor="middle" fill={color} fontSize="6.5" fontWeight="800" letterSpacing="1">CONVERTER</text>
  </g>
);

const TubularReactor = ({ cx, cy, w = 44, h = 90, color = "#38bdf8" }: { cx: number; cy: number; w?: number; h?: number; color?: string }) => (
  <g>
    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="6" fill="#0f172a" stroke={color} strokeWidth="1.8" />
    {[0, 1, 2, 3, 4].map((i) => (
      <ellipse key={i} cx={cx} cy={cy - h / 2 + 14 + i * 14} rx={w / 2 - 6} ry="5" fill="none" stroke={color} strokeWidth="1.1" opacity="0.7" />
    ))}
    <text x={cx} y={cy + h / 2 - 8} textAnchor="middle" fill={color} fontSize="6" fontWeight="700">BWR</text>
    <text x={cx} y={cy - h / 2 + 8} textAnchor="middle" fill={color} fontSize="5.5" fontWeight="700">CONVERTER</text>
  </g>
);

const KpiBadge = ({ x, y, label, actual, uom, status, onClick }: {
  x: number; y: number; label: string; actual: string; uom: string;
  status: "ON TARGET" | "ACT TODAY" | "WATCH"; onClick: () => void;
}) => {
  const isAlert = status === "ACT TODAY";
  const isWatch = status === "WATCH";
  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      <rect x={x - 46} y={y - 10} width={92} height={20} rx="4"
        fill={isAlert ? "#78350f" : isWatch ? "#1e3a5f" : "#052e16"}
        stroke={isAlert ? "#f59e0b" : isWatch ? "#38bdf8" : "#10b981"} strokeWidth="1" opacity="0.95" />
      <text x={x} y={y + 2} textAnchor="middle"
        fill={isAlert ? "#fbbf24" : isWatch ? "#7dd3fc" : "#34d399"} fontSize="7.5" fontWeight="700">
        {label}: {actual} {uom}
      </text>
      {isAlert && (
        <circle cx={x + 38} cy={y} r="4" fill="#f59e0b" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
};

export const SynthesisPfdCanvas: React.FC<SynthesisPfdCanvasProps> = ({
  reactorType = "quench",
  loopConfig = "single",
  currentKpis = {},
  benchmarkKpis = {},
  onSelectEquipment,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedEq, setSelectedEq] = useState<SynthesisEquipmentHotspot | null>(null);
  const [showMeBalance, setShowMeBalance] = useState<boolean>(true);

  const loopPressure = Number(currentKpis.Loop_Pressure ?? 85.2).toFixed(1);
  const loopPressureOpt = Number(benchmarkKpis.Loop_Pressure ?? 95.4).toFixed(1);
  const mugFlow = Number(currentKpis.MUG_Gas_Molar_Flow ?? 256.7).toFixed(1);
  const mugFlowOpt = Number(benchmarkKpis.MUG_Gas_Molar_Flow ?? 264.1).toFixed(1);
  const recycleFlow = Number(currentKpis.Recycle_Gas_Molar_Flow ?? 1248).toFixed(0);
  const outletTemp = Number(currentKpis.Convertor_Outlet_Temperature ?? 252.4).toFixed(1);
  const outletTempOpt = Number(benchmarkKpis.Convertor_Outlet_Temperature ?? 258.0).toFixed(1);
  const bed1Temp = Number(currentKpis.Convertor_Bed_1_Outlet_Temperature ?? 254.2).toFixed(1);
  const bed1TempOpt = Number(benchmarkKpis.Convertor_Bed_1_Outlet_Temperature ?? 256.5).toFixed(1);
  const cmaFlow = Number(currentKpis.CMA_Flow ?? 108.4).toFixed(1);
  const cmaFlowOpt = Number(benchmarkKpis.CMA_Flow ?? 112.5).toFixed(1);
  const loopPressureAlert = parseFloat(loopPressure) < parseFloat(loopPressureOpt) - 5;

  const equipmentData: SynthesisEquipmentHotspot[] = [
    { id: "MUG_COMP", name: "Make-up Gas Compressor", xPct: 12, yPct: 50, actual: mugFlow, optimum: mugFlowOpt, uom: "Nm3/h", status: "ON TARGET", type: "flow", description: "Two-stage centrifugal compressor boosting reformed syngas to synthesis loop pressure. Critical for maintaining adequate partial pressures across catalyst beds." },
    { id: "FEED_PHX", name: "Feed Gas Preheater", xPct: 26, yPct: 50, actual: "218.0", optimum: "224.5", uom: "degC", status: "ON TARGET", type: "temp", description: "Preheats make-up and recycle syngas against hot reactor effluent before entry to first catalyst bed." },
    { id: "CONVERTER", name: "Methanol Converter", xPct: 45, yPct: 50, actual: outletTemp, optimum: outletTempOpt, uom: "degC", status: "ON TARGET", type: "temp", description: reactorType === "quench" ? "Multi-bed adiabatic quench reactor. Cool syngas injected between beds controls exotherm and extends catalyst life." : "Boiling-water reactor (BWR) with tube bundles immersed in steam-generating shell for isothermal temperature profile." },
    { id: "BED1", name: "Bed 1 Outlet Temperature", xPct: 40, yPct: 28, actual: bed1Temp, optimum: bed1TempOpt, uom: "degC", status: "ON TARGET", type: "temp", description: "Exothermic peak temperature at exit of first catalyst zone. Must remain below 270 degC design limit." },
    { id: "HP_BOILER", name: "HP Steam Boiler", xPct: 50, yPct: 15, actual: "25.1", optimum: "26.4", uom: "MW", status: "ON TARGET", type: "eq", description: "Recovers high-grade heat from reactor effluent to generate high-pressure steam for export to reformer turbines." },
    { id: "LOOP_CIRC", name: "Loop Circulator", xPct: 63, yPct: 50, actual: recycleFlow, optimum: "1280", uom: "Nm3/h", status: "ON TARGET", type: "flow", description: "Turbine-driven circulator maintaining synthesis loop recycle at 4-5:1 ratio." },
    { id: "SEPARATOR", name: "Methanol Separator", xPct: 74, yPct: 63, actual: loopPressure, optimum: loopPressureOpt, uom: "bar g", status: loopPressureAlert ? "ACT TODAY" : "ON TARGET", type: "pressure", description: "High-pressure separator. Loop pressure here is the primary production lever." },
    { id: "PRODUCT_LDT", name: "Crude Methanol Let-Down", xPct: 74, yPct: 80, actual: cmaFlow, optimum: cmaFlowOpt, uom: "t/h", status: "ON TARGET", type: "flow", description: "Flash vessel degassing dissolved syngas from crude methanol before transfer to distillation." },
    { id: "PURGE", name: "Loop Purge Stream", xPct: 80, yPct: 12, actual: "19.5", optimum: "18.0", uom: "t/h", status: "WATCH", type: "flow", description: "Continuous purge preventing inert build-up. Target 4.4 mol% inerts to reduce valuable H2 losses." },
  ];

  const handleEquipClick = (eq: SynthesisEquipmentHotspot) => {
    setSelectedEq(eq);
    if (onSelectEquipment) onSelectEquipment(eq.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const VB_W = 960, VB_H = 380;
  const yMain = 195;
  const xFeed = 30, xMugComp = 100, xPreheater = 210, xReactor = 390;
  const xCirc = 565, xSep = 680, xLdt = 690, xPurge = 750, xProduct = 820;
  const ySteamDrum = 55, ySep = 248, yLdt = 308, yPurge = 45, yRecycleRail = 115;

  return (
    <div className="relative w-full" style={{ height: 490 }}>
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-slate-900/95 border border-slate-700 px-2.5 py-1 rounded-md text-[10px] shadow">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-bold text-white">Methanol Synthesis Loop PFD</span>
        <span className="text-sky-400 font-bold"> {reactorType === "quench" ? "Quench Reactor" : "BWR Tubular"}</span>
        <span className="text-violet-400 font-bold"> {loopConfig === "single" ? "Single Loop" : "Dual Loop"}</span>
        <span className="text-slate-400 border-l border-slate-700 pl-2 ml-1">Scale: {(zoomLevel * 100).toFixed(0)}%</span>
      </div>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-slate-900/95 border border-slate-700 p-1 rounded-md shadow">
        <button
          type="button"
          onClick={() => setShowMeBalance(!showMeBalance)}
          className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition-all border cursor-pointer ${
            showMeBalance 
              ? "bg-emerald-600 text-white border-emerald-500 shadow-xs" 
              : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"
          }`}
          title="Toggle Synthesis Reaction Loop Mass & Energy Balance Overlay"
        >
          M&amp;E Balance ({showMeBalance ? "ON" : "OFF"})
        </button>
        <button type="button" onClick={() => setZoomLevel(p => Math.min(p + 0.2, 3))} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded text-sm cursor-pointer">+</button>
        <button type="button" onClick={() => setZoomLevel(p => Math.max(p - 0.2, 0.5))} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded text-sm cursor-pointer">-</button>
        <button type="button" onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 rounded text-sm cursor-pointer">R</button>
      </div>
      <div className="w-full h-full bg-slate-950 rounded-lg overflow-hidden border border-slate-700/50 shadow-inner"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <div className="w-full h-full"
          style={{ transform: `translate(${panOffset.x}px,${panOffset.y}px) scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.05s ease-out" }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#334155" /></marker>
              <marker id="arrowYellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#fbbf24" /></marker>
              <marker id="arrowCyan" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#38bdf8" /></marker>
              <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#10b981" /></marker>
            </defs>

            {/* M&E Balance Envelope for Synthesis Loop */}
            {showMeBalance && (
              <g className="pointer-events-none transition-all duration-300">
                <rect
                  x="175"
                  y="35"
                  width="610"
                  height="315"
                  rx="10"
                  fill="rgba(16, 185, 129, 0.03)"
                  stroke="#10b981"
                  strokeWidth="1.8"
                  strokeDasharray="6,4"
                />
                <g transform="translate(185, 20)">
                  <rect width="365" height="18" rx="3" fill="#065f46" stroke="#10b981" strokeWidth="1" />
                  <text x="10" y="12.5" fill="#34d399" fontSize="7.8" fontWeight="800" letterSpacing="0.4">
                    SYNTHESIS REACTION LOOP M&amp;E ENVELOPE • CARBON CLOSURE: 99.82% ✓
                  </text>
                </g>
                <g transform="translate(185, 332)">
                  <rect width="385" height="18" rx="3" fill="#0f172a" stroke="#10b981" strokeWidth="0.8" />
                  <text x="10" y="12.5" fill="#a7f3d0" fontSize="7.4" fontWeight="600">
                    Syngas In: 182.4 t/h | Crude MeOH: 117.2 t/h | Purge: 19.5 t/h | Mass Closure: 99.64% ✓
                  </text>
                </g>
              </g>
            )}
            {Array.from({ length: 20 }).map((_, i) => (<line key={`vg${i}`} x1={i * 50} y1="0" x2={i * 50} y2={VB_H} stroke="#1e293b" strokeWidth="0.4" opacity="0.5" />))}
            {Array.from({ length: 8 }).map((_, i) => (<line key={`hg${i}`} x1="0" y1={i * 50} x2={VB_W} y2={i * 50} stroke="#1e293b" strokeWidth="0.4" opacity="0.5" />))}
            {([["COMPRESSION", 105], ["PREHEAT", 210], ["REACTOR", 390], ["RECYCLE", 565], ["SEPARATION", 720]] as [string, number][]).map(([lbl, x]) => (
              <text key={lbl} x={x} y={16} textAnchor="middle" fill="#1e3a5f" fontSize="8" fontWeight="700" letterSpacing="1.5">{lbl}</text>
            ))}
            <text x={10} y={yMain - 10} fill="#64748b" fontSize="7.5" fontWeight="600">FROM REFORMER</text>
            <line x1={xFeed} y1={yMain} x2={xMugComp - 18} y2={yMain} stroke="#38bdf8" strokeWidth="2.5" markerEnd="url(#arrowCyan)" />
            <CompressorSymbol cx={xMugComp} cy={yMain} r={18} color="#38bdf8" />
            <text x={xMugComp} y={yMain + 30} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Make-up</text>
            <text x={xMugComp} y={yMain + 40} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Compressor</text>
            <line x1={xMugComp + 18} y1={yMain} x2={xPreheater - 14} y2={yMain} stroke="#334155" strokeWidth="2" markerEnd="url(#arrowBlue)" />
            <circle cx={xPreheater - 14} cy={yMain} r={4} fill="#334155" stroke="#475569" strokeWidth="1.2" />
            <HxSymbol cx={xPreheater} cy={yMain} r={14} color="#38bdf8" />
            <text x={xPreheater} y={yMain + 22} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Feed</text>
            <text x={xPreheater} y={yMain + 31} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Preheater</text>
            <line x1={xPreheater + 14} y1={yMain} x2={xReactor - 22} y2={yMain} stroke="#334155" strokeWidth="2" markerEnd="url(#arrowBlue)" />
            {reactorType === "quench" ? <QuenchReactor cx={xReactor} cy={yMain - 10} w={44} h={90} color="#38bdf8" /> : <TubularReactor cx={xReactor} cy={yMain - 10} w={44} h={90} color="#38bdf8" />}
            <text x={xReactor} y={yMain + 60} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">{reactorType === "quench" ? "Quench Converter" : "BWR Converter"}</text>
            <text x={xReactor - 52} y={yMain - 44} fill="#f59e0b" fontSize="7" fontWeight="700">Bed 1: {bed1Temp} C</text>
            {loopConfig === "double" && (
              <g opacity="0.72">
                {reactorType === "quench" ? <QuenchReactor cx={xReactor + 68} cy={yMain - 10} w={38} h={80} color="#a78bfa" /> : <TubularReactor cx={xReactor + 68} cy={yMain - 10} w={38} h={80} color="#a78bfa" />}
                <text x={xReactor + 68} y={yMain + 55} textAnchor="middle" fill="#a78bfa" fontSize="7" fontWeight="600">Loop 2</text>
                <line x1={xReactor - 22} y1={yMain} x2={xReactor - 22} y2={yMain - 55} stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="3 2" />
                <line x1={xReactor - 22} y1={yMain - 55} x2={xReactor + 46} y2={yMain - 55} stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrowBlue)" />
              </g>
            )}
            <rect x={xReactor + 40} y={ySteamDrum - 10} width={60} height={20} rx={10} fill="#0f172a" stroke="#a78bfa" strokeWidth="1.5" />
            <text x={xReactor + 70} y={ySteamDrum + 3} textAnchor="middle" fill="#a78bfa" fontSize="6.5" fontWeight="700">HP STEAM BOILER</text>
            <line x1={xReactor + 10} y1={yMain - 55} x2={xReactor + 70} y2={ySteamDrum + 10} stroke="#a78bfa" strokeWidth="1.4" strokeDasharray="4 2" />
            <line x1={xReactor + 70} y1={ySteamDrum - 10} x2={xReactor + 70} y2={22} stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="3 2" markerEnd="url(#arrowBlue)" />
            <text x={xReactor + 80} y={24} fill="#a78bfa" fontSize="6.5" fontWeight="600">STEAM EXPORT</text>
            <line x1={xReactor + 22} y1={yMain} x2={xCirc - 18} y2={yMain} stroke="#334155" strokeWidth="2" markerEnd="url(#arrowBlue)" />
            <CompressorSymbol cx={xCirc} cy={yMain} r={18} color="#38bdf8" />
            <text x={xCirc} y={yMain + 30} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Loop</text>
            <text x={xCirc} y={yMain + 40} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Circulator</text>
            <line x1={xCirc + 18} y1={yMain} x2={xSep} y2={yMain} stroke="#334155" strokeWidth="2" />
            <line x1={xSep} y1={yMain} x2={xSep} y2={ySep - 19} stroke="#334155" strokeWidth="2" markerEnd="url(#arrowBlue)" />
            <VesselSymbol cx={xSep} cy={ySep} w={26} h={38} color={loopPressureAlert ? "#f59e0b" : "#38bdf8"} />
            <text x={xSep} y={ySep + 34} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Methanol</text>
            <text x={xSep} y={ySep + 43} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Separator</text>
            <text x={xSep - 32} y={ySep} fill={loopPressureAlert ? "#f59e0b" : "#38bdf8"} fontSize="7" fontWeight="700">{loopPressure} barg</text>
            <line x1={xSep} y1={ySep - 19} x2={xPurge} y2={ySep - 19} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1={xPurge} y1={ySep - 19} x2={xPurge} y2={yPurge} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrowBlue)" />
            <text x={xPurge + 8} y={ySep - 22} fill="#ef4444" fontSize="7.5" fontWeight="700">PURGE 19.5 t/h</text>
            <line x1={xSep} y1={ySep - 19} x2={xSep} y2={yRecycleRail} stroke="#334155" strokeWidth="1.8" />
            <line x1={xSep} y1={yRecycleRail} x2={xCirc} y2={yRecycleRail} stroke="#334155" strokeWidth="1.8" />
            <line x1={xCirc} y1={yRecycleRail} x2={xCirc} y2={yMain - 18} stroke="#334155" strokeWidth="1.8" markerEnd="url(#arrowBlue)" />
            <text x={(xSep + xCirc) / 2} y={yRecycleRail - 4} textAnchor="middle" fill="#334155" fontSize="7">RECYCLE VAPOR</text>
            <line x1={xPreheater - 14} y1={yMain} x2={xPreheater - 14} y2={yRecycleRail} stroke="#334155" strokeWidth="1.4" strokeDasharray="2 2" />
            <line x1={xPreheater - 14} y1={yRecycleRail} x2={xCirc} y2={yRecycleRail} stroke="#334155" strokeWidth="1.4" strokeDasharray="2 2" />
            <line x1={xSep} y1={ySep + 19} x2={xLdt} y2={yLdt - 12} stroke="#10b981" strokeWidth="1.8" markerEnd="url(#arrowGreen)" />
            <VesselSymbol cx={xLdt} cy={yLdt} w={30} h={24} color="#10b981" />
            <text x={xLdt} y={yLdt + 24} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Let-Down</text>
            <text x={xLdt} y={yLdt + 33} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="600">Tank</text>
            <line x1={xLdt + 15} y1={yLdt} x2={xProduct} y2={yLdt} stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowGreen)" />
            <text x={xProduct + 5} y={yLdt - 4} fill="#10b981" fontSize="7.5" fontWeight="700">CRUDE MeOH - DISTILLATION</text>
            <text x={xProduct + 5} y={yLdt + 8} fill="#34d399" fontSize="7.5" fontWeight="700">{cmaFlow} t/h</text>
            <KpiBadge x={xMugComp} y={yMain - 34} label="MUG Flow" actual={mugFlow} uom="Nm3/h" status="ON TARGET" onClick={() => handleEquipClick(equipmentData[0])} />
            <KpiBadge x={xSep + 52} y={ySep + 10} label="Loop P" actual={loopPressure} uom="barg" status={loopPressureAlert ? "ACT TODAY" : "ON TARGET"} onClick={() => handleEquipClick(equipmentData[6])} />
            <KpiBadge x={xCirc} y={yMain - 34} label="Recycle" actual={recycleFlow} uom="Nm3/h" status="ON TARGET" onClick={() => handleEquipClick(equipmentData[5])} />
            <KpiBadge x={xReactor} y={yMain + 80} label="Outlet T" actual={outletTemp} uom="C" status="ON TARGET" onClick={() => handleEquipClick(equipmentData[2])} />
            <KpiBadge x={xProduct + 20} y={yLdt + 24} label="MeOH" actual={cmaFlow} uom="t/h" status="ON TARGET" onClick={() => handleEquipClick(equipmentData[7])} />
            {loopPressureAlert && (
              <g>
                <rect x={VB_W - 190} y={VB_H - 44} width={180} height={38} rx="4" fill="#78350f" stroke="#f59e0b" strokeWidth="1.3" />
                <text x={VB_W - 100} y={VB_H - 28} textAnchor="middle" fill="#fbbf24" fontSize="7.5" fontWeight="800">ACT TODAY: Loop Pressure</text>
                <text x={VB_W - 100} y={VB_H - 16} textAnchor="middle" fill="#fcd34d" fontSize="7">{loopPressure} barg - Target {loopPressureOpt} barg</text>
              </g>
            )}
            <g transform={`translate(22, ${VB_H - 38})`}>
              <rect x="0" y="0" width="220" height="32" rx="4" fill="#0f172a" stroke="#1e293b" strokeWidth="1" opacity="0.85" />
              <text x="6" y="11" fill="#64748b" fontSize="7" fontWeight="700" letterSpacing="1">LEGEND</text>
              <circle cx="12" cy="22" r="3" fill="#334155" /><text x="18" y="25" fill="#94a3b8" fontSize="7">Process pipe</text>
              <rect x="90" y="19" width="14" height="5" rx="1" fill="#fbbf24" /><text x="108" y="25" fill="#94a3b8" fontSize="7">Quench</text>
              <circle cx="165" cy="22" r="3" fill="#ef4444" /><text x="171" y="25" fill="#94a3b8" fontSize="7">Purge</text>
            </g>
          </svg>
        </div>
      </div>
      {selectedEq && (
        <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedEq(null)}>
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-4 shadow-2xl text-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedEq.status === "ACT TODAY" ? "bg-amber-100 text-amber-800" : selectedEq.status === "WATCH" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{selectedEq.status}</span>
                <h3 className="font-bold text-xs text-slate-900">{selectedEq.name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedEq(null)} className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">{selectedEq.description}</p>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg mb-3">
              <div><span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Current Actual</span><span className="text-sm font-bold text-slate-900 font-mono">{selectedEq.actual} {selectedEq.uom}</span></div>
              <div><span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold block">Optimal Benchmark</span><span className="text-sm font-bold text-emerald-600 font-mono">{selectedEq.optimum} {selectedEq.uom}</span></div>
            </div>
            {selectedEq.status !== "ON TARGET" && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2 rounded-md mb-2"><b>Action Required:</b> Gap detected from benchmark. Review ODS table.</div>
            )}
            <div className="flex justify-end"><button type="button" onClick={() => setSelectedEq(null)} className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
};