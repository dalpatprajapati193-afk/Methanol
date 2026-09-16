"use client";

/**
 * CgcConfigClient.tsx — single 'use client' boundary for CGC capability.
 *
 * Receives instanceId from the Server Component (page.tsx). Owns all
 * interactive state and renders the appropriate tab component.
 *
 * Tabs: Plant Configurations | Master KPI List | Tag Mapping | KPI Calculations
 */

import React, { useEffect, useRef, useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { useEffExport, buildEffWorkbook } from '../hooks/useEffExport';
import { loadInitialConfig } from '../actions/Actions';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { downloadConfigJson, blobToBase64 } from '../utils/exportHelpers';
import { EXPORT_BUTTONS_CONFIG } from '../config/exportButtonsConfig';
import PlantConfigTab from './PlantConfigTab';
import KpiListTab from './KpiListTab';
import TagMappingTab from './TagMappingTab';
import KpiCalculationsTab from './KpiCalculationsTab';

const TABS = [
  { id: 'plant',       label: 'Plant Configurations' },
  { id: 'kpi-list',    label: '📋 Master KPI List'   },
  { id: 'tag-mapping', label: '🔗 Tag Mapping'       },
  { id: 'kpi-calc',    label: 'KPI Calculations'     },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CgcConfigClient({ instanceId }: { instanceId: string }) {
  const numericInstanceId = Number(instanceId);
  const {
    config, activeSection, setActiveSection,
    setPlant, setUnitSystem, setBaseline, setOpportunity,
    setFeedFraction, setPrimaryFlowTransmitter,
    setStageCount, setStageDesign, setStageInjection, setStageField,
    setEquipmentTag, setStageInterstage,
    setDriver, updateRawTag,
    updateKpiInputTag, setKpiCondition,
    importConfig, resetConfig,
    savedConfigs, saveAsNamedConfig, updateNamedConfig, loadNamedConfig, deleteNamedConfig,
  } = useConfig(instanceId);

  const { flush: flushDraft } = useDraftAutosave(Number.isFinite(numericInstanceId) ? numericInstanceId : null, config);
  const { generateEff, saveToDatabase, status: effStatus } = useEffExport(
    Number.isFinite(numericInstanceId) ? numericInstanceId : null,
  );
  const [activeTab, setActiveTab] = useState<TabId>('plant');
  const [selectedNames, setSelectedNames] = useState<Set<string>>(
    () => new Set(config.kpi_catalog.map(k => k.name)),
  );
  const [configsOpen, setConfigsOpen] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!Number.isFinite(numericInstanceId)) return;
    let cancelled = false;
    loadInitialConfig(numericInstanceId)
      .then(({ data }) => {
        if (!cancelled) importConfig(data);
      })
      .catch((err) => {
        console.error("Failed to load CGC config from server:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [importConfig, numericInstanceId]);

  function handleSaveAsNew() {
    const name = window.prompt('Name this configuration:', config.plant.plant_name || 'Untitled config');
    if (name) saveAsNamedConfig(name);
  }

  async function handleSaveDraft() {
    // Config auto-persists to localStorage on every change; this gives the
    // user an explicit, visible confirmation that the current draft is saved.
    try {
      // Reuse the same workbook-generation flow as "Generate EFF" / "Save in
      // Database" — the draft carries the generated Excel as temporary data
      // alongside the config JSON (see Actions.saveDraft), so this button is
      // the one place that regenerates it (the 1s debounce autosave doesn't).
      let excel: { base64: string; filename: string; generatedAt: string } | undefined;
      if (Number.isFinite(numericInstanceId)) {
        const { blob, filename } = await buildEffWorkbook(config);
        excel = { base64: await blobToBase64(blob), filename, generatedAt: new Date().toISOString() };
      }
      await flushDraft(excel);
      localStorage.setItem(`cgc_config_v1_${instanceId}`, JSON.stringify(config));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch {
      alert('Could not save draft — browser storage may be full.');
    }
  }

  function handleExportJson() {
    downloadConfigJson(config);
  }

  function handleSelectAll(names: string[]) {
    setSelectedNames(prev => { const n = new Set(prev); names.forEach(x => n.add(x)); return n; });
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      importConfig(raw.system_configuration ?? raw);
    } catch { alert('Invalid JSON file.'); }
    e.target.value = '';
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── Top navigation bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-6">

          {/* Logo / title */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">I</div>
            <span className="text-sm font-bold text-text-primary whitespace-nowrap">CGC Configuration</span>
            <span className="text-xs text-text-tertiary">#{instanceId}</span>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            {EXPORT_BUTTONS_CONFIG.showConfigs && (
              <div className="relative">
                <button onClick={() => setConfigsOpen(o => !o)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors">
                  Configs ({savedConfigs.length})
                </button>
                {configsOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-surface p-3 shadow-lg">
                    <button onClick={handleSaveAsNew}
                      className="mb-2 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                      + Save current as new
                    </button>
                    {savedConfigs.length === 0 ? (
                      <p className="text-xs italic text-text-tertiary">No saved configurations yet.</p>
                    ) : (
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {savedConfigs.map(entry => (
                          <div key={entry.id} className="flex items-center gap-1 rounded border border-border px-2 py-1.5">
                            <div className="flex-1 overflow-hidden">
                              <div className="truncate text-xs font-semibold text-text-primary">{entry.name}</div>
                              <div className="text-[10px] text-text-tertiary">{new Date(entry.savedAt).toLocaleString()}</div>
                            </div>
                            <button onClick={() => loadNamedConfig(entry.id)} title="Load"
                              className="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10">Load</button>
                            <button onClick={() => updateNamedConfig(entry.id)} title="Update with current config"
                              className="rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-surface-hover">Update</button>
                            <button onClick={() => deleteNamedConfig(entry.id)} title="Delete"
                              className="rounded px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {EXPORT_BUTTONS_CONFIG.showReset && (
              <button onClick={resetConfig}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors">
                Reset
              </button>
            )}
            {EXPORT_BUTTONS_CONFIG.showSaveDraft && (
              <button onClick={() => void handleSaveDraft()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors">
                {draftSaved ? '✓ Saved' : 'Save Draft'}
              </button>
            )}
            {EXPORT_BUTTONS_CONFIG.showImportJson && (
              <>
                <input ref={importRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                <button onClick={() => importRef.current?.click()}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors">
                  Import JSON
                </button>
              </>
            )}
            {EXPORT_BUTTONS_CONFIG.showJsonDownload && (
              <button onClick={handleExportJson}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors">
                Export JSON
              </button>
            )}
            {EXPORT_BUTTONS_CONFIG.showSaveDatabase && (
              <button
                onClick={() => saveToDatabase(config)}
                disabled={effStatus === 'generating'}
                title="Generate the EFF workbook and save it to the database without downloading"
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  effStatus === 'generating'
                    ? 'cursor-not-allowed border-border text-text-tertiary'
                    : 'border-border text-text-secondary hover:bg-surface-hover',
                ].join(' ')}
              >
                {effStatus === 'generating' ? '⏳ Saving…' : '💾 Save in Database'}
              </button>
            )}
            {EXPORT_BUTTONS_CONFIG.showExcelDownload && (
              <button
                onClick={() => generateEff(config)}
                disabled={effStatus === 'generating'}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-bold transition-colors',
                  effStatus === 'generating'
                    ? 'cursor-not-allowed bg-primary/50 text-primary-foreground'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                ].join(' ')}
              >
                {effStatus === 'generating' ? '⏳ Building…' : '📊 Generate EFF'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-6 py-6">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">

          {activeTab === 'plant' && (
            <PlantConfigTab
              config={config}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              setPlant={setPlant as Parameters<typeof PlantConfigTab>[0]['setPlant']}
              setUnitSystem={setUnitSystem}
              setBaseline={setBaseline}
              setOpportunity={setOpportunity}
              setFeedFraction={setFeedFraction}
              setPrimaryFlowTransmitter={setPrimaryFlowTransmitter}
              setStageCount={setStageCount}
              setStageDesign={setStageDesign}
              setStageInjection={setStageInjection}
              setStageField={setStageField}
              setEquipmentTag={setEquipmentTag}
              setStageInterstage={setStageInterstage}
              setDriver={setDriver}
            />
          )}

          {activeTab === 'kpi-list' && (
            <KpiListTab
              config={config}
              selectedNames={selectedNames}
              onToggle={name => setSelectedNames(prev => {
                const n = new Set(prev);
                n.has(name) ? n.delete(name) : n.add(name);
                return n;
              })}
              onSelectAll={handleSelectAll}
              onClearAll={() => setSelectedNames(new Set())}
            />
          )}

          {activeTab === 'tag-mapping' && (
            <TagMappingTab
              config={config}
              onUpdateRawTag={updateRawTag}
            />
          )}

          {activeTab === 'kpi-calc' && (
            <KpiCalculationsTab
              config={config}
              selectedNames={selectedNames}
              onUpdateTag={updateKpiInputTag}
              onSetKpiCondition={setKpiCondition}
              onNavigateToTagMapping={() => setActiveTab('tag-mapping')}
            />
          )}

        </div>
      </main>
    </div>
  );
}
