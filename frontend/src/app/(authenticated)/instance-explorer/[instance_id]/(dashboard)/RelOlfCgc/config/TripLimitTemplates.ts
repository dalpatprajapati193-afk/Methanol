// ─── AFP Machine Config wizard — Trip Limit parameter templates ────────────
// Ported from Static Input/Failure_Prediction_Tags.xlsx ("Sheet1": Group,
// Parameters, UOM, Show only when, Trip Direction columns).
//
// The Trip Limit tab is only shown for a sub-asset when the Failure
// Prediction model is selected for it (see StepSensors.tsx) — these tags are
// specifically the ones that feed that model.

import type { ShowWhenKey } from "./SensorTemplates";

export interface TripLimitTemplateItem {
  id: string;
  parameter: string;
  uom?: string;
  showWhen?: ShowWhenKey;
  /** Which side trips the parameter — default shown to the user, editable
   * per-instance on the Domain/Trip Limit step (see TripLimitRow.tripDirection). */
  tripDirection?: "HIGH" | "LOW";
}

export const TRIP_STAGE_TPL: TripLimitTemplateItem[] = [
  { id: "discharge_temperature", parameter: "Discharge Temperature", uom: "°C", tripDirection: "HIGH" },
  { id: "discharge_pressure", parameter: "Discharge Pressure", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "quench_tower_overhead_temperature", parameter: "Quench Tower Overhead Temperature", uom: "°C", tripDirection: "HIGH" },
  { id: "suction_temperature", parameter: "Suction Temperature", uom: "°C", tripDirection: "HIGH" },
  { id: "speed", parameter: "Speed", uom: "rpm", tripDirection: "HIGH" },
  { id: "axial_position_max", parameter: "Axial Position Max", uom: "mm", tripDirection: "HIGH" },
  { id: "discharge_intercooler_pdi", parameter: "Discharge Intercooler PDI", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "power", parameter: "Power", uom: "kW", tripDirection: "HIGH" },
  { id: "polytropic_head", parameter: "Polytropic Head", uom: "m", tripDirection: "HIGH" },
  { id: "axial_position_avg", parameter: "Axial Position Avg", uom: "mm", tripDirection: "HIGH" },
  { id: "discharge_to_next_stage_suction_pdi", parameter: "Discharge to Next Stage Suction PDI", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "discharge_cooler_and_heater_pdi", parameter: "Discharge Cooler and Heater PDI", uom: "bar(g)", tripDirection: "HIGH" },
];

export const TRIP_DGS_TPL: TripLimitTemplateItem[] = [
  { id: "secondary_seal_gas_supply_filter_dp", parameter: "Secondary Seal Gas Supply Filter DP", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "de_primary_seal_gas_supply_flowrate", parameter: "DE Primary Seal Gas Supply Flowrate", uom: "Nm³/h", showWhen: "de_dgs", tripDirection: "HIGH" },
  { id: "primary_seal_gas_supply_flowrate", parameter: "Primary Seal Gas Supply Flowrate", uom: "Nm³/h", tripDirection: "HIGH" },
  { id: "primary_seal_gas_supply_filter_dp", parameter: "Primary Seal Gas Supply Filter DP", uom: "bar(g)", showWhen: "seal_gas_filter", tripDirection: "HIGH" },
  { id: "de_primary_seal_vent_flowrate", parameter: "DE Primary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "de_dgs_primary_vent", tripDirection: "HIGH" },
  { id: "nde_primary_seal_vent_flowrate", parameter: "NDE Primary Seal Vent Flowrate", uom: "Nm³/h", showWhen: "nde_dgs_primary_vent", tripDirection: "HIGH" },
  { id: "de_primary_seal_gas_supply_pdic_op", parameter: "DE Primary Seal Gas Supply PDIC OP", uom: "%", showWhen: "de_dgs", tripDirection: "HIGH" },
  { id: "nde_primary_seal_gas_supply_pdic_op", parameter: "NDE Primary Seal Gas Supply PDIC OP", uom: "%", showWhen: "nde_dgs", tripDirection: "HIGH" },
];

export const TRIP_MECH_TPL: TripLimitTemplateItem[] = [
  { id: "jb_temperature_dea", parameter: "JB Temperature DEA", uom: "°C", showWhen: "de_journal_bearing", tripDirection: "HIGH" },
  { id: "jb_temperature_deb", parameter: "JB Temperature DEB", uom: "°C", showWhen: "de_journal_bearing", tripDirection: "HIGH" },
  { id: "jb_temperature_ndea", parameter: "JB Temperature NDEA", uom: "°C", showWhen: "nde_journal_bearing", tripDirection: "HIGH" },
  { id: "jb_temperature_ndeb", parameter: "JB Temperature NDEB", uom: "°C", showWhen: "nde_journal_bearing", tripDirection: "HIGH" },
  { id: "dex_vibration", parameter: "DEX Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "dey_vibration", parameter: "DEY Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "ndex_vibration", parameter: "NDEX Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "ndey_vibration", parameter: "NDEY Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "axial_position_avg", parameter: "Axial Position Avg", uom: "mm", tripDirection: "HIGH" },
  { id: "high_axial_thrust_pd", parameter: "High Axial Thrust PD", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "tb_temperature_active_avg", parameter: "TB Temperature Active Avg", uom: "°C", showWhen: "thrust_bearing", tripDirection: "HIGH" },
  { id: "tb_temperature_inactive_avg", parameter: "TB Temperature InActive Avg", uom: "°C", showWhen: "thrust_bearing", tripDirection: "HIGH" },
];

export const TRIP_OIL_TPL: TripLimitTemplateItem[] = [
  { id: "oil_filter_differential_pressure", parameter: "Oil Filter Differential Pressure", uom: "bar(g)", showWhen: "oil_filter", tripDirection: "HIGH" },
  { id: "lube_oil_cooler_outlet_temperature", parameter: "Lube Oil Cooler Outlet Temperature", uom: "°C", showWhen: "oil_cooler", tripDirection: "HIGH" },
];

export const TRIP_TURB_TPL: TripLimitTemplateItem[] = [
  { id: "hp_stage_c_factor", parameter: "HP Stage C Factor", tripDirection: "HIGH" },
  { id: "lp_stage_c_factor", parameter: "LP Stage C Factor", tripDirection: "HIGH" },
  { id: "gov_avg_radial_vibr", parameter: "Gov Avg Radial Vibr", uom: "µm", tripDirection: "HIGH" },
  { id: "exh_avg_radial_vibr", parameter: "Exh Avg Radial Vibr", uom: "µm", tripDirection: "HIGH" },
  { id: "active_tb_avg_temp", parameter: "Active TB Avg Temp", uom: "°C", showWhen: "thrust_bearing", tripDirection: "HIGH" },
  { id: "inactive_tb_avg_temp", parameter: "Inactive TB Avg Temp", uom: "°C", showWhen: "thrust_bearing", tripDirection: "HIGH" },
  { id: "axial_position_avg", parameter: "Axial Position Avg", uom: "mm", tripDirection: "HIGH" },
  { id: "de_jb_max_temp", parameter: "DE JB Max Temp", uom: "°C", showWhen: "de_journal_bearing", tripDirection: "HIGH" },
  { id: "nde_jb_max_temp", parameter: "NDE JB Max Temp", uom: "°C", showWhen: "nde_journal_bearing", tripDirection: "HIGH" },
  { id: "lube_oil_supply_pressure", parameter: "Lube Oil Supply Pressure", uom: "bar(g)", tripDirection: "LOW" },
  { id: "dex_vibration", parameter: "DEX Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "dey_vibration", parameter: "DEY Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "ndex_vibration", parameter: "NDEX Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "ndey_vibration", parameter: "NDEY Vibration", uom: "µm", tripDirection: "HIGH" },
  { id: "hp_chest_pressure", parameter: "HP Chest Pressure", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "lp_chest_pressure", parameter: "LP Chest Pressure", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "control_oil_pressure", parameter: "Control Oil Pressure", uom: "bar(g)", tripDirection: "LOW" },
];

export const TRIP_COND_TPL: TripLimitTemplateItem[] = [
  { id: "surface_condenser_pump_max_pressure", parameter: "Surface Condenser Pump Max Pressure", uom: "bar(g)", tripDirection: "LOW" },
  { id: "exhaust_steam_pressure", parameter: "Exhaust Steam Pressure", uom: "bar(g)", tripDirection: "HIGH" },
  { id: "surface_condenser_temperature", parameter: "Surface Condenser Temperature", uom: "°C", tripDirection: "HIGH" },
  { id: "steam_flow_to_ejector", parameter: "Steam Flow To Ejector", uom: "kg/h", showWhen: "surface_condenser_steam_ejector", tripDirection: "HIGH" },
];
