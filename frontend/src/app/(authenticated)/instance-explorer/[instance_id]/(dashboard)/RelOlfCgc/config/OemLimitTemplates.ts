// ─── AFP Machine Config wizard — OEM Limits parameter templates ────────────
// Ported from Static Input/Domain_limit_rational.xlsx ("Domain Limit - Output
// Sheet": Group, Parameters, uom, Show only when columns). This is a distinct,
// richer parameter list than the Sensor Mapping templates (SensorTemplates.ts)
// — OEM Limits cover derived/process values (efficiencies, ratios, margins,
// averages) in addition to raw sensor tags, so each sub-asset group has its
// own OEM parameter list here rather than reusing sensorTemplate.
// `uom` is shown next to Parameter on the OEM Limits tab as a fixed,
// non-editable column (a few dimensionless parameters — e.g. Pressure Ratio,
// HP/LP Stage C Factor — have no uom in the source sheet). Design Low/High/
// Rated are intentionally left blank for manual per-instance entry — the
// sheet's own Min/Max/Rated columns were not carried over.
//
// Corrected two data-entry slips from the source sheet: DGS's "NDEX/NDEY
// Vibration" are "Always show" (source sheet had them gated on NDE Journal
// Bearing, inconsistent with DEX/DEY Vibration in the same group), and
// Mechanical's "JBTemp NDE Max" is gated on NDE Journal Bearing (source sheet
// had it gated on DE Journal Bearing).

import type { ShowWhenKey } from "./SensorTemplates";

export interface OemLimitTemplateItem {
  id: string;
  parameter: string;
  uom?: string;
  showWhen?: ShowWhenKey;
}

export const OEM_STAGE_TPL: OemLimitTemplateItem[] = [
  { id: "molecular_weight", parameter: "Molecular Weight", uom: "kg/kmol" },
  { id: "discharge_intercooler_pdi", parameter: "Discharge Intercooler PDI", uom: "bar(g)" },
  { id: "discharge_pressure", parameter: "Discharge Pressure", uom: "bar(g)" },
  { id: "discharge_temperature", parameter: "Discharge Temperature", uom: "°C" },
  { id: "suction_temperature", parameter: "Suction Temperature", uom: "°C" },
  { id: "mass_flowrate", parameter: "Mass Flowrate", uom: "kg/h" },
  { id: "polytropic_efficiency", parameter: "Polytropic Efficiency", uom: "%" },
  { id: "pressure_ratio", parameter: "Pressure Ratio" },
  { id: "suction_density", parameter: "Suction Density", uom: "kg/m³" },
  { id: "suction_pressure", parameter: "Suction Pressure", uom: "bar(g)" },
  { id: "temperature_ratio", parameter: "Temperature Ratio" },
  { id: "quench_tower_overhead_temperature", parameter: "Quench Tower Overhead Temperature", uom: "°C" },
  { id: "gap_surge_controller_and_recycle_valve_op", parameter: "Gap Surge Controller and Recycle Valve OP", uom: "%" },
  { id: "power", parameter: "Power", uom: "kW" },
  { id: "overall_power", parameter: "Overall Power", uom: "kW" },
  { id: "surge_margin", parameter: "Surge Margin", uom: "%" },
  { id: "suction_drum_level_avg", parameter: "Suction Drum Level Avg", uom: "%", showWhen: "kod" },
  { id: "suction_drum_level_measurement", parameter: "Suction Drum Level Measurement", uom: "%", showWhen: "kod" },
  { id: "cws_temperature", parameter: "CWS Temperature", uom: "°C" },
  { id: "depropanizer_overhead_temperature", parameter: "Depropanizer Overhead Temperature", uom: "°C" },
  { id: "cooler_hot_approach", parameter: "Cooler Hot Approach", uom: "°C" },
  { id: "temperature_drop_across_intercooler", parameter: "Temperature Drop across Intercooler", uom: "°C" },
  { id: "polytropic_head", parameter: "Polytropic Head", uom: "m" },
];

export const OEM_DGS_TPL: OemLimitTemplateItem[] = [
  { id: "de_primary_seal_vent_flowrate", parameter: "DE Primary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "de_dgs_primary_vent" },
  { id: "primary_seal_gas_supply_filter_dp", parameter: "Primary Seal Gas Supply Filter DP", uom: "bar(g)", showWhen: "seal_gas_filter" },
  { id: "dex_vibration", parameter: "DEX Vibration", uom: "µm" },
  { id: "dey_vibration", parameter: "DEY Vibration", uom: "µm" },
  { id: "axial_position", parameter: "Axial Position", uom: "mm" },
  { id: "nde_primary_seal_vent_flowrate", parameter: "NDE Primary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "nde_dgs_primary_vent" },
  { id: "ndex_vibration", parameter: "NDEX Vibration", uom: "µm" },
  { id: "ndey_vibration", parameter: "NDEY Vibration", uom: "µm" },
  { id: "de_separation_seal_gas_supply_pressure", parameter: "DE Separation Seal Gas Supply Pressure", uom: "bar(g)", showWhen: "de_dgs_separation_gas" },
  { id: "nde_separation_seal_gas_supply_pressure", parameter: "NDE Separation Seal Gas Supply Pressure", uom: "bar(g)", showWhen: "nde_dgs_separation_gas" },
  { id: "de_primary_seal_gas_supply_flowrate", parameter: "DE Primary Seal Gas Supply Flowrate", uom: "Nm³/h", showWhen: "de_dgs" },
  { id: "de_primary_seal_gas_supply_pdi", parameter: "DE Primary Seal Gas Supply PDI", uom: "bar(g)", showWhen: "de_dgs" },
  { id: "de_primary_seal_gas_supply_pdic_op", parameter: "DE Primary Seal Gas Supply PDIC OP", uom: "%", showWhen: "de_dgs" },
  { id: "nde_primary_seal_gas_supply_pdic_op", parameter: "NDE Primary Seal Gas Supply PDIC OP", uom: "%", showWhen: "nde_dgs" },
  { id: "nde_primary_seal_gas_supply_flowrate", parameter: "NDE Primary Seal Gas Supply Flowrate", uom: "Nm³/h", showWhen: "nde_dgs" },
  { id: "de_primary_seal_gas_pdi", parameter: "DE Primary Seal Gas PDI", uom: "bar(g)", showWhen: "de_dgs" },
  { id: "nde_primary_seal_gas_pdi", parameter: "NDE Primary Seal Gas PDI", uom: "bar(g)", showWhen: "nde_dgs" },
  { id: "secondary_seal_gas_supply_pdic_op", parameter: "Secondary Seal Gas Supply PDIC OP", uom: "%" },
  { id: "de_secondary_seal_gas_supply_flowrate", parameter: "DE Secondary Seal Gas Supply Flowrate", uom: "Nm³/h" },
  { id: "secondary_seal_gas_supply_pressure", parameter: "Secondary Seal Gas Supply Pressure", uom: "bar(g)" },
  { id: "secondary_seal_gas_supply_filter_dp", parameter: "Secondary Seal Gas Supply Filter DP", uom: "bar(g)" },
];

export const OEM_MECH_TPL: OemLimitTemplateItem[] = [
  { id: "active_tb_avg_temp", parameter: "Active TB Avg Temp", uom: "°C", showWhen: "thrust_bearing" },
  { id: "inactive_tb_avg_temp", parameter: "Inactive TB Avg Temp", uom: "°C", showWhen: "thrust_bearing" },
  { id: "de_jb_abs_temp_diff", parameter: "DE JB Abs Temp Diff", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "de_jb_avg_temp", parameter: "DE JB Avg Temp", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "dex_vibration", parameter: "DEX Vibration", uom: "µm" },
  { id: "dey_vibration", parameter: "DEY Vibration", uom: "µm" },
  { id: "jb_temperature_dea", parameter: "JB Temperature DEA", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "jb_temperature_deb", parameter: "JB Temperature DEB", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "jb_temperature_ndea", parameter: "JB Temperature NDEA", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "jb_temperature_ndeb", parameter: "JB Temperature NDEB", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "nde_jb_abs_temp_diff", parameter: "NDE JB Abs Temp Diff", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "nde_jb_avg_temp", parameter: "NDE JB Avg Temp", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "ndex_vibration", parameter: "NDEX Vibration", uom: "µm" },
  { id: "ndey_vibration", parameter: "NDEY Vibration", uom: "µm" },
  { id: "tb_avg_temp", parameter: "TB Avg Temp", uom: "°C", showWhen: "thrust_bearing" },
  { id: "axial_position_avg", parameter: "Axial Position Avg", uom: "mm" },
  { id: "axial_position_avg_abs", parameter: "Axial Position Avg Abs", uom: "mm" },
  { id: "de_max_vibration", parameter: "DE Max Vibration", uom: "µm" },
  { id: "high_axial_thrust_pd", parameter: "High Axial Thrust PD", uom: "bar(g)" },
  { id: "mass_flowrate", parameter: "Mass Flowrate", uom: "kg/h" },
  { id: "nde_max_vibration", parameter: "NDE Max Vibration", uom: "µm" },
  { id: "jbtemp_de_max", parameter: "JBTemp DE Max", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "jbtemp_nde_max", parameter: "JBTemp NDE Max", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "surge_margin", parameter: "Surge Margin", uom: "%" },
  { id: "suction_pressure", parameter: "Suction Pressure", uom: "bar(g)" },
  { id: "tb_temperature_active", parameter: "TB Temperature Active", uom: "°C", showWhen: "thrust_bearing" },
  { id: "tb_temperature_inactive", parameter: "TB Temperature InActive", uom: "°C", showWhen: "thrust_bearing" },
  { id: "polytropic_efficiency", parameter: "Polytropic Efficiency", uom: "%" },
  { id: "downstream_polytropic_efficiency", parameter: "Downstream Polytropic Efficiency", uom: "%" },
];

export const OEM_OIL_TPL: OemLimitTemplateItem[] = [
  { id: "lube_oil_cooler_outlet_temperature", parameter: "Lube Oil Cooler Outlet Temperature", uom: "°C", showWhen: "oil_cooler" },
  { id: "lube_oil_supply_pressure", parameter: "Lube Oil Supply Pressure", uom: "bar(g)" },
  { id: "main_oil_pump_discharge_pressure", parameter: "Main Oil Pump Discharge Pressure", uom: "bar(g)", showWhen: "main_oil_pump" },
  { id: "oil_console_level", parameter: "Oil Console Level", uom: "%", showWhen: "oil_console" },
  { id: "oil_console_temperature", parameter: "Oil Console Temperature", uom: "°C", showWhen: "oil_console" },
  { id: "oil_filter_differential_pressure", parameter: "Oil Filter Differential Pressure", uom: "bar(g)", showWhen: "oil_filter" },
  { id: "oil_pressure_cooler_outlet", parameter: "Oil Pressure Cooler Outlet", uom: "bar(g)", showWhen: "oil_cooler" },
  { id: "control_oil_pressure", parameter: "Control Oil Pressure", uom: "bar(g)" },
  { id: "cws_pressure", parameter: "CWS Pressure", uom: "bar(g)" },
  { id: "cws_temperature", parameter: "CWS Temperature", uom: "°C" },
  { id: "oil_cooler_effectiveness", parameter: "Oil Cooler Effectiveness" },
  { id: "cooler_hot_approach", parameter: "Cooler Hot Approach", uom: "°C" },
  { id: "standby_oil_pump_discharge_pressure", parameter: "Standby Oil Pump Discharge Pressure", uom: "bar(g)", showWhen: "standby_oil_pump" },
  { id: "lube_oil_run_down_tank_level", parameter: "Lube Oil Run Down Tank Level", uom: "%" },
];

export const OEM_TURB_TPL: OemLimitTemplateItem[] = [
  { id: "tb_avg_temp", parameter: "TB Avg Temp", uom: "°C", showWhen: "thrust_bearing" },
  { id: "extraction_valve_opening", parameter: "Extraction Valve Opening", uom: "%", showWhen: "extraction_condensing_turbine" },
  { id: "governor_valve_opening", parameter: "Governor Valve Opening", uom: "%" },
  { id: "lube_oil_cooler_outlet_temperature", parameter: "Lube Oil Cooler Outlet Temperature", uom: "°C", showWhen: "oil_cooler" },
  { id: "lube_oil_supply_pressure", parameter: "Lube Oil Supply Pressure", uom: "bar(g)" },
  { id: "exhaust_steam_efficiency", parameter: "Exhaust Steam Efficiency", uom: "%" },
  { id: "extraction_steam_efficiency", parameter: "Extraction Steam Efficiency", uom: "%", showWhen: "extraction_condensing_turbine" },
  { id: "total_efficiency", parameter: "Total Efficiency", uom: "%" },
  { id: "de_jb_abs_temp_diff", parameter: "DE JB Abs Temp Diff", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "de_jb_avg_temp", parameter: "DE JB Avg Temp", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "de_max_vibration", parameter: "DE Max Vibration", uom: "µm" },
  { id: "dex_vibration", parameter: "DEX Vibration", uom: "µm" },
  { id: "dey_vibration", parameter: "DEY Vibration", uom: "µm" },
  { id: "exh_avg_radial_vibr", parameter: "Exh Avg Radial Vibr", uom: "µm" },
  { id: "gov_avg_radial_vibr", parameter: "Gov Avg Radial Vibr", uom: "µm" },
  { id: "tb_temperature_inactive_avg", parameter: "TB Temperature InActive Avg", uom: "°C", showWhen: "thrust_bearing" },
  { id: "nde_jb_abs_temp_diff", parameter: "NDE JB Abs Temp Diff", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "nde_jb_avg_temp", parameter: "NDE JB Avg Temp", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "nde_max_vibration", parameter: "NDE Max Vibration", uom: "µm" },
  { id: "ndex_vibration", parameter: "NDEX Vibration", uom: "µm" },
  { id: "ndey_vibration", parameter: "NDEY Vibration", uom: "µm" },
  { id: "speed", parameter: "Speed", uom: "rpm" },
  { id: "condensate_flow_frm_surface_condenser", parameter: "Condensate Flow Frm Surface Condenser", uom: "kg/h" },
  { id: "active_tb_avg_temp", parameter: "Active TB Avg Temp", uom: "°C", showWhen: "thrust_bearing" },
  { id: "tb_temperature_active_avg", parameter: "TB Temperature Active Avg", uom: "°C", showWhen: "thrust_bearing" },
  { id: "axial_position_avg_abs", parameter: "Axial Position Avg Abs", uom: "mm" },
  { id: "control_oil_pressure", parameter: "Control Oil Pressure", uom: "bar(g)" },
  { id: "delta_hp_chest_pressure_actual_and_curve", parameter: "Delta HP Chest Pressure Actual and Curve", uom: "bar(g)" },
  { id: "delta_lp_chest_pressure_actual_and_curve", parameter: "Delta LP Chest Pressure Actual and Curve", uom: "bar(g)" },
  { id: "exhaust_steam_enthalpy_net", parameter: "Exhaust Steam Enthalpy Net", uom: "kJ/kg" },
  { id: "exhaust_steam_flow_gap_actual_and_curve", parameter: "Exhaust Steam Flow Gap Actual and Curve", uom: "kg/h" },
  { id: "hp_chest_pressure", parameter: "HP Chest Pressure", uom: "bar(g)" },
  { id: "inlet_steam_flow", parameter: "Inlet Steam Flow", uom: "kg/h" },
  { id: "hp_stage_c_factor", parameter: "HP Stage C Factor" },
  { id: "inlet_steam_enthalpy", parameter: "Inlet Steam Enthalpy", uom: "kJ/kg" },
  { id: "inlet_steam_flow_gap_actual_and_curve", parameter: "Inlet Steam Flow Gap Actual and Curve", uom: "kg/h" },
  { id: "inlet_steam_pressure", parameter: "Inlet Steam Pressure", uom: "bar(g)" },
  { id: "lp_chest_pressure", parameter: "LP Chest Pressure", uom: "bar(g)" },
  { id: "extraction_steam_pressure", parameter: "Extraction Steam Pressure", uom: "bar(g)", showWhen: "extraction_condensing_turbine" },
  { id: "lp_stage_c_factor", parameter: "LP Stage C Factor" },
  { id: "de_jb_max_temp", parameter: "DE JB Max Temp", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "nde_jb_max_temp", parameter: "NDE JB Max Temp", uom: "°C", showWhen: "nde_journal_bearing" },
];

export const OEM_COND_TPL: OemLimitTemplateItem[] = [
  { id: "condensate_flow_frm_surface_condenser", parameter: "Condensate Flow Frm Surface Condenser", uom: "kg/h" },
  { id: "cws_pressure", parameter: "CWS Pressure", uom: "bar(g)" },
  { id: "cws_temperature", parameter: "CWS Temperature", uom: "°C" },
  { id: "steam_flow_to_ejector", parameter: "Steam Flow To Ejector", uom: "kg/h", showWhen: "surface_condenser_steam_ejector" },
  { id: "steam_pressure_to_ejector", parameter: "Steam Pressure To Ejector", uom: "bar(g)", showWhen: "surface_condenser_steam_ejector" },
  { id: "surface_condenser_level", parameter: "Surface Condenser Level", uom: "%" },
  { id: "surface_condenser_level_op", parameter: "Surface Condenser Level OP", uom: "%" },
  { id: "surface_condenser_pressure", parameter: "Surface Condenser Pressure", uom: "bar(g)" },
  { id: "surface_condenser_temperature", parameter: "Surface Condenser Temperature", uom: "°C" },
  { id: "surface_condenser_water_conductivity", parameter: "Surface Condenser Water Conductivity", uom: "µS/cm" },
  { id: "pump_discharge_pressure", parameter: "Pump Discharge Pressure", uom: "bar(g)", showWhen: "surface_condenser_pump" },
];

/** OEM_COND_TPL with `pump_discharge_pressure` expanded into pumpCount
 * lettered entries (A, B, C...) — mirrors condTplForPumpCount() in
 * SensorTemplates.ts. The source sheet only lists a literal A/B pair (a
 * 2-pump example); this generalizes it to whatever pump count the user
 * configured, consistent with the Sensor Mapping behavior. */
export function oemCondTplForPumpCount(pumpCount: number): OemLimitTemplateItem[] {
  if (pumpCount <= 0) return OEM_COND_TPL;
  return OEM_COND_TPL.flatMap((s) =>
    s.id !== "pump_discharge_pressure"
      ? [s]
      : Array.from({ length: pumpCount }, (_, i) => ({
          id: "pump_discharge_pressure_" + String.fromCharCode(97 + i),
          parameter: "Pump Discharge Pressure " + String.fromCharCode(65 + i),
          uom: s.uom,
          showWhen: s.showWhen,
        }))
  );
}
