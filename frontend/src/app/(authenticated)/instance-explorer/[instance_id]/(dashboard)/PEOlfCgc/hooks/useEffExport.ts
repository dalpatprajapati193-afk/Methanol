'use client';

/**
 * useEffExport.ts — EFF workbook download hook
 *
 * Attempts the FastAPI CGC endpoint first (POST /pe-olf-cgc/generate-eff).
 * If unreachable, falls back to client-side XLSX generation using SheetJS.
 *
 * The Tags sheet column order matches the _LBM_SHEETS_HDR["Tags"] definition
 * in the HTML tool exactly so the pipeline can consume either output without
 * modification:
 *   model_name, name_short, pi_name, type, formula, hihi, lolo, high, low,
 *   uom, data_type, category, design_value, formula_state, pipeline_location,
 *   flag_benchmark, flag_actual, flag_clean, flag_ma, flag_actual_run_always,
 *   flag_inputcheck_nan, flag_dataclean_filter, flag_ma_filter, has_child,
 *   flag_clean_nan, ccp_lolo, ccp_hihi, ccp_default_value, ccp_oob_logic,
 *   ccp_stuck_logic, ccp_nan_logic, ccp_default_logic, input_uom, output_uom,
 *   conversion_factor
 */

import { useCallback, useState } from 'react';
import type { CgcConfig, BridgePayload } from '../types/config';
import { ordinal } from '../types/config';
import { STATIC_EFF_DATA } from '../utils/staticEffData';
import { submitSnapshot, generateEffAction } from '../actions/Actions';
import { triggerDownload, blobToBase64 } from '../utils/exportHelpers';

// ── Tags sheet column headers (exact match to HTML tool) ─────────────────────
const TAGS_HDR = [
  'model_name','name_short','pi_name','type','formula',
  'hihi','lolo','high','low','uom','data_type','category',
  'design_value','formula_state','pipeline_location',
  'flag_benchmark','flag_actual','flag_clean','flag_ma','flag_actual_run_always',
  'flag_inputcheck_nan','flag_dataclean_filter','flag_ma_filter','has_child','flag_clean_nan',
  'ccp_lolo','ccp_hihi','ccp_default_value','ccp_oob_logic','ccp_stuck_logic',
  'ccp_nan_logic','ccp_default_logic',
  'input_uom','output_uom','conversion_factor','',
] as const;

// ── Formula sentinels (mirror the HTML tool) ──────────────────────────────────
const FORMULA = {
  MFE:     'cgc_pr_calculator.forward_simulate()',
  CAP:     'cgc_discharge_temp_corrected_v3.cgc_calc_isentropic_cap()',
  BFW:     'cgc_discharge_temp_corrected_v3.cgc_calc_bfw_correction()',
  BRIDGE:  'cgc_eff_bridge',
} as const;

function normalizeUom(uom: string, tagName = ''): string {
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
      return tagName && /(?:mol|gc|composition|fraction)/i.test(tagName) && uom === '%mol'
        ? 'mol%'
        : uom;
  }
}

interface TagRowInput {
  name_short:        string;
  pi_name?:          string;
  type?:             string;
  formula?:          string;
  uom?:              string;
  data_type?:        string;
  category?:         string;
  design_value?:     number | null;
  formula_state?:    string;
  pipeline_location?: string;
  ccp_default_value?: number | null;
  hihi?:             number | string | null;
  lolo?:             number | string | null;
  high?:             number | string | null;
  low?:              number | string | null;
  input_uom?:        string;
  output_uom?:       string;
  conversion_factor?: number | null;
}

function makeTagRow(model: string, r: TagRowInput): unknown[] {
  return [
    model,
    r.name_short,
    r.pi_name ?? '',
    r.type ?? 'inferred',
    r.formula ?? '',
    r.hihi ?? '', r.lolo ?? '', r.high ?? '', r.low ?? '',
    r.uom ?? '',
    r.data_type ?? 'real',
    r.category ?? 'LBM_initialization_get_pi_data',
    r.design_value ?? null,
    r.formula_state ?? '',
    r.pipeline_location ?? 'LBM_CALC_1',
    true, true, true, true, false,
    '', '', '', false, '',
    '', '', r.ccp_default_value ?? null, '', '', '', '',
    r.input_uom ?? r.uom ?? '',
    r.output_uom ?? r.uom ?? '',
    r.conversion_factor ?? null,
    '',
  ];
}

// ── MFE output tag names (mirrors HTML tool's kmInjectMassFlowEstKpis) ────────
const MFE_KO_SUFFIXES = [
  ['KO_H2O_Removed',   'kg/h', 'CGC_S{n}_KO_H2O_Removed'],
  ['KO_HC_Condensate', 'kg/h', 'CGC_S{n}_KO_HC_Condensate'],
  ['KO_C3plus',        'kg/h', 'CGC_S{n}_KO_C3plus'],
  ['KO_C4plus',        'kg/h', 'CGC_S{n}_KO_C4plus'],
  ['KO_C5plus',        'kg/h', 'CGC_S{n}_KO_C5plus'],
  ['KO_Total_Liquid',  'kg/h', 'CGC_S{n}_KO_Total_Liquid'],
] as const;

// CDT engine inputs (cap threshold, BFW injection temp, corrected-temp floor)
// are mapped like any other raw input in the KPI Calculations tag mapping
// table, under these per-stage tag names — not stored on stage.design.
function findTagDesignValue(config: CgcConfig, name: string): number | null {
  const tag = config.raw_pi_tags.find(t => t.name === name);
  return tag?.design_value ?? null;
}

function normalizeExportUom(uom: string, tagName = ''): string {
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
    case '%mol':
      return 'mol%';
    default:
      return uom;
  }
}

// ── Bridge payload builder ────────────────────────────────────────────────────
export function buildBridgePayload(config: CgcConfig): { payload: BridgePayload; errors: string[]; notes: string[] } {
  const errors: string[] = [];
  const notes: string[] = [];
  const stages = config.stages;
  const stageCount = stages.length;

  if (stageCount < 1) errors.push('No stages configured.');

  const PR_MAP: Record<string, string> = {
    H2: 'H2', CH4: 'C1', C2H4: 'C2H4', C2H6: 'C2',
    C3H6: 'C3H6', C3H8: 'C3', C4_lmp: 'C4H8', C5plus: 'nC5',
    CO: 'CO', CO2: 'CO2',
  };
  const PR_UNSUPPORTED = ['N2', 'H2S', 'C2H2'];

  const components: string[] = [];
  const feed_composition_cols: Record<string, string> = {};
  for (const c of config.composition_components) {
    if (c.id === 'H2O') continue;
    if (PR_UNSUPPORTED.includes(c.id)) {
      if (c.id === 'C2H2') notes.push(`C2H2 has no independent PR-EOS entry — lumped into C2H4 reading.`);
      continue;
    }
    const prKey = PR_MAP[c.id];
    if (!prKey) { errors.push(`Component '${c.id}' has no PR-EOS mapping.`); continue; }
    components.push(prKey);
    feed_composition_cols[prKey] = `CGC_Feed_GC_${prKey}`;
  }

  const feedCfg = config.plant.feed;
  const water_mass_frac = feedCfg.water_mass_frac;

  const pft = config.plant.primary_flow_transmitter ?? {
    stage: stageCount, location: 'discharge' as const, is_wet: true,
  };
  const pftStage = Math.max(1, Math.min(stageCount, Number(pft.stage ?? stageCount)));
  const pftLocMap = { suction: 'Suction_Flow', discharge: 'Discharge_Flow', cooler_outlet: 'Aftercooler_Discharge_Flow' } as const;
  const pftSuffix = pftLocMap[pft.location as keyof typeof pftLocMap] ?? 'Discharge_Flow';
  const inlet_flow_col = `CGC_${ordinal(pftStage)}_Stage_${pftSuffix}`;

  const bridgeStages = stages.map((s, i) => {
    const n = i + 1;
    const ord = ordinal(n);
    const cap_threshold = findTagDesignValue(config, `CGC_Stage_${n}_Cap_Threshold`);
    const T_bfw_degC = findTagDesignValue(config, `CGC_Stage_${n}_Bfw_Temperature`);
    const floor_degC = findTagDesignValue(config, `CGC_Stage_${n}_Floor_Temperature`);
    if (cap_threshold == null) errors.push(`Stage ${n}: CGC_Stage_${n}_Cap_Threshold not mapped (KPI Calculations → Corrected Discharge Temperature).`);
    if (T_bfw_degC == null) errors.push(`Stage ${n}: CGC_Stage_${n}_Bfw_Temperature not mapped (KPI Calculations → Corrected Discharge Temperature).`);
    return {
      stage: n,
      suc_T_col:    `CGC_${ord}_Stage_Suction_Temperature`,
      suc_P_col:    `CGC_${ord}_Stage_Suction_Pressure`,
      dis_T_col:    `CGC_${ord}_Stage_Discharge_Temperature`,
      dis_P_col:    `CGC_${ord}_Stage_Discharge_Pressure`,
      cooler_T_col: `CGC_${ord}_Stage_Aftercooler_Discharge_Temperature`,
      cooler_P_col: `CGC_${ord}_Stage_Discharge_Pressure`,
      bfw_flow_col: s.bfw_injection.enabled ? `Bfw_Flow_Stage_${n}` : null,
      discharge_flow_col:         null,
      discharge_flow_unit_factor: 1.0,
      cap_threshold,
      T_bfw_degC,
      floor_degC,
      label: `Stage ${n}`,
    };
  });

  return {
    errors,
    notes,
    payload: {
      stage_count:           stageCount,
      components,
      feed_composition_cols,
      inlet_flow_col,
      water_mass_frac,
      stages:                bridgeStages,
      primary_flow_transmitter: { ...pft, stage: pftStage },
      unit_conversions:      {},
    },
  };
}

// ── Client-side XLSX builder ──────────────────────────────────────────────────
async function buildClientXlsx(config: CgcConfig): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const plant = config.plant;
  const caseName = plant.case_name || plant.plant_name || 'SQ OLF CGC';
  const tagPrefix = (plant as any).tag_prefix || 'cgc.olf.';
  const model = 'Live Benchmarking Model';

  // 1. Case_and_Models sheet
  const caseHdr = ['case_id','case_name','plant_id','tag_prefix','model_name','description','model_type','metric_id'];
  const caseRows: any[][] = [];
  for (const item of STATIC_EFF_DATA['Case_and_Models']) {
    const row = caseHdr.map(h => item[h]);
    if (row[6] === 'LBM') {
      row[1] = caseName;
      row[3] = tagPrefix;
    }
    caseRows.push(row);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([caseHdr, ...caseRows]), 'Case_and_Models');

  // 2. pi_tag_bank sheet
  const piBankHdr = ["plant", "subsystem", "model_name", "PI_Name", "Default_UOM", "Min_value", "max_value", "default_value", "CCP_rule"];
  const piBankRows: any[][] = [];
  for (const tag of config.raw_pi_tags) {
    if (tag.pi_tag) {
      piBankRows.push([
        null, null, model, tag.pi_tag, normalizeExportUom(tag.uom || '', tag.name),
        tag.min_val ?? null, tag.max_val ?? null, tag.design_value ?? 0.0, null
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([piBankHdr, ...piBankRows]), 'pi_tag_bank');

  // 3. Tags sheet
  const tagsHdr = [
    "model_name", "name_short", "pi_name", "type", "formula",
    "hihi", "lolo", "high", "low",
    "uom", "data_type", "category", "design_value", "formula_state",
    "pipeline_location",
    "flag_benchmark", "flag_actual", "flag_clean", "flag_ma", "flag_actual_run_always",
    "flag_inputcheck_nan", "flag_dataclean_filter", "flag_ma_filter", "has_child",
    "flag_clean_nan",
    "ccp_lolo", "ccp_hihi", "ccp_default_value", "ccp_oob_logic", "ccp_stuck_logic",
    "ccp_nan_logic", "ccp_default_logic",
    "input_uom", "output_uom", "conversion_factor",
    ""
  ];

  const tagMap = new Map(config.raw_pi_tags.map(t => [t.name, t]));
  const stagesMap = new Map(config.stages.map(s => [s.stage_number, s]));

  // The static Tags template is the full catalog of tag/KPI/formula rows the
  // reference workbook can contain. A row is applicable — and included —
  // unless it references a compressor stage that doesn't exist in this
  // configuration. Whether a KPI is "selected" in the Master KPI List, or a
  // raw PI tag has been mapped yet, does not gate inclusion here (mirrors
  // eff_builder.py's build_eff_workbook()).
  const tagsRows: any[][] = [];
  for (const item of STATIC_EFF_DATA['Tags']) {
    const name = item['name_short'];

    // 0. If this row references a specific compressor stage (by name), it's
    //    only applicable when that stage exists in this configuration —
    //    regardless of whether it's a raw PI tag, a KPI formula row, or a
    //    design tag. Checked first so a stage-4/5 raw tag doesn't leak into
    //    a 3-stage plant just because it happens to have a raw_pi_tags entry.
    let stageMatch = name.match(/(?:_S|Stage_?)(\d+)/i);
    if (!stageMatch) {
      const ordMatch = name.match(/(\d+)(?:st|nd|rd|th)/i);
      if (ordMatch) stageMatch = ordMatch;
    }
    if (stageMatch && !stagesMap.has(parseInt(stageMatch[1], 10))) {
      continue; // references a stage this plant doesn't have
    }

    // 1. Raw PI tag row — always include; overlay real mapped values
    //    (pi_name, uom, design_value, limits, ccp/conversion) only when a
    //    PI tag or constant value has actually been entered.
    if (tagMap.has(name)) {
      const t = tagMap.get(name)!;
      const row = tagsHdr.slice(0, -1).map(h => item[h]);
      row.push(''); // trailing blank

      if (t.source_type === 'constant') {
        // No PI tag exists for this input — the user supplied a fixed value
        // instead, which still needs to reach the EFF workbook.
        row[2] = null; // pi_name (no PI source)
        row[3] = 'constant';
        row[9] = normalizeExportUom(t.uom || '', name);
        row[12] = t.design_value ?? null;
        row[32] = normalizeExportUom(t.input_uom || t.uom || '', name);
        row[33] = normalizeExportUom(t.output_uom || t.uom || '', name);
      } else if (t.pi_tag) {
        row[2] = t.pi_tag || null;
        row[3] = 'pi';
        row[9] = normalizeExportUom(t.uom || '', name);
        row[12] = t.design_value ?? null;
        row[5] = t.max_val ?? null;
        row[6] = t.min_val ?? null;
        row[7] = t.max_val ?? null;
        row[8] = t.min_val ?? null;
        row[27] = t.ccp_default ?? null;
        row[32] = normalizeExportUom(t.input_uom || t.uom || '', name);
        row[33] = normalizeExportUom(t.output_uom || t.uom || '', name);
        row[34] = t.conversion_factor === 1.0 ? null : (t.conversion_factor ?? null);
      }
      row[9] = normalizeExportUom(String(row[9] || ''), name);
      tagsRows.push(row);
      continue;
    }

    // 2. Stage-tagged row (KPI/design tag referencing a specific compressor
    //    stage) — stage applicability already checked above.
    if (stageMatch) {
      const sn = parseInt(stageMatch[1], 10);
      const stage = stagesMap.get(sn)!;

      const row = tagsHdr.slice(0, -1).map(h => item[h]);
      row.push(''); // trailing blank
      const d = stage.design;
      // CDT engine inputs (Cap_Threshold, Bfw_Temperature, Floor_Temperature)
      // are separate raw-tag rows handled by branch 1 above, not overlaid here
      // — the _Discharge_Temperature_Corr(ected) KPI rows never carry a
      // design_value (verified against Demo_CGC_EFF (7) 4 (1).xlsx).
      if (name.includes('_Aftercooler_Clean_Dp_Normalised')) {
        row[4] = String(d.ac_dp_baseline_kgcm2 ?? 0.21);
      }
      row[9] = normalizeExportUom(String(row[9] || ''), name);
      tagsRows.push(row);
      continue;
    }

    // 3. Everything else (overall/non-stage KPIs, turbine tags, etc.) is
    //    always applicable regardless of stage count.
    const row = tagsHdr.slice(0, -1).map(h => item[h]);
    row.push(''); // trailing blank

    // Driver-panel config flags — these tag rows exist specifically to carry
    // the user's Driver panel choices into the EFF workbook, so they must
    // reflect the current config, not the static template's placeholder value.
    const driver = config.driver;
    if (name === 'CGC_Turbine_Has_Extraction') {
      row[12] = driver.has_extraction ? 1 : 0;
    } else if (name === 'CGC_Turbine_Has_Injection') {
      row[12] = driver.has_injection ? 1 : 0;
    } else if (name === 'CGC_Turbine_Has_Exhaust') {
      row[12] = driver.has_exhaust ? 1 : 0;
    } else if (name === 'CGC_Turbine_Primary_Method_Code') {
      const codes: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
      row[12] = codes[String(driver.primary_method || 'A').toUpperCase()] ?? 1;
    }

    row[9] = normalizeExportUom(String(row[9] || ''), name);
    tagsRows.push(row);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tagsHdr, ...tagsRows]), 'Tags');

  // 4. Pipeline_Parameters sheet
  const ppHdr = ["model_name", "category", "parameter", "value"];
  const dynamicParams: Record<string, any> = {
    plant_name: plant.plant_name,
    train: plant.train,
    driver_type: plant.driver_type,
    stage_count: config.stages.length,
    composition_basis: plant.composition_basis,
    pressure: plant.unit_system.pressure,
    temperature: plant.unit_system.temperature,
    mass_flow: plant.unit_system.mass_flow,
    power: plant.unit_system.power,
    water_mass_frac: plant.feed.water_mass_frac,
    rated_power_kw: plant.baselines.rated_power_kw,
    spc_benchmark_kw_t_h: plant.baselines.spc_benchmark_kw_t_h,
    cw_supply_temp_c: plant.baselines.cw_supply_temp_c,
    bfw_temp_c: plant.baselines.bfw_temp_c,
    steam_calorific_value_gj_t: plant.opportunity.steam_calorific_value_gj_t,
    energy_cost_usd_gj: plant.opportunity.energy_cost_usd_gj,
    co2_emission_factor: plant.opportunity.co2_emission_factor_t_per_t_steam
  };

  const ppRows: any[][] = [];
  for (const item of STATIC_EFF_DATA['Pipeline_Parameters']) {
    const row = ppHdr.map(h => item[h]);
    const param = item['parameter'];
    if (dynamicParams[param] !== undefined) {
      row[3] = dynamicParams[param];
    }
    ppRows.push(row);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ppHdr, ...ppRows]), 'Pipeline_Parameters');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── Workbook generation (pure — no download, no DB write) ────────────────────
//
// Single place that knows how to produce EFF workbook bytes: tries the
// FastAPI endpoint first, falls back to client-side XLSX generation. Both
// the "Generate EFF" (download) action and the "Save in Database" action
// call this instead of duplicating the backend/fallback logic.

export interface EffWorkbook {
  blob: Blob;
  filename: string;
}

function base64ToBlob(
  base64: string,
  mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export async function buildEffWorkbook(config: CgcConfig): Promise<EffWorkbook> {
  const plantName = (config.plant.plant_name || 'cgc').replace(/[^a-z0-9_-]/gi, '_');
  const filename  = `${plantName}_EFF.xlsx`;

  try {
    const res = await generateEffAction(config);
    if (res && res.success && res.base64) {
      const blob = base64ToBlob(res.base64);
      return { blob, filename: res.filename ?? filename };
    }
  } catch (err) {
    console.error("Backend EFF generation failed, falling back to client-side SheetJS:", err);
  }

  const blob = await buildClientXlsx(config);
  return { blob, filename };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type EffStatus = 'idle' | 'generating' | 'success' | 'error';

export interface GenerateEffOptions {
  /** Trigger a browser download of the generated workbook. Default true. */
  download?: boolean;
  /** Persist the generated workbook to instance_configurations. Default true. */
  saveToDatabase?: boolean;
}

export function useEffExport(instanceId: number | null) {
  const [status, setStatus] = useState<EffStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const generateEff = useCallback(async (config: CgcConfig, options: GenerateEffOptions = {}) => {
    const { download = true, saveToDatabase = true } = options;
    setStatus('generating');
    setError(null);

    try {
      const { blob, filename } = await buildEffWorkbook(config);

      if (saveToDatabase && instanceId) {
        await submitSnapshot(instanceId, config, await blobToBase64(blob));
      }
      if (download) {
        triggerDownload(blob, filename);
      }

      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), download ? 3000 : 4000);
  }, [instanceId]);

  /** "Save in Database" — reuses the same generation flow, skips the download. */
  const saveToDatabase = useCallback(
    (config: CgcConfig) => generateEff(config, { download: false, saveToDatabase: true }),
    [generateEff],
  );

  return { generateEff, saveToDatabase, status, error };
}


