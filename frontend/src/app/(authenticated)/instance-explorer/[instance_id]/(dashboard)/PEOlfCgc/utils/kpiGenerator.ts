import type { CgcConfig } from '../types/config';

export interface KpiSpec {
  name: string;
  category: string;
  uom: string;
  formula: string;
  inputs?: string[];
  type?: 'Final' | 'Intermediate';
}

function ordinal(n: number): string {
  return (['1st', '2nd', '3rd', '4th', '5th'] as const)[n - 1] ?? `${n}th`;
}

export function generateAllKpiSpecs(config: CgcConfig): KpiSpec[] {
  const stageCount = config.plant?.stage_count ?? 5;
  const stages = config.stages || [];
  const specs: KpiSpec[] = [];

  // ── 1. Corrected Discharge Temperature (CDT) ──────────────────────────
  for (let n = 1; n <= stageCount; n++) {
    const ord = ordinal(n);
    specs.push({
      name: `CGC_${ord}_Stage_Discharge_Temperature_Corr`,
      category: 'Corrected Discharge Temperature',
      uom: '°C',
      formula: `cgc_discharge_temp_corrected_v3.cgc_calc_isentropic_cap()`,
      inputs: [
        `CGC_${ord}_Stage_Suction_Temperature`,
        `CGC_${ord}_Stage_Discharge_Temperature`,
        `CGC_${ord}_Stage_Suction_Pressure`,
        `CGC_${ord}_Stage_Discharge_Pressure`,
        `CGC_Stage_${n}_Cap_Threshold`,
      ],
      type: 'Intermediate'
    });
    specs.push({
      name: `CGC_${ord}_Stage_Discharge_Temperature_Corrected`,
      category: 'Corrected Discharge Temperature',
      uom: '°C',
      formula: `cgc_discharge_temp_corrected_v3.cgc_calc_bfw_correction()`,
      inputs: [
        `CGC_${ord}_Stage_Discharge_Temperature_Corr`,
        `CGC_${ord}_Stage_Discharge_Pressure`,
        `Bfw_Flow_Stage_${n}`,
        n === 5 ? `CGC_5th_Stage_Discharge_Flow` : `CGC_${ord}_Stage_Discharge_flow`,
        `CGC_${ord}_Stage_mix_Cp`,
        `CGC_Stage_${n}_Bfw_Temperature`,
        `CGC_Stage_${n}_Floor_Temperature`,
      ],
      type: 'Final'
    });
  }

  // ── 2. Mass Flow Estimation (MFE) ────────────────────────────────────
  const GC_COMPS = ['H2', 'CH4', 'C2H2', 'C2H4', 'C2H6', 'C3H4', 'C3H6', 'C3H8', 'C4S', 'C5_Above', 'C6_To_C8', 'C9_Plus', 'H2S', 'H2O'];
  const gcAllTags = GC_COMPS.map(c => `CGC_Feed_GC_${c}`);
  const LOCS = [
    { key: "Suction", abbr: "SUC" },
    { key: "Discharge", abbr: "DIS" },
    { key: "KO Drum Outlet", abbr: "KO" },
  ];
  const SUCTION_SIDE = new Set(["before_suction_drum", "before_compressor"]);
  const IS_GC_COMPS = ["H2", "C1", "C2H4", "C2", "C3H6", "C3", "iC4", "nC4"];

  let globalIsIdx = 0;
  const inletStreamsByStage: Record<number, any[]> = {};
  stages.forEach((stage, si) => {
    const stageNum = si + 1;
    (stage.additional_streams || []).forEach(stream => {
      if (SUCTION_SIDE.has(stream.location || "before_compressor") && stream.name) {
        globalIsIdx++;
        if (!inletStreamsByStage[stageNum]) inletStreamsByStage[stageNum] = [];
        inletStreamsByStage[stageNum].push({ globalIdx: globalIsIdx, stream });
      }
    });
  });

  for (let n = 1; n <= stageCount; n++) {
    const ord = ordinal(n);
    const stageCfg = stages[n - 1] || {};
    const stageLocs = stageCfg.has_discharge_drum === false
      ? LOCS.filter(loc => loc.abbr !== "KO")
      : LOCS;
    const nextOrd = ordinal(n + 1);
    const koT = n < stageCount ? `CGC_${nextOrd}_Stage_Suction_Temperature` : `CGC_${ord}_Stage_Discharge_Temperature`;
    const koP = n < stageCount ? `CGC_${nextOrd}_Stage_Suction_Pressure` : `CGC_${ord}_Stage_Discharge_Pressure`;
    const koInputs = [koT, koP];
    const disInputs = [`CGC_${ord}_Stage_Discharge_Temperature`];
    const compNote = n === 1
      ? "feed composition from GC analyser (Stage 1 only)"
      : `composition propagated from Stage ${n - 1} KO outlet`;

    const stageIS = inletStreamsByStage[n] || [];

    specs.push({
      name: `CGC_${ord}_Stage_Suction_Wet_Mass_Flow`,
      category: 'Mass Flow Estimation',
      uom: 'kg/h',
      formula: n === 1
        ? `PR EOS back-calculated wet mass flow at Stage 1 suction`
        : `Wet vapour mass flow entering Stage ${n}, propagated from Stage ${n - 1} KO outlet`,
      inputs: n === 1
        ? ["CGC_1st_stage_Discharge_flow", ...gcAllTags, `CGC_${ord}_Stage_Suction_Temperature`, `CGC_${ord}_Stage_Suction_Pressure`]
        : [`CGC_${ord}_Stage_Suction_Temperature`, `CGC_${ord}_Stage_Suction_Pressure`],
      type: 'Final'
    });
    specs.push({
      name: `CGC_${ord}_Stage_Suction_Dry_Mass_Flow`,
      category: 'Mass Flow Estimation',
      uom: 'kg/h',
      formula: `Dry gas mass flow entering Stage ${n} after water removal calculation`,
      inputs: n === 1 ? ["CGC_Feed_GC_H2O", `CGC_${ord}_Stage_Suction_Temperature`, `CGC_${ord}_Stage_Suction_Pressure`] : [],
      type: 'Final'
    });
    specs.push({
      name: `CGC_${ord}_Stage_Suction_MW`,
      category: 'Mass Flow Estimation',
      uom: 'kg/kmol',
      formula: `PR EOS mixture molecular weight at Stage ${n} suction`,
      inputs: [],
      type: 'Intermediate'
    });
    specs.push({
      name: `CGC_${ord}_Stage_Suction_Water_Fraction`,
      category: 'Mass Flow Estimation',
      uom: '-',
      formula: `Water mass fraction in wet gas entering Stage ${n}`,
      inputs: [],
      type: 'Intermediate'
    });

    stageLocs.forEach(loc => {
      let wetInputs: string[] = [];
      let dryInputs: string[] = [];
      if (n === 1 && loc.abbr === 'SUC') {
        wetInputs = ["CGC_1st_stage_Discharge_flow", ...gcAllTags, "CGC_1st_Stage_Suction_Temperature", "CGC_1st_Stage_Suction_Pressure"];
        dryInputs = ["CGC_1st_stage_Discharge_flow", "CGC_1st_Stage_Suction_Temperature", "CGC_1st_Stage_Suction_Pressure"];
      } else if (loc.abbr === 'KO') {
        wetInputs = koInputs;
        dryInputs = n === 1 ? ["CGC_Feed_GC_H2O", ...koInputs] : [];
      } else if (loc.abbr === 'DIS') {
        wetInputs = disInputs;
        dryInputs = n === 1 ? ["CGC_Feed_GC_H2O", ...disInputs] : [];
      } else {
        wetInputs = [`CGC_${ord}_Stage_Suction_Temperature`, `CGC_${ord}_Stage_Suction_Pressure`];
        dryInputs = [];
      }

      if (loc.abbr === 'SUC' && stageIS.length > 0) {
        stageIS.forEach(({ globalIdx, stream }) => {
          const pfx = `CGC_IS${globalIdx}`;
          if ((stream.flow_availability || 'tag') !== 'unavailable') {
            wetInputs.push(`${pfx}_Flow`);
            dryInputs.push(`${pfx}_Flow`);
          }
          if (stream.has_gc_analyzer) {
            IS_GC_COMPS.forEach(c => wetInputs.push(`${pfx}_GC_${c}`));
          } else if (stream.component_mass_flow_cols && Object.keys(stream.component_mass_flow_cols).length) {
            Object.values(stream.component_mass_flow_cols).forEach(col => wetInputs.push(col as string));
          }
        });
      }

      const wetFormula = n === 1 && loc.abbr === 'SUC'
        ? `brentq(F1_suc): PR_EOS_propagate(F1_suc, z_feed) = CGC_1st_stage_Discharge_flow`
        : `Stage ${n} ${loc.key} wet mass flow — propagated from ${n === 1 ? 'S1 suction' : `S${n - 1} KO vapour`}`;

      const dryFormula = n === 1 && loc.abbr === 'SUC'
        ? `CGC_S1_SUC_Flow_Wet × (1 - y_H₂O_sat)`
        : `CGC_S${n}_${loc.abbr}_Flow_Wet × (1 - x_H₂O)`;

      specs.push({
        name: `CGC_S${n}_${loc.abbr}_Flow_Wet`,
        category: 'Mass Flow Estimation',
        uom: 'kg/h',
        formula: wetFormula,
        inputs: wetInputs,
        type: 'Intermediate'
      });
      specs.push({
        name: `CGC_S${n}_${loc.abbr}_Flow_Dry`,
        category: 'Mass Flow Estimation',
        uom: 'kg/h',
        formula: dryFormula,
        inputs: dryInputs,
        type: 'Intermediate'
      });
      specs.push({
        name: `CGC_S${n}_${loc.abbr}_MW`,
        category: 'Mass Flow Estimation',
        uom: 'kg/kmol',
        formula: `Σ(y_i × MW_i) over vapour composition at Stage ${n} ${loc.key}`,
        inputs: [],
        type: 'Intermediate'
      });
    });

    if (stageCfg.has_discharge_drum !== false) {
      specs.push({
        name: `CGC_S${n}_KO_Vapor_Fraction`, category: 'Mass Flow Estimation', uom: '-',
        formula: `V_mol / F_in — two-pass flash at S${n} KO`, inputs: koInputs, type: 'Final'
      });
      specs.push({
        name: `CGC_S${n}_KO_H2O_Removed`, category: 'Mass Flow Estimation', uom: 'kg/h',
        formula: `F_in×(z_H₂O - Psat(T)/P)/(1 - Psat(T)/P)×MW_H₂O`, inputs: koInputs, type: 'Final'
      });
      specs.push({
        name: `CGC_S${n}_KO_HC_Removed`, category: 'Mass Flow Estimation', uom: 'kg/h',
        formula: `PR EOS flash on water-lean stream at S${n} KO → liquid phase total mass`, inputs: koInputs, type: 'Final'
      });
      specs.push({
        name: `CGC_S${n}_KO_C3Plus_Removed`, category: 'Mass Flow Estimation', uom: 'kg/h',
        formula: `Σ(L_i×MW_i) for carbon_number(i)≥3 in HC condensate at S${n} KO`, inputs: [], type: 'Intermediate'
      });
      specs.push({
        name: `CGC_S${n}_KO_C4Plus_Removed`, category: 'Mass Flow Estimation', uom: 'kg/h',
        formula: `Σ(L_i×MW_i) for carbon_number(i)≥4 in HC condensate at S${n} KO`, inputs: [], type: 'Intermediate'
      });
      specs.push({
        name: `CGC_S${n}_KO_Total_Liquid_Removed`, category: 'Mass Flow Estimation', uom: 'kg/h',
        formula: `CGC_S${n}_KO_H2O_Removed + CGC_S${n}_KO_HC_Removed`, inputs: [], type: 'Final'
      });
      specs.push({
        name: `CGC_S${n}_KO_Dry_Gas_Flow`, category: 'Mass Flow Estimation', uom: 'kg/h',
        formula: `Dry vapour mass flow leaving S${n} KO drum`, inputs: [], type: 'Intermediate'
      });
      specs.push({
        name: `CGC_S${n}_KO_Dry_Gas_MW`, category: 'Mass Flow Estimation', uom: 'kg/kmol',
        formula: `Σ(y_i × MW_i) over dry vapour leaving S${n} KO drum`, inputs: [], type: 'Intermediate'
      });

      GC_COMPS.forEach(comp => {
        specs.push({
          name: `CGC_S${n}_KO_Comp_${comp}`,
          category: 'Mass Flow Estimation',
          uom: 'mol%',
          formula: n === 1 ? `y_${comp} at S1 KO — from GC feed + flash` : `y_${comp} at S${n} KO — propagated from S${n-1} KO`,
          inputs: n === 1 ? [`CGC_Feed_GC_${comp}`, ...koInputs] : [],
          type: 'Intermediate'
        });
      });
    }
  }

  // GC Feed Compositions
  GC_COMPS.forEach(comp => {
    specs.push({
      name: `CGC_Feed_GC_${comp}`,
      category: 'Mass Flow Estimation',
      uom: 'mol%',
      formula: `Raw GC analyser input for ${comp} at Stage 1 inlet`,
      inputs: [`CGC_Feed_GC_${comp}`],
      type: 'Intermediate'
    });
  });

  // Flow Transmitters
  specs.push({
    name: 'FT_4401_Measured_Flow',
    category: 'Mass Flow Estimation',
    uom: 'kg/h',
    formula: 'Raw PI input (primary FT, Stage 4 cooler outlet)',
    inputs: ['CGC_1st_stage_Discharge_flow'],
    type: 'Intermediate'
  });

  // Additional streams kpis
  Object.values(inletStreamsByStage).flat().forEach(({ globalIdx, stream }) => {
    const pfx = `CGC_IS${globalIdx}`;
    const lbl = stream.name || `Inlet Stream ${globalIdx}`;
    if ((stream.flow_availability || 'tag') !== 'unavailable') {
      specs.push({
        name: `${pfx}_Flow`,
        category: 'Mass Flow Estimation',
        uom: 'kg/h',
        formula: stream.source_tag_name && !stream.source_pi_tag ? `${pfx}_Flow = ${stream.source_tag_name}` : `Raw PI flow input for ${lbl}`,
        inputs: stream.source_tag_name && !stream.source_pi_tag ? [stream.source_tag_name] : [`${pfx}_Flow`],
        type: 'Final'
      });
    }
    if (stream.has_gc_analyzer) {
      IS_GC_COMPS.forEach(comp => {
        specs.push({
          name: `${pfx}_GC_${comp}`, category: 'Mass Flow Estimation', uom: 'mol%',
          formula: `Raw GC input — ${comp} mol% in ${lbl}`, inputs: [`${pfx}_GC_${comp}`], type: 'Intermediate'
        });
      });
    } else if (stream.component_mass_flow_cols && Object.keys(stream.component_mass_flow_cols).length) {
      Object.entries(stream.component_mass_flow_cols).forEach(([comp, col]) => {
        specs.push({
          name: `${pfx}_CompMass_${comp}`, category: 'Mass Flow Estimation', uom: 'kg/h',
          formula: `Raw component mass flow for ${comp} in ${lbl}`, inputs: [col as string], type: 'Intermediate'
        });
      });
    }
  });

  // ── 3. Stage-Specific KPIs (Stage 1 to 5) ─────────────────────────────
  for (let n = 1; n <= stageCount; n++) {
    const ord = ordinal(n);
    const nextOrd = ordinal(n + 1);
    const stageCfg = stages[n - 1] || {};
    const cat = `Stage ${n}`;

    specs.push({ name: `CGC_${ord}_Stage_Pressure_Ratio`, category: cat, uom: '', formula: `(CGC_${ord}_Stage_Discharge_Pressure+Atmospheric_Pressure_Abs)/(CGC_${ord}_Stage_Suction_Pressure+Atmospheric_Pressure_Abs)`, type: 'Final' });
    specs.push({ name: `CGC_${ord}_Stage_Molecular_Weight_Ratio`, category: cat, uom: '', formula: `CGC_${ord}_Stage_Suction_MW/28.97`, type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_Temperature_Ratio`, category: cat, uom: '', formula: `(CGC_${ord}_Stage_Discharge_Temperature_Corrected+273.15)/(CGC_${ord}_Stage_Suction_Temperature+273.15)`, type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_Avg_Temperature`, category: cat, uom: 'K', formula: `((CGC_${ord}_Stage_Suction_Temperature+273.15)+(CGC_${ord}_Stage_Discharge_Temperature_Corrected+273.15))/2`, type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_K_Value_Suc`, category: cat, uom: '', formula: 'cgc_eff_bridge.isentropic_exponent_from_eos() [suction]', type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_K_Value_Dis`, category: cat, uom: '', formula: 'cgc_eff_bridge.isentropic_exponent_from_eos() [discharge]', type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_K_Value`, category: cat, uom: '', formula: `(CGC_${ord}_Stage_K_Value_Suc+CGC_${ord}_Stage_K_Value_Dis)/2`, type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_K_Factor`, category: cat, uom: '', formula: `(CGC_${ord}_Stage_K_Value-1)/CGC_${ord}_Stage_K_Value`, type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_Efficiency`, category: cat, uom: '%', formula: `CGC_${ord}_Stage_K_Factor*ln(CGC_${ord}_Stage_Pressure_Ratio)/ln(CGC_${ord}_Stage_Temperature_Ratio)*100`, type: 'Final' });
    specs.push({ name: `CGC_${ord}_Stage_N`, category: cat, uom: '', formula: `CGC_${ord}_Stage_Efficiency*0.01/CGC_${ord}_Stage_K_Factor`, type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_N_Inverse`, category: cat, uom: '', formula: `1/CGC_${ord}_Stage_N`, type: 'Intermediate' });
    specs.push({ name: `CGC_${ord}_Stage_Polytropic_Head`, category: cat, uom: 'm', formula: `((1000*((CGC_${ord}_Stage_Suction_Z+CGC_${ord}_Stage_Discharge_Z)/2)*(8.314/CGC_${ord}_Stage_Suction_MW)*(CGC_${ord}_Stage_Suction_Temperature+273.15))/9.81)*CGC_${ord}_Stage_N*((CGC_${ord}_Stage_Pressure_Ratio^CGC_${ord}_Stage_N_Inverse)-1)`, type: 'Final' });
    specs.push({ name: `CGC_${ord}_Stage_Power`, category: cat, uom: 'kW', formula: `9.81*CGC_${ord}_Stage_Polytropic_Head*CGC_${ord}_Stage_Discharge_Flow*10^-6/(3.6*CGC_${ord}_Stage_Efficiency*0.01)`, type: 'Final' });
    specs.push({ name: `Volumetric_Flow_Suction_${ord}_Stage`, category: cat, uom: 'm³/h', formula: `CGC_${ord}_Stage_Suction_Z*8.478*0.01*CGC_${ord}_Stage_Discharge_Flow*(CGC_${ord}_Stage_Suction_Temperature+273.15)/(CGC_${ord}_Stage_Suction_MW*(CGC_${ord}_Stage_Suction_Pressure+Atmospheric_Pressure_Abs))`, type: 'Intermediate' });
    specs.push({ name: `Volumetric_Flow_Discharge_${ord}_Stage`, category: cat, uom: 'm³/h', formula: `CGC_${ord}_Stage_Discharge_Z*8.478*0.01*CGC_${ord}_Stage_Discharge_Flow*(CGC_${ord}_Stage_Discharge_Temperature+273.15)/(CGC_${ord}_Stage_Discharge_MW*(CGC_${ord}_Stage_Discharge_Pressure+Atmospheric_Pressure_Abs))`, type: 'Intermediate' });

    if (n < stageCount && stageCfg.has_aftercooler !== false) {
      specs.push({ name: `CGC_${ord}_Stage_Aftercooler_Duty`, category: cat, uom: 'Gcal/h', formula: `(CGC_${ord}_Stage_Discharge_Flow*CGC_${ord}_Stage_mix_Cp*(CGC_${ord}_Stage_Discharge_Temperature-CGC_${nextOrd}_Stage_Suction_Temperature)+CGC_S${n}_KO_H2O_Removed*Water_Condensation_Latent_Heat_KJ_KG+CGC_S${n}_KO_HC_Removed*HC_Condensation_Latent_Heat_KJ_KG)/4184000`, type: 'Final' });
      specs.push({ name: `CGC_${ord}_Stage_Hot_Approach`, category: cat, uom: '°C', formula: `CGC_${nextOrd}_Stage_Suction_Temperature-Cooling_Water_Supply_Temperature`, type: 'Final' });
      specs.push({ name: `CGC_${ord}_Stage_UA`, category: cat, uom: 'kW/°C', formula: `CGC_${ord}_Stage_Aftercooler_Duty/CGC_${ord}_Stage_Hot_Approach`, type: 'Final' });
      specs.push({ name: `CGC_${ord}_Stage_Fouling_Index`, category: cat, uom: '', formula: `10000/CGC_${ord}_Stage_UA`, type: 'Final' });
      specs.push({ name: `Pressure_Drop_Across_${ord}_Stage_Aftercooler`, category: cat, uom: 'kg/cm²(g)', formula: `CGC_${ord}_Stage_Discharge_Pressure-CGC_${nextOrd}_Stage_Suction_Pressure`, type: 'Final' });
      specs.push({ name: `CGC_Stage_${ord}_Aftercooler_Dp_Normalised`, category: cat, uom: '', formula: `Pressure_Drop_Across_${ord}_Stage_Aftercooler*100000/Volumetric_Flow_Discharge_${ord}_Stage`, type: 'Intermediate' });
      specs.push({ name: `CGC_${ord}_Stage_Aftercooler_Clean_Dp_Normalised`, category: cat, uom: '', formula: `${stageCfg.design?.ac_dp_baseline_kgcm2 ?? 0.21}`, type: 'Intermediate' });
      specs.push({ name: `Fouling_Index_${ord}_Stage_Percentage_Dp_Basis`, category: cat, uom: '%', formula: `if(CGC_Stage_${ord}_Aftercooler_Dp_Normalised<=0,0,max(0,min(100,(1-CGC_${ord}_Stage_Aftercooler_Clean_Dp_Normalised/CGC_Stage_${ord}_Aftercooler_Dp_Normalised)*100)))`, type: 'Final' });
    }
  }

  // ── 4. Overall KPIs ───────────────────────────────────────────────────
  const lastOrd = ordinal(stageCount);
  const addTerms = (template: string, limit = stageCount) => 
    Array.from({ length: limit }, (_, i) => template.replaceAll("{ord}", ordinal(i + 1))).join("+");
  
  const acOrds = Array.from({ length: stageCount - 1 }, (_, i) => i + 1)
    .filter(n => (stages[n - 1] || {}).has_aftercooler !== false)
    .map(ordinal);

  const totalAcOrds = acOrds.length ? acOrds.map(ord => `Fouling_Index_${ord}_Stage_Percentage_Dp_Basis`).join(',') : '0';

  specs.push({ name: 'CGC_Total_Pressure_Ratio', category: 'Overall', uom: '', formula: `(CGC_${lastOrd}_Stage_Discharge_Pressure+Atmospheric_Pressure_Abs)/(CGC_1st_Stage_Suction_Pressure+Atmospheric_Pressure_Abs)`, type: 'Final' });
  specs.push({ name: 'CGC_Total_Differential_Pressure', category: 'Overall', uom: 'kg/cm²(g)', formula: `CGC_${lastOrd}_Stage_Discharge_Pressure-CGC_1st_Stage_Suction_Pressure`, type: 'Final' });
  specs.push({ name: 'CGC_Total_Polytropic_Head', category: 'Overall', uom: 'm', formula: addTerms("CGC_{ord}_Stage_Polytropic_Head"), type: 'Final' });
  specs.push({ name: 'CGC_Total_Compressor_Power', category: 'Overall', uom: 'kW', formula: addTerms("CGC_{ord}_Stage_Power"), type: 'Final' });
  specs.push({ name: 'CGC_Efficiency', category: 'Overall', uom: '%', formula: `(${addTerms("CGC_{ord}_Stage_Power*CGC_{ord}_Stage_Efficiency")})/max(CGC_Total_Compressor_Power,0.000001)`, type: 'Final' });
  specs.push({ name: 'CGC_Efficiency_Simple_Avg', category: 'Overall', uom: '%', formula: `(${addTerms("CGC_{ord}_Stage_Efficiency")})/${stageCount}`, type: 'Final' });
  specs.push({ name: 'CGC_Compressor_Specific_Power', category: 'Overall', uom: 'kW/t', formula: `CGC_Total_Compressor_Power/max(CGC_${lastOrd}_Stage_Discharge_Flow/1000,0.000001)`, type: 'Final' });
  specs.push({ name: 'CGC_Power_Margin', category: 'Overall', uom: '%', formula: "max(0,(1-CGC_Total_Compressor_Power/max(CGC_Rated_Compressor_Power,0.000001))*100)", type: 'Final' });
  specs.push({ name: 'CGC_Driver_Load_Percent', category: 'Overall', uom: '%', formula: "CGC_Total_Compressor_Power/max(CGC_Rated_Compressor_Power,0.000001)*100", type: 'Final' });
  specs.push({ name: 'CGC_Turbine_Power_Balance_Error', category: 'Overall', uom: 'kW', formula: "turbine_power_output-CGC_Total_Compressor_Power", type: 'Final' });
  specs.push({ name: 'CGC_Turbine_Power_Balance_Error_Percent', category: 'Overall', uom: '%', formula: "(turbine_power_output-CGC_Total_Compressor_Power)/max(turbine_power_output,0.000001)*100", type: 'Final' });
  specs.push({ name: 'CGC_Capacity_Utilization', category: 'Overall', uom: '%', formula: `(CGC_${lastOrd}_Stage_Discharge_Flow/1000)/max(CGC_Design_Final_Discharge_Flow_TPH,0.000001)*100`, type: 'Final' });
  
  if (acOrds.length) {
    specs.push({ name: 'CGC_Total_Aftercooler_Duty', category: 'Overall', uom: 'Gcal/h', formula: acOrds.map(ord => `CGC_${ord}_Stage_Aftercooler_Duty`).join('+'), type: 'Final' });
    specs.push({ name: 'CGC_Total_Aftercooler_DP', category: 'Overall', uom: 'kg/cm²(g)', formula: acOrds.map(ord => `Pressure_Drop_Across_${ord}_Stage_Aftercooler`).join('+'), type: 'Final' });
    specs.push({ name: 'CGC_Total_Aftercooler_DP_Normalised', category: 'Overall', uom: '', formula: acOrds.map(ord => `CGC_Stage_${ord}_Aftercooler_Dp_Normalised`).join('+'), type: 'Final' });
    specs.push({ name: 'Fouling_Index_Final', category: 'Overall', uom: '%', formula: "max(0,min(100,(1-CGC_Clean_Total_Aftercooler_DP_Normalised/max(CGC_Total_Aftercooler_DP_Normalised,0.000001))*100))", type: 'Final' });
    specs.push({ name: 'CGC_Worst_Stage_Fouling_Index', category: 'Overall', uom: '%', formula: `max(${totalAcOrds})`, type: 'Final' });
    
    // worst stage index formula
    let worstStageExpr = String(stageCount - 1);
    const aftercoolerStageNumbers = Array.from({ length: stageCount - 1 }, (_, i) => i + 1).filter(n => (stages[n - 1] || {}).has_aftercooler !== false);
    for (let i = aftercoolerStageNumbers.length - 2; i >= 0; i--) {
      const curOrd = ordinal(aftercoolerStageNumbers[i]);
      worstStageExpr = `if(Fouling_Index_${curOrd}_Stage_Percentage_Dp_Basis==CGC_Worst_Stage_Fouling_Index,${aftercoolerStageNumbers[i]},${worstStageExpr})`;
    }
    specs.push({ name: 'CGC_Worst_Fouled_Stage_Index', category: 'Overall', uom: '', formula: worstStageExpr, type: 'Final' });
  }

  specs.push({ name: 'CGC_Min_Stage_Efficiency', category: 'Overall', uom: '%', formula: `min(${Array.from({ length: stageCount }, (_, i) => `CGC_${ordinal(i + 1)}_Stage_Efficiency`).join(',')})`, type: 'Final' });
  specs.push({ name: 'CGC_Max_Stage_Efficiency_Loss', category: 'Overall', uom: '%', formula: "max(0,CGC_Min_Healthy_Efficiency-CGC_Min_Stage_Efficiency)", type: 'Final' });

  // ── 5. Steam Turbine KPIs ─────────────────────────────────────────────
  if (config.plant?.driver_type === 'steam_turbine' || config.driver?.driver_type === 'steam_turbine') {
    specs.push({ name: 'turbine_calc_type', category: 'Steam Turbine', uom: '', formula: '', type: 'Intermediate' });
    specs.push({ name: 'turbine_power_output', category: 'Steam Turbine', uom: 'kW', formula: 'cgc_eff_bridge.steam_turbine_outputs_from_row() [turbine_power_output]', type: 'Final' });
    specs.push({ name: 'turbine_isen_power', category: 'Steam Turbine', uom: 'kW', formula: 'cgc_eff_bridge.steam_turbine_outputs_from_row() [turbine_isen_power]', type: 'Final' });
    specs.push({ name: 'turbine_noncondensing_power', category: 'Steam Turbine', uom: 'kW', formula: 'cgc_eff_bridge.steam_turbine_outputs_from_row() [turbine_noncondensing_power]', type: 'Final' });
    specs.push({ name: 'turbine_system_duty', category: 'Steam Turbine', uom: 'kW', formula: 'cgc_eff_bridge.steam_turbine_outputs_from_row() [turbine_system_duty]', type: 'Final' });
    specs.push({ name: 'turbine_overall_isen_eff', category: 'Steam Turbine', uom: '%', formula: 'turbine_power_output/turbine_isen_power*100', type: 'Final' });
    specs.push({ name: 'turbine_specific_steam', category: 'Steam Turbine', uom: 'kg/kWh', formula: 'turbine_steam_flow*1000/turbine_power_output', type: 'Final' });
    specs.push({ name: 'CGC_Turbine_Total_Specific_Power_Consumption', category: 'Steam Turbine', uom: 'kW/t', formula: `turbine_power_output/(CGC_${lastOrd}_Stage_Discharge_Flow)`, type: 'Final' });
    specs.push({ name: 'RPM_Margin_Turbine_1', category: 'Steam Turbine', uom: '%', formula: '(turbine_speed-CGC_Governor_Speed_RPM)/CGC_Governor_Speed_RPM*100', type: 'Final' });
    
    if (config.driver?.has_exhaust && config.driver?.exhaust_condensing) {
      specs.push({ name: 'turbine_exhaust_dryness', category: 'Steam Turbine', uom: '', formula: 'cgc_eff_bridge.steam_turbine_outputs_from_row() [turbine_exhaust_dryness]', type: 'Final' });
    }
    if (config.driver?.primary_method === 'B') {
      specs.push({ name: 'turbine_surface_condenser_duty', category: 'Steam Turbine', uom: 'kW', formula: 'cgc_eff_bridge.steam_turbine_outputs_from_row() [turbine_surface_condenser_duty]', type: 'Final' });
    }
  }

  return specs;
}

// Resolve each KPI's fully-flattened set of raw (non-KPI) input tags — if an
// input is itself another KPI (an intermediate calculation), recurse into
// that KPI's own inputs instead of listing the intermediate's name. This
// lets the UI show only Final KPIs while still surfacing every raw tag a
// Final KPI ultimately depends on, transitively through any intermediates.
export function resolveRawInputs(specs: KpiSpec[]): Map<string, string[]> {
  const byName = new Map(specs.map(s => [s.name, s]));
  const memo = new Map<string, string[]>();

  function rawLeaves(name: string, visiting: Set<string>): string[] {
    const cached = memo.get(name);
    if (cached) return cached;
    if (visiting.has(name)) return [];
    visiting.add(name);
    const spec = byName.get(name);
    const leaves = new Set<string>();
    (spec?.inputs || []).forEach(inp => {
      if (byName.has(inp)) {
        rawLeaves(inp, visiting).forEach(x => leaves.add(x));
      } else {
        leaves.add(inp);
      }
    });
    visiting.delete(name);
    const result = [...leaves].sort();
    memo.set(name, result);
    return result;
  }

  const out = new Map<string, string[]>();
  specs.forEach(s => out.set(s.name, rawLeaves(s.name, new Set())));
  return out;
}

