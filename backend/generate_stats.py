import os
import pandas as pd
import numpy as np
import json
import math

def calculate_kpis(vars_dict, date_val, catalyst_install_date_str, prev_catalyst_install_date_str=None):
    sv = {k: v for k, v in vars_dict.items() if v is not None and not (isinstance(v, float) and math.isnan(v))}
    kpis = {}
    
    # 1. CMA Density
    cma_density = sv.get('CMA_Density', 0.8)
    cma_density_kgm3 = cma_density * 1000
    kpis['CMA_Density_kgm3'] = cma_density_kgm3
    
    # 2. Methanol Molar Flow
    cma_flow = sv.get('CMA_Flow', 117.0)
    purity = sv.get('Methanol_Purity_In_CMA', 0.8)
    methanol_molar_flow = (cma_flow * cma_density_kgm3 * purity) / 32.042
    kpis['Methanol_Molar_Flow'] = methanol_molar_flow
    
    # 3. Methanol Production
    methanol_production = cma_flow * cma_density_kgm3 * purity * 24 / 1000
    kpis['Methanol_Production'] = methanol_production
    
    # 4. Recycle Ratio
    recycle_flow = sv.get('Recycle_Gas_Molar_Flow', 1100.0)
    mug_flow = sv.get('MUG_Gas_Molar_Flow', 250.0)
    kpis['Recycle_Ratio'] = recycle_flow / mug_flow if mug_flow > 0 else 0.0
    
    # 5. MUG Gas Molecular Weight
    co_mug = sv.get('System_MUG_Gas_CO_Mole_Concentration', 14.0)
    co2_mug = sv.get('System_MUG_Gas_CO2_Mole_Concentration', 8.5)
    h2_mug = sv.get('System_MUG_Gas_H2_Mole_Concentration', 73.0)
    ch4_mug = sv.get('System_MUG_Gas_CH4_Mole_Concentration', 3.1)
    n2_mug = sv.get('System_MUG_Gas_N2_Mole_Concentration', 1.6)
    h2o_mug = sv.get('System_MUG_Gas_H2O_Mole_Concentration', 0.2)
    
    sum_mw_mug = (co_mug * 28.01) + (co2_mug * 44.01) + (h2_mug * 2.016) + (ch4_mug * 16.04) + (n2_mug * 28.013) + (h2o_mug * 18.015)
    sum_y_mug = co_mug + co2_mug + h2_mug + ch4_mug + n2_mug + h2o_mug
    mug_mw = sum_mw_mug / sum_y_mug if sum_y_mug > 0 else 16.0
    kpis['MUG_Gas_Molecular_Weight'] = mug_mw
    
    # 6. MUG Gas Mass Flow
    mug_mass_flow = mug_mw * mug_flow * 44.14
    kpis['MUG_Gas_Mass_Flow'] = mug_mass_flow
    
    # 7. Recycle Gas Molecular Weight
    co_rec = sv.get('Recycle_Gas_CO_Mole_Concentration', 1.4)
    co2_rec = sv.get('Recycle_Gas_CO2_Mole_Concentration', 1.7)
    h2_rec = sv.get('Recycle_Gas_H2_Mole_Concentration', 84.0)
    ch4_rec = sv.get('Recycle_Gas_CH4_Mole_Concentration', 12.0)
    n2_rec = sv.get('Recycle_Gas_N2_Mole_Concentration', 0.7)
    h2o_rec = sv.get('Recycle_Gas_H2O_Mole_Concentration', 0.03)
    ch3oh_rec = sv.get('Recycle_Gas_CH3OH_Mole_Concentration', 0.55)
    
    sum_mw_rec = (co_rec * 28.01) + (co2_rec * 44.01) + (h2_rec * 2.016) + (ch4_rec * 16.04) + (n2_rec * 28.013) + (h2o_rec * 18.015) + (ch3oh_rec * 32.04)
    sum_y_rec = co_rec + co2_rec + h2_rec + ch4_rec + n2_rec + h2o_rec + ch3oh_rec
    rec_mw = sum_mw_rec / sum_y_rec if sum_y_rec > 0 else 16.0
    kpis['Recycle_Gas_Molecular_Weight'] = rec_mw
    
    # 8. Recycle Gas Mass Flow
    rec_mass_flow = rec_mw * recycle_flow * 44.14
    kpis['Recycle_Gas_Mass_Flow'] = rec_mass_flow
    
    # 9. Convertor Feed Mass Flow
    feed_mass_flow = mug_mass_flow + rec_mass_flow
    kpis['Convertor_Feed_Mass_Flow'] = feed_mass_flow
    
    # 10. M-Value
    m_val = (h2_mug - co2_mug) / (co_mug + co2_mug) if (co_mug + co2_mug) > 0 else 0.0
    kpis['M_Value'] = m_val
    
    # 11. Carbon Yield
    co_makeup_molar = (mug_flow * co_mug * 44.68) / 100
    co2_makeup_molar = (mug_flow * co2_mug * 44.68) / 100
    kpis['CO_Makeup_Molar_Flow'] = co_makeup_molar
    kpis['CO2_Makeup_Molar_Flow'] = co2_makeup_molar
    
    install_date = pd.to_datetime(catalyst_install_date_str)
    prev_install_date = pd.to_datetime(prev_catalyst_install_date_str) if prev_catalyst_install_date_str else None
    
    if prev_install_date and date_val < install_date and date_val >= prev_install_date:
        diff_days = (date_val - prev_install_date).days
    elif date_val >= install_date:
        diff_days = (date_val - install_date).days
    else:
        ref_date = prev_install_date if prev_install_date else install_date
        diff_days = (date_val - ref_date).days
        
    kpis['Catalyst_Age'] = max(0, diff_days)
    
    kpis['Bed_1_Delta_T'] = sv.get('Convertor_Bed_1_Outlet_Temperature', 265.0) - sv.get('Convertor_Bed_1_Inlet_Temperature', 230.0)
    kpis['Bed_2_Delta_T'] = sv.get('Convertor_Bed_2_Outlet_Temperature', 265.0) - sv.get('Convertor_Bed_2_Inlet_Temperature', 235.0)
    kpis['Bed_3_Delta_T'] = sv.get('Convertor_Bed_3_Outlet_Temperature', 258.0) - sv.get('Convertor_Bed_3_Inlet_Temperature', 229.0)
    
    effluent_in_temp = sv.get('Convertor_Effluent_Cooler_Inlet_Temperature', 70.0)
    effluent_out_temp = sv.get('Convertor_Effluent_Cooler_Outlet_Temperature', 45.0)
    heat_duty = (feed_mass_flow * 0.97 * (effluent_in_temp - effluent_out_temp) + feed_mass_flow * 0.07 * 400) / 1000000
    kpis['Water_Cooler_Heat_Duty'] = heat_duty
    
    ccw_in = sv.get('Ccw_Inlet_Temperature', 25.0)
    ccw_flow = sv.get('Ccw_Flow', 1526040.0)
    ccw_out = ccw_in + (heat_duty * 1000000) / ccw_flow if ccw_flow > 0 else ccw_in
    
    dt1 = effluent_in_temp - ccw_out
    dt2 = effluent_out_temp - ccw_in
    if dt1 > 0 and dt2 > 0 and dt1 != dt2:
        lmtd = (dt1 - dt2) / math.log(dt1 / dt2)
    else:
        lmtd = 0.0
    
    fouling = lmtd / heat_duty if heat_duty > 0 else 0.0
    kpis['Water_Cooler_Fouling_Index'] = fouling
    kpis['Water_Cooler_Fouling_Index_Ratio'] = ((fouling - 0.4) / (3.0 - 0.4)) * 100
    
    return {**sv, **kpis}

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backdata_path = os.path.join(base_dir, "MEOH back data.xlsx")
    easy_feature_path = os.path.join(base_dir, "Easy_feature_file.xlsx")
    output_path = os.path.join(base_dir, "data", "contributor_stats.json")
    
    print(f"Loading files...")
    xls_ef = pd.ExcelFile(easy_feature_path)
    df_clean = xls_ef.parse('Clean_Data_Ranges')
    df_bank = xls_ef.parse('pi_tag_bank')
    df_params = xls_ef.parse('Pipeline_Parameters')
    df_tags = xls_ef.parse('Tags')
    df_contrib = xls_ef.parse('LBM_Contributors')
    xls_ef.close()
    
    # Get configuration parameter dates
    catalyst_install_date = '2025-03-26'
    prev_catalyst_install_date = '2024-01-01'
    for idx, row in df_params.iterrows():
        if row['parameter'] == 'Catalyst_Installation_Date':
            catalyst_install_date = str(row['value'])
        elif row['parameter'] == 'Previous_Catalyst_Installation_Date':
            prev_catalyst_install_date = str(row['value'])
            
    pi_to_short = {}
    for idx, row in df_tags.iterrows():
        name_short = str(row.get('name_short', '')).strip()
        pi_name = str(row.get('pi_name', '')).strip()
        if pi_name and pi_name != 'nan' and pi_name != '—':
            pi_to_short[pi_name] = name_short
            pi_to_short[pi_name.lower()] = name_short
            
    # Load back data
    df_back = pd.read_excel(backdata_path)
    for col in df_back.columns:
        if str(col).lower() in ['date', 'timestamp', 'time']:
            df_back = df_back.rename(columns={col: 'Date'})
            break
    df_back['Date'] = pd.to_datetime(df_back['Date'], errors='coerce')
    df_back = df_back.dropna(subset=['Date'])
    
    # Filter back-data dynamically by the full range present in MEOH back data.xlsx
    start_time = df_back['Date'].min()
    end_time = df_back['Date'].max()
    df_back_clean = df_back[(df_back['Date'] >= start_time) & (df_back['Date'] <= end_time)].copy()
    
    # Apply Safeguarded limits
    statistical_boundaries = {}
    for idx, row in df_bank.iterrows():
        pi_name = row['PI_Name']
        name_short = pi_to_short.get(pi_name) or pi_to_short.get(pi_name.lower()) or pi_name
        if pi_name in df_back.columns:
            series = pd.to_numeric(df_back[pi_name], errors='coerce').dropna()
            # Filter out shutdown values in range [0, 40] for CMA Flow and MUG Gas Molar Flow
            if name_short.lower() in ['cma_flow', 'mug_gas_molar_flow']:
                series = series[series > 40.0]
                
            if len(series) > 0:
                p5 = float(series.quantile(0.05))
                p95 = float(series.quantile(0.95))
                statistical_boundaries[name_short] = {
                    "pi_name": pi_name,
                    "stat_min": p5,
                    "stat_max": p95
                }
                
    active_cleaning_limits = {}
    for idx, row in df_bank.iterrows():
        pi_name = row['PI_Name']
        name_short = pi_to_short.get(pi_name) or pi_to_short.get(pi_name.lower()) or pi_name
        if name_short in statistical_boundaries:
            min_val = statistical_boundaries[name_short]["stat_min"]
            max_val = statistical_boundaries[name_short]["stat_max"]
        else:
            min_val = float(row['Min_value']) if pd.notna(row['Min_value']) else None
            max_val = float(row['max_value']) if pd.notna(row['max_value']) else None
        
        if (min_val is not None or max_val is not None) and not (min_val == 0.0 and max_val == 0.0):
            active_cleaning_limits[name_short] = {
                "pi_name": pi_name,
                "min": min_val,
                "max": max_val
            }
            
    retained_mask = pd.Series(True, index=df_back_clean.index)
    for name_short, limits in active_cleaning_limits.items():
        pi_name = limits['pi_name']
        min_val = limits['min']
        max_val = limits['max']
        if pi_name in df_back_clean.columns:
            series = pd.to_numeric(df_back_clean[pi_name], errors='coerce')
            if min_val is not None:
                retained_mask = retained_mask & (series >= min_val)
            if max_val is not None:
                retained_mask = retained_mask & (series <= max_val)
                
    df_back_clean = df_back_clean[retained_mask].copy()
    print(f"Retained {len(df_back_clean)} rows of data for calculations.")
    
    # Calculate KPIs for all clean baseline rows
    resolved_baseline_rows = []
    for idx, row in df_back_clean.iterrows():
        row_dict = row.to_dict()
        raw_vars = {}
        for col, val in row_dict.items():
            short_name = pi_to_short.get(col) or pi_to_short.get(col.lower()) or col
            try:
                raw_vars[short_name] = float(val) if pd.notna(val) else None
            except:
                raw_vars[short_name] = val
        
        row_date = pd.to_datetime(row['Date'])
        state = calculate_kpis(raw_vars, row_date, catalyst_install_date, prev_catalyst_install_date)
        state['Date'] = row_date
        resolved_baseline_rows.append(state)
        
    df_baseline_kpis = pd.DataFrame(resolved_baseline_rows)
    
    # Target contributor tags and all tags
    from sklearn.ensemble import RandomForestRegressor
    all_tags = df_tags['name_short'].dropna().str.strip().unique().tolist()
    target_col = 'Methanol_Production'
    
    # Controllable features to fit RF on
    controllable_tags_raw = [
        'Water_Cooler_Fouling_Index',
        'Recycle_Ratio',
        'M_Value',
        'MUG_Gas_Molar_Flow',
        'Loop_Pressure',
        'Bed_1_Delta_T',
        'Bed_2_Delta_T',
        'Bed_3_Delta_T'
    ]
    
    features = [f for f in controllable_tags_raw if f in df_baseline_kpis.columns and f != target_col]
    
    # Train Random Forest Regressor on clean baseline data
    X_baseline = df_baseline_kpis[features].copy()
    y_baseline = df_baseline_kpis[target_col].copy()
    
    # Fill NaNs with column means in X
    for col in X_baseline.columns:
        mean_val = X_baseline[col].mean()
        if pd.isna(mean_val):
            mean_val = 0.0
        X_baseline[col] = X_baseline[col].fillna(mean_val)
        
    y_mean = y_baseline.mean()
    y_baseline = y_baseline.fillna(y_mean if pd.notna(y_mean) else 0.0)
    
    rf = RandomForestRegressor(n_estimators=50, random_state=42)
    rf.fit(X_baseline, y_baseline)
    
    # Global feature importances
    importances = rf.feature_importances_
    rf_weights = {}
    sum_importances = sum(importances)
    for feat, imp in zip(features, importances):
        rf_weights[feat] = (imp / sum_importances * 100.0) if sum_importances > 0 else (100.0 / len(features))

    contributor_stats = {}
    correlations = {}
    std_devs = {}
    directions = {}
    
    for tag in all_tags:
        if tag in df_baseline_kpis.columns:
            # 1. Standard Deviation
            std_val = float(df_baseline_kpis[tag].std())
            if pd.isna(std_val) or std_val < 1e-6:
                std_val = 1.0
            std_devs[tag] = std_val
            
            # 2. Pearson Correlation with Production
            r_val = float(df_baseline_kpis[tag].corr(df_baseline_kpis[target_col]))
            if pd.isna(r_val):
                r_val = 0.0
            correlations[tag] = r_val
            
            # 3. Direction
            directions[tag] = -1 if r_val < 0 else 1
        else:
            std_devs[tag] = 1.0
            correlations[tag] = 0.0
            directions[tag] = 1
            
    for tag in all_tags:
        weight_val = rf_weights.get(tag, 0.0)
        contributor_stats[tag] = {
            "std_deviation": round(std_devs.get(tag, 1.0), 6),
            "direction": directions.get(tag, 1),
            "weight": round(weight_val, 4),
            "correlation": round(correlations.get(tag, 0.0), 6)
        }
        
    # Save cache
    with open(output_path, "w") as f:
        json.dump(contributor_stats, f, indent=2)
        
    print(f"Successfully generated contributor stats cache and saved to: {output_path}")
    print(json.dumps(contributor_stats, indent=2))

if __name__ == '__main__':
    main()
