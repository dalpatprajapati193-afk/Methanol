import os
import sys
import json
import argparse
import math
import pandas as pd
import numpy as np

def load_dataframe_cached(excel_path):
    pkl_path = excel_path.replace('.xlsx', '.pkl')
    if os.path.exists(pkl_path):
        excel_mtime = os.path.getmtime(excel_path)
        pkl_mtime = os.path.getmtime(pkl_path)
        if pkl_mtime > excel_mtime:
            try:
                import pandas as pd
                return pd.read_pickle(pkl_path)
            except Exception:
                pass
    import pandas as pd
    df = pd.read_excel(excel_path)
    try:
        df.to_pickle(pkl_path)
    except Exception:
        pass
    return df


def format_dict(d):
    formatted = {}
    for k, v in d.items():
        # Complex numbers from log/sqrt of negative values in KPI formulas → null
        if isinstance(v, complex):
            formatted[k] = None
        elif isinstance(v, (float, np.float64, np.float32)):
            if math.isnan(v) or np.isnan(v):
                formatted[k] = None
            else:
                formatted[k] = round(float(v), 4)
        elif isinstance(v, (int, np.integer)):
            formatted[k] = int(v)
        elif pd.notna(v) and hasattr(v, 'strftime'):
            formatted[k] = v.strftime("%Y-%m-%d %H:%M:%S")
        elif pd.isna(v):
            formatted[k] = None
        else:
            formatted[k] = v
    return formatted

def kmeans_numpy(X, k, max_iters=20):
    np.random.seed(42)
    n_samples = len(X)
    if n_samples == 0:
        return np.array([]), np.array([])
    if n_samples < k:
        k = n_samples
    idx = np.random.choice(n_samples, k, replace=False)
    centroids = X[idx]
    
    labels = np.zeros(n_samples, dtype=int)
    for _ in range(max_iters):
        dists = np.linalg.norm(X[:, np.newaxis] - centroids, axis=2)
        new_labels = np.argmin(dists, axis=1)
        if np.array_equal(labels, new_labels):
            break
        labels = new_labels
        
        new_centroids = np.zeros_like(centroids)
        for i in range(k):
            mask = (labels == i)
            if np.sum(mask) > 0:
                new_centroids[i] = np.mean(X[mask], axis=0)
            else:
                new_centroids[i] = centroids[i]
        centroids = new_centroids
        
    return centroids, labels

def normalize_tag_name(name):
    if not name or pd.isna(name):
        return ""
    name_str = str(name).strip()
    name_str = name_str.replace(" ", "_")
    return name_str

def main():
    parser = argparse.ArgumentParser(description="Reformer Live Benchmarking Engine")
    parser.add_argument('--date', type=str, required=False, default='', help="Selected timestamp (e.g. 2026-01-02 00:30:00)")
    parser.add_argument('--overrides', type=str, required=False, help="JSON overrides settings from client")
    parser.add_argument('--trend', action='store_true', help="Run in trend history mode")
    parser.add_argument('--range', type=str, default='1W', help="Time range (1D, 1W, 2W, 1M)")
    parser.add_argument('--boundaries-only', action='store_true', help="Fast mode: return only statistical boundaries (no ML)")
    args = parser.parse_args()
    
    selected_date_str = args.date
    overrides = {}
    if args.overrides:
        try:
            overrides = json.loads(args.overrides)
        except Exception as e:
            print(f"Error parsing overrides JSON: {e}", file=sys.stderr)
            
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    def locate_file(filename):
        paths_to_try = [
            os.path.join(base_dir, filename),
            os.path.join(base_dir, "..", filename),
            os.path.join(os.getcwd(), filename),
            os.path.join(os.getcwd(), "server", filename),
        ]
        for p in paths_to_try:
            if os.path.exists(p):
                return p
        return os.path.join(base_dir, filename)
        
    easy_feature_path = locate_file("Easy_feature_file_reformer.xlsx")
    backdata_path = locate_file("Reformer Back Data.xlsx")
    definitions_path = locate_file("selected_kpi_definitions_expanded (2).json")
    
    if not os.path.exists(easy_feature_path):
        print(json.dumps({"status": "error", "error": f"Easy_feature_file_reformer.xlsx not found at {easy_feature_path}"}))
        sys.exit(1)
        
    if not os.path.exists(backdata_path):
        print(json.dumps({"status": "error", "error": f"Reformer Back Data.xlsx not found at {backdata_path}"}))
        sys.exit(1)
        
    if not os.path.exists(definitions_path):
        print(json.dumps({"status": "error", "error": f"KPI definitions file not found at {definitions_path}"}))
        sys.exit(1)

    # Load Easy Feature File
    xls_ef = pd.ExcelFile(easy_feature_path)
    try:
        df_clean = xls_ef.parse('Clean_Data_Ranges')
        df_bank = xls_ef.parse('pi_tag_bank')
        df_iter = xls_ef.parse('LBM_Iterations')
        df_params = xls_ef.parse('Pipeline_Parameters')
        df_tags = xls_ef.parse('Tags')
        df_contrib_sheet = xls_ef.parse('LBM_Contributors')
    finally:
        xls_ef.close()

    # ── FAST PATH: boundaries-only mode (no ML, no KPI eval) ─────────────────
    if getattr(args, 'boundaries_only', False):
        # Build pi_to_short map from Tags sheet
        _pi_to_short = {}
        for _, _row in df_tags.iterrows():
            _ns = str(_row.get('name_short', '')).strip()
            _pi = str(_row.get('pi_name', '')).strip()
            if _pi and _pi != 'nan':
                _pi_to_short[_pi] = _ns
                _pi_to_short[_pi.lower()] = _ns
        # Load back data
        _df_back = load_dataframe_cached(backdata_path)
        # Build statistical boundaries fast
        _stat_bounds = {}
        _clean_limits = {}
        for _, _brow in df_bank.iterrows():
            _pi = str(_brow['PI_Name']).strip()
            _ns = _pi_to_short.get(_pi) or _pi_to_short.get(_pi.lower()) or _pi
            if _pi in _df_back.columns:
                _series = pd.to_numeric(_df_back[_pi], errors='coerce').dropna()
                if len(_series) > 0:
                    _p5  = float(_series.quantile(0.05))
                    _p95 = float(_series.quantile(0.95))
                    _stat_bounds[_ns] = {
                        'pi_name':   _pi,
                        'stat_min':  round(_p5,  3),
                        'stat_max':  round(_p95, 3),
                        'excel_min': float(_brow['Min_value']) if pd.notna(_brow['Min_value']) else None,
                        'excel_max': float(_brow['max_value']) if pd.notna(_brow['max_value']) else None,
                    }
                    _clean_limits[_ns] = {'pi_name': _pi, 'min': round(_p5, 3), 'max': round(_p95, 3)}
        _retained = {
            'total_hours':      len(_df_back),
            'retained_hours':   len(_df_back),
            'percentage':       100.0,
            'fallback_active':  False
        }
        print(json.dumps({
            'status':                 'success',
            'boundaries_only':        True,
            'statistical_boundaries': _stat_bounds,
            'active_cleaning_limits': _clean_limits,
            'retained_hours_metrics': _retained
        }, indent=2))
        sys.exit(0)
    # ─────────────────────────────────────────────────────────────────────────

    # Parse contributor definitions from Excel (data-driven selection)
    ref_contributor_defs = []
    for _, row in df_contrib_sheet.iterrows():
        tag = str(row.get('tag_name_short', '')).strip()
        pillar = str(row.get('pillar_name', 'General')).strip()
        if tag and tag != 'nan':
            ref_contributor_defs.append({'tag': tag, 'pillar': pillar})

    # Always include these Reformer-specific contributors if not already present
    reformer_default_contributors = [
        {'tag': 'Water_Cooler_Fouling_Index',   'pillar': 'Energy'},
        {'tag': 'Recycle_Ratio',                'pillar': 'Process'},
        {'tag': 'M_Value',                      'pillar': 'Process'},
        {'tag': 'Loop_Pressure',                'pillar': 'Process'},
        {'tag': 'Steam_To_Carbon',              'pillar': 'Feed System'},
        {'tag': 'Stack_Temperature',            'pillar': 'Convection Section'},
        {'tag': 'Excess_Air',                   'pillar': 'Combustion'},
        {'tag': 'Reformer_Conversion',          'pillar': 'Reaction'},
        {'tag': 'Activity_Index_Smr',           'pillar': 'Catalyst'},
        {'tag': 'Scattering_Temperature',       'pillar': 'Reformer Tubes'},
        {'tag': 'Fouling_Ratio_Ng_Preheater',   'pillar': 'Feed Pre-treatment'},
        {'tag': 'Waste_Heat_Boiler_Duty',       'pillar': 'Waste Heat Recovery'},
        {'tag': 'Specific_Consumption',         'pillar': 'Energy'},
        {'tag': 'Fpg_Fng_Ratio',                'pillar': 'Fuel Mix'},
    ]
    existing_tags = {d['tag'] for d in ref_contributor_defs}
    for d in reformer_default_contributors:
        if d['tag'] not in existing_tags:
            ref_contributor_defs.append(d)
            existing_tags.add(d['tag'])

    ref_pillar_map = {d['tag']: d['pillar'] for d in ref_contributor_defs}
    ref_contributor_tags_raw = [d['tag'] for d in ref_contributor_defs]
        
    # Get Catalyst age installation dates
    catalyst_install_date = '2025-10-15'
    prev_catalyst_install_date = '2024-04-10'
    for idx, row in df_params.iterrows():
        if row['parameter'] == 'catalyst_installation_date':
            catalyst_install_date = str(row['value'])
        elif row['parameter'] == 'previous_catalyst_installation_date':
            prev_catalyst_install_date = str(row['value'])
            
    if overrides:
        if 'catalystInstallationDate' in overrides and overrides['catalystInstallationDate']:
            catalyst_install_date = overrides['catalystInstallationDate']
        if 'previousCatalystInstallationDate' in overrides and overrides['previousCatalystInstallationDate']:
            prev_catalyst_install_date = overrides['previousCatalystInstallationDate']

    # Create mappings name_short <-> pi_name
    pi_to_short = {}
    short_to_pi = {}
    for idx, row in df_tags.iterrows():
        name_short = str(row.get('name_short', '')).strip()
        pi_name = str(row.get('pi_name', '')).strip()
        if pi_name and pi_name != 'nan' and pi_name != '—':
            pi_to_short[pi_name] = name_short
            pi_to_short[pi_name.lower()] = name_short
            short_to_pi[name_short] = pi_name

    # Additional historian analyzer tag mappings
    additional_pi_mappings = {
        'ar.ar2.ref.CH4_ANALYZER_in_PNG': 'Ch4_Analyzer_In_Png',
        'ar.ar2.ref.C2_Analyzer_in_PNG': 'C2_Analyzer_In_Png',
        'ar.ar2.ref.C3_Analyzer_in_PNG': 'C3_Analyzer_In_Png',
        'ar.ar2.ref.IC4_Analyzer_in_PNG': 'Ic4_Analyzer_In_Png',
        'ar.ar2.ref.NC4_Analyzer_in_PNG': 'Nc4_Analyzer_In_Png',
        'ar.ar2.ref.Png_To_Saturator_Flow_Comp': 'Png_To_Ng_Saturator',
        'ar.ar2.syn.Outlet_CH4_from_V_1203': 'Rg_Separator_Outlet_Ch4_Slippage',
        'ar.ar2.ref.Saturated_PNG_Flowrate': 'Reformerd_Gas_Flowrate_From_F1201',
        'ar.ar2.ref.R_1102_OUTLET_MW': 'Rg_Separator_Out_Rg_Mw',
    }
    for pi_k, short_v in additional_pi_mappings.items():
        if pi_k not in pi_to_short:
            pi_to_short[pi_k] = short_v
            pi_to_short[pi_k.lower()] = short_v
        if short_v not in short_to_pi:
            short_to_pi[short_v] = pi_k

    # Load JSON KPI definitions
    with open(definitions_path, 'r', encoding='utf-8') as f:
        kpi_defs_data = json.load(f)
    kpi_defs = kpi_defs_data['kpis']

    # Load Reformer Back Data
    df_back = load_dataframe_cached(backdata_path)
        
    # Find timestamp column
    for col in df_back.columns:
        if str(col).lower() in ['timestamp', 'date', 'time']:
            df_back = df_back.rename(columns={col: 'Date'})
            break
            
    df_back['Date'] = pd.to_datetime(df_back['Date'], errors='coerce')
    df_back = df_back.dropna(subset=['Date'])
    
    # Precompute Carbon_Factor and Plant_Status on df_back
    cf_all, ps_all = precompute_matching_features_vectorized(df_back, short_to_pi)
    df_back['Carbon_Factor'] = cf_all
    df_back['Plant_Status'] = ps_all
    
    # Locate actual row based on date
    target_dt = pd.to_datetime(selected_date_str)
    if not selected_date_str or pd.isna(target_dt):
        target_dt = df_back['Date'].max()
    current_row = df_back[
        (df_back['Date'].dt.year == target_dt.year) &
        (df_back['Date'].dt.month == target_dt.month) &
        (df_back['Date'].dt.day == target_dt.day) &
        (df_back['Date'].dt.hour == target_dt.hour) &
        (df_back['Date'].dt.minute == target_dt.minute)
    ]
    if current_row.empty:
        # Try finding the closest row if exact match fails
        time_diffs = (df_back['Date'] - target_dt).abs()
        min_diff_idx = time_diffs.idxmin()
        if pd.notna(min_diff_idx) and time_diffs.loc[min_diff_idx] < pd.Timedelta(hours=2):
            current_row = df_back.loc[[min_diff_idx]]
        else:
            response = {
                "status": "data_unavailable",
                "message": f"Data unavailable for reformer timestamp: {target_dt.strftime('%Y-%m-%d %H:%M:%S')}"
            }
            print(json.dumps(response, indent=2))
            sys.exit(0)
            
    current_date = pd.to_datetime(current_row['Date'].values[0])
    
    # Define math and lambda evaluation environment
    class FloatOverride(float):
        def __new__(cls, value):
            if isinstance(value, str) and value.lower() == 'nan':
                obj = super().__new__(cls, 0.0)
                obj.is_nan = True
                return obj
            obj = super().__new__(cls, float(value))
            obj.is_nan = False
            return obj

        def __eq__(self, other):
            if getattr(self, 'is_nan', False):
                return other is None or (isinstance(other, float) and math.isnan(other)) or pd.isna(other) or getattr(other, 'is_nan', False)
            return super().__eq__(other)

        def __req__(self, other):
            return self.__eq__(other)

    def _get(state, key, default=None):
        if default is None:
            default = FloatOverride("nan")
        val = state.get(key)
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return default
        return val

    def _avg(*args):
        valid_args = [a for a in args if a is not None]
        if not valid_args:
            return 0.0
        return sum(valid_args) / len(valid_args)

    def custom_sum(*args):
        if len(args) == 0:
            return 0.0
        if len(args) == 1:
            first = args[0]
            if isinstance(first, (list, tuple, np.ndarray)):
                return sum([x for x in first if x is not None])
            try:
                iter(first)
                return sum([x for x in first if x is not None])
            except TypeError:
                return first if first is not None else 0.0
        return sum([x for x in args if x is not None])

    eval_env = {
        '_get': _get,
        '_avg': _avg,
        'sum': custom_sum,
        'math': math,
        'np': np,
        'pd': pd,
        'max': max,
        'min': min,
        'abs': abs,
        'ln': lambda x: math.log(x) if x > 0 else 0.0,
        'log': lambda x: math.log(x) if x > 0 else 0.0,
        'exp': math.exp,
        'sqrt': math.sqrt,
        'round': round,
        'float': FloatOverride,
        'int': int
    }

    # Compile KPI lambdas once
    compiled_funcs = {}
    for k in kpi_defs:
        name = k['name']
        fn_str = k['fn_str']
        try:
            compiled_funcs[name] = eval(fn_str, eval_env, {})
        except Exception as e:
            pass

    def evaluate_state(row_data, timestamp_val):
        s_row = {}
        for col, val in row_data.items():
            if col == 'Date':
                continue
            short_name = pi_to_short.get(col) or pi_to_short.get(col.lower()) or col
            try:
                s_row[short_name] = float(val) if pd.notna(val) else None
            except:
                s_row[short_name] = val
                
        # Set defaults for tags not in this row
        for idx, row_t in df_tags.iterrows():
            name_short = str(row_t.get('name_short', '')).strip()
            if name_short not in s_row:
                val = row_t.get('ccp_default_value')
                s_row[name_short] = float(val) if pd.notna(val) and val != '—' else None
                
        # Calculate Catalyst Age dynamically
        install_date = pd.to_datetime(catalyst_install_date)
        prev_install_date = pd.to_datetime(prev_catalyst_install_date) if prev_catalyst_install_date else None
        
        if prev_install_date and timestamp_val < install_date and timestamp_val >= prev_install_date:
            diff_days = (timestamp_val - prev_install_date).days
        elif timestamp_val >= install_date:
            diff_days = (timestamp_val - install_date).days
        else:
            ref_date = prev_install_date if prev_install_date else install_date
            diff_days = (timestamp_val - ref_date).days
            
        s_row['Catalyst_Age'] = max(0, diff_days)
        
        # Fixed point evaluation loop with convergence check
        max_passes = 25
        for pass_idx in range(max_passes):

            state_before = s_row.copy()
            for name, fn in compiled_funcs.items():
                try:
                    val = fn(s_row)
                    if val is not None and not (isinstance(val, float) and math.isnan(val)):
                        s_row[name] = val
                except:
                    pass
            # Check for convergence (break if no values change beyond threshold)
            converged = True
            for k in s_row:
                v_b = state_before.get(k)
                v_a = s_row.get(k)
                if v_b != v_a:
                    if isinstance(v_b, float) and isinstance(v_a, float):
                        if abs(v_b - v_a) > 1e-6:
                            converged = False
                            break
                    else:
                        converged = False
                        break
            if converged:
                break

        # Fallback for Reformer_Conversion if missing or NaN
        conv_val = s_row.get('Reformer_Conversion')
        if conv_val is None or (isinstance(conv_val, float) and (math.isnan(conv_val) or conv_val <= 0 or conv_val > 100)):
            ch4_in = s_row.get('Ch4_Analyzer_In_Png') or s_row.get('ar.ar2.ref.CH4_ANALYZER_in_PNG')
            ch4_out = s_row.get('Rg_Separator_Outlet_Ch4_Slippage') or s_row.get('ar.ar2.syn.Outlet_CH4_from_V_1203')
            ch4_in_f = float(ch4_in) if ch4_in is not None and pd.notna(ch4_in) else 82.5
            ch4_out_f = float(ch4_out) if ch4_out is not None and pd.notna(ch4_out) else 3.03
            if ch4_in_f > 0:
                s_row['Reformer_Conversion'] = round(max(75.0, min(96.0, 100.0 - (ch4_out_f * 3.0 / ch4_in_f * 100.0))), 3)
            else:
                s_row['Reformer_Conversion'] = 88.5
        return s_row

    # Trend history mode
    if getattr(args, 'trend', False):
        range_str = getattr(args, 'range', '1W')
        days_offset = 7
        is_hourly = True
        if range_str == '1D':
            days_offset = 1
            is_hourly = True
        elif range_str == '1W':
            days_offset = 7
            is_hourly = True
        elif range_str == '2W':
            days_offset = 14
            is_hourly = False
        elif range_str == '1M':
            days_offset = 30
            is_hourly = False
            
        start_dt = target_dt - pd.Timedelta(days=days_offset)
        
        # Get all possible short tag names
        all_tags_list = list(compiled_funcs.keys())
        for idx, row_t in df_tags.iterrows():
            name_short = str(row_t.get('name_short', '')).strip()
            if name_short and name_short not in all_tags_list:
                all_tags_list.append(name_short)
        for t in ['Png_To_Ng_Saturator', 'Ng_Inlet_N2', 'Ambient_Temperature', 'Carbon_Factor', 'Plant_Status']:
            if t not in all_tags_list:
                all_tags_list.append(t)
        if 'Catalyst_Age' not in all_tags_list:
            all_tags_list.append('Catalyst_Age')
            
        timeline = []
        if is_hourly:
            total_hours = days_offset * 24
            for h in range(total_hours + 1):
                t = start_dt + pd.Timedelta(hours=h)
                time_diffs = (df_back['Date'] - t).abs()
                state = None
                state_date = t
                if not time_diffs.empty:
                    min_diff_idx = time_diffs.idxmin()
                    if time_diffs.loc[min_diff_idx] < pd.Timedelta(minutes=45):
                        match_row = df_back.loc[min_diff_idx]
                        row_dict = match_row.to_dict()
                        row_date = pd.to_datetime(match_row['Date'])
                        state = evaluate_state(row_dict, row_date)
                        state_date = row_date
                
                if state is None:
                    state = {tag: None for tag in all_tags_list}
                timeline.append({
                    "timestamp": state_date.strftime("%Y-%m-%d %H:%M:%S"),
                    "vars": state
                })
        else:
            for d in range(days_offset + 1):
                t = start_dt + pd.Timedelta(days=d)
                day_rows = df_back[
                    (df_back['Date'].dt.year == t.year) &
                    (df_back['Date'].dt.month == t.month) &
                    (df_back['Date'].dt.day == t.day)
                ]
                state = None
                if not day_rows.empty:
                    avg_row_dict = {}
                    for col in df_back.columns:
                        if col == 'Date':
                            continue
                        series = pd.to_numeric(day_rows[col], errors='coerce').dropna()
                        if not series.empty:
                            avg_row_dict[col] = float(series.mean())
                        else:
                            avg_row_dict[col] = None
                    state = evaluate_state(avg_row_dict, t)
                
                if state is None:
                    state = {tag: None for tag in all_tags_list}
                timeline.append({
                    "timestamp": t.strftime("%Y-%m-%d 12:00:00"),
                    "vars": state
                })
                
        # Sort chronologically
        timeline.sort(key=lambda x: x['timestamp'])
        
        # Format response as a flat array of { timestamp, tag_name, value }
        time_series = []
        for item in timeline:
            ts = item['timestamp']
            for tag, val in item['vars'].items():
                formatted_val = None
                if val is not None:
                    if isinstance(val, (float, np.float64, np.float32)):
                        if not (math.isnan(val) or np.isnan(val)):
                            formatted_val = round(float(val), 4)
                    elif isinstance(val, (int, np.integer)):
                        formatted_val = int(val)
                    else:
                        formatted_val = val
                time_series.append({
                    "timestamp": ts,
                    "tag_name": tag,
                    "value": formatted_val
                })
                
        print(json.dumps(time_series))
        sys.exit(0)

    # Evaluate current "Actual" state
    actual_row_dict = current_row.iloc[0].to_dict()
    current_state = evaluate_state(actual_row_dict, current_date)

    # Data Cleaning Pipeline
    df_back_clean = df_back.copy()
    
    # Calculate statistical boundaries from df_back (100% of raw data before filtering)
    statistical_boundaries = {}
    for idx, row in df_bank.iterrows():
        pi_name = row['PI_Name']
        name_short = pi_to_short.get(pi_name) or pi_to_short.get(pi_name.lower()) or pi_name
        if pi_name in df_back_clean.columns:
            series = pd.to_numeric(df_back_clean[pi_name], errors='coerce').dropna()
            if len(series) > 0:
                p5 = float(series.quantile(0.05))
                p95 = float(series.quantile(0.95))
                statistical_boundaries[name_short] = {
                    "pi_name": pi_name,
                    "stat_min": round(p5, 3),
                    "stat_max": round(p95, 3),
                    "excel_min": float(row['Min_value']) if pd.notna(row['Min_value']) else None,
                    "excel_max": float(row['max_value']) if pd.notna(row['max_value']) else None
                }
                
    # Active limits cleaning filter
    active_cleaning_limits = {}
    cleaning_limits_override = overrides.get('cleaningLimits') or {}
    clamp_std_dev = overrides.get('clampStdDev')
    
    if clamp_std_dev is not None:
        try:
            clamp_std_dev = float(clamp_std_dev)
        except:
            clamp_std_dev = None

    for idx, row in df_bank.iterrows():
        pi_name = row['PI_Name']
        name_short = pi_to_short.get(pi_name) or pi_to_short.get(pi_name.lower()) or pi_name
        
        if clamp_std_dev is not None and pi_name in df_back_clean.columns:
            series = pd.to_numeric(df_back_clean[pi_name], errors='coerce').dropna()
            if len(series) > 0:
                mean = series.mean()
                std = series.std()
                min_val = mean - clamp_std_dev * std if std > 0 else float(row['Min_value'])
                max_val = mean + clamp_std_dev * std if std > 0 else float(row['max_value'])
            else:
                min_val = float(row['Min_value']) if pd.notna(row['Min_value']) else None
                max_val = float(row['max_value']) if pd.notna(row['max_value']) else None
        elif name_short in statistical_boundaries:
            min_val = statistical_boundaries[name_short]["stat_min"]
            max_val = statistical_boundaries[name_short]["stat_max"]
        else:
            min_val = float(row['Min_value']) if pd.notna(row['Min_value']) else None
            max_val = float(row['max_value']) if pd.notna(row['max_value']) else None
            
        if name_short in cleaning_limits_override:
            lims = cleaning_limits_override[name_short]
            if 'min' in lims and lims['min'] is not None:
                min_val = float(lims['min'])
            if 'max' in lims and lims['max'] is not None:
                max_val = float(lims['max'])
                
        if (min_val is not None or max_val is not None) and not (min_val == 0.0 and max_val == 0.0):
            active_cleaning_limits[name_short] = {
                "pi_name": pi_name,
                "min": min_val,
                "max": max_val
            }

    # Filter back-data rows
    retained_mask = pd.Series(True, index=df_back_clean.index)
    clamp_count = 0
    for name_short, limits in active_cleaning_limits.items():
        pi_name = limits['pi_name']
        min_val = limits['min']
        max_val = limits['max']
        
        if pi_name in df_back_clean.columns:
            series = pd.to_numeric(df_back_clean[pi_name], errors='coerce')
            tag_mask = pd.Series(True, index=df_back_clean.index)
            if min_val is not None:
                clamp_count += int((series < min_val).sum())
                tag_mask = tag_mask & (series >= min_val)
            if max_val is not None:
                clamp_count += int((series > max_val).sum())
                tag_mask = tag_mask & (series <= max_val)
            retained_mask = retained_mask & tag_mask
            
    retained_hours = int(retained_mask.sum())
    total_backdata_hours = len(df_back)
    
    if retained_hours < 10:
        df_back_filtered = df_back.copy()
        retained_hours = len(df_back_filtered)
        fallback_active = True
    else:
        df_back_filtered = df_back_clean[retained_mask].copy()
        fallback_active = False
        
    df_back_clean = df_back_filtered
    retained_pct = round((retained_hours / total_backdata_hours) * 100, 2)
    retained_hours_metrics = {
        "total_hours": total_backdata_hours,
        "retained_hours": retained_hours,
        "percentage": retained_pct,
        "fallback_active": fallback_active
    }

    # ── Data-Driven Contributor Statistics (RF + Pearson Correlation) ──
    # Determine target KPI
    strategy = overrides.get('strategy', 'efficiency')
    target_kpi_rf = 'Reformer_Conversion' if strategy == 'capacity' else 'Thermal_Efficiency'

    # Initialize RF variables to prevent UnboundLocalError
    rf_ref = None
    contributor_features = []

    # Evaluate all 287 KPIs for clean baseline rows (with caching)
    import hashlib
    bd_mtime = os.path.getmtime(backdata_path)
    cache_key = f"{bd_mtime}_{catalyst_install_date}_{prev_catalyst_install_date}_{strategy}_{json.dumps(cleaning_limits_override, sort_keys=True)}"
    cache_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()
    cache_dir = os.path.join(base_dir, 'data_cache')
    os.makedirs(cache_dir, exist_ok=True)
    
    stats_cache_file = os.path.join(cache_dir, f"reformer_contributor_stats_{cache_hash}.json")
    baseline_cache_file = os.path.join(cache_dir, f"reformer_baseline_kpis_{cache_hash}.pkl")

    ref_contributor_stats = None
    df_baseline_kpis = None

    if os.path.exists(stats_cache_file) and os.path.exists(baseline_cache_file):
        try:
            with open(stats_cache_file, 'r') as fcache:
                ref_contributor_stats = json.load(fcache)
            df_baseline_kpis = pd.read_pickle(baseline_cache_file)
            print("Loaded contributor stats and baseline KPIs from cache!", file=sys.stderr)
        except Exception:
            ref_contributor_stats = None
            df_baseline_kpis = None

    if ref_contributor_stats is None or df_baseline_kpis is None:
        resolved_baseline_rows = []
        baseline_sample = df_back_clean.copy()
        if len(baseline_sample) > 250:
            baseline_sample = baseline_sample.sample(n=250, random_state=42)

        for _, brow in baseline_sample.iterrows():
            row_dict = brow.to_dict()
            row_date = pd.to_datetime(brow['Date'])
            bstate = evaluate_state(row_dict, row_date)
            bstate['Date'] = row_date
            resolved_baseline_rows.append(bstate)

        df_baseline_kpis = pd.DataFrame(resolved_baseline_rows)
        
        # Sanitize complex columns
        for col in df_baseline_kpis.columns:
            if df_baseline_kpis[col].dtype == object:
                try:
                    df_baseline_kpis[col] = df_baseline_kpis[col].apply(
                        lambda x: x.real if isinstance(x, complex) else x)
                    df_baseline_kpis[col] = pd.to_numeric(df_baseline_kpis[col], errors='coerce')
                except Exception:
                    df_baseline_kpis[col] = pd.to_numeric(df_baseline_kpis[col], errors='coerce')

        # Train RF on clean baseline data
        from sklearn.ensemble import RandomForestRegressor
        contributor_features = [t for t in ref_contributor_tags_raw
                                if t in df_baseline_kpis.columns and t != target_kpi_rf]
        contributor_features = [f for f in contributor_features
                                if df_baseline_kpis[f].notna().any() and df_baseline_kpis[f].std() > 1e-6]

        ref_contributor_stats = {}
        if len(contributor_features) > 0 and target_kpi_rf in df_baseline_kpis.columns:
            y_check = pd.to_numeric(df_baseline_kpis[target_kpi_rf], errors='coerce').dropna()
            if (y_check.empty or y_check.std() < 1e-6) and 'Thermal_Efficiency' in df_baseline_kpis.columns:
                target_kpi_rf = 'Thermal_Efficiency'
            X_bl = df_baseline_kpis[contributor_features].copy()
            y_bl = df_baseline_kpis[target_kpi_rf].copy()
            for col in X_bl.columns:
                mv = X_bl[col].mean()
                X_bl[col] = X_bl[col].fillna(mv if pd.notna(mv) else 0.0)
            ym = y_bl.mean()
            y_bl = y_bl.fillna(ym if pd.notna(ym) else 0.0)

            rf_ref = RandomForestRegressor(n_estimators=50, random_state=42)
            rf_ref.fit(X_bl, y_bl)

            importances = rf_ref.feature_importances_
            sum_imp = sum(importances)
            rf_weights_ref = {}
            for feat, imp in zip(contributor_features, importances):
                rf_weights_ref[feat] = (imp / sum_imp * 100.0) if sum_imp > 0 else (100.0 / len(contributor_features))

            for feat in contributor_features:
                std_val = float(df_baseline_kpis[feat].std())
                if pd.isna(std_val) or std_val < 1e-6:
                    std_val = 1.0
                r_val = float(df_baseline_kpis[feat].corr(df_baseline_kpis[target_kpi_rf]))
                if pd.isna(r_val):
                    r_val = 0.0
                ref_contributor_stats[feat] = {
                    'std_deviation': round(std_val, 6),
                    'direction': -1 if r_val < 0 else 1,
                    'weight': round(rf_weights_ref.get(feat, 0.0), 4),
                    'correlation': round(r_val, 6)
                }

        # Cache baseline and stats
        try:
            df_baseline_kpis.to_pickle(baseline_cache_file)
            with open(stats_cache_file, 'w') as fcache:
                json.dump(ref_contributor_stats, fcache, indent=2)
            for f in os.listdir(cache_dir):
                if f.endswith(".pkl") or f.endswith(".json"):
                    if cache_hash not in f:
                        try:
                            os.remove(os.path.join(cache_dir, f))
                        except:
                            pass
        except Exception:
            pass

    # Save to static path for client/server
    try:
        static_cache_path = os.path.join(base_dir, 'data', 'reformer_contributor_stats.json')
        os.makedirs(os.path.dirname(static_cache_path), exist_ok=True)
        with open(static_cache_path, 'w') as fstatic:
            json.dump(ref_contributor_stats, fstatic, indent=2)
    except Exception as e:
        print(f'Error caching reformer contributor stats: {e}', file=sys.stderr)

    # Resolve Catalyst Age for all df_back_clean rows
    current_cat_install = pd.to_datetime(catalyst_install_date)
    prev_cat_install = pd.to_datetime(prev_catalyst_install_date) if prev_catalyst_install_date else None
    
    if prev_cat_install:
        df_back_clean['Catalyst_Age'] = np.where(
            (df_back_clean['Date'] < current_cat_install) & (df_back_clean['Date'] >= prev_cat_install),
            (df_back_clean['Date'] - prev_cat_install).dt.days,
            np.where(
                df_back_clean['Date'] >= current_cat_install,
                (df_back_clean['Date'] - current_cat_install).dt.days,
                (df_back_clean['Date'] - prev_cat_install).dt.days
            )
        )
    else:
        df_back_clean['Catalyst_Age'] = (df_back_clean['Date'] - current_cat_install).dt.days

    # Precompute matching calculated tags: Carbon_Factor and Plant_Status
    cf_series, ps_series = precompute_matching_features_vectorized(df_back_clean, short_to_pi)
    df_back_clean['Carbon_Factor'] = cf_series
    df_back_clean['Plant_Status'] = ps_series

    # Regime Matching via K-Means
    match_tags_override = overrides.get('matchTags')
    if not match_tags_override:
        match_tags_override = ['Png_To_Ng_Saturator', 'Ng_Inlet_N2', 'Ambient_Temperature', 'Carbon_Factor', 'Plant_Status']
        
    # Map back data column names for K-means features and fill missing ones with defaults/mapped values
    kmeans_features = []
    for t in match_tags_override:
        norm_t = normalize_tag_name(t)
        kmeans_features.append(norm_t)
        if norm_t not in df_back_clean.columns:
            pi_col = short_to_pi.get(norm_t)
            if pi_col and pi_col in df_back_clean.columns:
                df_back_clean[norm_t] = pd.to_numeric(df_back_clean[pi_col], errors='coerce')
            else:
                # Use default value from df_tags
                default_val = 0.0
                row_t = df_tags[df_tags['name_short'].astype(str).str.strip() == norm_t]
                if not row_t.empty:
                    val = row_t.iloc[0].get('ccp_default_value')
                    if pd.notna(val) and val != '—':
                        default_val = float(val)
                df_back_clean[norm_t] = default_val

    # Drop NaNs or fill them for K-means array
    X_hist = df_back_clean[kmeans_features].copy()
    for col in kmeans_features:
        X_hist[col] = pd.to_numeric(X_hist[col], errors='coerce')
        mean_val = X_hist[col].mean()
        X_hist[col] = X_hist[col].fillna(mean_val if pd.notna(mean_val) else 0.0)
        
    X_arr = X_hist.values.astype(np.float64)
    
    # Get current matching features values
    x_curr = []
    for t in match_tags_override:
        norm_t = normalize_tag_name(t)
        val = current_state.get(norm_t)
        if val is None:
            val = 0.0
        x_curr.append(float(val))
    x_curr = np.array(x_curr, dtype=np.float64)
    
    # Scale features
    min_vals = np.min(X_arr, axis=0) if len(X_arr) > 0 else np.zeros_like(x_curr)
    max_vals = np.max(X_arr, axis=0) if len(X_arr) > 0 else np.ones_like(x_curr)
    range_vals = max_vals - min_vals
    range_vals[range_vals < 1e-6] = 1.0
    
    X_scaled = (X_arr - min_vals) / range_vals if len(X_arr) > 0 else np.zeros((1, len(x_curr)))
    x_curr_scaled = (x_curr - min_vals) / range_vals
    
    # Run K-Means
    K = 5
    centroids, labels = kmeans_numpy(X_scaled, K)
    
    if len(centroids) > 0:
        curr_dists = np.linalg.norm(centroids - x_curr_scaled, axis=1)
        current_label = int(np.argmin(curr_dists))
        matched_indices = np.where(labels == current_label)[0]
    else:
        current_label = 0
        matched_indices = np.array([0])
        
    matched_df = df_back_clean.iloc[matched_indices].copy()
    
    # Filter candidates by K-Means Operating Regime and proximity to actual state
    # Calculate Euclidean distance on scaled features to select top candidates
    matched_scaled = X_scaled[matched_indices] if len(X_scaled) > 0 else np.zeros((1, len(x_curr)))
    dists_to_curr = np.linalg.norm(matched_scaled - x_curr_scaled, axis=1)
    sort_idx = np.argsort(dists_to_curr)
    
    # Isolate top 10% closest rows (between 5 and 200 candidates)
    local_limit = max(5, int(len(matched_df) * 0.1))
    local_limit = min(local_limit, 200)
    local_limit = min(local_limit, len(matched_df))
    
    closest_indices = sort_idx[:local_limit]
    top_candidates = matched_df.iloc[closest_indices].copy()
    
    # Evaluate full 287 KPIs for all top candidates
    resolved_candidates = []
    for idx, row in top_candidates.iterrows():
        row_dict = row.to_dict()
        row_date = pd.to_datetime(row['Date'])
        candidate_state = evaluate_state(row_dict, row_date)
        candidate_state['Date'] = row_date
        candidate_state['_orig_index'] = idx
        resolved_candidates.append(candidate_state)
        
    df_candidates = pd.DataFrame(resolved_candidates)
    
    # Identify optimum benchmark row based on strategy
    strategy = overrides.get('strategy', 'efficiency')
    
    if strategy == 'capacity':
        target_kpi = 'Reformer_Conversion'
    else:
        target_kpi = 'Thermal_Efficiency'

    best_row_idx = 0
    if target_kpi in df_candidates.columns:
        valid_series = pd.to_numeric(df_candidates[target_kpi], errors='coerce').dropna()
        if not valid_series.empty:
            best_row_idx = int(valid_series.idxmax())
        elif 'Thermal_Efficiency' in df_candidates.columns:
            te_valid = pd.to_numeric(df_candidates['Thermal_Efficiency'], errors='coerce').dropna()
            if not te_valid.empty:
                best_row_idx = int(te_valid.idxmax())
    elif 'Thermal_Efficiency' in df_candidates.columns:
        te_valid = pd.to_numeric(df_candidates['Thermal_Efficiency'], errors='coerce').dropna()
        if not te_valid.empty:
            best_row_idx = int(te_valid.idxmax())

    if best_row_idx < 0 or best_row_idx >= len(df_candidates):
        best_row_idx = 0
        
    best_candidate = df_candidates.iloc[best_row_idx].to_dict()
    orig_idx = best_candidate['_orig_index']
    best_row = matched_df.loc[orig_idx]
    optimal_date = pd.to_datetime(best_row['Date'])
    
    # Benchmark state is the evaluated best candidate
    # Strip helper key
    benchmark_state = {k: v for k, v in best_candidate.items() if k != '_orig_index'}
    
    time_diff_days = float((optimal_date - current_date).days)
    
    # Tolerances check for matching features
    tolerances_dict = {}
    for idx, row_iter in df_iter.iterrows():
        var_name = normalize_tag_name(row_iter['tag_name_short'])
        if var_name:
            tolerances_dict[var_name] = {
                "min_tolerance": float(row_iter['min_tolerance']),
                "max_tolerance": float(row_iter['max_tolerance'])
            }
            
    target_status = {}
    for var_name in ['Png_To_Ng_Saturator', 'Ng_Inlet_N2', 'Ambient_Temperature', 'Carbon_Factor', 'Plant_Status']:
        curr_val = current_state.get(var_name)
        bench_val = benchmark_state.get(var_name)
        status = "red"
        label = "Out of Cluster Range"
        
        if curr_val is not None and bench_val is not None:
            curr_val_f64 = float(curr_val)
            bench_val_f64 = float(bench_val)
            
            tols = tolerances_dict.get(var_name, {"min_tolerance": 10.0, "max_tolerance": 10.0})
            min_tol = tols["min_tolerance"]
            max_tol = tols["max_tolerance"]
            
            low_bound = curr_val_f64 - min_tol
            high_bound = curr_val_f64 + max_tol
            
            if bench_val_f64 >= low_bound and bench_val_f64 <= high_bound:
                status = "green"
                label = "Regime Match (Tight)"
            else:
                # Wide tolerance check (3x iteration 1)
                low_bound2 = curr_val_f64 - 3.0 * min_tol
                high_bound2 = curr_val_f64 + 3.0 * max_tol
                if bench_val_f64 >= low_bound2 and bench_val_f64 <= high_bound2:
                    status = "yellow"
                    label = "Regime Match (Cluster)"
                    
        target_status[var_name] = {
            "matched_iteration": 1 if status == "green" else 2,
            "status": status,
            "label": label
        }

    # ── Compute Local SHAP Marginal Impacts for Contributors ──
    # Sanitize current_state and benchmark_state for complex/non-numeric values
    def sanitize_state(state):
        clean = {}
        for k, v in state.items():
            if isinstance(v, complex):
                clean[k] = v.real if not math.isnan(v.real) else None
            elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean[k] = None
            else:
                clean[k] = v
        return clean
    current_state   = sanitize_state(current_state)
    benchmark_state = sanitize_state(benchmark_state)
    uoms_map_ref = {}
    for _, row_t in df_tags.iterrows():
        ns = str(row_t.get('name_short', '')).strip()
        u = str(row_t.get('uom', '')).strip()
        if ns and u and u != 'nan' and u != '\u2014':
            uoms_map_ref[ns] = u

    # Fuel LHV for MMBtu/hr conversion (Gcal/h -> MMBtu/hr: 1 Gcal/h = 3.96832 MMBtu/hr)
    GCAL_TO_MMBTU = 3.96832

    # Thermal efficiency actual vs benchmark gap in % points
    te_actual = float(current_state.get('Thermal_Efficiency') or 0.0)
    te_bench  = float(benchmark_state.get('Thermal_Efficiency') or 0.0)
    te_gap    = abs(te_bench - te_actual)  # % points gap

    # Fuel energy input (MMBtu/hr) from Fuel_Consumption if available
    fuel_input_gcal = float(current_state.get('Fuel_Consumption') or
                            current_state.get('Heat_Input_Fuel_Firing') or 0.0)
    fuel_input_mmbtu = fuel_input_gcal * GCAL_TO_MMBTU

    contributors_list = []
    if rf_ref is not None and len(contributor_features) > 0:
        def predict_rf_ref(state_dict):
            x_vec = []
            for feat in contributor_features:
                val = state_dict.get(feat)
                if val is None or (isinstance(val, float) and math.isnan(val)):
                    val = float(rf_X_baseline[feat].mean())
                x_vec.append(float(val))
            return float(rf_ref.predict([x_vec])[0])

        y_bench_pred = predict_rf_ref(benchmark_state)
        y_curr_pred  = predict_rf_ref(current_state)

        raw_contributors = []
        sum_abs_contrib  = 0.0

        for feat in contributor_features:
            actual_val    = current_state.get(feat)
            benchmark_val = benchmark_state.get(feat)
            if actual_val is None or benchmark_val is None:
                continue
            if isinstance(actual_val, float) and math.isnan(actual_val):
                continue
            if isinstance(benchmark_val, float) and math.isnan(benchmark_val):
                continue

            # Symmetric marginal impact (local SHAP approximation)
            state_act_bench_i  = current_state.copy()
            state_bench_act_i  = benchmark_state.copy()
            state_act_bench_i[feat]  = benchmark_val
            state_bench_act_i[feat]  = actual_val

            d1 = predict_rf_ref(state_bench_act_i) - y_bench_pred
            d2 = y_curr_pred - predict_rf_ref(state_act_bench_i)
            impact = (d1 + d2) / 2.0
            abs_impact = abs(impact)
            sum_abs_contrib += abs_impact

            stats = ref_contributor_stats.get(feat, {
                'std_deviation': 1.0, 'direction': 1, 'weight': 0.0, 'correlation': 0.0
            })
            std_val  = stats['std_deviation']
            dir_val  = stats['direction']
            weight_val = stats['weight']
            corr_val = stats['correlation']
            # Focus on deviations inside the KNN Clusters by using the cluster-specific standard deviation
            std_cluster = float(df_candidates[feat].std()) if (feat in df_candidates.columns) else 0.0
            if pd.isna(std_cluster) or std_cluster < 1e-4:
                std_cluster = std_val  # Fallback to overall standard deviation if cluster variance is near-zero
            z = (float(actual_val) - float(benchmark_val)) / std_cluster if std_cluster > 1e-9 else 0.0

            raw_contributors.append({
                'tag':       feat,
                'pillar':    ref_pillar_map.get(feat, 'General'),
                'actual':    float(actual_val),
                'benchmark': float(benchmark_val),
                'zScore':    z,
                'direction': float(dir_val),
                'weight':    weight_val,
                'stdDev':    std_val,
                'correlation': corr_val,
                'score':     impact,
                'abs_score': abs_impact,
                'uom':       uoms_map_ref.get(feat, '\u2014')
            })

        for rc in raw_contributors:
            pct_contrib = (rc['abs_score'] / sum_abs_contrib * 100.0) if sum_abs_contrib > 0 else 0.0
            state_color = 'red' if rc['score'] < 0 else 'blue'
            # MMBtu/hr impact: proportion of TE gap times fuel input energy
            mmbtu_impact = (pct_contrib / 100.0) * te_gap * fuel_input_mmbtu / 100.0 if fuel_input_mmbtu > 0 else 0.0
            if rc['score'] < 0:
                mmbtu_impact = -mmbtu_impact


            contributors_list.append({
                'tag':         rc['tag'],
                'pillar':      rc['pillar'],
                'actual':      round(rc['actual'], 4),
                'benchmark':   round(rc['benchmark'], 4),
                'zScore':      round(rc['zScore'], 4),
                'direction':   rc['direction'],
                'weight':      round(rc['weight'], 4),
                'stdDev':      round(rc['stdDev'], 6),
                'correlation': round(rc['correlation'], 6),
                'score':       round(rc['score'], 4),
                'contribution': round(pct_contrib, 4),
                'mmbtu_impact': round(mmbtu_impact, 3),
                'state':       state_color,
                'uom':         rc['uom']
            })

        contributors_list.sort(key=lambda x: x['contribution'], reverse=True)

    # ─────────────────────────────────────────────────────────────────────────
    # ODS Suggestions — Reformer Operational Decision Support
    # Rich synthesis-style: trend detection + feasibility + Increase/Decrease
    # ─────────────────────────────────────────────────────────────────────────
    ods_suggestions = []

    # 7-day historical lookback for trend detection (from Reformer Back Data)
    lookback_limit = current_date - pd.Timedelta(days=7)
    past_df = df_back[
        (df_back['Date'] >= lookback_limit) &
        (df_back['Date'] <= current_date)
    ].sort_values(by='Date')

    historical_ref_state = None
    historical_ref_date  = None
    if len(past_df) > 1:
        hist_row_ref = past_df.iloc[0]
        hist_date_ref = pd.to_datetime(hist_row_ref['Date'])
        if (current_date - hist_date_ref).total_seconds() >= 24 * 3600:
            historical_ref_date = hist_date_ref
            historical_ref_state = evaluate_state(hist_row_ref.to_dict(), hist_date_ref)

    # ── Actionable Reformer KPI definitions ──────────────────────────────────
    # Each entry: tag, effect KPI, tier (1=online, 2=process change, 3=shutdown),
    #             max_allowed (equipment hard limit), uom
    REFORMER_ODS_KPIS = [
        # Tier 1 — Online / control-room adjustable
        {'tag': 'Steam_To_Carbon',       'effect': 'Thermal_Efficiency', 'tier': 1,
         'max_allowed': 4.5,  'min_allowed': 2.8,  'uom': '-'},
        {'tag': 'Excess_Air',            'effect': 'Thermal_Efficiency', 'tier': 1,
         'max_allowed': 20.0, 'min_allowed': 2.0,  'uom': '%'},
        {'tag': 'Stack_Temperature',     'effect': 'Thermal_Efficiency', 'tier': 1,
         'max_allowed': 200.0,'min_allowed': 110.0,'uom': '°C'},
        {'tag': 'Fpg_Fng_Ratio',         'effect': 'Thermal_Efficiency', 'tier': 1,
         'max_allowed': 1.0,  'min_allowed': 0.0,  'uom': '[-]'},
        # Tier 2 — Process adjustments or maintenance
        {'tag': 'Fouling_Ratio_Ng_Preheater','effect': 'Thermal_Efficiency','tier': 2,
         'max_allowed': 100.0,'min_allowed': 0.0,  'uom': '%'},
        {'tag': 'Waste_Heat_Boiler_Duty','effect': 'Thermal_Efficiency', 'tier': 2,
         'max_allowed': None, 'min_allowed': 0.0,  'uom': 'Gcal/h'},
        {'tag': 'Reformer_Conversion',   'effect': 'Thermal_Efficiency', 'tier': 2,
         'max_allowed': 98.0, 'min_allowed': 60.0, 'uom': '%'},
        {'tag': 'M_Value',               'effect': 'Thermal_Efficiency', 'tier': 2,
         'max_allowed': 3.5,  'min_allowed': 2.8,  'uom': '-'},
        {'tag': 'Scattering_Temperature','effect': 'Thermal_Efficiency', 'tier': 2,
         'max_allowed': 950.0,'min_allowed': 600.0,'uom': '°C'},
        # Tier 3 — Shutdown / catalyst replacement
        {'tag': 'Activity_Index_Smr',    'effect': 'Thermal_Efficiency', 'tier': 3,
         'max_allowed': None, 'min_allowed': None, 'uom': '%'},
    ]

    # Correlation sign lookup (positive = higher tag value improves TE,
    #                          negative = lower tag value improves TE)
    REF_TAG_CORRELATION_SIGN = {
        'Steam_To_Carbon':           +1,  # higher S/C → better reforming → higher TE
        'Excess_Air':                -1,  # lower excess air → less heat loss → higher TE
        'Stack_Temperature':         -1,  # lower stack temp → less flue-gas heat loss → higher TE
        'Fpg_Fng_Ratio':             -1,  # less fuel gas → higher TE
        'Fouling_Ratio_Ng_Preheater':-1,  # less fouling → better preheat → higher TE
        'Waste_Heat_Boiler_Duty':    +1,  # more WHB duty → better recovery → higher TE
        'Reformer_Conversion':       +1,  # higher conversion → less fuel needed → higher TE
        'M_Value':                   +1,  # higher M-value → closer to stoichiometry → higher TE
        'Scattering_Temperature':    -1,  # lower tube skin temp → less heat loss → higher TE
        'Activity_Index_Smr':        +1,  # higher catalyst activity → higher conversion → higher TE
    }

    # Tier map for priority sorting
    ODS_TIER_MAP = {d['tag']: d['tier'] for d in REFORMER_ODS_KPIS}

    for kpi_def in REFORMER_ODS_KPIS:
        tag       = kpi_def['tag']
        effect    = kpi_def['effect']
        tier      = kpi_def['tier']
        max_allow = kpi_def['max_allowed']
        min_allow = kpi_def['min_allowed']
        uom_str   = kpi_def['uom'] or uoms_map_ref.get(tag, '—')

        actual  = current_state.get(tag)
        optimum = benchmark_state.get(tag)

        if actual is None or optimum is None:
            continue
        if isinstance(actual, float) and (math.isnan(actual) or math.isinf(actual)):
            continue
        if isinstance(optimum, float) and (math.isnan(optimum) or math.isinf(optimum)):
            continue

        actual  = float(actual)
        optimum = float(optimum)
        diff    = actual - optimum

        # Std dev from contributor stats for tolerance gate
        stats   = ref_contributor_stats.get(tag, {})
        std_val = stats.get('std_deviation', 1.0)
        corr_sign = REF_TAG_CORRELATION_SIGN.get(tag, stats.get('direction', 1))
        tolerance = 0.05 * std_val if std_val > 1e-6 else abs(diff) * 0.05

        # Determine required action direction
        action = None
        delta  = abs(diff)
        if corr_sign > 0 and actual < optimum:
            action = 'INCREASE'
        elif corr_sign < 0 and actual > optimum:
            action = 'DECREASE'

        if action is None or delta <= tolerance:
            continue  # deviation is within tolerance — no suggestion needed

        label = tag.replace('_', ' ').upper()

        # ── Trend text (7-day lookback) ──────────────────────────────────────
        trend_text = ''
        if historical_ref_state is not None:
            hist_val = historical_ref_state.get(tag)
            if hist_val is not None and not (isinstance(hist_val, float) and math.isnan(hist_val)):
                hist_val = float(hist_val)
                hist_diff = actual - hist_val
                chg_threshold = 0.05 * std_val if std_val > 1e-6 else 1e-4
                if abs(hist_diff) > chg_threshold:
                    direction_word = 'INCREASED' if hist_diff > 0 else 'DECREASED'
                    trend_text = (
                        f"{label} WAS ALREADY {direction_word} BY {abs(hist_diff):.2f} {uom_str} "
                        f"DURING THE LAST WEEK "
                        f"(HISTORICAL VALUE ON {historical_ref_date.strftime('%d-%b-%Y')}: "
                        f"{hist_val:.2f} {uom_str})."
                    )
                else:
                    trend_text = f"NO SIGNIFICANT CHANGE IN {label} WAS DETECTED DURING THE LAST WEEK."
            else:
                trend_text = 'NO HISTORICAL OPERATIONAL DATA AVAILABLE.'
        else:
            trend_text = 'NO HISTORICAL OPERATIONAL DATA AVAILABLE.'

        # ── Feasibility checks (Reformer-specific equipment constraints) ──────
        feasibility_ok = True
        reason_text    = ''
        margins_text   = ''

        if tag == 'Steam_To_Carbon':
            png_flow = current_state.get('Png_To_Ng_Saturator') or 0.0
            if action == 'INCREASE' and actual >= 4.2:
                feasibility_ok = False
                reason_text = (
                    f"STEAM-TO-CARBON RATIO ALREADY NEAR DESIGN UPPER LIMIT OF 4.5 "
                    f"(CURRENT {actual:.2f} — EXCESS STEAM INCREASES HEAT DUTY WITHOUT PROPORTIONAL BENEFIT)"
                )
            elif action == 'INCREASE' and png_flow < 10.0:
                feasibility_ok = False
                reason_text = (
                    f"PNG FLOW TO SATURATOR ({png_flow:.1f} KNM3/H) TOO LOW TO SUSTAIN "
                    f"HIGHER STEAM ADDITION WITHOUT PROCESS UPSET"
                )
            else:
                margins_text = (
                    f"STEAM-TO-CARBON ADJUSTMENT IS FEASIBLE; MONITOR REFORMER INLET "
                    f"PNG PRESSURE AND PNG SATURATOR LEVEL."
                )

        elif tag == 'Excess_Air':
            acid_dp = current_state.get('Acid_Dew_Point_Degc') or 0.0
            stack_t = current_state.get('Stack_Temperature') or 0.0
            if action == 'DECREASE' and stack_t <= (acid_dp + 10.0) and acid_dp > 0:
                feasibility_ok = False
                reason_text = (
                    f"STACK TEMPERATURE ({stack_t:.1f} °C) IS WITHIN 10 °C OF ACID DEW POINT "
                    f"({acid_dp:.1f} °C). REDUCING EXCESS AIR FURTHER RISKS COLD-END CORROSION."
                )
            elif action == 'DECREASE' and actual <= 3.0:
                feasibility_ok = False
                reason_text = (
                    f"EXCESS AIR ALREADY AT MINIMUM SAFE COMBUSTION LEVEL ({actual:.1f}%). "
                    f"FURTHER REDUCTION RISKS INCOMPLETE COMBUSTION AND CO EMISSIONS."
                )
            else:
                margins_text = (
                    f"STACK TEMPERATURE MARGIN ABOVE ACID DEW POINT: "
                    f"{(stack_t - acid_dp):.1f} °C. SAFE TO ADJUST AIR REGISTER."
                )

        elif tag == 'Stack_Temperature':
            acid_dp = current_state.get('Acid_Dew_Point_Degc') or 0.0
            if action == 'DECREASE' and optimum <= (acid_dp + 15.0) and acid_dp > 0:
                feasibility_ok = False
                reason_text = (
                    f"OPTIMUM STACK TEMPERATURE ({optimum:.1f} °C) IS NEAR ACID DEW POINT "
                    f"({acid_dp:.1f} °C). REDUCING STACK TEMPERATURE BELOW THIS IS NOT SAFE "
                    f"DUE TO SULPHURIC ACID CONDENSATION RISK."
                )
            else:
                margins_text = (
                    f"STACK TEMPERATURE MARGIN ABOVE ACID DEW POINT: "
                    f"{(actual - acid_dp):.1f} °C. ADJUST CONVECTION SECTION HEAT RECOVERY."
                )

        elif tag == 'Fpg_Fng_Ratio':
            if action == 'DECREASE' and actual <= 0.05:
                feasibility_ok = False
                reason_text = (
                    f"FPG/FNG RATIO ALREADY VERY LOW ({actual:.3f}). "
                    f"FURTHER REDUCTION CONSTRAINED BY MINIMUM FUEL GAS PURGE REQUIREMENTS."
                )
            else:
                margins_text = (
                    f"ADJUST FUEL GAS SPLIT BETWEEN PNG AND FPG HEADER TO OPTIMISE "
                    f"REFORMER FIRING EFFICIENCY."
                )

        elif tag == 'Fouling_Ratio_Ng_Preheater':
            if action == 'DECREASE':
                feasibility_ok = False  # fouling cannot be decreased online
                reason_text = (
                    f"NG PREHEATER FOULING REDUCTION REQUIRES OFFLINE CLEANING MAINTENANCE. "
                    f"CURRENT FOULING RATIO: {actual:.1f}% VS DESIGN CLEAN RATIO."
                )

        elif tag == 'Waste_Heat_Boiler_Duty':
            whb_pressure = current_state.get('Waste_Heat_Boiler_Steam_Drum_Pressure') or 0.0
            if action == 'INCREASE' and whb_pressure >= 38.0:
                feasibility_ok = False
                reason_text = (
                    f"WHB STEAM DRUM PRESSURE ({whb_pressure:.1f} kg/cm2) NEAR DESIGN LIMIT. "
                    f"CANNOT INCREASE WHB DUTY WITHOUT PRESSURE RELIEF."
                )
            else:
                margins_text = (
                    f"OPTIMISE BFW FLOW TO WASTE HEAT BOILER TO MAXIMISE STEAM RECOVERY."
                )

        elif tag == 'Reformer_Conversion':
            cat_age = current_state.get('Catalyst_Age') or 0.0
            sc_ratio = current_state.get('Steam_To_Carbon') or 0.0
            if action == 'INCREASE' and cat_age >= 400.0:
                feasibility_ok = False
                reason_text = (
                    f"LATE-LIFE CATALYST AGE ({int(cat_age)} DAYS >= 400 DAYS) LIMITS "
                    f"ACHIEVABLE REFORMER CONVERSION — CATALYST ACTIVITY DEGRADED."
                )
            elif action == 'INCREASE' and sc_ratio < 3.0:
                feasibility_ok = False
                reason_text = (
                    f"STEAM-TO-CARBON RATIO ({sc_ratio:.2f}) TOO LOW TO SAFELY INCREASE CONVERSION "
                    f"(RISK OF CARBON DEPOSITION ON REFORMER TUBES)."
                )
            else:
                margins_text = (
                    f"INCREASE REFORMER FIRING TEMPERATURE TO IMPROVE REFORMING CONVERSION "
                    f"(MONITOR TUBE METAL TEMPERATURES < DESIGN LIMIT)."
                )

        elif tag == 'M_Value':
            if action == 'INCREASE':
                margins_text = (
                    f"IMPROVE H2/(CO+CO2) MODULE VALUE BY OPTIMISING STEAM REFORMING "
                    f"CONDITIONS AND NATURAL GAS FEED COMPOSITION."
                )

        elif tag == 'Scattering_Temperature':
            if action == 'DECREASE':
                margins_text = (
                    f"TUBE SKIN TEMPERATURE REDUCTION ACHIEVABLE THROUGH OPTIMISED "
                    f"BURNER FIRING AND HEAT DISTRIBUTION ACROSS RADIANT SECTION."
                )
            elif actual >= 950.0:
                feasibility_ok = False
                reason_text = (
                    f"TUBE SKIN TEMPERATURE ({actual:.1f} °C) NEAR MAXIMUM DESIGN LIMIT (950 °C). "
                    f"OPERATION ALREADY CONSTRAINED."
                )

        elif tag == 'Activity_Index_Smr':
            # Catalyst activity is always a Tier-3 (shutdown required)
            feasibility_ok = False
            reason_text = (
                f"REFORMER CATALYST ACTIVITY INDEX ({actual:.1f}%) BELOW OPTIMUM ({optimum:.1f}%). "
                f"ACTIVITY RECOVERY REQUIRES CATALYST REGENERATION OR REPLACEMENT "
                f"DURING PLANNED SHUTDOWN."
            )

        # ── Retrieve contributor data for this tag ───────────────────────────
        contrib_match = next((c for c in contributors_list if c['tag'] == tag), None)
        contrib_pct   = contrib_match['contribution'] if contrib_match else 0.0
        mmbtu_imp     = contrib_match['mmbtu_impact'] if contrib_match else 0.0

        # ── Formulate suggestion message ─────────────────────────────────────
        comp_word = 'LESSER' if action == 'INCREASE' else 'GREATER'
        if not feasibility_ok:
            message = (
                f"ACTUAL {label} ({actual:.2f} {uom_str}) IS {comp_word} THAN OPTIMUM "
                f"{label} ({optimum:.2f} {uom_str}), HOWEVER THE ACTION IS NOT RECOMMENDED "
                f"DUE TO {reason_text}. {trend_text}"
            )
        else:
            margin_info = f" {margins_text}" if margins_text else ''
            message = (
                f"ACTUAL {label} ({actual:.2f} {uom_str}) IS {comp_word} THAN OPTIMUM "
                f"{label} ({optimum:.2f} {uom_str}). SUGGEST TO {action} BY {delta:.2f} {uom_str} "
                f"TO IMPROVE THERMAL EFFICIENCY AND CLOSE THE GAP BY CONSIDERING SUFFICIENT MARGIN."
                f"{margin_info} {trend_text}"
            )

        ods_suggestions.append({
            'cause':        tag,
            'effect':       effect,
            'message':      message.upper(),
            'category':     'ods_cause_suggestion',
            'actual':       round(actual, 4),
            'optimum':      round(optimum, 4),
            'action':       action,
            'delta':        round(delta, 4),
            'feasible':     feasibility_ok,
            'tier':         tier,
            'contribution': round(contrib_pct, 4),
            'mmbtu_impact': round(mmbtu_imp, 3),
            'uom':          uom_str
        })

    # ── Sort: Tier 1 first, then by contribution descending ──────────────────
    def _ods_sort_key(sug):
        return (sug['tier'], -sug['contribution'])

    ods_suggestions.sort(key=_ods_sort_key)

    # ── Suppress all ODS if the target KPI is already at/above optimum ───
    target_kpi_name = 'Reformer_Conversion' if strategy == 'capacity' else 'Thermal_Efficiency'
    actual_val = current_state.get(target_kpi_name)
    bench_val  = benchmark_state.get(target_kpi_name)
    if (actual_val is not None and bench_val is not None
            and not (isinstance(actual_val, float) and math.isnan(actual_val))
            and not (isinstance(bench_val, float) and math.isnan(bench_val))
            and float(actual_val) >= float(bench_val)):
        ods_suggestions = []

    # Prepare success response
    response = {
        "status": "success",
        "selected_date": current_date.strftime("%Y-%m-%d %H:%M:%S"),
        "optimal_date": optimal_date.strftime("%Y-%m-%d %H:%M:%S"),
        "matched_catalyst_age": int(benchmark_state.get('Catalyst_Age', 0)),
        "matched_cycle": "Current Catalyst Cycle" if optimal_date >= pd.to_datetime(catalyst_install_date) else "Previous Catalyst Cycle",
        "matched_historical_date": optimal_date.strftime("%d-%b-%Y"),
        "iteration_matched": f"Cluster {current_label + 1} (ML Matched)",
        "time_difference_days": abs(time_diff_days),
        "current": format_dict(current_state),
        "benchmark": format_dict(benchmark_state),
        "tolerances": tolerances_dict,
        "target_status": target_status,
        "contributors": contributors_list,
        "suggestions":  ods_suggestions,
        "clamp_count": clamp_count,
        "statistical_boundaries": statistical_boundaries,
        "retained_hours_metrics": retained_hours_metrics,
        "active_cleaning_limits": format_dict(active_cleaning_limits),
        "scope_expanded": False
    }
    
    print(json.dumps(response, indent=2))

def precompute_matching_features_vectorized(df_bd_clean, short_to_pi):
    cols = {
        'ch4': short_to_pi.get('Ch4_Analyzer_In_Png', 'ar.ar2.ref.CH4_Analyzer_in_PNG'),
        'c2': short_to_pi.get('C2_Analyzer_In_Png', 'ar.ar2.ref.C2_Analyzer_in_PNG'),
        'c3': short_to_pi.get('C3_Analyzer_In_Png', 'ar.ar2.ref.C3_Analyzer_in_PNG'),
        'nc4': short_to_pi.get('Nc4_Analyzer_In_Png', 'ar.ar2.ref.NC4_Analyzer_in_PNG'),
        'ic4': short_to_pi.get('Ic4_Analyzer_In_Png', 'ar.ar2.ref.IC4_Analyzer_in_PNG'),
        'co': short_to_pi.get('Co_Analyzer_In_Png', 'ar.ar2.ref.CO_Analyzer_in_PNG'),
        'co2': short_to_pi.get('Co2_Analyzer_In_Png', 'ar.ar2.ref.CO2_Analyzer_in_PNG'),
        'load': short_to_pi.get('Reformer_Load', 'ar.ar2.syn.REFORMER_LOAD')
    }
    
    def find_col_case_insensitive(df, target):
        if not target:
            return None
        target_lower = target.lower().strip()
        for col in df.columns:
            if col.lower().strip() == target_lower:
                return col
        return None
    
    def get_series(col_name, default_val):
        actual_col = find_col_case_insensitive(df_bd_clean, col_name)
        if actual_col and actual_col in df_bd_clean.columns:
            return pd.to_numeric(df_bd_clean[actual_col], errors='coerce').fillna(default_val)
        return pd.Series(default_val, index=df_bd_clean.index)
        
    ch4_s = get_series(cols['ch4'], 24.67)
    c2_s = get_series(cols['c2'], 1.29)
    c3_s = get_series(cols['c3'], 0.32)
    nc4_s = get_series(cols['nc4'], 0.096)
    ic4_s = get_series(cols['ic4'], 0.06)
    co_s = get_series(cols['co'], 0.027)
    co2_s = get_series(cols['co2'], 0.18)
    load_s = get_series(cols['load'], 53.81)
    
    cf_s = (ch4_s/100.0)*1.0 + (c2_s/100.0)*2.0 + (c3_s/100.0)*3.0 + ((nc4_s+ic4_s)/100.0)*4.0 + (co_s/100.0) + (co2_s/100.0)
    ps_s = np.where(load_s < 50.0, 0.0, 1.0)
    
    return cf_s, ps_s

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"status": "error", "error": str(e)}))
        sys.exit(1)
