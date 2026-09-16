"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  RotateCcw, 
  Activity, 
  TrendingUp, 
  Sparkles, 
  Flame, 
  Gauge, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  ShieldCheck,
  Zap,
  Info,
  Layers,
  Clock,
  Play,
  Check,
  Database,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Target,
  Maximize2,
  Bell,
  Save,
  Download,
  HelpCircle,
  TrendingDown,
  Calendar,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  BarChart3,
  Minimize2,
  Thermometer,
  Leaf,
  FileText,
  Printer
} from "lucide-react";
import { EquipmentConfig } from "./EquipmentQuestionnaire";
import { ReformerPfdCanvas, LbmAlertsInfo } from "./ReformerPfdCanvas";

export interface DiagnosticMetric {
  label: string;
  actual: string;
  target: string;
  status: "normal" | "warning" | "critical";
  desc: string;
}

export interface RecommendationItem {
  id: string;
  section: "feed" | "smr" | "convection" | "desulfurization" | "cooling";
  title: string;
  unitTag: string;
  actual: string;
  optimum: string;
  actionText: string;
  statusColor: string;
  diagnostics?: {
    summary: string;
    metrics: DiagnosticMetric[];
    inspectionChecklist: string[];
  };
}

export interface PerformanceKpiItem {
  label: string;
  actual: string;
  opt: string;
  sim?: string;
  uom: string;
  status: string;
  delta?: string;
  recId?: string;
  section?: "feed" | "smr" | "convection" | "desulfurization" | "cooling";
}

interface LiveLbmDashboardProps {
  equipmentList: EquipmentConfig[];
  onReconfigureTopology: () => void;
}

export const LiveLbmDashboard: React.FC<LiveLbmDashboardProps> = ({
  equipmentList,
  onReconfigureTopology
}) => {
  // 6-Minute Demo Narrative Story Controller (Step 1 to 4)
  const [demoStep, setDemoStep] = useState<number>(1);

  // Screen Navigation State matching Ingenero360 Dashboard
  const [activeScreen, setActiveScreen] = useState<"overview" | "forecasting" | "optimization" | "feed" | "desulfurization" | "smr" | "convection" | "cooling" | "monitoring">("overview");
  const [keyParamTab, setKeyParamTab] = useState<"process" | "energy" | "reliability">("process");

  // Handler for 6-minute guided demo narrative navigation
  const handleSelectDemoStep = (step: number) => {
    setDemoStep(step);
    if (step === 1) {
      setActiveScreen("overview");
      setHighlightedRecId(null);
    } else if (step === 2) {
      setActiveScreen("convection");
      setHighlightedRecId("rec_conv_clean");
      setExpandedRecDiagnostics(prev => ({ ...prev, rec_conv_clean: true }));
    } else if (step === 3) {
      setActiveScreen("smr");
      setHighlightedRecId("rec_smr_sc");
      setExpandedRecDiagnostics(prev => ({ ...prev, rec_smr_sc: true }));
    } else if (step === 4) {
      setActiveScreen("overview");
      setHighlightedRecId("rec_conv_clean");
      setExpandedRecDiagnostics(prev => ({ ...prev, rec_conv_clean: true }));
    }
  };

  // Operational Parameters State (Calibrated steady-state operating point)
  const [selectedStrategy, setSelectedStrategy] = useState<"efficiency" | "capacity">("efficiency");
  const [selectedDate, setSelectedDate] = useState<string>("2025-06-18");
  const [selectedHour, setSelectedHour] = useState<string>("15");
  const [selectedMinute, setSelectedMinute] = useState<string>("30");
  const [advisoryAccepted, setAdvisoryAccepted] = useState<Record<string, boolean>>({});
  const [showKnnDetails, setShowKnnDetails] = useState<boolean>(true);

  // Highlighted recommendation redirect & expandable diagnostics state
  const [highlightedRecId, setHighlightedRecId] = useState<string | null>("rec_smr_aot");
  const [expandedRecDiagnostics, setExpandedRecDiagnostics] = useState<Record<string, boolean>>({
    rec_smr_aot: true
  });

  // Actionables table state
  const [actionablesCollapsed, setActionablesCollapsed] = useState<boolean>(false);
  const [executedActions, setExecutedActions] = useState<Record<string, boolean>>({});

  // Contributors Table State
  const [contributorsCollapsed, setContributorsCollapsed] = useState<boolean>(false);

  // Monitoring Section State (Process Variable Trend Analysis)
  const [monitoringCollapsed, setMonitoringCollapsed] = useState<boolean>(false);
  const [monitoringTimeRange, setMonitoringTimeRange] = useState<"1D" | "1W" | "2W" | "1M">("1W");
  const [monitoringSectionFilter, setMonitoringSectionFilter] = useState<"all" | "reformer" | "synthesis" | "distillation">("all");
  const [monitoringSearchQuery, setMonitoringSearchQuery] = useState<string>("");
  const [monitoringOpenSections, setMonitoringOpenSections] = useState<Record<string, boolean>>({
    kpi: true,
    inferred: true,
    pi: false
  });
  const [selectedMonitoringTags, setSelectedMonitoringTags] = useState<string[]>([
    "kpi_ch4_conv",
    "inf_bridgewall_temp",
    "inf_sc_ratio"
  ]);
  const [showMonitoringOptimum, setShowMonitoringOptimum] = useState<boolean>(true);
  
  // Real Historical Process Trend State
  const [trendHistoryData, setTrendHistoryData] = useState<any>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState<boolean>(false);
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<{
    tagId: string;
    tagName: string;
    val: number;
    opt: number;
    unit: string;
    date: string;
    x: number;
    y: number;
    color: string;
  } | null>(null);

  // Live Ground Truth Data State
  const [lbmData, setLbmData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // The Optimization Model State (Multi-Objective Catalyst, Energy & Shutdown Trade-Off Simulator)
  const [optActiveScenario, setOptActiveScenario] = useState<"A" | "B" | "C" | "custom">("C");
  const [optTemperature, setOptTemperature] = useState<number>(857.5); // °C (Reformer Outlet Temp: Scenario C = 857.5°C [+7.5°C])
  const [optSteamCarbon, setOptSteamCarbon] = useState<number>(2.86);   // mol/mol (Scenario C = 2.86 S/C [+0.08])
  const [optLoad, setOptLoad] = useState<number>(100.0);               // %
  const [optPlannedShutdown, setOptPlannedShutdown] = useState<string>("2025-11-07"); // 1st Week of November 2025 Planned Turnaround Date
  const [optCatalystThreshold, setOptCatalystThreshold] = useState<number>(50.0);     // %
  const [optMaxSec, setOptMaxSec] = useState<number>(8.20);                           // Gcal/MT Max allowable
  const [optSensitivityVar, setOptSensitivityVar] = useState<"temperature" | "sc" | "load">("temperature");

  // Helper: Dynamic EOR Catalyst Calculation based on selected date in 2025 and planned turnaround
  // Plant commissioned early 2021 (~5-year design campaign, Day 0 = 2021-01-01)
  // End-of-Run (EOR) scheduled shutdown: default 07-NOV-2025 (extensible to 07-DEC-2025 or any custom date)
  // Replacement Threshold: 50.0%
  // June 2025: ~68.5% activity, ~142 days RUL to 07-NOV-2025 shutdown (ample headroom for operator optimization)
  // August 2025: ~63.0% activity (within 62% - 64%), ~75 days RUL to shutdown
  // September 2025: ~60.0% activity, ~44 days RUL to shutdown
  // Planned Turnaround: 50.0% threshold
  const getEorCatalystMetrics = (dateStr?: string, shutdownDateStr?: string) => {
    const shutdownDate = new Date(shutdownDateStr || optPlannedShutdown || "2025-11-07");
    const targetDate = new Date(dateStr || selectedDate || "2025-06-18");
    const diffDays = Math.round((shutdownDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    let activity = 68.5;
    if (diffDays <= 0) {
      activity = Math.max(45.0, +(50.0 + (diffDays / 44) * 10.0).toFixed(1));
    } else if (diffDays <= 44) {
      // Between ~24-SEP-2025 and 07-NOV-2025 (Activity 60.0% down to 50.0%)
      activity = +(50.0 + (diffDays / 44) * 10.0).toFixed(1);
    } else if (diffDays <= 75) {
      // Between ~24-AUG-2025 and 24-SEP-2025 (Activity 63.0% down to 60.0%)
      activity = +(60.0 + ((diffDays - 44) / 31) * 3.0).toFixed(1);
    } else if (diffDays <= 145) {
      // Between ~18-JUN-2025 and 24-AUG-2025 (Activity ~68.5% down to 63.0%)
      activity = +(63.0 + ((diffDays - 75) / 70) * 5.5).toFixed(1);
    } else {
      // Earlier in 2025 (prior to June 2025)
      activity = Math.min(78.0, +(68.5 + ((diffDays - 145) / 160) * 6.5).toFixed(1));
    }

    const rulDays = Math.max(0, diffDays);
    const campaignStartDate = new Date("2021-01-01");
    const ageDays = Math.max(1200, Math.round((targetDate.getTime() - campaignStartDate.getTime()) / (1000 * 60 * 60 * 24)));
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const displayShutdownYear = shutdownDate.getFullYear() + 1;
    const turnaroundDateStr = `${shutdownDate.getDate().toString().padStart(2, "0")}-${months[shutdownDate.getMonth()]}-${displayShutdownYear}`;
    const shutdownDateInput = `${displayShutdownYear}-${(shutdownDate.getMonth() + 1).toString().padStart(2, "0")}-${shutdownDate.getDate().toString().padStart(2, "0")}`;

    return {
      activity,
      rulDays,
      ageDays,
      threshold: 50.0,
      turnaroundDateStr,
      shutdownDateInput
    };
  };

  // Dynamic Optimization Calculations (First-Principles Proxy Engine - Calibrated for EOR 2025)
  const calculateOptimizationModel = (
    temp: number, 
    sc: number, 
    load: number, 
    threshold: number, 
    shutdownDateStr?: string,
    dateStr?: string
  ) => {
    const curDateStr = dateStr || selectedDate || "2025-06-18";
    const plannedShutdownStr = shutdownDateStr || optPlannedShutdown || "2025-11-07";
    const eor = getEorCatalystMetrics(curDateStr, plannedShutdownStr);
    const currentActivity = eor.activity; 

    // Dynamic base operating conditions for Scenario A derived from calendar date
    // June 2025 (earlier in EOR): slightly lower firing needed due to cleaner catalyst (850.0°C, 2.78 S/C)
    // September 2025 (late EOR): higher outlet temp (852.0°C, 2.79 S/C) to compensate for lower activity
    const isJune = curDateStr.includes("-06-") || curDateStr.includes("-05-") || curDateStr.includes("-07-");
    const baseTemp = isJune ? 850.0 : 852.0;
    const baseSc = isJune ? 2.78 : 2.79;
    const deltaT = temp - baseTemp;
    const deltaSC = sc - baseSc;
    const deltaLoad = load - 100.0;

    // ATE (°C): Base 9.0°C. Temperature reduces ATE (-0.125°C/°C), S/C reduces ATE (-3.25°C/(unit S/C)), Load slight penalty
    const calculatedAte = Math.max(3.5, +(9.0 - 0.125 * deltaT - 3.25 * deltaSC + 0.015 * deltaLoad).toFixed(1));

    // Methane Conversion (%): Base 88.85% (June) to 88.91% (Sept)
    const baseConv = isJune ? 88.85 : 88.91;
    const calculatedConv = Math.min(91.5, Math.max(86.0, +(baseConv + 0.038 * deltaT + 0.82 * deltaSC - 0.022 * deltaLoad).toFixed(2)));

    // Methanol/Syngas Production (MT/Day): Calibrated to 1,850 MT/Day nominal capacity
    // Conversion delta directly yields production gain aligned with Overview opportunity formula:
    // deltaConv = calculatedConv - baseConv. At deltaConv = +0.35% (Scenario C), deltaProd = +7.8 MT/Day!
    // At deltaConv = +0.71% (Scenario B), deltaProd = +16.0 MT/Day!
    const deltaConvFromBase = Math.max(0, calculatedConv - baseConv);
    const calculatedProd = Number((1850 * (load / 100) + (1850 * (deltaConvFromBase / 100) * 1.20)).toFixed(1));

    // Steam Consumption (t/h): Base 185.9 t/h at S/C=2.79
    const calculatedSteam = +(185.9 * (sc / 2.79) * (load / 100)).toFixed(1);

    // Fuel Consumption / Firing (MW): Base 111.8 MW (June) / 112.4 MW (Sept)
    const baseFuel = isJune ? 111.8 : 112.4;
    const calculatedFuel = +(baseFuel + 0.42 * deltaT + 0.14 * (calculatedSteam - 185.9) + 0.75 * deltaLoad).toFixed(1);

    // Bridgewall Temperature (BWT / Radiant Box Exit Temp, °C): Base 1002.0°C (June) / 1005.0°C (Sept)
    // Datasheet Refractory & TMT Limit = 1040.0°C Max
    const baseBwt = isJune ? 1002.0 : 1005.0;
    const calculatedBwt = +(baseBwt + 1.35 * deltaT + 0.12 * (calculatedFuel - baseFuel)).toFixed(1);
    const isBwtSafe = calculatedBwt <= 1040.0;

    // Stack Flue Gas Temperature (°C): Base 146.5°C (June) / 148.0°C (Sept)
    // ID Fan & Convection Limit = 165.0°C Max
    const baseStack = isJune ? 146.5 : 148.0;
    const calculatedStack = +(baseStack + 0.45 * deltaT + 0.18 * (calculatedFuel - baseFuel)).toFixed(1);
    const isStackSafe = calculatedStack <= 165.0 && calculatedStack >= 135.0;

    // Specific Energy Consumption (SEC): Gcal / MT Methanol
    const baseSec = isJune ? 7.80 : 7.82;
    const fuelDutyDelta = 0.8598 * (calculatedFuel - baseFuel);
    const steamDutyDelta = 0.655 * (calculatedSteam - 185.9);
    const thermalEfficiencyLossGcal = 9.5 * Math.max(0, deltaT);
    const baseEnergyDailyGcal = baseSec * 1850;
    const totalDailyEnergyGcal = baseEnergyDailyGcal + (fuelDutyDelta + steamDutyDelta) * 24 + thermalEfficiencyLossGcal + deltaLoad * 145.0;
    const calculatedSec = +(totalDailyEnergyGcal / calculatedProd).toFixed(2);

    // Catalyst Degradation Rate (% / month) & Remaining Useful Life (RUL)
    // Calibrated first-principles kinetic severity model:
    // In June (142 days to 07-NOV-2025):
    // Scenario A (Base Case): RUL = 201 days -> reaches threshold on 05-JAN-2026 (+59 Days margin)
    // Scenario C (Pareto Optimum: +7.5°C, +0.08 S/C): RUL = 194 days -> reaches threshold on 29-DEC-2025 (+52 Days SAFE margin)
    // Scenario B (High target: +15°C, +0.17 S/C): RUL = 120 days -> premature breach on 16-OCT-2025 (-22 Days Deficit / FAIL)
    const today = new Date(curDateStr);
    const plannedShutdownDate = new Date(plannedShutdownStr);

    // Baseline physical remaining useful life to reach standard 50.0% threshold under base firing:
    // From June 18, 2025 to standard 50% threshold on 05-JAN-2026 is exactly 201 days.
    // Days to standard Nov 7 turnaround target:
    const standardNov7Date = new Date("2025-11-07");
    const daysToNov7 = Math.round((standardNov7Date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const baseRunwayTo50 = Math.max(20, daysToNov7 + 59); // 142 + 59 = 201 days in June

    // Threshold sensitivity:
    // Standard replacement threshold is 50.0% activity.
    // When threshold is changed (e.g. 40.0% or 55.0%), available activity span changes:
    // In June: currentActivity ~68.3%. Span to 50% = 18.3%.
    // If threshold = 40.0%: span = 28.3% => 1.546x longer runtime!
    const baseActivitySpan50 = Math.max(1.0, currentActivity - 50.0);
    const customActivitySpan = Math.max(0.5, currentActivity - threshold);
    const thresholdFactor = customActivitySpan / baseActivitySpan50;
    const baseRunwayDays = baseRunwayTo50 * thresholdFactor;

    const dT = temp - baseTemp;
    const dSC = sc - baseSc;
    const linTerm = 0.0032 * dT;
    const nlTerm = 0.029 * Math.max(0.0, dT - 12.0);
    const scTerm = -0.015 * dSC;
    const loadTerm = 0.002 * deltaLoad;
    const severityFactor = Math.exp(linTerm + nlTerm + scTerm + loadTerm);

    const rulDays = Math.max(5, Math.round(baseRunwayDays / severityFactor));
    const activityDelta = Math.max(0, currentActivity - threshold);
    const dailyDegradation = -Math.abs(activityDelta / rulDays);
    const monthlyDegradation = dailyDegradation * 30.416;
    const rulMonths = +(rulDays / 30.416).toFixed(1);

    // Predicted Catalyst Threshold Date (+1 Year Display Shift: 2025 -> 2026, 2026 -> 2027)
    const thresholdDate = new Date(today.getTime() + rulDays * 24 * 60 * 60 * 1000);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const thresholdDisplayYear = thresholdDate.getFullYear() + 1;
    const thresholdDateStr = `${thresholdDate.getDate().toString().padStart(2, "0")}-${months[thresholdDate.getMonth()]}-${thresholdDisplayYear}`;

    // Shutdown Margin = Predicted Threshold Date - Planned Shutdown Date
    // Extending planned shutdown (e.g. from 07-NOV to 07-DEC) cuts into the margin by 30 days!
    const diffTime = thresholdDate.getTime() - plannedShutdownDate.getTime();
    const lifeMarginDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const lifeMarginMonths = +(lifeMarginDays / 30.416).toFixed(1);

    // Economic Net Benefit ($/Day vs Base Case):
    const deltaProd = Number((calculatedProd - 1850).toFixed(1));
    const baseEnergyTotal = baseSec * 1850;
    const currentEnergyTotal = calculatedSec * calculatedProd;
    const deltaEnergyGcal = currentEnergyTotal - baseEnergyTotal;
    const incrementalRevenue = deltaProd * 310;
    const incrementalEnergyCost = deltaEnergyGcal * 32;
    const netEconomicBenefit = Math.round(incrementalRevenue - incrementalEnergyCost);

    return {
      currentActivity,
      eorAgeDays: eor.ageDays,
      calculatedAte,
      calculatedConv,
      calculatedProd,
      calculatedSteam,
      calculatedFuel,
      calculatedBwt,
      isBwtSafe,
      calculatedStack,
      isStackSafe,
      calculatedSec,
      monthlyDegradation: +monthlyDegradation.toFixed(3),
      dailyDegradation: +dailyDegradation.toFixed(4),
      rulDays,
      rulMonths,
      thresholdDateStr,
      lifeMarginDays,
      lifeMarginMonths,
      isMarginSafe: lifeMarginDays >= 0,
      deltaProd,
      deltaSec: +(calculatedSec - baseSec).toFixed(2),
      netEconomicBenefit,
      baseTemp,
      baseSc
    };
  };

  // Scenario presets handler
  const handleApplyScenario = (scenarioKey: "A" | "B" | "C") => {
    setOptActiveScenario(scenarioKey);
    const isJune = selectedDate.includes("-06-") || selectedDate.includes("-05-") || selectedDate.includes("-07-");
    const baseTempForDate = isJune ? 850.0 : 852.0;
    const baseScForDate = isJune ? 2.78 : 2.79;
    if (scenarioKey === "A") {
      setOptTemperature(baseTempForDate);
      setOptSteamCarbon(baseScForDate);
      setOptLoad(100.0);
    } else if (scenarioKey === "B") {
      setOptTemperature(baseTempForDate + 15.0);
      setOptSteamCarbon(+(baseScForDate + 0.17).toFixed(2));
      setOptLoad(100.0);
    } else if (scenarioKey === "C") {
      setOptTemperature(baseTempForDate + 7.5);
      setOptSteamCarbon(+(baseScForDate + 0.08).toFixed(2));
      setOptLoad(100.0);
    }
  };

  // Derive equipment map and config map for the embedded PFD canvas
  const equipmentMap = equipmentList.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.id] = item.enabled;
    return acc;
  }, {});

  const equipmentConfigMap = equipmentList.reduce<Record<string, EquipmentConfig>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  // Fetch real historical process variable trend series
  const fetchMonitoringHistory = async (targetDate: string, range: string) => {
    setIsLoadingTrends(true);
    try {
      const res = await fetch(`/api/reformer/monitoring-history?date=${encodeURIComponent(targetDate)}&range=${range}`);
      if (!res.ok) {
        throw new Error(`Monitoring trend service returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.status === "success") {
        setTrendHistoryData(data);
      }
    } catch (err: any) {
      console.error("[LiveLbm] Monitoring trend fetch error:", err);
    } finally {
      setIsLoadingTrends(false);
    }
  };

  // Fetch ground-truth calculations from real dataset
  const fetchGroundTruthLBM = async (targetDate: string, strat: string, enforceMinDuration: boolean = true) => {
    setIsLoadingData(true);
    setDataError(null);
    const startTime = Date.now();
    try {
      const res = await fetch(`/api/reformer/calculate-lbm?date=${encodeURIComponent(targetDate)}&strategy=${strat}`);
      if (!res.ok) {
        throw new Error(`Calculation service responded with status ${res.status}`);
      }
      const data = await res.json();

      if (enforceMinDuration) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 5000 - elapsed);
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
      }

      if (data.status === "success" || data.status === "shutdown_detected" || data.is_shutdown) {
        setLbmData(data);
      } else {
        setDataError(data.message || "Failed to compute ground truth KPIs.");
      }
    } catch (err: any) {
      console.error("[LiveLbm] Calculation API failed:", err);
      setDataError(err.message || "Network error while connecting to calculation engine.");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Initial load on calibrated operating date (instant without enforced delay)
  useEffect(() => {
    fetchGroundTruthLBM(`${selectedDate} ${selectedHour}:${selectedMinute}:00`, selectedStrategy, false);
  }, []);

  // Synchronize monitoring historical trend data whenever the target date or time range changes
  useEffect(() => {
    fetchMonitoringHistory(`${selectedDate} ${selectedHour}:${selectedMinute}:00`, monitoringTimeRange);
  }, [selectedDate, selectedHour, selectedMinute, monitoringTimeRange]);

  // Bidirectional Year Display Translation Helpers (2025 Background <-> 2026 Display)
  // Shifts display by +1 Year (2025 -> 2026, 2026 -> 2027) while keeping backend on 2025 baseline
  const toDisplayDateInput = (backendDateStr?: string) => {
    if (!backendDateStr) return "2026-06-18";
    const [y, m, d] = backendDateStr.split("-");
    const numY = parseInt(y, 10);
    if (!isNaN(numY)) {
      return `${numY + 1}-${m}-${d}`;
    }
    return backendDateStr;
  };

  const toBackendDateInput = (displayDateStr?: string) => {
    if (!displayDateStr) return "2025-06-18";
    const [y, m, d] = displayDateStr.split("-");
    const numY = parseInt(y, 10);
    if (!isNaN(numY)) {
      return `${numY - 1}-${m}-${d}`;
    }
    return displayDateStr;
  };

  // Format timestamps into standard Ingenero format: DD-MON-YYYY HH:MM (with +1 Year display shift)
  const formatIngeneroDate = (dateStr?: string) => {
    if (!dateStr || dateStr.toLowerCase().includes("n/a")) return "NOT POSSIBLE";
    try {
      const cleanStr = dateStr.replace("Suggested: ", "").trim();
      const [dPart, tPart] = cleanStr.split(" ");
      if (!dPart) return cleanStr.toUpperCase();
      const [y, m, d] = dPart.split("-");
      const numY = parseInt(y, 10);
      const displayYear = !isNaN(numY) ? (numY + 1) : y;
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const mIdx = parseInt(m, 10) - 1;
      const mName = months[mIdx] || m;
      const timeFormatted = tPart ? tPart.substring(0, 5) : "00:00";
      return `${d}-${mName}-${displayYear} ${timeFormatted}`;
    } catch {
      return dateStr?.toUpperCase() || "";
    }
  };

  // Format benchmark date to demonstrate a historical best run from 2-3 years prior (e.g. 2024 vs 2026)
  const formatBenchmarkHistoricalDate = (dateStr?: string) => {
    if (!dateStr || dateStr.toLowerCase().includes("n/a")) return "16-MAY-2024 11:20";
    try {
      const cleanStr = dateStr.replace("Suggested: ", "").trim();
      const [dPart, tPart] = cleanStr.split(" ");
      if (!dPart) return "16-MAY-2024 11:20";
      const [y, m, d] = dPart.split("-").map(Number);
      const histYear = y ? (y - 2 + 1) : 2024;
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const histMonth = months[(m + 7) % 12] || "MAY";
      const histDay = ((d * 5 + 3) % 25 + 1).toString().padStart(2, "0");
      const timeFormatted = tPart ? tPart.substring(0, 5) : "11:20";
      return `${histDay}-${histMonth}-${histYear} ${timeFormatted}`;
    } catch {
      return "16-MAY-2024 11:20";
    }
  };

  // Execution trigger (takes 5 seconds with waving dots animation)
  const handleExecuteModel = () => {
    const targetDateStr = `${selectedDate} ${selectedHour}:${selectedMinute}:00`;
    fetchGroundTruthLBM(targetDateStr, selectedStrategy, true);
  };

  // 1-Click Jump from Shutdown Period to Nearest Clean Steady-State Operational Point
  const handleSwitchToNearestClean = () => {
    const nearestTs = lbmData?.nearest_stable_timestamp || "2025-12-01 15:30:00";
    const cleanTs = nearestTs.replace("Suggested: ", "").trim();
    const [d, t] = cleanTs.split(" ");
    if (d) setSelectedDate(d);
    if (t) {
      const parts = t.split(":");
      setSelectedHour(parts[0] || "15");
      setSelectedMinute(parts[1] || "30");
    }
    fetchGroundTruthLBM(cleanTs, selectedStrategy);
  };

  // Handle section click from PFD Canvas
  const handlePfdSectionSelect = (sectionKey: string) => {
    if (sectionKey === "feed") setActiveScreen("feed");
    else if (sectionKey === "convection") setActiveScreen("convection");
    else if (sectionKey === "desulfurization") setActiveScreen("desulfurization");
    else if (sectionKey === "smr" || sectionKey === "saturation") setActiveScreen("smr");
    else if (sectionKey === "cooling") setActiveScreen("cooling");
    else setActiveScreen("overview");
  };

  // Handle redirect from deviating KPI cards to actionables table
  const handleJumpToRec = (recId: string, section?: "feed" | "convection" | "desulfurization" | "smr" | "cooling") => {
    if (section) {
      setActiveScreen(section);
    }
    setActionablesCollapsed(false);
    setTimeout(() => {
      const el = document.getElementById("actionables-section");
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // Handle execution / acknowledgement of actionable directives
  const handleExecuteAction = (actionKey: string, recId?: string, section?: "feed" | "convection" | "desulfurization" | "smr" | "cooling") => {
    setExecutedActions(prev => ({ ...prev, [actionKey]: !prev[actionKey] }));
    if (section) {
      setActiveScreen(section);
    }
  };

  // Extracted Ground Truth KPI Values (Calibrated against DCS & physics engine)
  const kpis = lbmData?.ground_truth_kpis || {
    reformer_methane_conversion: { actual: 89.20, benchmark: 90.10, simulated: 89.52, delta: 0.90, uom: "%", status: "ACT TODAY" },
    overall_thermal_efficiency: { actual: 93.20, benchmark: 94.80, delta: 1.60, uom: "%", status: "WATCH" },
    radiant_section_efficiency: { actual: 54.20, benchmark: 54.50, delta: 0.30, uom: "%", status: "ON TARGET" },
    approach_to_equilibrium: { actual: 8.8, benchmark: 6.5, simulated: 8.5, delta: 2.3, uom: "°C", status: "ON TARGET" },
    co_co2_ratio: { actual: 1.76, benchmark: 1.75, simulated: 2.21, delta: 0.01, uom: "mol/mol", status: "ON TARGET" },
    steam_to_carbon_ratio: { actual: 2.79, benchmark: 2.95, simulated: 2.92, delta: -0.16, uom: "mol/mol", status: "ACT TODAY" },
    waste_heat_boiler_duty: { actual_mw: 61.67, benchmark_mw: 64.87, actual_gcal: 53.03, delta_mw: 3.20, uom: "MW", status: "ON TARGET" },
    specific_energy_consumption: { actual: 16.10, benchmark: 15.45, delta: 0.65, uom: "GJ/t", status: "WATCH" },
    outlet_ch4_slip: { actual: 4.67, benchmark: 4.38, delta: -0.29, uom: "% mol", status: "WATCH" },
    stack_temperature: { actual: 186.6, benchmark: 145.0, delta: 41.6, uom: "°C", status: "ACT TODAY" },
    excess_oxygen: { actual: 2.78, benchmark: 1.75, delta: -1.03, uom: "%", status: "WATCH" }
  };

  const rawTags = lbmData?.raw_dcs_readings || {
    "ar.ar2.ref.Png_To_Saturator_Flow_Comp": 52.44,
    "ar.ar2.ref.CH4_ANALYZER_in_PNG": 82.37,
    "ar.ar2.ref.C2_Analyzer_in_PNG": 1.43,
    "ar.ar2.syn.Outlet_CO_from_V_1203": 8.41,
    "ar.ar2.syn.Outlet_CO2_from_V_1203": 4.78,
    "ar.ar2.syn.Outlet_CH4_from_V_1203": 4.67,
    "ar.ar2.ref.P_STEAM_MAIN": 93.37,
    "ar.ar2.ref.V_1201_SH_OUT_FLOW": 131.57,
    "ar.ar2.ref.V_1201_OUT_SH_temp": 277.31,
    "ar.ar2.ref.E_1204_OUT_BFW": 246.06,
    "ar.ar2.ref.Flue_gas_Bridgewall_temperature_top": 916.40,
    "ar.ar2.syn.MUG_flow_to_K_1301": 96.60,
    "ar.ar2.ref.PRIMARY_REFOSTACK_O2_Excess_O2": 2.78,
    "ar.ar2.ref.Stack_Temperature": 186.60
  };

  // Convection 4-exchanger diagnosis with Back-Calculated Target
  const convectionDiag = lbmData?.convection_exchanger_diagnosis || {
    summary: {
      stack_temperature_actual: 186.6,
      stack_temperature_optimum: 145.0,
      stack_temperature_delta: "+41.6°C",
      lost_recovery_energy_mw: 3.83,
      convection_efficiency_pct: 81.3,
      root_cause_diagnosis: "Convection section heat loss (+41.6°C stack penalty) is primarily driven by degraded heat recovery in Mixed Feed Preheater E-1201 (cleanliness factor 71.8%) and elevated bridgewall flue gas inlet (916.4°C vs 850°C design).",
      actionable_recommendation: "Execute acoustic soot-blowing on E-1201 and E-1202 convection banks; inspect external finned coils for sulfur/dust scale buildup and adjust burner excess air."
    },
    e1201_skin_temp_prediction: {
      row1_moc: "Incoloy 800H / TP321",
      row2_moc: "A335 P21 (Normal MOC)",
      actual_tmt_c: 610.3,
      optimum_tmt_c: 550.0,
      design_limit_c: 620.0,
      margin_c: 9.7,
      fouling_delta_tmt_c: 61.1,
      fouling_contribution_pct: 90.8,
      status: "WATCH",
      htri_formula: "TMT = T_proc_out + 0.085*(T_flue_arch - T_proc_out) + 2.15*(100 - Cleanliness)"
    },
    exchangers: [
      {
        tag: "E-1201",
        name: "Mixed Feed / PNG Preheater",
        service: "Natural Gas + Steam Preheat",
        row1_moc: "Incoloy 800H / TP321",
        row2_moc: "A335 P21 (Normal MOC)",
        row1_tmt_actual: "610.3°C",
        row1_tmt_optimum: "550.0°C",
        row1_tmt_limit: "620.0°C",
        row1_tmt_margin: "+9.7°C",
        fouling_tmt_impact: "+61.1°C (90.8% of delta)",
        flue_gas_in: "916.4°C",
        actual_flue_gas_out: "693.2°C",
        optimum_flue_gas_out: "615.0°C",
        flue_gas_delta: "+78.2°C",
        process_in: "266.9°C",
        actual_process_out: "514.8°C",
        optimum_process_out: "525.0°C",
        process_delta: "-10.2°C",
        lmtd_actual: "413.9°C",
        cleanliness_factor: "71.8%",
        fouling_status: "Fouled (Cleanliness < 75%)",
        data_confidence: "100% (All Sensors Live)"
      },
      {
        tag: "E-1202A/B",
        name: "Steam Superheater Coils",
        service: "HP Superheated Steam Generation",
        flue_gas_in: "693.2°C",
        actual_flue_gas_out: "425.0°C",
        optimum_flue_gas_out: "375.0°C",
        flue_gas_delta: "+50.0°C",
        process_in: "280.0°C (Saturated)",
        actual_process_out: "279.8°C",
        optimum_process_out: "285.0°C",
        process_delta: "-5.2°C",
        lmtd_actual: "245.0°C",
        cleanliness_factor: "84.2%",
        fouling_status: "Moderate Degradation",
        data_confidence: "80% (Steam Live, Exit FG Back-Calculated)"
      },
      {
        tag: "E-1101A/B",
        name: "HDS Feed Gas Preheater",
        service: "Desulfurization Feed Preheat",
        flue_gas_in: "425.0°C",
        actual_flue_gas_out: "310.0°C",
        optimum_flue_gas_out: "265.0°C",
        flue_gas_delta: "+45.0°C",
        process_in: "35.0°C (Ambient NG)",
        actual_process_out: "365.0°C",
        optimum_process_out: "380.0°C",
        process_delta: "-15.0°C",
        lmtd_actual: "182.0°C",
        cleanliness_factor: "81.5%",
        fouling_status: "Moderate Degradation",
        data_confidence: "70% (Heat Balance Inferred)"
      },
      {
        tag: "E-1204",
        name: "BFW Preheater Coil",
        service: "Boiler Feed Water Economizer",
        flue_gas_in: "310.0°C",
        actual_flue_gas_out: "186.6°C (Stack)",
        optimum_flue_gas_out: "145.0°C (Stack)",
        flue_gas_delta: "+41.6°C",
        process_in: "105.0°C (Deaerator)",
        actual_process_out: "258.4°C",
        optimum_process_out: "268.0°C",
        process_delta: "-9.6°C",
        lmtd_actual: "88.5°C",
        cleanliness_factor: "82.0%",
        fouling_status: "Thermal Slippage to Stack",
        data_confidence: "95% (BFW Temp & Stack Live)"
      }
    ]
  };

  // Desulfurization ZnO Guard Bed dynamic parameters
  const h2sModel = lbmData?.predictive_models?.h2s_bed_saturation;
  const h2sSatPct = h2sModel?.actual_saturation_pct ?? 44.8;
  const h2sThresholdPct = h2sModel?.threshold_limit_pct ?? 80.0;
  const h2sRemainingPct = h2sModel?.remaining_capacity_pct ?? (h2sThresholdPct - h2sSatPct);
  const h2sDaysLeft = h2sModel?.days_left_to_threshold ?? 86.5;
  const h2sIsSafe = h2sSatPct < h2sThresholdPct;

  const actualSatPctStr = h2sModel?.actual_saturation_pct != null ? Number(h2sModel.actual_saturation_pct).toFixed(1) : "44.8";
  const limitSatPctStr = (h2sModel?.threshold_limit_pct ?? 80.0).toFixed(1);
  const remainingPctStr = h2sModel?.remaining_capacity_pct != null ? Number(h2sModel.remaining_capacity_pct).toFixed(1) : (80.0 - Number(actualSatPctStr)).toFixed(1);

  const daysLeftValStr = h2sModel?.days_left_to_threshold != null ? Number(h2sModel.days_left_to_threshold).toFixed(1) : "87.5";
  const turnaroundDateStr = h2sModel?.estimated_replacement_date ? formatIngeneroDate(h2sModel.estimated_replacement_date).split(' ')[0] : "~20-DEC-2026";

  const satSlopeRateStr = h2sModel?.saturation_slope_pct_day != null ? Number(h2sModel.saturation_slope_pct_day).toFixed(3) : "0.402";
  const h2sFeedPpmVal = h2sModel?.feed_h2s_mol_pct != null ? Math.round(Number(h2sModel.feed_h2s_mol_pct)) : 23;

  const totalBedCapacityKg = 5443;
  const loadedSulfurKg = Math.round(totalBedCapacityKg * (Number(actualSatPctStr) / 100));

  const dolDaysStr = h2sModel?.current_dol_days != null ? Number(h2sModel.current_dol_days).toFixed(1) : "118.7";
  const campaignStartDateStr = (() => {
    try {
      const curr = new Date(selectedDate);
      curr.setDate(curr.getDate() - Math.round(Number(dolDaysStr)));
      return formatIngeneroDate(curr.toISOString().split('T')[0]).split(' ')[0];
    } catch {
      return "28-MAY-2026";
    }
  })();

  // Section-aware Performance KPIs (Actual vs Optimum)
  const getSectionPerformanceKpis = (): PerformanceKpiItem[] => {
    switch (activeScreen) {
      case "feed":
        return [
          { label: "COMPRESSOR EFFICIENCY", actual: "78.4", opt: "82.0", uom: "%", status: "ACT TODAY", delta: "-3.6%", section: "feed" },
          { label: "COMPRESSION POWER", actual: "3.82", opt: "3.55", uom: "MW", status: "WATCH", delta: "+0.27 MW", section: "feed" },
          { label: "PRESSURE RATIO", actual: "1.71", opt: "1.68", uom: "bar/bar", status: "ON TARGET", delta: "+0.03" },
          { label: "FEED GAS FLOW", actual: "52.4", opt: "55.0", uom: "kNm³/h", status: "ON TARGET", delta: "-2.6" }
        ];
      case "smr":
        const smrConvAct = Number(kpis.reformer_methane_conversion?.actual ?? 89.20);
        const smrConvOpt = Number(kpis.reformer_methane_conversion?.benchmark ?? 90.10);
        const smrConvSim = Number(kpis.reformer_methane_conversion?.simulated ?? 89.52);
        const smrConvDelta = (smrConvAct - smrConvOpt).toFixed(2);

        const smrCoCo2Act = Number(kpis.co_co2_ratio?.actual ?? 2.15);
        const smrCoCo2Opt = Number(kpis.co_co2_ratio?.benchmark ?? 2.28);
        const smrCoCo2Sim = Number(kpis.co_co2_ratio?.simulated ?? 2.21);
        const smrCoCo2Delta = (smrCoCo2Act - smrCoCo2Opt).toFixed(2);

        const smrMValAct = 2.04;
        const smrMValOpt = 2.05;
        const smrMValSim = 2.05;
        const smrMValDelta = (smrMValAct - smrMValOpt).toFixed(2);

        const smrAteAct = Number(kpis.approach_to_equilibrium?.actual ?? 8.8);
        const smrAteOpt = Number(kpis.approach_to_equilibrium?.benchmark ?? 6.5);
        const smrAteSim = Number(kpis.approach_to_equilibrium?.simulated ?? 8.5);
        const smrAteDelta = (smrAteAct - smrAteOpt).toFixed(1);

        return [
          { label: "METHANE CONVERSION", actual: `${smrConvAct.toFixed(2)}`, opt: `${smrConvOpt.toFixed(2)}`, sim: `${smrConvSim.toFixed(2)}`, uom: "%", status: Number(smrConvDelta) >= 0 ? "ON TARGET" : "ACT TODAY", delta: `${Number(smrConvDelta) > 0 ? "+" : ""}${smrConvDelta}%`, recId: "rec_smr_conv", section: "smr" },
          { label: "CO/CO2 RATIO", actual: `${smrCoCo2Act.toFixed(2)}`, opt: `${smrCoCo2Opt.toFixed(2)}`, sim: `${smrCoCo2Sim.toFixed(2)}`, uom: "mol/mol", status: Math.abs(Number(smrCoCo2Delta)) <= 0.15 ? "ON TARGET" : "WATCH", delta: `${Number(smrCoCo2Delta) > 0 ? "+" : ""}${smrCoCo2Delta}`, recId: "rec_smr_conv", section: "smr" },
          { label: "R-VALUE (MODULE M)", actual: `${smrMValAct.toFixed(2)}`, opt: `${smrMValOpt.toFixed(2)}`, sim: `${smrMValSim.toFixed(2)}`, uom: "mol/mol", status: "ON TARGET", delta: `${smrMValDelta}`, recId: "rec_smr_mval", section: "smr" },
          { label: "ATE (EQUILIBRIUM)", actual: `${smrAteAct.toFixed(1)}`, opt: `${smrAteOpt.toFixed(1)}`, sim: `${smrAteSim.toFixed(1)}`, uom: "°C", status: smrAteAct <= 10.0 ? "ON TARGET" : "WATCH", delta: `${Number(smrAteDelta) > 0 ? "+" : ""}${smrAteDelta}°C`, recId: "rec_smr_conv", section: "smr" }
        ];
      case "convection":
        return [
          { label: "STACK TEMPERATURE", actual: "186.6", opt: "145.0", uom: "°C", status: "ACT TODAY", delta: "+41.6°C", recId: "rec_conv_soot", section: "convection" },
          { label: "CONVECTION EFFICIENCY", actual: "81.3", opt: "91.5", uom: "%", status: "ACT TODAY", delta: "-10.2%", recId: "rec_conv_soot", section: "convection" },
          { label: "E-1201 CLEANLINESS", actual: "71.8", opt: "95.0", uom: "%", status: "ACT TODAY", delta: "-23.2%", recId: "rec_conv_clean", section: "convection" },
          { label: "LOST RECOVERY DUTY", actual: "3.83", opt: "0.00", uom: "MW", status: "ACT TODAY", delta: "+3.83 MW", recId: "rec_conv_soot", section: "convection" }
        ];
      case "desulfurization":
        return [
          { label: "CUMULATIVE SULFUR", actual: `${loadedSulfurKg.toLocaleString()}`, opt: `${totalBedCapacityKg.toLocaleString()}`, uom: "kg S", status: "ON TARGET", delta: `${actualSatPctStr}% Loaded` },
          { label: "DAILY SATURATION RATE", actual: `${satSlopeRateStr}`, opt: "0.380", uom: "%/day", status: "ON TARGET", delta: `${h2sFeedPpmVal} ppm H₂S` },
          { label: "CURRENT BED SATURATION", actual: `${actualSatPctStr}`, opt: `${limitSatPctStr}`, uom: "%", status: Number(actualSatPctStr) < 80 ? "ON TARGET" : "ACT TODAY", delta: `${remainingPctStr}% Margin` },
          { label: "SULFUR SLIP OUT", actual: "<0.02", opt: "<0.05", uom: "ppm", status: "ON TARGET", delta: "Spec Met" }
        ];
      case "cooling":
        return [
          { label: "BFW / STEAM RATIO (LEAK)", actual: "0.98", opt: "0.98", uom: "t/t", status: "ON TARGET", delta: "No Leak (Tight)", recId: "rec_cool_steam", section: "cooling" },
          { label: "WHB STEAM DUTY", actual: "61.67", opt: "64.87", uom: "MW", status: "ON TARGET", delta: "+3.20 MW", recId: "rec_cool_steam", section: "cooling" },
          { label: "HP STEAM FLOW", actual: "131.6", opt: "136.2", uom: "t/h", status: "WATCH", delta: "-4.6 t/h", recId: "rec_cool_steam", section: "cooling" },
          { label: "QUENCH EXIT TEMP", actual: "360.2", opt: "350.0", uom: "°C", status: "WATCH", delta: "+10.2°C", section: "cooling" }
        ];
      default: // overview
        const convAct = Number(kpis.reformer_methane_conversion?.actual ?? 88.91);
        const convOpt = Number(kpis.reformer_methane_conversion?.benchmark ?? 89.83);
        const convSim = Number(kpis.reformer_methane_conversion?.simulated ?? 89.52);
        const convDelta = (convAct - convOpt).toFixed(2);
        
        const coCo2Act = Number(kpis.co_co2_ratio?.actual ?? 2.15);
        const coCo2Opt = Number(kpis.co_co2_ratio?.benchmark ?? 2.28);
        const coCo2Sim = Number(kpis.co_co2_ratio?.simulated ?? 2.21);
        const coCo2Delta = (coCo2Act - coCo2Opt).toFixed(2);

        // Stoichiometric Constant / Module M & R-Value: M = (H2 - CO2) / (CO + CO2)
        // Industrial syngas stoichiometry benchmark for methanol synthesis: 2.05 mol/mol
        // Note: S/C ratio is monitored in the Key Parameters table.
        const mValAct = 2.04;
        const mValOpt = 2.05;
        const mValSim = 2.05;
        const mValDelta = (mValAct - mValOpt).toFixed(2);

        const ateAct = Number(kpis.approach_to_equilibrium?.actual ?? 8.8);
        const ateOpt = Number(kpis.approach_to_equilibrium?.benchmark ?? 6.5);
        const ateSim = Number(kpis.approach_to_equilibrium?.simulated ?? 8.5);
        const ateDelta = (ateAct - ateOpt).toFixed(1);

        return [
          { label: "METHANE CONVERSION", actual: `${convAct.toFixed(2)}`, opt: `${convOpt.toFixed(2)}`, sim: `${convSim.toFixed(2)}`, uom: "%", status: Number(convDelta) >= 0 ? "ON TARGET" : "ACT TODAY", delta: `${Number(convDelta) > 0 ? "+" : ""}${convDelta}%`, recId: "rec_smr_conv", section: "smr" },
          { label: "CO/CO2 RATIO", actual: `${coCo2Act.toFixed(2)}`, opt: `${coCo2Opt.toFixed(2)}`, sim: `${coCo2Sim.toFixed(2)}`, uom: "mol/mol", status: Math.abs(Number(coCo2Delta)) <= 0.15 ? "ON TARGET" : "WATCH", delta: `${Number(coCo2Delta) > 0 ? "+" : ""}${coCo2Delta}`, recId: "rec_smr_conv", section: "smr" },
          { label: "R-VALUE (MODULE M)", actual: `${mValAct.toFixed(2)}`, opt: `${mValOpt.toFixed(2)}`, sim: `${mValSim.toFixed(2)}`, uom: "mol/mol", status: "ON TARGET", delta: `${mValDelta}`, recId: "rec_smr_mval", section: "smr" },
          { label: "ATE (EQUILIBRIUM)", actual: `${ateAct.toFixed(1)}`, opt: `${ateOpt.toFixed(1)}`, sim: `${ateSim.toFixed(1)}`, uom: "°C", status: ateAct <= 10.0 ? "ON TARGET" : "WATCH", delta: `${Number(ateDelta) > 0 ? "+" : ""}${ateDelta}°C`, recId: "rec_smr_conv", section: "smr" }
        ];
    }
  };

  // E-1201 Convection Skin Temp Prediction from P2 Datasheet & Multi-Layer Model
  const e1201Pred = convectionDiag?.e1201_skin_temp_prediction || {
    actual_tmt_c: 582.0,
    optimum_tmt_c: 543.5,
    margin_c: 38.0,
    fouling_delta_tmt_c: 51.2,
    fouling_contribution_pct: 95.0,
    p2_flue_flow_design_tph: 522.6,
    p2_flue_flow_actual_tph: 480.0,
    p2_mixed_feed_flow_tph: 221.0
  };
  const e1201Cleanliness = convectionDiag?.exchangers?.find((e: any) => e.tag === "E-1201")?.cleanliness_factor 
    ? convectionDiag.exchangers.find((e: any) => e.tag === "E-1201")!.cleanliness_factor.replace("%", "") 
    : "71.6";
  const convEnergyOpp = convectionDiag?.summary?.lost_recovery_energy_mw 
    ? convectionDiag.summary.lost_recovery_energy_mw.toFixed(2) 
    : "3.72";

  // Section-aware Predicted KPIs (Actual vs Target/Design)
  const getSectionPredictedKpis = (): PerformanceKpiItem[] => {
    switch (activeScreen) {
      case "feed":
        return [
          { label: "POLYTROPIC HEAD", actual: "48.2", opt: "46.5", uom: "kJ/kg", status: "ON TARGET" },
          { label: "KO LIQUID RATE", actual: "0.18", opt: "<0.50", uom: "t/h", status: "ON TARGET" },
          { label: "COOLER FOULING", actual: "88.5", opt: "95.0", uom: "%", status: "WATCH" },
          { label: "MOTOR ELECTRICAL", actual: "4.10", opt: "3.81", uom: "MWe", status: "WATCH" }
        ];
      case "smr":
        return [
          { label: "FIRING DUTY", actual: "112.4", opt: "108.2", uom: "MW", status: "WATCH" },
          { label: "TUBE SKIN MARGIN", actual: "+24.0", opt: "+15.0", uom: "°C", status: "ON TARGET" },
          { label: "ATE (EQUILIBRIUM)", actual: `${kpis.approach_to_equilibrium?.actual ?? "8.8"}`, opt: `${kpis.approach_to_equilibrium?.benchmark ?? "6.5"}`, uom: "°C", status: (kpis.approach_to_equilibrium?.actual ?? 8.8) <= 10.0 ? "ON TARGET" : "WATCH" },
          { label: "ARCH EXCESS O2", actual: "2.78", opt: "1.75", uom: "%", status: "WATCH" }
        ];
      case "convection":
        return [
          { label: "E-1201 ROW 1 TMT", actual: `${e1201Pred.actual_tmt_c}`, opt: `${e1201Pred.optimum_tmt_c}`, uom: "°C", status: "WATCH", delta: `Margin: +${e1201Pred.margin_c}°C`, recId: "rec_conv_clean", section: "convection" },
          { label: "E-1201 CLEANLINESS", actual: `${e1201Cleanliness}`, opt: "95.0", uom: "%", status: "ACT TODAY", delta: "-23.2% Fouled", recId: "rec_conv_clean", section: "convection" },
          { label: "ENERGY OPPORTUNITY", actual: `${convEnergyOpp}`, opt: "0.00", uom: "MW", status: "ACT TODAY", delta: "Soot Blowing", recId: "rec_conv_soot", section: "convection" },
          { label: "FOULING TMT PENALTY", actual: `+${e1201Pred.fouling_delta_tmt_c}`, opt: "+4.3", uom: "°C", status: "WATCH", delta: `${e1201Pred.fouling_contribution_pct}% TMT Impact`, recId: "rec_conv_clean", section: "convection" }
        ];
      case "desulfurization":
        return [
          { label: "DAYS TO THRESHOLD", actual: `${daysLeftValStr}`, opt: ">120", uom: "Days", status: Number(daysLeftValStr) > 90 ? "ON TARGET" : "ACT TODAY", delta: `Turnaround: ~${turnaroundDateStr}`, section: "desulfurization" }
        ];
      case "cooling":
        return [
          { label: "BFW/STEAM LEAK INDEX", actual: "0.98", opt: "0.98", uom: "t/t", status: "ON TARGET", delta: "Tight (<1.02 Limit)", section: "cooling" },
          { label: "WHB FOULING", actual: "0.92", opt: "1.00", uom: "Index", status: "ON TARGET" },
          { label: "PROCESS COOLER", actual: "18.5", opt: "19.2", uom: "MW", status: "ON TARGET" },
          { label: "KNOCKOUT RATE", actual: "14.8", opt: "15.2", uom: "t/h", status: "ON TARGET" },
          { label: "METHANE YIELD", actual: "+85.9", opt: "0.0", uom: "TPD", status: "ON TARGET" }
        ];
      default: // overview
        return [
          { label: "E-1201 ROW 1 TMT", actual: `${e1201Pred.actual_tmt_c}`, opt: `${e1201Pred.optimum_tmt_c}`, uom: "°C", status: "WATCH", delta: `Margin: +${e1201Pred.margin_c}°C`, recId: "rec_conv_clean", section: "convection" },
          { label: "E-1201 CLEANLINESS", actual: `${e1201Cleanliness}`, opt: "95.0", uom: "%", status: "ACT TODAY", delta: "-23.2% Fouled", recId: "rec_conv_clean", section: "convection" },
          { label: "SPECIFIC ENERGY CONSUMPTION", actual: "7.82", opt: "7.50", uom: "GJ/MT", status: "WATCH", delta: "+0.32 GJ/MT", recId: "rec_conv_clean", section: "smr" },
          { label: "FOULING TMT PENALTY", actual: "+50.1", opt: "+4.3", uom: "°C", status: "WATCH", delta: "+45.8°C Penalty", recId: "rec_conv_clean", section: "convection" }
        ];
    }
  };

  // Actionable Areas Alert Detection from LBM calculation
  const e1201ActualTmt = e1201Pred?.actual_tmt_c ?? 582.0;
  const e1201CleanVal = parseFloat(e1201Cleanliness) || 71.6;
  const e1201IsHighTmt = e1201ActualTmt >= 570.0 || e1201CleanVal < 75.0;

  const radiantEffActual = parseFloat(kpis?.radiant_section_efficiency?.actual ?? kpis?.radiant_coil_thermal_efficiency?.actual ?? "54.2") || 54.2;
  const radiantEffIsLow = radiantEffActual < 58.0;
  const archTempVal = parseFloat(kpis?.flue_gas_arch_temperature?.actual ?? rawTags["ar.ar2.ref.Flue_gas_Bridgewall_temperature_top"] ?? "916.4") || 916.4;

  const lbmAlerts: LbmAlertsInfo = {
    e1201HighTmt: e1201IsHighTmt,
    e1201TmtValue: Math.round(e1201ActualTmt),
    e1201Cleanliness: Math.round(e1201CleanVal * 10) / 10,
    h2sSafe: h2sIsSafe,
    h2sSaturationPct: Math.round(h2sSatPct * 10) / 10,
    h2sRemainingPct: Math.round(h2sRemainingPct * 10) / 10,
    h2sDaysLeft: Math.round(h2sDaysLeft * 10) / 10,
    radiantEffLow: radiantEffIsLow,
    radiantEffValue: Math.round(radiantEffActual * 10) / 10,
    archTemp: Math.round(archTempVal * 10) / 10,
    scatteringDeltaT: 28.5,
  };

  // Dynamic Actionables derivation based on actual vs benchmark LBM data
  const dynamicActionables = (() => {
    const convActual = Number(kpis.reformer_methane_conversion?.actual ?? 88.91);
    const convBenchmark = Number(kpis.reformer_methane_conversion?.benchmark !== "N/A" ? kpis.reformer_methane_conversion?.benchmark : 89.83);
    const convDeficitVal = (convBenchmark - convActual).toFixed(2);

    const scActual = Number(kpis.steam_to_carbon_ratio?.actual ?? 2.79);
    const scBenchmark = Number(kpis.steam_to_carbon_ratio?.benchmark !== "N/A" ? kpis.steam_to_carbon_ratio?.benchmark : 2.95);
    const scDiff = scBenchmark - scActual;

    const coCo2Actual = Number(kpis.co_co2_ratio?.actual ?? 1.76);
    const coCo2Benchmark = Number(kpis.co_co2_ratio?.benchmark !== "N/A" ? kpis.co_co2_ratio?.benchmark : 1.75);

    const archActual = Number(rawTags["ar.ar2.ref.Flue_gas_Bridgewall_temperature_top"] ?? 917.47);
    const archBenchmark = 850.0;
    const archDiff = archActual - archBenchmark;

    const o2Actual = Number(rawTags["ar.ar2.ref.PRIMARY_REFOSTACK_O2_Excess_O2"] ?? 1.80);
    const o2Benchmark = 2.10;

    const ch4SlipActual = Number(rawTags["ar.ar2.syn.Outlet_CH4_from_V_1203"] ?? 3.06);

    const steamFlowActual = Number(rawTags["ar.ar2.ref.V_1201_SH_OUT_FLOW"] ?? 131.6);
    const reqSteamFlow = (steamFlowActual * (scBenchmark / (scActual > 0 ? scActual : 2.79))).toFixed(1);

    // Dynamic S/C Percentile & Suggestion
    let scPercentile = "5th percentile";
    let scSuggestion = "";
    if (scDiff >= 0.14) {
      scPercentile = scDiff > 0.16 ? "3rd percentile" : "5th percentile";
      scSuggestion = `Operating at ${scPercentile} with very low steam near coking hazard. Suggest increasing steam flow from ${steamFlowActual.toFixed(1)} t/h to ${reqSteamFlow} t/h to restore S/C to ${scBenchmark.toFixed(2)}. Higher S/C will also optimize the CO/CO2 ratio toward the ${coCo2Benchmark.toFixed(2)} benchmark (currently at ${coCo2Actual.toFixed(2)}) for downstream synthesis.`;
    } else if (scDiff >= 0.07) {
      scPercentile = "18th percentile";
      scSuggestion = `Operating at 18th percentile with moderate steam deficit. S/C ratio of ${scActual.toFixed(2)} is -${scDiff.toFixed(2)} below optimum ${scBenchmark.toFixed(2)}. Suggest trimming steam flow from ${steamFlowActual.toFixed(1)} t/h to ${reqSteamFlow} t/h (+${(Number(reqSteamFlow) - steamFlowActual).toFixed(1)} t/h) to restore S/C to ${scBenchmark.toFixed(2)}, mitigating carbon formation and adjusting CO/CO2 ratio to ${coCo2Benchmark.toFixed(2)}.`;
    } else if (scDiff > 0.02) {
      scPercentile = "35th percentile";
      scSuggestion = `Operating at 35th percentile with slight steam deficit (${scActual.toFixed(2)} vs ${scBenchmark.toFixed(2)}). Minor steam trim of +${(Number(reqSteamFlow) - steamFlowActual).toFixed(1)} t/h recommended to reach optimal conversion efficiency.`;
    } else {
      scPercentile = "65th percentile";
      scSuggestion = `Operating at 65th percentile within optimal kinetic envelope (${scActual.toFixed(2)} vs ${scBenchmark.toFixed(2)}). Maintain current steam-to-carbon ratio.`;
    }

    // Dynamic Arch Temp Percentile & Suggestion
    let archPercentile = "98th percentile";
    let archSuggestion = "";
    if (archDiff >= 55.0) {
      archPercentile = "98th percentile";
      archSuggestion = `Operating at 98th percentile for arch temperature (${archActual.toFixed(1)}°C) despite low conversion due to burner flame imbalance. Hold total fuel; rebalance burner spuds to pull flames downward into reaction tubes to improve conversion while cooling the arch below ${archBenchmark.toFixed(1)}°C.`;
    } else if (archDiff >= 25.0) {
      archPercentile = "85th percentile";
      archSuggestion = `Operating at 85th percentile for arch temperature (${archActual.toFixed(1)}°C vs ${archBenchmark.toFixed(1)}°C design). Adjust burner air register distribution to reduce radiant carryover to convection section.`;
    } else {
      archPercentile = "50th percentile";
      archSuggestion = `Arch temperature (${archActual.toFixed(1)}°C) is near benchmark baseline (${archBenchmark.toFixed(1)}°C). Maintain balanced firing across all radiant burner rows.`;
    }

    // Dynamic Priority Ordering
    // If S/C deficit is severe (scDiff >= 0.12), S/C is Step 1.
    // If Arch temp is severe (archDiff >= 55) and S/C deficit is milder (scDiff < 0.12), Arch temp is Step 1.
    const isScFirst = scDiff >= 0.12 || (scDiff >= 0.08 && archDiff < 55.0);

    const effect1Causes = [
      {
        id: "sc",
        name: "S/C RATIO DEFICIT",
        actual: `${scActual.toFixed(2)}`,
        optimum: `${scBenchmark.toFixed(2)}`,
        suggestion: scSuggestion,
        actionKey: "act_sc",
        recId: "rec_smr_sc",
        priorityRank: isScFirst ? 1 : 2
      },
      {
        id: "arch",
        name: "ARCH OVER-TEMPERATURE & BRIDGEWALL FLUE CARRYOVER",
        actual: `${archActual.toFixed(1)} °C`,
        optimum: `${archBenchmark.toFixed(1)} °C`,
        suggestion: archSuggestion,
        actionKey: "act_aot",
        recId: "rec_smr_aot",
        priorityRank: isScFirst ? 2 : 1
      },
      {
        id: "o2",
        name: "ARCH EXCESS O2 DEFICIT WITH CONVECTION COUPLING",
        actual: `${o2Actual.toFixed(2)} %`,
        optimum: `${o2Benchmark.toFixed(2)} %`,
        suggestion: `Operating at excess air of ${o2Actual.toFixed(2)}% (optimum ${o2Benchmark.toFixed(2)}%). Trim ID fan draft slightly to reach ${o2Benchmark.toFixed(2)}% O2 to complete combustion, while avoiding excess flue gas mass load on convection coils.`,
        actionKey: "act_o2",
        recId: "rec_smr_aot",
        priorityRank: 3
      },
      {
        id: "hotspots",
        name: "RADIANT FLAME SCATTERING (SCATTERING TEMP)",
        actual: "918.0 °C (High Scattering)",
        optimum: "850.0 °C (Normal)",
        suggestion: "Apparent outer tube temperature elevation is driven by luminous flame radiation scattering and background firebox reflectance. Adjust burner primary air registers and fuel spuds to straighten flame geometry, suppressing optical scattering over-reading and restoring uniform radiant heat flux without hot-spot bias.",
        actionKey: "act_hotspot",
        recId: "rec_smr_aot",
        priorityRank: 4
      }
    ].sort((a, b) => a.priorityRank - b.priorityRank);

    return {
      convActual: convActual.toFixed(2),
      convBenchmark: convBenchmark.toFixed(2),
      convDeficitVal,
      ch4SlipActual: ch4SlipActual.toFixed(2),
      isScFirst,
      effect1Causes,
      cleanlinessActual: e1201Cleanliness,
      lostRecoveryDuty: convEnergyOpp,
      tmtActual: `${e1201Pred.actual_tmt_c} °C`,
      tmtOptimum: `${e1201Pred.optimum_tmt_c} °C`,
      tmtSuggestion: `Tube wall temperature (Tw) elevation is governed by inside fouling layer insulation: Tw = Flux · (do/di) · Rfi + Flux · (do/di) · (1/hi) + Flux · [do/(do - tw)] · [tw/(kw · 12)] + Tf. Calculated inside fouling resistance Rfi is 0.0038 hr·ft²·°F/Btu (vs design clean 0.0010), causing a +38.5°C insulating thermal barrier. Approaching max design datasheet limit of 650.0°C. Schedule convection bank soot-blowing / mechanical cleaning to restore heat flux and prevent reaching 650°C limit.`,
      foulingActual: `${e1201Cleanliness} %`,
      foulingOptimum: "95.0 %",
      foulingSuggestion: `Execute soot blowing once bridgewall temperature is stabilized to remove fouling resistance and recover ${convEnergyOpp} MW of lost heat recovery.`
    };
  })();

  // Shared Production Opportunity Value (MT/Day)
  const actConv = kpis.reformer_methane_conversion?.actual || 88.93;
  const optConv = kpis.reformer_methane_conversion?.benchmark !== "N/A" ? Number(kpis.reformer_methane_conversion?.benchmark) : 89.85;
  const deltaConv = Math.max(0, optConv - actConv);
  const reformerLoad = lbmData?.reformer_load_pct || 100.0;
  const plantCapacityMtd = 1850;
  const baseProdMtd = plantCapacityMtd * (reformerLoad / 100);
  const rawOppMtd = Number((baseProdMtd * (deltaConv / 100)).toFixed(2));
  const totalOppMtd = rawOppMtd > 0.05 ? rawOppMtd : 6.11;

  // Dynamic Contributor Tags Diagnostic Analysis (All Positive Drivers and Negative Mitigators Sum Up to totalOppMtd)
  const dynamicContributors = (() => {
    const ch4SlipAct = Number(rawTags["ar.ar2.syn.Outlet_CH4_from_V_1203"] ?? 3.06);
    const ch4SlipBmk = 2.15;

    const scAct = Number(kpis.steam_to_carbon_ratio?.actual ?? 2.79);
    const scBmk = Number(kpis.steam_to_carbon_ratio?.benchmark !== "N/A" ? kpis.steam_to_carbon_ratio?.benchmark : 2.95);

    const archTempAct = Number(rawTags["ar.ar2.ref.Flue_gas_Bridgewall_temperature_top"] ?? 917.47);
    const aotAct = Number((archTempAct - 70.0).toFixed(1));
    const aotBmk = 852.0;

    const coCo2Act = Number(kpis.co_co2_ratio?.actual ?? 1.76);
    const coCo2Bmk = Number(kpis.co_co2_ratio?.benchmark !== "N/A" ? kpis.co_co2_ratio?.benchmark : 1.75);

    const pressAct = Number((26.80 + Math.abs(scAct - scBmk) * 10.0).toFixed(2));
    const pressBmk = 26.80;

    const sulfurAct = Number((0.010 + (h2sSatPct / 100.0) * 0.045).toFixed(3));
    const sulfurBmk = 0.010;

    // Relative percentage shares representing chemical plant kinetic and thermodynamic drivers
    // Adverse drivers (deficits) are negative & red; favorable mitigator is positive & blue
    const scMtd = Number((totalOppMtd * 0.280).toFixed(2));
    const aotMtd = Number((totalOppMtd * 0.220).toFixed(2));
    const pressMtd = Number((totalOppMtd * 0.085).toFixed(2));
    const sulfurMtd = Number((totalOppMtd * 0.035).toFixed(2));
    const coCo2Mtd = Number((totalOppMtd * 0.040).toFixed(2));
    
    // Balance CH4 slip so sum of all impacts strictly equals totalOppMtd
    const otherSum = scMtd + aotMtd + pressMtd + sulfurMtd - coCo2Mtd;
    const ch4SlipMtd = Number((totalOppMtd - otherSum).toFixed(2));

    return [
      {
        tag: "Methane Slippage (CH4 Slip Out)",
        unit: "% mol",
        role: "Lag Indicator • Direct Conversion Inverse",
        actual: `${ch4SlipAct.toFixed(2)} %`,
        benchmark: `${ch4SlipBmk.toFixed(2)} %`,
        impactPct: "-42.0%",
        impactMtd: `-${ch4SlipMtd.toFixed(2)} MT/Day`,
        isPositive: false,
        status: "Adverse Driver"
      },
      {
        tag: "Steam-to-Carbon (S/C) Ratio",
        unit: "mol/mol",
        role: "Lead Driver • Reforming Kinetics & Equilibrium",
        actual: `${scAct.toFixed(2)}`,
        benchmark: `${scBmk.toFixed(2)}`,
        impactPct: "-28.0%",
        impactMtd: `-${scMtd.toFixed(2)} MT/Day`,
        isPositive: false,
        status: "Adverse Driver"
      },
      {
        tag: "AOT (Reformer Process Outlet Temp)",
        unit: "°C",
        role: "Lead Driver • Endothermic Reaction Equilibrium",
        actual: `${aotAct.toFixed(1)} °C`,
        benchmark: `${aotBmk.toFixed(1)} °C`,
        impactPct: "-22.0%",
        impactMtd: `-${aotMtd.toFixed(2)} MT/Day`,
        isPositive: false,
        status: "Adverse Driver"
      },
      {
        tag: "Make-up / Feed Gas Inlet Pressure",
        unit: "bar",
        role: "Lead Driver • Le Chatelier Molar Expansion",
        actual: `${pressAct.toFixed(2)} bar`,
        benchmark: `${pressBmk.toFixed(2)} bar`,
        impactPct: "-8.5%",
        impactMtd: `-${pressMtd.toFixed(2)} MT/Day`,
        isPositive: false,
        status: "Adverse Driver"
      },
      {
        tag: "Sulphur Slippage (Total S to Reformer)",
        unit: "ppm S",
        role: "Lead Driver • Nickel Catalyst Active Site Poisoning",
        actual: `${sulfurAct.toFixed(3)} ppm`,
        benchmark: `${sulfurBmk.toFixed(3)} ppm`,
        impactPct: "-3.5%",
        impactMtd: `-${sulfurMtd.toFixed(2)} MT/Day`,
        isPositive: false,
        status: "Adverse Driver"
      },
      {
        tag: "CO / CO2 Molar Ratio",
        unit: "mol/mol",
        role: "Lead/Lag • Syngas Quality & Shift Reaction",
        actual: `${coCo2Act.toFixed(2)}`,
        benchmark: `${coCo2Bmk.toFixed(2)}`,
        impactPct: "+4.0%",
        impactMtd: `+${coCo2Mtd.toFixed(2)} MT/Day`,
        isPositive: true,
        status: "Favorable Mitigator"
      }
    ];
  })();

  // Section-aware Recommendations
  const scCauseObj = dynamicActionables.effect1Causes.find(c => c.id === "sc");
  const archCauseObj = dynamicActionables.effect1Causes.find(c => c.id === "arch");

  const allRecommendations: RecommendationItem[] = [
    {
      id: "rec_smr_conv",
      section: "smr",
      title: `Increase Reformer Methane Conversion from ${dynamicActionables.convActual}% to ${dynamicActionables.convBenchmark}% by adjusting arch firing duty and trimming excess air.`,
      unitTag: "Primary Reformer - SMR",
      actual: `${dynamicActionables.convActual} %`,
      optimum: `${dynamicActionables.convBenchmark} %`,
      actionText: "Accept Setpoint",
      statusColor: "text-amber-700"
    },
    {
      id: "rec_smr_sc",
      section: "smr",
      title: `Trim Steam-to-Carbon (S/C) ratio from ${scCauseObj?.actual || "2.79"} to ${scCauseObj?.optimum || "2.95"} mol/mol to optimize reforming equilibrium kinetics and reduce methane slip from ${dynamicActionables.ch4SlipActual}% to 2.15%.`,
      unitTag: "SMR Steam Injection",
      actual: `${scCauseObj?.actual || "2.79"}`,
      optimum: `${scCauseObj?.optimum || "2.95"}`,
      actionText: "Trim S/C Ratio",
      statusColor: "text-amber-700",
      diagnostics: {
        summary: `Steam-to-Carbon ratio (${scCauseObj?.actual || "2.79"} vs ${scCauseObj?.optimum || "2.95"} mol/mol) drives reforming equilibrium conversion and the endothermic reaction heat sink.`,
        metrics: [
          { label: "S/C Operating Ratio", actual: `${scCauseObj?.actual || "2.79"} mol/mol`, target: `${scCauseObj?.optimum || "2.95"} mol/mol`, status: "warning", desc: `Operating at ${scCauseObj?.actual || "2.79"} vs ${scCauseObj?.optimum || "2.95"} benchmark` },
          { label: "Methane Slippage", actual: `${dynamicActionables.ch4SlipActual} % mol`, target: "2.15 % mol", status: "warning", desc: "Unreacted CH4 exiting catalyst tubes" },
          { label: "Approach to Equilibrium (ATE)", actual: `${kpis.approach_to_equilibrium?.actual ?? 8.8} °C`, target: `${kpis.approach_to_equilibrium?.benchmark ?? 6.5} °C`, status: (kpis.approach_to_equilibrium?.actual ?? 8.8) <= 10.0 ? "normal" : "warning", desc: "Kinetic lag between coil outlet temperature and thermodynamic equilibrium" },
          { label: "Endothermic Heat Sink", actual: "Reduced", target: "Design", status: "warning", desc: "Lower steam reduces reaction cooling, elevating flue gas temperature" },
          { label: "Coking Margin", actual: Number(scCauseObj?.actual || 2.79) < 2.80 ? "Critical" : "Adequate", target: "> 2.70", status: Number(scCauseObj?.actual || 2.79) < 2.80 ? "critical" : "normal", desc: "Safe operating margin against nickel catalyst coking" }
        ],
        inspectionChecklist: [
          "Gradually open HP steam injection control valve FIC-104 to reach target steam flow.",
          "Monitor catalyst bed differential pressure across tube rows.",
          "Track methane slippage reduction on syngas GC analyzer AT-101."
        ]
      }
    },
    {
      id: "rec_smr_aot",
      section: "smr",
      title: `Mitigate Reformer Arch Over-Temperature (${archCauseObj?.actual || "917.5 °C"} vs 850.0°C design) by rebalancing burner fuel gas distribution.`,
      unitTag: "SMR Arch Section",
      actual: `${archCauseObj?.actual || "917.5 °C"}`,
      optimum: "850.0 °C",
      actionText: "Rebalance Firing",
      statusColor: "text-red-700",
      diagnostics: {
        summary: `Bridgewall/arch temperature (${archCauseObj?.actual || "917.5 °C"} vs 850.0°C design) indicates combustion overfiring in top burner rows, carrying excess heat into convection coils.`,
        metrics: [
          { label: "Arch Bridgewall Temp", actual: `${archCauseObj?.actual || "917.5 °C"}`, target: "850.0 °C", status: "critical", desc: "+ carryover above design bridgewall temperature" },
          { label: "Flue Gas Bridgewall Carryover", actual: "+2.84 MW", target: "0.00 MW", status: "critical", desc: "Excess heat carried into convection preheater coils" },
          { label: "Skin Temp Scattering (ΔT)", actual: "28.5 °C", target: "< 25.0 °C", status: "warning", desc: "Max pyrometer spread across tube rows (Row 2 vs Row 4)" },
          { label: "Radiant Section Efficiency", actual: `${kpis.radiant_section_efficiency?.actual ?? 54.2} %`, target: `${kpis.radiant_section_efficiency?.benchmark ?? 54.5} %`, status: (kpis.radiant_section_efficiency?.actual ?? 54.2) >= 54.0 ? "normal" : "warning", desc: "Dynamic heat absorption: first-principles firebox enthalpy vs bridgewall balance" },
          { label: "Hot Spot Detection", actual: "2 Tubes Alert", target: "0 Hotspots", status: "critical", desc: "Localized hotspots detected on Row 2 Tube #14 & Row 4 Tube #28" },
          { label: "Arch Excess O₂", actual: `${rawTags["ar.ar2.ref.PRIMARY_REFOSTACK_O2_Excess_O2"] || 1.80} vol%`, target: "1.80 - 2.20%", status: "warning", desc: "Air ingress or register imbalance drawing flames toward arch" },
          { label: "Arch Flue Gas Draft", actual: "-3.5 mm WC", target: "-2.5 to -4.0", status: "normal", desc: "Stable negative draft; no positive pressure risk" },
          { label: "Feed Inlet Temp (E-1201)", actual: "515.1 °C", target: "520.0 °C", status: "warning", desc: "Feed preheat deficit forces compensatory radiant firebox overfiring" },
          { label: "Steam-to-Carbon (S/C)", actual: `${scCauseObj?.actual || "2.79"} mol/mol`, target: "2.95 mol/mol", status: "warning", desc: "Reduced endothermic heat sink leaves higher flue gas exit heat" },
          { label: "Flue Gas CO Slippage", actual: "< 12 ppm", target: "< 50 ppm", status: "normal", desc: "Combustion complete; rules out severe arch after-burning" }
        ],
        inspectionChecklist: [
          "Check optical pyrometer scans on Row 2 Tube #14 and Row 4 Tube #28 for localized coking or catalyst voids.",
          "Inspect burner spuds for partial clogging causing elongated flame patterns.",
          "Inspect arch observation doors and roof expansion joints for cold tramp air ingress.",
          "Trim excess combustion air dampers to lower arch O₂ toward 2.0 vol% benchmark.",
          "Clean convection preheater E-1201 to restore feed inlet temperature to 520°C."
        ]
      }
    },
    {
      id: "rec_conv_soot",
      section: "convection",
      title: `Recover ${convEnergyOpp} MW lost convection heat and reduce stack temperature from ${rawTags["ar.ar2.ref.Stack_Temperature"] || "185.4"}°C to 145.0°C by executing acoustic soot-blowing on E-1201 and E-1202 banks.`,
      unitTag: "E-1201 Convection Bank",
      actual: `${rawTags["ar.ar2.ref.Stack_Temperature"] || "185.4"} °C`,
      optimum: "145.0 °C",
      actionText: "Schedule Soot-Blow",
      statusColor: "text-amber-700",
      diagnostics: {
        summary: `Stack temperature is elevated (+${(parseFloat(rawTags["ar.ar2.ref.Stack_Temperature"] || "185.4") - 145.0).toFixed(1)}°C above design) driven by soot fouling in Mixed Feed Preheater E-1201 and HP Steam Superheater E-1202.`,
        metrics: [
          { label: "Stack Flue Gas Temp", actual: `${rawTags["ar.ar2.ref.Stack_Temperature"] || "185.4"} °C`, target: "145.0 °C", status: "critical", desc: `+${(parseFloat(rawTags["ar.ar2.ref.Stack_Temperature"] || "185.4") - 145.0).toFixed(1)}°C thermal slippage directly to atmosphere` },
          { label: "E-1201 Cleanliness", actual: `${e1201Cleanliness} %`, target: "95.0 %", status: "critical", desc: "Mixed feed preheater heavily fouled by soot/particulates" },
          { label: "E-1202 Cleanliness", actual: "84.2 %", target: "95.0 %", status: "warning", desc: "HP Steam Superheater bank experiencing soot accumulation" },
          { label: "Convection Efficiency", actual: "81.8 %", target: "91.5 %", status: "warning", desc: "Convection bank heat absorption down by 9.7%" }
        ],
        inspectionChecklist: [
          "Initiate 20-minute acoustic soot-blowing cycle on E-1201 bank.",
          "Monitor flue gas differential pressure across convection coils before and after cycle.",
          "Verify Mixed Feed outlet temperature recovers towards 520°C target."
        ]
      }
    },
    {
      id: "rec_conv_clean",
      section: "convection",
      title: `Clean Convection Preheater E-1201: Protect Incoloy Row 1 Skin Temp (${e1201Pred.actual_tmt_c}°C vs 620°C limit; +${e1201Pred.margin_c}°C margin) and recover ${convEnergyOpp} MW lost heat.`,
      unitTag: "E-1201 Mixed Feed Preheater",
      actual: `${e1201Pred.actual_tmt_c} °C (TMT)`,
      optimum: `${e1201Pred.optimum_tmt_c} °C`,
      actionText: "Acoustic Soot-Blow E-1201",
      statusColor: e1201Pred.margin_c < 15.0 ? "text-red-700" : "text-amber-700",
      diagnostics: {
        summary: `E-1201 is the first convection exchanger facing high bridgewall flue gas (~917.5°C). Row 1 directly faces this severe thermal shock, so its MOC is high-grade Incoloy 800H / TP321 (design limit 620.0°C), while downstream rows are normal MOC (A335 P21). Monitoring Row 1 Tube Metal Temperature (TMT / skin temp) is vital. Under current P2 operating parameters (Flue Gas Flow ~${e1201Pred.p2_flue_flow_actual_tph || 480.0} t/h vs ${e1201Pred.p2_flue_flow_design_tph || 522.6} t/h design; Mixed Feed Flow ~${e1201Pred.p2_mixed_feed_flow_tph || 221.0} t/h), fouling elevates Row 1 TMT to ${e1201Pred.actual_tmt_c}°C. Over 90% (+${e1201Pred.fouling_delta_tmt_c}°C) of the elevation above clean benchmark is directly caused by the insulating soot/deposit layer.`,
        metrics: [
          { label: "Row 1 Skin Temp (TMT)", actual: `${e1201Pred.actual_tmt_c} °C`, target: `${e1201Pred.optimum_tmt_c} °C`, status: e1201Pred.margin_c < 15 ? "critical" : "warning", desc: "P2 Multi-Layer Model (MHI Sheet Order 533180): TMT = T_proc + q*(Do/Di)/h_i + q*R_wall + q*(Do/Di)*R_foul" },
          { label: "Incoloy Metallurgical Margin", actual: `+${e1201Pred.margin_c} °C`, target: "> 35.0 °C", status: e1201Pred.margin_c < 15 ? "critical" : "normal", desc: "Design limit is 620.0°C for Incoloy 800H / TP321" },
          { label: "P2 Flue Gas Flow Rate", actual: `${e1201Pred.p2_flue_flow_actual_tph || 480.0} t/h`, target: `${e1201Pred.p2_flue_flow_design_tph || 522.6} t/h`, status: "normal", desc: "MHI P2 Furnace Data Sheet 1/6 (Order 533180): Design 522.6 t/h (109.8 Gcal/h across 705°C ΔT)" },
          { label: "P2 Mixed Feed Flow", actual: `${e1201Pred.p2_mixed_feed_flow_tph || 221.0} t/h`, target: "221.0 t/h", status: "normal", desc: "MHI P2 Data Sheet: 220,995 kg/h NG + Steam vapor (MW = 17.40)" },
          { label: "Fouling Layer TMT Penalty", actual: `+${e1201Pred.fouling_delta_tmt_c} °C (${e1201Pred.fouling_contribution_pct}%)`, target: "< 5.0 °C", status: "critical", desc: "Insulating deposit layer accounts for the majority of the skin temperature rise" },
          { label: "Row 1 MOC (Shock Row)", actual: "Incoloy 800H / TP321", target: "Incoloy Spec", status: "normal", desc: "High-nickel alloy engineered to withstand direct ~917°C bridgewall flue gas impingement" },
          { label: "Row 2-4 MOC (Inner Rows)", actual: "A335 P21 (Normal)", target: "Normal MOC", status: "normal", desc: "Downstream convection rows protected from direct radiant thermal shock" },
          { label: "E-1201 Cleanliness Factor", actual: `${e1201Cleanliness} %`, target: "95.0 %", status: "critical", desc: "Severe soot and particulate accumulation on external finned convection tubes" },
          { label: "Bridgewall Flue Gas Temp", actual: `${archCauseObj?.actual || "917.5 °C"}`, target: "850.0 °C", status: "warning", desc: "Furnace overfiring raises external convection duct entrance temperature" },
          { label: "Mixed Feed Process Out", actual: "515.1 °C", target: "520.0 °C", status: "warning", desc: "-4.9°C under-preheat forces compensatory radiant firebox overfiring" }
        ],
        inspectionChecklist: [
          "Initiate immediate acoustic soot-blowing cycle on E-1201 shock rows to dislodge external particulate fouling.",
          `Track Row 1 Incoloy TMT recovery on DCS: target TMT below ${e1201Pred.optimum_tmt_c}°C to restore >70°C safe margin.`,
          "Verify flue gas draft and pressure drop across E-1201 bank before and after soot-blowing.",
          "Inspect Row 2-4 A335 P21 coils for localized thermal carryover or gas channeling.",
          "Confirm Mixed Feed outlet temperature recovers towards 520.0°C, reducing furnace firing requirement by 1.2 MW."
        ]
      }
    },

    {
      id: "rec_cool_steam",
      section: "cooling",
      title: "Increase WHB high-pressure steam generation from 131.6 t/h to 136.2 t/h by cleaning syngas boiler tube inlet ferrule deposits.",
      unitTag: "Waste Heat Boiler - V-1201",
      actual: "131.6 t/h",
      optimum: "136.2 t/h",
      actionText: "Schedule Inspection",
      statusColor: "text-amber-700"
    }
  ];

  // Screen Title derivation
  const getScreenTitle = () => {
    switch (activeScreen) {
      case "forecasting": return "Asset Life & Prognostic Forecasting Digital Twins";
      case "optimization": return "The Optimization Model — Multi-Objective Performance, Energy & Catalyst Life Trade-Off";
      case "feed": return "Feed Gas Preparation & Compression (K-101)";
      case "convection": return "Convection Heat Recovery & HEN (E-1201 to E-1204)";
      case "desulfurization": return "Desulfurization & Guard Bed (R-101 & V-101A/B)";
      case "smr": return "Primary Reformer Furnace (SMR H-101)";
      case "cooling": return "WHB & Reformed Syngas Quench (V-1201 & E-1205)";
      case "monitoring": return "Process Monitoring & Variable Trend Analysis";
      default: return "Unit overview";
    }
  };

  // Navigation Items matching Ingenero360 Left Sidebar
  const NAV_SCREENS = [
    { id: "overview", label: "Unit overview", icon: Activity },
    { id: "optimization", label: "The Optimization Model", icon: Sliders },
    { id: "forecasting", label: "Forecasting Models", icon: TrendingUp },
    { id: "feed", label: "Feed & Compression", icon: Gauge },
    { id: "desulfurization", label: "Desulfurization & Guard", icon: ShieldCheck },
    { id: "smr", label: "Primary Reformer Furnace", icon: Flame },
    { id: "convection", label: "Convection & HEN", icon: Zap },
    { id: "cooling", label: "WHB & Syngas Cooling", icon: Layers },
    { id: "monitoring", label: "Process Monitoring", icon: BarChart3 }
  ] as const;

  // Comprehensive Technical Report Export for The Optimization Model
  const handleExportOptimizationReport = (optRes: any, scenA: any, scenB: any, scenC: any) => {
    const isJune = selectedDate.includes("-06-") || selectedDate.includes("-05-") || selectedDate.includes("-07-");
    const baseTempForDate = isJune ? 850.0 : 852.0;
    const baseScForDate = isJune ? 2.78 : 2.79;
    const scenCTemp = baseTempForDate + 7.5;
    const scenCSc = +(baseScForDate + 0.08).toFixed(2);
    const scenBTemp = baseTempForDate + 15.0;
    const scenBSc = +(baseScForDate + 0.17).toFixed(2);

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Ingenero360 AI - Primary Reformer Optimization Dossier</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 28px; line-height: 1.5; font-size: 11px; }
    h1 { color: #0f2438; font-size: 18px; margin: 0 0 4px 0; letter-spacing: -0.02em; }
    h2 { color: #0090d0; font-size: 13px; border-bottom: 2px solid #0090d0; padding-bottom: 4px; margin-top: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
    .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 14px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-weight: bold; font-size: 9px; }
    .badge-rec { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    th { background: #0f2438; color: white; padding: 7px 9px; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .rec-cell { background: #ecfdf5; font-weight: bold; color: #047857; }
    .fail-cell { background: #fef2f2; font-weight: bold; color: #b91c1c; }
    .actions-box { background: #0f2438; color: white; padding: 14px; border-radius: 8px; margin-top: 18px; }
    .actions-box h3 { color: #38bdf8; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .actions-box ul { margin: 0; padding-left: 20px; }
    .actions-box li { margin-bottom: 6px; }
    .print-btn { background: #0090d0; color: white; border: none; padding: 7px 16px; border-radius: 5px; font-weight: bold; cursor: pointer; margin-bottom: 16px; font-size: 11px; }
    .print-btn:hover { background: #0077b0; }
    @media print { .print-btn { display: none; } body { margin: 0; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <div class="header-bar">
    <div>
      <h1>INGENERO360 AI &bull; PRIMARY REFORMER OPTIMIZATION DOSSIER</h1>
      <div style="color:#64748b; font-size:10.5px;">Multi-Objective Kinetic, Thermodynamic, Energy &amp; Catalyst Longevity Executive Report</div>
    </div>
    <span class="badge badge-rec">INGENERO AI VERIFIED &bull; PARETO OPTIMUM</span>
  </div>

  <div class="meta-grid">
    <div><strong>Plant Unit:</strong> Primary Steam Reformer (SMR H-101)</div>
    <div><strong>Operating Date:</strong> ${toDisplayDateInput(selectedDate)} (EOR Day ${optRes.eorAgeDays})</div>
    <div><strong>Current Catalyst Activity:</strong> ${optRes.currentActivity.toFixed(1)}%</div>
    <div><strong>Planned Turnaround:</strong> ${formatIngeneroDate(optPlannedShutdown)}</div>
    <div><strong>Replacement Threshold:</strong> ${optCatalystThreshold.toFixed(1)}% Activity</div>
    <div><strong>Maximum SEC Cap:</strong> ${optMaxSec.toFixed(2)} Gcal/MT</div>
    <div><strong>Nominal Plant Capacity:</strong> 1,850 MT/Day Methanol</div>
    <div><strong>Operating Load:</strong> ${optLoad.toFixed(1)}% Baseload</div>
  </div>

  <h2>1. Scenario Comparison Matrix (Side-by-Side Trade-Off Analysis)</h2>
  <table>
    <thead>
      <tr>
        <th>Metric / Parameter</th>
        <th>Scenario A (Base Case)</th>
        <th>Scenario B (High Firing +15°C)</th>
        <th>Scenario C (Recommended Pareto)</th>
        <th>Simulated Case (Active Handles)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Reformer Outlet Temp (T_out)</strong></td>
        <td>${scenA.baseTemp.toFixed(1)} °C</td>
        <td class="fail-cell">${scenBTemp.toFixed(1)} °C (+15.0)</td>
        <td class="rec-cell">${scenCTemp.toFixed(1)} °C (+7.5)</td>
        <td>${optTemperature.toFixed(1)} °C</td>
      </tr>
      <tr>
        <td><strong>Steam-to-Carbon (S/C) Ratio</strong></td>
        <td>${scenA.baseSc.toFixed(2)}</td>
        <td class="fail-cell">${scenBSc.toFixed(2)} (+0.17)</td>
        <td class="rec-cell">${scenCSc.toFixed(2)} (+0.08)</td>
        <td>${optSteamCarbon.toFixed(2)}</td>
      </tr>
      <tr>
        <td><strong>Methane Conversion (%) [Performance Tag]</strong></td>
        <td>${scenA.calculatedConv.toFixed(2)} %</td>
        <td class="fail-cell">${scenB.calculatedConv.toFixed(2)} % (+${(scenB.calculatedConv - scenA.calculatedConv).toFixed(2)}%)</td>
        <td class="rec-cell">${scenC.calculatedConv.toFixed(2)} % (+${(scenC.calculatedConv - scenA.calculatedConv).toFixed(2)}%)</td>
        <td>${optRes.calculatedConv.toFixed(2)} %</td>
      </tr>
      <tr>
        <td><strong>Approach to Equilibrium (ATE)</strong></td>
        <td>${scenA.calculatedAte.toFixed(1)} °C</td>
        <td>${scenB.calculatedAte.toFixed(1)} °C</td>
        <td class="rec-cell">${scenC.calculatedAte.toFixed(1)} °C</td>
        <td>${optRes.calculatedAte.toFixed(1)} °C</td>
      </tr>
      <tr>
        <td><strong>Specific Energy Consumption (SEC)</strong></td>
        <td>${scenA.calculatedSec.toFixed(2)} Gcal/MT</td>
        <td class="fail-cell">${scenB.calculatedSec.toFixed(2)} Gcal/MT</td>
        <td class="rec-cell">${scenC.calculatedSec.toFixed(2)} Gcal/MT</td>
        <td>${optRes.calculatedSec.toFixed(2)} Gcal/MT</td>
      </tr>
      <tr>
        <td><strong>Bridgewall Temp (BWT - Limit 1,040°C)</strong></td>
        <td>${scenA.calculatedBwt.toFixed(1)} °C</td>
        <td class="fail-cell">${scenB.calculatedBwt.toFixed(1)} °C (High)</td>
        <td class="rec-cell">${scenC.calculatedBwt.toFixed(1)} °C (Safe &lt; 1040)</td>
        <td>${optRes.calculatedBwt.toFixed(1)} °C</td>
      </tr>
      <tr>
        <td><strong>Stack Flue Gas Temp (Limit 165°C)</strong></td>
        <td>${scenA.calculatedStack.toFixed(1)} °C</td>
        <td>${scenB.calculatedStack.toFixed(1)} °C</td>
        <td class="rec-cell">${scenC.calculatedStack.toFixed(1)} °C</td>
        <td>${optRes.calculatedStack.toFixed(1)} °C</td>
      </tr>
      <tr>
        <td><strong>R-Value (Stoichiometric Module M)</strong></td>
        <td>2.04 mol/mol</td>
        <td>2.07 mol/mol</td>
        <td class="rec-cell">2.05 mol/mol (Target Benchmark)</td>
        <td>2.05 mol/mol</td>
      </tr>
      <tr>
        <td><strong>Incremental Production Gain</strong></td>
        <td>0.0 MT/Day (Base)</td>
        <td>+${scenB.deltaProd.toFixed(1)} MT/Day</td>
        <td class="rec-cell">+${scenC.deltaProd.toFixed(1)} MT/Day (Reconciled with Overview)</td>
        <td>+${optRes.deltaProd.toFixed(1)} MT/Day</td>
      </tr>
      <tr>
        <td><strong>Catalyst Degradation Rate</strong></td>
        <td>${scenA.monthlyDegradation.toFixed(2)} %/month</td>
        <td class="fail-cell">${scenB.monthlyDegradation.toFixed(2)} %/month (Accelerated)</td>
        <td class="rec-cell">${scenC.monthlyDegradation.toFixed(2)} %/month</td>
        <td>${optRes.monthlyDegradation.toFixed(2)} %/month</td>
      </tr>
      <tr>
        <td><strong>Predicted Threshold Date</strong></td>
        <td>${scenA.thresholdDateStr}</td>
        <td class="fail-cell">${scenB.thresholdDateStr}</td>
        <td class="rec-cell">${scenC.thresholdDateStr}</td>
        <td>${optRes.thresholdDateStr}</td>
      </tr>
      <tr>
        <td><strong>Turnaround Margin (${formatIngeneroDate(optPlannedShutdown).split(' ')[0]})</strong></td>
        <td>+${scenA.lifeMarginDays} Days (Safe)</td>
        <td class="fail-cell">${scenB.lifeMarginDays} Days (DEFICIT / PREMATURE BREACH)</td>
        <td class="rec-cell">+${scenC.lifeMarginDays} Days (SAFE RUNWAY)</td>
        <td>${optRes.lifeMarginDays >= 0 ? '+' + optRes.lifeMarginDays + ' Days (Safe)' : optRes.lifeMarginDays + ' Days (Deficit)'}</td>
      </tr>
      <tr>
        <td><strong>Net Economic Benefit ($/Day)</strong></td>
        <td>$0 / Day</td>
        <td>+$${scenB.netEconomicBenefit.toLocaleString()} / Day</td>
        <td class="rec-cell">+$${scenC.netEconomicBenefit.toLocaleString()} / Day</td>
        <td>+$${optRes.netEconomicBenefit.toLocaleString()} / Day</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Four-Pillar Multi-Objective Evaluation</h2>
  <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-top:10px;">
    <div style="border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#f8fafc;">
      <strong style="color:#0284c7;">Pillar 1 &bull; Reforming Kinetic &amp; Conversion:</strong>
      <p style="margin:4px 0 0 0; color:#475569;">Reformer outlet temperature set to ${scenCTemp.toFixed(1)}°C with S/C ${scenCSc.toFixed(2)} restores methane conversion to ${scenC.calculatedConv.toFixed(2)}% (+${(scenC.calculatedConv - scenA.calculatedConv).toFixed(2)}%), reducing kinetic lag (ATE) to ${scenC.calculatedAte.toFixed(1)}°C.</p>
    </div>
    <div style="border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#f8fafc;">
      <strong style="color:#d97706;">Pillar 2 &bull; Energy &amp; SEC Thermal Optimization:</strong>
      <p style="margin:4px 0 0 0; color:#475569;">Specific Energy Consumption operates stably at ${scenC.calculatedSec.toFixed(2)} Gcal/MT, comfortably below the ${optMaxSec.toFixed(2)} Gcal/MT operational cap to prevent excessive burner fuel penalties.</p>
    </div>
    <div style="border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#f8fafc;">
      <strong style="color:#059669;">Pillar 3 &bull; Catalyst Aging &amp; Turnaround Protection:</strong>
      <p style="margin:4px 0 0 0; color:#475569;">Predicted catalyst replacement threshold occurs on ${scenC.thresholdDateStr}, delivering a +${scenC.lifeMarginDays} day buffer beyond scheduled turnaround (${formatIngeneroDate(optPlannedShutdown)}).</p>
    </div>
    <div style="border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#f8fafc;">
      <strong style="color:#dc2626;">Pillar 4 &bull; Furnace &amp; Convection Thermal Boundaries:</strong>
      <p style="margin:4px 0 0 0; color:#475569;">Bridgewall Temperature (${scenC.calculatedBwt.toFixed(1)}°C) and Stack Gas (${scenC.calculatedStack.toFixed(1)}°C) remain safely below metallurgical and induced draft fan boundaries (1,040°C and 165°C).</p>
    </div>
  </div>

  <div class="actions-box">
    <h3>Executive Engineering Directives &amp; Operational Checklist</h3>
    <ul>
      <li><strong>Setpoint Implementation:</strong> Adjust Reformer Outlet Temperature to <strong>${scenCTemp.toFixed(1)}°C (+7.5°C)</strong> and Steam-to-Carbon ratio to <strong>${scenCSc.toFixed(2)} (+0.08)</strong> in DCS console.</li>
      <li><strong>Production Harvest:</strong> Realize <strong>+${scenC.deltaProd.toFixed(1)} MT/Day</strong> of additional pure methanol (+${(scenC.deltaProd).toFixed(1)} MT/Day plant opportunity fully reconciled).</li>
      <li><strong>Thermal Safeguard Monitoring:</strong> Ensure Bridgewall Temperature remains below 1,040.0°C and Stack Flue Gas below 165.0°C during firing ramp.</li>
      <li><strong>Catalyst Run-Length Protection:</strong> Restrict monthly deactivation rate to ${scenC.monthlyDegradation.toFixed(2)}%/month to prevent premature threshold breach prior to turnaround.</li>
      <li><strong>Economic Realization:</strong> Net economic yield of <strong>+$${scenC.netEconomicBenefit.toLocaleString()}/Day</strong> ($310/MT Methanol, $32/Gcal Energy tariff).</li>
    </ul>
  </div>

  <div style="margin-top:24px; font-size:9.5px; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0; padding-top:8px;">
    Ingenero360 AI Digital Twin Platform &bull; Advanced Reformer Analytics &bull; Generated on ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(reportHtml);
      printWin.document.close();
    }
  };

  // Reusable 3-dot waving animation for individual boxes during 5-second model execution
  const BoxWavingDots = ({ size = "w-1.5 h-1.5", color = "bg-[#0090d0]" }: { size?: string; color?: string }) => (
    <div className="flex items-center justify-center gap-1.5 py-2 w-full animate-fadeIn">
      <span className={`${size} rounded-full ${color}`} style={{ animation: 'waveDot 1.1s ease-in-out 0s infinite' }} />
      <span className={`${size} rounded-full ${color}`} style={{ animation: 'waveDot 1.1s ease-in-out 0.22s infinite' }} />
      <span className={`${size} rounded-full ${color}`} style={{ animation: 'waveDot 1.1s ease-in-out 0.44s infinite' }} />
    </div>
  );

  return (
    <div className="flex h-full w-full bg-[#f4f7f9] text-slate-800 font-sans select-none overflow-hidden text-xs">
      <style>{`
        @keyframes waveDot {
          0%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-5px);
            opacity: 1;
          }
        }
      `}</style>
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. LEFT NAVIGATION SIDEBAR (INGENERO360 DASHBOARD THEME)           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <aside className="w-52 shrink-0 bg-[#0f2438] text-slate-300 flex flex-col justify-between border-r border-slate-800 z-20">
        <div>
          {/* Unit Brand Header */}
          <div className="p-3.5 border-b border-slate-800/80 bg-[#0b1c2d]">
            <h2 className="text-[11px] font-medium text-white tracking-tight leading-tight">
              Primary Steam Reformer
            </h2>
            <p className="text-[9.5px] font-normal text-slate-400 mt-0.5">
              Synthesis Gas Plant
            </p>
          </div>

          {/* Screens Section Label */}
          <div className="px-3.5 pt-3 pb-1">
            <span className="text-[9px] font-normal text-slate-400 uppercase tracking-wider">
              SCREENS
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-0.5">
            {NAV_SCREENS.map(item => {
              const isActive = activeScreen === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScreen(item.id)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[11px] font-normal text-left transition-all cursor-pointer
                    ${isActive 
                      ? "bg-[#0090d0] text-white shadow-xs" 
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }
                  `}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info / Signed in footer */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0b1c2d] flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#0090d0] text-white flex items-center justify-center font-normal text-[10px]">
              AD
            </div>
            <div>
              <div className="font-normal text-white leading-tight">Admin</div>
              <div className="text-[9px] text-slate-400 font-normal">Signed In</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onReconfigureTopology}
            title="Edit Equipment Topology (Step 1)"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. MAIN DASHBOARD CONTENT AREA                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f7f9]">
        
        {/* Unit Overview Sub-Header: Ingenero Brand Title & Collapse All */}
        <div className="bg-white px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xs font-semibold uppercase tracking-wider text-[#0090d0]">
              PROCESS EFFICIENCY
            </h1>
            {activeScreen !== "overview" && (
              <button
                type="button"
                onClick={() => setActiveScreen("overview")}
                className="text-[9px] text-[#0090d0] hover:underline flex items-center gap-1 cursor-pointer font-medium bg-sky-50 px-2 py-0.5 rounded border border-sky-200"
              >
                <span>← Back to Overview</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-600 font-normal shadow-2xs cursor-pointer transition-all"
            >
              <ChevronUp className="w-3 h-3 text-slate-500" />
              <span>Collapse All</span>
            </button>
          </div>
        </div>

        {/* Scrollable Center Area (Grid: Left Main 74%, Right Sidebar 26%) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-2">
          
          <div className="w-full flex flex-col gap-2 min-w-0">

              {/* ───────────────────────────────────────────────────────────── */}
              {/* SECTION HEADER: OPPORTUNITY (Ingenero Ice-Blue Theme Banner)   */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3 py-1 rounded-lg flex items-center justify-between shadow-2xs">
                <h2 className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-700">
                  OPPORTUNITY
                </h2>

                <div className="flex items-center gap-2">
                  {/* Actual Timestamp Pill */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs text-[9px] text-slate-600 font-normal">
                    <span className="text-[8px] text-slate-400 uppercase">ACTUAL :</span>
                    <input 
                      type="date" 
                      value={toDisplayDateInput(selectedDate)} 
                      onChange={e => setSelectedDate(toBackendDateInput(e.target.value))}
                      className="bg-transparent text-slate-700 outline-none text-[9px] cursor-pointer font-medium"
                    />
                    <select 
                      value={selectedHour} 
                      onChange={e => setSelectedHour(e.target.value)}
                      className="bg-transparent text-slate-700 outline-none text-[9px] cursor-pointer"
                    >
                      {Array.from({length: 24}).map((_, i) => {
                        const val = i < 10 ? `0${i}` : `${i}`;
                        return <option key={val} value={val}>{val}:00</option>;
                      })}
                    </select>
                    <select 
                      value={selectedMinute} 
                      onChange={e => setSelectedMinute(e.target.value)}
                      className="bg-transparent text-slate-700 outline-none text-[9px] cursor-pointer"
                    >
                      <option value="00">00</option>
                      <option value="30">30</option>
                    </select>
                  </div>

                  {/* Optimum Benchmark Date Pill */}
                  {lbmData?.knn_optimum_match?.matched_timestamp && (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs text-[9px] text-slate-600 font-normal animate-fadeIn">
                      <span className="text-[8px] text-slate-400 uppercase">BENCHMARK :</span>
                      <span className="text-slate-700">
                        {formatBenchmarkHistoricalDate(lbmData.knn_optimum_match.matched_timestamp)}
                      </span>
                      <span className="text-[8px] text-[#0090d0] bg-sky-50 border border-sky-200 px-1 py-0.2 rounded ml-0.5">
                        {lbmData.knn_optimum_match.similarity_score_pct || 98.5}% Match
                      </span>
                    </div>
                  )}

                  {/* Operational Action Icons as per Ingenero Standard Theme */}
                  <div className="flex items-center gap-1 text-slate-400 pl-0.5">
                    <Calendar className="w-3.5 h-3.5 hover:text-[#0090d0] cursor-pointer transition-colors" />
                    <RotateCcw 
                      onClick={handleExecuteModel}
                      className={`w-3.5 h-3.5 hover:text-[#0090d0] cursor-pointer transition-colors ${isLoadingData ? 'animate-spin text-[#0090d0]' : ''}`} 
                    />
                    <Bell className="w-3.5 h-3.5 hover:text-[#0090d0] cursor-pointer transition-colors" />
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500 hover:text-[#0090d0] cursor-pointer transition-colors" />
                  </div>

                  {/* Run Benchmarking Model Button with 3 Horizontal Waving Dots */}
                  <button 
                    type="button" 
                    onClick={handleExecuteModel}
                    disabled={isLoadingData}
                    className="ml-1 px-2.5 py-1 bg-[#0090d0] hover:bg-[#0080ba] disabled:opacity-90 text-white rounded font-medium text-[9.5px] flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    {isLoadingData ? (
                      <div className="flex items-center gap-1.5 px-0.5">
                        <span className="text-[8.5px] font-medium tracking-wide">Model Running</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: 'waveDot 1.1s ease-in-out 0s infinite' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: 'waveDot 1.1s ease-in-out 0.22s infinite' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: 'waveDot 1.1s ease-in-out 0.44s infinite' }} />
                        </span>
                      </div>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run Model</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* ───────────────────────────────────────────────────────────── */}
              {/* SHUTDOWN / COLD IDLE ALERT BANNER                             */}
              {/* ───────────────────────────────────────────────────────────── */}
              {(lbmData?.is_shutdown || lbmData?.status === "shutdown_detected") && (
                <div className="p-2 sm:p-2.5 rounded-lg border border-red-300 bg-red-50 text-red-900 shadow-xs flex flex-col gap-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-red-800">
                            LBM Not Found: Date Selected is Around Plant Shutdown / Cold Idle Days
                          </h3>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-red-200 text-red-800 uppercase">
                            Benchmark Suspended
                          </span>
                        </div>
                        <p className="text-[11px] text-red-700 mt-0.5">
                          {lbmData?.message || `The date selected (${formatIngeneroDate(lbmData?.selected_timestamp || selectedDate)}) is a plant shutdown or trip period. Benchmarking model cannot compute benchmark under extinguished or depressurized regimes.`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSwitchToNearestClean}
                      className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-[10.5px] font-medium shrink-0 flex items-center gap-1 shadow-xs cursor-pointer transition-all self-start sm:self-auto"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Switch to Clean Window ({formatIngeneroDate(lbmData?.nearest_stable_timestamp || '2025-12-01 15:30:00')})</span>
                    </button>
                  </div>

                  {/* Specific Shutdown Reasons */}
                  {lbmData?.shutdown_reasons && lbmData.shutdown_reasons.length > 0 && (
                    <div className="pt-1.5 border-t border-red-200/80">
                      <span className="text-[9.5px] font-medium text-red-800 uppercase tracking-wider block mb-1">
                        Detected Shutdown Indicators:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {lbmData.shutdown_reasons.map((reason: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[10px] text-red-700 bg-white/80 px-2 py-0.5 rounded border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* UNIT OVERVIEW CONTENT (WHEN NOT IN MONITORING, FORECASTING OR OPTIMIZATION) */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeScreen !== "monitoring" && activeScreen !== "forecasting" && activeScreen !== "optimization" && (
                <>
                  {/* 1. THREE PREDICTED OPPORTUNITY SAVINGS CARDS */}
                  {(() => {
                const actConv = kpis.reformer_methane_conversion?.actual || 88.93;
                const optConv = kpis.reformer_methane_conversion?.benchmark !== "N/A" ? Number(kpis.reformer_methane_conversion?.benchmark) : 89.85;
                const deltaConv = Math.max(0, optConv - actConv);

                const actTherm = kpis.overall_thermal_efficiency?.actual || 93.18;
                const optTherm = kpis.overall_thermal_efficiency?.benchmark !== "N/A" ? Number(kpis.overall_thermal_efficiency?.benchmark) : 94.80;
                const deltaTherm = Math.max(0, optTherm - actTherm);

                const pngFlow = Number(rawTags["ar.ar2.ref.Png_To_Saturator_Flow_Comp"]) || 67.26;
                const carbonFactor = 0.867;

                const reformerLoad = lbmData?.reformer_load_pct || 100.0;
                const rawFeedFlow = Number(rawTags["ar.ar2.ref.Png_To_Saturator_Flow_Comp"]) || 185.0;

                // 1. Production Opportunity (MT/Day of Methanol):
                // Calibrated to Plant Nameplate/Operating Capacity: 1,850 MT/Day at 100% load
                // (67.26 t/h natural gas feed yields ~1,850 MT/Day Methanol accounting for real plant carbon balance & purges)
                const plantCapacityMtd = 1850;
                const baseProdMtd = plantCapacityMtd * (reformerLoad / 100);
                const prodOppMtd = (baseProdMtd * (deltaConv / 100)).toFixed(2);

                // 2. Energy Reduction Opportunity (MMBTU/Day of Fuel Firing):
                // Daily Fuel Firing (30,720 MMBTU/Day) * (Delta Thermal Efficiency / Optimum Thermal Efficiency)
                const totalFiringMmbtuDay = 30720;
                const energyOppMmbtuDay = (totalFiringMmbtuDay * (deltaTherm / (optTherm || 94.8))).toFixed(1);

                // 3. CO2 Reduction Opportunity (MT/Day of CO2):
                // Reduced combustion emissions: Energy Saved (MMBTU/Day) * 0.05306 MT CO2 / MMBTU
                const co2OppMtd = (Number(energyOppMmbtuDay) * 0.05306).toFixed(2);

                return (
                  <div className="space-y-1.5">
                    {/* 75% Space for Opportunity & 25% Space for AI Match Tags (Guaranteed Same Row) */}
                    <div className="flex flex-row gap-2 items-stretch w-full">
                      
                      {/* 75% Space: 3 PREDICTED OPPORTUNITY SAVINGS CARDS (Matching Ingenero Reference Snip) */}
                      <div className="w-[75%] grid grid-cols-3 gap-2">
                        {/* Opportunity Card 1: Production Opportunity (MT/Day) */}
                        <div className="bg-white rounded-lg border border-slate-200 p-1.5 sm:p-2 shadow-2xs hover:border-[#0090d0] transition-all flex flex-col justify-between min-h-[58px]">
                          {isLoadingData ? (
                            <div className="flex items-center justify-center w-full h-[46px] my-auto">
                              <BoxWavingDots size="w-2 h-2" />
                            </div>
                          ) : (
                            <>
                              {/* Top Row: Title & Unit on Top Left, Icons on Top Right */}
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[8px] sm:text-[8.5px] font-semibold text-slate-700 uppercase tracking-tight leading-tight truncate" title="PREDICTED PRODUCTION OPPORTUNITY">
                                    PREDICTED PRODUCTION OPPORTUNITY
                                  </span>
                                  <span className="text-[6.5px] font-normal text-slate-400">
                                    (MT/Day)
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <span 
                                    title={`Production Proof: Plant Capacity (${baseProdMtd.toFixed(0)} MT/d @ ${reformerLoad}%) × (Benchmark Conv ${optConv}% - Actual Conv ${actConv}%) = ${prodOppMtd} MT/Day Methanol`}
                                    className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0] cursor-help hover:bg-sky-50"
                                  >
                                    <Info className="w-2 h-2" />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveScreen("monitoring")}
                                    title="Open Process Monitoring Trend Analysis"
                                    className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0] hover:bg-sky-50 cursor-pointer"
                                  >
                                    <TrendingUp className="w-2 h-2" />
                                  </button>
                                </div>
                              </div>

                              {/* Value Row: Icon and Big Value */}
                              <div className="flex items-center gap-2 mt-auto">
                                <div className="w-5.5 h-5.5 rounded-full border border-sky-200 bg-sky-50 flex items-center justify-center shrink-0 text-[#0090d0]">
                                  <Zap className="w-3 h-3 text-[#0090d0]" />
                                </div>
                                <span className="text-lg sm:text-xl font-bold text-[#0090d0] tracking-tight leading-none">
                                  {prodOppMtd}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Opportunity Card 2: Thermal / Energy Reduction Opportunity (MMBTU/Day) */}
                        <div className="bg-white rounded-lg border border-slate-200 p-1.5 sm:p-2 shadow-2xs hover:border-[#0090d0] transition-all flex flex-col justify-between min-h-[58px]">
                          {isLoadingData ? (
                            <div className="flex items-center justify-center w-full h-[46px] my-auto">
                              <BoxWavingDots size="w-2 h-2" />
                            </div>
                          ) : (
                            <>
                              {/* Top Row: Title & Unit on Top Left, Icons on Top Right */}
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[8px] sm:text-[8.5px] font-semibold text-slate-700 uppercase tracking-tight leading-tight truncate" title="PREDICTED ENERGY REDUCTION OPPORTUNITY">
                                    PREDICTED ENERGY REDUCTION OPPORTUNITY
                                  </span>
                                  <span className="text-[6.5px] font-normal text-slate-400">
                                    (MMBTU/Day)
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <span 
                                    title={`Energy Proof: Total Firing (${totalFiringMmbtuDay} MMBTU/d) × [(Benchmark Eff ${optTherm}% - Actual Eff ${actTherm}%) / Benchmark Eff ${optTherm}%] = ${energyOppMmbtuDay} MMBTU/Day Fuel Gas`}
                                    className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0] cursor-help hover:bg-sky-50"
                                  >
                                    <Info className="w-2 h-2" />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveScreen("monitoring")}
                                    title="Open Process Monitoring Trend Analysis"
                                    className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0] hover:bg-sky-50 cursor-pointer"
                                  >
                                    <TrendingUp className="w-2 h-2" />
                                  </button>
                                </div>
                              </div>

                              {/* Value Row: Icon and Big Value */}
                              <div className="flex items-center gap-2 mt-auto">
                                <div className="w-5.5 h-5.5 rounded-full border border-sky-200 bg-sky-50 flex items-center justify-center shrink-0 text-[#0090d0]">
                                  <Flame className="w-3 h-3 text-[#0090d0]" />
                                </div>
                                <span className="text-lg sm:text-xl font-bold text-[#0090d0] tracking-tight leading-none">
                                  {energyOppMmbtuDay}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Opportunity Card 3: CO2 Reduction Opportunity (MT/Day) */}
                        <div className="bg-white rounded-lg border border-slate-200 p-1.5 sm:p-2 shadow-2xs hover:border-[#0090d0] transition-all flex flex-col justify-between min-h-[58px]">
                          {isLoadingData ? (
                            <div className="flex items-center justify-center w-full h-[46px] my-auto">
                              <BoxWavingDots size="w-2 h-2" />
                            </div>
                          ) : (
                            <>
                              {/* Top Row: Title & Unit on Top Left, Icons on Top Right */}
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[8px] sm:text-[8.5px] font-semibold text-slate-700 uppercase tracking-tight leading-tight truncate" title="PREDICTED CO2 REDUCTION OPPORTUNITY">
                                    PREDICTED CO2 REDUCTION OPPORTUNITY
                                  </span>
                                  <span className="text-[6.5px] font-normal text-slate-400">
                                    (MT/Day)
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <span 
                                    title={`CO2 Proof: Energy Saved (${energyOppMmbtuDay} MMBTU/d) × EPA Natural Gas Factor (0.05306 MT CO2/MMBTU) = ${co2OppMtd} MT/Day CO2 avoided`}
                                    className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0] cursor-help hover:bg-sky-50"
                                  >
                                    <Info className="w-2 h-2" />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveScreen("monitoring")}
                                    title="Open Process Monitoring Trend Analysis"
                                    className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0] hover:bg-sky-50 cursor-pointer"
                                  >
                                    <TrendingUp className="w-2 h-2" />
                                  </button>
                                </div>
                              </div>

                              {/* Value Row: Icon and Big Value */}
                              <div className="flex items-center gap-2 mt-auto">
                                <div className="w-5.5 h-5.5 rounded-full border border-emerald-200 bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600">
                                  <Leaf className="w-3 h-3 text-emerald-600" />
                                </div>
                                <span className="text-lg sm:text-xl font-bold text-emerald-700 tracking-tight leading-none">
                                  {co2OppMtd}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 25% Space: MATCH TAGS CARD (Ultra-Compact) */}
                      <div className="w-[25%] flex flex-col">
                        <div className="bg-white rounded-lg border border-slate-200 p-1.5 sm:p-2 shadow-2xs hover:border-[#0090d0] transition-all flex flex-col justify-between h-full min-h-[58px]">
                          {isLoadingData ? (
                            <div className="flex items-center justify-center w-full h-[46px] my-auto">
                              <BoxWavingDots size="w-2 h-2" />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between border-b border-slate-100 pb-0.5 mb-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] sm:text-[8.5px] font-semibold text-slate-700 uppercase tracking-tight">
                                    MATCH TAGS
                                  </span>
                                </div>
                                <span className="text-[6.5px] text-slate-400 font-normal">
                                  Baseline
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1 my-0">
                                {/* Tag 1 */}
                                <div className="p-0.5 px-1.5 rounded border border-slate-100 bg-slate-50/60 flex flex-col justify-center">
                                  <div className="text-[6.5px] text-slate-500 truncate" title="Saturator Feed Flow">
                                    Feed Flow
                                  </div>
                                  <div className="flex items-baseline justify-between gap-1 text-[7.5px]">
                                    <span className="text-slate-800 font-normal whitespace-nowrap">
                                      {rawFeedFlow > 100 ? rawFeedFlow.toFixed(1) : "185.0"} <span className="text-[6px] text-slate-400">t/h</span>
                                    </span>
                                    <span className="text-[7px] text-[#0090d0] font-normal whitespace-nowrap">
                                      Bmk: 185.2
                                    </span>
                                  </div>
                                </div>
                                {/* Tag 2 */}
                                <div className="p-0.5 px-1.5 rounded border border-slate-100 bg-slate-50/60 flex flex-col justify-center">
                                  <div className="text-[6.5px] text-slate-500 truncate" title="Feed Gas Nitrogen">
                                    Feed Gas N₂
                                  </div>
                                  <div className="flex items-baseline justify-between gap-1 text-[7.5px]">
                                    <span className="text-slate-800 font-normal whitespace-nowrap">
                                      0.82 <span className="text-[6px] text-slate-400">%</span>
                                    </span>
                                    <span className="text-[7px] text-[#0090d0] font-normal whitespace-nowrap">
                                      Bmk: 0.80
                                    </span>
                                  </div>
                                </div>
                                {/* Tag 3 */}
                                <div className="p-0.5 px-1.5 rounded border border-slate-100 bg-slate-50/60 flex flex-col justify-center">
                                  <div className="text-[6.5px] text-slate-500 truncate" title="Feed Carbon Factor">
                                    Carbon Factor
                                  </div>
                                  <div className="flex items-baseline justify-between gap-1 text-[7.5px]">
                                    <span className="text-slate-800 font-normal whitespace-nowrap">
                                      0.867 <span className="text-[6px] text-slate-400">wt</span>
                                    </span>
                                    <span className="text-[7px] text-[#0090d0] font-normal whitespace-nowrap">
                                      Bmk: 0.865
                                    </span>
                                  </div>
                                </div>
                                {/* Tag 4 */}
                                <div className="p-0.5 px-1.5 rounded border border-slate-100 bg-slate-50/60 flex flex-col justify-center">
                                  <div className="text-[6.5px] text-slate-500 truncate" title="Reformer Load">
                                    Reformer Load
                                  </div>
                                  <div className="flex items-baseline justify-between gap-1 text-[7.5px]">
                                    <span className="text-slate-800 font-normal whitespace-nowrap">
                                      {reformerLoad}%
                                    </span>
                                    <span className="text-[7px] text-[#0090d0] font-normal whitespace-nowrap">
                                      Bmk: 100.0%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Clean Plant Status Strip as shown in Ingenero Reference */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-[9.5px] font-normal text-slate-600 shadow-2xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>PLANT STATUS: <strong className="font-semibold text-slate-700">ONLINE</strong></span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-[9.5px] font-normal text-slate-600 shadow-2xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>REGIME: <strong className="font-semibold text-slate-700">BASELOAD SMR ({reformerLoad}%)</strong></span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* 2. INTERACTIVE ACTIONABLE EQUIPMENT HEALTH BADGES OVER PFD    */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-1 text-[10px] font-normal text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#0090d0]" />
                  <span className="text-slate-600 uppercase tracking-wider font-medium text-[10px]">PROCESS TOPOLOGY &amp; EQUIPMENT HEALTH OVERLAY</span>
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Actionable Area 1: E-1201 High TMT Amber Badge */}
                  <button
                    type="button"
                    onClick={() => setActiveScreen("convection")}
                    className="px-2.5 py-0.5 rounded-full bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 text-[9px] font-normal flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>E-1201: High TMT {lbmAlerts.e1201TmtValue}°C (Fouled {lbmAlerts.e1201Cleanliness}%)</span>
                  </button>

                  {/* Actionable Area 2: H2S Adsorption Safe Green Badge */}
                  <button
                    type="button"
                    onClick={() => setActiveScreen("desulfurization")}
                    className="px-2.5 py-0.5 rounded-full bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] font-normal flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>✓ H₂S Safe: {lbmAlerts.h2sRemainingPct}% Margin ({lbmAlerts.h2sDaysLeft}d)</span>
                  </button>

                  {/* Actionable Area 3: SMR Radiant Red Badge */}
                  <button
                    type="button"
                    onClick={() => setActiveScreen("smr")}
                    className="px-2.5 py-0.5 rounded-full bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 text-[9px] font-normal flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span>⚠ Radiant Eff Low: {lbmAlerts.radiantEffValue}% (High Scattering)</span>
                  </button>

                  {/* Actionable Area 4: High Stack Temp & Convection Fouling Badge */}
                  <button
                    type="button"
                    onClick={() => setActiveScreen("convection")}
                    className="px-2.5 py-0.5 rounded-full bg-white hover:bg-orange-50 border border-orange-300 text-orange-900 text-[9px] font-normal flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                    title="Stack Temp 185°C vs 150°C Baseline: 4.85 MW Heat Loss, 23.1 t/d Excess CO2. Convection cleaning recommended."
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                    <span>🔥 Stack Temp: {lbmData?.emissions_and_balance?.stack_temperature_analysis?.actual_c ?? 185}°C (+{lbmData?.emissions_and_balance?.stack_temperature_analysis?.excess_co2_tpd ?? 23.1} t/d CO₂)</span>
                  </button>

                  {/* Actionable Area 5: The Optimization Model Shortcut */}
                  <button
                    type="button"
                    onClick={() => setActiveScreen("optimization")}
                    className="px-2.5 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                    title="Open The Optimization Model — Multi-Objective Performance, Energy (SEC) &amp; Shutdown Trade-Off"
                  >
                    <Sliders className="w-2.5 h-2.5 text-emerald-700" />
                    <span>The Optimization Model &rarr;</span>
                  </button>

                  {/* Actionable Area 6: Forecasting Models Shortcut */}
                  <button
                    type="button"
                    onClick={() => setActiveScreen("forecasting")}
                    className="px-2.5 py-0.5 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-300 text-[#0090d0] text-[9px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                    title="Open Asset Life &amp; Prognostics Forecasting Digital Twins"
                  >
                    <TrendingUp className="w-2.5 h-2.5 text-[#0090d0]" />
                    <span>Forecasting Models &rarr;</span>
                  </button>
                </div>
              </div>

              {/* INTERACTIVE PROCESS FLOW DIAGRAM (PFD) - EXPANDED CANVAS */}
              <div className="h-[470px] w-full relative">
                <ReformerPfdCanvas
                  equipmentMap={equipmentMap}
                  equipmentConfigMap={equipmentConfigMap}
                  activeSection={activeScreen === "overview" ? "full" : activeScreen}
                  sectionSelectTrigger={0}
                  onSelectSection={handlePfdSectionSelect}
                  lbmAlerts={lbmAlerts}
                  emissionsAndBalance={lbmData?.emissions_and_balance}
                />
              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* SECTION DRILLDOWN ANALYSIS WINDOW (WHEN DRILLING)           */}
              {/* ─────────────────────────────────────────────────────────── */}
              {activeScreen === "feed" && (
                <div className="p-3.5 rounded-lg border border-sky-200 bg-white shadow-2xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-[#0090d0]" />
                      <h4 className="text-xs font-medium text-slate-800">
                        Feed Gas Pre-Treatment &amp; Compression Train (K-101 / E-101)
                      </h4>
                      <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-amber-100 text-amber-800">
                        Efficiency Gap: -3.6%
                      </span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-500">
                      Suction: <strong className="text-slate-700">24.5 bar @ 32.0°C</strong> | Discharge: <strong className="text-slate-700">42.0 bar @ 128.5°C</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {/* Card 1: Compressor Efficiency */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        ISENTROPIC EFFICIENCY
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">78.4%</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">82.0%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Deviation</span>
                        <span className="text-amber-600 font-normal">-3.6%</span>
                      </div>
                    </div>

                    {/* Card 2: Compression Power */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        COMPRESSION POWER
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">3.82 MW</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Target</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">3.55 MW</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Opportunity</span>
                        <span className="text-emerald-600 font-normal">0.27 MW</span>
                      </div>
                    </div>

                    {/* Card 3: Compression Ratio */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        COMPRESSION RATIO
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">1.71</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-emerald-700 block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-emerald-700 block mt-0.5">1.68</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Polytropic Head</span>
                        <span className="text-slate-600 font-normal">48.2 kJ/kg</span>
                      </div>
                    </div>

                    {/* Card 4: Aftercooler Exit Temp */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        AFTERCOOLER EXIT TEMP
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">45.0°C</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-emerald-700 block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-emerald-700 block mt-0.5">40.0°C</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">CW Return</span>
                        <span className="text-slate-500 font-normal">38.5°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeScreen === "smr" && (
                <div className="p-3.5 rounded-lg border border-amber-200 bg-white shadow-2xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-medium text-slate-800">
                        Primary Reformer Radiant Box &amp; Burner Firing Evaluation (SMR H-101)
                      </h4>
                      <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-amber-100 text-amber-800">
                        Conversion Gap: -0.90%
                      </span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-500">
                      Catalyst Volume: <strong className="text-slate-700">336 Tubes (Ni/Al₂O₃)</strong> | S/C: <strong className="text-slate-700">2.79 mol/mol</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* Card 1: CH4 Conversion */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between hover:border-sky-300 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9.5px] font-medium text-slate-700 truncate">
                          CH₄ CONVERSION
                        </span>
                        <button
                          type="button"
                          onClick={() => handleJumpToRec("rec_smr_conv", "smr")}
                          className="px-1.5 py-0.2 text-[8px] font-normal bg-sky-50 hover:bg-sky-100 text-[#0090d0] rounded border border-sky-200 flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                          title="Redirect to Methane Conversion recommendation"
                        >
                          <span>Advisory</span>
                          <span>→</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">89.2%</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">90.1%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Deviation</span>
                        <span className="text-amber-600 font-normal">-0.90%</span>
                      </div>
                    </div>

                    {/* Card 2: AOT Bridgewall */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between hover:border-sky-300 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9.5px] font-medium text-slate-700 truncate">
                          AOT BRIDGEWALL
                        </span>
                        <button
                          id="btn-advisory-aot-bridgewall"
                          type="button"
                          onClick={() => handleJumpToRec("rec_smr_aot", "smr")}
                          className="px-1.5 py-0.5 text-[8.5px] font-normal bg-sky-100 hover:bg-sky-200 text-[#0090d0] rounded border border-sky-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Redirect to Recommendations advisory & diagnostic inspection"
                        >
                          <span>Advisory</span>
                          <span className="text-[10px]">→</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-red-700 block mt-0.5">916.4°C</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">850.0°C</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Penalty</span>
                        <span className="text-red-600 font-normal">+66.4°C</span>
                      </div>
                    </div>

                    {/* Card 3: S/C Ratio */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between hover:border-sky-300 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9.5px] font-medium text-slate-700 truncate">
                          S/C RATIO
                        </span>
                        <button
                          type="button"
                          onClick={() => handleJumpToRec("rec_smr_sc", "smr")}
                          className="px-1.5 py-0.2 text-[8px] font-normal bg-sky-50 hover:bg-sky-100 text-[#0090d0] rounded border border-sky-200 flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                          title="Redirect to Steam-to-Carbon recommendation"
                        >
                          <span>Advisory</span>
                          <span>→</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">2.79</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">2.95</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Equilibrium</span>
                        <span className="text-amber-600 font-normal">+0.16</span>
                      </div>
                    </div>

                    {/* Card 4: Methane Slippage */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between hover:border-sky-300 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9.5px] font-medium text-slate-700 truncate">
                          METHANE SLIPPAGE
                        </span>
                        <button
                          type="button"
                          onClick={() => handleJumpToRec("rec_smr_sc", "smr")}
                          className="px-1.5 py-0.2 text-[8px] font-normal bg-sky-50 hover:bg-sky-100 text-[#0090d0] rounded border border-sky-200 flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                          title="Redirect to Methane Slippage recommendation"
                        >
                          <span>Advisory</span>
                          <span>→</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">4.67%</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">4.38%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Yield Opportunity</span>
                        <span className="text-slate-600 font-normal">+0.29%</span>
                      </div>
                    </div>

                    {/* Card 5: Firing Duty */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        FIRING DUTY
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">112.4</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">108.2</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Unit: MW</span>
                        <span className="text-slate-500 font-normal">FG: 9.8 t/h</span>
                      </div>
                    </div>

                    {/* Card 6: Tube Skin Margin */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        TUBE SKIN MARGIN
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-emerald-700 block mt-0.5">+24.0°C</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-emerald-700 block font-normal">Limit</span>
                          <span className="text-base font-normal text-emerald-700 block mt-0.5">+15.0°C</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Peak Skin</span>
                        <span className="text-emerald-600 font-normal">948.0°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeScreen === "cooling" && (
                <div className="p-3.5 rounded-lg border border-sky-200 bg-white shadow-2xs animate-fadeIn space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#0090d0]" />
                      <h4 className="text-xs font-medium text-slate-800">
                        Waste Heat Boiler (V-1201) &amp; Reformed Syngas Quench Train (E-1205)
                      </h4>
                      <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                        Duty: 61.67 MW
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Zero Steam Leak (BFW/Steam: 0.985)
                      </span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-500">
                      Inlet Syngas: <strong className="text-slate-700">856.0°C @ 28.0 bar</strong> | Quench Exit: <strong className="text-slate-700">360.2°C</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                    {/* Card 1: Steam Leak Detection (BFW / Steam Ratio) */}
                    <div className="p-2.5 rounded border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold text-emerald-900 truncate">
                          STEAM LEAK (BFW/STEAM)
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-emerald-200 bg-white rounded border border-emerald-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-bold text-emerald-700 block mt-0.5 font-mono">0.985</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[7.5px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5 font-mono">0.980</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[8.5px] mt-1 pt-1 border-t border-emerald-100">
                        <span className="text-slate-500 font-mono">t/t (<span className="text-emerald-700 font-semibold">Tight</span>)</span>
                        <span className="text-emerald-700 font-bold">&lt;1.02 Safe Limit</span>
                      </div>
                    </div>

                    {/* Card 2: WHB Duty */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        WHB STEAM DUTY
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">61.67</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">64.87</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Unit: MW</span>
                        <span className="text-emerald-600 font-normal">+3.20 MW</span>
                      </div>
                    </div>

                    {/* Card 3: HP Steam Generation */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        HP STEAM GENERATION
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">131.6</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">136.2</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Unit: t/h</span>
                        <span className="text-slate-500 font-normal">93.4 bar drum</span>
                      </div>
                    </div>

                    {/* Card 4: Quench Exit Temp */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        QUENCH EXIT TEMP
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">360.2°C</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-[#0090d0] block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-[#0090d0] block mt-0.5">350.0°C</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Deviation</span>
                        <span className="text-amber-600 font-normal">+10.2°C</span>
                      </div>
                    </div>

                    {/* Card 5: Export Syngas */}
                    <div className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                      <div className="text-[9.5px] font-medium text-slate-700 truncate mb-1">
                        EXPORT SYNGAS FLOW
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white rounded border border-slate-100 py-1.5 shadow-2xs my-1">
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-slate-400 block font-normal">Actual</span>
                          <span className="text-base font-normal text-slate-800 block mt-0.5">96.6</span>
                        </div>
                        <div className="px-2 text-left">
                          <span className="text-[8px] uppercase tracking-wider text-emerald-700 block font-normal">Benchmark</span>
                          <span className="text-base font-normal text-emerald-700 block mt-0.5">96.0</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-slate-400">kNm³/h</span>
                        <span className="text-emerald-600 font-normal">M-Ratio: 2.05</span>
                      </div>
                    </div>
                  </div>

                  {/* WHB Steam Leak Integrity & Mass Balance Diagnostic Banner */}
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-md flex items-start gap-2.5 text-[9.5px]">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 uppercase tracking-wide">
                          WHB Steam Leak Diagnostic &amp; Boiler Feed Water Mass Balance
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold text-[8px] uppercase">
                          No Active Leak Detected &bull; Integrity Secure
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        To confirm boiler tube bundle integrity, the model validates the ratio of <strong>BFW Consumption to HP Steam Generation</strong>. Under normal tight conditions, the ratio operates stably at <strong>~0.98 t/t</strong> (current: <strong className="text-emerald-700">0.985 t/t</strong> with BFW = 134.2 t/h and Steam = 136.2 t/h). If an internal tube steam leak occurs, measured steam generation decreases while BFW consumption increases to maintain drum level, elevating the ratio above <strong>1.02 t/t</strong> and causing reformer outlet syngas enthalpy to shift.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeScreen === "convection" && (
                <div className="p-3.5 rounded-lg border border-amber-200 bg-white shadow-2xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-medium text-slate-800">
                        Convection Heat Exchanger Train Analysis (E-1201 to E-1204)
                      </h4>
                      <span className="text-[10px] font-normal px-2 py-0.2 rounded-full bg-red-100 text-red-700">
                        Stack Penalty: +41.6°C
                      </span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-500">
                      Basis: <strong className="text-slate-700">Back-Calculated Target</strong>
                    </span>
                  </div>

                  {/* 4-Exchanger Infographic in Series */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {convectionDiag.exchangers.map((ex: any) => (
                      <div key={ex.tag} className="p-2.5 rounded border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800 text-[11px]">{ex.tag}</span>
                            <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-normal ${
                              ex.cleanliness_factor.includes("71") 
                                ? "bg-red-100 text-red-800" 
                                : "bg-sky-100 text-sky-800"
                            }`}>
                              {ex.cleanliness_factor} Clean
                            </span>
                          </div>
                          <p className="text-[9.5px] text-slate-500 truncate mt-0.5">{ex.name}</p>

                          <div className="mt-2 space-y-1 text-[10px] font-normal">
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Flue Gas Exit:</span>
                              <span className="font-mono text-slate-800">{ex.actual_flue_gas_out}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500">
                              <span>Back-Calc Target:</span>
                              <span className="font-mono text-[#0090d0]">{ex.optimum_flue_gas_out}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Process Temp Out:</span>
                              <span className="font-mono text-slate-800">{ex.actual_process_out}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500">
                              <span>LMTD:</span>
                              <span className="font-mono text-slate-700">{ex.lmtd_actual}</span>
                            </div>
                          </div>

                          {ex.row1_tmt_actual && (
                            <div className="mt-2 pt-1.5 border-t border-amber-200/70 bg-amber-50/80 -mx-1 px-1.5 py-1 rounded">
                              <div className="flex items-center justify-between text-[9px] text-amber-900 font-medium">
                                <span>Row 1 TMT ({ex.row1_moc?.includes("Incoloy") ? "Incoloy" : "Row 1"}):</span>
                                <span className="font-mono font-bold text-red-700">{ex.row1_tmt_actual}</span>
                              </div>
                              <div className="flex items-center justify-between text-[8.5px] text-amber-800 mt-0.5">
                                <span>Limit: {ex.row1_tmt_limit || "620.0°C"}</span>
                                <span className="text-amber-700 font-bold">Margin: {ex.row1_tmt_margin || "+9.7°C"}</span>
                              </div>
                              <div className="text-[8px] text-slate-500 mt-0.5 italic">
                                Fouling: ~90.8% (+61.1°C of TMT rise)
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-200 text-[9px] text-slate-500">
                          Status: <span className="font-normal text-slate-700">{ex.fouling_status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────── */}
              {/* SECTION 1: PERFORMANCE KPIS (Ingenero Ice-Blue Banner)      */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3 py-1.5 rounded-lg flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    PERFORMANCE KPIS
                  </h3>
                  {activeScreen === "desulfurization" && (
                    <span className="text-[9.5px] font-normal text-slate-500 border-l border-sky-300 pl-3">
                      ZnO Guard Bed &bull; Campaign Start: <strong className="text-slate-700 font-normal">{campaignStartDateStr}</strong> ({dolDaysStr} Days on Line)
                    </span>
                  )}
                </div>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500 hover:text-[#0090d0] cursor-pointer transition-colors" />
              </div>

              {/* Performance KPI Cards Grid (4 Cards Across - 2 Columns: Actual, Benchmark) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {getSectionPerformanceKpis().map((item, idx) => (
                  <div 
                    key={idx} 
                    className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-2xs hover:border-[#0090d0] transition-all flex flex-col justify-between min-h-[82px]"
                  >
                    {isLoadingData ? (
                      <div className="flex items-center justify-center w-full h-[66px] my-auto">
                        <BoxWavingDots size="w-2 h-2" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between border-b border-slate-100 pb-1 mb-1">
                          <div className="min-w-0 pr-1">
                            <span className="text-[9px] font-semibold text-slate-700 uppercase tracking-tight block truncate" title={item.label === "R-VALUE (MODULE M)" ? "Stoichiometric Module M = (H2 - CO2) / (CO + CO2) | Benchmark: 2.05 mol/mol" : item.label}>
                              {item.label}
                            </span>
                            <span className="text-[7.5px] font-normal text-slate-400 block -mt-0.5">
                              ({item.uom})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.recId ? (
                              <button
                                id={`btn-advisory-perf-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJumpToRec(item.recId!, item.section);
                                }}
                                className="px-1.5 py-0.2 text-[7px] font-normal bg-sky-50 hover:bg-sky-100 text-[#0090d0] rounded border border-sky-200 flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                                title={`Redirect to ${item.label} recommendation advisory`}
                              >
                                <span>Advisory</span>
                                <span>→</span>
                              </button>
                            ) : null}
                            <span 
                              title={item.label === "R-VALUE (MODULE M)" ? "Stoichiometric Module M = (H2 - CO2) / (CO + CO2) | Benchmark: 2.05 mol/mol" : "Information"}
                              className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0] cursor-help"
                            >
                              <Info className="w-2 h-2" />
                            </span>
                            <span className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0]">
                              <TrendingUp className="w-2 h-2" />
                            </span>
                          </div>
                        </div>

                        {/* Values: Actual and Benchmark (2 Columns inside each block) */}
                        <div className="grid grid-cols-2 divide-x divide-slate-100 bg-slate-50/50 rounded border border-slate-100 py-1 px-1 my-1 shadow-2xs">
                          <div className="px-1.5 text-left">
                            <span className="text-sm font-semibold text-[#0090d0] block tracking-tight truncate">{item.actual}</span>
                            <span className="text-[6.5px] uppercase tracking-wider text-slate-400 block font-normal mt-0.5">ACTUAL</span>
                          </div>
                          <div className="px-1.5 text-left pl-1.5">
                            <span className="text-sm font-semibold text-slate-800 block tracking-tight truncate">{item.opt}</span>
                            <span className="text-[6.5px] uppercase tracking-wider text-slate-400 block font-normal mt-0.5">BENCHMARK</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[7.5px] mt-1 pt-1 border-t border-slate-100">
                          <span className="text-slate-400 truncate max-w-[110px]">{item.delta || "Target Spec"}</span>
                          <span className={`font-semibold shrink-0 ml-1 ${
                            item.status === "ACT TODAY" ? "text-amber-600" :
                            item.status === "WATCH" ? "text-amber-600" : "text-emerald-600"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* SECTION 2: PREDICTED KPIS (Ingenero Ice-Blue Banner)        */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3 py-1.5 rounded-lg flex items-center justify-between shadow-2xs">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                  PREDICTED KPIS
                </h3>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500 hover:text-[#0090d0] cursor-pointer transition-colors" />
              </div>

              {/* Predicted KPI Cards Grid (4 Cards Across - Reference Layout, No Trend Graph) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {getSectionPredictedKpis().map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      if (item.recId) handleJumpToRec(item.recId, item.section);
                    }}
                    className={`bg-white rounded-lg border border-slate-200 p-2.5 shadow-2xs hover:border-[#0090d0] transition-all flex flex-col justify-between min-h-[82px] ${
                      item.recId ? "cursor-pointer hover:bg-sky-50/10" : ""
                    }`}
                  >
                    {isLoadingData ? (
                      <div className="flex items-center justify-center w-full h-[66px] my-auto">
                        <BoxWavingDots size="w-2 h-2" />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between border-b border-slate-100 pb-1 mb-1">
                          <div className="min-w-0 pr-1 flex-1">
                            <span className="text-[8.5px] font-semibold text-slate-700 uppercase tracking-tight block leading-tight" title={item.label}>
                              {item.label}
                            </span>
                            <span className="text-[7.5px] font-normal text-slate-400 block -mt-0.5">
                              ({item.uom})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.recId ? (
                              <button
                                id={`btn-advisory-pred-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJumpToRec(item.recId!, item.section);
                                }}
                                className="px-1.5 py-0.2 text-[7px] font-normal bg-sky-50 hover:bg-sky-100 text-[#0090d0] rounded border border-sky-200 flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                                title={`Redirect to ${item.label} recommendation advisory`}
                              >
                                <span>Advisory</span>
                                <span>→</span>
                              </button>
                            ) : null}
                            <span className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0]">
                              <Info className="w-2 h-2" />
                            </span>
                            <span className="w-3.5 h-3.5 rounded-full border border-sky-300 flex items-center justify-center text-[7.5px] text-[#0090d0]">
                              <TrendingUp className="w-2 h-2" />
                            </span>
                          </div>
                        </div>

                        {/* Values: Actual and Optimum side-by-side */}
                        <div className="grid grid-cols-2 divide-x divide-slate-100 bg-slate-50/50 rounded border border-slate-100 py-1 px-1 my-1 shadow-2xs">
                          <div className="px-1.5 text-left">
                            <span className="text-sm font-semibold text-[#0090d0] block tracking-tight">{item.actual}</span>
                            <span className="text-[6.5px] uppercase tracking-wider text-slate-400 block font-normal mt-0.5">ACTUAL</span>
                          </div>
                          <div className="px-1.5 text-left pl-2">
                            <span className="text-sm font-semibold text-slate-800 block tracking-tight">{item.opt}</span>
                            <span className="text-[6.5px] uppercase tracking-wider text-slate-400 block font-normal mt-0.5">BENCHMARK</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[7.5px] mt-1 pt-1 border-t border-slate-100">
                          <span className="text-slate-400 truncate max-w-[120px]">{item.delta || "Target Spec"}</span>
                          <span className={`font-semibold shrink-0 ml-1 ${
                            item.status === "ACT TODAY" ? "text-amber-600" :
                            item.status === "WATCH" ? "text-amber-600" : "text-emerald-600"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* ─────────────────────────────────────────────────────────── */}
              {/* SECTION 3: KEY PARAMETERS (Ingenero Ice-Blue Banner)        */}
              {/* ─────────────────────────────────────────────────────────── */}
              <div className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3 py-1.5 rounded-lg flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    KEY PARAMETERS
                  </h3>
                  {/* Sub-tabs Process / Energy / Reliability */}
                  <div className="flex items-center gap-1 text-[8.5px]">
                    {(["process", "energy", "reliability"] as const).map(tabKey => (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => setKeyParamTab(tabKey)}
                        className={`px-2 py-0.5 rounded font-normal capitalize transition-colors cursor-pointer ${
                          keyParamTab === tabKey 
                            ? "bg-[#0090d0] text-white" 
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {tabKey}
                      </button>
                    ))}
                  </div>
                </div>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500 hover:text-[#0090d0] cursor-pointer transition-colors" />
              </div>

              {/* Key Parameters Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {keyParamTab === "process" && (
                  <>
                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">BRIDGEWALL TEMP</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.ref.Flue_gas_Bridgewall_temperature_top"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(°C)</span>
                            <span className="text-amber-600 font-medium">WATCH</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">S/C RATIO</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {kpis.steam_to_carbon_ratio?.actual}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(mol/mol)</span>
                            <span className="text-amber-600 font-medium">ACT TODAY</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">FEED GAS FLOW</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.ref.Png_To_Saturator_Flow_Comp"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(kNm³/h)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">CH4 SLIP OUT</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.syn.Outlet_CH4_from_V_1203"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(% mol)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                {keyParamTab === "energy" && (
                  <>
                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">STACK FLUE GAS</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-amber-700 my-0.5">
                            {rawTags["ar.ar2.ref.Stack_Temperature"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(°C)</span>
                            <span className="text-amber-600 font-medium">ACT TODAY</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">EXCESS O2</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.ref.PRIMARY_REFOSTACK_O2_Excess_O2"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(vol%)</span>
                            <span className="text-slate-500 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">STEAM FLOW</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.ref.V_1201_SH_OUT_FLOW"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(t/h)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">BFW OUT E-1204</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.ref.E_1204_OUT_BFW"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(°C)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                {keyParamTab === "reliability" && (
                  <>
                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">MAIN STEAM PRESS</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.ref.P_STEAM_MAIN"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(bar)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">TUBE SKIN MARGIN</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            +24.0
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(°C)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">STEAM TEMP OUT</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.ref.V_1201_OUT_SH_temp"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(°C)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 rounded-lg border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[66px]">
                      {isLoadingData ? (
                        <div className="flex items-center justify-center w-full h-[50px] my-auto">
                          <BoxWavingDots size="w-2 h-2" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[8px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">MUG FLOW K-1301</span>
                            <Info className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <div className="text-base font-medium text-slate-800 my-0.5">
                            {rawTags["ar.ar2.syn.MUG_flow_to_K_1301"]}
                          </div>
                          <div className="flex items-center justify-between text-[7.5px] pt-0.5 border-t border-slate-100">
                            <span className="text-slate-400">(kNm³/h)</span>
                            <span className="text-emerald-600 font-medium">ON TARGET</span>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* ───────────────────────────────────────────────────────────── */}
              {/* SECTION 4: ACTIONABLES TABLE (Only Shown on Overview Screen)  */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeScreen === "overview" && (
                <>
                  <div id="actionables-section" className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3 py-1.5 rounded-lg flex items-center justify-between shadow-2xs mt-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                        ACTIONABLES
                      </h3>
                  <span className="text-[9px] text-slate-500 font-normal border-l border-sky-300 pl-2.5 hidden md:inline">
                    Sequenced Root Cause Directives &amp; Operational Guardrails
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-normal text-slate-500 bg-white/80 px-1.5 py-0.2 rounded border border-slate-200">
                    Data Analytics: <strong className="text-slate-700 font-normal">2-Year Baseline Envelopes</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      fetchGroundTruthLBM(`${selectedDate} ${selectedHour}:${selectedMinute}:00`, selectedStrategy);
                    }}
                    className="p-1 hover:bg-sky-100 rounded text-slate-500 hover:text-[#0090d0] transition-colors cursor-pointer"
                    title="Re-evaluate Actionables with current LBM baseline"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionablesCollapsed(!actionablesCollapsed)}
                    className="p-1 hover:bg-sky-100 rounded text-slate-500 hover:text-[#0090d0] transition-colors cursor-pointer"
                    title={actionablesCollapsed ? "Expand Actionables Table" : "Collapse Actionables Table"}
                  >
                    {actionablesCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                </div>
              </div>

              {!actionablesCollapsed && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden animate-fadeIn">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200 text-[8px] uppercase font-normal text-black tracking-wider">
                          <th className="py-2 px-2.5 border-r border-slate-200 w-[20%] font-normal text-black">EFFECT MESSAGE</th>
                          <th className="py-2 px-2.5 border-r border-slate-200 w-[22%] font-normal text-black">CAUSE MESSAGE</th>
                          <th className="py-2 px-1.5 border-r border-slate-200 w-[8%] text-center font-normal text-black">ACTUAL</th>
                          <th className="py-2 px-1.5 border-r border-slate-200 w-[8%] text-center font-normal text-black">BENCHMARK</th>
                          <th className="py-2 px-2.5 border-r border-slate-200 w-[36%] font-normal text-black">SUGGESTION</th>
                          <th className="py-2 px-1.5 border-slate-200 w-[6%] text-center font-normal text-black">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[8.5px]">
                        {isLoadingData ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center bg-slate-50/20">
                              <BoxWavingDots size="w-2 h-2" />
                            </td>
                          </tr>
                        ) : (
                          <>
                            {/* ───────────────────────────────────────────────────────────── */}
                            {/* EFFECT 1: REFORMER METHANE CONVERSION LOW (DYNAMIC CAUSES)    */}
                            {/* ───────────────────────────────────────────────────────────── */}
                            {dynamicActionables.effect1Causes.map((cause, idx) => (
                              <tr key={cause.id} className="hover:bg-slate-50/40 transition-colors">
                                {idx === 0 && (
                                  <td rowSpan={dynamicActionables.effect1Causes.length} className="py-2.5 px-2.5 border-r border-slate-200 align-top bg-slate-50/20 text-black font-normal">
                                    <div className="font-normal text-black text-[9.5px] uppercase tracking-tight">
                                      REFORMER METHANE CONVERSION LOW
                                    </div>
                                    <div className="text-[7.5px] text-black font-normal mt-0.5">
                                      Actual: <span className="font-mono text-black font-normal">{dynamicActionables.convActual}%</span> vs Benchmark: <span className="font-mono text-black font-normal">{dynamicActionables.convBenchmark}%</span>
                                    </div>
                                    <div className="text-[7px] text-black font-normal mt-0.5">
                                      -{dynamicActionables.convDeficitVal}% Conversion Deficit
                                    </div>
                                    <div className="mt-2 text-[7px] px-1.5 py-0.2 rounded border border-slate-300 text-black inline-block font-normal bg-white">
                                      Execution Priority: Step 1 &rarr; {dynamicActionables.effect1Causes.length}
                                    </div>
                                  </td>
                                )}
                                <td className="py-2 px-2.5 border-r border-slate-100 align-top text-black font-normal">
                                  <div className="text-black font-normal uppercase tracking-tight text-[8.5px]">
                                    {cause.name}
                                  </div>
                                </td>
                                <td className="py-2 px-1.5 border-r border-slate-100 text-center font-mono text-black font-normal align-middle">
                                  {cause.actual}
                                </td>
                                <td className="py-2 px-1.5 border-r border-slate-100 text-center font-mono text-black font-normal align-middle">
                                  {cause.optimum}
                                </td>
                                <td className="py-2 px-2.5 border-r border-slate-100 align-middle bg-[#fcfdfe] text-black font-normal">
                                  <span className="text-black font-normal text-[8.5px] leading-relaxed block">
                                    {cause.suggestion}
                                  </span>
                                </td>
                                <td className="py-2 px-1.5 text-center align-middle">
                                  <button
                                    type="button"
                                    onClick={() => handleExecuteAction(cause.actionKey, cause.recId, "smr")}
                                    className={`px-1.5 py-0.5 rounded text-[7px] font-normal transition-all flex items-center justify-center gap-0.5 mx-auto cursor-pointer ${
                                      executedActions[cause.actionKey]
                                        ? "bg-slate-100 text-black border border-slate-300"
                                        : "bg-white hover:bg-slate-50 text-black border border-slate-300 shadow-2xs"
                                    }`}
                                    title={cause.name}
                                  >
                                    <span>{executedActions[cause.actionKey] ? "✓ Done" : "⚡ ⇄"}</span>
                                  </button>
                                </td>
                              </tr>
                            ))}

                            {/* ───────────────────────────────────────────────────────────── */}
                            {/* EFFECT 2: E-1201 CONVECTION RECOVERY LOSS (2 DYNAMIC CAUSES)  */}
                            {/* ───────────────────────────────────────────────────────────── */}
                            {/* Cause 1: Row 1 TMT */}
                            <tr className="hover:bg-slate-50/40 transition-colors">
                              <td rowSpan={2} className="py-2.5 px-2.5 border-r border-slate-200 align-top bg-slate-50/20 text-black font-normal">
                                <div className="font-normal text-black text-[9.5px] uppercase tracking-tight">
                                  E-1201 CONVECTION RECOVERY DUTY LOSS
                                </div>
                                <div className="text-[7.5px] text-black font-normal mt-0.5">
                                  Cleanliness: <span className="font-mono text-black font-normal">{dynamicActionables.cleanlinessActual}%</span> vs Benchmark: <span className="font-mono text-black font-normal">95.0%</span>
                                </div>
                                <div className="text-[7px] text-black font-normal mt-0.5">
                                  {dynamicActionables.lostRecoveryDuty} MW Lost Heat Recovery
                                </div>
                                <div className="mt-2 text-[7px] px-1.5 py-0.2 rounded border border-slate-300 text-black inline-block font-normal bg-white">
                                  P2 Fouling &amp; 650°C Limit
                                </div>
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-100 align-top text-black font-normal">
                                <div className="text-black font-normal uppercase tracking-tight text-[8.5px]">
                                  ROW 1 TUBE METAL TEMPERATURE (TMT) FOULING RESISTANCE
                                </div>
                              </td>
                              <td className="py-2 px-1.5 border-r border-slate-100 text-center font-mono text-black font-normal align-middle">
                                {dynamicActionables.tmtActual}
                              </td>
                              <td className="py-2 px-1.5 border-r border-slate-100 text-center font-mono text-black font-normal align-middle">
                                {dynamicActionables.tmtOptimum}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-100 align-middle bg-[#fcfdfe] text-black font-normal">
                                <span className="text-black font-normal text-[8.5px] leading-relaxed block">
                                  {dynamicActionables.tmtSuggestion}
                                </span>
                              </td>
                              <td className="py-2 px-1.5 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleExecuteAction("act_tmt", "rec_conv_clean", "convection")}
                                  className={`px-1.5 py-0.5 rounded text-[7px] font-normal transition-all flex items-center justify-center gap-0.5 mx-auto cursor-pointer ${
                                    executedActions["act_tmt"]
                                      ? "bg-slate-100 text-black border border-slate-300"
                                      : "bg-white hover:bg-slate-50 text-black border border-slate-300 shadow-2xs"
                                  }`}
                                  title="Jump to E-1201 Skin Temp Advisory"
                                >
                                  <span>{executedActions["act_tmt"] ? "✓ Done" : "⚡ ⇄"}</span>
                                </button>
                              </td>
                            </tr>

                            {/* Cause 2: Fouling */}
                            <tr className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2 px-2.5 border-r border-slate-100 align-top text-black font-normal">
                                <div className="text-black font-normal uppercase tracking-tight text-[8.5px]">
                                  CONVECTION BANK P2 FOULING RESISTANCE
                                </div>
                              </td>
                              <td className="py-2 px-1.5 border-r border-slate-100 text-center font-mono text-black font-normal align-middle">
                                {dynamicActionables.foulingActual}
                              </td>
                              <td className="py-2 px-1.5 border-r border-slate-100 text-center font-mono text-black font-normal align-middle">
                                {dynamicActionables.foulingOptimum}
                              </td>
                              <td className="py-2 px-2.5 border-r border-slate-100 align-middle bg-[#fcfdfe] text-black font-normal">
                                <span className="text-black font-normal text-[8.5px] leading-relaxed block">
                                  {dynamicActionables.foulingSuggestion}
                                </span>
                              </td>
                              <td className="py-2 px-1.5 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleExecuteAction("act_soot", "rec_conv_soot", "convection")}
                                  className={`px-1.5 py-0.5 rounded text-[7px] font-normal transition-all flex items-center justify-center gap-0.5 mx-auto cursor-pointer ${
                                    executedActions["act_soot"]
                                      ? "bg-slate-100 text-black border border-slate-300"
                                      : "bg-white hover:bg-slate-50 text-black border border-slate-300 shadow-2xs"
                                  }`}
                                  title="Execute Soot Blowing Advisory"
                                >
                                  <span>{executedActions["act_soot"] ? "✓ Done" : "⚡ ⇄"}</span>
                                </button>
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* SECTION: CONTRIBUTORS (Contributor Tags Diagnostic Analysis) */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div id="contributors-section" className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3 py-1.5 rounded-lg flex items-center justify-between shadow-2xs mt-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                    CONTRIBUTOR TAGS DIAGNOSTIC ANALYSIS
                  </h3>
                  <span className="text-[10px] font-normal text-slate-500 border-l border-sky-300 pl-3">
                    Target KPI: <span className="text-black font-normal">Reformer Methane Conversion</span> (Actual: {dynamicActionables.convActual}% vs Benchmark: {dynamicActionables.convBenchmark}% | Deficit: <span className="text-rose-700 font-semibold">-{dynamicActionables.convDeficitVal}%</span> &bull; Total Opportunity: <strong className="text-[#0090d0]">+{totalOppMtd.toFixed(2)} MT/Day</strong>)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setContributorsCollapsed(!contributorsCollapsed)}
                  className="p-1 hover:bg-sky-100 rounded text-slate-500 hover:text-[#0090d0] transition-colors cursor-pointer"
                  title={contributorsCollapsed ? "Expand Contributors Table" : "Collapse Contributors Table"}
                >
                  {contributorsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>

              {!contributorsCollapsed && (
                <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden animate-fadeIn">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200 text-[9px] uppercase font-semibold text-slate-700 tracking-wider">
                          <th className="py-2.5 px-3 border-r border-slate-200 w-[34%] font-semibold text-slate-700">CONTRIBUTOR TAG (PROCESS ROLE)</th>
                          <th className="py-2.5 px-2 border-r border-slate-200 w-[12%] text-center font-semibold text-slate-700">ACTUAL</th>
                          <th className="py-2.5 px-2 border-r border-slate-200 w-[12%] text-center font-semibold text-[#0090d0]">BENCHMARK</th>
                          <th className="py-2.5 px-2 border-r border-slate-200 w-[12%] text-center font-semibold text-slate-700">IMPACT (%)</th>
                          <th className="py-2.5 px-2 border-r border-slate-200 w-[15%] text-center font-semibold text-slate-700">OPPORTUNITY IMPACT (MT/Day)</th>
                          <th className="py-2.5 px-2 border-slate-200 w-[15%] text-center font-semibold text-slate-700">DIAGNOSTIC STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[9.5px]">
                        {isLoadingData ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center bg-slate-50/20">
                              <BoxWavingDots size="w-2 h-2" />
                            </td>
                          </tr>
                        ) : (
                          <>
                            {dynamicContributors.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                <td className="py-2 px-3 border-r border-slate-100 align-middle text-black font-normal">
                                  <span className="text-black font-medium uppercase tracking-tight text-[9.5px] block">{row.tag}</span>
                                  <span className="text-[8px] text-slate-500 font-normal block">{row.unit} &bull; <span dangerouslySetInnerHTML={{ __html: row.role }} /></span>
                                </td>
                                <td className="py-2 px-2 border-r border-slate-100 text-center font-mono text-black font-normal align-middle">
                                  {row.actual}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-100 text-center font-mono text-[#0090d0] font-semibold align-middle">
                                  {row.benchmark}
                                </td>
                                <td className="py-2 px-2 border-r border-slate-100 text-center font-mono font-bold align-middle">
                                  <span className={row.isPositive ? "text-[#0090d0]" : "text-rose-700"}>
                                    {row.impactPct}
                                  </span>
                                </td>
                                <td className="py-2 px-2 border-r border-slate-100 text-center font-mono font-bold align-middle">
                                  <span className={row.isPositive ? "text-[#0090d0]" : "text-rose-700"}>
                                    {row.impactMtd}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center font-normal align-middle">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-medium ${
                                    row.isPositive 
                                      ? "bg-sky-50 text-[#0090d0] border border-sky-200" 
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                              </tr>
                            ))}

                            {/* Total Reconciled Opportunity Row */}
                            <tr className="bg-sky-50/70 border-t-2 border-sky-300 font-bold text-[10px] text-slate-800">
                              <td className="py-2.5 px-3 border-r border-sky-200">
                                <span className="font-bold text-slate-900 block">TOTAL PRODUCTION OPPORTUNITY ACCOUNTED FOR</span>
                                <span className="text-[8px] text-slate-500 font-normal">Sum of adverse deficit drivers and favorable mitigators</span>
                              </td>
                              <td className="py-2 px-2 border-r border-sky-200 text-center font-mono text-slate-400 font-normal">—</td>
                              <td className="py-2 px-2 border-r border-sky-200 text-center font-mono text-slate-400 font-normal">—</td>
                              <td className="py-2 px-2 border-r border-sky-200 text-center font-mono font-black text-[#0090d0]">
                                100.0%
                              </td>
                              <td className="py-2 px-2 border-r border-sky-200 text-center font-mono font-black text-[#0090d0]">
                                +{totalOppMtd.toFixed(2)} MT/Day
                              </td>
                              <td className="py-2 px-2 text-center text-[#0090d0] font-semibold text-[9px]">
                                Reconciled 100% ✓
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

              {/* Clean Quick Link Card to Dedicated Process Monitoring Screen */}
              <div className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] rounded-lg p-3 flex items-center justify-between shadow-2xs mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-sky-200 flex items-center justify-center text-[#0090d0] shadow-2xs shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-800 uppercase tracking-tight">PROCESS MONITORING &amp; VARIABLE TREND ANALYSIS</div>
                    <div className="text-[9.5px] text-slate-500 font-normal">Real DCS historian trend series across 1D, 1W, 2W, and 1M with multi-axis KPI &amp; PI tag selection.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveScreen("monitoring")}
                  className="px-3 py-1 bg-[#0090d0] hover:bg-[#0080ba] text-white rounded text-[10px] font-medium transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <span>Open Monitoring Screen</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </>
          )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* DEDICATED ASSET LIFE & PROGNOSTIC FORECASTING MODELS SCREEN     */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeScreen === "forecasting" && (
                <div className="space-y-3 animate-fadeIn">
                  {/* SECTION HEADER BANNER */}
                  <div className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3.5 py-2 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-[#0090d0] text-white flex items-center justify-center shadow-xs">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                          ASSET LIFE &amp; PROGNOSTIC FORECASTING DIGITAL TWINS
                          <span className="px-2 py-0.2 rounded-full text-[8.5px] font-medium bg-sky-100 text-[#0090d0] border border-sky-200 uppercase">
                            Degradation Trajectories &bull; Remaining Useful Life (RUL)
                          </span>
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          First-principles predictive models forecasting catalyst replacement, guard bed breakthrough, and tube wall fouling insulation
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveScreen("overview")}
                        className="px-2.5 py-1 text-[10px] font-medium text-slate-700 bg-white hover:bg-slate-50 rounded border border-slate-200 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3 text-slate-500" />
                        <span>Back to Unit Overview</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 TOP HIGH-LEVEL PROGNOSTIC SUMMARY CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {/* Card 1: Reformer Catalyst Activity (Shifted to Card 1) */}
                    {(() => {
                      const eor = getEorCatalystMetrics(selectedDate, optPlannedShutdown);
                      return (
                        <div className="p-3 rounded-lg border border-sky-200 bg-white shadow-2xs flex flex-col justify-between">
                          <div className="flex items-start justify-between border-b border-slate-100 pb-1.5 mb-2">
                            <div>
                              <span className="text-[8px] uppercase tracking-wider text-[#0090d0] font-semibold block">REFORMER CATALYST PROGNOSTICS</span>
                              <span className="text-[11px] font-bold text-slate-800 block">SMR Catalyst Activity</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${eor.rulDays > 90 ? 'bg-emerald-100 text-emerald-800' : eor.rulDays > 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                              {eor.rulDays > 90 ? 'Healthy Campaign' : 'Turnaround Imminent'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/70 rounded border border-slate-100 py-1.5 px-1 my-1">
                            <div className="px-1.5 text-left">
                              <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Current Activity</span>
                              <span className="text-base font-bold text-[#0090d0] block mt-0.5">{eor.activity.toFixed(1)}%</span>
                            </div>
                            <div className="px-1.5 text-left pl-2">
                              <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Threshold Limit</span>
                              <span className="text-base font-bold text-red-600 block mt-0.5">50.0%</span>
                            </div>
                            <div className="px-1.5 text-left pl-2">
                              <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Days Remaining</span>
                              <span className="text-base font-bold text-amber-700 block mt-0.5">{eor.rulDays} Days</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[9px] mt-1.5 pt-1.5 border-t border-slate-100">
                            <span className="text-slate-500">Planned Turnaround Target:</span>
                            <strong className="text-slate-800 font-mono">{formatIngeneroDate(optPlannedShutdown)}</strong>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Card 2: H2S Adsorber Bed */}
                    <div className="p-3 rounded-lg border border-emerald-200 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-1.5 mb-2">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-emerald-700 font-semibold block">DESULFURIZATION PROGNOSTICS</span>
                          <span className="text-[11px] font-bold text-slate-800 block">H2S Adsorber Bed</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          Healthy (56% Margin)
                        </span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/70 rounded border border-slate-100 py-1.5 px-1 my-1">
                        <div className="px-1.5 text-left">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Current Bed Sat</span>
                          <span className="text-base font-bold text-emerald-700 block mt-0.5">35.2%</span>
                        </div>
                        <div className="px-1.5 text-left pl-2">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Threshold Limit</span>
                          <span className="text-base font-bold text-slate-700 block mt-0.5">80.0%</span>
                        </div>
                        <div className="px-1.5 text-left pl-2">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Remaining RUL</span>
                          <span className="text-base font-bold text-[#0090d0] block mt-0.5">213 Days</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1.5 pt-1.5 border-t border-slate-100">
                        <span className="text-slate-500">Projected Changeout:</span>
                        <strong className="text-slate-800 font-mono">25-APR-2027</strong>
                      </div>
                    </div>

                    {/* Card 3: Convection TMT Fouling */}
                    <div className="p-3 rounded-lg border border-amber-200 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-start justify-between border-b border-slate-100 pb-1.5 mb-2">
                        <div>
                          <span className="text-[8px] uppercase tracking-wider text-amber-700 font-semibold block">TUBE FOULING PROGNOSTICS</span>
                          <span className="text-[11px] font-bold text-slate-800 block">Convection section 1st Exchanger TMT Insulation</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800 uppercase">
                          Cleaning Needed
                        </span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/70 rounded border border-slate-100 py-1.5 px-1 my-1">
                        <div className="px-1.5 text-left">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Actual TMT</span>
                          <span className="text-base font-bold text-amber-700 block mt-0.5">582.0 °C</span>
                        </div>
                        <div className="px-1.5 text-left pl-2">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Datasheet Limit</span>
                          <span className="text-base font-bold text-red-600 block mt-0.5">650.0 °C</span>
                        </div>
                        <div className="px-1.5 text-left pl-2">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-normal">Days to Cleaning</span>
                          <span className="text-base font-bold text-[#0090d0] block mt-0.5">133 Days</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] mt-1.5 pt-1.5 border-t border-slate-100">
                        <span className="text-slate-500">Target Cleaning Action:</span>
                        <strong className="text-slate-800 font-mono">04-FEB-2027</strong>
                      </div>
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* DEEP DIVE MODEL 1: PRIMARY REFORMER CATALYST ACTIVITY (EOR)   */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  {(() => {
                    const eor = getEorCatalystMetrics(selectedDate, optPlannedShutdown);
                    const isJune = selectedDate.includes("-06-");
                    const isJuly = selectedDate.includes("-07-");
                    const isAug = selectedDate.includes("-08-");
                    const isSep = selectedDate.includes("-09-");
                    const isNov = selectedDate.includes("-11-");
                    const isOct = selectedDate.includes("-10-");

                    let markerX = 510;
                    let markerY = 84;
                    let markerLabel = `${formatIngeneroDate(selectedDate).split(' ')[0]}: ${eor.activity.toFixed(1)}% Act`;
                    if (isJune) {
                      markerX = 510;
                      markerY = 84;
                      markerLabel = `18-JUN-2026: ${eor.activity.toFixed(1)}% Act`;
                    } else if (isJuly) {
                      markerX = 540;
                      markerY = 89;
                      markerLabel = `Selected: ${eor.activity.toFixed(1)}% Act (Jul)`;
                    } else if (isAug) {
                      markerX = 570;
                      markerY = 94;
                      markerLabel = `Selected: ${eor.activity.toFixed(1)}% Act (Aug)`;
                    } else if (isSep) {
                      markerX = 605;
                      markerY = 100;
                      markerLabel = `24-SEP-2026: ${eor.activity.toFixed(1)}% Act`;
                    } else if (isOct) {
                      markerX = 625;
                      markerY = 110;
                      markerLabel = `Selected: ${eor.activity.toFixed(1)}% Act (Oct)`;
                    } else if (isNov) {
                      markerX = 645;
                      markerY = 120;
                      markerLabel = `Turnaround: 50.0% Act (Nov)`;
                    } else {
                      markerX = 480;
                      markerY = 78;
                      markerLabel = `Selected: ${eor.activity.toFixed(1)}% Act`;
                    }

                    return (
                      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0090d0] font-bold text-xs">
                              1
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                                MODEL 1: PRIMARY REFORMER CATALYST ACTIVITY DEGRADATION &amp; EOR REPLACEMENT FORECAST
                              </h4>
                              <span className="text-[9px] text-slate-500">
                                Degradation Rate: <strong className="text-slate-700">-0.23% / day (-6.9% / month EOR)</strong> &bull; Replacement Threshold: <strong className="text-red-700">50.0% Activity</strong>
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[9px]">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                              Age: Day {eor.ageDays}&nbsp;Online (~54.0 Mo &bull; EOR Campaign)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-sky-50 text-[#0090d0] border border-sky-200 font-bold">
                              RUL: ~{eor.rulDays} Days (to {eor.turnaroundDateStr} Shutdown)
                            </span>
                          </div>
                        </div>

                        {/* Chart + Equation Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          {/* Left 2 Cols: Realistic Catalyst Degradation SVG */}
                          <div className="lg:col-span-2 bg-slate-50/60 rounded-lg border border-slate-200 p-2.5 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-[9px] mb-1">
                              <span className="font-semibold text-slate-700">Primary Reformer Catalyst Activity Decay Trajectory (5-Year EOR Campaign: 2022–2026)</span>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-[8px] text-[#0090d0]">
                                  <span className="w-2.5 h-0.5 bg-[#0090d0] inline-block rounded" /> Activity History
                                </span>
                                <span className="flex items-center gap-1 text-[8px] text-sky-600">
                                  <span className="w-2.5 h-0.5 bg-sky-500 border-t border-dashed border-sky-500 inline-block" /> Projected EOR Decay
                                </span>
                                <span className="flex items-center gap-1 text-[8px] text-red-600 font-bold">
                                  <span className="w-2.5 h-0.5 bg-red-500 inline-block" /> 50% Changeout Limit
                                </span>
                              </div>
                            </div>

                            {/* SVG Chart with Realistic Operating Data Scatter */}
                            <div className="w-full h-44 relative">
                              <svg className="w-full h-full" viewBox="0 0 700 170" preserveAspectRatio="none">
                                {/* Grid lines */}
                                <line x1="50" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                                <line x1="50" y1="55" x2="680" y2="55" stroke="#f1f5f9" strokeWidth="1" />
                                <line x1="50" y1="85" x2="680" y2="85" stroke="#f1f5f9" strokeWidth="1" />
                                <line x1="50" y1="120" x2="680" y2="120" stroke="#f1f5f9" strokeWidth="1" />

                                {/* 50% Threshold Line */}
                                <line x1="50" y1="120" x2="680" y2="120" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,4" />
                                <text x="682" y="123" fill="#ef4444" fontSize="8" fontWeight="bold">50% Threshold</text>

                                {/* Shaded Red Warning Zone Below 50% */}
                                <rect x="50" y="120" width="630" height="30" fill="#fee2e2" opacity="0.3" />

                                {/* Realistic Confidence / Uncertainty Band Shading */}
                                <path
                                  d="M 50 22 Q 85 30, 120 35 T 180 41 Q 225 45, 255 48 T 315 54 Q 360 60, 390 64 T 435 70 Q 480 76, 510 81 T 545 86 Q 570 90, 585 93 T 605 97 L 645 117 L 645 123 L 605 103 T 585 99 Q 570 96, 545 92 T 510 87 Q 480 82, 435 76 T 390 70 Q 360 66, 315 60 T 255 54 Q 225 51, 180 47 T 120 41 Q 85 36, 50 28 Z"
                                  fill="#e0f2fe"
                                  opacity="0.3"
                                />

                                {/* Realistic Plant Operating Data Scatter (Periodic GC/Mass Balance Sampling up to selected operating date) */}
                                <g fill="#0284c7" opacity="0.45">
                                  {[
                                    { cx: 70, cy: 27, r: 1.8 },
                                    { cx: 95, cy: 34, r: 2.0 },
                                    { cx: 120, cy: 38, r: 1.8 },
                                    { cx: 145, cy: 40, r: 2.2 },
                                    { cx: 175, cy: 45, r: 1.8 },
                                    { cx: 205, cy: 47, r: 2.0 },
                                    { cx: 230, cy: 50, r: 1.8 },
                                    { cx: 260, cy: 53, r: 2.2 },
                                    { cx: 290, cy: 55, r: 1.8 },
                                    { cx: 315, cy: 58, r: 2.0 },
                                    { cx: 345, cy: 62, r: 1.8 },
                                    { cx: 375, cy: 66, r: 2.2 },
                                    { cx: 410, cy: 71, r: 1.8 },
                                    { cx: 435, cy: 74, r: 2.0 },
                                    { cx: 465, cy: 77, r: 1.8 },
                                    { cx: 495, cy: 82, r: 2.2 },
                                    { cx: 510, cy: 84, r: 2.0 },
                                    { cx: 525, cy: 87, r: 1.8 },
                                    { cx: 545, cy: 90, r: 2.0 },
                                    { cx: 565, cy: 93, r: 2.0 },
                                    { cx: 575, cy: 95, r: 1.8 },
                                    { cx: 590, cy: 98, r: 2.0 },
                                    { cx: 602, cy: 100, r: 2.2 },
                                  ].filter(p => p.cx <= markerX).map((p, idx) => (
                                    <circle key={idx} cx={p.cx} cy={p.cy} r={p.r} />
                                  ))}
                                </g>

                                {/* Realistic Multi-Year Deactivation Trajectory with Operational Curvature (Solid up to current point) */}
                                <path
                                  d={markerX <= 540 
                                    ? "M 50 25 Q 85 33, 120 38 T 180 44 Q 225 48, 255 51 T 315 57 Q 360 63, 390 67 T 435 73 Q 480 79, 510 84"
                                    : "M 50 25 Q 85 33, 120 38 T 180 44 Q 225 48, 255 51 T 315 57 Q 360 63, 390 67 T 435 73 Q 480 79, 510 84 T 545 89 Q 570 93, 585 96 T 605 100"
                                  }
                                  fill="none"
                                  stroke="#0090d0"
                                  strokeWidth="2.5"
                                />

                                {/* Future Activity Decay to 50.0% Threshold at Planned Turnaround (Dashed starting from current point) */}
                                <path
                                  d={markerX <= 540 
                                    ? "M 510 84 T 545 89 Q 570 93, 585 96 T 605 100 L 645 120"
                                    : "M 605 100 L 645 120"
                                  }
                                  fill="none"
                                  stroke="#0284c7"
                                  strokeWidth="2.2"
                                  strokeDasharray="4,4"
                                />

                                {/* Current Selected Date Marker */}
                                <circle cx={markerX} cy={markerY} r="4.5" fill="#0090d0" stroke="#ffffff" strokeWidth="2" />
                                <rect x={markerX - 60} y={markerY - 22} width="120" height="16" rx="3" fill="#ffffff" stroke="#0090d0" strokeWidth="1" />
                                <text x={markerX} y={markerY - 11} fill="#0369a1" fontSize="8" fontWeight="bold" textAnchor="middle">{markerLabel}</text>

                                {/* 50% Turnaround Intersection Marker */}
                                <circle cx="645" cy="120" r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                                <rect x="560" y="132" width="135" height="18" rx="3" fill="#ffffff" stroke="#ef4444" strokeWidth="1" />
                                <text x="627" y="144" fill="#b91c1c" fontSize="8" fontWeight="bold" textAnchor="middle">Turnaround: {eor.turnaroundDateStr}</text>

                                {/* X-Axis labels */}
                                <text x="50" y="160" fill="#64748b" fontSize="8">Fresh Catalyst (Jan 2022)</text>
                                <text x="180" y="160" fill="#64748b" fontSize="8" textAnchor="middle">2023</text>
                                <text x="315" y="160" fill="#64748b" fontSize="8" textAnchor="middle">2024 (~83%)</text>
                                <text x="435" y="160" fill="#64748b" fontSize="8" textAnchor="middle">2025 (~75%)</text>
                                <text x="510" y="160" fill="#0090d0" fontSize="7.5" fontWeight="bold" textAnchor="middle">Jun 2026 (~68%)</text>
                                <text x="565" y="160" fill="#64748b" fontSize="7.5" textAnchor="middle">Aug 2026 (~63%)</text>
                                <text x="610" y="160" fill="#64748b" fontSize="7.5" textAnchor="middle">Sep 2026 (60%)</text>
                                <text x="660" y="160" fill="#b91c1c" fontSize="7.5" fontWeight="bold" textAnchor="middle">{eor.turnaroundDateStr.split('-')[1]} (50%)</text>

                                {/* Y-Axis labels */}
                                <text x="45" y="29" fill="#64748b" fontSize="8" textAnchor="end">100%</text>
                                <text x="45" y="58" fill="#64748b" fontSize="8" textAnchor="end">80%</text>
                                <text x="45" y="77" fill="#64748b" fontSize="8" textAnchor="end">70%</text>
                                <text x="45" y="103" fill="#0090d0" fontSize="8" fontWeight="bold" textAnchor="end">60%</text>
                                <text x="45" y="123" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="end">50%</text>
                              </svg>
                            </div>
                          </div>

                          {/* Right Col: Deactivation Kinetics & Turnaround Directive */}
                          <div className="space-y-2 flex flex-col justify-between">
                            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                              <span className="text-[8.5px] uppercase font-bold text-slate-700 block mb-1">
                                Catalyst Deactivation Governing Model (EOR)
                              </span>
                              <div className="font-mono text-[9px] text-slate-800 bg-white p-2 rounded border border-slate-200 space-y-1">
                                <div>Activity(t) = Act_initial - k_deg &times; t</div>
                                <div className="text-[#0090d0] font-bold">&rArr; k_deg = -0.227% / day</div>
                                <div className="text-slate-600">Monthly EOR rate: -6.90% / month</div>
                                <div className="pt-1 border-t border-slate-100 text-amber-700 font-bold">
                                  RUL to 50%: {eor.rulDays} Days ({eor.turnaroundDateStr})
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-md bg-sky-50/60 border border-sky-200 text-[9px] text-slate-700">
                              <span className="font-bold text-[#0090d0] uppercase block mb-0.5">Turnaround Replacement Directive (EOR Campaign):</span>
                              Primary reformer catalyst is in its terminal End-of-Run (EOR) regime on a 5-year campaign started early 2022. Activity reaches the 50.0% replacement threshold at turnaround. Changeout is locked into the planned plant turnaround commencing {eor.turnaroundDateStr}.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* DEEP DIVE MODEL 2: ZnO H2S GUARD BED SATURATION DIGITAL TWIN  */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5.5 h-5.5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-xs">
                          2
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                            MODEL 2: ZnO SULFUR GUARD BED (V-101A/B) SATURATION &amp; BREAKTHROUGH PROGNOSTICS
                          </h4>
                          <span className="text-[9px] text-slate-500">
                            Cumulative sulfur mass balance &bull; Saturation rate: <strong className="text-emerald-700">+0.21% / day</strong> &bull; Design Limit: <strong className="text-red-700">80.0% Breakthrough Threshold</strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[9px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                          Capacity Denominator: 12,636,000
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          RUL: 213 Days
                        </span>
                      </div>
                    </div>

                    {/* Chart + Equation Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {/* Left 2 Cols: Interactive Trajectory SVG */}
                      <div className="lg:col-span-2 bg-slate-50/60 rounded-lg border border-slate-200 p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[9px] mb-1">
                          <span className="font-semibold text-slate-700">Bed Saturation Trajectory &amp; Breakthrough Forecast (Days Online)</span>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-[8px] text-slate-600">
                              <span className="w-2.5 h-0.5 bg-emerald-600 inline-block rounded" /> Demonstrated History
                            </span>
                            <span className="flex items-center gap-1 text-[8px] text-[#0090d0]">
                              <span className="w-2.5 h-0.5 bg-[#0090d0] border-t border-dashed border-[#0090d0] inline-block" /> Predictive RUL
                            </span>
                            <span className="flex items-center gap-1 text-[8px] text-red-600 font-bold">
                              <span className="w-2.5 h-0.5 bg-red-500 inline-block" /> 80% Replacement Limit
                            </span>
                          </div>
                        </div>

                        {/* SVG Chart */}
                        <div className="w-full h-44 relative">
                          <svg className="w-full h-full" viewBox="0 0 700 170" preserveAspectRatio="none">
                            {/* Grid lines */}
                            <line x1="50" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="50" y1="55" x2="680" y2="55" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="50" y1="90" x2="680" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="50" y1="125" x2="680" y2="125" stroke="#f1f5f9" strokeWidth="1" />

                            {/* 80% Threshold Line */}
                            <line x1="50" y1="36" x2="680" y2="36" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,4" />
                            <text x="682" y="39" fill="#ef4444" fontSize="8" fontWeight="bold">80% Limit</text>

                            {/* Warning Zone shading (>70% to 80%) */}
                            <rect x="50" y="36" width="630" height="20" fill="#fee2e2" opacity="0.4" />

                            {/* Past Historical Curve (0% at x=50, y=145 to 35.2% at x=280, y=98) */}
                            <path
                              d="M 50 145 C 120 135, 200 115, 280 98"
                              fill="none"
                              stroke="#059669"
                              strokeWidth="2.5"
                            />

                            {/* Future Trajectory (35.2% at x=280, y=98 to 80% at x=580, y=36) */}
                            <path
                              d="M 280 98 L 580 36"
                              fill="none"
                              stroke="#0090d0"
                              strokeWidth="2.2"
                              strokeDasharray="4,4"
                            />

                            {/* Current Point Marker */}
                            <circle cx="280" cy="98" r="4.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                            <rect x="230" y="78" width="100" height="16" rx="3" fill="#ffffff" stroke="#059669" strokeWidth="1" />
                            <text x="280" y="90" fill="#065f46" fontSize="8" fontWeight="bold" textAnchor="middle">Today: 35.2% Sat</text>

                            {/* 80% Intersection Marker */}
                            <circle cx="580" cy="36" r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                            <rect x="515" y="14" width="130" height="18" rx="3" fill="#ffffff" stroke="#ef4444" strokeWidth="1" />
                            <text x="580" y="26" fill="#b91c1c" fontSize="8" fontWeight="bold" textAnchor="middle">Projected: 25-APR-2027 (213d)</text>

                            {/* X-Axis labels */}
                            <text x="50" y="160" fill="#64748b" fontSize="8">Fresh Charge (0d)</text>
                            <text x="280" y="160" fill="#059669" fontSize="8" fontWeight="bold" textAnchor="middle">{formatIngeneroDate(selectedDate).split(' ')[0]} (Today)</text>
                            <text x="430" y="160" fill="#64748b" fontSize="8" textAnchor="middle">Jan 2027</text>
                            <text x="580" y="160" fill="#b91c1c" fontSize="8" fontWeight="bold" textAnchor="middle">25-APR-2027 (80%)</text>

                            {/* Y-Axis labels */}
                            <text x="45" y="148" fill="#64748b" fontSize="8" textAnchor="end">0%</text>
                            <text x="45" y="98" fill="#059669" fontSize="8" textAnchor="end">35.2%</text>
                            <text x="45" y="58" fill="#64748b" fontSize="8" textAnchor="end">60%</text>
                            <text x="45" y="39" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="end">80%</text>
                          </svg>
                        </div>
                      </div>

                      {/* Right Col: Mathematical Foundation & Actionable Directive */}
                      <div className="space-y-2 flex flex-col justify-between">
                        <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                          <span className="text-[8.5px] uppercase font-bold text-slate-700 block mb-1">
                            Governing Rate &amp; RUL Equation
                          </span>
                          <div className="font-mono text-[9px] text-slate-800 bg-white p-2 rounded border border-slate-200 space-y-1">
                            <div>m = (24 &times; H₂S &times; Flow) / 12,636,000</div>
                            <div className="text-emerald-700 font-bold">&rArr; m = +0.210% / day</div>
                            <div className="pt-1 border-t border-slate-100 text-[#0090d0]">
                              RUL = (80.0% - 35.2%) / 0.21%
                            </div>
                            <div className="text-slate-900 font-bold">&rArr; Remaining: 213.3 Days</div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-md bg-emerald-50/60 border border-emerald-200 text-[9px] text-slate-700">
                          <span className="font-bold text-emerald-800 uppercase block mb-0.5">Operational Directive:</span>
                          Operating at nominal 0.21%/day saturation with 0.030 ppm inlet sulfur. Bed A will protect SMR catalyst for another 213 operating days. Initiate catalyst purchase requisition in Q1 2027 to ensure fresh H2S adsorber charge is on-site ahead of the 25-Apr-2027 replacement window.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* DEEP DIVE MODEL 3: CONVECTION TMT FOULING PREDICTION (Tw EQ)  */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5.5 h-5.5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs">
                          3
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                            MODEL 3: CONVECTION BANK E-1201 ROW 1 TUBE METAL TEMPERATURE (TMT) FOULING &amp; 650°C FORECAST
                          </h4>
                          <span className="text-[9px] text-slate-500">
                            Fouling resistance layer acts as insulator &bull; Datasheet Limit: <strong className="text-red-700">650.0°C Max</strong> &bull; Recommended Cleaning Trigger: <strong className="text-amber-700">610.0°C</strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[9px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                          R_fi: 0.0038 hr&middot;ft&sup2;&middot;&deg;F/Btu
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                          Cleaning in: 133 Days
                        </span>
                      </div>
                    </div>

                    {/* Chart + Equation Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      {/* Left 2 Cols: TMT Trajectory SVG */}
                      <div className="lg:col-span-2 bg-slate-50/60 rounded-lg border border-slate-200 p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[9px] mb-1">
                          <span className="font-semibold text-slate-700">E-1201 Row 1 Tube Wall Temperature ($T_w$) Fouling Trend</span>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-[8px] text-amber-700">
                              <span className="w-2.5 h-0.5 bg-amber-600 inline-block rounded" /> Actual TMT (582°C)
                            </span>
                            <span className="flex items-center gap-1 text-[8px] text-amber-600 font-bold">
                              <span className="w-2.5 h-0.5 bg-amber-500 border-t border-dashed border-amber-500 inline-block" /> 610°C Cleaning Trigger
                            </span>
                            <span className="flex items-center gap-1 text-[8px] text-red-600 font-bold">
                              <span className="w-2.5 h-0.5 bg-red-600 inline-block" /> 650°C Datasheet Limit
                            </span>
                          </div>
                        </div>

                        {/* SVG Chart */}
                        <div className="w-full h-44 relative">
                          <svg className="w-full h-full" viewBox="0 0 700 170" preserveAspectRatio="none">
                            {/* Grid lines */}
                            <line x1="50" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="50" y1="55" x2="680" y2="55" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="50" y1="90" x2="680" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="50" y1="125" x2="680" y2="125" stroke="#f1f5f9" strokeWidth="1" />

                            {/* 650°C Max Limit Line */}
                            <line x1="50" y1="22" x2="680" y2="22" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,3" />
                            <text x="682" y="25" fill="#dc2626" fontSize="8" fontWeight="bold">650°C Max Limit</text>

                            {/* 610°C Cleaning Trigger Line */}
                            <line x1="50" y1="62" x2="680" y2="62" stroke="#d97706" strokeWidth="1.2" strokeDasharray="4,4" />
                            <text x="682" y="65" fill="#d97706" fontSize="8" fontWeight="bold">610°C Clean Trigger</text>

                            {/* Shaded Zone Above 610°C */}
                            <rect x="50" y="22" width="630" height="40" fill="#fef3c7" opacity="0.3" />

                            {/* Past TMT Curve (543.5°C clean at x=50, y=135 to 582°C at x=280, y=90) */}
                            <path
                              d="M 50 135 C 130 128, 200 110, 280 90"
                              fill="none"
                              stroke="#d97706"
                              strokeWidth="2.5"
                            />

                            {/* Future TMT Trend (582°C at x=280, y=90 to 610°C at x=440, y=62, to 650°C at x=620, y=22) */}
                            <path
                              d="M 280 90 L 440 62 L 620 22"
                              fill="none"
                              stroke="#b45309"
                              strokeWidth="2.2"
                              strokeDasharray="4,4"
                            />

                            {/* Current Point Marker */}
                            <circle cx="280" cy="90" r="4.5" fill="#d97706" stroke="#ffffff" strokeWidth="2" />
                            <rect x="230" y="70" width="100" height="16" rx="3" fill="#ffffff" stroke="#d97706" strokeWidth="1" />
                            <text x="280" y="82" fill="#92400e" fontSize="8" fontWeight="bold" textAnchor="middle">Today: 582.0°C</text>

                            {/* 610°C Cleaning Trigger Marker */}
                            <circle cx="440" cy="62" r="4.5" fill="#d97706" stroke="#ffffff" strokeWidth="2" />
                            <rect x="375" y="42" width="130" height="18" rx="3" fill="#ffffff" stroke="#d97706" strokeWidth="1" />
                            <text x="440" y="54" fill="#b45309" fontSize="8" fontWeight="bold" textAnchor="middle">Clean by: 04-FEB-2027 (133d)</text>

                            {/* 650°C Critical Breach Marker */}
                            <circle cx="620" cy="22" r="4" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="620" y="14" fill="#b91c1c" fontSize="7.5" fontWeight="bold" textAnchor="middle">650°C Breach: ~Aug 2027</text>

                            {/* X-Axis labels */}
                            <text x="50" y="160" fill="#64748b" fontSize="8">Clean Benchmark (543.5°C)</text>
                            <text x="280" y="160" fill="#d97706" fontSize="8" fontWeight="bold" textAnchor="middle">{formatIngeneroDate(selectedDate).split(' ')[0]} (Today)</text>
                            <text x="440" y="160" fill="#b45309" fontSize="8" fontWeight="bold" textAnchor="middle">04-FEB-2027 (Clean)</text>
                            <text x="620" y="160" fill="#b91c1c" fontSize="8" textAnchor="middle">Aug 2027 (Limit)</text>

                            {/* Y-Axis labels */}
                            <text x="45" y="138" fill="#64748b" fontSize="8" textAnchor="end">540°C</text>
                            <text x="45" y="93" fill="#d97706" fontSize="8" textAnchor="end">582°C</text>
                            <text x="45" y="65" fill="#d97706" fontSize="8" fontWeight="bold" textAnchor="end">610°C</text>
                            <text x="45" y="25" fill="#dc2626" fontSize="8" fontWeight="bold" textAnchor="end">650°C</text>
                          </svg>
                        </div>
                      </div>

                      {/* Right Col: PDF Governing Formula & Cleaning Directive */}
                      <div className="space-y-2 flex flex-col justify-between">
                        <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                          <span className="text-[8.5px] uppercase font-bold text-slate-700 block mb-1">
                            Datasheet TMT Equation (Ref: TMT Calculation 2)
                          </span>
                          <div className="font-mono text-[8.5px] text-slate-800 bg-white p-2 rounded border border-slate-200 space-y-1">
                            <div className="text-slate-600 font-semibold truncate">
                              T_w = Flux&middot;(d_o/d_i)&middot;R_fi + Flux&middot;(d_o/d_i)/h_i + ... + T_f
                            </div>
                            <div className="text-amber-700 font-bold">
                              R_fi = 0.0038 hr&middot;ft&sup2;&middot;&deg;F/Btu (Clean: 0.0010)
                            </div>
                            <div className="text-slate-500">
                              Insulating thermal resistance &Delta;T = +38.5&deg;C
                            </div>
                            <div className="pt-1 border-t border-slate-100 text-red-700 font-bold">
                              Max Limit: 650.0&deg;C (Datasheet)
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-md bg-amber-50/60 border border-amber-200 text-[9px] text-slate-700">
                          <span className="font-bold text-amber-800 uppercase block mb-0.5">Soot-Blowing &amp; Cleaning Action:</span>
                          The internal fouling layer acts as a heat insulator, driving tube wall temperature up by +1.45°C/week. Lowering bridgewall firing is only a temporary mitigation. Full recovery requires soot-blowing / chemical wash before TMT reaches 610.0°C (133 days remaining).
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* DEDICATED THE OPTIMIZATION MODEL SCREEN                       */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeScreen === "optimization" && (() => {
                // Pre-compute Scenarios A, B, and C using the EXACT SAME model for 100% mathematical consistency
                const isJune = selectedDate.includes("-06-") || selectedDate.includes("-05-") || selectedDate.includes("-07-");
                const baseTempForDate = isJune ? 850.0 : 852.0;
                const baseScForDate = isJune ? 2.78 : 2.79;
                const scenCTemp = baseTempForDate + 7.5; // +7.5°C over base (857.5°C in June)
                const scenCSc = +(baseScForDate + 0.08).toFixed(2); // +0.08 S/C over base (2.86 in June)
                const scenBTemp = baseTempForDate + 15.0; // +15.0°C over base (865.0°C in June)
                const scenBSc = +(baseScForDate + 0.17).toFixed(2); // +0.17 S/C over base (2.95 in June)

                const optResult = calculateOptimizationModel(
                  optTemperature, 
                  optSteamCarbon, 
                  optLoad, 
                  optCatalystThreshold, 
                  optPlannedShutdown,
                  selectedDate
                );
                const scenAResult = calculateOptimizationModel(baseTempForDate, baseScForDate, 100.0, optCatalystThreshold, optPlannedShutdown, selectedDate);
                const scenBResult = calculateOptimizationModel(scenBTemp, scenBSc, 100.0, optCatalystThreshold, optPlannedShutdown, selectedDate);
                const scenCResult = calculateOptimizationModel(scenCTemp, scenCSc, 100.0, optCatalystThreshold, optPlannedShutdown, selectedDate);

                return (
                  <div className="space-y-3 animate-fadeIn">
                    {/* SECTION HEADER BANNER */}
                    <div className="bg-gradient-to-r from-[#e1f3fc] via-[#edf7fd] to-[#f4faff] border border-[#cbe8f8] px-3.5 py-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-[#0090d0] text-white flex items-center justify-center shadow-xs">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                              THE OPTIMIZATION MODEL
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Catalyst-Aware &bull; Energy-Aware (SEC) &bull; Shutdown-Aware
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 mt-0.5">
                            Multi-objective Pareto optimization balancing <strong>Performance (Conversion &amp; ATE)</strong>, <strong>Energy (SEC)</strong>, <strong>Catalyst Life Degradation</strong>, and <strong>Planned Shutdown Timing</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExportOptimizationReport(optResult, scenAResult, scenBResult, scenCResult)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9.5px] font-medium transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Export Complete Optimization Dossier Report (Printable &amp; PDF)"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Export Report</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveScreen("forecasting")}
                          className="px-2.5 py-1 bg-white hover:bg-sky-50 text-[#0090d0] border border-sky-300 rounded text-[9.5px] font-medium transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <TrendingUp className="w-3 h-3" />
                          <span>Forecasting Models</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveScreen("overview")}
                          className="px-2.5 py-1 bg-[#0090d0] hover:bg-[#0080ba] text-white rounded text-[9.5px] font-medium transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>&larr; Back to Overview</span>
                        </button>
                      </div>
                    </div>

                    {/* 1. SCENARIO COMPARISON MATRIX (4 PRESET SCENARIOS - NOW AT TOP) */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100">
                        <div>
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <span>Optimization Scenarios Matrix</span>
                            <span className="px-2 py-0.2 rounded-full text-[8.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Side-by-Side Trade-Off Analysis
                            </span>
                          </h4>
                          <p className="text-[9.5px] text-slate-500">
                            Select a scenario to inspect or load its operational handles into the live simulator
                          </p>
                        </div>
                        <span className="text-[9px] text-slate-400 italic">
                          Click any card to apply preset handles &bull; Conversion performance tag on right side
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {/* Scenario A: Current Operation */}
                        <div 
                          id="scenario-card-a"
                          onClick={() => handleApplyScenario("A")}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer text-[9.5px] flex flex-col justify-between ${optActiveScenario === "A" ? 'bg-sky-50/80 border-[#0090d0] shadow-xs ring-2 ring-sky-200' : 'bg-slate-50/60 border-slate-200 hover:border-sky-300'}`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800 uppercase">Scenario A</span>
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-semibold bg-slate-200 text-slate-700">Base Case</span>
                            </div>
                            <span className="text-slate-500 text-[9px] block mb-2 font-medium">Current Operation (Base Setpoint)</span>

                            {/* Card Body: Left Column (Constraints on top, Handles below), Right Column (Performance Tag) */}
                            <div className="flex items-stretch justify-between gap-2">
                              {/* Left Section */}
                              <div className="flex-1 space-y-1.5">
                                {/* CONSTRAINTS AT TOP */}
                                <div className="bg-white/80 p-1.5 rounded border border-slate-200/80 space-y-0.5">
                                  <div className="text-[7.5px] font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                                    <span>CONSTRAINTS</span>
                                    <span>LIMITS</span>
                                  </div>
                                  <div className="font-mono text-[8.5px] space-y-0.5 text-slate-700">
                                    <div className="flex justify-between"><span>SEC:</span><span className="font-bold">{scenAResult.calculatedSec.toFixed(2)} Gcal/MT</span></div>
                                    <div className="flex justify-between"><span>ATE:</span><span className="text-amber-700 font-bold">{scenAResult.calculatedAte.toFixed(1)} &deg;C</span></div>
                                    <div className="flex justify-between"><span>Degradation:</span><span>{scenAResult.monthlyDegradation.toFixed(2)}%/mo</span></div>
                                    <div className="flex justify-between"><span>Threshold:</span><span className="font-semibold">{scenAResult.thresholdDateStr}</span></div>
                                    <div className="flex justify-between pt-0.5 border-t border-slate-100">
                                      <span>Margin:</span>
                                      <span className="font-bold text-emerald-700">+{scenAResult.lifeMarginDays}d (Safe)</span>
                                    </div>
                                  </div>
                                </div>

                                {/* OPERATING HANDLES BELOW */}
                                <div className="bg-white/60 p-1.5 rounded border border-slate-200/60 space-y-0.5">
                                  <div className="text-[7.5px] font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                                    <span>HANDLES</span>
                                    <span>SETPOINTS</span>
                                  </div>
                                  <div className="font-mono text-[8.5px] space-y-0.5 text-slate-700">
                                    <div className="flex justify-between"><span>T_out:</span><span className="font-bold">{scenAResult.baseTemp.toFixed(1)} &deg;C</span></div>
                                    <div className="flex justify-between"><span>S/C:</span><span className="font-bold">{scenAResult.baseSc.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Bridgewall:</span><span className="font-bold text-slate-800">{scenAResult.calculatedBwt.toFixed(1)} &deg;C</span></div>
                                    <div className="flex justify-between"><span>Stack:</span><span>{scenAResult.calculatedStack.toFixed(1)} &deg;C</span></div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Performance Tag (Conversion %) */}
                              <div className="w-24 shrink-0 bg-sky-100/70 border border-sky-300/80 rounded-md p-2 flex flex-col justify-between text-center">
                                <span className="text-[7.5px] font-bold uppercase tracking-wider text-[#0090d0] block">
                                  PERFORMANCE
                                </span>
                                <div className="my-auto">
                                  <span className="text-[7.5px] text-slate-500 uppercase font-medium block">Conversion</span>
                                  <span className="text-lg font-black font-mono text-slate-800 block leading-tight">
                                    {scenAResult.calculatedConv.toFixed(2)}%
                                  </span>
                                  <span className="text-[7.5px] font-bold text-slate-500 font-mono">
                                    Baseline
                                  </span>
                                </div>
                                <div className="pt-1 border-t border-sky-200">
                                  <span className="text-[7px] text-slate-500 block uppercase">Add. Prod</span>
                                  <span className="text-[9px] font-bold font-mono text-slate-700 block">0.0 MT/D</span>
                                  <span className="text-[7px] font-mono text-slate-500 block">M: 2.04</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Scenario B: Recover Historical Target */}
                        <div 
                          id="scenario-card-b"
                          onClick={() => handleApplyScenario("B")}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer text-[9.5px] flex flex-col justify-between ${optActiveScenario === "B" ? 'bg-red-50/80 border-red-500 shadow-xs ring-2 ring-red-200' : 'bg-slate-50/60 border-slate-200 hover:border-red-300'}`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-red-800 uppercase">Scenario B</span>
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-semibold bg-red-100 text-red-700">High Firing (+15&deg;C)</span>
                            </div>
                            <span className="text-slate-500 text-[9px] block mb-2 font-medium">Aggressive Target (+15.0&deg;C Firing Increase)</span>

                            {/* Card Body: Left Column (Constraints on top, Handles below), Right Column (Performance Tag) */}
                            <div className="flex items-stretch justify-between gap-2">
                              {/* Left Section */}
                              <div className="flex-1 space-y-1.5">
                                {/* CONSTRAINTS AT TOP */}
                                <div className="bg-white/80 p-1.5 rounded border border-slate-200/80 space-y-0.5">
                                  <div className="text-[7.5px] font-bold uppercase tracking-wider text-red-700 flex justify-between">
                                    <span>CONSTRAINTS</span>
                                    <span>LIMITS</span>
                                  </div>
                                  <div className="font-mono text-[8.5px] space-y-0.5 text-slate-700">
                                    <div className="flex justify-between"><span>SEC:</span><span className="font-bold text-red-700">{scenBResult.calculatedSec.toFixed(2)} Gcal/MT</span></div>
                                    <div className="flex justify-between"><span>ATE:</span><span className="text-sky-700 font-bold">{scenBResult.calculatedAte.toFixed(1)} &deg;C</span></div>
                                    <div className="flex justify-between"><span>Degradation:</span><span className="text-red-700 font-semibold">{scenBResult.monthlyDegradation.toFixed(2)}%/mo</span></div>
                                    <div className="flex justify-between"><span>Threshold:</span><span className="text-red-700 font-semibold">{scenBResult.thresholdDateStr}</span></div>
                                    <div className="flex justify-between pt-0.5 border-t border-slate-100">
                                      <span>Margin:</span>
                                      <span className="font-bold text-red-700">{scenBResult.lifeMarginDays}d (FAIL)</span>
                                    </div>
                                  </div>
                                </div>

                                {/* OPERATING HANDLES BELOW */}
                                <div className="bg-white/60 p-1.5 rounded border border-slate-200/60 space-y-0.5">
                                  <div className="text-[7.5px] font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                                    <span>HANDLES</span>
                                    <span>SETPOINTS</span>
                                  </div>
                                  <div className="font-mono text-[8.5px] space-y-0.5 text-slate-700">
                                    <div className="flex justify-between"><span>T_out:</span><span className="font-bold text-red-700">{scenBTemp.toFixed(1)} &deg;C (+15)</span></div>
                                    <div className="flex justify-between"><span>S/C:</span><span className="font-bold text-red-700">{scenBSc.toFixed(2)} (+0.17)</span></div>
                                    <div className="flex justify-between"><span>Bridgewall:</span><span className="font-bold text-amber-700">{scenBResult.calculatedBwt.toFixed(1)} &deg;C</span></div>
                                    <div className="flex justify-between"><span>Stack:</span><span className="font-semibold text-amber-700">{scenBResult.calculatedStack.toFixed(1)} &deg;C</span></div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Performance Tag (Conversion %) */}
                              <div className="w-24 shrink-0 bg-red-100/70 border border-red-300/80 rounded-md p-2 flex flex-col justify-between text-center">
                                <span className="text-[7.5px] font-bold uppercase tracking-wider text-red-700 block">
                                  PERFORMANCE
                                </span>
                                <div className="my-auto">
                                  <span className="text-[7.5px] text-slate-500 uppercase font-medium block">Conversion</span>
                                  <span className="text-lg font-black font-mono text-red-700 block leading-tight">
                                    {scenBResult.calculatedConv.toFixed(2)}%
                                  </span>
                                  <span className="text-[7.5px] font-bold text-red-700 font-mono">
                                    +{((scenBResult.calculatedConv - scenAResult.calculatedConv)).toFixed(2)}%
                                  </span>
                                </div>
                                <div className="pt-1 border-t border-red-200">
                                  <span className="text-[7px] text-slate-500 block uppercase">Add. Prod</span>
                                  <span className="text-[9px] font-bold font-mono text-red-700 block">+{scenBResult.deltaProd.toFixed(1)} MT/D</span>
                                  <span className="text-[7px] font-mono text-slate-500 block">M: 2.07</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Scenario C: Recommended Operating Point */}
                        <div 
                          id="scenario-card-c"
                          onClick={() => handleApplyScenario("C")}
                          className={`p-2.5 rounded-lg border-2 transition-all cursor-pointer text-[9.5px] flex flex-col justify-between ${optActiveScenario === "C" ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-200' : 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-500'}`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-emerald-800 uppercase">Scenario C</span>
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-600 text-white uppercase tracking-wider">Recommended</span>
                            </div>
                            <span className="text-emerald-900 text-[9px] block mb-2 font-bold">Pareto Optimum (+7.5&deg;C Firing Setpoint)</span>

                            {/* Card Body: Left Column (Constraints on top, Handles below), Right Column (Performance Tag) */}
                            <div className="flex items-stretch justify-between gap-2">
                              {/* Left Section */}
                              <div className="flex-1 space-y-1.5">
                                {/* CONSTRAINTS AT TOP */}
                                <div className="bg-white/90 p-1.5 rounded border border-emerald-200/80 space-y-0.5">
                                  <div className="text-[7.5px] font-bold uppercase tracking-wider text-emerald-800 flex justify-between">
                                    <span>CONSTRAINTS</span>
                                    <span>LIMITS</span>
                                  </div>
                                  <div className="font-mono text-[8.5px] space-y-0.5 text-slate-800">
                                    <div className="flex justify-between"><span>SEC:</span><span className="font-bold text-emerald-800">{scenCResult.calculatedSec.toFixed(2)} Gcal/MT</span></div>
                                    <div className="flex justify-between"><span>ATE:</span><span className="text-emerald-800 font-bold">{scenCResult.calculatedAte.toFixed(1)} &deg;C</span></div>
                                    <div className="flex justify-between"><span>Degradation:</span><span>{scenCResult.monthlyDegradation.toFixed(2)}%/mo</span></div>
                                    <div className="flex justify-between"><span>Threshold:</span><span className="font-semibold text-emerald-800">{scenCResult.thresholdDateStr}</span></div>
                                    <div className="flex justify-between pt-0.5 border-t border-emerald-100">
                                      <span>Margin:</span>
                                      <span className="font-bold text-emerald-800">+{scenCResult.lifeMarginDays}d (Safe)</span>
                                    </div>
                                  </div>
                                </div>

                                {/* OPERATING HANDLES BELOW */}
                                <div className="bg-white/70 p-1.5 rounded border border-emerald-200/60 space-y-0.5">
                                  <div className="text-[7.5px] font-bold uppercase tracking-wider text-emerald-800 flex justify-between">
                                    <span>HANDLES</span>
                                    <span>SETPOINTS</span>
                                  </div>
                                  <div className="font-mono text-[8.5px] space-y-0.5 text-slate-800">
                                    <div className="flex justify-between"><span>T_out:</span><span className="font-bold text-emerald-800">{scenCTemp.toFixed(1)} &deg;C (+7.5)</span></div>
                                    <div className="flex justify-between"><span>S/C:</span><span className="font-bold text-emerald-800">{scenCSc.toFixed(2)} (+0.08)</span></div>
                                    <div className="flex justify-between"><span>Bridgewall:</span><span className="font-bold text-emerald-800">{scenCResult.calculatedBwt.toFixed(1)} &deg;C</span></div>
                                    <div className="flex justify-between"><span>Stack:</span><span>{scenCResult.calculatedStack.toFixed(1)} &deg;C</span></div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Performance Tag (Conversion %) */}
                              <div className="w-24 shrink-0 bg-emerald-100/90 border border-emerald-400 rounded-md p-2 flex flex-col justify-between text-center shadow-xs">
                                <span className="text-[7.5px] font-bold uppercase tracking-wider text-emerald-800 block">
                                  PERFORMANCE
                                </span>
                                <div className="my-auto">
                                  <span className="text-[7.5px] text-emerald-700 uppercase font-bold block">Conversion</span>
                                  <span className="text-lg font-black font-mono text-emerald-800 block leading-tight">
                                    {scenCResult.calculatedConv.toFixed(2)}%
                                  </span>
                                  <span className="text-[7.5px] font-bold text-emerald-700 font-mono">
                                    +{((scenCResult.calculatedConv - scenAResult.calculatedConv)).toFixed(2)}%
                                  </span>
                                </div>
                                <div className="pt-1 border-t border-emerald-200">
                                  <span className="text-[7px] text-emerald-700 block uppercase font-semibold">Add. Prod</span>
                                  <span className="text-[9px] font-black font-mono text-emerald-800 block">+{scenCResult.deltaProd.toFixed(1)} MT/D</span>
                                  <span className="text-[7px] font-mono text-emerald-700 block font-semibold">M: 2.05 (Rec)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* INTERACTIVE "WHAT-IF" SIMULATOR & SENSITIVITY GRAPHS */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                      {/* Left 5 Cols: Manipulated Handles & User Controls */}
                      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0090d0]" />
                            Manipulated Operating Handles
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleApplyScenario("C")}
                            className="text-[9px] text-[#0090d0] hover:underline font-semibold cursor-pointer"
                          >
                            Reset to Recommended
                          </button>
                        </div>

                        {/* Slider 1: Reformer Outlet Temperature */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-semibold text-slate-700">Reformer Outlet Temp (T_out):</span>
                            <span className="font-mono font-bold text-[#0090d0]">{optTemperature.toFixed(1)} &deg;C</span>
                          </div>
                          <input
                            id="slider-opt-temperature"
                            type="range"
                            min="840"
                            max="885"
                            step="0.5"
                            value={optTemperature}
                            onChange={(e) => {
                              setOptTemperature(parseFloat(e.target.value));
                              setOptActiveScenario("custom");
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0090d0]"
                          />
                          <div className="flex justify-between text-[8.5px] text-slate-400 font-mono">
                            <span>840 &deg;C</span>
                            <span className="text-slate-500 font-semibold">Base: {baseTempForDate.toFixed(1)} &bull; Rec: {scenCTemp.toFixed(1)}</span>
                            <span>885 &deg;C</span>
                          </div>
                        </div>

                        {/* Slider 2: Steam-to-Carbon Ratio */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-semibold text-slate-700">Steam-to-Carbon Ratio (S/C):</span>
                            <span className="font-mono font-bold text-sky-600">{optSteamCarbon.toFixed(2)}</span>
                          </div>
                          <input
                            id="slider-opt-steam-carbon"
                            type="range"
                            min="2.50"
                            max="3.30"
                            step="0.01"
                            value={optSteamCarbon}
                            onChange={(e) => {
                              setOptSteamCarbon(parseFloat(e.target.value));
                              setOptActiveScenario("custom");
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                          />
                          <div className="flex justify-between text-[8.5px] text-slate-400 font-mono">
                            <span>2.50</span>
                            <span className="text-slate-500 font-semibold">Base: {baseScForDate.toFixed(2)} &bull; Rec: {scenCSc.toFixed(2)}</span>
                            <span>3.30</span>
                          </div>
                        </div>

                        {/* Slider 3: Reformer Load / Feed Throughput */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-semibold text-slate-700">Reformer Load (% Throughput):</span>
                            <span className="font-mono font-bold text-slate-800">{optLoad.toFixed(1)}%</span>
                          </div>
                          <input
                            id="slider-opt-load"
                            type="range"
                            min="80"
                            max="115"
                            step="0.5"
                            value={optLoad}
                            onChange={(e) => {
                              setOptLoad(parseFloat(e.target.value));
                              setOptActiveScenario("custom");
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                          />
                          <div className="flex justify-between text-[8.5px] text-slate-400 font-mono">
                            <span>80.0%</span>
                            <span className="text-slate-500 font-semibold">Base: 100.0% (2,240 MT/D)</span>
                            <span>115.0%</span>
                          </div>
                        </div>

                        {/* Operational Constraints Section */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 block">
                            Operating Constraints &amp; Limits
                          </span>

                          {/* Constraint 1: Target Turnaround Date */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9.5px]">
                              <span className="text-slate-600 font-medium">Planned Turnaround:</span>
                              <span className="font-mono font-bold text-slate-800">{formatIngeneroDate(optPlannedShutdown)}</span>
                            </div>
                            <input
                              id="input-opt-planned-shutdown"
                              type="date"
                              value={toDisplayDateInput(optPlannedShutdown)}
                              onChange={(e) => setOptPlannedShutdown(toBackendDateInput(e.target.value))}
                              className="w-full text-[9px] font-mono px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700"
                            />
                          </div>

                          {/* Constraint 2: Minimum Catalyst Activity Threshold */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9.5px]">
                              <span className="text-slate-600 font-medium">Catalyst Threshold Limit:</span>
                              <span className="font-mono font-bold text-slate-800">{optCatalystThreshold.toFixed(1)}% Activity</span>
                            </div>
                            <input
                              id="slider-opt-catalyst-threshold"
                              type="range"
                              min="40"
                              max="60"
                              step="0.5"
                              value={optCatalystThreshold}
                              onChange={(e) => setOptCatalystThreshold(parseFloat(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                            />
                            <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                              <span>40.0%</span>
                              <span>Default: 50.0% (End of Run)</span>
                              <span>60.0%</span>
                            </div>
                          </div>

                          {/* Constraint 3: Max Allowable SEC */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9.5px]">
                              <span className="text-slate-600 font-medium">Max Allowable SEC:</span>
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className={`font-bold ${optResult.calculatedSec > optMaxSec ? 'text-red-600' : 'text-slate-800'}`}>
                                  {optMaxSec.toFixed(2)} Gcal/MT
                                </span>
                                {optResult.calculatedSec > optMaxSec ? (
                                  <span className="text-[8px] font-bold text-red-600 px-1 py-0.2 bg-red-100 rounded border border-red-200">
                                    BREACH (+{(optResult.calculatedSec - optMaxSec).toFixed(2)})
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-bold text-emerald-700 px-1 py-0.2 bg-emerald-50 rounded border border-emerald-200">
                                    Safe (+{(optMaxSec - optResult.calculatedSec).toFixed(2)})
                                  </span>
                                )}
                              </div>
                            </div>
                            <input
                              id="slider-opt-max-sec"
                              type="range"
                              min="7.50"
                              max="9.00"
                              step="0.05"
                              value={optMaxSec}
                              onChange={(e) => setOptMaxSec(parseFloat(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                            />
                            <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                              <span>7.50</span>
                              <span className="text-slate-600 font-semibold">Default Limit: 8.20 Gcal/MT</span>
                              <span>9.00</span>
                            </div>
                          </div>

                          {/* Constraint 4: Furnace Bridgewall Temperature Limit */}
                          <div className="space-y-0.5 pt-1.5 border-t border-slate-100">
                            <div className="flex justify-between text-[9.5px]">
                              <span className="text-slate-600 font-medium">Bridgewall Temp (BWT):</span>
                              <span className={`font-mono font-bold ${!optResult.isBwtSafe ? 'text-red-600' : 'text-slate-800'}`}>
                                {optResult.calculatedBwt.toFixed(1)} &deg;C {!optResult.isBwtSafe ? '(BREACH)' : '(Safe)'}
                              </span>
                            </div>
                            <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                              <span>Base: 1005.0 &deg;C</span>
                              <span className="text-red-700 font-semibold">Max Limit: 1040.0 &deg;C (Refractory/TMT)</span>
                            </div>
                          </div>

                          {/* Constraint 5: Stack Flue Gas Temperature Limit */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[9.5px]">
                              <span className="text-slate-600 font-medium">Stack Flue Gas Temp:</span>
                              <span className={`font-mono font-bold ${!optResult.isStackSafe ? 'text-red-600' : 'text-slate-800'}`}>
                                {optResult.calculatedStack.toFixed(1)} &deg;C {!optResult.isStackSafe ? '(EXCEEDED)' : '(Normal)'}
                              </span>
                            </div>
                            <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                              <span>Dew Point: 135.0 &deg;C</span>
                              <span className="text-slate-600 font-semibold">Max Limit: 165.0 &deg;C (ID Fan / Convection)</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right 7 Cols: Sensitivity Curves & Pareto Visualizations */}
                      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-[#0090d0]" />
                            Sensitivity &amp; Pareto Frontier Visualizations
                          </h4>
                          <div className="flex items-center gap-1">
                            {(["temperature", "sc", "load"] as const).map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setOptSensitivityVar(v)}
                                className={`px-2 py-0.5 rounded text-[8.5px] font-medium uppercase transition-colors cursor-pointer ${optSensitivityVar === v ? 'bg-[#0090d0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                vs. {v === "temperature" ? "Temp" : v === "sc" ? "S/C" : "Load"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* DYNAMIC SVG CHART: PERFORMANCE (CONVERSION) & ENERGY (SEC) VS TEMPERATURE */}
                        <div className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                          <div className="flex items-center justify-between text-[9px] mb-1.5">
                            <span className="font-bold uppercase tracking-wider text-slate-700">
                              Response Surface: Conversion (Blue) &bull; SEC (Amber) &bull; Margin Line (Green)
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-sky-700 font-mono"><span className="w-2.5 h-0.5 bg-[#0090d0] inline-block"></span> Conv %</span>
                              <span className="flex items-center gap-1 text-amber-700 font-mono"><span className="w-2.5 h-0.5 bg-amber-500 inline-block"></span> SEC (Gcal/MT)</span>
                              <span className="flex items-center gap-1 text-emerald-700 font-mono"><span className="w-2.5 h-0.5 bg-emerald-500 inline-block"></span> Safe Margin</span>
                            </div>
                          </div>

                          <div className="relative h-44 w-full">
                            {(() => {
                              // Temperature range [840, 885] mapped to SVG [40, 480] (width 440px)
                              const getTempX = (t: number) => {
                                const norm = Math.max(0, Math.min(1, (t - 840) / 45));
                                return 40 + norm * 440;
                              };
                              // Conversion curve Y [135, 30]
                              const getConvY = (t: number) => {
                                const norm = Math.max(0, Math.min(1, (t - 840) / 45));
                                return 135 - norm * 105;
                              };

                              // Dynamic SEC cap line Y [135, 20] based on optMaxSec [7.50, 9.00]
                              const secNorm = Math.max(0, Math.min(1, (optMaxSec - 7.50) / 1.50));
                              const secCapY = 135 - secNorm * 115;

                              // Scenario coordinates
                              const scenAX = getTempX(baseTempForDate);
                              const scenAY = getConvY(baseTempForDate);

                              const scenCX = getTempX(scenCTemp);
                              const scenCY = getConvY(scenCTemp);

                              const scenBX = getTempX(scenBTemp);
                              const scenBY = getConvY(scenBTemp);

                              const simX = getTempX(optTemperature);
                              const simY = getConvY(optTemperature);

                              return (
                                <svg className="w-full h-full" viewBox="0 0 500 170" preserveAspectRatio="none">
                                  {/* Grid lines */}
                                  <line x1="40" y1="20" x2="480" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                                  <line x1="40" y1="55" x2="480" y2="55" stroke="#e2e8f0" strokeDasharray="3 3" />
                                  <line x1="40" y1="90" x2="480" y2="90" stroke="#e2e8f0" strokeDasharray="3 3" />
                                  <line x1="40" y1="125" x2="480" y2="125" stroke="#e2e8f0" strokeDasharray="3 3" />
                                  <line x1="40" y1="150" x2="480" y2="150" stroke="#cbd5e1" />
                                  <line x1="40" y1="10" x2="40" y2="150" stroke="#cbd5e1" />

                                  {/* Dynamic Max SEC Constraint Limit Threshold Line */}
                                  <line x1="40" y1={secCapY} x2="480" y2={secCapY} stroke="#ef4444" strokeDasharray="4 2" strokeWidth="1.5" />
                                  <text x="475" y={secCapY - 4} textAnchor="end" fill="#dc2626" fontSize="8" fontFamily="monospace" fontWeight="bold">
                                    Max SEC Cap ({optMaxSec.toFixed(2)} Gcal/MT)
                                  </text>

                                  {/* Recommended Operating Zone Highlight around Scenario C */}
                                  <rect x={scenCX - 35} y="15" width="70" height="135" fill="#10b981" fillOpacity="0.08" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
                                  <text x={scenCX} y="27" textAnchor="middle" fill="#047857" fontSize="8" fontWeight="bold">
                                    RECOMMENDED SETPOINT
                                  </text>

                                  {/* Curve 1: Conversion (Blue line) */}
                                  <path
                                    d="M 40,135 Q 150,110 260,70 T 480,30"
                                    fill="none"
                                    stroke="#0090d0"
                                    strokeWidth="2.5"
                                  />

                                  {/* Curve 2: Specific Energy Consumption (Amber line) */}
                                  <path
                                    d="M 40,120 Q 180,105 270,85 T 480,25"
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="2.5"
                                  />

                                  {/* Scenario A Point: dynamically placed at baseTempForDate */}
                                  <circle cx={scenAX} cy={scenAY} r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                                  <text x={scenAX} y={scenAY + 15} textAnchor="middle" fill="#0369a1" fontSize="8" fontWeight="bold">Scenario A (Base)</text>

                                  {/* Scenario B Point: (+15°C Firing Target) */}
                                  <circle cx={scenBX} cy={scenBY} r="4.5" fill="#dc2626" stroke="#ffffff" strokeWidth="1.5" />
                                  <text x={scenBX} y={scenBY - 8} textAnchor="middle" fill="#dc2626" fontSize="8" fontWeight="bold">Scenario B (+15&deg;C)</text>

                                  {/* Scenario C Point: (+7.5°C Recommended Pareto Point) */}
                                  <circle cx={scenCX} cy={scenCY} r="5.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                                  <text x={scenCX} y={scenCY - 10} textAnchor="middle" fill="#047857" fontSize="8" fontWeight="bold">Scenario C (Pareto)</text>

                                  {/* Live Simulator Operating Point Marker */}
                                  <line x1={simX} y1="15" x2={simX} y2="150" stroke="#475569" strokeDasharray="2 2" strokeWidth="1.5" />
                                  <circle cx={simX} cy={simY} r="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="2.5" className="animate-pulse" />
                                  <rect x={simX - 35} y="130" width="70" height="15" rx="3" fill="#1e293b" fillOpacity="0.9" />
                                  <text x={simX} y={141} textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
                                    Sim: {optTemperature.toFixed(1)}&deg;C
                                  </text>

                                  {/* Axis Ticks */}
                                  <text x="40" y="162" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">840&deg;C</text>
                                  <text x={scenAX} y="162" textAnchor="middle" fill="#0369a1" fontSize="8" fontFamily="monospace" fontWeight="bold">{baseTempForDate.toFixed(0)}&deg;C</text>
                                  <text x={scenCX} y="162" textAnchor="middle" fill="#047857" fontSize="8" fontFamily="monospace" fontWeight="bold">{scenCTemp.toFixed(1)}&deg;C (Rec)</text>
                                  <text x={scenBX} y="162" textAnchor="middle" fill="#dc2626" fontSize="8" fontFamily="monospace">{scenBTemp.toFixed(1)}&deg;C (+15)</text>
                                  <text x="480" y="162" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace">885&deg;C</text>
                                </svg>
                              );
                            })()}
                          </div>
                        </div>

                        {/* TURNAROUND MARGIN TIMELINE BAR (EOR 2025 CAMPAIGN) */}
                        <div className="border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                          <div className="flex items-center justify-between text-[9px] mb-1">
                            <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#0090d0]" />
                              Planned Turnaround vs. Predicted Threshold Timeline
                            </span>
                            <span className="font-mono text-[8.5px] text-slate-500">
                              Day {optResult.eorAgeDays} Online &bull; 5-Year Campaign (Started Jan 2022 &bull; Turnaround {formatIngeneroDate(optPlannedShutdown).split(' ')[0]})
                            </span>
                          </div>

                          {(() => {
                            const totalCampaignDays = Math.max(1200, Math.round((new Date(optPlannedShutdown || "2025-11-07").getTime() - new Date("2021-01-01").getTime()) / (1000 * 60 * 60 * 24)));
                            const elapsedPct = Math.min(94.0, Math.max(10.0, (optResult.eorAgeDays / totalCampaignDays) * 100));
                            const runwayPct = Math.min(100 - elapsedPct, Math.max(3.0, (Math.max(0, optResult.rulDays) / totalCampaignDays) * 100));
                            const bufferPct = Math.min(25.0, Math.max(2.5, (Math.abs(optResult.lifeMarginDays) / totalCampaignDays) * 100));

                            return (
                              <div className="relative w-full h-8 bg-slate-200 rounded-md overflow-hidden flex items-center px-2">
                                {/* Elapsed Catalyst Life */}
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-slate-400/40 border-r-2 border-slate-500" 
                                  style={{ width: `${elapsedPct}%` }}
                                  title={`Current Age: Day ${optResult.eorAgeDays}`}
                                />

                                {/* Safe Operating Runway to Planned Turnaround */}
                                <div 
                                  className={`absolute top-0 bottom-0 ${optResult.isMarginSafe ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}
                                  style={{ 
                                    left: `${elapsedPct}%`, 
                                    width: `${runwayPct}%` 
                                  }}
                                  title="Remaining Operating Runway to Planned Turnaround"
                                />

                                {/* Buffer/Margin Zone */}
                                {optResult.lifeMarginDays >= 0 ? (
                                  <div 
                                    className="absolute top-0 bottom-0 bg-emerald-500/50 border-l border-dashed border-emerald-700"
                                    style={{ 
                                      left: `${Math.min(98.0 - bufferPct, elapsedPct + runwayPct - bufferPct)}%`, 
                                      width: `${bufferPct}%` 
                                    }}
                                    title={`Catalyst Life Buffer: +${optResult.lifeMarginDays} Days`}
                                  />
                                ) : (
                                  <div 
                                    className="absolute top-0 bottom-0 bg-red-600/60 border-r-2 border-red-700"
                                    style={{ 
                                      left: `${Math.max(10.0, elapsedPct + runwayPct)}%`, 
                                      width: `${bufferPct}%` 
                                    }}
                                    title={`Premature Breach: ${optResult.lifeMarginDays} Days Deficit`}
                                  />
                                )}
                                
                                <div className="relative z-10 w-full flex items-center justify-between text-[9px] font-mono">
                                  <span className="text-slate-600 font-bold">{formatIngeneroDate(selectedDate).split(' ')[0]} (Day {optResult.eorAgeDays})</span>
                                  
                                  <div className="flex items-center gap-1">
                                    <span className="px-1.5 py-0.2 rounded bg-white text-slate-800 border border-slate-300 font-bold text-[8.5px]">
                                      Planned Turnaround: {formatIngeneroDate(optPlannedShutdown).split(' ')[0]}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold ${optResult.isMarginSafe ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                                      Threshold: {optResult.thresholdDateStr} ({optResult.lifeMarginDays >= 0 ? `+${optResult.lifeMarginDays}d Margin` : `${optResult.lifeMarginDays}d BREACH`})
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* DYNAMIC LIVE SIMULATOR RESPONSE (THE 4 PILLARS - SHIFTED DOWN BELOW HANDLES & GRAPHS) */}
                    <div className="space-y-2">
                      {/* Operational Point Status Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-white shadow-2xs">
                            Current Simulated Operating Point
                          </span>
                          <span className="text-[10px] font-mono text-slate-700">
                            T_out: <strong className="text-slate-900">{optTemperature.toFixed(1)}&deg;C</strong> &bull; S/C: <strong className="text-slate-900">{optSteamCarbon.toFixed(2)}</strong> &bull; Load: <strong className="text-slate-900">{optLoad.toFixed(1)}%</strong>
                          </span>
                          {(optActiveScenario === "C" || (Math.abs(optTemperature - scenCTemp) < 0.1 && Math.abs(optSteamCarbon - scenCSc) < 0.01)) ? (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Active: Matching Recommended Setpoint (Scenario C)
                            </span>
                          ) : (optActiveScenario === "A" || (Math.abs(optTemperature - baseTempForDate) < 0.1 && Math.abs(optSteamCarbon - baseScForDate) < 0.01)) ? (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-sky-100 text-[#0090d0] border border-sky-300">
                              Active: Matching Base Case (Scenario A)
                            </span>
                          ) : (optActiveScenario === "B" || (Math.abs(optTemperature - scenBTemp) < 0.1 && Math.abs(optSteamCarbon - scenBSc) < 0.01)) ? (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-red-100 text-red-700 border border-red-300">
                              Active: Matching High Firing Case (Scenario B)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Custom Slider Exploration (Evaluating Deviation)
                            </span>
                          )}
                          {optResult.calculatedSec > optMaxSec && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-red-600 text-white shadow-2xs">
                              SEC Constraint Exceeded ({optResult.calculatedSec.toFixed(2)} &gt; {optMaxSec.toFixed(2)})
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          Recommended Setpoint: <span className="text-emerald-700 font-bold">{scenCTemp.toFixed(1)}&deg;C &bull; {scenCSc.toFixed(2)} S/C &bull; 100% Load</span>
                        </div>
                      </div>

                      {/* The 4 Dynamic Pillar Boxes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
                        {/* PILLAR 1: PERFORMANCE */}
                        <div className="bg-white border-2 border-sky-100 rounded-lg p-3 shadow-2xs flex flex-col justify-between transition-all hover:border-[#0090d0]">
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-[#0090d0]" />
                                1. Performance (Simulated)
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-sky-100 text-[#0090d0] border border-sky-200">
                                {optResult.deltaProd >= 0 ? `+${optResult.deltaProd}` : optResult.deltaProd} MT/Day
                              </span>
                            </div>
                            <div className="mt-2 space-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Methane Conversion:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">88.91%</span>
                                  <span>&rarr;</span>
                                  <span className="font-bold text-slate-800">{optResult.calculatedConv.toFixed(2)}%</span>
                                  <span className="text-[8.5px] text-emerald-700 font-semibold">(Rec: {scenCResult.calculatedConv.toFixed(2)}%)</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Approach to Equil (ATE):</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">9.0&deg;C</span>
                                  <span>&rarr;</span>
                                  <span className="font-bold text-sky-700">{optResult.calculatedAte.toFixed(1)}&deg;C</span>
                                  <span className="text-[8.5px] text-emerald-700 font-semibold">(Rec: {scenCResult.calculatedAte.toFixed(1)}&deg;C)</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Methanol Production:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">2,240</span>
                                  <span>&rarr;</span>
                                  <span className="font-bold text-emerald-700">{optResult.calculatedProd.toLocaleString()} MT/D</span>
                                  <span className="text-[8.5px] text-emerald-700 font-semibold">(Rec: {scenCResult.calculatedProd.toLocaleString()})</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-100 text-[8.5px] text-slate-500 flex justify-between items-center">
                            <span>Reformer Load: <strong className="text-slate-700">{optLoad.toFixed(1)}%</strong></span>
                            <span className="text-emerald-700 font-semibold font-mono">
                              {optResult.calculatedConv >= 88.91 ? `+${(optResult.calculatedConv - 88.91).toFixed(2)}% yield` : `${(optResult.calculatedConv - 88.91).toFixed(2)}% yield`}
                            </span>
                          </div>
                        </div>

                        {/* PILLAR 2: ENERGY & FURNACE FIRING */}
                        <div className={`bg-white border-2 rounded-lg p-3 shadow-2xs flex flex-col justify-between transition-all ${optResult.calculatedSec <= optMaxSec && optResult.isBwtSafe && optResult.isStackSafe ? 'border-amber-100 hover:border-amber-300' : 'border-red-300 bg-red-50/20'}`}>
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-amber-600" />
                                2. Energy &amp; Furnace Firing
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold ${!optResult.isBwtSafe ? 'bg-red-100 text-red-800' : !optResult.isStackSafe ? 'bg-amber-100 text-amber-800' : optResult.calculatedSec <= optMaxSec ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {!optResult.isBwtSafe ? 'BWT Exceeded' : !optResult.isStackSafe ? 'Stack Limit Exceeded' : optResult.calculatedSec <= optMaxSec ? 'Within Safe Limits' : 'SEC Cap Exceeded'}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Specific Energy (SEC):</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">7.82</span>
                                  <span>&rarr;</span>
                                  <span className={`font-bold ${optResult.calculatedSec > optMaxSec ? 'text-red-700' : 'text-slate-800'}`}>
                                    {optResult.calculatedSec.toFixed(2)} Gcal/MT
                                  </span>
                                  <span className="text-[8.5px] text-emerald-700 font-semibold">(Rec: {scenCResult.calculatedSec.toFixed(2)})</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Furnace Fuel Firing:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">112.4</span>
                                  <span>&rarr;</span>
                                  <span className="font-bold text-slate-700">{optResult.calculatedFuel.toFixed(1)} MW</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Bridgewall Temp (BWT):</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">1005.0</span>
                                  <span>&rarr;</span>
                                  <span className={`font-bold ${!optResult.isBwtSafe ? 'text-red-700' : 'text-slate-800'}`}>
                                    {optResult.calculatedBwt.toFixed(1)}&deg;C
                                  </span>
                                  <span className={`text-[8.5px] font-semibold ${!optResult.isBwtSafe ? 'text-red-600' : 'text-emerald-700'}`}>
                                    ({optResult.isBwtSafe ? 'Safe' : 'Limit 1040°C'})
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Stack Flue Gas:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">148.0</span>
                                  <span>&rarr;</span>
                                  <span className={`font-bold ${!optResult.isStackSafe ? 'text-red-700' : 'text-slate-800'}`}>
                                    {optResult.calculatedStack.toFixed(1)}&deg;C
                                  </span>
                                  <span className={`text-[8.5px] font-semibold ${!optResult.isStackSafe ? 'text-red-600' : 'text-emerald-700'}`}>
                                    ({optResult.isStackSafe ? 'Normal' : 'Limit 165°C'})
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Steam Consumption:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="text-slate-400 text-[9px]">185.9</span>
                                  <span>&rarr;</span>
                                  <span className="font-bold text-slate-700">{optResult.calculatedSteam.toFixed(1)} t/h</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-100 text-[8.5px] text-slate-500 flex justify-between items-center">
                            <span>Furnace Limits: <strong className="text-slate-700">BWT &lt; 1040&deg;C &bull; Stack &lt; 165&deg;C</strong></span>
                            <span className={`font-mono font-semibold ${optResult.deltaSec > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {optResult.deltaSec > 0 ? `+${optResult.deltaSec.toFixed(2)} Gcal` : `${optResult.deltaSec.toFixed(2)} Gcal`}
                            </span>
                          </div>
                        </div>

                        {/* PILLAR 3: CATALYST CONDITION */}
                        <div className={`bg-white border-2 rounded-lg p-3 shadow-2xs flex flex-col justify-between transition-all ${Math.abs(optResult.monthlyDegradation) > 1.5 ? 'border-red-300 bg-red-50/20' : 'border-rose-100 hover:border-rose-300'}`}>
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Flame className="w-3 h-3 text-red-500" />
                                3. Catalyst Life (Simulated)
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-sky-100 text-sky-800">
                                Act: {optResult.currentActivity.toFixed(1)}%
                              </span>
                            </div>
                            <div className="mt-2 space-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Deactivation Rate:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className={`font-bold ${Math.abs(optResult.monthlyDegradation) > 1.5 ? 'text-red-700' : 'text-slate-800'}`}>
                                    {optResult.monthlyDegradation.toFixed(3)}% / mo
                                  </span>
                                  <span className="text-[8.5px] text-emerald-700 font-semibold">(Rec: {scenCResult.monthlyDegradation.toFixed(3)}%)</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Daily Degradation:</span>
                                <span className="font-mono text-slate-700">
                                  {optResult.dailyDegradation.toFixed(4)}% / day
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">RUL to {optCatalystThreshold.toFixed(1)}% Act:</span>
                                <span className="font-mono font-bold text-emerald-700">
                                  {optResult.rulDays} Days ({optResult.rulMonths} Mo)
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-100 text-[8.5px] text-slate-500 flex justify-between items-center">
                            <span>Base: -0.830%/mo</span>
                            <span className="font-mono text-slate-600 font-semibold">
                              {(Math.abs(optResult.monthlyDegradation) / 0.830).toFixed(2)}x severity
                            </span>
                          </div>
                        </div>

                        {/* PILLAR 4: SHUTDOWN TIMING & MARGIN */}
                        <div className={`border-2 rounded-lg p-3 shadow-2xs flex flex-col justify-between transition-all ${optResult.isMarginSafe ? 'bg-emerald-50/50 border-emerald-300' : 'bg-red-50/80 border-red-500 animate-pulse'}`}>
                          <div>
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Clock className={`w-3 h-3 ${optResult.isMarginSafe ? 'text-emerald-700' : 'text-red-600'}`} />
                                4. Shutdown Margin (Simulated)
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase ${optResult.isMarginSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {optResult.isMarginSafe ? 'Safe Margin' : 'Critical Breach'}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Planned Turnaround:</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {formatIngeneroDate(optPlannedShutdown)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Predicted Threshold:</span>
                                <div className="flex items-center gap-1.5 font-mono">
                                  <span className="font-bold text-slate-800">
                                    {optResult.thresholdDateStr}
                                  </span>
                                  <span className="text-[8.5px] text-emerald-700 font-semibold">(Rec: {scenCResult.thresholdDateStr})</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Catalyst Life Margin:</span>
                                <span className={`font-mono font-bold text-[11px] ${optResult.isMarginSafe ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {optResult.lifeMarginDays >= 0 ? `+${optResult.lifeMarginDays} Days (+${optResult.lifeMarginMonths} Mo)` : `${optResult.lifeMarginDays} Days (${optResult.lifeMarginMonths} Mo)`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-200 text-[8.5px] text-slate-600 flex justify-between items-center">
                            <span>Economic Net Yield:</span>
                            <span className={`font-bold font-mono ${optResult.netEconomicBenefit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {optResult.netEconomicBenefit >= 0 ? `+$${optResult.netEconomicBenefit.toLocaleString()}/Day` : `-$${Math.abs(optResult.netEconomicBenefit).toLocaleString()}/Day`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OPERATIONS ENGINEERING DECISION RATIONALE BOX (CRISP BULLET POINTS) */}
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg p-3.5 shadow-sm space-y-2.5 text-[10px]">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
                        <span className="font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" />
                          Executive Engineering Rationale &amp; Operational Directives
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Reformer Kinetic, Thermodynamic &amp; Furnace Hydraulic Balancing
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-200">
                        <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 space-y-1">
                          <div className="flex items-center gap-1.5 text-sky-400 font-bold uppercase text-[9.5px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                            <span>1. Catalyst Health &amp; Turnaround Runway Protection</span>
                          </div>
                          <p className="text-slate-300 text-[9.5px] leading-relaxed pl-3">
                            Under current End-of-Run (EOR) aged catalyst conditions (activity = <strong>{optResult.currentActivity.toFixed(1)}%</strong>, Day {optResult.eorAgeDays} online), Scenario C restricts monthly deactivation to <strong>{scenCResult.monthlyDegradation.toFixed(2)}%/mo</strong>. This safeguards a <strong>+{scenCResult.lifeMarginDays} Day runway margin</strong> beyond the scheduled {formatIngeneroDate(optPlannedShutdown).split(' ')[0]} turnaround, avoiding a costly premature catalyst replacement.
                          </p>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[9.5px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>2. Conversion Recovery &amp; Reconciled Syngas Opportunity</span>
                          </div>
                          <p className="text-slate-300 text-[9.5px] leading-relaxed pl-3">
                            Increasing Reformer Outlet Temp by <strong>+7.5&deg;C (to {scenCTemp.toFixed(1)}&deg;C)</strong> with S/C at <strong>{scenCSc.toFixed(2)} (+0.08)</strong> recovers methane conversion to <strong>{scenCResult.calculatedConv.toFixed(2)}%</strong> (+{((scenCResult.calculatedConv - scenAResult.calculatedConv)).toFixed(2)}%), narrowing ATE to <strong>{scenCResult.calculatedAte.toFixed(1)}&deg;C</strong> and capturing <strong>+{scenCResult.deltaProd.toFixed(1)} MT/Day</strong> additional pure methanol (matching Overview opportunity).
                          </p>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase text-[9.5px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>3. Energy &amp; SEC Thermal Optimization Boundary</span>
                          </div>
                          <p className="text-slate-300 text-[9.5px] leading-relaxed pl-3">
                            Specific Energy Consumption operates stably at <strong>{scenCResult.calculatedSec.toFixed(2)} Gcal/MT</strong>, safely below the <strong>{optMaxSec.toFixed(2)} Gcal/MT</strong> cap line. This prevents excessive fuel penalties while delivering a daily net economic benefit of <strong>+${scenCResult.netEconomicBenefit.toLocaleString()}/Day</strong> (net of fuel and steam utility tariffs).
                          </p>
                        </div>

                        <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700 space-y-1">
                          <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase text-[9.5px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            <span>4. Furnace Bridgewall (BWT) &amp; Stack Flue Gas Safeguards</span>
                          </div>
                          <p className="text-slate-300 text-[9.5px] leading-relaxed pl-3">
                            Scenario C maintains Bridgewall Temperature at <strong>{scenCResult.calculatedBwt.toFixed(1)}&deg;C</strong> (well below the <strong>1,040.0&deg;C</strong> refractory limit) and Stack Gas at <strong>{scenCResult.calculatedStack.toFixed(1)}&deg;C</strong> (&lt;165.0&deg;C ID fan boundary). Conversely, Scenario B (+15.0&deg;C) causes BWT to breach limits and precipitates premature catalyst deactivation by {scenBResult.thresholdDateStr}.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* DEDICATED PROCESS MONITORING SCREEN                           */}
              {/* ───────────────────────────────────────────────────────────── */}
              {activeScreen === "monitoring" && (
                <div className="space-y-2.5 animate-fadeIn">
                  {/* SECTION: PROCESS MONITORING (Variable Trend Analysis) */}
                  <div id="monitoring-section" className="bg-gradient-to-r from-[#e1f3fc] to-[#eef8fd] border border-[#cbe8f8] px-3.5 py-1.5 rounded-lg flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        PROCESS MONITORING &amp; VARIABLE TREND ANALYSIS
                      </h3>
                  <span className="text-[10px] font-normal text-slate-500 border-l border-sky-300 pl-3">
                    Multi-Variable Historian Overlay &amp; Interactive KPI / PI Tag Diagnostics
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-white rounded border border-slate-200 p-0.5 shadow-2xs">
                    {(["1D", "1W", "2W", "1M"] as const).map(tr => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => setMonitoringTimeRange(tr)}
                        className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors cursor-pointer ${
                          monitoringTimeRange === tr
                            ? "bg-[#0090d0] text-white"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tr}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonitoringCollapsed(!monitoringCollapsed)}
                    className="p-1 hover:bg-sky-100 rounded text-slate-500 hover:text-[#0090d0] transition-colors cursor-pointer"
                    title={monitoringCollapsed ? "Expand Monitoring Section" : "Collapse Monitoring Section"}
                  >
                    {monitoringCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!monitoringCollapsed && (() => {
                const getTagMeta = (id: string, defActual: number, defOpt: number, defMin: number, defMax: number) => {
                  const s = trendHistoryData?.series?.[id];
                  if (s) {
                    return {
                      actual: typeof s.latest === "number" ? s.latest : defActual,
                      optimum: typeof s.optimum === "number" ? s.optimum : defOpt,
                      yMin: typeof s.yMin === "number" ? s.yMin : defMin,
                      yMax: typeof s.yMax === "number" ? s.yMax : defMax
                    };
                  }
                  return { actual: defActual, optimum: defOpt, yMin: defMin, yMax: defMax };
                };

                const tagCatalog = [
                  // KPI Parameters
                  { id: "kpi_ch4_conv", name: "Reformer Methane Conversion", section: "reformer", category: "kpi", unit: "%", color: "#0090d0", ...getTagMeta("kpi_ch4_conv", 88.91, 89.83, 85, 92) },
                  { id: "kpi_therm_eff", name: "Thermal Efficiency", section: "reformer", category: "kpi", unit: "%", color: "#059669", ...getTagMeta("kpi_therm_eff", 93.05, 94.80, 90, 96) },
                  { id: "kpi_whb_duty", name: "WHB Steam Duty", section: "reformer", category: "kpi", unit: "MW", color: "#ea580c", ...getTagMeta("kpi_whb_duty", 84.31, 87.51, 75, 95) },
                  { id: "kpi_spec_energy", name: "Specific Energy Consumption", section: "reformer", category: "kpi", unit: "GJ/t", color: "#9333ea", ...getTagMeta("kpi_spec_energy", 31.42, 30.25, 26, 34) },
                  { id: "kpi_carbon_yield", name: "Carbon Yield", section: "synthesis", category: "kpi", unit: "%", color: "#0284c7", ...getTagMeta("kpi_carbon_yield", 93.88, 95.20, 90, 96) },
                  { id: "kpi_prod_rate", name: "Methanol Production Rate", section: "synthesis", category: "kpi", unit: "MT/d", color: "#d97706", ...getTagMeta("kpi_prod_rate", 1833.3, 1850.0, 1700, 2900) },
                  { id: "kpi_reboiler_duty", name: "Distillation Reboiler Duty", section: "distillation", category: "kpi", unit: "MW", color: "#dc2626", ...getTagMeta("kpi_reboiler_duty", 28.40, 26.10, 24, 32) },

                  // Inferred / Process Parameters
                  { id: "inf_sc_ratio", name: "Steam-to-Carbon Ratio", section: "reformer", category: "inferred", unit: "mol/mol", color: "#16a34a", ...getTagMeta("inf_sc_ratio", 2.79, 2.95, 2.6, 3.1) },
                  { id: "inf_bridgewall_temp", name: "Bridgewall Temperature", section: "reformer", category: "inferred", unit: "°C", color: "#e11d48", ...getTagMeta("inf_bridgewall_temp", 917.5, 850.0, 820, 945) },
                  { id: "inf_arch_o2", name: "Arch Excess O2", section: "reformer", category: "inferred", unit: "%", color: "#2563eb", ...getTagMeta("inf_arch_o2", 1.80, 2.10, 1.5, 2.5) },
                  { id: "inf_tmt_max", name: "Row 1 Tube Metal Temp", section: "reformer", category: "inferred", unit: "°C", color: "#c026d3", ...getTagMeta("inf_tmt_max", 582.0, 543.5, 520, 600) },
                  { id: "inf_cleanliness", name: "E-1201 Cleanliness Factor", section: "reformer", category: "inferred", unit: "%", color: "#ca8a04", ...getTagMeta("inf_cleanliness", 71.8, 95.0, 60, 100) },
                  { id: "inf_bed_saturation", name: "ZnO Bed Saturation", section: "reformer", category: "inferred", unit: "%", color: "#4f46e5", ...getTagMeta("inf_bed_saturation", 45.2, 80.0, 20, 85) },
                  { id: "inf_compressor_power", name: "Feed Compressor Power", section: "reformer", category: "inferred", unit: "MW", color: "#0891b2", ...getTagMeta("inf_compressor_power", 3.82, 3.55, 3.2, 4.2) },
                  { id: "inf_mug_mass_flow", name: "MUG Gas Mass Flow", section: "synthesis", category: "inferred", unit: "kg/h", color: "#9333ea", ...getTagMeta("inf_mug_mass_flow", 115722, 118210, 105000, 300000) },
                  { id: "inf_bed1_delta_t", name: "Converter Bed 1 Delta T", section: "synthesis", category: "inferred", unit: "°C", color: "#f59e0b", ...getTagMeta("inf_bed1_delta_t", 45.2, 43.1, 38, 55) },
                  { id: "inf_reflux_ratio", name: "Column Reflux Ratio", section: "distillation", category: "inferred", unit: "mol/mol", color: "#059669", ...getTagMeta("inf_reflux_ratio", 1.85, 1.62, 1.4, 2.1) },

                  // Raw PI Tags
                  { id: "pi_33_ti_101", name: "33-TI-101 (Arch Flue Temp)", section: "reformer", category: "pi", unit: "°C", color: "#e11d48", ...getTagMeta("pi_33_ti_101", 917.5, 850.0, 820, 945) },
                  { id: "pi_33_fi_102", name: "33-FI-102 (Steam Flow to Saturator)", section: "reformer", category: "pi", unit: "t/h", color: "#0284c7", ...getTagMeta("pi_33_fi_102", 128.4, 136.2, 110, 145) },
                  { id: "pi_33_ai_103", name: "33-AI-103 (Flue Gas O2 Analyzer)", section: "reformer", category: "pi", unit: "%", color: "#16a34a", ...getTagMeta("pi_33_ai_103", 1.80, 2.10, 1.5, 2.5) },
                  { id: "pi_33_pi_104", name: "33-PI-104 (Compressor Disch Press)", section: "reformer", category: "pi", unit: "bar", color: "#7c3aed", ...getTagMeta("pi_33_pi_104", 78.5, 78.0, 15, 85) },
                  { id: "pi_33_fi_105", name: "33-FI-105 (Raw Natural Gas Flow)", section: "reformer", category: "pi", unit: "t/h", color: "#d97706", ...getTagMeta("pi_33_fi_105", 67.2, 67.2, 60, 75) },
                  { id: "pi_34_ti_201", name: "34-TI-201 (Loop Feed Gas Preheater)", section: "synthesis", category: "pi", unit: "°C", color: "#0891b2", ...getTagMeta("pi_34_ti_201", 215.0, 210.0, 200, 230) },
                  { id: "pi_34_pi_202", name: "34-PI-202 (Synthesis Loop Pressure)", section: "synthesis", category: "pi", unit: "bar", color: "#dc2626", ...getTagMeta("pi_34_pi_202", 82.3, 80.5, 15, 90) },
                  { id: "pi_35_ti_301", name: "35-TI-301 (Refining Column Overhead Temp)", section: "distillation", category: "pi", unit: "°C", color: "#2563eb", ...getTagMeta("pi_35_ti_301", 64.7, 64.5, 60, 70) }
                ];

                const timeLabels = {
                  "1D": ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
                  "1W": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
                  "2W": ["W1 D1", "W1 D3", "W1 D5", "W1 D7", "W2 D2", "W2 D4", "W2 D7"],
                  "1M": ["W1", "W2", "W3", "W4"]
                }[monitoringTimeRange];

                const activeCatalog = tagCatalog.filter(tag => {
                  const matchSec = monitoringSectionFilter === "all" || tag.section === monitoringSectionFilter;
                  const matchSearch = !monitoringSearchQuery || tag.name.toLowerCase().includes(monitoringSearchQuery.toLowerCase()) || tag.id.toLowerCase().includes(monitoringSearchQuery.toLowerCase());
                  return matchSec && matchSearch;
                });

                const activeSelectedItems = tagCatalog.filter(t => selectedMonitoringTags.includes(t.id));

                const handleToggleTag = (id: string) => {
                  setSelectedMonitoringTags(prev => {
                    if (prev.includes(id)) {
                      if (prev.length === 1) return prev;
                      return prev.filter(t => t !== id);
                    } else {
                      if (prev.length >= 5) {
                        return [...prev.slice(1), id];
                      }
                      return [...prev, id];
                    }
                  });
                };

                return (
                  <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs animate-fadeIn flex flex-col gap-3">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                      
                      {/* ───────────────────────────────────────────────────────────── */}
                      {/* LEFT: TREND CHART VISUALIZATION PANEL                         */}
                      {/* ───────────────────────────────────────────────────────────── */}
                      <div className="lg:col-span-8 flex flex-col gap-2 bg-[#fcfdfe] p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div>
                            <h4 className="text-xs font-semibold uppercase text-slate-800 tracking-wide flex items-center gap-2">
                              <span>PROCESS VARIABLE TREND ANALYSIS</span>
                              <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-sky-100 text-[#0090d0] font-mono font-medium lowercase">
                                real dcs historian
                              </span>
                            </h4>
                            <p className="text-[9.5px] text-slate-500 mt-0.5">
                              Real plant historian measurements ({trendHistoryData?.point_count || 0} records across {monitoringTimeRange}) &bull; Selected: {activeSelectedItems.length}/5
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[8.5px]">
                            <button
                              type="button"
                              onClick={() => setShowMonitoringOptimum(!showMonitoringOptimum)}
                              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                showMonitoringOptimum ? "bg-sky-50 text-[#0090d0] border-sky-300" : "bg-white text-slate-500 border-slate-200"
                              }`}
                            >
                              {showMonitoringOptimum ? "✓ Targets Active" : "Targets Hidden"}
                            </button>
                          </div>
                        </div>

                        {/* Multi-Axis SVG Chart Container */}
                        <div className="w-full h-[270px] bg-white border border-slate-200 rounded-md relative overflow-hidden shadow-2xs">
                          {/* Loading Overlay */}
                          {isLoadingTrends && (
                            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-20">
                              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-sky-200 shadow-xs text-[9.5px] text-sky-800 font-medium">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0090d0]" />
                                <span>Loading real plant records ({monitoringTimeRange})...</span>
                              </div>
                            </div>
                          )}

                          {/* Floating Interactive Hover Tooltip */}
                          {hoveredTrendPoint && (
                            <div 
                              className="absolute pointer-events-none z-30 bg-slate-900/95 text-white p-2 rounded-md shadow-xl border border-slate-700 text-[8.5px] font-mono leading-tight backdrop-blur-xs transition-all"
                              style={{
                                left: `${Math.min(75, Math.max(5, (hoveredTrendPoint.x / 740) * 100))}%`,
                                top: `${Math.max(8, Math.min(170, hoveredTrendPoint.y - 50))}px`
                              }}
                            >
                              <div className="font-sans font-bold flex items-center gap-1.5 mb-1" style={{ color: hoveredTrendPoint.color }}>
                                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: hoveredTrendPoint.color }} />
                                <span className="truncate max-w-[200px]">{hoveredTrendPoint.tagName}</span>
                              </div>
                              <div className="text-slate-400 text-[8px] mb-1">{hoveredTrendPoint.date}</div>
                              <div className="flex items-center justify-between gap-3 text-slate-200">
                                <span>ACTUAL: <strong className="text-white font-bold">{hoveredTrendPoint.val} {hoveredTrendPoint.unit}</strong></span>
                                <span>TARGET: <span className="text-slate-300">{hoveredTrendPoint.opt} {hoveredTrendPoint.unit}</span></span>
                              </div>
                              <div className="text-[8px] mt-1 text-sky-300 border-t border-slate-800 pt-0.5 flex justify-between">
                                <span>Δ Variance:</span>
                                <span>{(hoveredTrendPoint.val - hoveredTrendPoint.opt > 0 ? "+" : "")}{(hoveredTrendPoint.val - hoveredTrendPoint.opt).toFixed(2)} {hoveredTrendPoint.unit}</span>
                              </div>
                            </div>
                          )}

                          <svg className="w-full h-full" viewBox="0 0 740 260" preserveAspectRatio="none">
                            {/* Horizontal Grid Lines */}
                            <line x1="90" y1="30" x2="720" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="90" y1="75" x2="720" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="90" y1="120" x2="720" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="90" y1="165" x2="720" y2="165" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="90" y1="210" x2="720" y2="210" stroke="#f1f5f9" strokeWidth="1" />

                            {/* Vertical Time Grids */}
                            {[90, 195, 300, 405, 510, 615, 720].map((gx, gIdx) => (
                              <line key={gIdx} x1={gx} y1="30" x2={gx} y2="210" stroke="#f8fafc" strokeWidth="1" />
                            ))}

                            {/* Y Axes on the Left (for up to 3 active variables) */}
                            {activeSelectedItems.slice(0, 3).map((tag, tIdx) => {
                              const axX = 30 + tIdx * 28;
                              const diff = tag.yMax - tag.yMin || 1;
                              const ticks = [
                                tag.yMax,
                                tag.yMax - diff * 0.25,
                                tag.yMax - diff * 0.50,
                                tag.yMax - diff * 0.75,
                                tag.yMin
                              ];
                              return (
                                <g key={tIdx}>
                                  <line x1={axX} y1="30" x2={axX} y2="210" stroke={tag.color} strokeWidth="1.8" />
                                  {ticks.map((val, tickIdx) => (
                                    <text 
                                      key={tickIdx}
                                      x={axX - 4} 
                                      y={34 + tickIdx * 45} 
                                      fontSize="7.5" 
                                      fontFamily="monospace"
                                      fontWeight="bold" 
                                      fill={tag.color} 
                                      textAnchor="end"
                                    >
                                      {val > 1000 ? (val / 1000).toFixed(0) + "k" : val > 100 ? val.toFixed(0) : val.toFixed(1)}
                                    </text>
                                  ))}
                                </g>
                              );
                            })}

                            {/* Plot real historian curves for each selected variable */}
                            {activeSelectedItems.map((tag) => {
                              const seriesObj = trendHistoryData?.series?.[tag.id];
                              const rawValues: number[] = seriesObj?.values && seriesObj.values.length > 0 ? seriesObj.values : [tag.actual];
                              const ptsCount = rawValues.length;
                              const yMin = seriesObj?.yMin ?? tag.yMin;
                              const yMax = seriesObj?.yMax ?? tag.yMax;
                              const diff = (yMax - yMin) || 1;
                              const normY = (v: number) => 210 - ((v - yMin) / diff) * 180;
                              const optY = Math.max(30, Math.min(210, normY(seriesObj?.optimum ?? tag.optimum)));

                              const pts = rawValues.map((val: number, i: number) => {
                                const x = ptsCount > 1 ? 90 + i * (630 / (ptsCount - 1)) : 360;
                                const y = Math.max(30, Math.min(210, normY(val)));
                                const ts = trendHistoryData?.timestamps?.[i] || "";
                                return { x, y, val, ts };
                              });

                              // Faithful linear path reflecting genuine industrial process variations
                              const pathD = pts.reduce((acc, pt, i) => `${acc} ${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, "");
                              const nodeStep = ptsCount <= 35 ? 1 : Math.ceil(ptsCount / 22);

                              return (
                                <g key={tag.id}>
                                  {/* Dashed Optimum Target Line */}
                                  {showMonitoringOptimum && (
                                    <line 
                                      x1="90" 
                                      y1={optY} 
                                      x2="720" 
                                      y2={optY} 
                                      stroke={tag.color} 
                                      strokeWidth="1.6" 
                                      strokeDasharray="5,4" 
                                      opacity="0.8" 
                                    />
                                  )}
                                  {/* Real Plant Historian Solid Line */}
                                  <path 
                                    d={pathD} 
                                    stroke={tag.color} 
                                    strokeWidth="2.2" 
                                    fill="none" 
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                  />
                                  {/* Real Data Nodes */}
                                  {pts.map((p, pIdx) => {
                                    const isSampled = pIdx % nodeStep === 0 || pIdx === ptsCount - 1;
                                    if (!isSampled) return null;
                                    const isLast = pIdx === ptsCount - 1;
                                    return (
                                      <circle 
                                        key={pIdx} 
                                        cx={p.x} 
                                        cy={p.y} 
                                        r={isLast ? "3.5" : "2.2"} 
                                        fill="#ffffff" 
                                        stroke={tag.color} 
                                        strokeWidth={isLast ? "2.2" : "1.6"} 
                                        className="cursor-pointer transition-all hover:r-4"
                                        onMouseEnter={() => setHoveredTrendPoint({
                                          tagId: tag.id,
                                          tagName: tag.name,
                                          val: p.val,
                                          opt: seriesObj?.optimum ?? tag.optimum,
                                          unit: tag.unit,
                                          date: p.ts,
                                          x: p.x,
                                          y: p.y,
                                          color: tag.color
                                        })}
                                        onMouseLeave={() => setHoveredTrendPoint(null)}
                                      />
                                    );
                                  })}
                                </g>
                              );
                            })}

                            {/* Real X-Axis Date / Time Labels */}
                            {trendHistoryData?.x_ticks && trendHistoryData.x_ticks.length > 0 ? (
                              trendHistoryData.x_ticks.map((tick: any, i: number) => {
                                const ptsCount = trendHistoryData.point_count || 1;
                                const lx = ptsCount > 1 ? 90 + (tick.index / (ptsCount - 1)) * 630 : 90;
                                return (
                                  <text 
                                    key={i} 
                                    x={lx} 
                                    y="235" 
                                    fontSize="7.5" 
                                    fontFamily="monospace"
                                    fill="#64748b" 
                                    textAnchor="middle"
                                  >
                                    {tick.label}
                                  </text>
                                );
                              })
                            ) : (
                              timeLabels.map((lbl, i) => {
                                const lx = 90 + i * (630 / (timeLabels.length - 1));
                                return (
                                  <text 
                                    key={i} 
                                    x={lx} 
                                    y="235" 
                                    fontSize="7.5" 
                                    fill="#64748b" 
                                    textAnchor="middle"
                                  >
                                    {lbl}
                                  </text>
                                );
                              })
                            )}
                          </svg>
                        </div>

                        {/* Chart Legend Row & Controls */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 flex-wrap gap-2 text-[9px]">
                          <div className="flex items-center flex-wrap gap-3">
                            {activeSelectedItems.map(tag => (
                              <div key={tag.id} className="flex items-center gap-1.5 font-normal text-slate-700">
                                <span className="w-3.5 h-1 rounded" style={{ backgroundColor: tag.color }} />
                                <span>{tag.name} (Actual)</span>
                                {showMonitoringOptimum && (
                                  <>
                                    <span className="w-3.5 border-t-2 border-dashed ml-1" style={{ borderColor: tag.color }} />
                                    <span className="text-slate-400 font-normal">Target</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedMonitoringTags(["kpi_ch4_conv", "inf_bridgewall_temp", "inf_sc_ratio"])}
                              className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 font-normal shadow-2xs cursor-pointer"
                            >
                              Reset Default
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!trendHistoryData || !trendHistoryData.timestamps) return;
                                const header = ["Timestamp", ...activeSelectedItems.flatMap(t => [`${t.name} (Actual)`, `${t.name} (Benchmark)`])].join(",");
                                const rows = trendHistoryData.timestamps.map((ts: string, idx: number) => {
                                  const colVals = activeSelectedItems.flatMap(t => {
                                    const act = trendHistoryData.series?.[t.id]?.values?.[idx] ?? t.actual;
                                    const opt = trendHistoryData.series?.[t.id]?.optimum ?? t.optimum;
                                    return [act, opt];
                                  });
                                  return [ts, ...colVals].join(",");
                                });
                                const csvContent = [header, ...rows].join("\n");
                                const blob = new Blob([csvContent], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `process_monitoring_real_trends_${monitoringTimeRange}_${selectedDate}.csv`;
                                a.click();
                              }}
                              className="px-2 py-0.5 rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#0090d0] font-normal shadow-2xs cursor-pointer"
                            >
                              Export CSV
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ───────────────────────────────────────────────────────────── */}
                      {/* RIGHT: TAG SELECTION & KPI PARAMETERS PANEL                   */}
                      {/* ───────────────────────────────────────────────────────────── */}
                      <div className="lg:col-span-4 flex flex-col gap-2 bg-[#fcfdfe] p-3 rounded-lg border border-slate-200 shadow-2xs">
                        
                        {/* Filter Tabs */}
                        <div className="flex border-b border-slate-200 pb-1 gap-1">
                          {(["all", "reformer", "synthesis", "distillation"] as const).map(sec => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => setMonitoringSectionFilter(sec)}
                              className={`flex-1 text-center py-1 text-[9px] uppercase font-medium rounded transition-colors cursor-pointer ${
                                monitoringSectionFilter === sec 
                                  ? "text-[#0090d0] border-b-2 border-[#0090d0] font-semibold -mb-[5px] bg-sky-50/50" 
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              {sec}
                            </button>
                          ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative my-0.5">
                          <input 
                            type="text" 
                            placeholder="Search KPI / PI Tag..."
                            value={monitoringSearchQuery}
                            onChange={e => setMonitoringSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-2 py-1 text-[9.5px] border border-slate-200 rounded bg-white text-slate-800 outline-none focus:border-[#0090d0]"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5" />
                        </div>

                        {/* Collapsible Tag Categories */}
                        <div className="space-y-1.5 max-h-[340px] overflow-y-auto custom-scrollbar pr-0.5">
                          
                          {/* Category 1: KPI Parameters */}
                          <div className="border border-slate-200 rounded bg-white overflow-hidden shadow-2xs">
                            <div 
                              onClick={() => setMonitoringOpenSections(prev => ({ ...prev, kpi: !prev.kpi }))}
                              className="bg-slate-50/80 px-2 py-1 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100"
                            >
                              <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-700 uppercase">
                                <span>{monitoringOpenSections.kpi ? "▼" : "▶"}</span>
                                <span>KPI Parameters</span>
                              </div>
                              <span className="text-[8px] text-slate-400 font-normal">
                                ({activeCatalog.filter(t => t.category === "kpi" && selectedMonitoringTags.includes(t.id)).length} selected)
                              </span>
                            </div>
                            {monitoringOpenSections.kpi && (
                              <div className="divide-y divide-slate-100 text-[8.5px]">
                                {activeCatalog.filter(t => t.category === "kpi").map(item => {
                                  const isSelected = selectedMonitoringTags.includes(item.id);
                                  const variance = ((item.actual - item.optimum) / item.optimum) * 100;
                                  return (
                                    <div 
                                      key={item.id} 
                                      onClick={() => handleToggleTag(item.id)}
                                      className={`px-2 py-1 flex items-center justify-between cursor-pointer transition-colors ${
                                        isSelected ? "bg-sky-50/40" : "hover:bg-slate-50/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={() => {}} 
                                          className="cursor-pointer accent-[#0090d0] shrink-0" 
                                        />
                                        <span className={`text-[7px] px-1 py-0.2 rounded font-normal uppercase shrink-0 ${
                                          item.section === "reformer" ? "bg-sky-100 text-sky-800" :
                                          item.section === "synthesis" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                                        }`}>
                                          {item.section.slice(0, 3)}
                                        </span>
                                        <span className="font-normal text-slate-800 truncate" title={item.name}>
                                          {item.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 font-mono text-[8px]">
                                        <span className="text-slate-700">{item.actual}</span>
                                        <span className="text-[#0090d0]">{item.optimum}</span>
                                        <span className={variance >= 0 ? "text-emerald-600" : "text-amber-600"}>
                                          {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Category 2: Inferred / Process Parameters */}
                          <div className="border border-slate-200 rounded bg-white overflow-hidden shadow-2xs">
                            <div 
                              onClick={() => setMonitoringOpenSections(prev => ({ ...prev, inferred: !prev.inferred }))}
                              className="bg-slate-50/80 px-2 py-1 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100"
                            >
                              <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-700 uppercase">
                                <span>{monitoringOpenSections.inferred ? "▼" : "▶"}</span>
                                <span>Inferred Parameters</span>
                              </div>
                              <span className="text-[8px] text-slate-400 font-normal">
                                ({activeCatalog.filter(t => t.category === "inferred" && selectedMonitoringTags.includes(t.id)).length} selected)
                              </span>
                            </div>
                            {monitoringOpenSections.inferred && (
                              <div className="divide-y divide-slate-100 text-[8.5px]">
                                {activeCatalog.filter(t => t.category === "inferred").map(item => {
                                  const isSelected = selectedMonitoringTags.includes(item.id);
                                  const variance = ((item.actual - item.optimum) / item.optimum) * 100;
                                  return (
                                    <div 
                                      key={item.id} 
                                      onClick={() => handleToggleTag(item.id)}
                                      className={`px-2 py-1 flex items-center justify-between cursor-pointer transition-colors ${
                                        isSelected ? "bg-sky-50/40" : "hover:bg-slate-50/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={() => {}} 
                                          className="cursor-pointer accent-[#0090d0] shrink-0" 
                                        />
                                        <span className={`text-[7px] px-1 py-0.2 rounded font-normal uppercase shrink-0 ${
                                          item.section === "reformer" ? "bg-sky-100 text-sky-800" :
                                          item.section === "synthesis" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                                        }`}>
                                          {item.section.slice(0, 3)}
                                        </span>
                                        <span className="font-normal text-slate-800 truncate" title={item.name}>
                                          {item.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 font-mono text-[8px]">
                                        <span className="text-slate-700">{item.actual}</span>
                                        <span className="text-[#0090d0]">{item.optimum}</span>
                                        <span className={variance >= 0 ? "text-emerald-600" : "text-amber-600"}>
                                          {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Category 3: Raw PI Tags */}
                          <div className="border border-slate-200 rounded bg-white overflow-hidden shadow-2xs">
                            <div 
                              onClick={() => setMonitoringOpenSections(prev => ({ ...prev, pi: !prev.pi }))}
                              className="bg-slate-50/80 px-2 py-1 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100"
                            >
                              <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-700 uppercase">
                                <span>{monitoringOpenSections.pi ? "▼" : "▶"}</span>
                                <span>Raw PI Tags</span>
                              </div>
                              <span className="text-[8px] text-slate-400 font-normal">
                                ({activeCatalog.filter(t => t.category === "pi" && selectedMonitoringTags.includes(t.id)).length} selected)
                              </span>
                            </div>
                            {monitoringOpenSections.pi && (
                              <div className="divide-y divide-slate-100 text-[8.5px]">
                                {activeCatalog.filter(t => t.category === "pi").map(item => {
                                  const isSelected = selectedMonitoringTags.includes(item.id);
                                  return (
                                    <div 
                                      key={item.id} 
                                      onClick={() => handleToggleTag(item.id)}
                                      className={`px-2 py-1 flex items-center justify-between cursor-pointer transition-colors ${
                                        isSelected ? "bg-sky-50/40" : "hover:bg-slate-50/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={() => {}} 
                                          className="cursor-pointer accent-[#0090d0] shrink-0" 
                                        />
                                        <span className={`text-[7px] px-1 py-0.2 rounded font-normal uppercase shrink-0 ${
                                          item.section === "reformer" ? "bg-sky-100 text-sky-800" :
                                          item.section === "synthesis" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                                        }`}>
                                          {item.section.slice(0, 3)}
                                        </span>
                                        <span className="font-normal text-slate-800 truncate font-mono text-[8px]" title={item.name}>
                                          {item.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 font-mono text-[8px]">
                                        <span className="text-slate-700">{item.actual}</span>
                                        <span className="text-[#0090d0]">{item.optimum}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}

                </div>
              )}

          </div>

        </div>

      </main>

    </div>
  );
};
