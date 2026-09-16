"use client";

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Database,
  RefreshCw,
  Sliders,
  ChevronRight,
  CheckCircle,
  FileSpreadsheet,
  Check,
  SlidersHorizontal,
  FolderSync,
  Search,
  AlertTriangle
} from "lucide-react";
import { getReformerConfig, saveReformerConfig, getReformerKpis } from "../actions/actions";

interface ReformerDashboardProps {
  id: string;
  instanceName: string;
}

export function ReformerDashboard({ id, instanceName }: ReformerDashboardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Step 1 states (Plant Config)
  const [reformerConfig, setReformerConfig] = useState({
    combustionAirPreheater: true,
    fuelGasMixRatio: "Variable FPG/FNG",
    steamToCarbonControl: "Cascade Control",
    hasSelectiveCatalyticReduction: true,
    feedSaturatorSystem: true
  });

  // Mappings & Config states loaded from API
  const [rawTagMappings, setRawTagMappings] = useState<Record<string, any>>({});
  const [kpiList, setKpiList] = useState<any[]>([]);
  const [kpiConfig, setKpiConfig] = useState<Record<string, { type: "Calculated" | "PI Tag"; piTag?: string }>>({});

  const extractTagsFromFormula = (formula: string) => {
    if (!formula) return [];
    // Match any word character sequence that starts with a letter
    const matches = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
    if (!matches) return [];
    // Filter down to only those that exist in rawTagMappings keys to extract actual tags
    return Array.from(new Set(matches.filter(m => rawTagMappings[m] !== undefined)));
  };

  // Load configuration and KPIs on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch Config
        const res: any = await getReformerConfig(id);
        if (res) {
          if (res.reformer) {
            setReformerConfig(prev => ({ ...prev, ...res.reformer }));
          }
          if (res.rawTagMappings && Object.keys(res.rawTagMappings).length > 0) {
            setRawTagMappings(res.rawTagMappings);
          }
        }

        // 2. Fetch KPIs
        const kpisData = await getReformerKpis();
        if (kpisData && Array.isArray(kpisData)) {
          setKpiList(kpisData);
          const initialConfig: Record<string, { type: "Calculated" | "PI Tag"; piTag?: string }> = {};
          kpisData.forEach(kpi => {
            initialConfig[kpi.name] = {
              type: "Calculated",
              piTag: res?.rawTagMappings[kpi.name]?.piTag || ""
            };
          });
          setKpiConfig(initialConfig);
        }
      } catch (err: any) {
        console.error("Failed to load reformer config:", err);
        setError("Could not connect to FastAPI server. Please ensure the local backend services are running.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter KPIs dynamically based on Step 1 design selections
  const getActiveKpis = () => {
    return kpiList.filter(kpi => {
      const name = kpi.name;
      const cat = kpi.category || "";
      
      // Air Preheater
      if (!reformerConfig.combustionAirPreheater && (cat.toLowerCase().includes("preheater") || name.toLowerCase().includes("preheater") || name.toLowerCase().includes("aph"))) {
        return false;
      }
      
      // Feed Saturator System
      if (!reformerConfig.feedSaturatorSystem && (cat.toLowerCase().includes("saturator") || name.toLowerCase().includes("saturator") || name.toLowerCase().includes("ng_preheater"))) {
        return false;
      }

      // SCR system
      if (!reformerConfig.hasSelectiveCatalyticReduction && (cat.toLowerCase().includes("scr") || name.toLowerCase().includes("scr"))) {
        return false;
      }

      return true;
    });
  };

  const activeKpis = getActiveKpis();

  // Filter required parameters based on Step 1 configuration and Step 2 selections
  const getRequiredTags = () => {
    const requiredTags = new Set<string>();
    
    activeKpis.forEach(kpi => {
      const config = kpiConfig[kpi.name] || { type: "Calculated" };
      if (config.type === "Calculated") {
        const extracted = extractTagsFromFormula(kpi.formula || "");
        extracted.forEach(tag => {
          if (rawTagMappings[tag]) {
            requiredTags.add(tag);
          }
        });
      } else {
        // Mapped as PI Tag directly, so map the KPI tag path itself
        requiredTags.add(kpi.name);
      }
    });

    const allTags = Array.from(requiredTags);

    return allTags.filter(tag => {
      // Filter out preheater tags if APH is disabled
      if (!reformerConfig.combustionAirPreheater && tag.toLowerCase().includes("preheater")) {
        return false;
      }
      return true;
    });
  };

  const activeTags = getRequiredTags();

  // Search filter for DCS tag mappings
  const filteredTags = activeTags.filter(tagKey => 
    tagKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (rawTagMappings[tagKey]?.piTag || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKpiConfigChange = (kpiName: string, field: "type" | "piTag", value: string) => {
    setKpiConfig(prev => {
      const updated = {
        ...prev,
        [kpiName]: { ...prev[kpiName], [field]: value }
      };
      
      // Sync PI tag path back into rawTagMappings so backend can save/export it
      if (field === "piTag" || (field === "type" && value === "PI Tag")) {
        const pathVal = field === "piTag" ? value : (prev[kpiName]?.piTag || "");
        setRawTagMappings(tags => ({
          ...tags,
          [kpiName]: {
            ...(tags[kpiName] || { design: "", min: "", max: "", def: "", uom: "" }),
            piTag: pathVal
          }
        }));
      }
      return updated;
    });
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const res = await saveReformerConfig(id, reformerConfig, rawTagMappings);
      setSaveResult(res);
      setCurrentStep(4);
    } catch (err: any) {
      alert("Failed to save configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <RefreshCw size={36} className="animate-spin text-accent-blue" />
        <span className="text-sm text-text-secondary">Loading Methanol Reformer configuration...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Methanol Reformer Setup & Configurator</h1>
          <p className="text-sm text-text-secondary">Capability ID: PeMethRef · Instance ID: {id} ({instanceName})</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-1.5 text-xs text-text-secondary">
          <FolderSync size={14} className="text-accent-blue" />
          <span>Config Sync Mode</span>
        </div>
      </div>

      {/* Connection Warning Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs text-yellow-600 dark:text-yellow-400">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="rounded bg-yellow-500/20 px-2 py-1 hover:bg-yellow-500/30 font-semibold"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Stepper Wizard Indicator */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex justify-between items-center max-w-3xl mx-auto">
          {[
            { step: 1, label: "Plant Configuration" },
            { step: 2, label: `Mandatory KPIs (${activeKpis.length})` },
            { step: 3, label: `DCS Tag Mapping (${activeTags.length})` },
            { step: 4, label: "Review & Submit" }
          ].map((item, idx) => (
            <React.Fragment key={idx}>
              <button 
                onClick={() => currentStep > item.step && setCurrentStep(item.step)}
                disabled={currentStep <= item.step}
                className="flex items-center gap-2 text-left disabled:cursor-not-allowed group focus:outline-none"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                  currentStep === item.step 
                    ? "border-accent-blue bg-accent-blue text-white" 
                    : currentStep > item.step 
                      ? "border-accent-green bg-accent-green/10 text-accent-green" 
                      : "border-border bg-background text-text-secondary"
                }`}>
                  {currentStep > item.step ? <Check size={14} /> : item.step}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className={`text-xs font-bold ${currentStep === item.step ? "text-text-primary" : "text-text-secondary"}`}>
                    {item.label}
                  </span>
                </div>
              </button>
              {idx < 3 && <ChevronRight size={16} className="text-text-secondary hidden sm:block" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Wizard Content Steps */}
      <div className="min-h-[450px]">
        
        {/* STEP 1: PLANT CONFIG FORM */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-5">
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-accent-blue" />
                Step 1: Configure SMR Reformer Equipment & Settings
              </h2>
              <p className="text-xs text-text-secondary -mt-2">Define active sub-systems to populate mandatory reformer KPIs and tags.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <div className="rounded-lg border border-border bg-background p-5 flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-text-primary border-b border-border pb-2">Reformer Main Equipment</h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Combustion Air Preheater (APH)</span>
                    <input 
                      type="checkbox" 
                      checked={reformerConfig.combustionAirPreheater} 
                      onChange={e => setReformerConfig(prev => ({ ...prev, combustionAirPreheater: e.target.checked }))}
                      className="rounded border-border text-accent-blue"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Selective Catalytic Reduction (SCR)</span>
                    <input 
                      type="checkbox" 
                      checked={reformerConfig.hasSelectiveCatalyticReduction} 
                      onChange={e => setReformerConfig(prev => ({ ...prev, hasSelectiveCatalyticReduction: e.target.checked }))}
                      className="rounded border-border text-accent-blue"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Feed Saturator System</span>
                    <input 
                      type="checkbox" 
                      checked={reformerConfig.feedSaturatorSystem} 
                      onChange={e => setReformerConfig(prev => ({ ...prev, feedSaturatorSystem: e.target.checked }))}
                      className="rounded border-border text-accent-blue"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-5 flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-text-primary border-b border-border pb-2">Control Options</h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Fuel Gas Mix Method</span>
                    <select 
                      value={reformerConfig.fuelGasMixRatio}
                      onChange={e => setReformerConfig(prev => ({ ...prev, fuelGasMixRatio: e.target.value }))}
                      className="rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary font-medium w-full max-w-[180px]"
                    >
                      <option value="Variable FPG/FNG">Variable FPG/FNG</option>
                      <option value="Fixed Mix Ratio">Fixed Mix Ratio</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Steam-To-Carbon Control Loop</span>
                    <select 
                      value={reformerConfig.steamToCarbonControl}
                      onChange={e => setReformerConfig(prev => ({ ...prev, steamToCarbonControl: e.target.value }))}
                      className="rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary font-medium w-full max-w-[180px]"
                    >
                      <option value="Cascade Control">Cascade Control</option>
                      <option value="Manual Ratio Control">Manual Ratio Control</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 border-t border-border pt-4">
                <button 
                  onClick={() => setCurrentStep(2)}
                  className="rounded-lg bg-accent-blue px-5 py-2 text-xs font-semibold text-white hover:opacity-90 flex items-center gap-1"
                >
                  Continue to KPIs <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: KPIs */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4">
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <CheckCircle size={18} className="text-accent-blue" />
                Step 2: Reformer Mandatory KPIs list ({activeKpis.length} Active)
              </h2>
              <p className="text-xs text-text-secondary">Active reformer KPIs populated dynamically based on Step 1 configuration.</p>
              
              <div className="overflow-x-auto border border-border rounded-lg mt-2">
                <table className="min-w-full divide-y divide-border text-xs table-fixed">
                  <colgroup>
                    <col className="w-[35%]" />
                    <col className="w-[20%]" />
                    <col className="w-[35%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-text-secondary font-semibold bg-background">
                      <th className="px-4 py-3">KPI Name / Category</th>
                      <th className="px-4 py-3">Type of KPI</th>
                      <th className="px-4 py-3">Formula Expression / Mapped PI Tag</th>
                      <th className="px-4 py-3 text-center">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary bg-surface">
                    {activeKpis.map((kpi, idx) => {
                      const config = kpiConfig[kpi.name] || { type: "Calculated", piTag: "" };
                      return (
                        <tr key={idx} className="hover:bg-surface-hover">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-text-primary">{kpi.name.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] text-text-secondary line-clamp-1 mt-0.5" title={kpi.category}>
                              Category: {kpi.category}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={config.type}
                              onChange={e => handleKpiConfigChange(kpi.name, "type", e.target.value as any)}
                              className="rounded border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary font-medium w-full max-w-[150px]"
                            >
                              <option value="Calculated">Calculated</option>
                              <option value="PI Tag">PI Tag</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {config.type === "Calculated" ? (
                              <div className="font-mono text-[10px] text-accent-blue bg-accent-blue/5 border border-accent-blue/10 px-2.5 py-1.5 rounded break-all max-h-[80px] overflow-y-auto" title={kpi.formula}>
                                {kpi.formula}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={config.piTag || ""}
                                onChange={e => handleKpiConfigChange(kpi.name, "piTag", e.target.value)}
                                placeholder="Enter DCS Tag path (e.g. AR.DCS.TC1227.PV)"
                                className="w-full rounded border border-border bg-background px-3 py-1.5 font-mono text-[10px] text-text-primary outline-none focus:border-accent-blue"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-text-secondary text-center">
                            {kpi.uom || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-3 mt-4 border-t border-border pt-4">
                <button 
                  onClick={() => setCurrentStep(1)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                >
                  Back
                </button>
                <button 
                  onClick={() => setCurrentStep(3)}
                  className="rounded-lg bg-accent-blue px-5 py-2 text-xs font-semibold text-white hover:opacity-90 flex items-center gap-1"
                >
                  Go to Tag Mappings <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: TAG MAPPINGS */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Database size={18} className="text-accent-blue" />
                    Step 3: Mapped OPC-UA / DCS Tags and Boundaries ({filteredTags.length} showing)
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">Map actual process parameters and set statistical min/max ranges for raw inputs.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
                    <input 
                      type="text"
                      placeholder="Search tags..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-xs text-text-primary outline-none focus:border-accent-blue"
                    />
                  </div>
                  <div className="rounded border border-border px-3 py-2 text-xs text-text-secondary font-semibold bg-background shrink-0">
                    {activeTags.length} active tags
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px] border border-border rounded-lg mt-2">
                <table className="min-w-full divide-y divide-border text-xs">
                  <thead>
                    <tr className="text-left text-text-secondary font-semibold bg-background sticky top-0">
                      <th className="px-3 py-2.5">Parameter / Short Tag</th>
                      <th className="px-3 py-2.5">DCS PI Tag Path</th>
                      <th className="px-3 py-2.5 w-20 text-center">Design</th>
                      <th className="px-3 py-2.5 w-20 text-center">Min Limit</th>
                      <th className="px-3 py-2.5 w-20 text-center">Max Limit</th>
                      <th className="px-3 py-2.5 w-20 text-center">Default</th>
                      <th className="px-3 py-2.5 w-20 text-center">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-primary bg-surface">
                    {filteredTags.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-xs text-text-secondary">
                          No active tags match the search query or configuration.
                        </td>
                      </tr>
                    ) : (
                      filteredTags.map(tagKey => {
                        const mapping = rawTagMappings[tagKey] || {};
                        return (
                          <tr key={tagKey} className="hover:bg-surface-hover">
                            <td className="px-3 py-2 font-semibold text-text-primary max-w-[200px] truncate" title={tagKey}>
                              {tagKey.replace(/_/g, ' ')}
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.piTag || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], piTag: e.target.value }
                                }))}
                                placeholder="e.g. AR.DCS.TC1227.PV"
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[10px] text-text-primary outline-none focus:border-accent-blue"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.design || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], design: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.min || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], min: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.max || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], max: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.def || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], def: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                value={mapping.uom || ""}
                                onChange={e => setRawTagMappings(prev => ({
                                  ...prev,
                                  [tagKey]: { ...prev[tagKey], uom: e.target.value }
                                }))}
                                className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-text-primary text-center outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-3 mt-4 border-t border-border pt-4">
                <button 
                  onClick={() => setCurrentStep(2)}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                >
                  Back
                </button>
                <button 
                  onClick={() => setCurrentStep(4)}
                  className="rounded-lg bg-accent-blue px-5 py-2 text-xs font-semibold text-white hover:opacity-90 flex items-center gap-1"
                >
                  Continue to Review <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & CONFIRMATION */}
        {currentStep === 4 && (
          <div className="flex flex-col gap-6">
            {!saveResult ? (
              <div className="rounded-xl border border-border bg-surface p-6 flex flex-col gap-6">
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-accent-blue" />
                  Step 4: Review and Submit Configuration
                </h2>
                <p className="text-xs text-text-secondary -mt-2">
                  Please review the filled information below before submitting. Click <strong>Submit Configuration</strong> to save the configuration directly to the database.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Plant Design Specs */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-accent-blue uppercase tracking-wider">Plant Specifications</h3>
                    
                    {/* Reformer Equipment Card */}
                    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-text-primary">Reformer Main Equipment</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Air Preheater (APH)</span>
                          <span className="font-semibold">{reformerConfig.combustionAirPreheater ? "Enabled" : "Disabled"}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">SCR System</span>
                          <span className="font-semibold">{reformerConfig.hasSelectiveCatalyticReduction ? "Enabled" : "Disabled"}</span>
                        </div>
                        <div className="flex flex-col col-span-2 border-t border-border/50 pt-2 mt-1">
                          <span className="text-[10px] text-text-secondary">Feed Saturator System</span>
                          <span className="font-semibold">{reformerConfig.feedSaturatorSystem ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Controls Card */}
                    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-2">
                      <h4 className="text-xs font-bold text-text-primary">Control Options</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Fuel Gas Mix Method</span>
                          <span className="font-semibold">{reformerConfig.fuelGasMixRatio}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-secondary">Steam-To-Carbon Control</span>
                          <span className="font-semibold">{reformerConfig.steamToCarbonControl}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: KPIs & Mappings Summary */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-accent-blue uppercase tracking-wider">KPIs & Mappings</h3>
                    
                    <div className="rounded-lg border border-border bg-background p-4 flex flex-col gap-4">
                      {/* Active KPIs list */}
                      <div>
                        <h4 className="text-xs font-bold text-text-primary mb-2">Active KPIs Summary</h4>
                        <div className="flex flex-wrap gap-2">
                          <div className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-text-primary">
                            Total Active: <strong className="text-accent-blue">{activeKpis.length}</strong>
                          </div>
                          <div className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-text-primary">
                            Calculated: <strong className="text-accent-blue">{activeKpis.filter(k => kpiConfig[k.name]?.type === "Calculated").length}</strong>
                          </div>
                          <div className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-text-primary">
                            Direct Measured: <strong className="text-accent-blue">{activeKpis.filter(k => kpiConfig[k.name]?.type === "PI Tag").length}</strong>
                          </div>
                        </div>
                      </div>

                      {/* DCS Tags summary (Mapped ones only) */}
                      <div className="border-t border-border/50 pt-3">
                        <h4 className="text-xs font-bold text-text-primary mb-2">Mapped DCS PI Tags ({activeTags.filter(t => rawTagMappings[t]?.piTag).length} Mapped)</h4>
                        <div className="max-h-[220px] overflow-y-auto border border-border/50 rounded divide-y divide-border/30 bg-surface">
                          {activeTags.filter(t => rawTagMappings[t]?.piTag).length === 0 ? (
                            <div className="text-[11px] text-text-secondary p-3 text-center">No DCS tags mapped yet.</div>
                          ) : (
                            activeTags.filter(t => rawTagMappings[t]?.piTag).map(t => (
                              <div key={t} className="p-2 flex justify-between gap-4 text-[11px] hover:bg-surface-hover">
                                <span className="font-semibold text-text-primary max-w-[180px] truncate" title={t}>{t.replace(/_/g, ' ')}</span>
                                <span className="font-mono text-text-secondary text-[10px] truncate max-w-[200px]" title={rawTagMappings[t]?.piTag}>{rawTagMappings[t]?.piTag}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between gap-3 mt-4 border-t border-border pt-4">
                  <button 
                    onClick={() => setCurrentStep(3)}
                    disabled={saving}
                    className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="rounded-lg bg-accent-blue px-6 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />} Submit Configuration
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-6 flex flex-col items-center justify-center text-center gap-5 py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
                  <CheckCircle size={36} />
                </div>
                <div className="flex flex-col gap-1 max-w-md">
                  <h2 className="text-lg font-bold text-text-primary">Configuration Submitted Successfully!</h2>
                  <p className="text-xs text-text-secondary">
                    All plant configurations, dynamic KPIs, and user-defined DCS tag mappings have been verified and saved to the database. The live calculation pipelines are now active and ready.
                  </p>
                </div>

                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => {
                      setSaveResult(null);
                      setCurrentStep(1);
                    }}
                    className="rounded-lg border border-border bg-surface px-5 py-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                  >
                    Modify Config
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-accent-blue px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Finish Setup
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
