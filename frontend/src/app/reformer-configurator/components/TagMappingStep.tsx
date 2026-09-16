"use client";

import React, { useState } from "react";
import { 
  ArrowLeft, 
  ArrowRight, 
  Search, 
  Database, 
  Sparkles, 
  Check, 
  Filter, 
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { EquipmentConfig } from "./EquipmentQuestionnaire";

export interface RawTagItem {
  id: string;
  name: string;
  description: string;
  category: string;
  piTag: string;
  design: string;
  min: string;
  max: string;
  def: string;
  uom: string;
  requiredEquipment?: string[];
}

export const DEFAULT_RAW_TAGS: RawTagItem[] = [
  {
    id: "feed_ng_flow",
    name: "Natural Gas Feed Flow Rate",
    description: "Orifice mass flow of pipeline natural gas to reformer.",
    category: "Feed & Fuel",
    piTag: "FT_1201_PV",
    design: "124.0",
    min: "70.0",
    max: "150.0",
    def: "124.0",
    uom: "t/h",
    requiredEquipment: ["feed_ko_drum"]
  },
  {
    id: "feed_ng_pressure",
    name: "Feed Gas Header Pressure",
    description: "Pressure at battery limit inlet before preheater.",
    category: "Feed & Fuel",
    piTag: "PT_1201_PV",
    design: "24.5",
    min: "20.0",
    max: "30.0",
    def: "24.5",
    uom: "bar",
    requiredEquipment: ["feed_preheater"]
  },
  {
    id: "feed_ng_temp",
    name: "Feed Gas Preheater Outlet Temperature",
    description: "Temperature of raw gas leaving preheater exchangers.",
    category: "Feed & Fuel",
    piTag: "TT_1202_PV",
    design: "85.0",
    min: "40.0",
    max: "110.0",
    def: "85.0",
    uom: "°C",
    requiredEquipment: ["feed_preheater"]
  },
  {
    id: "compressor_discharge_press",
    name: "Feed Compressor Discharge Pressure",
    description: "Discharge pressure from natural gas booster compressor.",
    category: "Compression",
    piTag: "PT_1204_PV",
    design: "42.0",
    min: "36.0",
    max: "46.0",
    def: "42.0",
    uom: "bar",
    requiredEquipment: ["feed_compressor"]
  },
  {
    id: "hds_bed_temp",
    name: "HDS Hydrotreating Bed Temperature",
    description: "Hydrogenation reactor catalyst bed operating temperature.",
    category: "Desulfurization",
    piTag: "TI_1208_PV",
    design: "375.0",
    min: "340.0",
    max: "400.0",
    def: "375.0",
    uom: "°C",
    requiredEquipment: ["hds_reactor"]
  },
  {
    id: "zno_outlet_sulfur",
    name: "Desulfurized Gas Sulfur Concentration",
    description: "Online micro-coulometric sulfur analyzer reading.",
    category: "Desulfurization",
    piTag: "AI_1201_PV",
    design: "0.02",
    min: "0.00",
    max: "0.05",
    def: "0.02",
    uom: "ppm",
    requiredEquipment: ["zno_adsorbers"]
  },
  {
    id: "saturator_water_circ_flow",
    name: "Saturator Water Circulation Flow",
    description: "Mass flow rate of circulation wash water to saturator column.",
    category: "Saturation",
    piTag: "FT_1209_PV",
    design: "185.0",
    min: "120.0",
    max: "220.0",
    def: "185.0",
    uom: "t/h",
    requiredEquipment: ["saturator_column"]
  },
  {
    id: "steam_trim_flow",
    name: "Trim Process Steam Injection Flow",
    description: "Mass flow rate of high-pressure trim steam to mixer.",
    category: "Saturation",
    piTag: "FT_1215_PV",
    design: "95.0",
    min: "50.0",
    max: "130.0",
    def: "95.0",
    uom: "t/h",
    requiredEquipment: ["steam_mixer"]
  },
  {
    id: "smr_arch_exit_temp",
    name: "SMR Radiant Box Arch Exit Temperature",
    description: "Multi-point pyrometer average at furnace arch ceiling.",
    category: "Reformer Furnace",
    piTag: "TI_1227_PV",
    design: "856.0",
    min: "820.0",
    max: "880.0",
    def: "856.0",
    uom: "°C",
    requiredEquipment: ["smr_radiant_box"]
  },
  {
    id: "smr_tube_skin_temp_peak",
    name: "Catalyst Tube Skin Temperature (Peak)",
    description: "Peak infrared scanner pyrometer reading across 480 tubes.",
    category: "Reformer Furnace",
    piTag: "TIS_1230_PV",
    design: "925.0",
    min: "880.0",
    max: "950.0",
    def: "925.0",
    uom: "°C",
    requiredEquipment: ["smr_radiant_box"]
  },
  {
    id: "bridgewall_draft_press",
    name: "Bridgewall Draft Differential Pressure",
    description: "Static draft pressure below convection section entrance.",
    category: "Reformer Furnace",
    piTag: "PDI_1212_PV",
    design: "-12.5",
    min: "-25.0",
    max: "-5.0",
    def: "-12.5",
    uom: "mmH2O",
    requiredEquipment: ["smr_radiant_box"]
  },
  {
    id: "flue_gas_o2_content",
    name: "Flue Gas Oxygen Analyzer",
    category: "Convection",
    description: "Excess O2 measured at convection section inlet.",
    piTag: "AI_1208_PV",
    design: "1.80",
    min: "1.20",
    max: "2.50",
    def: "1.80",
    uom: "vol%",
    requiredEquipment: ["flue_stack"]
  },
  {
    id: "whb_steam_drum_press",
    name: "HP Steam Drum Saturated Steam Pressure",
    category: "Cooling & Steam",
    description: "Drum pressure generated from reformed syngas rapid quench.",
    piTag: "PT_1245_PV",
    design: "105.0",
    min: "95.0",
    max: "115.0",
    def: "105.0",
    uom: "bar",
    requiredEquipment: ["waste_heat_boiler", "steam_drum"]
  },
  {
    id: "syngas_separator_outlet_temp",
    name: "Reformed Syngas Process Cooler Outlet Temp",
    category: "Cooling & Steam",
    description: "Temperature entering syngas knockout separator drum.",
    piTag: "TT_1250_PV",
    design: "38.0",
    min: "28.0",
    max: "50.0",
    def: "38.0",
    uom: "°C",
    requiredEquipment: ["syngas_cooler"]
  }
];

interface TagMappingStepProps {
  equipmentList: EquipmentConfig[];
  tagMappings: Record<string, RawTagItem>;
  onUpdateTagField: (tagId: string, field: keyof RawTagItem, value: string) => void;
  onAutoFillTags: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const TagMappingStep: React.FC<TagMappingStepProps> = ({
  equipmentList,
  tagMappings,
  onUpdateTagField,
  onAutoFillTags,
  onBack,
  onNext
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const equipmentMap = equipmentList.reduce<Record<string, boolean>>((acc, eq) => {
    acc[eq.id] = eq.enabled;
    return acc;
  }, {});

  const tagList = Object.values(tagMappings);

  // Filter tags based on active equipment and search
  const filteredTags = tagList.filter(tag => {
    if (tag.requiredEquipment) {
      const isMissing = tag.requiredEquipment.some(reqId => equipmentMap[reqId] === false);
      if (isMissing) return false;
    }
    if (categoryFilter !== "all" && tag.category !== categoryFilter) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        tag.name.toLowerCase().includes(q) ||
        tag.piTag.toLowerCase().includes(q) ||
        tag.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = ["all", ...Array.from(new Set(tagList.map(t => t.category)))];
  const mappedCount = filteredTags.filter(t => t.piTag.trim().length > 0).length;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden select-none text-slate-800">
      {/* Top Banner */}
      <div className="bg-[#0090d0] px-5 py-3 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Step 3: RAW POI Tags Required (DCS Sensor Mapping)
            </h2>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
              {filteredTags.length} Sensors Active
            </span>
          </div>
          <p className="text-[11px] text-sky-100 mt-0.5">
            Map plant DCS and OSIsoft PI historian tags to required live calculation parameters. Design bounds establish Mass & Energy Balance reconciliation tolerances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAutoFillTags}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#0090d0] text-xs font-bold hover:bg-sky-50 transition-all shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0090d0]" />
            <span>Auto-fill Standard DCS Paths</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 uppercase">Process Area:</span>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-700 outline-none focus:border-[#0090d0]"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                {c === "all" ? "All Process Areas" : c}
              </option>
            ))}
          </select>

          <span className="text-[11px] text-slate-400 ml-2">
            Mapped: <strong className="text-slate-700">{mappedCount}/{filteredTags.length}</strong>
          </span>
        </div>

        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sensor description or DCS tag..."
            className="w-full text-xs pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-md outline-none focus:border-[#0090d0] text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Sensor Mapping Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="pb-2.5 pt-2 px-3">Parameter Name &amp; Sensor Role</th>
              <th className="pb-2.5 pt-2 px-3">DCS / PI Tag Path</th>
              <th className="pb-2.5 pt-2 px-3 text-center">Design</th>
              <th className="pb-2.5 pt-2 px-3 text-center">Min</th>
              <th className="pb-2.5 pt-2 px-3 text-center">Max</th>
              <th className="pb-2.5 pt-2 px-3 text-center">UOM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredTags.map((tag) => (
              <tr key={tag.id} className="hover:bg-slate-50/70 transition-colors">
                {/* Parameter Details */}
                <td className="py-2.5 px-3 max-w-xs">
                  <div className="font-bold text-slate-900 leading-snug">
                    {tag.name}
                  </div>
                  <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {tag.description}
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-0.2">
                    Area: <span className="font-medium text-slate-600">{tag.category}</span>
                  </div>
                </td>

                {/* DCS Tag Path Input */}
                <td className="py-2.5 px-3">
                  <input
                    type="text"
                    value={tag.piTag}
                    onChange={e => onUpdateTagField(tag.id, "piTag", e.target.value)}
                    placeholder="Enter DCS tag path..."
                    className="w-full font-mono text-[10.5px] px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-800 outline-none focus:border-[#0090d0] focus:ring-1 focus:ring-sky-200"
                  />
                </td>

                {/* Design Value */}
                <td className="py-2.5 px-2 text-center">
                  <input
                    type="text"
                    value={tag.design}
                    onChange={e => onUpdateTagField(tag.id, "design", e.target.value)}
                    className="w-16 text-center font-mono text-[10.5px] py-1 rounded bg-white border border-slate-200 text-slate-800 outline-none focus:border-[#0090d0]"
                  />
                </td>

                {/* Min Limit */}
                <td className="py-2.5 px-2 text-center">
                  <input
                    type="text"
                    value={tag.min}
                    onChange={e => onUpdateTagField(tag.id, "min", e.target.value)}
                    className="w-16 text-center font-mono text-[10.5px] py-1 rounded bg-white border border-slate-200 text-slate-500 outline-none focus:border-[#0090d0]"
                  />
                </td>

                {/* Max Limit */}
                <td className="py-2.5 px-2 text-center">
                  <input
                    type="text"
                    value={tag.max}
                    onChange={e => onUpdateTagField(tag.id, "max", e.target.value)}
                    className="w-16 text-center font-mono text-[10.5px] py-1 rounded bg-white border border-slate-200 text-slate-500 outline-none focus:border-[#0090d0]"
                  />
                </td>

                {/* Engineering UOM */}
                <td className="py-2.5 px-2 text-center">
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                    {tag.uom}
                  </span>
                </td>
              </tr>
            ))}
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
          <span>Back: Define KPIs</span>
        </button>

        <div className="text-[10px] text-slate-400 font-medium">
          Step 3 of 4 • {mappedCount} of {filteredTags.length} DCS tags configured
        </div>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2 rounded-lg bg-[#0090d0] hover:bg-[#0080ba] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          <span>Next: Review &amp; Submit</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
