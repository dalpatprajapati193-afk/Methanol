"""
Methanol Water Cooler (E-1404) & Methanol Separator (V-1402) Thermodynamic & Fouling Model
========================================================================================
Plant 2 Methanol Synthesis Loop (Drawing 3316 B231-10020 / PFD Page 4)

Equipment:
  - Methanol Water Cooler: E-1404 A/B/C (Cooling medium: CCW, Design Duty: 18.3 Gcal/hr)
  - Methanol Separator: V-1402 (Design: 45°C, 88.5 kg/cm²G / 87.8 bar abs)
  - Recycle Syngas Stream: Stream 37 (Total: 59,160.0 kmol/h, CH3OH: 323.7 kmol/h = 10,372.0 kg/hr)
  - Purge Gas Stream: Stream 36 (Total: 3,561.2 kmol/h, CH3OH: 19.5 kmol/h = 624.8 kg/hr)

Thermodynamic Principles:
  1. Vapor-Liquid Equilibrium (VLE):
     y_MeOH * P_sep * phi_MeOH_V = x_MeOH * gamma_MeOH * P_sat_MeOH(T) * Poynting
     At high separator pressure (~88 bar), saturation vapor pressure P_sat(T) dictates
     the concentration of methanol remaining uncondensed in the syngas overhead.
  2. Summer Ambient / CCW Temperature Impact:
     Higher cooling water / ambient temperature reduces cooler LMTD/approach, elevating
     the process gas outlet temperature (T_out). Because P_sat increases exponentially with T,
     methanol slip into the recycle loop increases significantly (+35% to +85% in summer).

Fouling Index Model (User Methodology):
  1. Approach = Process Gas Outlet Temp - (Ambient Temp or CCW Inlet Temp)
  2. Fouling Index (1/UA) = Approach / Heat Duty [°C / (Gcal/hr)]
  3. Fouling Ratio = (Fouling_Index_current - Fouling_Index_SOR) / (EOR - SOR)
     where SOR = 1.0 and EOR = 3.0.
"""

import math
from typing import Dict, Any, Union, Optional
import numpy as np


# -----------------------------------------------------------------------------
# CONSTANTS & PFD DESIGN PARAMETERS
# -----------------------------------------------------------------------------
MW_METHANOL = 32.042           # kg/kmol (g/mol)
DESIGN_T_OUT = 45.0            # °C (Process gas outlet of E-1404 / Separator V-1402)
DESIGN_P_SEP_BAR = 87.802      # bar abs (88.5 kg/cm²G = 86.79 barg = 87.802 bar abs)
DESIGN_RECYCLE_KMOL_HR = 59160.0   # kmol/h (Stream 37 total flow)
DESIGN_PURGE_KMOL_HR = 3561.2      # kmol/h (Stream 36 total flow)
DESIGN_MEOH_RECYCLE_KMOL = 323.7   # kmol/h (Stream 37 methanol flow)
DESIGN_MEOH_RECYCLE_KG_HR = DESIGN_MEOH_RECYCLE_KMOL * MW_METHANOL  # 10,372.0 kg/hr
DESIGN_MEOH_MOL_PCT = (DESIGN_MEOH_RECYCLE_KMOL / DESIGN_RECYCLE_KMOL_HR) * 100.0  # 0.54716 mol%

# E-1404 Exchanger Design Parameters:
DESIGN_HEAT_DUTY_GCAL_HR = 18.3   # Gcal/hr (18.3 MMcal/h = 21.28 MW)
DESIGN_CCW_INLET_TEMP = 32.0      # °C
DESIGN_APPROACH = DESIGN_T_OUT - DESIGN_CCW_INLET_TEMP  # 13.0 °C
DESIGN_RAW_FOULING = DESIGN_APPROACH / DESIGN_HEAT_DUTY_GCAL_HR  # 0.71038 °C/(Gcal/hr)

# Antoine Parameters for Methanol (NIST / Dechema standard: T in °C, P in mmHg)
# log10(P_mmHg) = A - B / (T + C)
ANTOINE_A = 8.08097
ANTOINE_B = 1582.24
ANTOINE_C = 239.7


def calc_methanol_vapor_pressure_bar(temperature_c: float) -> float:
    """
    Calculate the saturation vapor pressure of pure methanol using the Antoine equation.

    Parameters:
        temperature_c (float): Temperature in degrees Celsius.

    Returns:
        float: Saturation pressure P_sat in bar absolute.
    """
    t = float(temperature_c)
    log10_p_mmhg = ANTOINE_A - (ANTOINE_B / (t + ANTOINE_C))
    p_mmhg = 10.0 ** log10_p_mmhg
    p_bar = p_mmhg / 750.06168  # 1 bar = 750.06168 mmHg
    return p_bar


# Calculate baseline design saturation pressure & effective VLE enhancement factor:
P_SAT_DESIGN = calc_methanol_vapor_pressure_bar(DESIGN_T_OUT)  # ~0.4449 bar
# In high-pressure VLE: y * P = alpha_eff * P_sat
# alpha_eff captures: x_MeOH (0.732) * gamma_MeOH (~1.08) * Poynting (~1.15) / phi_V (~0.91)
ALPHA_EFF = ((DESIGN_MEOH_MOL_PCT / 100.0) * DESIGN_P_SEP_BAR) / P_SAT_DESIGN  # ~1.0797


def calculate_methanol_vapor(
    t_out_c: float,
    p_sep_bar: float = DESIGN_P_SEP_BAR,
    recycle_kmol_hr: float = DESIGN_RECYCLE_KMOL_HR,
    include_purge: bool = False
) -> Dict[str, float]:
    """
    Predict methanol concentration (mol%) and mass flow (kg/hr) exiting Methanol Separator (V-1402)
    as a function of Methanol Water Cooler (E-1404) outlet temperature.

    Parameters:
        t_out_c (float): Cooler process gas outlet temperature (°C).
        p_sep_bar (float): Separator operating pressure (bar abs). Default 87.802 bar (88.5 kg/cm²G).
        recycle_kmol_hr (float): Total recycle syngas molar flow (kmol/h). Default 59,160 kmol/h.
        include_purge (bool): If True, returns total vapor overhead (recycle + purge). Default False.

    Returns:
        dict:
            - t_out_c: Outlet temperature (°C)
            - p_sat_bar: Methanol saturation vapor pressure (bar)
            - y_methanol_mol_pct: Equilibrium vapor mole concentration (mol%)
            - methanol_recycle_kg_hr: Methanol mass flow in recycle gas (kg/hr)
            - methanol_recycle_kmol_hr: Methanol molar flow in recycle gas (kmol/h)
            - delta_vs_design_kg_hr: Mass flow difference from design (kg/hr)
            - pct_change_vs_design: Percentage change from design (%)
    """
    p_sat = calc_methanol_vapor_pressure_bar(t_out_c)
    
    # Equilibrium vapor mole fraction:
    # Poynting & liquid composition correction with temperature:
    y_meoh = (ALPHA_EFF * p_sat) / max(p_sep_bar, 10.0)
    y_mol_pct = y_meoh * 100.0
    
    molar_flow_base = recycle_kmol_hr
    if include_purge:
        molar_flow_base += DESIGN_PURGE_KMOL_HR

    meoh_kmol_hr = y_meoh * molar_flow_base
    meoh_kg_hr = meoh_kmol_hr * MW_METHANOL
    
    delta_kg_hr = meoh_kg_hr - DESIGN_MEOH_RECYCLE_KG_HR
    pct_change = (meoh_kg_hr / DESIGN_MEOH_RECYCLE_KG_HR - 1.0) * 100.0

    return {
        "t_out_c": round(float(t_out_c), 2),
        "p_sat_bar": round(float(p_sat), 4),
        "y_methanol_mol_pct": round(float(y_mol_pct), 4),
        "methanol_recycle_kg_hr": round(float(meoh_kg_hr), 1),
        "methanol_recycle_kmol_hr": round(float(meoh_kmol_hr), 2),
        "delta_vs_design_kg_hr": round(float(delta_kg_hr), 1),
        "pct_change_vs_design": round(float(pct_change), 2)
    }


def calculate_fouling_index(
    t_process_out: float,
    t_cooling_in: float,
    heat_duty_gcal_hr: float = DESIGN_HEAT_DUTY_GCAL_HR,
    sor: float = 1.0,
    eor: float = 3.0,
    normalize_to_sor: bool = True
) -> Dict[str, Union[float, str]]:
    """
    Calculate Methanol Water Cooler (E-1404) Approach, Fouling Index, and Fouling Ratio.

    Formulas per User Specifications:
        Approach = Process gas outlet temp - (Ambient temp or CCW inlet temp)
        Fouling Index (1/UA) = Approach / Heat Duty  [°C / (Gcal/hr)]
        Fouling Ratio = (Fouling Index current - Fouling Index SOR) / (EOR - SOR)
        with SOR = 1.0 and EOR = 3.0.

    Parameters:
        t_process_out (float): Process gas outlet temperature (°C)
        t_cooling_in (float): Ambient temperature or CCW inlet temperature (°C)
        heat_duty_gcal_hr (float): Exchanger heat duty (Gcal/hr). Default 18.3 Gcal/hr.
        sor (float): Start of Run baseline fouling index. Default 1.0.
        eor (float): End of Run maximum fouling limit. Default 3.0.
        normalize_to_sor (bool): If True, scales raw Approach/Duty so design clean condition = SOR (1.0).

    Returns:
        dict:
            - approach_c: Approach temperature (°C)
            - raw_fouling_index: Unnormalized Approach / Heat Duty (°C/(Gcal/hr))
            - fouling_index: Fouling index (SOR = 1.0 baseline)
            - fouling_ratio: Normalized ratio 0.0 to 1.0+
            - fouling_ratio_pct: Fouling ratio expressed as percentage
            - status: Operational health status ('CLEAN', 'NORMAL', 'FOULING_WATCH', 'HIGH_FOULING', 'EOR_EXCEEDED')
    """
    t_p_out = float(t_process_out)
    t_c_in = float(t_cooling_in)
    q = max(float(heat_duty_gcal_hr), 0.1)

    approach = max(t_p_out - t_c_in, 0.0)
    raw_fi = approach / q

    if normalize_to_sor:
        # Scale by design raw fouling (13.0 / 18.3 = 0.71038) so clean design equals sor (1.0)
        fouling_index = (raw_fi / DESIGN_RAW_FOULING) * sor
    else:
        fouling_index = raw_fi

    denominator = eor - sor
    if denominator == 0:
        fouling_ratio = 0.0
    else:
        fouling_ratio = (fouling_index - sor) / denominator

    fouling_ratio_pct = fouling_ratio * 100.0

    # Determine status alert:
    if fouling_ratio < 0.15:
        status = "CLEAN"
    elif fouling_ratio < 0.45:
        status = "NORMAL"
    elif fouling_ratio < 0.75:
        status = "FOULING_WATCH"
    elif fouling_ratio <= 1.0:
        status = "HIGH_FOULING"
    else:
        status = "EOR_EXCEEDED"

    return {
        "process_gas_out_c": round(t_p_out, 2),
        "cooling_in_c": round(t_c_in, 2),
        "approach_c": round(approach, 2),
        "heat_duty_gcal_hr": round(q, 2),
        "raw_fouling_index": round(raw_fi, 4),
        "fouling_index": round(fouling_index, 3),
        "fouling_ratio": round(fouling_ratio, 4),
        "fouling_ratio_pct": round(fouling_ratio_pct, 1),
        "status": status
    }


def predict_summer_impact_scenario(
    winter_ccw: float = 24.0,
    summer_ccw: float = 40.0,
    approach_clean: float = 13.0,
    fouling_ratio: float = 0.30
) -> Dict[str, Any]:
    """
    Simulates winter vs summer conditions showing how elevated ambient/CCW and exchanger
    fouling combine to drive higher methanol recirculation in the synthesis loop.
    """
    # Fouling increases approach:
    # Fouling Index = SOR + Fouling Ratio * (EOR - SOR) = 1.0 + 0.3 * 2.0 = 1.6
    # Approach = Fouling Index * DESIGN_RAW_FOULING * Duty
    fi = 1.0 + fouling_ratio * 2.0
    effective_approach = fi * DESIGN_RAW_FOULING * DESIGN_HEAT_DUTY_GCAL_HR

    t_gas_winter = winter_ccw + effective_approach
    t_gas_summer = summer_ccw + effective_approach

    res_winter = calculate_methanol_vapor(t_gas_winter)
    res_summer = calculate_methanol_vapor(t_gas_summer)
    res_design = calculate_methanol_vapor(DESIGN_T_OUT)

    summer_vs_winter_kg_hr = res_summer["methanol_recycle_kg_hr"] - res_winter["methanol_recycle_kg_hr"]
    summer_vs_design_kg_hr = res_summer["methanol_recycle_kg_hr"] - res_design["methanol_recycle_kg_hr"]

    return {
        "winter": {
            "ccw_temp_c": winter_ccw,
            "process_gas_out_c": round(t_gas_winter, 1),
            "methanol_recycle_kg_hr": res_winter["methanol_recycle_kg_hr"],
            "methanol_mol_pct": res_winter["y_methanol_mol_pct"]
        },
        "summer": {
            "ccw_temp_c": summer_ccw,
            "process_gas_out_c": round(t_gas_summer, 1),
            "methanol_recycle_kg_hr": res_summer["methanol_recycle_kg_hr"],
            "methanol_mol_pct": res_summer["y_methanol_mol_pct"]
        },
        "design": {
            "t_out_c": DESIGN_T_OUT,
            "methanol_recycle_kg_hr": res_design["methanol_recycle_kg_hr"],
            "methanol_mol_pct": res_design["y_methanol_mol_pct"]
        },
        "summer_penalty_kg_hr": round(summer_vs_design_kg_hr, 1),
        "summer_penalty_tons_per_day": round(summer_vs_design_kg_hr * 24.0 / 1000.0, 1),
        "summer_vs_winter_diff_kg_hr": round(summer_vs_winter_kg_hr, 1)
    }


if __name__ == "__main__":
    import json
    print("=== METHANOL WATER COOLER (E-1404) & SEPARATOR (V-1402) MODEL ===")
    print("Design Point Validation:")
    des = calculate_methanol_vapor(DESIGN_T_OUT)
    print(json.dumps(des, indent=2))
    
    print("\nSummer vs Winter Scenario Analysis:")
    scen = predict_summer_impact_scenario()
    print(json.dumps(scen, indent=2))
