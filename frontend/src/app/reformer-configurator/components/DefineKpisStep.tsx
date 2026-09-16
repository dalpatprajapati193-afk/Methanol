"use client";

import React, { useState } from "react";
import { 
  ArrowLeft, 
  ArrowRight, 
  HelpCircle, 
  CheckCircle2, 
  Layers, 
  Sliders, 
  Sparkles,
  Calculator,
  Search,
  Filter
} from "lucide-react";
import { EquipmentConfig } from "./EquipmentQuestionnaire";

export interface KpiDefinition {
  id: string;
  name: string;
  category: string;
  type: "Calculated" | "PI Tag";
  formula: string;
  uom: string;
  baseline: string;
  limits: string;
  piTag?: string;
  requiredEquipment?: string[];
}

export const DEFAULT_KPIS: KpiDefinition[] = [
  {
    id: "sc_ratio",
    name: "Steam-to-Carbon (S/C) Ratio",
    category: "Stoichiometry & Reforming",
    type: "Calculated",
    formula: "(H2O_Steam_Mass_Flow * 18.015) / (NG_Carbon_Mass_Flow * 12.011)",
    uom: "mol/mol",
    baseline: "2.95",
    limits: "2.80 - 3.20",
    piTag: "AR.DCS.AIC1201.PV"
  },
  {
    id: "reformer_conversion",
    name: "Reformer Methane Conversion",
    category: "Kinetics & Yield",
    type: "Calculated",
    formula: "100 - (CH4_Dry_Syngas / CH4_Feed_Gas) * 100",
    uom: "%",
    baseline: "88.4%",
    limits: "85.0% - 92.0%",
    piTag: "AR.DCS.CALC_CH4_CONV.PV"
  },
  {
    id: "arch_exit_temp",
    name: "Reformer Arch Exit Temperature",
    category: "Thermal Envelope",
    type: "PI Tag",
    formula: "Direct Multi-Point Pyrometer Array Average",
    uom: "°C",
    baseline: "856.0",
    limits: "830.0 - 875.0",
    piTag: "AR.DCS.TI1205_AVG.PV"
  },
  {
    id: "tube_skin_max",
    name: "Max Catalyst Tube Skin Temperature",
    category: "Furnace Integrity",
    type: "PI Tag",
    formula: "Max(IR_Scanner_Row_A..D_Peak)",
    uom: "°C",
    baseline: "925.0",
    limits: "Max 950.0",
    piTag: "AR.DCS.TIS1210_MAX.PV"
  },
  {
    id: "ate_index",
    name: "Approach to Equilibrium (ATE)",
    category: "Catalyst Activity",
    type: "Calculated",
    formula: "Reformed_Gas_Transfer_Temp - Equilibrium_Kinetic_Temp",
    uom: "°C",
    baseline: "8.5",
    limits: "5.0 - 15.0",
    piTag: "AR.DCS.CALC_ATE.PV"
  },
  {
    id: "m_value",
    name: "Syngas Stoichiometric Module (M-Value)",
    category: "Synthesis Quality",
    type: "Calculated",
    formula: "(H2 - CO2) / (CO + CO2)",
    uom: "[-]",
    baseline: "2.05",
    limits: "2.02 - 2.08",
    piTag: "AR.DCS.CALC_MVAL.PV"
  },
  {
    id: "thermal_efficiency",
    name: "Overall Reformer Thermal Efficiency",
    category: "Energy Efficiency",
    type: "Calculated",
    formula: "(Syngas_LHV_Export + Steam_Export) / Total_Fuel_Heat_Input * 100",
    uom: "%",
    baseline: "94.2%",
    limits: "92.0% - 96.0%",
    piTag: "AR.DCS.CALC_REF_EFF.PV"
  },
  {
    id: "radiant_efficiency",
    name: "Radiant Section Thermal Efficiency",
    category: "Energy Efficiency",
    type: "Calculated",
    formula: "Q_Rad_Absorbed / Total_Fuel_Heat_Input * 100",
    uom: "%",
    baseline: "54.2%",
    limits: "50.0% - 58.0%",
    piTag: "AR.DCS.CALC_RAD_EFF.PV"
  },
  {
    id: "convection_temp_out",
    name: "Convection Flue Gas Exit Temperature",
    category: "Convection Section",
    type: "PI Tag",
    formula: "Flue_Gas_Duct_Temperature_To_ID_Fan",
    uom: "°C",
    baseline: "165.0",
    limits: "150.0 - 180.0",
    piTag: "AR.DCS.TI1240.PV",
    requiredEquipment: ["flue_stack", "id_fan"]
  },
  {
    id: "flue_gas_excess_o2",
    name: "Bridgewall Flue Gas Excess Oxygen",
    category: "Combustion Control",
    type: "PI Tag",
    formula: "Zirconia_O2_Analyzer_Average",
    uom: "vol%",
    baseline: "1.80%",
    limits: "1.50% - 2.20%",
    piTag: "AR.DCS.AI1208_AVG.PV"
  },
  {
    id: "whb_steam_duty",
    name: "Waste Heat Boiler Heat Recovery Duty",
    category: "Heat Recovery",
    type: "Calculated",
    formula: "WHB_Steam_Flow * (H_Steam_Sat - H_BFW_In)",
    uom: "MW",
    baseline: "41.5",
    limits: "38.0 - 45.0",
    piTag: "AR.DCS.CALC_WHB_DUTY.PV",
    requiredEquipment: ["waste_heat_boiler"]
  },
  {
    id: "fouling_ratio_preheater",
    name: "Feed Gas Preheater Fouling Factor",
    category: "Heat Exchangers",
    type: "Calculated",
    formula: "U_Actual_Heat_Transfer / U_Clean_Baseline",
    uom: "[-]",
    baseline: "0.94",
    limits: "0.80 - 1.05",
    piTag: "AR.DCS.CALC_HX_FOUL.PV",
    requiredEquipment: ["feed_preheater"]
  },
  {
    id: "specific_consumption",
    name: "Specific Gas Consumption per Ton MeOH",
    category: "Economic KPI",
    type: "Calculated",
    formula: "Total_NG_Feed_LHV / Daily_Methanol_Production",
    uom: "GJ/t",
    baseline: "29.85",
    limits: "28.50 - 31.00",
    piTag: "AR.DCS.CALC_SP_CONS.PV"
  }
];

interface DefineKpisStepProps {
  equipmentList: EquipmentConfig[];
  kpis: KpiDefinition[];
  onUpdateKpiType: (id: string, type: "Calculated" | "PI Tag") => void;
  onUpdateKpiTag: (id: string, piTag: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export const DefineKpisStep: React.FC<DefineKpisStepProps> = ({
  equipmentList,
  kpis,
  onUpdateKpiType,
  onUpdateKpiTag,
  onBack,
  onNext
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const equipmentMap = equipmentList.reduce<Record<string, boolean>>((acc, eq) => {
    acc[eq.id] = eq.enabled;
    return acc;
  }, {});

  // Filter KPIs based on active equipment and search query
  const filteredKpis = kpis.filter(kpi => {
    if (kpi.requiredEquipment) {
      const isMissingRequired = kpi.requiredEquipment.some(reqId => equipmentMap[reqId] === false);
      if (isMissingRequired) return false;
    }
    if (selectedCategory !== "all" && kpi.category !== selectedCategory) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        kpi.name.toLowerCase().includes(q) ||
        kpi.category.toLowerCase().includes(q) ||
        (kpi.piTag || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = ["all", ...Array.from(new Set(kpis.map(k => k.category)))];
  const calculatedCount = filteredKpis.filter(k => k.type === "Calculated").length;
  const directTagCount = filteredKpis.filter(k => k.type === "PI Tag").length;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden select-none text-slate-800">
      {/* Top Banner */}
      <div className="bg-[#0090d0] px-5 py-3 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Step 2: Define Mandatory &amp; Advisory KPIs
            </h2>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
              {filteredKpis.length} Active KPIs
            </span>
          </div>
          <p className="text-[11px] text-sky-100 mt-0.5">
            Configure computation mode for each reformer KPI. Select Calculated (Mass & Energy Balance / First Principles) or Direct DCS PI Tag.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-lg border border-white/20 text-white">
            <Calculator className="w-3.5 h-3.5" />
            <span>Calculated: <strong>{calculatedCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-lg border border-white/20 text-white">
            <Sliders className="w-3.5 h-3.5" />
            <span>Direct DCS: <strong>{directTagCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 uppercase">Category:</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 outline-none focus:border-[#0090d0]"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search KPI name or tag..."
            className="w-full text-xs pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-md outline-none focus:border-[#0090d0] text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      {/* KPI Table View */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="pb-2.5 pt-2 px-3">KPI Name &amp; Category</th>
              <th className="pb-2.5 pt-2 px-3 text-center">Engineering Unit</th>
              <th className="pb-2.5 pt-2 px-3 text-center">Design Baseline</th>
              <th className="pb-2.5 pt-2 px-3 text-center">Normal Limits</th>
              <th className="pb-2.5 pt-2 px-3">Calculation Mode</th>
              <th className="pb-2.5 pt-2 px-3">Formula Expression / Mapped DCS Tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredKpis.map((kpi) => {
              const isCalc = kpi.type === "Calculated";

              return (
                <tr key={kpi.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* KPI Name */}
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 leading-snug">
                      {kpi.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {kpi.category}
                    </div>
                  </td>

                  {/* UOM */}
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {kpi.uom}
                    </span>
                  </td>

                  {/* Baseline */}
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-800">
                    {kpi.baseline}
                  </td>

                  {/* Limits */}
                  <td className="py-2.5 px-3 text-center font-mono text-[10.5px] text-slate-500">
                    {kpi.limits}
                  </td>

                  {/* Mode Selector */}
                  <td className="py-2.5 px-3">
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => onUpdateKpiType(kpi.id, "Calculated")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          isCalc
                            ? "bg-[#0090d0] text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Calculated
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateKpiType(kpi.id, "PI Tag")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          !isCalc
                            ? "bg-[#0090d0] text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        PI Tag
                      </button>
                    </div>
                  </td>

                  {/* Formula or DCS Tag Input */}
                  <td className="py-2.5 px-3">
                    {isCalc ? (
                      <div 
                        className="font-mono text-[10px] text-[#0369a1] bg-sky-50 border border-sky-100 rounded px-2 py-1 truncate max-w-sm"
                        title={kpi.formula}
                      >
                        {kpi.formula}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={kpi.piTag || ""}
                        onChange={e => onUpdateKpiTag(kpi.id, e.target.value)}
                        placeholder="AR.DCS.TAG_PATH.PV"
                        className="font-mono text-[10.5px] px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 outline-none focus:border-[#0090d0] w-full max-w-xs"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Step Navigation */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back: Equipment Configuration</span>
        </button>

        <div className="text-[10px] text-slate-400 font-medium">
          Step 2 of 4 • {filteredKpis.length} KPIs configured
        </div>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2 rounded-lg bg-[#0090d0] hover:bg-[#0080ba] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          <span>Next: RAW POI Tags Required</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
