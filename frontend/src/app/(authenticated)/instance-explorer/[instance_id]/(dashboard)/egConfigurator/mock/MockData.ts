/**
 * Mock data for egConfigurator local development.
 *
 * USE_MOCK_DATA=true  → server actions read/write here (in-memory per process)
 * USE_MOCK_DATA=false → server actions use Prisma against real DB
 *
 * Simulates two plant instances so developers can test multi-instance behaviour
 * without any DB access.
 */

export interface MockInstance {
  instanceId: string;
  plantName: string;
  plantType: string;
  status: 'draft' | 'published';
  currentStep: number;
  configData: Record<string, unknown>;
  history: MockHistoryEntry[];
}

export interface MockHistoryEntry {
  id: string;
  version: number;
  stepSaved: string;
  savedAt: string;
  savedBy: string;
  snapshot: Record<string, unknown>;
}

// In-memory store — survives across requests within a single server process.
// On server restart it resets to these defaults (intentional for local dev).
const store = new Map<string, MockInstance>([
  [
    'mock-yansab-001',
    {
      instanceId: 'mock-yansab-001',
      plantName: 'Yansab',
      plantType: 'EG Plant',
      status: 'draft',
      currentStep: 1,
      configData: {},
      history: [],
    },
  ],
  [
    'mock-sabic-002',
    {
      instanceId: 'mock-sabic-002',
      plantName: 'SABIC EG Plant',
      plantType: 'EG Plant',
      status: 'draft',
      currentStep: 1,
      configData: {},
      history: [],
    },
  ],
]);

// ---------------------------------------------------------------------------
// KPI Template types
// ---------------------------------------------------------------------------

export interface MockKpiTemplate {
  id: string;
  section: string;
  name: string;
  formula: string;
  kpi_type: 'calculated_tag' | 'soft_sensor';
  uom: string;
  variables: string[];
}

export interface MockSoftSensor {
  id: string;
  name: string;
  x_variables: string[];
}

export interface MockAdditionalInput {
  id: string;
  name: string;
  attribute_name: string;
  uom: string;
  /** 'sensor' = PI tag, 'constant' = design constant (fixed numeric) */
  type: 'sensor' | 'constant';
}

// ---------------------------------------------------------------------------
// Dynamic KPI template builder
// Generates a filtered list based on the plant's Step 1 configuration.
// Mirrors the Flask app's show_condition logic without needing to parse Excel.
// ---------------------------------------------------------------------------

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function kpi(
  id: string,
  section: string,
  name: string,
  formula: string,
  kpi_type: 'calculated_tag' | 'soft_sensor',
  uom: string,
  variables: string[]
): MockKpiTemplate {
  return { id, section, name, formula, kpi_type, uom, variables };
}

/**
 * Builds a KPI list dynamically from the plant config saved in Step 1.
 * If configData is empty (wizard not started), returns a sensible base set.
 */
function buildKpiTemplates(configData: Record<string, unknown>): MockKpiTemplate[] {
  const templates: MockKpiTemplate[] = [];

  // ── helpers to read config flags safely ──────────────────────────────────
  const str = (k: string) => (configData[k] as string | undefined) ?? '';
  const yes = (k: string) => str(k).toLowerCase() === 'yes';
  const num = (k: string, fallback = 0) => parseInt(str(k) || String(fallback), 10) || fallback;
  const arr = <T,>(k: string): T[] => (configData[k] as T[] | undefined) ?? [];

  const hasGFS = yes('eq_hasGFS');
  const isIntegrated = str('eq_gfsArrangement') === 'Integrated Single Column';
  const hasSeparateGFS = hasGFS && !isIntegrated;

  // ── Steam System — one set of KPIs per real steam header ─────────────────
  interface SteamHeader { headerLabel?: string; isSuperheated?: string }
  const steamHeaders = arr<SteamHeader>('steamHeaders');
  // Fallback: if step 1 not yet saved, use numSteamHeaders count with generic labels
  const numHeaders = steamHeaders.length || num('numSteamHeaders', 0);

  for (let i = 0; i < numHeaders; i++) {
    const n = i + 1;
    const label = steamHeaders[i]?.headerLabel?.trim() || `Header ${n}`;
    const superheated = (steamHeaders[i]?.isSuperheated ?? '') === 'Yes';
    const sec = 'Steam System';

    templates.push(kpi(`steam_h${n}_pressure`, sec,
      `Steam Header ${n} (${label}) Pressure`,
      `Steam_Header_${n}_Pressure`, 'calculated_tag', 'barg',
      [`Steam_Header_${n}_Pressure`]));

    templates.push(kpi(`steam_h${n}_flow`, sec,
      `Steam Header ${n} (${label}) Total Flow`,
      `Steam_Header_${n}_Flow`, 'calculated_tag', 'T/hr',
      [`Steam_Header_${n}_Flow`]));

    templates.push(kpi(`steam_h${n}_sat_temp`, sec,
      `Steam Header ${n} (${label}) Saturation Temperature`,
      `f(Steam_Header_${n}_Pressure)`, 'calculated_tag', '°C',
      [`Steam_Header_${n}_Pressure`]));

    templates.push(kpi(`steam_h${n}_latent_heat`, sec,
      `Steam Header ${n} (${label}) Latent Heat of Vaporisation`,
      `f(Steam_Header_${n}_Pressure)`, 'calculated_tag', 'kJ/kg',
      [`Steam_Header_${n}_Pressure`]));

    // Superheated headers also get temperature & enthalpy change
    if (superheated) {
      templates.push(kpi(`steam_h${n}_temperature`, sec,
        `Steam Header ${n} (${label}) Temperature`,
        `Steam_Header_${n}_Temperature`, 'calculated_tag', '°C',
        [`Steam_Header_${n}_Temperature`]));

      templates.push(kpi(`steam_h${n}_enthalpy_change`, sec,
        `Steam Header ${n} (${label}) Enthalpy Change`,
        `f(Steam_Header_${n}_Pressure, Steam_Header_${n}_Temperature)`, 'calculated_tag', 'kJ/kg',
        [`Steam_Header_${n}_Pressure`, `Steam_Header_${n}_Temperature`]));
    }
  }

  // ── Stripping Column ──────────────────────────────────────────────────────
  const sec_sc = 'Stripping Column';
  templates.push(kpi('sc_feed_temperature', sec_sc, 'SC Feed Temperature', 'Sc_Feed_Temperature', 'calculated_tag', '°C', ['Sc_Feed_Temperature']));
  templates.push(kpi('sc_bottoms_temperature', sec_sc, 'SC Bottoms Temperature', 'Sc_Bottoms_Temperature', 'calculated_tag', '°C', ['Sc_Bottoms_Temperature']));

  if (yes('sc_hasReboiler')) {
    templates.push(kpi('sc_reboiler_duty', sec_sc, 'SC Reboiler Duty',
      'Sc_Reboiler_Steam_Flow * Sc_Reboiler_Steam_Enthalpy', 'calculated_tag', 'GJ/hr',
      ['Sc_Reboiler_Steam_Flow', 'Sc_Reboiler_Steam_Enthalpy']));
  }

  if (yes('sc_hasDirectSteam')) {
    templates.push(kpi('sc_direct_steam_flow', sec_sc, 'SC Total Direct Steam Flow',
      'Sc_Direct_Steam_Flow', 'calculated_tag', 'T/hr', ['Sc_Direct_Steam_Flow']));
  }

  if (yes('sc_hasBottomBleed')) {
    templates.push(kpi('sc_bottom_bleed_flow', sec_sc, 'SC Bottom Bleed Flow',
      'Sc_Bottom_Bleed_Flow', 'calculated_tag', 'T/hr', ['Sc_Bottom_Bleed_Flow']));
  }

  // ── Reabsorber — only when separate columns (not integrated) ─────────────
  if (!isIntegrated) {
    const sec_ra = 'Reabsorber';
    templates.push(kpi('ra_feed_temperature', sec_ra, 'Reabsorber Feed Temperature', 'Ra_Feed_Temperature', 'calculated_tag', '°C', ['Ra_Feed_Temperature']));
    templates.push(kpi('ra_overhead_temperature', sec_ra, 'Reabsorber Overhead Temperature', 'Ra_Overhead_Temperature', 'calculated_tag', '°C', ['Ra_Overhead_Temperature']));

    if (yes('ra_hasIntercooler')) {
      templates.push(kpi('ra_intercooler_duty', sec_ra, 'Reabsorber Intercooler Duty',
        'Ra_Intercooler_CW_Flow * Ra_Intercooler_CW_Delta_T * 4.18 / 3600', 'calculated_tag', 'GJ/hr',
        ['Ra_Intercooler_CW_Flow', 'Ra_Intercooler_CW_Delta_T']));
    }

    if (yes('ra_hasAftercooler')) {
      templates.push(kpi('ra_aftercooler_duty', sec_ra, 'Reabsorber Aftercooler Duty',
        'Ra_Aftercooler_Flow * Ra_Aftercooler_Delta_T * Cp / 3600', 'calculated_tag', 'GJ/hr',
        ['Ra_Aftercooler_Flow', 'Ra_Aftercooler_Delta_T']));
    }
  }

  // ── GFS — separate columns only ───────────────────────────────────────────
  if (hasSeparateGFS) {
    const sec_gfs = 'GFS';
    templates.push(kpi('gfs_overhead_temperature', sec_gfs, 'GFS Overhead Temperature', 'Gfs_Overhead_Temperature', 'calculated_tag', '°C', ['Gfs_Overhead_Temperature']));
    templates.push(kpi('gfs_bottoms_temperature', sec_gfs, 'GFS Bottoms Temperature', 'Gfs_Bottoms_Temperature', 'calculated_tag', '°C', ['Gfs_Bottoms_Temperature']));

    if (yes('gfs_hasReboiler')) {
      templates.push(kpi('gfs_reboiler_duty', sec_gfs, 'GFS Reboiler Duty',
        'Gfs_Reboiler_Steam_Flow * Gfs_Reboiler_Steam_Enthalpy', 'calculated_tag', 'GJ/hr',
        ['Gfs_Reboiler_Steam_Flow', 'Gfs_Reboiler_Steam_Enthalpy']));
    }

    if (yes('gfs_hasDirectSteam')) {
      templates.push(kpi('gfs_direct_steam_flow', sec_gfs, 'GFS Total Direct Steam Flow',
        'Gfs_Direct_Steam_Flow', 'calculated_tag', 'T/hr', ['Gfs_Direct_Steam_Flow']));
    }
  }

  // ── Integrated Column — when gfsArrangement = Integrated Single Column ───
  if (isIntegrated) {
    const sec_int = 'Integrated Column (RA + GFS)';
    templates.push(kpi('int_feed_temperature', sec_int, 'Integrated Column Feed Temperature', 'Int_Feed_Temperature', 'calculated_tag', '°C', ['Int_Feed_Temperature']));
    templates.push(kpi('int_overhead_temperature', sec_int, 'Integrated Column Overhead Temperature', 'Int_Overhead_Temperature', 'calculated_tag', '°C', ['Int_Overhead_Temperature']));
    templates.push(kpi('int_bottoms_temperature', sec_int, 'Integrated Column Bottoms Temperature', 'Int_Bottoms_Temperature', 'calculated_tag', '°C', ['Int_Bottoms_Temperature']));
  }

  // ── Feed Preheat — one KPI per exchanger in series ───────────────────────
  interface FpeExchanger { freshSteam?: string; heatSource?: string }
  const fpeExchangers = arr<FpeExchanger>('fpe_exchangers');
  const numFpe = fpeExchangers.length || num('fpe_numExchangers', 0);
  const sec_fpe = 'Feed Preheat';

  // Aggregate KPIs (always present if any exchangers)
  if (numFpe > 0) {
    templates.push(kpi('fpe_feed_inlet_temp', sec_fpe, 'Feed Preheat Train Inlet Temperature', 'Fpe_Feed_Inlet_Temperature', 'calculated_tag', '°C', ['Fpe_Feed_Inlet_Temperature']));
    templates.push(kpi('fpe_feed_outlet_temp', sec_fpe, 'Feed Preheat Train Outlet Temperature', 'Fpe_Feed_Outlet_Temperature', 'calculated_tag', '°C', ['Fpe_Feed_Outlet_Temperature']));
    templates.push(kpi('fpe_total_duty', sec_fpe, 'Feed Preheat Total Duty',
      'Fpe_Total_Duty', 'calculated_tag', 'GJ/hr', ['Fpe_Total_Duty']));
  }

  // Per-exchanger KPIs for fresh steam ones (they have a steam flow we must track)
  for (let i = 0; i < numFpe; i++) {
    const n = i + 1;
    const ex = fpeExchangers[i];
    const freshSteam = (ex?.freshSteam ?? '').toLowerCase() === 'yes';
    if (freshSteam) {
      templates.push(kpi(`fpe_ex${n}_steam_flow`, sec_fpe,
        `Feed Preheat Exchanger ${n} Steam Flow`,
        `Fpe_Exchanger_${n}_Steam_Flow`, 'calculated_tag', 'T/hr',
        [`Fpe_Exchanger_${n}_Steam_Flow`]));
    }
  }

  // ── Reactor ───────────────────────────────────────────────────────────────
  const numReactors = num('gr_numReactors', 1);
  const sec_gr = 'Reactor';

  for (let i = 0; i < numReactors; i++) {
    const n = i + 1;
    const suffix = numReactors > 1 ? ` (Reactor ${n})` : '';
    templates.push(kpi(`gr_r${n}_inlet_temp`, sec_gr, `Reactor${suffix} Inlet Temperature`,
      `Gr_Reactor_${n}_Inlet_Temperature`, 'calculated_tag', '°C', [`Gr_Reactor_${n}_Inlet_Temperature`]));
    templates.push(kpi(`gr_r${n}_outlet_temp`, sec_gr, `Reactor${suffix} Outlet Temperature`,
      `Gr_Reactor_${n}_Outlet_Temperature`, 'calculated_tag', '°C', [`Gr_Reactor_${n}_Outlet_Temperature`]));
  }

  if (yes('gr_heatRecovered')) {
    templates.push(kpi('gr_heat_recovery_duty', sec_gr, 'Reactor Heat Recovery Duty',
      'Gr_Heat_Recovery_Flow * Gr_Heat_Recovery_Delta_T * Cp / 3600', 'calculated_tag', 'GJ/hr',
      ['Gr_Heat_Recovery_Flow', 'Gr_Heat_Recovery_Delta_T']));
  }

  // Selectivity is always a soft sensor KPI
  templates.push(kpi('gr_selectivity', sec_gr, 'EG Reactor Selectivity',
    'Gr_MEG_Production / (Gr_MEG_Production + Gr_DEG_Production + Gr_TEG_Production) * 100',
    'soft_sensor', '%', ['Gr_MEG_Production', 'Gr_DEG_Production', 'Gr_TEG_Production']));

  // ── Evaporation ───────────────────────────────────────────────────────────
  const sec_ev = 'Evaporation';
  templates.push(kpi('ev_first_effect_steam_flow', sec_ev, '1st Effect Steam Flow',
    'Ev_1st_Effect_Steam_Flow', 'calculated_tag', 'T/hr', ['Ev_1st_Effect_Steam_Flow']));
  templates.push(kpi('ev_steam_economy', sec_ev, 'Evaporator Steam Economy',
    'Ev_Water_Evaporated / Ev_1st_Effect_Steam_Flow', 'soft_sensor', '-',
    ['Ev_Water_Evaporated', 'Ev_1st_Effect_Steam_Flow']));
  templates.push(kpi('ev_condensate_return', sec_ev, 'Evaporator Condensate Return',
    'Ev_Condensate_Return', 'calculated_tag', 'T/hr', ['Ev_Condensate_Return']));

  if (yes('ev_hasMVR')) {
    templates.push(kpi('ev_mvr_power', sec_ev, 'MVR Compressor Power',
      'Ev_MVR_Power', 'calculated_tag', 'kW', ['Ev_MVR_Power']));
  }

  if (yes('ev_hasTVR')) {
    templates.push(kpi('ev_tvr_motive_steam', sec_ev, 'TVR Motive Steam Flow',
      'Ev_TVR_Motive_Steam_Flow', 'calculated_tag', 'T/hr', ['Ev_TVR_Motive_Steam_Flow']));
  }

  // ── Other Equipment — one KPI per item in the list ───────────────────────
  if (yes('oe_hasOther')) {
    interface OeItem { oe_name?: string; oe_type?: string; oe_freshSteam?: string }
    const oeList = arr<OeItem>('oe_equipment');
    const numOe = Math.min(oeList.length, num('oe_numEquipment', oeList.length));

    for (let i = 0; i < numOe; i++) {
      const eq = oeList[i];
      const name = eq?.oe_name?.trim() || `Equipment ${i + 1}`;
      const freshSteam = (eq?.oe_freshSteam ?? '').toLowerCase() === 'yes';
      const idBase = `oe_${slug(name)}`;
      const sec_oe = `Other Equipment`;

      templates.push(kpi(`${idBase}_duty`, sec_oe,
        `${name} — Energy Duty`,
        `Oe_${slug(name)}_Duty`, 'calculated_tag', 'GJ/hr',
        [`Oe_${slug(name)}_Duty`]));

      if (freshSteam) {
        templates.push(kpi(`${idBase}_steam_flow`, sec_oe,
          `${name} — Steam Flow`,
          `Oe_${slug(name)}_Steam_Flow`, 'calculated_tag', 'T/hr',
          [`Oe_${slug(name)}_Steam_Flow`]));
      }
    }
  }

  // ── Plant Level (always present) ──────────────────────────────────────────
  const sec_pl = 'Plant Level';
  templates.push(kpi('plant_meg_production', sec_pl, 'MEG Production Rate',
    'MEG_Production_Rate', 'calculated_tag', 'T/hr', ['MEG_Production_Rate']));
  templates.push(kpi('plant_specific_steam', sec_pl, 'Specific Steam Consumption',
    'Total_Steam_Flow / MEG_Production_Rate', 'soft_sensor', 'T steam/T MEG',
    ['Total_Steam_Flow', 'MEG_Production_Rate']));
  templates.push(kpi('plant_specific_power', sec_pl, 'Specific Power Consumption',
    'Total_Power / MEG_Production_Rate', 'soft_sensor', 'kWh/T MEG',
    ['Total_Power', 'MEG_Production_Rate']));
  templates.push(kpi('plant_overall_energy', sec_pl, 'Overall Energy Intensity',
    'Total_Energy_Input / MEG_Production_Rate', 'soft_sensor', 'GJ/T MEG',
    ['Total_Energy_Input', 'MEG_Production_Rate']));
  templates.push(kpi('plant_water_eo_ratio', sec_pl, 'Operating Water-to-EO Molar Ratio',
    'Water_Flow / EO_Flow', 'soft_sensor', '-', ['Water_Flow', 'EO_Flow']));

  return templates;
}

/**
 * Additional Inputs — global PI tags / design constants needed by the digital
 * twin model but not tied to any single KPI formula.
 * In integrated mode these come from the "Additional inputs" sheet in EG Reactor KPIs.xlsx.
 */
const ADDITIONAL_INPUTS: MockAdditionalInput[] = [
  { id: 'ambient_temperature',        name: 'Ambient Temperature',                attribute_name: 'Ambient_Temperature',        uom: '°C',    type: 'sensor' },
  { id: 'plant_feed_flow',            name: 'Plant Feed Flow (EO + Water)',       attribute_name: 'Plant_Feed_Flow',            uom: 'T/hr',  type: 'sensor' },
  { id: 'eo_feed_flow',               name: 'EO Feed Flow',                       attribute_name: 'Eo_Feed_Flow',               uom: 'T/hr',  type: 'sensor' },
  { id: 'water_feed_flow',            name: 'Water Feed Flow',                    attribute_name: 'Water_Feed_Flow',            uom: 'T/hr',  type: 'sensor' },
  { id: 'cooling_water_inlet_temp',   name: 'Cooling Water Inlet Temperature',    attribute_name: 'Cooling_Water_Inlet_Temp',   uom: '°C',    type: 'sensor' },
  { id: 'cooling_water_outlet_temp',  name: 'Cooling Water Outlet Temperature',   attribute_name: 'Cooling_Water_Outlet_Temp',  uom: '°C',    type: 'sensor' },
  { id: 'raw_water_conductivity',     name: 'Raw Water Conductivity',             attribute_name: 'Raw_Water_Conductivity',     uom: 'µS/cm', type: 'sensor' },
  { id: 'meg_product_flow',           name: 'MEG Product Flow',                   attribute_name: 'MEG_Product_Flow',           uom: 'T/hr',  type: 'sensor' },
  { id: 'total_power_consumption',    name: 'Total Power Consumption',            attribute_name: 'Total_Power_Consumption',    uom: 'kW',    type: 'sensor' },
  { id: 'design_water_eo_ratio',      name: 'Design Water/EO Molar Ratio',        attribute_name: 'Design_Water_EO_Ratio',      uom: '-',     type: 'constant' },
  { id: 'eo_feed_purity',             name: 'EO Feed Purity (Design)',            attribute_name: 'Eo_Feed_Purity',            uom: '%',     type: 'constant' },
  { id: 'meg_product_concentration',  name: 'MEG Product Concentration (Design)', attribute_name: 'MEG_Product_Concentration',  uom: '%',     type: 'constant' },
];

const SOFT_SENSORS: MockSoftSensor[] = [
  { id: 'eg_selectivity', name: 'EG Reactor Selectivity', x_variables: ['Gr_Reactor_Outlet_Temperature', 'Gr_Reactor_Inlet_Temperature', 'Gr_EO_Concentration'] },
  { id: 'steam_economy', name: 'Evaporator Steam Economy', x_variables: ['Ev_1st_Effect_Steam_Flow', 'Ev_Feed_Flow', 'Ev_Feed_Concentration'] },
  { id: 'sc_sep_efficiency', name: 'Stripping Column Separation Efficiency', x_variables: ['Sc_Feed_Temperature', 'Sc_Bottoms_Temperature', 'Sc_Direct_Steam_Flow'] },
  { id: 'meg_production', name: 'MEG Production Rate (Soft)', x_variables: ['MEG_Product_Flow', 'MEG_Concentration'] },
  { id: 'specific_steam', name: 'Specific Steam Consumption (Soft)', x_variables: ['Total_Steam_Flow', 'MEG_Production_Rate'] },
];

export const MockDB = {
  listInstances(): MockInstance[] {
    return Array.from(store.values());
  },

  listKpiTemplates(configData: Record<string, unknown>): MockKpiTemplate[] {
    return buildKpiTemplates(configData);
  },

  listSoftSensors(): MockSoftSensor[] {
    return SOFT_SENSORS;
  },

  listAdditionalInputs(): MockAdditionalInput[] {
    return ADDITIONAL_INPUTS;
  },

  getInstance(instanceId: string): MockInstance | null {
    return store.get(instanceId) ?? null;
  },

  saveStep(
    instanceId: string,
    stepKey: string,
    stepData: Record<string, unknown>
  ): MockInstance {
    const instance = store.get(instanceId);
    if (!instance) throw new Error(`Mock instance not found: ${instanceId}`);

    // Merge step data into configData
    const updatedConfig = { ...instance.configData, ...stepData };

    // Append history entry
    const version = instance.history.length + 1;
    const historyEntry: MockHistoryEntry = {
      id: `hist-${instanceId}-v${version}`,
      version,
      stepSaved: stepKey,
      savedAt: new Date().toISOString(),
      savedBy: 'local-dev',
      snapshot: updatedConfig,
    };

    const updated: MockInstance = {
      ...instance,
      configData: updatedConfig,
      currentStep: Math.max(instance.currentStep, extractStepNumber(stepKey)),
      history: [...instance.history, historyEntry],
    };

    store.set(instanceId, updated);
    return updated;
  },

  updateStatus(instanceId: string, status: 'draft' | 'published'): MockInstance {
    const instance = store.get(instanceId);
    if (!instance) throw new Error(`Mock instance not found: ${instanceId}`);
    const updated = { ...instance, status };
    store.set(instanceId, updated);
    return updated;
  },
};

function extractStepNumber(stepKey: string): number {
  const match = stepKey.match(/step(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}
