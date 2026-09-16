"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  EquipmentQuestionnaire, 
  EquipmentConfig, 
  INITIAL_EQUIPMENT,
  ZONE_TABS
} from "./components/EquipmentQuestionnaire";
import { ReformerPfdCanvas } from "./components/ReformerPfdCanvas";
import { 
  DefineKpisStep, 
  DEFAULT_KPIS, 
  KpiDefinition 
} from "./components/DefineKpisStep";
import { 
  TagMappingStep, 
  DEFAULT_RAW_TAGS, 
  RawTagItem 
} from "./components/TagMappingStep";
import { ReviewSubmitStep } from "./components/ReviewSubmitStep";
import { LiveLbmDashboard } from "./components/LiveLbmDashboard";
import { SynthesisLbmDashboard } from "./components/SynthesisLbmDashboard";
import { 
  Activity, 
  CheckCircle2, 
  ChevronRight,
  ChevronDown,
  Sparkles,
  Layers,
  Cpu,
  Database,
  SlidersHorizontal,
  TrendingUp,
  Mail,
  Star,
  Sun,
  Tv,
  FileSpreadsheet,
  Camera
} from "lucide-react";

export default function ReformerConfiguratorPage() {
  // Plant Unit State: "reformer" | "synthesis"
  const [activePlantUnit, setActivePlantUnit] = useState<"reformer" | "synthesis">("reformer");
  const [isPlantDropdownOpen, setIsPlantDropdownOpen] = useState<boolean>(false);

  // Step State: 1 = Equipment & PFD, 2 = Define KPIs, 3 = RAW POI Tags, 4 = Review & Submit, 5 = Live LBM Mode
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Configuration States
  const [equipmentList, setEquipmentList] = useState<EquipmentConfig[]>(INITIAL_EQUIPMENT);
  const [activeTab, setActiveTab] = useState<string>("feed");
  const [sectionTrigger, setSectionTrigger] = useState<number>(0);
  const [kpiList, setKpiList] = useState<KpiDefinition[]>(DEFAULT_KPIS);
  const [tagMappings, setTagMappings] = useState<Record<string, RawTagItem>>(() => {
    return DEFAULT_RAW_TAGS.reduce((acc, tag) => {
      acc[tag.id] = tag;
      return acc;
    }, {} as Record<string, RawTagItem>);
  });

  const handleSelectSection = (key: string) => {
    setActiveTab(key);
    setSectionTrigger(prev => prev + 1);
  };

  // Derive equipment map { [id]: boolean }
  const equipmentMap = equipmentList.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.id] = item.enabled;
    return acc;
  }, {});

  // Derive full equipment config map with sub-options
  const equipmentConfigMap = equipmentList.reduce<Record<string, EquipmentConfig>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  // Toggle individual unit
  const handleToggle = (id: string, enabled: boolean) => {
    setEquipmentList(prev =>
      prev.map(eq => (eq.id === id ? { ...eq, enabled } : eq))
    );
  };

  // Update sub-options (e.g. numExchangers, arrangement, stages, driverType)
  const handleUpdateSubOption = (id: string, field: string, value: any) => {
    setEquipmentList(prev =>
      prev.map(eq => (eq.id === id ? { ...eq, [field]: value } : eq))
    );
  };

  // Update custom equipment name
  const handleUpdateEquipmentName = (id: string, newName: string) => {
    setEquipmentList(prev =>
      prev.map(eq => (eq.id === id ? { ...eq, name: newName } : eq))
    );
  };

  // Update equipment process stream or description
  const handleUpdateEquipmentDesc = (id: string, newDesc: string) => {
    setEquipmentList(prev =>
      prev.map(eq => (eq.id === id ? { ...eq, processStream: newDesc, description: newDesc } : eq))
    );
  };

  // Add custom equipment (e.g. 5th, 6th convection coil)
  const handleAddEquipment = (newEq: EquipmentConfig) => {
    setEquipmentList(prev => [...prev, newEq]);
  };

  // Delete custom equipment
  const handleDeleteEquipment = (id: string) => {
    setEquipmentList(prev => prev.filter(eq => eq.id !== id));
  };

  // Reset to default
  const handleReset = () => {
    setEquipmentList(INITIAL_EQUIPMENT);
  };

  // Select all equipment
  const handleSelectAll = () => {
    setEquipmentList(prev => prev.map(eq => ({ ...eq, enabled: true })));
  };

  // Minimal core selection (only required units)
  const handleDeselectNonRequired = () => {
    setEquipmentList(prev =>
      prev.map(eq => ({ ...eq, enabled: Boolean(eq.required) }))
    );
  };

  // Step 2 KPI updates
  const handleUpdateKpiType = (id: string, type: "Calculated" | "PI Tag") => {
    setKpiList(prev => prev.map(k => (k.id === id ? { ...k, type } : k)));
  };

  const handleUpdateKpiTag = (id: string, piTag: string) => {
    setKpiList(prev => prev.map(k => (k.id === id ? { ...k, piTag } : k)));
  };

  // Step 3 Tag updates
  const handleUpdateTagField = (tagId: string, field: keyof RawTagItem, value: string) => {
    setTagMappings(prev => ({
      ...prev,
      [tagId]: {
        ...prev[tagId],
        [field]: value
      }
    }));
  };

  const handleAutoFillTags = () => {
    setTagMappings(() => {
      return DEFAULT_RAW_TAGS.reduce((acc, tag) => {
        acc[tag.id] = { ...tag };
        return acc;
      }, {} as Record<string, RawTagItem>);
    });
  };

  const activeCount = equipmentList.filter(e => e.enabled).length;
  const totalCount = equipmentList.length;

  const WIZARD_STEPS = [
    { num: 1, label: "Equipment Config & PFD", icon: Layers },
    { num: 2, label: `Define KPIs (${kpiList.length})`, icon: Cpu },
    { num: 3, label: "RAW POI Tags Required", icon: Database },
    { num: 4, label: "Review & Submit", icon: SlidersHorizontal },
    { num: 5, label: "Live LBM Mode", icon: TrendingUp }
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans select-none">
      {/* Top Application Bar with Breadcrumbs and Dropdown */}
      <header className="h-12 border-b border-slate-200 bg-white px-3 sm:px-4 flex items-center justify-between z-30 shrink-0 shadow-2xs">
        {/* Left: Logo and Breadcrumb Selector */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <img 
            src="/ingenero_360_ai_logo.png" 
            alt="Ingenero 360 AI" 
            className="h-7 w-auto object-contain"
          />

          <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

          {/* Breadcrumb Pills matching Enterprise Reference */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/90 font-bold uppercase tracking-wider text-[9.5px]">
              GLOBAL
            </span>
            <span className="text-slate-400 font-bold text-[10px]">&gt;</span>

            <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200 font-bold text-[10px] flex items-center gap-1">
              SITE-A <ChevronDown className="w-3 h-3 text-slate-400" />
            </span>
            <span className="text-slate-400 font-bold text-[10px]">&gt;</span>

            <span className="px-2 py-0.5 rounded bg-sky-50 text-[#0090d0] border border-sky-200 font-bold text-[10px] flex items-center gap-1">
              Methanol <ChevronDown className="w-3 h-3 text-[#0090d0]" />
            </span>
            <span className="text-slate-400 font-bold text-[10px]">&gt;</span>

            {/* Plant Unit Dropdown Selector (Reformer vs Synthesis) */}
            <div className="relative">
              <button
                type="button"
                id="unit-selector-dropdown-btn"
                onClick={() => setIsPlantDropdownOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider border shadow-xs transition-all cursor-pointer ${
                  activePlantUnit === "reformer"
                    ? "bg-[#0090d0] text-white border-[#0090d0] hover:bg-[#0080ba]"
                    : "bg-[#0284c7] text-white border-[#0284c7] hover:bg-[#0369a1]"
                }`}
              >
                <span>{activePlantUnit === "reformer" ? "REFORMER" : "SYNTHESIS"}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isPlantDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isPlantDropdownOpen && (
                <div 
                  className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1"
                  onMouseLeave={() => setIsPlantDropdownOpen(false)}
                >
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Select Plant Process Unit
                  </div>
                  <button
                    type="button"
                    id="select-unit-reformer"
                    onClick={() => {
                      setActivePlantUnit("reformer");
                      setIsPlantDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-sky-50 transition-colors ${
                      activePlantUnit === "reformer" ? "bg-sky-50 font-bold text-[#0090d0]" : "text-slate-700"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-800">Reformer</span>
                      <span className="text-[10px] text-slate-500 font-normal">Steam Methane Reforming & Flue Gas</span>
                    </div>
                    {activePlantUnit === "reformer" && <CheckCircle2 className="w-4 h-4 text-[#0090d0]" />}
                  </button>
                  <button
                    type="button"
                    id="select-unit-synthesis"
                    onClick={() => {
                      setActivePlantUnit("synthesis");
                      setIsPlantDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-sky-50 transition-colors ${
                      activePlantUnit === "synthesis" ? "bg-sky-50 font-bold text-[#0090d0]" : "text-slate-700"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-800">Synthesis</span>
                      <span className="text-[10px] text-slate-500 font-normal">Methanol Synthesis &amp; Reaction Loop</span>
                    </div>
                    {activePlantUnit === "synthesis" && <CheckCircle2 className="w-4 h-4 text-[#0090d0]" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Global Progress Stepper Header (When in Reformer) OR Synthesis Telemetry Tag (When in Synthesis) */}
        {activePlantUnit === "reformer" ? (
          <div className="hidden xl:flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-2xs gap-1">
            {WIZARD_STEPS.map((s) => {
              const isCurrent = currentStep === s.num;
              const isCompleted = currentStep > s.num;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    setCurrentStep(s.num);
                  }}
                  className={`
                    flex items-center gap-2 px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border whitespace-nowrap
                    ${isCurrent
                      ? "bg-[#0090d0] text-white border-[#0090d0] shadow-xs"
                      : isCompleted
                        ? "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50 shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
                    }
                  `}
                >
                  <span className={`
                    w-4.5 h-4.5 rounded-xs flex items-center justify-center text-[10px] font-black
                    ${isCurrent 
                      ? "bg-white text-[#0090d0]" 
                      : isCompleted 
                        ? "bg-emerald-500 text-white" 
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }
                  `}>
                    {isCompleted ? "✓" : s.num}
                  </span>
                  <span className="tracking-tight">{s.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2">
            <span className="px-3 py-1 rounded-md bg-sky-50 border border-sky-200 text-[#0090d0] font-bold text-xs flex items-center gap-1.5 shadow-2xs">
              <Activity className="w-3.5 h-3.5 animate-pulse text-[#0090d0]" />
              Synthesis Section (Converter Loop &amp; Purge System) Live LBM Active
            </span>
          </div>
        )}

        {/* Right: Status Badges, Step Trigger & Utility Icons */}
        <div className="flex items-center gap-2 shrink-0">
          {activePlantUnit === "reformer" ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[10px] shadow-2xs">
                <span className="text-slate-500 font-medium">PFD:</span>
                <span className="font-bold font-mono text-[#0090d0]">{activeCount}/{totalCount} Active</span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold shadow-2xs">
                <Activity className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
                <span>M&amp;E Reconciled</span>
              </div>

              {currentStep === 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0090d0] hover:bg-[#0080ba] text-white text-[11px] font-bold shadow-xs transition-all cursor-pointer hover:shadow-sm border border-[#0090d0]"
                  title="Proceed to Define Mandatory KPIs"
                >
                  <span>Next: Define KPIs ({kpiList.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-700 font-semibold shadow-2xs">
              <Activity className="w-2.5 h-2.5 animate-pulse text-emerald-600" />
              <span>ODS Optimal State Reconciled</span>
            </div>
          )}

          {/* Utility Icon Group matching reference design */}
          <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-500">
            <button className="p-1 rounded hover:bg-white hover:text-slate-800 transition-colors" title="Notifications / System Logs">
              <Mail className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-white hover:text-slate-800 transition-colors" title="Favorites">
              <Star className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-white hover:text-slate-800 transition-colors" title="Toggle Theme">
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-white hover:text-slate-800 transition-colors" title="Display Screen View">
              <Tv className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-white hover:text-slate-800 transition-colors" title="Export Data Sheet">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
            <button className="p-1 rounded hover:bg-white hover:text-slate-800 transition-colors" title="Capture Snapshot">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area per Step */}
      <div className="flex-1 flex flex-col p-3 overflow-hidden max-w-[1900px] w-full mx-auto">
        {activePlantUnit === "synthesis" ? (
          <div className="flex-1 h-full min-h-0 overflow-hidden">
            <SynthesisLbmDashboard
              onReconfigureTopology={() => {
                setActivePlantUnit("reformer");
                setCurrentStep(1);
              }}
            />
          </div>
        ) : (
          <>
            {/* STEP 1: USER / EQUIPMENT CONFIGURATION & LIVE PFD */}
            {currentStep === 1 && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Top Unified Rectangular Section Navigation Box */}
                <div className="bg-white border border-slate-200 rounded-lg p-1 mb-2.5 shadow-2xs flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0">
                  {ZONE_TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const zoneItems = equipmentList.filter(e => e.category === tab.key);
                    const activeInZone = zoneItems.filter(e => e.enabled).length;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleSelectSection(tab.key)}
                        className={`
                          flex-1 min-w-[155px] flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap border
                          ${isActive 
                            ? "bg-[#0090d0] text-white border-[#0090d0] shadow-xs" 
                            : "bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200/80 hover:border-slate-300"
                          }
                        `}
                      >
                        {/* Number Box & Section Name */}
                        <div className="flex items-center gap-2">
                          <span 
                            className={`
                              w-4.5 h-4.5 rounded-xs text-[10px] font-black flex items-center justify-center
                              ${isActive 
                                ? "bg-white text-[#0090d0]" 
                                : "bg-white text-slate-700 border border-slate-200 shadow-2xs"
                              }
                            `}
                          >
                            {tab.num}
                          </span>
                          <span className="tracking-tight">{tab.label}</span>
                        </div>

                        {/* Active Count Badge */}
                        <span 
                          className={`
                            text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-xs border
                            ${isActive 
                              ? "bg-white/20 text-white border-white/30" 
                              : "bg-white text-slate-500 border-slate-200 shadow-2xs"
                            }
                          `}
                        >
                          {activeInZone}/{zoneItems.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 2-Column Split (Left: Questionnaire with sub-questions, Right: Scaled PFD) */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
                  {/* Left Column: Form Questionnaire (5 cols) */}
                  <div className="lg:col-span-5 h-full overflow-hidden">
                    <EquipmentQuestionnaire
                      equipment={equipmentList}
                      activeTab={activeTab}
                      onSelectTab={handleSelectSection}
                      onToggle={handleToggle}
                      onUpdateSubOption={handleUpdateSubOption}
                      onUpdateName={handleUpdateEquipmentName}
                      onUpdateDescription={handleUpdateEquipmentDesc}
                      onAddEquipment={handleAddEquipment}
                      onDeleteEquipment={handleDeleteEquipment}
                      onReset={handleReset}
                      onSelectAll={handleSelectAll}
                      onDeselectNonRequired={handleDeselectNonRequired}
                      onNextStep={() => setCurrentStep(2)}
                      activeKpiCount={kpiList.length}
                    />
                  </div>

                  {/* Right Column: Process Flow Preview (7 cols) */}
                  <div className="lg:col-span-7 h-full overflow-hidden">
                    <ReformerPfdCanvas 
                      equipmentMap={equipmentMap} 
                      equipmentConfigMap={equipmentConfigMap}
                      activeSection={activeTab}
                      sectionSelectTrigger={sectionTrigger}
                      onSelectSection={handleSelectSection}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: DEFINE MANDATORY & ADVISORY KPIS */}
            {currentStep === 2 && (
              <div className="flex-1 h-full min-h-0 overflow-hidden">
                <DefineKpisStep
                  equipmentList={equipmentList}
                  kpis={kpiList}
                  onUpdateKpiType={handleUpdateKpiType}
                  onUpdateKpiTag={handleUpdateKpiTag}
                  onBack={() => setCurrentStep(1)}
                  onNext={() => setCurrentStep(3)}
                />
              </div>
            )}

            {/* STEP 3: RAW POI TAGS REQUIRED (DCS TAG MAPPING) */}
            {currentStep === 3 && (
              <div className="flex-1 h-full min-h-0 overflow-hidden">
                <TagMappingStep
                  equipmentList={equipmentList}
                  tagMappings={tagMappings}
                  onUpdateTagField={handleUpdateTagField}
                  onAutoFillTags={handleAutoFillTags}
                  onBack={() => setCurrentStep(2)}
                  onNext={() => setCurrentStep(4)}
                />
              </div>
            )}

            {/* STEP 4: REVIEW AND SUBMIT */}
            {currentStep === 4 && (
              <div className="flex-1 h-full min-h-0 overflow-hidden">
                <ReviewSubmitStep
                  equipmentList={equipmentList}
                  kpis={kpiList}
                  tagMappings={tagMappings}
                  onBack={() => setCurrentStep(3)}
                  onSubmit={() => setCurrentStep(5)}
                />
              </div>
            )}

            {/* STEP 5: LIVE LBM MODE (LIVE BENCHMARKING MODEL) */}
            {currentStep === 5 && (
              <div className="flex-1 h-full min-h-0 overflow-hidden">
                <LiveLbmDashboard
                  equipmentList={equipmentList}
                  onReconfigureTopology={() => setCurrentStep(1)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
