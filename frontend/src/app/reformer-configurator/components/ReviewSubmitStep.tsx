"use client";

import React from "react";
import { 
  ArrowLeft, 
  Check, 
  CheckCircle2, 
  SlidersHorizontal, 
  Activity, 
  Cpu, 
  Zap, 
  Database,
  Flame,
  Layers,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { EquipmentConfig } from "./EquipmentQuestionnaire";
import { KpiDefinition } from "./DefineKpisStep";
import { RawTagItem } from "./TagMappingStep";

interface ReviewSubmitStepProps {
  equipmentList: EquipmentConfig[];
  kpis: KpiDefinition[];
  tagMappings: Record<string, RawTagItem>;
  onBack: () => void;
  onSubmit: () => void;
}

export const ReviewSubmitStep: React.FC<ReviewSubmitStepProps> = ({
  equipmentList,
  kpis,
  tagMappings,
  onBack,
  onSubmit
}) => {
  const activeEquipment = equipmentList.filter(e => e.enabled);
  const totalTags = Object.values(tagMappings);
  const mappedTags = totalTags.filter(t => t.piTag.trim().length > 0);
  const calculatedKpis = kpis.filter(k => k.type === "Calculated");
  const directKpis = kpis.filter(k => k.type === "PI Tag");

  // Filter exchangers to show configuration summary
  const exchangers = activeEquipment.filter(e => 
    e.id.includes("preheater") || e.id.includes("cooler") || e.id.includes("exchanger")
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden select-none text-slate-800">
      {/* Top Banner */}
      <div className="bg-[#0090d0] px-5 py-3 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Step 4: Review Configuration &amp; Model Deployment
            </h2>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white border border-white/30">
              Ready for Live LBM
            </span>
          </div>
          <p className="text-[11px] text-sky-100 mt-0.5">
            Audit your equipment hierarchy, active KPIs, and DCS sensor mappings before activating the Live Benchmarking Model (LBM).
          </p>
        </div>
      </div>

      {/* Main Review Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* Top Summary Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Active Equipment</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-800">{activeEquipment.length}</span>
              <span className="text-xs text-slate-500">/ {equipmentList.length} Units</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Flowsheet reconciled</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Active KPIs</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-[#0090d0]">{kpis.length}</span>
              <span className="text-xs text-slate-500">Monitored</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 font-medium">
              {calculatedKpis.length} M&E Calc • {directKpis.length} Direct PI
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">DCS PI Sensors</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600">{mappedTags.length}</span>
              <span className="text-xs text-slate-500">/ {totalTags.length} Mapped</span>
            </div>
            <div className="mt-2 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>100% Sensor Coverage</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/50 flex flex-col justify-between">
            <span className="text-[10.5px] font-bold text-[#0090d0] uppercase tracking-wider">Target LBM Mode</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-black text-slate-800">Reformer LBM</span>
            </div>
            <div className="mt-2 text-[10px] text-sky-700 font-semibold">
              Live Benchmarking &amp; Closed-Loop AI
            </div>
          </div>
        </div>

        {/* Two-Column Audit Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Equipment Topology & Heat Exchanger Configurations */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Layers className="w-3.5 h-3.5 text-[#0090d0]" />
                <span>Heat Exchangers &amp; Equipment Topology</span>
              </h3>

              <div className="space-y-2">
                {exchangers.map(ex => (
                  <div key={ex.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{ex.name}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {ex.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-sky-100 text-[#0090d0] font-bold text-[10px]">
                        {ex.numExchangers || 2} Shells
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[10px]">
                        {ex.arrangement || "Series"}
                      </span>
                    </div>
                  </div>
                ))}

                {/* SMR Furnace Summary */}
                <div className="p-2.5 rounded-lg border border-sky-200 bg-sky-50/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">Primary Reformer (SMR) Radiant Box</span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      480 Catalyst Tubes • Top-Fired Radiant Furnace Box
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-[#0090d0] text-white font-bold text-[10px]">
                    856°C Arch Exit
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic KPIs & Mapped Sensor Verification */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                <span>Active DCS Sensor Mappings ({mappedTags.length})</span>
              </h3>

              <div className="max-h-64 overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg divide-y divide-slate-100 bg-slate-50">
                {mappedTags.slice(0, 8).map(tag => (
                  <div key={tag.id} className="p-2 flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-bold text-slate-800 truncate">{tag.name}</div>
                      <div className="font-mono text-[9.5px] text-slate-400 truncate">{tag.piTag}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-[10.5px] font-bold text-slate-700">{tag.design} {tag.uom}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Model Ready for Deployment</span>
                  <p className="text-[10.5px] text-emerald-700 mt-0.5">
                    Clicking &quot;Submit Configuration&quot; saves this topology and transitions immediately into the Live Benchmarking Model (LBM) dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Step Navigation */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back: RAW POI Tags</span>
        </button>

        <button
          type="button"
          onClick={onSubmit}
          className="px-6 py-2.5 rounded-lg bg-[#0090d0] hover:bg-[#0080ba] text-white font-black text-xs flex items-center gap-2 shadow-md shadow-sky-500/20 transition-all cursor-pointer hover:scale-[1.01]"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Submit Configuration &amp; Move to Live LBM Mode</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
