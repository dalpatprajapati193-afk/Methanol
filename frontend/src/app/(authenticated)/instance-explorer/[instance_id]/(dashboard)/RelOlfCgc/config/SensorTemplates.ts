// ─── AFP Machine Config wizard — sensor templates ───────────────────────────
// Ported verbatim from D:\fp\AFP UI Development\asset_config_ui\index.html
// (generateSubAssets(), lines ~1327-1505). Exact id/name/uom values matter —
// they become the "Sensor (Template Default)" column the Python pipeline's
// _read_sensor_mapping() parses. Do not rename without also checking the
// pipeline side.

/** Condition keys from Static Input/Parameter_Mapping_Sheet_ui.xlsx's "Show
 * only when" column — resolved to a check against the sub-asset's own
 * Machine Config selections (see SubAssets.ts#filterSensorTemplate). */
export type ShowWhenKey =
  | "intercooler_or_aftercooler"
  | "kod"
  | "de_dgs"
  | "nde_dgs"
  | "seal_gas_filter"
  | "de_dgs_primary_vent"
  | "nde_dgs_primary_vent"
  | "de_dgs_secondary_vent"
  | "nde_dgs_secondary_vent"
  | "de_dgs_separation_gas"
  | "nde_dgs_separation_gas"
  | "de_or_nde_dgs_separation_gas"
  | "thrust_bearing"
  | "de_journal_bearing"
  | "nde_journal_bearing"
  | "main_oil_pump"
  | "standby_oil_pump"
  | "oil_console"
  | "oil_filter"
  | "oil_cooler"
  | "extraction_condensing_turbine"
  | "surface_condenser_steam_ejector"
  | "surface_condenser_pump";

export interface SensorTemplateItem {
  id: string;
  name: string;
  uom: string;
  /** Undefined = "always show" in the mapping sheet. */
  showWhen?: ShowWhenKey;
}

export const COMMON_SENSOR_DEFS: SensorTemplateItem[] = [
  { id: "quench_tower_overhead_temp", name: "Quench Tower Overhead Temperature", uom: "°C" },
  { id: "depropanizer_overhead_temp", name: "Depropanizer Overhead Temperature", uom: "°C" },
  { id: "cws_pressure", name: "CWS Pressure", uom: "bar(g)" },
  { id: "cws_temperature", name: "CWS Temperature", uom: "°C" },
];

export const STAGE_TPL: SensorTemplateItem[] = [
  { id: "suction_pressure", name: "Suction Pressure", uom: "bar(g)" },
  { id: "suction_pressure_sp", name: "Suction Pressure SP", uom: "bar(g)" },
  { id: "suction_temperature", name: "Suction Temperature", uom: "°C" },
  { id: "discharge_pressure", name: "Discharge Pressure", uom: "bar(g)" },
  { id: "discharge_temperature", name: "Discharge Temperature", uom: "°C" },
  { id: "cooler_outlet_temperature", name: "Cooler Outlet Temperature", uom: "°C", showWhen: "intercooler_or_aftercooler" },
  { id: "discharge_cooler_and_heater_pdi", name: "Discharge Cooler and Heater PDI", uom: "bar(g)", showWhen: "intercooler_or_aftercooler" },
  { id: "mass_flowrate", name: "Mass Flowrate", uom: "kg/h" },
  { id: "recycle_valve_opening", name: "Recycle Valve Opening", uom: "%" },
  { id: "recycle_valve_position", name: "Recycle Valve Position", uom: "%" },
  { id: "suction_drum_hc_condensate_level_pv", name: "Suction Drum HC Condensate Level PV", uom: "%", showWhen: "kod" },
  { id: "suction_drum_hc_condensate_level_op", name: "Suction Drum HC Condensate Level OP", uom: "%", showWhen: "kod" },
  { id: "suction_drum_hc_condensate_level_sp", name: "Suction Drum HC Condensate Level SP", uom: "%", showWhen: "kod" },
  { id: "suction_drum_level", name: "Suction Drum Level", uom: "%", showWhen: "kod" },
  { id: "suction_drum_water_condensate_level", name: "Suction Drum Water Condensate Level PV", uom: "%", showWhen: "kod" },
  { id: "suction_drum_water_condensate_level_op", name: "Suction Drum Water Condensate Level OP", uom: "%", showWhen: "kod" },
  { id: "suction_drum_water_condensate_level_sp", name: "Suction Drum Water Condensate Level SP", uom: "%", showWhen: "kod" },
  { id: "bfw_flow", name: "BFW Flow", uom: "kg/h" },
  { id: "bfw_temperature", name: "BFW Temperature", uom: "°C" },
  { id: "molecular_weight", name: "Molecular Weight", uom: "kg/kmol" },
];

export const DGS_TPL: SensorTemplateItem[] = [
  { id: "de_primary_seal_gas_supply_flowrate", name: "DE Primary Seal Gas Supply Flowrate", uom: "Nm³/h", showWhen: "de_dgs" },
  { id: "nde_primary_seal_gas_supply_flowrate", name: "NDE Primary Seal Gas Supply Flowrate", uom: "Nm³/h", showWhen: "nde_dgs" },
  { id: "de_primary_seal_gas_pdi", name: "DE Primary Seal Gas PDI", uom: "bar(g)", showWhen: "de_dgs" },
  { id: "nde_primary_seal_gas_pdi", name: "NDE Primary Seal Gas PDI", uom: "bar(g)", showWhen: "nde_dgs" },
  { id: "de_primary_seal_gas_pdi_sp", name: "DE Primary Seal Gas PDI SP", uom: "bar(g)", showWhen: "de_dgs" },
  { id: "nde_primary_seal_gas_pdi_sp", name: "NDE Primary Seal Gas PDI SP", uom: "bar(g)", showWhen: "nde_dgs" },
  { id: "de_primary_seal_gas_supply_pdi", name: "DE Primary Seal Gas Supply PDI", uom: "bar(g)", showWhen: "de_dgs" },
  { id: "de_primary_seal_gas_supply_pdv_op", name: "DE Primary Seal Gas Supply PDIC OP", uom: "%", showWhen: "de_dgs" },
  { id: "nde_primary_seal_gas_supply_pdv_op", name: "NDE Primary Seal Gas Supply PDIC OP", uom: "%", showWhen: "nde_dgs" },
  { id: "de_primary_seal_gas_supply_sp", name: "DE Primary Seal Gas Supply SP", uom: "bar(g)", showWhen: "de_dgs" },
  { id: "nde_primary_seal_gas_supply_sp", name: "NDE Primary Seal Gas Supply SP", uom: "bar(g)", showWhen: "nde_dgs" },
  { id: "de_primary_seal_vent_flowrate", name: "DE Primary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "de_dgs_primary_vent" },
  { id: "nde_primary_seal_vent_flowrate", name: "NDE Primary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "nde_dgs_primary_vent" },
  { id: "de_primary_sgs_vent_difference", name: "DE Primary SGS Vent Difference", uom: "bar(g)", showWhen: "de_dgs_primary_vent" },
  { id: "nde_primary_sgs_pri_vent_pdi", name: "NDE Primary SGS Pri Vent PDI", uom: "bar(g)", showWhen: "nde_dgs_primary_vent" },
  { id: "de_secondary_sgs_primary_vent_pd", name: "DE Secondary SGS Primary Vent PD", uom: "bar(g)", showWhen: "de_dgs_secondary_vent" },
  { id: "de_secondary_sgs_primary_vent_pdi", name: "DE Secondary SGS Primary Vent PDI", uom: "bar(g)", showWhen: "de_dgs_secondary_vent" },
  { id: "de_secondary_sgs_primary_vent_pdi_sp", name: "DE Secondary SGS Primary Vent PDI SP", uom: "bar(g)", showWhen: "de_dgs_secondary_vent" },
  { id: "de_separation_seal_gas_supply_pressure", name: "DE Separation Seal Gas Supply Pressure", uom: "bar(g)", showWhen: "de_dgs_separation_gas" },
  { id: "nde_separation_seal_gas_supply_pressure", name: "NDE Separation Seal Gas Supply Pressure", uom: "bar(g)", showWhen: "nde_dgs_separation_gas" },
  { id: "primary_seal_gas_supply_filter_dp", name: "Primary Seal Gas Supply Filter DP", uom: "bar(g)", showWhen: "seal_gas_filter" },
  { id: "primary_seal_gas_supply_flowrate", name: "Primary Seal Gas Supply Flowrate", uom: "Nm³/h" },
  { id: "secondary_seal_gas_supply_filter_dp", name: "Secondary Seal Gas Supply Filter DP", uom: "bar(g)" },
  { id: "secondary_sgs_primary_vent_pd", name: "Secondary SGS Primary Vent PD", uom: "bar(g)" },
  { id: "secondary_seal_gas_supply_pdi_op", name: "Secondary Seal Gas Supply PDI OP", uom: "%" },
  { id: "secondary_seal_gas_supply_pdi_sp", name: "Secondary Seal Gas Supply PDI SP", uom: "bar(g)" },
  { id: "secondary_seal_gas_supply_pdv_op", name: "Secondary Seal Gas Supply PDIC OP", uom: "%" },
  { id: "de_secondary_seal_vent_flowrate", name: "DE Secondary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "de_dgs_secondary_vent" },
  { id: "nde_secondary_seal_vent_flowrate", name: "NDE Secondary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "nde_dgs_secondary_vent" },
  { id: "de_secondary_seal_gas_supply_flowrate", name: "DE Secondary Seal Gas Supply Flowrate", uom: "Nm³/h" },
  { id: "nde_secondary_seal_gas_supply_flowrate", name: "NDE Secondary Seal Gas Supply Flowrate", uom: "Nm³/h" },
  { id: "secondary_seal_gas_supply_pressure", name: "Secondary Seal Gas Supply Pressure", uom: "bar(g)" },
  { id: "de_primary_seal_vent_dp", name: "DE Primary Seal Vent Dp", uom: "bar(g)", showWhen: "de_dgs_primary_vent" },
  { id: "nde_primary_seal_vent_dp", name: "NDE Primary Seal Vent Dp", uom: "bar(g)", showWhen: "nde_dgs_primary_vent" },
  { id: "de_primary_seal_vent_pressure", name: "DE Primary Seal Vent Pressure", uom: "bar(g)", showWhen: "de_dgs_primary_vent" },
  { id: "nde_primary_seal_vent_pressure", name: "NDE Primary Seal Vent Pressure", uom: "bar(g)", showWhen: "nde_dgs_primary_vent" },
  { id: "seal_gas_supply_upstream_pressure", name: "Seal Gas Supply Upstream Pressure", uom: "bar(g)" },
  { id: "separation_seal_gas_supply_pressure", name: "Separation Seal Gas Supply Pressure", uom: "bar(g)", showWhen: "de_or_nde_dgs_separation_gas" },
  { id: "primary_seal_gas_supply_pdi", name: "Primary Seal Gas Supply PDI", uom: "bar(g)" },
  { id: "primary_seal_gas_supply_pdic_op", name: "Primary Seal Gas Supply PDIC OP", uom: "%" },
  { id: "primary_seal_gas_supply_pdic_sp", name: "Primary Seal Gas Supply PDIC SP", uom: "bar(g)" },
];

export const MECH_TPL: SensorTemplateItem[] = [
  { id: "axial_position", name: "Axial Position", uom: "mm" },
  { id: "dex_vibration", name: "DEX Vibration", uom: "µm" },
  { id: "dey_vibration", name: "DEY Vibration", uom: "µm" },
  { id: "ndex_vibration", name: "NDEX Vibration", uom: "µm" },
  { id: "ndey_vibration", name: "NDEY Vibration", uom: "µm" },
  { id: "tb_temperature_active", name: "TB Temperature Active", uom: "°C", showWhen: "thrust_bearing" },
  { id: "tb_temperature_inactive", name: "TB Temperature InActive", uom: "°C", showWhen: "thrust_bearing" },
  { id: "jb_temperature_dea", name: "JB Temperature DEA", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "jb_temperature_deb", name: "JB Temperature DEB", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "jb_temperature_ndea", name: "JB Temperature NDEA", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "jb_temperature_ndeb", name: "JB Temperature NDEB", uom: "°C", showWhen: "nde_journal_bearing" },
];

export const OIL_TPL: SensorTemplateItem[] = [
  { id: "lube_oil_supply_pressure", name: "Lube Oil Supply Pressure", uom: "bar(g)" },
  { id: "control_oil_pressure", name: "Control Oil Pressure", uom: "bar(g)" },
  { id: "lo_control_valve_op", name: "LO Control Valve OP", uom: "%" },
  { id: "lube_oil_cooler_outlet_temperature", name: "Lube Oil Cooler Outlet Temperature", uom: "°C" },
  { id: "main_oil_pump_discharge_pressure", name: "Main Oil Pump Discharge Pressure", uom: "bar(g)", showWhen: "main_oil_pump" },
  { id: "standby_oil_pump_discharge_pressure", name: "Standby Oil Pump Discharge Pressure", uom: "bar(g)", showWhen: "standby_oil_pump" },
  { id: "oil_console_level", name: "Oil Console Level", uom: "%", showWhen: "oil_console" },
  { id: "oil_console_temperature", name: "Oil Console Temperature", uom: "°C", showWhen: "oil_console" },
  { id: "oil_filter_differential_pressure", name: "Oil Filter Differential Pressure", uom: "bar(g)", showWhen: "oil_filter" },
  { id: "oil_pressure_cooler_outlet", name: "Oil Pressure Cooler Outlet", uom: "bar(g)", showWhen: "oil_cooler" },
];

export const TURB_TPL: SensorTemplateItem[] = [
  { id: "speed", name: "Speed", uom: "rpm" },
  { id: "governor_valve_opening", name: "Governor Valve Opening", uom: "%" },
  { id: "extraction_valve_opening", name: "Extraction Valve Opening", uom: "%", showWhen: "extraction_condensing_turbine" },
  { id: "hp_chest_pressure", name: "HP Chest Pressure", uom: "bar(g)" },
  { id: "lp_chest_pressure", name: "LP Chest Pressure", uom: "bar(g)" },
  { id: "inlet_steam_flow", name: "Inlet Steam Flow", uom: "kg/h" },
  { id: "inlet_steam_pressure", name: "Inlet Steam Pressure", uom: "bar(g)" },
  { id: "inlet_steam_temperature", name: "Inlet Steam Temperature", uom: "°C" },
  { id: "esv_ttv_status", name: "ESV TTV Status", uom: "" },
  { id: "dex_vibration", name: "DEX Vibration", uom: "µm" },
  { id: "dey_vibration", name: "DEY Vibration", uom: "µm" },
  { id: "ndex_vibration", name: "NDEX Vibration", uom: "µm" },
  { id: "ndey_vibration", name: "NDEY Vibration", uom: "µm" },
  { id: "extraction_steam_flow", name: "Extraction Steam Flow", uom: "kg/h", showWhen: "extraction_condensing_turbine" },
  { id: "extraction_pressure", name: "Extraction Steam Pressure", uom: "bar(g)", showWhen: "extraction_condensing_turbine" },
  { id: "extraction_temperature", name: "Extraction Steam Temperature", uom: "°C", showWhen: "extraction_condensing_turbine" },
  { id: "exhaust_pressure", name: "Exhaust Steam Pressure", uom: "bar(g)" },
  { id: "exhaust_temperature", name: "Exhaust Steam Temperature", uom: "°C" },
  { id: "trip_alarm", name: "Trip Alarm", uom: "" },
  { id: "tb_temperature_inactive", name: "TB Temperature InActive", uom: "°C", showWhen: "thrust_bearing" },
  { id: "tb_temperature_active", name: "TB Temperature Active", uom: "°C", showWhen: "thrust_bearing" },
  { id: "axial_position", name: "Axial Position", uom: "mm" },
  { id: "de_jb_temperature", name: "DE JB Temperature", uom: "°C", showWhen: "de_journal_bearing" },
  { id: "nde_jb_temperature", name: "NDE JB Temperature", uom: "°C", showWhen: "nde_journal_bearing" },
  { id: "lo_run_down_tank_level", name: "Lube Oil Run Down Tank Level", uom: "%" },
];

export const COND_TPL: SensorTemplateItem[] = [
  { id: "surface_condenser_temperature", name: "Surface Condenser Temperature", uom: "°C" },
  { id: "surface_condeser_pressure", name: "Surface Condenser Pressure", uom: "bar(g)" },
  { id: "steam_flow_to_ejector", name: "Steam Flow To Ejector", uom: "kg/h", showWhen: "surface_condenser_steam_ejector" },
  { id: "steam_pressure_to_ejector", name: "Steam Pressure To Ejector", uom: "bar(g)", showWhen: "surface_condenser_steam_ejector" },
  { id: "pump_discharge_pressure", name: "Pump Discharge Pressure", uom: "bar(g)", showWhen: "surface_condenser_pump" },
  { id: "surface_condenser_water_conductivity", name: "Surface Condenser Water Conductivity", uom: "µS/cm" },
  { id: "surface_condenser_level", name: "Surface Condenser Level", uom: "%" },
  { id: "surface_condenser_level_op", name: "Surface Condenser Level OP", uom: "%" },
  { id: "surface_condenser_level_sp", name: "Surface Condenser Level SP", uom: "%" },
  { id: "condensate_flow_frm_surface_condenser", name: "Condensate Flow Frm Surface Condenser", uom: "kg/h" },
  { id: "condensate_flow_frm_surface_condenser_op", name: "Condensate Flow Frm Surface Condenser OP", uom: "%" },
  { id: "condensate_flow_frm_surface_condenser_sp", name: "Condensate Flow Frm Surface Condenser SP", uom: "kg/h" },
];

/** COND_TPL with `pump_discharge_pressure` expanded into pumpCount lettered
 * entries (A, B, C...) — mirrors the original's inline flatMap in generateSubAssets(). */
export function condTplForPumpCount(pumpCount: number): SensorTemplateItem[] {
  if (pumpCount <= 0) return COND_TPL;
  return COND_TPL.flatMap((s) =>
    s.id !== "pump_discharge_pressure"
      ? [s]
      : Array.from({ length: pumpCount }, (_, i) => ({
          id: "pump_discharge_pressure_" + String.fromCharCode(97 + i),
          name: "Pump Discharge Pressure " + String.fromCharCode(65 + i),
          uom: "bar(g)",
          showWhen: s.showWhen,
        }))
  );
}
