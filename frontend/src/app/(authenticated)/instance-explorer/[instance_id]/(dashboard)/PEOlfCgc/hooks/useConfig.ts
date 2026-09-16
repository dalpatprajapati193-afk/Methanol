'use client';

/**
 * useConfig.ts — CGC config state management hook
 *
 * Mirrors the HTML tool's saveConfig / normalizeConfig / loadConfig behaviour:
 *   - localStorage key is scoped per instance_id (prevents cross-instance leakage)
 *   - normalizeConfig grows/shrinks stages[], preserves existing data
 *   - every setter produces a new normalized config object
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  CgcConfig, DriverConfig, RawPiTag, StageConfig,
} from '../types/config';
import { makeDefaultConfig, makeDefaultStage } from '../types/config';

function storageKey(instanceId: string): string {
  return `cgc_config_v1_${instanceId}`;
}

function savedConfigsKey(instanceId: string): string {
  return `cgc_config_v1_${instanceId}_saved`;
}

export interface SavedConfigEntry {
  id: string;
  name: string;
  savedAt: string;
  config: CgcConfig;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function normalizeUom(uom: string): string {
  switch (uom) {
    case 'g/mol':
      return 'kg/kmol';
    case 'kg/cm2':
      return 'kg/cm²(g)';
    case 'm3/h':
      return 'm³/h';
    case 'kW/C':
      return 'kW/°C';
    case '°C':
      return '°C';
    case '°F':
      return '°F';
    case '-':
      return '-';
    default:
      return uom;
  }
}

function normalizeRawPiTag(tag: RawPiTag): RawPiTag {
  return {
    ...tag,
    uom: normalizeUom(tag.uom || ''),
    input_uom: normalizeUom(tag.input_uom || ''),
    output_uom: normalizeUom(tag.output_uom || ''),
  };
}

export function normalizeConfig(raw: Partial<CgcConfig>): CgcConfig {
  const def = makeDefaultConfig();
  const base = { ...def, ...(raw as CgcConfig) };

  // Plant
  base.plant = { ...def.plant, ...(raw.plant ?? {}) };
  base.plant.unit_system = {
    ...def.plant.unit_system,
    ...base.plant.unit_system,
    pressure: normalizeUom(base.plant.unit_system.pressure) as CgcConfig['plant']['unit_system']['pressure'],
    temperature: normalizeUom(base.plant.unit_system.temperature) as CgcConfig['plant']['unit_system']['temperature'],
    mass_flow: normalizeUom(base.plant.unit_system.mass_flow) as CgcConfig['plant']['unit_system']['mass_flow'],
    power: normalizeUom(base.plant.unit_system.power) as CgcConfig['plant']['unit_system']['power'],
    specific_power: normalizeUom(base.plant.unit_system.specific_power) as CgcConfig['plant']['unit_system']['specific_power'],
    fraction: normalizeUom(base.plant.unit_system.fraction) as CgcConfig['plant']['unit_system']['fraction'],
  };
  const n = clamp(base.plant.stage_count ?? 5, 1, 50);
  base.plant.stage_count = n;

  // Stages — grow/shrink to match stage_count
  const existing: Partial<StageConfig>[] = Array.isArray(raw.stages) ? raw.stages : [];
  base.stages = Array.from({ length: n }, (_, i) => {
    const saved = existing[i] as Partial<StageConfig> | undefined;
    const dflt  = makeDefaultStage(i + 1, n);
    return saved ? { ...dflt, ...saved, stage_number: i + 1 } : dflt;
  });

  // Composition components — keep user's list or default
  if (!Array.isArray(raw.composition_components) || raw.composition_components.length === 0) {
    base.composition_components = def.composition_components;
  }

  base.raw_pi_tags = Array.isArray(base.raw_pi_tags)
    ? base.raw_pi_tags.map(tag => normalizeRawPiTag(tag))
    : def.raw_pi_tags.map(tag => normalizeRawPiTag(tag));

  return base;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useConfig(instanceId: string) {
  const key = storageKey(instanceId);

  const [config, setRaw] = useState<CgcConfig>(() => {
    if (typeof window === 'undefined') return makeDefaultConfig();
    try {
      const s = localStorage.getItem(key);
      return s ? normalizeConfig(JSON.parse(s)) : makeDefaultConfig();
    } catch {
      return makeDefaultConfig();
    }
  });

  const [activeSection, setActiveSection] = useState('plant');

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(config)); } catch { /* quota */ }
  }, [config, key]);

  const set = useCallback(
    (fn: (p: CgcConfig) => CgcConfig) => setRaw(p => normalizeConfig(fn(p))),
    [],
  );

  // ── Plant ──────────────────────────────────────────────────────────────────
  const setPlant = useCallback(
    <K extends keyof CgcConfig['plant']>(k: K, v: CgcConfig['plant'][K]) =>
      set(p => ({ ...p, plant: { ...p.plant, [k]: v } })),
    [set],
  );

  const setUnitSystem = useCallback(
    (k: keyof CgcConfig['plant']['unit_system'], v: string) =>
      set(p => ({ ...p, plant: { ...p.plant, unit_system: { ...p.plant.unit_system, [k]: v } } })),
    [set],
  );

  const setBaseline = useCallback(
    (k: keyof CgcConfig['plant']['baselines'], v: number) =>
      set(p => ({ ...p, plant: { ...p.plant, baselines: { ...p.plant.baselines, [k]: v } } })),
    [set],
  );

  const setOpportunity = useCallback(
    (k: keyof CgcConfig['plant']['opportunity'], v: number) =>
      set(p => ({ ...p, plant: { ...p.plant, opportunity: { ...p.plant.opportunity, [k]: v } } })),
    [set],
  );

  const setFeedFraction = useCallback(
    (comp: string, v: number) =>
      set(p => ({ ...p, plant: { ...p.plant, feed: { ...p.plant.feed, fixed_fractions: { ...p.plant.feed.fixed_fractions, [comp]: v } } } })),
    [set],
  );

  const setPrimaryFlowTransmitter = useCallback(
    (v: CgcConfig['plant']['primary_flow_transmitter']) =>
      set(p => ({ ...p, plant: { ...p.plant, primary_flow_transmitter: v } })),
    [set],
  );

  const setStageCount = useCallback(
    (n: number) => set(p => ({ ...p, plant: { ...p.plant, stage_count: clamp(n, 1, 50) } })),
    [set],
  );

  // ── Stage ──────────────────────────────────────────────────────────────────
  const setStageDesign = useCallback(
    (idx: number, k: keyof StageConfig['design'], v: number | null) =>
      set(p => {
        const ss = [...p.stages];
        ss[idx] = { ...ss[idx], design: { ...ss[idx].design, [k]: v } };
        return { ...p, stages: ss };
      }),
    [set],
  );

  const setStageInjection = useCallback(
    (idx: number, type: 'bfw_injection' | 'wash_oil_injection', k: string, v: unknown) =>
      set(p => {
        const ss = [...p.stages];
        ss[idx] = { ...ss[idx], [type]: { ...(ss[idx][type] as unknown as Record<string, unknown>), [k]: v } };
        return { ...p, stages: ss };
      }),
    [set],
  );

  const setStageField = useCallback(
    <K extends keyof StageConfig>(idx: number, k: K, v: StageConfig[K]) =>
      set(p => {
        const ss = [...p.stages];
        ss[idx] = { ...ss[idx], [k]: v };
        return { ...p, stages: ss };
      }),
    [set],
  );

  const setEquipmentTag = useCallback(
    (idx: number, key: string, v: string) =>
      set(p => {
        const ss = [...p.stages];
        ss[idx] = { ...ss[idx], equipment_tags: { ...ss[idx].equipment_tags, [key]: v } };
        return { ...p, stages: ss };
      }),
    [set],
  );

  const setStageInterstage = useCallback(
    (idx: number, key: keyof StageConfig['interstage_after'], v: boolean) =>
      set(p => {
        const ss = [...p.stages];
        ss[idx] = { ...ss[idx], interstage_after: { ...ss[idx].interstage_after, [key]: v } };
        return { ...p, stages: ss };
      }),
    [set],
  );

  // ── Driver ─────────────────────────────────────────────────────────────────
  const setDriver = useCallback(
    <K extends keyof DriverConfig>(k: K, v: DriverConfig[K]) =>
      set(p => ({ ...p, driver: { ...p.driver, [k]: v } })),
    [set],
  );

  // ── PI Tags ────────────────────────────────────────────────────────────────
  const updateRawTag = useCallback(
    (idx: number, field: string, v: unknown) =>
      set(p => {
        const tags = [...p.raw_pi_tags];
        tags[idx] = { ...tags[idx], [field]: v === '' ? null : v };
        return { ...p, raw_pi_tags: tags };
      }),
    [set],
  );

  // ── KPI input tag mapping (single source of truth: raw_pi_tags) ────────────
  // KPI Calculations and Export both read/write raw_pi_tags by name so mappings
  // never drift between the two tabs. kpi_input_tag_bank is kept in the schema
  // for JSON-export compatibility only and is no longer written by the UI.
  const updateKpiInputTag = useCallback(
    (name: string, patch: Record<string, unknown>) =>
      set(p => {
        const tags = [...p.raw_pi_tags];
        const idx = tags.findIndex(t => t.name === name);
        if (idx >= 0) {
          tags[idx] = { ...tags[idx], ...patch } as typeof tags[number];
        } else {
          tags.push({
            name,
            pi_tag: '',
            description: name,
            uom: '',
            input_uom: '',
            output_uom: '',
            conversion_factor: 1,
            design_value: null,
            min_val: null,
            max_val: null,
            ccp_default: null,
            category: '',
            user_tag_id: null,
            data_type: '',
            kpi_ref_count: 0,
            is_kpi_input: true,
            pi_section: '',
            feeds_sections: [],
            source_type: 'pi_tag',
            _auto_generated: true,
            ...patch,
          } as unknown as typeof tags[number]);
        }
        return { ...p, raw_pi_tags: tags };
      }),
    [set],
  );

  // ── KPI Activation Conditions ─────────────────────────────────────────────
  const setKpiCondition = useCallback(
    (kpiName: string, data: CgcConfig['kpi_conditions'][string]) =>
      set(p => ({ ...p, kpi_conditions: { ...p.kpi_conditions, [kpiName]: data } })),
    [set],
  );

  // ── Import / Reset ─────────────────────────────────────────────────────────
  const importConfig = useCallback(
    (raw: unknown) => setRaw(normalizeConfig(raw as Partial<CgcConfig>)),
    [],
  );

  const resetConfig = useCallback(() => {
    if (window.confirm('Reset the configuration to defaults?')) {
      localStorage.removeItem(key);
      setRaw(makeDefaultConfig());
    }
  }, [key]);

  // ── Named saved configurations ─────────────────────────────────────────────
  const savedKey = savedConfigsKey(instanceId);

  const [savedConfigs, setSavedConfigs] = useState<SavedConfigEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const s = localStorage.getItem(savedKey);
      return s ? (JSON.parse(s) as SavedConfigEntry[]) : [];
    } catch {
      return [];
    }
  });

  const persistSavedConfigs = useCallback(
    (list: SavedConfigEntry[]) => {
      setSavedConfigs(list);
      try { localStorage.setItem(savedKey, JSON.stringify(list)); } catch { /* quota */ }
    },
    [savedKey],
  );

  const saveAsNamedConfig = useCallback(
    (name: string) => {
      const entry: SavedConfigEntry = {
        id: `cfg_${Date.now()}`,
        name,
        savedAt: new Date().toISOString(),
        config,
      };
      persistSavedConfigs([...savedConfigs, entry]);
    },
    [config, savedConfigs, persistSavedConfigs],
  );

  const updateNamedConfig = useCallback(
    (id: string) => {
      persistSavedConfigs(savedConfigs.map(e => e.id === id ? { ...e, config, savedAt: new Date().toISOString() } : e));
    },
    [config, savedConfigs, persistSavedConfigs],
  );

  const loadNamedConfig = useCallback(
    (id: string) => {
      const entry = savedConfigs.find(e => e.id === id);
      if (entry) setRaw(normalizeConfig(entry.config));
    },
    [savedConfigs],
  );

  const deleteNamedConfig = useCallback(
    (id: string) => persistSavedConfigs(savedConfigs.filter(e => e.id !== id)),
    [savedConfigs, persistSavedConfigs],
  );

  return {
    config, activeSection, setActiveSection,
    setPlant, setUnitSystem, setBaseline, setOpportunity,
    setFeedFraction, setPrimaryFlowTransmitter,
    setStageCount, setStageDesign, setStageInjection, setStageField,
    setEquipmentTag, setStageInterstage,
    setDriver, updateRawTag,
    updateKpiInputTag, setKpiCondition,
    importConfig, resetConfig,
    savedConfigs, saveAsNamedConfig, updateNamedConfig, loadNamedConfig, deleteNamedConfig,
  };
}


