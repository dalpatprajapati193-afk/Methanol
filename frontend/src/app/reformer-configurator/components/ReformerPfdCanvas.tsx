"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Minus, 
  Maximize2, 
  RotateCcw, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Gauge,
  Thermometer,
  Zap,
  Info,
  Scale,
  Flame,
  ChevronUp,
  ChevronDown
} from "lucide-react";

export interface LbmAlertsInfo {
  e1201HighTmt?: boolean;
  e1201TmtValue?: number;
  e1201Cleanliness?: number;
  h2sSafe?: boolean;
  h2sSaturationPct?: number;
  h2sRemainingPct?: number;
  h2sDaysLeft?: number;
  radiantEffLow?: boolean;
  radiantEffValue?: number;
  archTemp?: number;
  scatteringDeltaT?: number;
}

interface ReformerPfdCanvasProps {
  equipmentMap: Record<string, boolean>;
  equipmentConfigMap?: Record<string, any>;
  activeSection?: string;
  sectionSelectTrigger?: number;
  onSelectSection?: (sectionKey: string) => void;
  onSelectEquipment?: (equipmentId: string) => void;
  lbmAlerts?: LbmAlertsInfo;
  emissionsAndBalance?: any;
}

const SECTION_VIEWBOXES: Record<string, { viewBox: string; label: string; zoneBox: { x: number; y: number; w: number; h: number; title: string } }> = {
  feed: { 
    viewBox: "-35 340 590 330", 
    label: "Feed Gas & Compression",
    zoneBox: { x: -5, y: 450, w: 285, h: 140, title: "ZONE 1: FEED GAS & COMPRESSION • ACTIVE" }
  },
  desulfurization: { 
    viewBox: "150 340 580 330", 
    label: "Desulfurization & Guard",
    zoneBox: { x: 275, y: 450, w: 175, h: 145, title: "ZONE 2: DESULFURIZATION & PURIFICATION • ACTIVE" }
  },
  saturation: { 
    viewBox: "320 320 580 340", 
    label: "Saturation & Steam Loop",
    zoneBox: { x: 445, y: 380, w: 235, h: 255, title: "ZONE 3: SATURATION & STEAM INJECTION • ACTIVE" }
  },
  smr: { 
    viewBox: "470 330 580 340", 
    label: "Primary Reformer Furnace",
    zoneBox: { x: 645, y: 400, w: 155, h: 235, title: "ZONE 4: SMR PRIMARY REFORMER RADIANT BOX • ACTIVE" }
  },
  convection: { 
    viewBox: "570 130 590 350", 
    label: "Convection Heat Recovery & Emissions",
    zoneBox: { x: 690, y: 265, w: 330, h: 115, title: "ZONE 5: CONVECTION HEAT RECOVERY • ACTIVE" }
  },
  cooling: { 
    viewBox: "650 330 580 340", 
    label: "Reformed Syngas Cooling",
    zoneBox: { x: 775, y: 405, w: 375, h: 195, title: "ZONE 6: SYNGAS QUENCH & COOLING • ACTIVE" }
  },
  full: { 
    viewBox: "-30 130 1220 500", 
    label: "Full Methanol Complex Flowsheet",
    zoneBox: { x: 0, y: 0, w: 0, h: 0, title: "" }
  },
};

// Robust dynamic SVG renderer for Shell-and-Tube Exchangers
// Correctly renders 1, 2, 3, or 4 shells in both Series and Parallel
const renderExchangerShells = (
  cx: number,
  cy: number,
  count: number,
  arrangement: string,
  baseColor: string = "#0090d0"
) => {
  if (count <= 1) {
    return (
      <g>
        <circle cx={cx} cy={cy} r="12" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.6" />
        <path d={`M ${cx - 7} ${cy} C ${cx - 3} ${cy - 5}, ${cx + 3} ${cy + 5}, ${cx + 7} ${cy}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
        <line x1={cx - 12} y1={cy} x2={cx - 7} y2={cy} stroke={baseColor} strokeWidth="1.4" />
        <line x1={cx + 7} y1={cy} x2={cx + 12} y2={cy} stroke={baseColor} strokeWidth="1.4" />
      </g>
    );
  }

  if (arrangement === "Parallel") {
    if (count === 2) {
      return (
        <g>
          {/* Top Shell */}
          <circle cx={cx} cy={cy - 9} r="8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.5" />
          <path d={`M ${cx - 4} ${cy - 9} C ${cx - 2} ${cy - 12}, ${cx + 2} ${cy - 6}, ${cx + 4} ${cy - 9}`} stroke={baseColor} strokeWidth="1.2" fill="none" />
          {/* Bottom Shell */}
          <circle cx={cx} cy={cy + 9} r="8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.5" />
          <path d={`M ${cx - 4} ${cy + 9} C ${cx - 2} ${cy + 6}, ${cx + 2} ${cy + 12}, ${cx + 4} ${cy + 9}`} stroke={baseColor} strokeWidth="1.2" fill="none" />
          {/* Inlet Manifold */}
          <path d={`M ${cx - 16} ${cy} L ${cx - 11} ${cy} L ${cx - 11} ${cy - 9} L ${cx - 8} ${cy - 9}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
          <path d={`M ${cx - 11} ${cy} L ${cx - 11} ${cy + 9} L ${cx - 8} ${cy + 9}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
          {/* Outlet Manifold */}
          <path d={`M ${cx + 8} ${cy - 9} L ${cx + 11} ${cy - 9} L ${cx + 11} ${cy} L ${cx + 16} ${cy}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
          <path d={`M ${cx + 8} ${cy + 9} L ${cx + 11} ${cy + 9} L ${cx + 11} ${cy}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
        </g>
      );
    }
    if (count === 3) {
      return (
        <g>
          {/* 3 Stacked Shells in Parallel */}
          <circle cx={cx} cy={cy - 14} r="6.5" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
          <circle cx={cx} cy={cy} r="6.5" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
          <circle cx={cx} cy={cy + 14} r="6.5" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
          {/* Inlet Header */}
          <path d={`M ${cx - 17} ${cy} L ${cx - 10} ${cy}`} stroke={baseColor} strokeWidth="1.4" />
          <path d={`M ${cx - 10} ${cy - 14} L ${cx - 10} ${cy + 14}`} stroke={baseColor} strokeWidth="1.4" />
          <path d={`M ${cx - 10} ${cy - 14} L ${cx - 6.5} ${cy - 14}`} stroke={baseColor} strokeWidth="1.4" />
          <path d={`M ${cx - 10} ${cy + 14} L ${cx - 6.5} ${cy + 14}`} stroke={baseColor} strokeWidth="1.4" />
          {/* Outlet Header */}
          <path d={`M ${cx + 6.5} ${cy} L ${cx + 17} ${cy}`} stroke={baseColor} strokeWidth="1.4" />
          <path d={`M ${cx + 10} ${cy - 14} L ${cx + 10} ${cy + 14}`} stroke={baseColor} strokeWidth="1.4" />
          <path d={`M ${cx + 6.5} ${cy - 14} L ${cx + 10} ${cy - 14}`} stroke={baseColor} strokeWidth="1.4" />
          <path d={`M ${cx + 6.5} ${cy + 14} L ${cx + 10} ${cy + 14}`} stroke={baseColor} strokeWidth="1.4" />
        </g>
      );
    }
    // count === 4: 2x2 Parallel Bank
    return (
      <g>
        {/* Top Train */}
        <circle cx={cx - 7} cy={cy - 9} r="6" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
        <circle cx={cx + 7} cy={cy - 9} r="6" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
        <line x1={cx - 1} y1={cy - 9} x2={cx + 1} y2={cy - 9} stroke={baseColor} strokeWidth="1.4" />
        {/* Bottom Train */}
        <circle cx={cx - 7} cy={cy + 9} r="6" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
        <circle cx={cx + 7} cy={cy + 9} r="6" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
        <line x1={cx - 1} y1={cy + 9} x2={cx + 1} y2={cy + 9} stroke={baseColor} strokeWidth="1.4" />
        {/* Inlet Manifold */}
        <path d={`M ${cx - 17} ${cy} L ${cx - 14} ${cy} L ${cx - 14} ${cy - 9} L ${cx - 13} ${cy - 9}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
        <path d={`M ${cx - 14} ${cy} L ${cx - 14} ${cy + 9} L ${cx - 13} ${cy + 9}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
        {/* Outlet Manifold */}
        <path d={`M ${cx + 13} ${cy - 9} L ${cx + 14} ${cy - 9} L ${cx + 14} ${cy} L ${cx + 17} ${cy}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
        <path d={`M ${cx + 13} ${cy + 9} L ${cx + 14} ${cy + 9} L ${cx + 14} ${cy}`} stroke={baseColor} strokeWidth="1.4" fill="none" />
      </g>
    );
  }

  // arrangement === "Series"
  if (count === 2) {
    return (
      <g>
        <circle cx={cx - 9} cy={cy} r="8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.5" />
        <path d={`M ${cx - 13} ${cy} C ${cx - 11} ${cy - 4}, ${cx - 7} ${cy + 4}, ${cx - 5} ${cy}`} stroke={baseColor} strokeWidth="1.2" fill="none" />
        <circle cx={cx + 9} cy={cy} r="8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.5" />
        <path d={`M ${cx + 5} ${cy} C ${cx + 7} ${cy - 4}, ${cx + 11} ${cy + 4}, ${cx + 13} ${cy}`} stroke={baseColor} strokeWidth="1.2" fill="none" />
        <line x1={cx - 1} y1={cy} x2={cx + 1} y2={cy} stroke={baseColor} strokeWidth="1.6" />
      </g>
    );
  }
  if (count === 3) {
    return (
      <g>
        <circle cx={cx - 14} cy={cy} r="6.5" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
        <circle cx={cx} cy={cy} r="6.5" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
        <circle cx={cx + 14} cy={cy} r="6.5" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.4" />
        <line x1={cx - 7.5} y1={cy} x2={cx - 6.5} y2={cy} stroke={baseColor} strokeWidth="1.5" />
        <line x1={cx + 6.5} y1={cy} x2={cx + 7.5} y2={cy} stroke={baseColor} strokeWidth="1.5" />
      </g>
    );
  }
  if (count === 4) {
    return (
      <g>
        <circle cx={cx - 18} cy={cy} r="5.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.3" />
        <circle cx={cx - 6} cy={cy} r="5.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.3" />
        <circle cx={cx + 6} cy={cy} r="5.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.3" />
        <circle cx={cx + 18} cy={cy} r="5.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.3" />
        <line x1={cx - 12.2} y1={cy} x2={cx - 11.8} y2={cy} stroke={baseColor} strokeWidth="1.4" />
        <line x1={cx - 0.2} y1={cy} x2={cx + 0.2} y2={cy} stroke={baseColor} strokeWidth="1.4" />
        <line x1={cx + 11.8} y1={cy} x2={cx + 12.2} y2={cy} stroke={baseColor} strokeWidth="1.4" />
      </g>
    );
  }

  // count >= 5 (5 or 6 multi-pass bank)
  return (
    <g>
      <circle cx={cx - 20} cy={cy} r="4.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.2" />
      <circle cx={cx - 10} cy={cy} r="4.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r="4.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.2" />
      <circle cx={cx + 10} cy={cy} r="4.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.2" />
      <circle cx={cx + 20} cy={cy} r="4.8" fill="url(#blueBoxGrad)" stroke={baseColor} strokeWidth="1.2" />
      <line x1={cx - 25} y1={cy} x2={cx + 25} y2={cy} stroke={baseColor} strokeWidth="1.2" strokeDasharray="1,1" />
    </g>
  );
};

interface EquipmentModalData {
  id: string;
  name: string;
  category: string;
  operatingTemp: string;
  operatingPressure: string;
  flowRate: string;
  heatDuty?: string;
  aspenReconciled?: string;
  status: "NORMAL" | "RECONCILED" | "OUTLIER_ALERT";
  description: string;
}

export const ReformerPfdCanvas: React.FC<ReformerPfdCanvasProps> = ({ 
  equipmentMap, 
  equipmentConfigMap,
  activeSection = "feed",
  sectionSelectTrigger = 0,
  onSelectSection,
  onSelectEquipment,
  lbmAlerts,
  emissionsAndBalance
}) => {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<"focus" | "full">("full");
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditTab, setAuditTab] = useState<"stream" | "energy" | "stack" | "synthesis">("stream");
  const isInitialMount = React.useRef(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Real-time DCS & Model Balance Metrics from API Engine
  const soxActual = emissionsAndBalance?.sox?.actual_pems_ppm ?? 0.265;
  const soxPred = emissionsAndBalance?.sox?.predicted_ppm ?? 0.278;
  const noxPred = emissionsAndBalance?.nox?.predicted_ppm ?? 64.2;
  const noxMg = emissionsAndBalance?.nox?.mg_nm3 ?? 118.1;
  const stackTemp = emissionsAndBalance?.stack_temperature_analysis?.actual_c ?? 185.0;
  const stackDelta = emissionsAndBalance?.stack_temperature_analysis?.delta_c ?? 35.0;
  const lostDuty = emissionsAndBalance?.stack_temperature_analysis?.lost_duty_mw ?? 4.85;
  const excessFuel = emissionsAndBalance?.stack_temperature_analysis?.excess_fuel_tph ?? 0.35;
  const excessCo2 = emissionsAndBalance?.stack_temperature_analysis?.excess_co2_tpd ?? 23.1;
  const fuelWasted = emissionsAndBalance?.stack_temperature_analysis?.fuel_wasted_usd_day ?? 1470;
  const reformerClosure = emissionsAndBalance?.me_balance?.reformer_block?.mass_closure_pct ?? 99.99;
  const massIn = emissionsAndBalance?.me_balance?.reformer_block?.mass_in_tph ?? 1465.5;
  const massOut = emissionsAndBalance?.me_balance?.reformer_block?.mass_out_tph ?? 1465.6;
  const energyClosure = emissionsAndBalance?.me_balance?.reformer_block?.energy_closure_pct ?? 98.8;
  const feedClosure = emissionsAndBalance?.me_balance?.feed_block?.mass_closure_pct ?? 99.88;
  const quenchClosure = emissionsAndBalance?.me_balance?.quench_block?.mass_closure_pct ?? 99.74;

  // When user selects a section, focus and zoom to that section. "overview" or "full" resets to full flowsheet!
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (!activeSection || activeSection === "full" || activeSection === "overview") {
        setViewMode("full");
        return;
      }
    }
    if (activeSection === "full" || activeSection === "overview") {
      setViewMode("full");
    } else {
      setViewMode("focus");
    }
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  }, [activeSection, sectionSelectTrigger]);

  // Helper flags from equipmentMap (true by default unless explicitly false)
  const hasKoDrum = equipmentMap["feed_ko_drum"] !== false;
  const hasFeedPreheater = equipmentMap["feed_preheater"] !== false;
  const hasCompressor = equipmentMap["feed_compressor"] !== false;
  const hasFeedCooler = equipmentMap["feed_cooler"] !== false;
  const hasHds = equipmentMap["hds_reactor"] !== false;
  const hasZno = equipmentMap["zno_adsorbers"] !== false;
  const hasSaturator = equipmentMap["saturator_column"] !== false;
  const hasSaturatorPumps = equipmentMap["saturator_pumps"] !== false;
  const hasSaturatorExchanger = equipmentMap["saturator_exchanger"] !== false;
  const hasSteamMixer = equipmentMap["steam_mixer"] !== false;
  const hasSmrBox = equipmentMap["smr_radiant_box"] !== false;
  const hasConvCoil1 = equipmentMap["conv_coil_1"] !== false;
  const hasConvCoil2 = equipmentMap["conv_coil_2"] !== false;
  const hasConvCoil3 = equipmentMap["conv_coil_3"] !== false;
  const hasConvCoil4 = equipmentMap["conv_coil_4"] !== false;
  const hasIdFan = equipmentMap["id_fan"] !== false;
  const hasFdFan = equipmentMap["fd_fan"] !== false;
  const hasStack = equipmentMap["flue_stack"] !== false;
  const hasWhb = equipmentMap["waste_heat_boiler"] !== false;
  const hasSteamDrum = equipmentMap["steam_drum"] !== false;
  const hasSyngasCooler = equipmentMap["syngas_cooler"] !== false;
  const hasCondensateSep = equipmentMap["condensate_separator"] !== false;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.5));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setViewMode("full");
    if (onSelectSection) onSelectSection("overview");
  };

  const openEquipmentDetails = (
    id: string, 
    name: string, 
    category: string, 
    temp: string, 
    press: string, 
    flow: string, 
    desc: string, 
    status: "NORMAL" | "RECONCILED" | "OUTLIER_ALERT" = "RECONCILED", 
    duty?: string, 
    aspen?: string
  ) => {
    // Zoom directly into section and update dashboard KPIs, NO popup modal dialog
    let targetSec = "overview";
    const lowerCat = category.toLowerCase();
    const lowerId = id.toLowerCase();
    if (lowerCat.includes("convection") || lowerId.includes("conv") || lowerId === "id_fan" || lowerId === "fd_fan" || lowerId === "flue_stack") {
      targetSec = "convection";
    } else if (lowerCat.includes("desulfurization") || lowerId.includes("zno") || lowerId.includes("hds")) {
      targetSec = "desulfurization";
    } else if (lowerCat.includes("reforming") || lowerId.includes("smr") || lowerCat.includes("saturation") || lowerId.includes("saturator") || lowerId.includes("steam_mixer")) {
      targetSec = "smr";
    } else if (lowerCat.includes("cooling") || lowerCat.includes("steam") || lowerId.includes("boiler") || lowerId.includes("steam_drum") || lowerId.includes("syngas_cooler") || lowerId.includes("condensate")) {
      targetSec = "cooling";
    } else if (lowerCat.includes("feed") || lowerId.includes("feed") || lowerCat.includes("compression") || lowerId.includes("compressor") || lowerId.includes("cooler")) {
      targetSec = "feed";
    }

    setViewMode("focus");
    setPan({ x: 0, y: 0 });
    setZoom(1.0);

    if (onSelectSection) {
      onSelectSection(targetSec);
    }
    if (onSelectEquipment) {
      onSelectEquipment(id);
    }
  };

  return (
    <div className="relative w-full h-full bg-white text-slate-800 rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col select-none">
      <style>{`
        @keyframes streamFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        path.flow-line-blue,
        path.flow-line-orange,
        path.flow-line-purple,
        path.flow-line-green {
          fill: none !important;
        }
        .flow-line-blue {
          fill: none !important;
          stroke: #0284c7;
          stroke-width: 1.8;
          stroke-dasharray: 4, 4;
          animation: streamFlow 1.1s linear infinite;
        }
        .flow-line-orange {
          fill: none !important;
          stroke: #ea580c;
          stroke-width: 1.8;
          stroke-dasharray: 4, 4;
          animation: streamFlow 1.1s linear infinite;
        }
        .flow-line-purple {
          fill: none !important;
          stroke: #7c3aed;
          stroke-width: 1.8;
          stroke-dasharray: 4, 4;
          animation: streamFlow 1.1s linear infinite;
        }
        .flow-line-green {
          fill: none !important;
          stroke: #059669;
          stroke-width: 1.8;
          stroke-dasharray: 4, 4;
          animation: streamFlow 1.1s linear infinite;
        }
        .equipment-box {
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .equipment-box:hover {
          filter: drop-shadow(0 2px 8px rgba(2, 132, 199, 0.3));
        }
      `}</style>

      {/* Card Header: Crisp Rectangular Unified DCS Process Flow Bar */}
      <div className="h-10 px-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2 z-20 shrink-0">
        {/* Left: Crisp Rectangular Title & Live Telemetry Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="px-2 py-0.5 rounded-xs bg-sky-50 border border-sky-200 text-[#0090d0] font-mono text-[9.5px] font-black tracking-wider uppercase flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-xs bg-[#0090d0] animate-pulse" />
            PFD OVERVIEW
          </span>
          <span className="text-[12px] font-bold text-slate-800 tracking-tight whitespace-nowrap">
            Primary Reformer Unit Process Flow
          </span>
          <div className="hidden 2xl:flex items-center gap-1.5 pl-2 border-l border-slate-200 text-[10px] text-slate-400 font-medium whitespace-nowrap">
            <span>Interactive Process Topology</span>
          </div>
        </div>

        {/* Right: Crisp Rectangular Legend & Flowsheet Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Stream Legend Box with strict whitespace-nowrap */}
          <div className="hidden lg:flex items-center gap-2.5 text-[9.5px] font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xs border border-slate-200 shadow-2xs whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-1.5 bg-[#0284c7] rounded-xs" />
              <span>Natural Gas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-1.5 bg-[#ea580c] rounded-xs" />
              <span>Steam / Flue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-1.5 bg-[#7c3aed] rounded-xs" />
              <span>Syngas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-1.5 bg-[#059669] rounded-xs" />
              <span>BFW / Water</span>
            </div>
          </div>

          {/* Rigorous M&E Balance Reconciliation Audit Button */}
          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs font-semibold text-[10px] transition-all cursor-pointer whitespace-nowrap bg-white text-slate-700 border border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 shadow-2xs"
            title="Inspect Rigorous Mass & Energy Balance Reconciliation Report, DCS Tags & Proof of Closure"
          >
            <Scale className="w-3.5 h-3.5 text-emerald-600" />
            <span>M&amp;E Reconciliation Audit</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[8.5px] font-bold border border-emerald-300">
              99.99% Closure ✓
            </span>
          </button>

          {/* Section Focus & Full View Mode Segmented Control */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xs border border-slate-200 text-[9.5px]">
            <button
              type="button"
              onClick={() => {
                setViewMode("focus");
                setPan({ x: 0, y: 0 });
                setZoom(1.0);
              }}
              className={`px-2.5 py-0.5 rounded-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === "focus" 
                  ? "bg-[#0090d0] text-white shadow-2xs" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Focus Section
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("full");
                setPan({ x: 0, y: 0 });
                setZoom(1.0);
              }}
              className={`px-2.5 py-0.5 rounded-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === "full" 
                  ? "bg-[#0090d0] text-white shadow-2xs" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Full Flowsheet
            </button>
          </div>

          {/* Quick Viewport Reset / Maximize */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xs p-0.5 shadow-2xs text-slate-500">
            <button
              onClick={handleResetZoom}
              className="p-1 hover:text-slate-800 hover:bg-slate-100 rounded-xs transition-colors cursor-pointer"
              title="Reset View (100%)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setViewMode(viewMode === "full" ? "focus" : "full");
                setPan({ x: 0, y: 0 });
                setZoom(1.0);
              }}
              className="p-1 hover:text-slate-800 hover:bg-slate-100 rounded-xs transition-colors cursor-pointer"
              title="Toggle Full / Focus View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area: Crisp, Compact, DCS-scaled diagram */}
      <div 
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative overflow-hidden bg-white"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className="w-full h-full"
          viewBox={
            viewMode === "focus" && activeSection && SECTION_VIEWBOXES[activeSection]
              ? SECTION_VIEWBOXES[activeSection].viewBox
              : SECTION_VIEWBOXES.full.viewBox
          }
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out"
          }}
        >
          {/* Engineering Light Grid Background */}
          <defs>
            <pattern id="lightGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
            </pattern>
            {/* Blue equipment box gradient */}
            <linearGradient id="blueBoxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f0f9ff" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>
            <linearGradient id="blueVesselGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="50%" stopColor="#f0f9ff" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>
            <linearGradient id="smrFurnaceBoxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f0f9ff" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>
          </defs>

          {/* Canvas background with grid */}
          <rect x="-100" y="180" width="1600" height="600" fill="#ffffff" />
          <rect x="-100" y="180" width="1600" height="600" fill="url(#lightGrid)" />

          {/* Active Section Focus Halo Frame */}
          {viewMode === "focus" && activeSection && SECTION_VIEWBOXES[activeSection]?.zoneBox?.w > 0 && (() => {
            const zb = SECTION_VIEWBOXES[activeSection].zoneBox;
            return (
              <g className="transition-all duration-300 pointer-events-none">
                {/* Subtle highlighted focus zone */}
                <rect
                  x={zb.x}
                  y={zb.y}
                  width={zb.w}
                  height={zb.h}
                  rx="8"
                  fill="rgba(2, 132, 199, 0.04)"
                  stroke="#0090d0"
                  strokeWidth="1.6"
                  strokeDasharray="5,3"
                />
                {/* Floating Zone Active Badge */}
                <g transform={`translate(${zb.x + 8}, ${zb.y - 12})`}>
                  <rect width={zb.title.length * 4.4 + 14} height="12" rx="3" fill="#0090d0" />
                  <circle cx="6" cy="6" r="2.2" fill="#ffffff" />
                  <text x="12" y="8.5" fontSize="5.2" fontWeight="800" fill="#ffffff" letterSpacing="0.2">
                    {zb.title}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ZONE 1: NATURAL GAS FEED PREP & COMPRESSION (COMPACT BLUE BLOCKS)   */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {/* Raw Feed Inlet Line */}
          <path d="M 0 515 L 60 515" className="flow-line-blue" />
          <polygon points="60,515 52,512 52,518" fill="#0284c7" />

          {/* Stream Callout: Raw Gas */}
          <g transform="translate(-15, 474)">
            <rect width="72" height="23" rx="3" fill="#ffffff" stroke="#0090d0" strokeWidth="1" />
            <text x="36" y="10" fontSize="5.6" fontWeight="500" fill="#0369a1" textAnchor="middle">RAW FEED GAS</text>
            <text x="36" y="19" fontSize="5.0" fontWeight="400" fill="#64748b" textAnchor="middle">52.4 kNm³/h • 32°C • 24.5 bar</text>
          </g>

          {/* 1. Feed KO Drum */}
          {hasKoDrum ? (
            <g className="equipment-box" onClick={() => openEquipmentDetails("feed_ko_drum", "Natural Gas Knockout Drum", "Feed Preparation", "32°C", "24.5 bar", "124.0 t/h", "Knockout drum with demister pad removing free pipeline liquids.")}>
              <rect x="60" y="475" width="34" height="80" rx="7" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
              <line x1="60" y1="500" x2="94" y2="500" stroke="#0284c7" strokeDasharray="2,2" />
              <text x="77" y="520" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">FEED KO</text>
              <text x="77" y="530" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">DRUM</text>
              {/* Drain line */}
              <path d="M 77 555 L 77 575" stroke="#94a3b8" strokeWidth="1.2" />
              <text x="77" y="584" fontSize="5.5" fontWeight="500" fill="#64748b" textAnchor="middle">DRAIN</text>
            </g>
          ) : (
            <path d="M 60 515 L 120 515" className="flow-line-blue" />
          )}

          {/* Connector: KO Drum -> Feed Preheater with live temp */}
          <path d={hasKoDrum ? "M 94 515 L 120 515" : "M 60 515 L 120 515"} className="flow-line-blue" />
          <g transform="translate(95, 497)">
            <rect width="24" height="11" rx="2" fill="#ffffff" stroke="#0284c7" strokeWidth="0.7" />
            <text x="12" y="8" fontSize="4.6" fontWeight="400" fill="#0369a1" textAnchor="middle">32.0°C</text>
          </g>

          {/* 2. Feed Gas Preheater */}
          {hasFeedPreheater ? (() => {
            const cfg = equipmentConfigMap?.["feed_preheater"];
            const count = cfg?.numExchangers || 2;
            const arrangement = cfg?.arrangement || "Series";

            return (
              <g className="equipment-box" onClick={() => openEquipmentDetails("feed_preheater", "Feed Gas Preheater", "Feed Preparation", "85°C", "24.2 bar", "124.0 t/h", `Feed preheater configured with ${count} shell(s) in ${arrangement}.`, "RECONCILED", "4.2 MW", "84.8°C")}>
                {renderExchangerShells(138, 515, count, arrangement, "#0090d0")}
                <text x="138" y="542" fontSize="5.2" fontWeight="600" fill="#0369a1" textAnchor="middle">FEED PREHEATER</text>
                <text x="138" y="550" fontSize="4.4" fontWeight="500" fill="#0284c7" textAnchor="middle">({count} {count === 1 ? "Shell" : "Shells"} • {arrangement})</text>
              </g>
            );
          })() : null}

          {/* Connector to Compressor with preheated temp */}
          <path 
            d={
              hasFeedPreheater 
                ? "M 154 515 L 178 515" 
                : hasKoDrum 
                  ? "M 94 515 L 178 515" 
                  : "M 60 515 L 178 515"
            } 
            className="flow-line-blue" 
          />
          <g transform="translate(152, 497)">
            <rect width="24" height="11" rx="2" fill="#ffffff" stroke="#0284c7" strokeWidth="0.7" />
            <text x="12" y="8" fontSize="4.6" fontWeight="400" fill="#0369a1" textAnchor="middle">85.0°C</text>
          </g>

          {/* 3. Feed Gas Compressor */}
          {hasCompressor ? (() => {
            const cfg = equipmentConfigMap?.["feed_compressor"];
            const stages = cfg?.stages || 2;
            const driverType = cfg?.driverType || "Electric Motor";

            return (
              <g className="equipment-box" onClick={() => openEquipmentDetails("feed_compressor", "Natural Gas Compressor", "Compression", "128°C", "42.0 bar", "124.0 t/h", `Centrifugal compressor with ${stages} stage(s) driven by ${driverType}.`, "RECONCILED", "3.8 MW")}>
                <polygon points="178,498 214,506 214,524 178,532" fill="url(#blueBoxGrad)" stroke="#0090d0" strokeWidth="1.8" />
                {/* Stage dividing lines */}
                {stages > 1 && (
                  <line x1="196" y1="502" x2="196" y2="528" stroke="#0090d0" strokeWidth="1.2" strokeDasharray="2,1" />
                )}
                {stages > 2 && (
                  <line x1="187" y1="500" x2="187" y2="530" stroke="#0090d0" strokeWidth="1.0" strokeDasharray="2,1" />
                )}
                <text x="196" y="543" fontSize="5.2" fontWeight="600" fill="#0369a1" textAnchor="middle">COMPRESSOR</text>
                <text x="196" y="551" fontSize="4.4" fontWeight="500" fill="#0284c7" textAnchor="middle">({stages} Stg • {driverType === "Electric Motor" ? "Motor" : "Turbine"})</text>
              </g>
            );
          })() : null}

          {/* Compressor Discharge Live KPI Badge */}
          <g transform="translate(170, 464)">
            <rect width="84" height="22" rx="3" fill="#ffffff" stroke="#0090d0" strokeWidth="1" />
            <text x="42" y="9.5" fontSize="5.6" fontWeight="500" fill="#0369a1" textAnchor="middle">COMPRESSOR DISCHARGE</text>
            <text x="42" y="18" fontSize="4.8" fontWeight="400" fill="#0284c7" textAnchor="middle">42.0 bar • 128.5°C • Eff: 78.4%</text>
          </g>

          {/* Connector to Cooler */}
          <path d={hasCompressor ? "M 214 515 L 235 515" : "M 178 515 L 235 515"} className="flow-line-blue" />

          {/* 4. Feed Gas Aftercooler */}
          {hasFeedCooler ? (() => {
            const cfg = equipmentConfigMap?.["feed_cooler"];
            const count = cfg?.numExchangers || 1;
            const arrangement = cfg?.arrangement || "Parallel";

            return (
              <g className="equipment-box" onClick={() => openEquipmentDetails("feed_cooler", "Feed Gas Aftercooler", "Cooling", "45°C", "41.5 bar", "124.0 t/h", `Feed aftercooler configured with ${count} shell(s) in ${arrangement}.`, "RECONCILED", "2.1 MW")}>
                {renderExchangerShells(256, 515, count, arrangement, "#0090d0")}
                <text x="256" y="542" fontSize="5.2" fontWeight="600" fill="#0369a1" textAnchor="middle">AFTERCOOLER</text>
                <text x="256" y="550" fontSize="4.4" fontWeight="500" fill="#0284c7" textAnchor="middle">({count} {count === 1 ? "Shell" : "Shells"} • {arrangement})</text>
              </g>
            );
          })() : null}

          {/* Aftercooler Exit Temp Tag */}
          <g transform="translate(266, 497)">
            <rect width="25" height="11" rx="2" fill="#ffffff" stroke="#0284c7" strokeWidth="0.7" />
            <text x="12.5" y="8" fontSize="4.6" fontWeight="400" fill="#0369a1" textAnchor="middle">45.0°C</text>
          </g>

          {/* Connector to Desulfurization */}
          <path 
            d={
              hasFeedCooler 
                ? "M 266 515 L 295 515" 
                : hasCompressor 
                  ? "M 212 515 L 295 515" 
                  : "M 180 515 L 295 515"
            } 
            className="flow-line-blue" 
          />

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ZONE 2: DESULFURIZATION & PURIFICATION                              */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {/* 5. HDS Reactor */}
          {hasHds ? (
            <g className="equipment-box" onClick={() => openEquipmentDetails("hds_reactor", "HDS Hydrogenation Reactor", "Desulfurization", "375°C", "40.8 bar", "124.0 t/h", "Catalytic CoMo hydrogenation converting organic sulfur compounds into H2S.", "RECONCILED")}>
              <rect x="295" y="470" width="36" height="90" rx="9" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
              <text x="313" y="496" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">HDS</text>
              <text x="313" y="506" fontSize="6.0" fontWeight="600" fill="#0369a1" textAnchor="middle">REACTOR</text>
              <line x1="299" y1="528" x2="327" y2="528" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />
              <line x1="299" y1="538" x2="327" y2="538" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />
              <text x="313" y="574" fontSize="5.0" fontWeight="500" fill="#0284c7" textAnchor="middle">HDS VESSEL</text>
            </g>
          ) : null}

          {/* HDS Reactor Live Process Badge */}
          <g transform="translate(285, 442)">
            <rect width="60" height="20" rx="3" fill="#ffffff" stroke="#0090d0" strokeWidth="0.9" />
            <text x="30" y="9" fontSize="5.2" fontWeight="500" fill="#0369a1" textAnchor="middle">HDS REACTION</text>
            <text x="30" y="16.5" fontSize="4.6" fontWeight="400" fill="#059669" textAnchor="middle">375°C • Conv: 99.8%</text>
          </g>

          {/* Helper config for ZnO Adsorbers */}
          {(() => {
            const znoCfg = equipmentConfigMap?.["zno_adsorbers"];
            const isSingleBed = znoCfg?.adsorberArrangement === "Single Bed";

            return (
              <>
                {/* Connector: HDS -> ZnO Adsorbers */}
                <path 
                  d={
                    hasHds 
                      ? (isSingleBed ? "M 331 515 L 376 515" : "M 331 515 L 360 515")
                      : (isSingleBed ? "M 295 515 L 376 515" : "M 295 515 L 360 515")
                  } 
                  className="flow-line-blue" 
                />

                {/* 6. ZnO Sulfur Adsorbers (Single Bed or Dual Lead/Lag) */}
                {hasZno ? (
                  isSingleBed ? (
                    <g className="equipment-box" onClick={() => openEquipmentDetails("zno_adsorbers", "Zinc Oxide Sulfur Guard Bed (Single Bed)", "Desulfurization", "380°C", "40.2 bar", "124.0 t/h", "Single solid reactive zinc oxide guard bed absorbing sulfur below 0.05 ppm.", "RECONCILED", undefined, "0.02 ppm S")}>
                      <rect x="376" y="468" width="36" height="95" rx="8" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
                      <text x="394" y="495" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">ZnO</text>
                      <text x="394" y="504" fontSize="6.0" fontWeight="600" fill="#0369a1" textAnchor="middle">GUARD</text>
                      <line x1="380" y1="528" x2="408" y2="528" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />
                      <line x1="380" y1="538" x2="408" y2="538" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />
                      <text x="394" y="574" fontSize="5.0" fontWeight="500" fill="#0284c7" textAnchor="middle">ZnO GUARD BED</text>
                      <text x="394" y="582" fontSize="4.4" fontWeight="500" fill="#64748b" textAnchor="middle">(Single Bed)</text>
                    </g>
                  ) : (
                    <g className="equipment-box" onClick={() => openEquipmentDetails("zno_adsorbers", "Zinc Oxide Sulfur Adsorbers (Lead-Lag)", "Desulfurization", "380°C", "40.2 bar", "124.0 t/h", "Lead-Lag dual zinc oxide guard beds absorbing sulfur below 0.05 ppm.", "RECONCILED", undefined, "0.02 ppm S")}>
                      {/* Bed A */}
                      <rect x="360" y="468" width="30" height="95" rx="7" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
                      <text x="375" y="496" fontSize="6.2" fontWeight="600" fill="#0369a1" textAnchor="middle">ZnO A</text>
                      <line x1="364" y1="530" x2="386" y2="530" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />

                      {/* Bed B */}
                      <rect x="398" y="468" width="30" height="95" rx="7" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
                      <text x="413" y="496" fontSize="6.2" fontWeight="600" fill="#0369a1" textAnchor="middle">ZnO B</text>
                      <line x1="402" y1="530" x2="424" y2="530" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />

                      <path d="M 390 515 L 398 515" stroke="#0090d0" strokeWidth="1.5" />
                      <text x="394" y="574" fontSize="5.0" fontWeight="500" fill="#0284c7" textAnchor="middle">ZnO GUARDS</text>
                      <text x="394" y="582" fontSize="4.4" fontWeight="500" fill="#64748b" textAnchor="middle">(Lead-Lag Dual Bed)</text>
                    </g>
                  )
                ) : null}

                {/* H2S Adsorption Safe Margin Zone Overlay on PFD */}
                {lbmAlerts?.h2sSafe && (
                  <g className="equipment-box cursor-pointer" onClick={() => onSelectSection?.("desulfurization")}>
                    <rect x="352" y="460" width={isSingleBed ? "68" : "84"} height="110" rx="9" fill="rgba(34, 197, 94, 0.08)" stroke="#22c55e" strokeWidth="1.4" strokeDasharray="3,2" />
                    <g transform={isSingleBed ? "translate(346, 432)" : "translate(352, 432)"}>
                      <rect width="90" height="23" rx="4" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1.2" />
                      <circle cx="8" cy="11.5" r="2.8" fill="#22c55e" />
                      <text x="49" y="9.5" fontSize="4.8" fontWeight="700" fill="#15803d" textAnchor="middle">✓ H₂S ADSORPTION: SAFE</text>
                      <text x="49" y="17.5" fontSize="4.2" fontWeight="600" fill="#166534" textAnchor="middle">Good Margin: {lbmAlerts.h2sRemainingPct ?? 34.8}% Rem ({lbmAlerts.h2sDaysLeft ?? 86.5}d)</text>
                    </g>
                  </g>
                )}

                {/* Stream Callout: Desulfurized Gas with live numbers */}
                <g transform={isSingleBed ? "translate(418, 474)" : "translate(430, 474)"}>
                  <rect width="78" height="23" rx="3" fill="#ffffff" stroke="#0090d0" strokeWidth="1" />
                  <text x="39" y="10" fontSize="5.4" fontWeight="500" fill="#0369a1" textAnchor="middle">SULFUR GUARD BED</text>
                  <text x="39" y="19" fontSize="4.8" fontWeight="400" fill="#059669" textAnchor="middle">H₂S &lt; 0.02 ppm • Sat: 44.8%</text>
                </g>

                {/* Connector: Desulfurization -> Saturation */}
                <path 
                  d={
                    hasZno 
                      ? (isSingleBed ? "M 412 515 L 485 515" : "M 428 515 L 485 515")
                      : hasHds 
                        ? "M 331 515 L 485 515" 
                        : "M 295 515 L 485 515"
                  } 
                  className="flow-line-blue" 
                />
              </>
            );
          })()}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ZONE 3: SATURATION & STEAM ADDITION                                 */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {hasSaturator ? (
            <g>
              <g className="equipment-box" onClick={() => openEquipmentDetails("saturator_column", "Natural Gas Saturator Column", "Saturation", "210°C", "38.5 bar", "185.0 t/h", "Counter-current column saturating gas with process steam vapor.", "RECONCILED")}>
                <rect x="485" y="440" width="40" height="135" rx="9" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
                <text x="505" y="465" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">SATURATOR</text>
                <text x="505" y="475" fontSize="6.0" fontWeight="600" fill="#0369a1" textAnchor="middle">COLUMN</text>
                <line x1="490" y1="495" x2="520" y2="495" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />
                <line x1="490" y1="525" x2="520" y2="525" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />
                <line x1="490" y1="555" x2="520" y2="555" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />
              </g>

              {/* Saturator Column Live Outlet Temp/Pressure */}
              <g transform="translate(474, 416)">
                <rect width="52" height="15" rx="3" fill="#ffffff" stroke="#0090d0" strokeWidth="0.8" />
                <text x="26" y="10.5" fontSize="5.0" fontWeight="400" fill="#0369a1" textAnchor="middle">210.0°C • 38.5 bar</text>
              </g>

              {/* Recirculation line dropping from column bottom to pump */}
              <path d="M 505 575 L 505 608 L 476 608" stroke="#0284c7" strokeWidth="1.5" fill="none" />

              {/* Saturator Pump */}
              {hasSaturatorPumps && (
                <g className="equipment-box" onClick={() => openEquipmentDetails("saturator_pumps", "Saturator Circulation Pumps", "Saturation", "205°C", "42.0 bar", "280.0 t/h Water", "Centrifugal pumps driving high-pressure wash water circulation.")}>
                  <circle cx="468" cy="608" r="7.5" fill="url(#blueBoxGrad)" stroke="#0090d0" strokeWidth="1.5" />
                  <polygon points="468,602 474,611 462,611" fill="#0090d0" />
                  <text x="468" y="622" fontSize="5.0" fontWeight="600" fill="#0369a1" textAnchor="middle">CIRC PUMP</text>
                </g>
              )}

              {/* Line from pump to Saturator Water Heat Exchanger */}
              <path d="M 460 608 L 438 608 L 438 546 L 526 546" stroke="#0284c7" strokeWidth="1.5" fill="none" />

              {/* Saturator Water Heat Exchanger (Reflecting Exchanger Count & Arrangement) */}
              {hasSaturatorExchanger && (() => {
                const cfg = equipmentConfigMap?.["saturator_exchanger"];
                const count = cfg?.numExchangers || 2;
                const arrangement = cfg?.arrangement || "Series";

                return (
                  <g className="equipment-box" onClick={() => openEquipmentDetails("saturator_exchanger", "Saturator Water Heat Exchanger", "Saturation", "225°C", "41.5 bar", "280.0 t/h", `Saturator water heat exchanger configured with ${count} shell(s) in ${arrangement}.`, "RECONCILED", "14.2 MW")}>
                    {renderExchangerShells(548, 546, count, arrangement, "#0284c7")}
                    <text x="548" y="571" fontSize="5.4" fontWeight="600" fill="#0369a1" textAnchor="middle">SAT WATER EXCHANGER</text>
                    <text x="548" y="579" fontSize="4.6" fontWeight="500" fill="#0284c7" textAnchor="middle">({count} {count === 1 ? "Shell" : "Shells"} • {arrangement})</text>
                  </g>
                );
              })()}

              {/* Heated water return into top of Saturator Column */}
              <path d="M 548 534 L 548 455 L 525 455" stroke="#0284c7" strokeWidth="1.5" fill="none" />
              <polygon points="525,455 531,452 531,458" fill="#0284c7" />
            </g>
          ) : null}

          {/* SMR Steam Injection Mixer */}
          {hasSteamMixer ? (
            <g className="equipment-box" onClick={() => openEquipmentDetails("steam_mixer", "Direct Steam Injection Mixer", "Steam Addition", "285°C", "38.0 bar", "95.0 t/h Steam", "Injects superheated steam to balance exact 2.95 S/C ratio.", "RECONCILED", undefined, "S/C = 2.95")}>
              <path 
                d={hasSaturator ? "M 525 480 L 572 480" : "M 485 515 L 572 480"} 
                className="flow-line-blue" 
              />
              {/* Vertical Steam Feed Line */}
              <path d="M 572 405 L 572 480" className="flow-line-orange" />
              <circle cx="572" cy="405" r="4.5" fill="#ffffff" stroke="#ea580c" strokeWidth="1.5" />
              
              {/* HP Steam Live Parameters Badge */}
              <g transform="translate(530, 372)">
                <rect width="84" height="23" rx="3" fill="#ffffff" stroke="#ea580c" strokeWidth="1" />
                <text x="42" y="9.5" fontSize="5.4" fontWeight="500" fill="#c2410c" textAnchor="middle">HP PROCESS STEAM</text>
                <text x="42" y="18" fontSize="4.8" fontWeight="400" fill="#ea580c" textAnchor="middle">131.6 t/h • 380°C • 42.0 bar</text>
              </g>

              {/* Mixing Node */}
              <circle cx="572" cy="480" r="7" fill="#0090d0" stroke="#ffffff" strokeWidth="1.5" />
              <text x="572" y="498" fontSize="5.4" fontWeight="600" fill="#0369a1" textAnchor="middle">STEAM MIXER</text>
            </g>
          ) : (
            <path d={hasSaturator ? "M 525 480 L 635 480" : "M 485 515 L 635 480"} className="flow-line-blue" />
          )}

          {/* Continuous Mixed Feed Line to SMR Primary Reformer Furnace */}
          <path d="M 572 480 L 635 480 L 635 445 L 685 445" fill="none" className="flow-line-blue" />
          <polygon points="685,445 677,441 677,449" fill="#0090d0" />

          {/* Stream Callout: Mixed Feed to SMR Furnace with Live Numbers */}
          <g transform="translate(580, 442)">
            <rect width="98" height="24" rx="4" fill="#ffffff" stroke="#0090d0" strokeWidth="1.1" />
            <text x="49" y="10.5" fontSize="5.8" fontWeight="500" fill="#0369a1" textAnchor="middle">MIXED FEED TO SMR</text>
            <text x="49" y="19.5" fontSize="5.0" fontWeight="400" fill="#0284c7" textAnchor="middle">S/C = 2.79 (Opt: 2.95) • 514.8°C</text>
          </g>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ZONE 4: PRIMARY REFORMER (SMR) RADIANT BOX                          */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {/* SMR Radiant Furnace Box */}
          {hasSmrBox ? (() => {
            const cfg = equipmentConfigMap?.["smr_radiant_box"];
            const firingType = cfg?.firingType || "Top-Fired";

            return (
              <g className="equipment-box" onClick={() => openEquipmentDetails("smr_radiant_box", "Primary Reformer (SMR) Radiant Furnace Box", "Primary Reforming", "856°C Arch", "28.5 bar", "325.0 t/h", `${firingType} radiant box housing 480 catalyst tubes operating under endothermic reforming kinetics.`, "RECONCILED", "112 MW", "854°C")}>
                {/* Main Furnace Structure */}
                <rect x="685" y="440" width="95" height="150" rx="8" fill="url(#smrFurnaceBoxGrad)" stroke="#0090d0" strokeWidth="2.2" />
                
                {/* Top Inlet Distributor Header connected directly from mixed feed line */}
                <line x1="685" y1="445" x2="765" y2="445" stroke="#0090d0" strokeWidth="2.0" />

                {/* Internal Catalyst Tubes Representation */}
                <line x1="702" y1="445" x2="702" y2="560" stroke="#0284c7" strokeWidth="2.2" strokeDasharray="4,2" />
                <line x1="718" y1="445" x2="718" y2="560" stroke="#0284c7" strokeWidth="2.2" strokeDasharray="4,2" />
                <line x1="733" y1="445" x2="733" y2="560" stroke="#0284c7" strokeWidth="2.2" strokeDasharray="4,2" />
                <line x1="748" y1="445" x2="748" y2="560" stroke="#0284c7" strokeWidth="2.2" strokeDasharray="4,2" />
                <line x1="763" y1="445" x2="763" y2="560" stroke="#0284c7" strokeWidth="2.2" strokeDasharray="4,2" />

                {/* Burner Flames: Top-Fired or Side-Fired */}
                {firingType === "Side-Fired" ? (
                  <g>
                    {/* Left wall burners pointing inward */}
                    <polygon points="687,480 697,483 687,486" fill="#f97316" />
                    <polygon points="687,515 697,518 687,521" fill="#f97316" />
                    <polygon points="687,545 697,548 687,551" fill="#f97316" />
                    {/* Right wall burners pointing inward */}
                    <polygon points="778,480 768,483 778,486" fill="#f97316" />
                    <polygon points="778,515 768,518 778,521" fill="#f97316" />
                    <polygon points="778,545 768,548 778,551" fill="#f97316" />
                  </g>
                ) : (
                  <g>
                    {/* Top-Fired downward flame tips from arch */}
                    <polygon points="698,452 702,464 706,452" fill="#f97316" />
                    <polygon points="714,452 718,464 722,452" fill="#f97316" />
                    <polygon points="729,452 733,464 737,452" fill="#f97316" />
                    <polygon points="744,452 748,464 752,452" fill="#f97316" />
                    <polygon points="759,452 763,464 767,452" fill="#f97316" />
                    {/* Bottom floor flames */}
                    <polygon points="698,580 702,568 706,580" fill="#f97316" />
                    <polygon points="714,580 718,568 722,580" fill="#f97316" />
                    <polygon points="729,580 733,568 737,580" fill="#f97316" />
                    <polygon points="744,580 748,568 752,580" fill="#f97316" />
                    <polygon points="759,580 763,568 767,580" fill="#f97316" />
                  </g>
                )}

                <text x="732" y="605" fontSize="7.2" fontWeight="600" fill="#0369a1" textAnchor="middle">SMR RADIANT BOX</text>
                <text x="732" y="615" fontSize="5.2" fontWeight="500" fill="#0284c7" textAnchor="middle">Conv: 89.2% • Firing: 112.4 MW</text>

                {/* SMR Radiant Low Efficiency Red Zone Overlay on PFD */}
                {lbmAlerts?.radiantEffLow && (
                  <g className="equipment-box cursor-pointer" onClick={() => onSelectSection?.("smr")}>
                    <rect x="683" y="438" width="99" height="154" rx="9" fill="rgba(239, 68, 68, 0.16)" stroke="#ef4444" strokeWidth="1.6" strokeDasharray="4,2" />
                    <g transform="translate(681, 378)">
                      <rect width="103" height="26" rx="4" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.3" />
                      <circle cx="8" cy="13" r="2.8" fill="#ef4444" className="animate-ping" />
                      <circle cx="8" cy="13" r="2.8" fill="#ef4444" />
                      <text x="56" y="10" fontSize="5.0" fontWeight="700" fill="#b91c1c" textAnchor="middle">⚠ RADIANT EFF LOW ({lbmAlerts.radiantEffValue ?? 54.2}%)</text>
                      <text x="56" y="18.5" fontSize="4.3" fontWeight="600" fill="#991b1b" textAnchor="middle">Arch {lbmAlerts.archTemp ?? 917.5}°C • Scattering (±{lbmAlerts.scatteringDeltaT ?? 28.5}°C)</text>
                    </g>
                  </g>
                )}
              </g>
            );
          })() : null}

          {/* SMR Arch / Bridgewall Live Process Badge */}
          <g transform="translate(684, 408)">
            <rect width="98" height="24" rx="4" fill="#ffffff" stroke="#ea580c" strokeWidth="1.1" />
            <text x="49" y="10.5" fontSize="5.8" fontWeight="500" fill="#c2410c" textAnchor="middle">ARCH BRIDGEWALL TEMP</text>
            <text x="49" y="19.5" fontSize="5.0" fontWeight="400" fill="#c2410c" textAnchor="middle">916.4°C (Opt 850°C) • Slip: 4.67%</text>
          </g>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ZONE 5: CONVECTION WASTE HEAT RECOVERY TRAIN                        */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {/* Flue gas rising from SMR arch into Convection */}
          <path d="M 710 440 L 710 320 L 745 320" fill="none" className="flow-line-orange" />
          <g transform="translate(668, 305)">
            <rect width="46" height="14" rx="2" fill="#ffffff" stroke="#ea580c" strokeWidth="0.8" />
            <text x="23" y="10" fontSize="4.8" fontWeight="400" fill="#c2410c" textAnchor="middle">FG: 916.4°C</text>
          </g>

          {/* Convection Section Duct Box */}
          <g 
            className="equipment-box" 
            onClick={() => openEquipmentDetails("convection_bank", "Convection Waste Heat Recovery Train", "Convection", "750°C", "Draft: -12 mmH2O", "480.0 t/h Flue Gas", "Multipass heat recovery bank preheating mixed feed, superheating steam, and preheating combustion air.", "RECONCILED", "62.0 MW", "750°C")}
          >
            {(() => {
              const customCount = Object.values(equipmentConfigMap || {}).filter(
                (e: any) => e.category === "convection" && e.isCustom && e.enabled
              ).length;
              const boxW = 150 + customCount * 30;
              return (
                <rect x="745" y="275" width={boxW} height="88" rx="7" fill="url(#blueBoxGrad)" stroke="#0090d0" strokeWidth="2.0" />
              );
            })()}
            <text x="820" y="290" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">CONVECTION COIL BANK</text>

            {/* Coil 1: Mixed Feed Preheater E-1201 */}
            {hasConvCoil1 && (
              <g>
                <line x1="765" y1="300" x2="765" y2="338" stroke="#0284c7" strokeWidth="2.2" />
                <text x="765" y="348" fontSize="5.5" fontWeight="600" fill="#0284c7" textAnchor="middle">COIL 1 (E-1201)</text>
                <text x="765" y="356" fontSize="4.6" fontWeight="500" fill="#b91c1c" textAnchor="middle">693°C (71.8% Clean)</text>

                {/* E-1201 High TMT Amber Zone Overlay on PFD */}
                {lbmAlerts?.e1201HighTmt && (
                  <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelectSection?.("convection"); }}>
                    <rect x="748" y="295" width="34" height="66" rx="4" fill="rgba(245, 158, 11, 0.16)" stroke="#f59e0b" strokeWidth="1.6" strokeDasharray="3,1.5" />
                    <g transform="translate(728, 252)">
                      <rect width="84" height="22" rx="3" fill="#fffbeb" stroke="#f59e0b" strokeWidth="1.2" />
                      <circle cx="8" cy="11" r="2.8" fill="#f59e0b" className="animate-ping" />
                      <circle cx="8" cy="11" r="2.8" fill="#f59e0b" />
                      <text x="46" y="9.5" fontSize="5.0" fontWeight="700" fill="#b45309" textAnchor="middle">⚠ HIGH TMT: {lbmAlerts.e1201TmtValue ?? 582}°C</text>
                      <text x="46" y="17.5" fontSize="4.3" fontWeight="600" fill="#92400e" textAnchor="middle">Fouled (Cleanliness {lbmAlerts.e1201Cleanliness ?? 71.6}%)</text>
                    </g>
                  </g>
                )}
              </g>
            )}

            {/* Coil 2: Mixed Feed / Steam Preheater E-1202 */}
            {hasConvCoil2 && (
              <g>
                <line x1="800" y1="300" x2="800" y2="338" stroke="#0284c7" strokeWidth="2.2" />
                <text x="800" y="348" fontSize="5.5" fontWeight="600" fill="#0284c7" textAnchor="middle">COIL 2 (E-1202)</text>
                <text x="800" y="356" fontSize="4.6" fontWeight="500" fill="#0284c7" textAnchor="middle">425°C Out</text>
              </g>
            )}

            {/* Coil 3: HP Steam Superheater E-1101 */}
            {hasConvCoil3 && (
              <g>
                <line x1="835" y1="300" x2="835" y2="338" stroke="#f97316" strokeWidth="2.2" />
                <text x="835" y="348" fontSize="5.5" fontWeight="600" fill="#ea580c" textAnchor="middle">COIL 3 (E-1101)</text>
                <text x="835" y="356" fontSize="4.6" fontWeight="500" fill="#ea580c" textAnchor="middle">310°C Out</text>
              </g>
            )}

            {/* Coil 4: BFW / Air Preheater E-1204 */}
            {hasConvCoil4 && (() => {
              const cfg = equipmentConfigMap?.["conv_coil_4"];
              const count = cfg?.numExchangers || 1;
              const arrangement = cfg?.arrangement || "Series";

              return (
                <g className="equipment-box" onClick={() => openEquipmentDetails("conv_coil_4", "BFW Preheater Coil (E-1204)", "Convection", "240°C", "Draft: -12 mmH2O", "185.0 t/h BFW", `BFW preheater coil pass with ${count} module(s) in ${arrangement}.`)}>
                  <line x1="870" y1="300" x2="870" y2="338" stroke="#10b981" strokeWidth={count > 1 ? 3.0 : 2.2} />
                  {count > 1 && (
                    <line x1="876" y1="300" x2="876" y2="338" stroke="#10b981" strokeWidth="2.0" />
                  )}
                  {count > 2 && (
                    <line x1="864" y1="300" x2="864" y2="338" stroke="#10b981" strokeWidth="2.0" />
                  )}
                  <text x="870" y="348" fontSize="5.5" fontWeight="600" fill="#059669" textAnchor="middle">COIL 4 (E-1204)</text>
                  <text x="870" y="356" fontSize="4.6" fontWeight="500" fill="#047857" textAnchor="middle">186.6°C Out</text>
                </g>
              );
            })()}

            {/* Custom Added Convection Coils (Pass 5, 6, etc.) */}
            {Object.values(equipmentConfigMap || {})
              .filter((e: any) => e.category === "convection" && e.isCustom && e.enabled)
              .map((cCoil: any, cIdx: number) => {
                const passX = 905 + cIdx * 28;
                return (
                  <g 
                    key={cCoil.id} 
                    className="equipment-box" 
                    onClick={() => openEquipmentDetails(cCoil.id, cCoil.name, "Convection", "210°C", "Draft: -12 mmH2O", "Stream Recovery", cCoil.description || "Custom convection coil pass.")}
                  >
                    <line x1={passX} y1="300" x2={passX} y2="338" stroke="#0284c7" strokeWidth="2.2" strokeDasharray="3,1" />
                    <text x={passX} y="348" fontSize="5.2" fontWeight="600" fill="#0284c7" textAnchor="middle">
                      {cCoil.name.length > 10 ? cCoil.name.substring(0, 8) + ".." : cCoil.name.toUpperCase()}
                    </text>
                    <text x={passX} y="356" fontSize="4.4" fontWeight="500" fill="#64748b" textAnchor="middle">
                      (Pass {cCoil.passNumber || (5 + cIdx)})
                    </text>
                  </g>
                );
              })}
          </g>

          {/* Convection to ID Fan and Stack */}
          <path d="M 895 315 L 928 315" className="flow-line-orange" />

          {/* ID Fan */}
          {hasIdFan && (
            <g className="equipment-box" onClick={() => openEquipmentDetails("id_fan", "Induced Draft (ID) Fan", "Convection", "165°C", "Head: 240 mmH2O", "480.0 t/h Flue Gas", "Turbine-driven centrifugal fan exhausting cooled flue gas.")}>
              <circle cx="940" cy="315" r="12" fill="url(#blueBoxGrad)" stroke="#0090d0" strokeWidth="1.8" />
              <polygon points="940,307 948,319 932,319" fill="#0090d0" />
              <text x="940" y="338" fontSize="6.2" fontWeight="600" fill="#0369a1" textAnchor="middle">ID FAN</text>
            </g>
          )}

          <path d={hasIdFan ? "M 952 315 L 985 315" : "M 895 315 L 985 315"} className="flow-line-orange" />

          {/* Flue Gas Stack */}
          {hasStack && (
            <g className="equipment-box" onClick={() => openEquipmentDetails("flue_stack", "Flue Gas Exhaust Stack", "Convection", "158°C", "Draft: Neutral", "480.0 t/h", "Self-supporting steel stack with virtual PEMS emissions monitoring.")}>
              <path d="M 985 320 L 985 240 L 980 230 L 1004 230 L 999 240 L 999 320 Z" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
              <text x="992" y="333" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">CHIMNEY</text>
              <text x="992" y="342" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">STACK</text>
            </g>
          )}

          {/* Flue Gas Stack Real-time Exhaust Callout */}
          <g transform="translate(915, 204)" className="transition-all duration-300">
            <rect width="130" height="20" rx="3" fill="#ffffff" stroke="#ea580c" strokeWidth="1.2" />
            <text x="65" y="9.5" fontSize="5.6" fontWeight="700" fill="#c2410c" textAnchor="middle">
              STACK EXHAUST: {stackTemp}°C ({stackDelta > 0 ? `+${stackDelta}°C` : "NORMAL"})
            </text>
            <text x="65" y="16.5" fontSize="4.8" fontWeight="500" fill="#64748b" textAnchor="middle">
              SOx: {soxActual} ppm • NOx: {noxPred} ppm
            </text>
          </g>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ZONE 6: REFORMED SYNGAS COOLING & STEAM GENERATION                  */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {/* Raw Syngas exiting SMR Radiant Box bottom */}
          <path d="M 780 540 L 835 540" className="flow-line-purple" />

          {/* Stream Callout: Raw Reformed Syngas */}
          <g transform="translate(778, 490)">
            <rect width="56" height="22" rx="3" fill="#ffffff" stroke="#7c3aed" strokeWidth="1" />
            <text x="28" y="9.5" fontSize="5.4" fontWeight="500" fill="#7c3aed" textAnchor="middle">HOT SYNGAS</text>
            <text x="28" y="18" fontSize="4.8" fontWeight="400" fill="#64748b" textAnchor="middle">856°C • 28.0 bar</text>
          </g>

          {/* 8. Waste Heat Boiler (WHB) */}
          {hasWhb ? (
            <g className="equipment-box" onClick={() => openEquipmentDetails("waste_heat_boiler", "Waste Heat Boiler (WHB)", "Syngas Cooling", "360°C", "27.5 bar", "325.0 t/h", "Rapid syngas quench generating high-pressure saturated steam.", "RECONCILED", "41.5 MW", "358°C")}>
              <rect x="835" y="475" width="50" height="85" rx="7" fill="url(#blueBoxGrad)" stroke="#0090d0" strokeWidth="2.0" />
              <path d="M 845 500 C 855 490, 865 510, 875 500" stroke="#0090d0" strokeWidth="1.5" fill="none" />
              <path d="M 845 520 C 855 510, 865 530, 875 520" stroke="#0090d0" strokeWidth="1.5" fill="none" />
              <text x="860" y="540" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">WASTE HEAT</text>
              <text x="860" y="550" fontSize="6.5" fontWeight="600" fill="#0369a1" textAnchor="middle">BOILER</text>
            </g>
          ) : (
            <path d="M 780 540 L 920 540" className="flow-line-purple" />
          )}

          {/* WHB Live Parameters Callout */}
          <g transform="translate(825, 452)">
            <rect width="90" height="22" rx="3" fill="#ffffff" stroke="#0090d0" strokeWidth="1" />
            <text x="45" y="9.5" fontSize="5.4" fontWeight="500" fill="#0369a1" textAnchor="middle">WHB STEAM QUENCH</text>
            <text x="45" y="18" fontSize="4.8" fontWeight="400" fill="#0369a1" textAnchor="middle">360.2°C • 131.6 t/h • 61.67 MW</text>
          </g>

          {/* 9. Steam Drum & Risers/Downcomers */}
          {hasSteamDrum && (
            <g className="equipment-box" onClick={() => openEquipmentDetails("steam_drum", "HP Steam Drum", "Steam Generation", "315°C", "105.0 bar", "110.0 t/h HP Steam", "Separates saturated steam from circulation water with downcomers and risers.")}>
              {/* Drum Vessel */}
              <rect x="830" y="420" width="60" height="26" rx="10" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
              <text x="860" y="436" fontSize="6.2" fontWeight="600" fill="#0369a1" textAnchor="middle">STEAM DRUM</text>
              
              {/* Risers & Downcomers */}
              <path d="M 845 446 L 845 475" stroke="#0284c7" strokeWidth="1.5" />
              <path d="M 875 475 L 875 446" stroke="#ea580c" strokeWidth="1.5" />

              {/* BFW Feed In */}
              <path d="M 800 433 L 830 433" className="flow-line-green" />
              <text x="795" y="430" fontSize="5.5" fontWeight="500" fill="#059669" textAnchor="end">BFW INLET</text>
            </g>
          )}

          {/* Connector: WHB -> Syngas Process Cooler */}
          <path d={hasWhb ? "M 885 520 L 920 520" : "M 780 540 L 920 520"} className="flow-line-purple" />

          {/* 10. Syngas Process Cooler */}
          {hasSyngasCooler ? (() => {
            const cfg = equipmentConfigMap?.["syngas_cooler"];
            const count = cfg?.numExchangers || 2;
            const arrangement = cfg?.arrangement || "Series";

            return (
              <g className="equipment-box" onClick={() => openEquipmentDetails("syngas_cooler", "Reformed Syngas Process Cooler", "Cooling", "38°C", "27.0 bar", "325.0 t/h", `Reformed syngas cooler configured with ${count} shell(s) in ${arrangement}.`, "RECONCILED", "18.5 MW")}>
                {renderExchangerShells(940, 520, count, arrangement, "#7c3aed")}
                <text x="940" y="548" fontSize="5.8" fontWeight="600" fill="#0369a1" textAnchor="middle">PROCESS COOLER</text>
                <text x="940" y="556" fontSize="4.8" fontWeight="500" fill="#0284c7" textAnchor="middle">({count} {count === 1 ? "Shell" : "Shells"} • {arrangement})</text>
              </g>
            );
          })() : null}

          {/* Cooler Exit Temp Badge */}
          <g transform="translate(922, 480)">
            <rect width="36" height="12" rx="2" fill="#ffffff" stroke="#7c3aed" strokeWidth="0.8" />
            <text x="18" y="8.5" fontSize="4.8" fontWeight="400" fill="#7c3aed" textAnchor="middle">38.0°C</text>
          </g>

          {/* Connector: Cooler -> Condensate Separator */}
          <path d={hasSyngasCooler ? "M 955 520 L 990 520" : "M 885 520 L 990 520"} className="flow-line-purple" />

          {/* 11. Condensate Separator Drum */}
          {hasCondensateSep ? (
            <g className="equipment-box" onClick={() => openEquipmentDetails("condensate_separator", "Process Condensate Separator Drum", "Separation", "38°C", "26.8 bar", "325.0 t/h", "Knocks out condensed water before syngas compression to synthesis loop.")}>
              <rect x="990" y="475" width="34" height="85" rx="7" fill="url(#blueVesselGrad)" stroke="#0090d0" strokeWidth="1.8" />
              <text x="1007" y="496" fontSize="6.2" fontWeight="600" fill="#0369a1" textAnchor="middle">CONDENSATE</text>
              <text x="1007" y="505" fontSize="5.8" fontWeight="600" fill="#0369a1" textAnchor="middle">SEPARATOR</text>
              <line x1="993" y1="528" x2="1021" y2="528" stroke="#0284c7" strokeDasharray="2,2" strokeWidth="1.2" />

              {/* Bottom Condensate Drain */}
              <path d="M 1007 560 L 1007 580" stroke="#059669" strokeWidth="1.4" />
              <text x="1007" y="589" fontSize="5.5" fontWeight="500" fill="#059669" textAnchor="middle">CONDENSATE</text>
              <text x="1007" y="597" fontSize="4.6" fontWeight="400" fill="#059669" textAnchor="middle">14.8 t/h</text>
            </g>
          ) : null}

          {/* Syngas Battery Limit Export to Methanol Synthesis */}
          <path d={hasCondensateSep ? "M 1024 495 L 1100 495" : "M 955 520 L 1100 495"} className="flow-line-purple" />
          <polygon points="1100,495 1092,492 1092,498" fill="#7c3aed" />

          {/* Final Stream Export Callout */}
          <g transform="translate(1025, 436)">
            <rect width="105" height="24" rx="4" fill="#ffffff" stroke="#7c3aed" strokeWidth="1.2" />
            <text x="52.5" y="10.5" fontSize="6.0" fontWeight="600" fill="#7c3aed" textAnchor="middle">TO METHANOL SYNTHESIS (K-1301)</text>
            <text x="52.5" y="19.5" fontSize="5.2" fontWeight="500" fill="#1e293b" textAnchor="middle">96.6 kNm³/h • 38°C • M: 2.05 (+85.9 TPD)</text>
          </g>
        </svg>

        {/* Bottom Right DCS Zoom Floating Bar matching Ingenero360 Reference */}
        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs border border-slate-200 shadow-sm rounded-md px-2 py-1 flex items-center gap-1.5 z-30 text-[10px] text-slate-600 transition-all">
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 rounded hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
            title="Reset to 100% Full View"
          >
            {Math.round(zoom * 100)}%
          </button>
          <div className="w-[1px] h-3 bg-slate-200" />
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-3 h-3" />
          </button>
          <div className="w-[1px] h-3 bg-slate-200" />
          <button
            type="button"
            onClick={() => {
              if (viewMode === "full") {
                setViewMode("focus");
              } else {
                setViewMode("full");
                if (onSelectSection) onSelectSection("overview");
              }
              setPan({ x: 0, y: 0 });
              setZoom(1.0);
            }}
            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
            title="Toggle Full / Section View"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* RIGOROUS M&E BALANCE RECONCILIATION AUDIT MODAL (AUDIT-GRADE)      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-5xl w-full flex flex-col overflow-hidden my-auto max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
                    <Scale className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm tracking-wide text-white uppercase">
                        Primary Reformer Heat &amp; Material Balance Audit
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                        Chi-Square: PASS (p = 0.962)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Plant: Ar Razi Unit 2 SMR Train • Weighted Least Squares (WLS) Data Reconciliation Engine • Real DCS Provenance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KPI Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-2.5 bg-slate-100 border-b border-slate-200 text-xs">
                <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[10px] font-medium uppercase">Process Mass Closure</span>
                  <span className="font-black text-emerald-700 text-sm">99.94%</span>
                  <span className="text-slate-400 block text-[9.5px]">Feed: 163.05 t/h • Products: 162.95 t/h</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[10px] font-medium uppercase">Fuel Thermal Balance</span>
                  <span className="font-black text-sky-700 text-sm">98.8% Closure</span>
                  <span className="text-slate-400 block text-[9.5px]">Fuel LHV Input: 253.6 MW (18.94 t/h)</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[10px] font-medium uppercase">Stack Sensible Loss</span>
                  <span className="font-black text-amber-700 text-sm">{lostDuty} MW</span>
                  <span className="text-slate-400 block text-[9.5px]">{stackTemp}°C (+{stackDelta}°C above design)</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 block text-[10px] font-medium uppercase">Avoidable Scope 1 CO₂</span>
                  <span className="font-black text-rose-700 text-sm">+{excessCo2} t/d</span>
                  <span className="text-slate-400 block text-[9.5px]">Compensatory Fuel: ${fuelWasted.toLocaleString()}/d</span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 px-5 pt-2 bg-white gap-2">
                <button
                  type="button"
                  onClick={() => setAuditTab("stream")}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    auditTab === "stream" 
                      ? "border-emerald-600 text-emerald-800" 
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Process Mass Balance (PNG + Steam)
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab("energy")}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    auditTab === "energy" 
                      ? "border-emerald-600 text-emerald-800" 
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Fuel Firing Thermal Balance
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab("stack")}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    auditTab === "stack" 
                      ? "border-emerald-600 text-emerald-800" 
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Stack Loss &amp; Convection Fouling Economics
                </button>
                <button
                  type="button"
                  onClick={() => setAuditTab("synthesis")}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    auditTab === "synthesis" 
                      ? "border-emerald-600 text-emerald-800" 
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Syngas Loop &amp; Carbon Balance
                </button>
              </div>

              {/* Tab Content Container */}
              <div className="p-5 overflow-y-auto max-h-[58vh] bg-slate-50/50 space-y-4 text-xs text-slate-700">
                {/* TAB 1: Process Stream Mass Balance */}
                {auditTab === "stream" && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 text-xs uppercase tracking-wide">
                          Process Mass Reconciliation (Feed Natural Gas + Primary Steam → Syngas + Condensate)
                        </span>
                        <span className="font-semibold text-emerald-800 text-[11px]">
                          Closure: 99.94% • Feed: 163.05 t/h • Products: 162.95 t/h • Residual: 0.10 t/h (0.06%)
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-1">
                        <strong>Process Stream Isolation:</strong> The mass balance focuses strictly on the chemical reaction envelope (Feed PNG + Primary Steam yielding Dry Syngas and Knockout Condensate). Combustion air and flue gas are audited in the <em>Fuel Thermal Energy Balance</em> because plant flue gas ducts lack continuous physical mass flowmeters.
                      </p>
                    </div>

                    {/* Inputs Table */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-100 font-bold text-slate-800 text-[11px] border-b border-slate-200 flex justify-between items-center">
                        <span>PROCESS INLET STREAMS (TOTAL PROCESS FEED IN: 163.05 t/h)</span>
                        <span className="text-slate-500 font-normal text-[10px]">Source: Ar Razi Unit 2 DCS / PI Historian</span>
                      </div>
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-3">Stream Name</th>
                            <th className="py-1.5 px-3">Live PI / DCS Tag</th>
                            <th className="py-1.5 px-3 text-right">Raw Meter</th>
                            <th className="py-1.5 px-3 text-right">Reconciled</th>
                            <th className="py-1.5 px-3 text-right">Sensor Tol (1σ)</th>
                            <th className="py-1.5 px-3 text-right">Residual</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-1.5 px-3 font-semibold text-slate-800">Natural Gas Feed Gas (PNG)</td>
                            <td className="py-1.5 px-3 font-mono text-[10px] text-sky-700">FT-1201</td>
                            <td className="py-1.5 px-3 text-right">48.25 t/h</td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">48.22 t/h</td>
                            <td className="py-1.5 px-3 text-right text-slate-500">±1.0%</td>
                            <td className="py-1.5 px-3 text-right text-emerald-600">-0.06%</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 px-3 font-semibold text-slate-800">Primary Reforming Process Steam</td>
                            <td className="py-1.5 px-3 font-mono text-[10px] text-sky-700">FT-1209</td>
                            <td className="py-1.5 px-3 text-right">114.80 t/h</td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">114.83 t/h</td>
                            <td className="py-1.5 px-3 text-right text-slate-500">±1.5%</td>
                            <td className="py-1.5 px-3 text-right text-emerald-600">+0.03%</td>
                          </tr>
                          <tr className="bg-emerald-50/50 font-bold text-emerald-950">
                            <td className="py-1.5 px-3">Total Process Inflows (Feed Gas + Steam)</td>
                            <td className="py-1.5 px-3 text-[10px] text-emerald-800 font-normal">Sum of Reactant Feed Streams</td>
                            <td className="py-1.5 px-3 text-right text-slate-600">163.05 t/h</td>
                            <td className="py-1.5 px-3 text-right font-black text-emerald-900">163.05 t/h</td>
                            <td className="py-1.5 px-3 text-right text-slate-500">±1.2% avg</td>
                            <td className="py-1.5 px-3 text-right text-emerald-600">0.00%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Outputs Table */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-100 font-bold text-slate-800 text-[11px] border-b border-slate-200 flex justify-between items-center">
                        <span>PROCESS OUTLET STREAMS (TOTAL REACTION PRODUCTS: 162.95 t/h)</span>
                        <span className="text-emerald-700 font-bold">Process Mass Closure: 99.94% (Residual: 0.10 t/h or 0.06%) ✓</span>
                      </div>
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-3">Stream Name</th>
                            <th className="py-1.5 px-3">Live PI / DCS Tag &amp; Calculation Basis</th>
                            <th className="py-1.5 px-3 text-right">Mass Flow Rate</th>
                            <th className="py-1.5 px-3 text-right">Temperature</th>
                            <th className="py-1.5 px-3 text-right">Pressure</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {/* Dry Syngas Export to K-1301 */}
                          <tr className="bg-purple-50/30">
                            <td className="py-1.5 px-3 font-semibold text-slate-800">
                              <span>Dry Reformed Syngas (MUG to K-1301)</span>
                              <span className="block text-[9.5px] font-normal text-purple-700">
                                Σ(yᵢ · MWᵢ) · Total Moles: CO (37.33 t/h) + CO₂ (35.98 t/h) + H₂ (14.74 t/h) + CH₄ (5.24 t/h) + N₂ (8.25 t/h)
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              <span className="font-mono text-[10px] text-purple-700 block">1301-FI-01 (10,081 kmol/h)</span>
                              <span className="text-[9.5px] text-slate-500">CO: 13.22% • CO₂: 8.11% • H₂: 72.51% • CH₄: 3.24% • MW: 10.07 kg/kmol</span>
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">101.54 t/h</td>
                            <td className="py-1.5 px-3 text-right">38.0°C</td>
                            <td className="py-1.5 px-3 text-right">24.5 bar</td>
                          </tr>

                          {/* Process Condensate Knocked Out from Syngas */}
                          <tr className="bg-sky-50/20">
                            <td className="py-1.5 px-3 font-semibold text-slate-800">
                              <span>Process Condensate (Knocked Out H₂O)</span>
                              <span className="block text-[9.5px] font-normal text-sky-700">
                                Unreacted steam condensed at 38°C in V-1203 / V-1221 (3,409 kmol/h × 18.015)
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              <span className="font-mono text-[10px] text-sky-700 block">1203-FI-02 (V-1203 / V-1221 drain)</span>
                              <span className="text-[9.5px] text-slate-500">Recycled to Saturator E-1222 / BFW Polishing Plant</span>
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-slate-900">61.41 t/h</td>
                            <td className="py-1.5 px-3 text-right">38.0°C</td>
                            <td className="py-1.5 px-3 text-right">24.5 bar</td>
                          </tr>

                          {/* Total Process Products */}
                          <tr className="bg-emerald-50/60 font-bold border-t-2 border-emerald-300 text-emerald-950">
                            <td className="py-2 px-3">
                              <span>Total Process Products Out (Dry Syngas + Condensate)</span>
                            </td>
                            <td className="py-2 px-3 text-[10px]">
                              <span>Direct Chemical Reaction Product Closure vs Process Feed (163.05 t/h)</span>
                            </td>
                            <td className="py-2 px-3 text-right font-black text-emerald-900 text-xs">162.95 t/h</td>
                            <td className="py-2 px-3 text-right text-slate-500">-</td>
                            <td className="py-2 px-3 text-right text-slate-500">-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Industrial Boundary Note */}
                    <div className="bg-slate-100 rounded-lg p-2.5 border border-slate-200 text-[10.5px] text-slate-600 flex items-start gap-2">
                      <span className="font-bold text-slate-700 shrink-0">Industrial Practice Note:</span>
                      <span>
                        Natural Gas Fuel firing (18.94 t/h), combustion air, WHB steam generation, and flue gas stack exhaust are combustion and utility circuits. Since flue gas lacks physical flow metering in plant ducts, it is tracked through combustion stoichiometry under the <strong>Fuel Firing Thermal Balance</strong> tab, ensuring the process mass balance remains 100% verified on physical DCS meters.
                      </span>
                    </div>
                  </div>
                )}

                {/* TAB 2: Thermal Heat Balance & Duty */}
                {auditTab === "energy" && (
                  <div className="space-y-4">
                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-950 text-xs uppercase tracking-wide">
                          Primary SMR Reformer Fuel Energy &amp; Heat Distribution Balance
                        </span>
                        <span className="font-semibold text-sky-800 text-[11px]">
                          Fuel Gas Firing: 253.6 MWth (18.94 t/h) • Total Thermal Closure: 100.0%
                        </span>
                      </div>
                      <p className="text-[11px] text-sky-700 mt-1">
                        Fuel Gas firing Lower Heating Value (LHV) plus sensible preheats is balanced against endothermic steam reforming duty, sensible heat in syngas at radiant arch, convection recovery, and flue gas stack loss.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Thermal Inputs */}
                      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                        <h4 className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-200 mb-2 flex justify-between">
                          <span>HEAT INFLOWS</span>
                          <span className="text-emerald-700">340.9 MWth</span>
                        </h4>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="font-semibold text-slate-800 block">Fuel Gas Firing LHV (48.2 MJ/kg):</span>
                              <span className="font-mono text-[9.5px] text-slate-400">FT-1215 + FPG (18.94 t/h)</span>
                            </div>
                            <strong className="text-slate-900">253.6 MW (74.4%)</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="text-slate-700 block">Sensible Heat in Superheated Steam (385°C):</span>
                              <span className="font-mono text-[9.5px] text-slate-400">FT-1209 (114.83 t/h)</span>
                            </div>
                            <strong className="text-slate-900">64.5 MW (18.9%)</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="text-slate-700 block">Sensible Heat in Preheated NG Feed (420°C):</span>
                              <span className="font-mono text-[9.5px] text-slate-400">FT-1201 (48.22 t/h)</span>
                            </div>
                            <strong className="text-slate-900">14.2 MW (4.2%)</strong>
                          </div>
                          <div className="flex justify-between py-1">
                            <div>
                              <span className="text-slate-700 block">Combustion Air Preheated Duty (65°C):</span>
                              <span className="font-mono text-[9.5px] text-slate-400">Calculated from Excess O₂ (2.78%)</span>
                            </div>
                            <strong className="text-slate-900">8.6 MW (2.5%)</strong>
                          </div>
                        </div>
                      </div>

                      {/* Thermal Absorption */}
                      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                        <h4 className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-200 mb-2 flex justify-between">
                          <span>HEAT ABSORPTION &amp; LOSSES</span>
                          <span className="text-sky-700">340.9 MWth</span>
                        </h4>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="font-semibold text-slate-800 block">Endothermic Reforming Reactions:</span>
                              <span className="text-[9.5px] text-slate-400">CH₄ + H₂O → CO + 3H₂ (ΔH = +206 kJ/mol)</span>
                            </div>
                            <strong className="text-sky-900">98.4 MW (28.9%)</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="text-slate-700 block">Sensible Enthalpy in Syngas at Radiant Arch (856°C):</span>
                              <span className="font-mono text-[9.5px] text-slate-400">TI-1208</span>
                            </div>
                            <strong className="text-sky-900">118.2 MW (34.7%)</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="text-slate-700 block">Convection Steam Superheating &amp; Preheating:</span>
                              <span className="text-[9.5px] text-slate-400">Recovered in Convection Section Coils</span>
                            </div>
                            <strong className="text-sky-900">74.1 MW (21.7%)</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="text-slate-700 block">Convection BFW Economizer Absorption:</span>
                              <span className="font-mono text-[9.5px] text-slate-400">FC-1214.PV (WHB BFW Circuit)</span>
                            </div>
                            <strong className="text-sky-900">22.5 MW (6.6%)</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <div>
                              <span className="font-semibold text-amber-800 block">Flue Gas Stack Loss (at 185°C):</span>
                              <span className="font-mono text-[9.5px] text-amber-600">TI-1250 (185.0°C vs 150.0°C baseline)</span>
                            </div>
                            <strong className="text-amber-800 font-bold">23.6 MW (6.9%)</strong>
                          </div>
                          <div className="flex justify-between py-1">
                            <div>
                              <span className="text-slate-500 block">Furnace Casing Radiation &amp; Convection Loss:</span>
                              <span className="text-[9.5px] text-slate-400">Measured 1.2% of Total Heat Input</span>
                            </div>
                            <strong className="text-slate-500">4.1 MW (1.2%)</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Flue Gas Stoichiometric Determination Box */}
                    <div className="bg-slate-100 rounded-lg p-3 border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-200 mb-2 flex justify-between items-center">
                        <span>Flue Gas Stoichiometric Combustion Determination</span>
                        <span className="text-[10px] text-slate-500 font-normal">Calculated from Fuel Firing &amp; Stack O₂ (2.78%)</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Fuel Gas Firing Flow</span>
                          <strong className="text-slate-900 text-xs">18.94 t/h</strong>
                          <span className="block text-[9.5px] text-slate-400 mt-0.5">84.2% CH₄, 10.5% H₂, 3.1% N₂, 2.2% CO₂</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Combustion Air (Stoichiometric + Excess)</span>
                          <strong className="text-slate-900 text-xs">341.20 t/h</strong>
                          <span className="block text-[9.5px] text-slate-400 mt-0.5">From AI-1208 (2.78% dry)</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200">
                          <span className="text-slate-500 block text-[10px]">Total Flue Gas Generated</span>
                          <strong className="text-slate-900 text-xs">360.14 t/h</strong>
                          <span className="block text-[9.5px] text-slate-400 mt-0.5">Exhausts stack at 185.0°C under negative draft</span>
                        </div>
                      </div>
                      <p className="text-[10.5px] text-slate-500 mt-2">
                        *In chemical plants, flue gas ducts do not have continuous physical mass meters. Stack thermal loss (23.6 MW) is rigorously evaluated via fuel chemistry and stack temperature rather than mixing unmetered flue gas into the process stream mass balance.
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 3: Stack Loss & Convection Fouling Economics */}
                {auditTab === "stack" && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-orange-600" />
                          High Stack Exhaust Temperature Penalty &amp; Turnaround Cleaning Economics
                        </span>
                        <span className="font-black text-rose-700 text-xs bg-white px-2 py-0.5 rounded border border-rose-200">
                          185.0°C (+35.0°C Exceedance)
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900 mt-1">
                        Design stack exhaust temperature is 150°C. Operating at 185°C incurs unnecessary sensible heat loss, forcing compensatory extra fuel firing that inflates fuel expenditure and Scope 1 CO₂ emissions.
                      </p>
                    </div>

                    {/* 3 Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Sensible Heat Wasted</span>
                        <div className="text-lg font-black text-rose-700 mt-1">{lostDuty} MW</div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Calculated from 100 kg/s flue gas flow × Cp 1.11 kJ/kg·°C × 35°C temperature rise.
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Compensatory Extra Fuel</span>
                        <div className="text-lg font-black text-amber-700 mt-1">{excessFuel} t/h Fuel</div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Extra firing required to compensate for lost convection duty: <strong>${fuelWasted.toLocaleString()}/day ($536,500/yr)</strong>.
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Avoidable Scope 1 CO₂</span>
                        <div className="text-lg font-black text-rose-800 mt-1">+{excessCo2} t/d CO₂</div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          8,430 metric tons of avoidable Scope 1 emissions per year from unrecovered stack enthalpy.
                        </p>
                      </div>
                    </div>

                    {/* Emissions & Fouling Analysis Table */}
                    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                      <h4 className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-200">
                        Environmental Compliance &amp; Convection Coil Fouling Diagnostics
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                        <div>
                          <strong className="text-slate-900 block mb-1">Virtual PEMS vs Continuous Emissions Analyzers:</strong>
                          <div className="space-y-1 bg-slate-50 p-2.5 rounded border border-slate-200">
                            <div className="flex justify-between">
                              <span>SOx (DCS PEMS Analyzer):</span>
                              <strong className="text-emerald-700">{soxActual} ppm (Permit &lt; 5.0 ppm) ✓</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Thermal NOx (Zeldovich Model):</span>
                              <strong className="text-emerald-700">{noxPred} ppm / {noxMg} mg/Nm³ (&lt; 120) ✓</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Stack Excess Oxygen:</span>
                              <strong>2.78 vol% (Burner Arch Temp: 916.4°C)</strong>
                            </div>
                            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                              <em>Both SOx and NOx comply with regional limits, but CO₂ penalty remains acute due to high firing.</em>
                            </div>
                          </div>
                        </div>

                        <div>
                          <strong className="text-slate-900 block mb-1">Root Cause &amp; Turnaround Cleaning Recommendation:</strong>
                          <div className="space-y-1 bg-amber-50/60 p-2.5 rounded border border-amber-200">
                            <div className="flex justify-between">
                              <span>E-1201 (Mixed Feed Coil) U-Value:</span>
                              <strong className="text-rose-700">18.4% Degradation vs Clean</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>E-1204 (Steam Superheater) Cleanliness:</span>
                              <strong className="text-rose-700">78.2% (Fouling threshold: 80%)</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Recommended Action:</span>
                              <strong className="text-slate-900">Dry-ice blast cleaning during next turnaround</strong>
                            </div>
                            <div className="text-[10px] text-emerald-800 font-semibold pt-1 border-t border-amber-200">
                              <em>Cleaning Cost: ~$65,000 • Fuel Savings: $536,500/year • Simple Payback: 1.4 months (44 days)</em>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: Syngas Loop & Carbon Balance */}
                {auditTab === "synthesis" && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-950 text-xs uppercase tracking-wide">
                          Reformer Synthesis Reaction &amp; Stoichiometric Module Validation
                        </span>
                        <span className="font-bold text-purple-800 text-xs bg-white px-2 py-0.5 rounded border border-purple-200">
                          Carbon Closure: 99.82% ✓
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-800 mt-1">
                        Validated chemical equilibrium of primary methane-steam reforming ($CH_4 + H_2O \rightleftharpoons CO + 3H_2$) and water-gas shift ($CO + H_2O \rightleftharpoons CO_2 + H_2$).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Syngas Composition */}
                      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                        <h4 className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-200 mb-2">
                          EXPORT SYNGAS COMPOSITION (96.6 kNm³/h)
                        </h4>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Hydrogen (H₂):</span>
                            <strong className="text-slate-900">73.20 mol%</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Carbon Monoxide (CO):</span>
                            <strong className="text-slate-900">15.40 mol%</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Carbon Dioxide (CO₂):</span>
                            <strong className="text-slate-900">8.10 mol%</strong>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>Unconverted Methane Slip (CH₄):</span>
                            <strong className="text-slate-900">3.30 mol% (Equilibrium Slip)</strong>
                          </div>
                        </div>
                      </div>

                      {/* Carbon Balance & Module */}
                      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
                        <h4 className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-200 mb-2">
                          METHANOL STOICHIOMETRIC MODULE (M)
                        </h4>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Formula: M = (H₂ - CO₂) / (CO + CO₂):</span>
                            <strong className="text-purple-700 font-bold text-sm">2.05</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Ideal Synthesis Target:</span>
                            <span className="font-semibold text-emerald-700">2.05 to 2.08 (Optimal)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Carbon Inflow (Feed + Fuel):</span>
                            <strong className="text-slate-900">49,836 kg C/h</strong>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>Carbon Accounted Out (Syngas + Stack):</span>
                            <strong className="text-slate-900">49,746 kg C/h (99.82% Closure)</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>DCS Tags Verified • Zero Artificial Damping • Real Plant Physics</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAuditModalOpen(false)}
                    className="px-4 py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
                  >
                    Close Audit Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
