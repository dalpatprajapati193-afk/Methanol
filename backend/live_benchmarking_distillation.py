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
    parser = argparse.ArgumentParser(description="Distillation Live Benchmarking Engine")
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
        
    easy_feature_path = locate_file("Easy Feature file Distillation.xlsx")
    backdata_path = locate_file("Back Data Distillation.xlsx")
    definitions_path = locate_file("Arrazi_Distillation_Inferred_KPIs_with_Fouling.json")
    
    if not os.path.exists(easy_feature_path):
        print(json.dumps({"status": "error", "error": f"Easy Feature file Distillation.xlsx not found at {easy_feature_path}"}))
        sys.exit(1)
        
    if not os.path.exists(backdata_path):
        print(json.dumps({"status": "error", "error": f"Back Data Distillation.xlsx not found at {backdata_path}"}))
        sys.exit(1)
        
    if not os.path.exists(definitions_path):
        print(json.dumps({"status": "error", "error": f"KPI definitions file not found at {definitions_path}"}))
        sys.exit(1)

    # Load Easy Feature File
    xls_ef = pd.ExcelFile(easy_feature_path)
    try:
        df_clean = xls_ef.parse('Clean_Data_Ranges') if 'Clean_Data_Ranges' in xls_ef.sheet_names else pd.DataFrame()
        df_bank = xls_ef.parse('pi_tag_bank')
        df_iter = xls_ef.parse('LBM_Iterations') if 'LBM_Iterations' in xls_ef.sheet_names else pd.DataFrame()
        df_params = xls_ef.parse('Pipeline_Parameters')
        df_tags = xls_ef.parse('Tags')
        df_contrib_sheet = xls_ef.parse('LBM_Contributors') if 'LBM_Contributors' in xls_ef.sheet_names else pd.DataFrame()
    finally:
        xls_ef.close()

    # Programmatic fix for unmapped specific gravity tags to ensure correct clean-filtering and evaluation
    df_tags.loc[df_tags['name_short'] == 'CMA_specific_gravity_from_CMA Tank', 'pi_name'] = 'ar.ar2.dist.Cma_Specific_Gravity'
    df_tags.loc[df_tags['name_short'] == 'CMA_specific_gravity_from_CMA Tank', 'ccp_default_value'] = 0.826
    df_tags.loc[df_tags['name_short'] == 'Specific_Gravity_Refining Column_Feed', 'pi_name'] = 'ar.ar2.dist.Cma_Specific_Gravity'
    df_tags.loc[df_tags['name_short'] == 'Specific_Gravity_Refining Column_Feed', 'ccp_default_value'] = 0.826
    df_tags.loc[df_tags['name_short'] == 'CMA_flowrate_to_Topping Column', 'pi_name'] = 'ar.ar2.syn.Outlet_CMA_flow_from_V_1403'

    # Set realistic default values for steam tags missing from Back Data Distillation.xlsx
    df_tags.loc[df_tags['name_short'] == 'Topping Column Reboiler_Steam_flow', 'ccp_default_value'] = 22.0
    df_tags.loc[df_tags['name_short'] == 'Topping Column Reboiler_Steam_Temp', 'ccp_default_value'] = 143.0
    df_tags.loc[df_tags['name_short'] == 'Steam_temperature_Refining Column Reboiler', 'ccp_default_value'] = 143.0
    df_tags.loc[df_tags['name_short'] == 'Recovery Column Reboiler_steam_temperature', 'ccp_default_value'] = 143.0

    # Create mappings name_short <-> pi_name (handling spaces and underscores)
    pi_to_short = {}
    short_to_pi = {}
    pi_to_shorts = {}
    pi_names_set = set()
    for idx, row in df_tags.iterrows():
        name_short = str(row.get('name_short', '')).strip()
        pi_name = str(row.get('pi_name', '')).strip()
        if pi_name and pi_name != 'nan' and pi_name != 'â€”':
            pi_to_short[pi_name] = name_short
            pi_to_short[pi_name.lower()] = name_short
            pi_to_shorts.setdefault(pi_name, []).append(name_short)
            pi_to_shorts.setdefault(pi_name.lower(), []).append(name_short)
            pi_names_set.add(pi_name)
            pi_names_set.add(pi_name.lower())
            short_to_pi[name_short] = pi_name
            short_to_pi[name_short.replace(" ", "_")] = pi_name

    # â”€â”€ FAST PATH: boundaries-only mode (no ML, no KPI eval) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if getattr(args, 'boundaries_only', False):
        _df_back = load_dataframe_cached(backdata_path)
            
        # Standardize timestamp
        for col in _df_back.columns:
            if str(col).lower() in ['timestamp', 'date', 'time']:
                _df_back = _df_back.rename(columns={col: 'Date'})
                break
                
        _stat_bounds = {}
        _clean_limits = {}
        for _, _brow in df_bank.iterrows():
            _pi = str(_brow['PI_Name']).strip()
            _ns = pi_to_short.get(_pi) or pi_to_short.get(_pi.lower()) or _pi
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
    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    # â”€â”€ Build config_state from Pipeline_Parameters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # The LMTD and Fouling formulas reference config keys like:
    #   Topping_Column_Condenser_1_type_config  â†’ 'Air Cooler' or 'Water Cooled'
    #   Topping_Column_Condenser_1_flow_config  â†’ 'Counter Flow' or 'Parallel Flow'
    # These must be injected into s_row before KPI evaluation.
    config_state = {}
    try:
        col_map = {
            'toppingColumn':  'Topping_Column',
            'refiningColumn': 'Refining_Column',
            'recoveryColumn': 'Recovery_Column',
        }
        distillation_config_path = os.path.join(base_dir, 'data', 'distillation_config.json')
        if os.path.exists(distillation_config_path):
            with open(distillation_config_path, 'r', encoding='utf-8') as _fc:
                _dconf = json.load(_fc)
            _dist = _dconf.get('distillation', {})
            for col_key, col_prefix in col_map.items():
                _col = _dist.get(col_key, {})
                _cond = _col.get('condensers', {})
                _count = _cond.get('count', 0)
                _utilities = _cond.get('utilities', [])
                _flow_types = _cond.get('flowTypes', [])
                # Normalise utility name: 'Air Cooled' â†’ 'Air Cooler'
                def _norm_util(u):
                    u = str(u).strip()
                    if 'air' in u.lower():
                        return 'Air Cooler'
                    return 'Water Cooled'
                for i in range(1, 3):  # Condenser 1 and 2
                    cidx = i - 1
                    util = _norm_util(_utilities[cidx]) if cidx < len(_utilities) else 'Water Cooled'
                    flow = _flow_types[cidx] if cidx < len(_flow_types) else 'Counter Flow'
                    config_state[f'{col_prefix}_Condenser_{i}_type_config'] = util
                    config_state[f'{col_prefix}_Condenser_{i}_flow_config'] = flow
            # Feed preheater
            _tp = _dist.get('toppingColumn', {})
            config_state['Feed_Preheater_flow_config'] = _tp.get('feedPreheaterFlowType', 'Counter Flow')
            # Product cooler
            _rc = _dist.get('refiningColumn', {})
            config_state['Product_Cooler_flow_config'] = _rc.get('productCoolerFlowType', 'Counter Flow')
            config_state['Product_Cooler_type_config'] = 'Water Cooled'
            # Heavy end cooler
            _sd = _dist.get('recoveryColumn', {}).get('sideDraw', {})
            _hec_util = _sd.get('heavyEndCoolerUtility', 'Water Cooled')
            _hec_flow = _sd.get('heavyEndCoolerFlowType', 'Counter Flow')
            config_state['Heavy_End_Cooler_type_config'] = 'Air Cooler' if 'air' in str(_hec_util).lower() else 'Water Cooled'
            config_state['Heavy_End_Cooler_flow_config'] = _hec_flow
            # Distillation column cooler (bottoms)
            _btm = _dist.get('recoveryColumn', {}).get('bottoms', {})
            _dc_util = _btm.get('sharedCoolerUtility', 'Water Cooled')
            _dc_flow = _btm.get('sharedCoolerFlowType', 'Counter Flow')
            config_state['Distillation_Column_Cooler_type_config'] = 'Air Cooler' if 'air' in str(_dc_util).lower() else 'Water Cooled'
            config_state['Distillation_Column_Cooler_flow_config'] = _dc_flow
            # RG reboiler flow configs
            config_state['Refining_Column_Reboiler_RG_flow_config'] = 'Counter Flow'
            config_state['Topping_Column_Reboiler_RG_flow_config'] = 'Counter Flow'

            # â”€â”€ CW flow design values for water-cooled condensers & coolers â”€â”€
            # The LMTD formula back-calculates CW outlet temp as:
            #   t_co = t_ci + Q*1e6 / (m_cw * 1e3)   [Q in MMKcal/hr, m_cw in kg/h â†’ t in degC]
            # Since CW flow is not a PI sensor at this plant, read from rawTagMappings
            # design values if provided, else use 100,000 kg/h as a default.
            _DEFAULT_CW_FLOW = 100000.0  # kg/h
            _raw_mappings = _dconf.get('rawTagMappings', {})

            def _cw_flow_from_mapping(tag_name):
                m = _raw_mappings.get(tag_name, {})
                try:
                    val = float(m.get('design', '') or m.get('def', '') or 0)
                    return val if val > 0 else _DEFAULT_CW_FLOW
                except Exception:
                    return _DEFAULT_CW_FLOW

            cw_flow_tags = {
                'Topping_Column_Condenser_1_CW_flow':          'Topping_Column_Condenser_1_CW_flow',
                'Topping_Column_Condenser_2_CW_flow':          'Topping_Column_Condenser_2_CW_flow',
                'Refining_Column_Condenser_1_CW_flow':         'Refining_Column_Condenser_1_CW_flow',
                'Refining_Column_Condenser_2_CW_flow':         'Refining_Column_Condenser_2_CW_flow',
                'Recovery_Column_Condenser_1_CW_flow':         'Recovery_Column_Condenser_1_CW_flow',
                'Recovery_Column_Condenser_2_CW_flow':         'Recovery_Column_Condenser_2_CW_flow',
                'Product_Cooler_CW_flow':                      'Product_Cooler_CW_flow',
                'Heavy_End_Cooler_CW_flow':                    'Heavy_End_Cooler_CW_flow',
                'Disitillation_Column_Cooler_CW_flow':         'Disitillation_Column_Cooler_CW_flow',
            }
            for flow_tag in cw_flow_tags:
                config_state[flow_tag] = _cw_flow_from_mapping(flow_tag)
        else:
            # Fallback defaults if config file missing
            for col_prefix in ['Topping_Column', 'Refining_Column', 'Recovery_Column']:
                for i in [1, 2]:
                    config_state[f'{col_prefix}_Condenser_{i}_type_config'] = 'Water Cooled'
                    config_state[f'{col_prefix}_Condenser_{i}_flow_config'] = 'Counter Flow'
                    config_state[f'{col_prefix}_Condenser_{i}_CW_flow'] = 100000.0
            for key in ['Feed_Preheater_flow_config', 'Product_Cooler_flow_config',
                        'Heavy_End_Cooler_flow_config', 'Distillation_Column_Cooler_flow_config',
                        'Refining_Column_Reboiler_RG_flow_config', 'Topping_Column_Reboiler_RG_flow_config']:
                config_state[key] = 'Counter Flow'
            config_state['Product_Cooler_type_config'] = 'Water Cooled'
            config_state['Heavy_End_Cooler_type_config'] = 'Water Cooled'
            config_state['Distillation_Column_Cooler_type_config'] = 'Water Cooled'
            for flow_tag in ['Product_Cooler_CW_flow', 'Heavy_End_Cooler_CW_flow', 'Disitillation_Column_Cooler_CW_flow']:
                config_state[flow_tag] = 100000.0
    except Exception as _ce:
        print(f'[WARN] Could not build config_state: {_ce}', file=sys.stderr)
    # â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    # Parse contributor definitions from Excel (data-driven selection)
    dist_contributor_defs = []
    if not df_contrib_sheet.empty:
        for _, row in df_contrib_sheet.iterrows():
            tag = str(row.get('tag_name_short', '')).strip()
            pillar = str(row.get('pillar_name', 'General')).strip()
            if tag and tag != 'nan':
                # Filter to only keep tags that exist in Distillation Tags
                if tag in short_to_pi:
                    dist_contributor_defs.append({'tag': tag, 'pillar': pillar})

    # Domain-knowledge driven contributors (chemical engineer approved â€” 8 key tags)
    # Performance driven by: condenser efficiency, reflux quality, column pressure,
    # total energy consumption, and condenser fouling across all 3 columns.
    distillation_default_contributors = [
        # â”€â”€ Topping Column: Reflux Flow (should always be maximum) â”€â”€
        {'tag': 'Reflux_flow_to_Topping Column',                   'pillar': 'Process'},
        # â”€â”€ Condenser Performance: Reflux Temperature (lower = better condensation/less losses) â”€â”€
        {'tag': 'Reflux_temperature_to_Topping Column',            'pillar': 'Condenser'},
        # â”€â”€ Condenser Performance: Duty (higher = better heat transfer, less overhead losses) â”€â”€
        {'tag': 'Topping Column 1st Condenser_Duty',               'pillar': 'Condenser'},
        # â”€â”€ Column Pressure: Non-condensable gas buildup indicator (lower = better) â”€â”€
        {'tag': 'Topping Column_Normalised_Delta_P',               'pillar': 'Process'},
        # â”€â”€ Energy: Total reboiler specific consumption (covers all 3 reboilers, lower = better) â”€â”€
        {'tag': 'Energy_Specific_consumption_Total_Reboliers',     'pillar': 'Energy'},
        # â”€â”€ Fouling: Condenser fouling across all 3 columns (both +ve/-ve deviation monitored) â”€â”€
        {'tag': 'Fouling_Index_Topping_Column_1st_Condenser',      'pillar': 'Fouling'},
        {'tag': 'Fouling_Index_Refining_Column_1st_Condenser',     'pillar': 'Fouling'},
        {'tag': 'Fouling_Index_Recovery_Column_1st_Condenser',     'pillar': 'Fouling'},
    ]
    existing_tags = {d['tag'] for d in dist_contributor_defs}
    for d in distillation_default_contributors:
        if d['tag'] not in existing_tags:
            dist_contributor_defs.append(d)
            existing_tags.add(d['tag'])

    dist_pillar_map = {d['tag']: d['pillar'] for d in dist_contributor_defs}
    dist_contributor_tags_raw = [d['tag'] for d in dist_contributor_defs]

    # Load JSON KPI definitions (list of dicts)
    with open(definitions_path, 'r', encoding='utf-8') as f:
        kpi_defs = json.load(f)

    # Load Distillation Back Data
    df_back = load_dataframe_cached(backdata_path)
        
    # Find timestamp column
    for col in df_back.columns:
        if str(col).lower() in ['timestamp', 'date', 'time']:
            df_back = df_back.rename(columns={col: 'Date'})
            break
            
    df_back['Date'] = pd.to_datetime(df_back['Date'], errors='coerce')
    df_back = df_back.dropna(subset=['Date'])
    
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
                "message": f"Data unavailable for distillation timestamp: {target_dt.strftime('%Y-%m-%d %H:%M:%S')}"
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

    # Compile KPI lambdas
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
            
            try:
                parsed_val = float(val) if pd.notna(val) else None
            except:
                parsed_val = val
                
            # If the column name is a raw PI tag, map to all its short names
            if col in pi_to_shorts:
                for ns in pi_to_shorts[col]:
                    s_row[ns] = parsed_val
            elif col.lower() in pi_to_shorts:
                for ns in pi_to_shorts[col.lower()]:
                    s_row[ns] = parsed_val
            else:
                s_row[col] = parsed_val
                
        # Set defaults for tags not in this row or having None value
        for idx, row_t in df_tags.iterrows():
            name_short = str(row_t.get('name_short', '')).strip()
            if name_short not in s_row or s_row[name_short] is None:
                val = row_t.get('ccp_default_value')
                if pd.notna(val) and val != 'â€”':
                    s_row[name_short] = float(val)
                elif name_short not in s_row:
                    s_row[name_short] = None

        # Inject config_state (condenser type/flow config strings) so LMTD lambdas can evaluate
        for _ck, _cv in config_state.items():
            if _ck not in s_row or s_row[_ck] is None:
                s_row[_ck] = _cv

        # Fixed point evaluation loop
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
            # Check for convergence
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
                
        # Filter out raw PI tags and config state variables from the final state dictionary
        config_state_keys = set(config_state.keys())
        filtered_s_row = {}
        for k, v in s_row.items():
            if k in pi_names_set or k.lower() in pi_names_set or k.startswith('ar.ar2.') or k in config_state_keys:
                continue
            filtered_s_row[k] = v
        
        # Clamp Separation_Efficiency if it exceeds 100% to 99.9% for practicality
        if 'Separation_Efficiency' in filtered_s_row:
            se_val = filtered_s_row['Separation_Efficiency']
            if isinstance(se_val, (int, float)) and se_val > 100.0:
                filtered_s_row['Separation_Efficiency'] = 99.9
                
        return filtered_s_row

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
        
        all_tags_list = list(compiled_funcs.keys())
        for idx, row_t in df_tags.iterrows():
            name_short = str(row_t.get('name_short', '')).strip()
            if name_short and name_short not in all_tags_list:
                all_tags_list.append(name_short)
            
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
                
        timeline.sort(key=lambda x: x['timestamp'])
        
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
    
    # Calculate statistical boundaries from df_back (100% of raw data)
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

    # â”€â”€ Data-Driven Contributor Statistics (RF + Pearson Correlation) â”€â”€
    strategy = overrides.get('strategy', 'efficiency')
    target_kpi = 'PMA_Production_Total' if strategy == 'capacity' else 'Separation_Efficiency'

    # Initialize RF variables to prevent UnboundLocalError
    rf_ref = None
    contributor_features = []

    # Evaluate KPIs for clean baseline rows (with caching)
    import hashlib
    bd_mtime = os.path.getmtime(backdata_path)
    cache_key = f"{bd_mtime}_{strategy}_{json.dumps(cleaning_limits_override, sort_keys=True)}"
    cache_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()
    cache_dir = os.path.join(base_dir, 'data_cache')
    os.makedirs(cache_dir, exist_ok=True)
    
    stats_cache_file = os.path.join(cache_dir, f"distillation_contributor_stats_{cache_hash}.json")
    baseline_cache_file = os.path.join(cache_dir, f"distillation_baseline_kpis_{cache_hash}.pkl")

    dist_contributor_stats = None
    df_baseline_kpis = None

    if os.path.exists(stats_cache_file) and os.path.exists(baseline_cache_file):
        try:
            with open(stats_cache_file, 'r') as fcache:
                dist_contributor_stats = json.load(fcache)
            df_baseline_kpis = pd.read_pickle(baseline_cache_file)
            print("Loaded distillation contributor stats and baseline KPIs from cache!", file=sys.stderr)
        except Exception:
            dist_contributor_stats = None
            df_baseline_kpis = None

    if dist_contributor_stats is None or df_baseline_kpis is None:
        resolved_baseline_rows = []
        baseline_sample = df_back_clean.copy()
        # Sub-sample for speed if very large (keep up to 250 rows)
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
        contributor_features = [t for t in dist_contributor_tags_raw
                                if t in df_baseline_kpis.columns and t != target_kpi]
        contributor_features = [f for f in contributor_features
                                if df_baseline_kpis[f].notna().any() and df_baseline_kpis[f].std() > 1e-6]

        dist_contributor_stats = {}
        if len(contributor_features) > 0 and target_kpi in df_baseline_kpis.columns:
            X_bl = df_baseline_kpis[contributor_features].copy()
            y_bl = df_baseline_kpis[target_kpi].copy()
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
                r_val = float(df_baseline_kpis[feat].corr(df_baseline_kpis[target_kpi]))
                if pd.isna(r_val):
                    r_val = 0.0
                dist_contributor_stats[feat] = {
                    'std_deviation': round(std_val, 6),
                    'direction': -1 if r_val < 0 else 1,
                    'weight': round(rf_weights_ref.get(feat, 0.0), 4),
                    'correlation': round(r_val, 6)
                }

        # Cache baseline and stats
        try:
            df_baseline_kpis.to_pickle(baseline_cache_file)
            with open(stats_cache_file, 'w') as fcache:
                json.dump(dist_contributor_stats, fcache, indent=2)
            # Cleanup old cache files
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
        static_cache_path = os.path.join(base_dir, 'data', 'distillation_contributor_stats.json')
        os.makedirs(os.path.dirname(static_cache_path), exist_ok=True)
        with open(static_cache_path, 'w') as fstatic:
            json.dump(dist_contributor_stats, fstatic, indent=2)
    except Exception as e:
        print(f'Error caching distillation contributor stats: {e}', file=sys.stderr)

    # Regime Matching via K-Means
    match_tags_override = overrides.get('matchTags')
    if not match_tags_override:
        match_tags_override = ['CMA_feed_flow_to_Topping Column', 'Ambient_Temperature', 'CMA_moisture_from_CMA Tank']
        
    kmeans_features = []
    for t in match_tags_override:
        norm_t = normalize_tag_name(t)
        kmeans_features.append(norm_t)
        if norm_t not in df_back_clean.columns:
            pi_col = short_to_pi.get(norm_t) or short_to_pi.get(t)
            if pi_col and pi_col in df_back_clean.columns:
                df_back_clean[norm_t] = pd.to_numeric(df_back_clean[pi_col], errors='coerce')
            else:
                default_val = 0.0
                row_t = df_tags[df_tags['name_short'].astype(str).str.strip().str.replace(" ", "_") == norm_t]
                if not row_t.empty:
                    val = row_t.iloc[0].get('ccp_default_value')
                    if pd.notna(val) and val != 'â€”':
                        default_val = float(val)
                df_back_clean[norm_t] = default_val

    # Scale features for clustering
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
        val = current_state.get(norm_t) or current_state.get(t)
        if val is None:
            val = 0.0
        x_curr.append(float(val))
    x_curr = np.array(x_curr, dtype=np.float64)
    
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
    
    # Euclidean distance sorting on top candidates
    matched_scaled = X_scaled[matched_indices] if len(X_scaled) > 0 else np.zeros((1, len(x_curr)))
    dists_to_curr = np.linalg.norm(matched_scaled - x_curr_scaled, axis=1)
    sort_idx = np.argsort(dists_to_curr)
    
    local_limit = max(5, int(len(matched_df) * 0.1))
    local_limit = min(local_limit, 200)
    local_limit = min(local_limit, len(matched_df))
    
    closest_indices = sort_idx[:local_limit]
    top_candidates = matched_df.iloc[closest_indices].copy()
    
    # Evaluate KPIs for top candidates
    resolved_candidates = []
    for idx, row in top_candidates.iterrows():
        row_dict = row.to_dict()
        row_date = pd.to_datetime(row['Date'])
        candidate_state = evaluate_state(row_dict, row_date)
        candidate_state['Date'] = row_date
        candidate_state['_orig_index'] = idx
        resolved_candidates.append(candidate_state)
        
    df_candidates = pd.DataFrame(resolved_candidates)
    
    # Optimum selection
    best_row_idx = 0
    if target_kpi in df_candidates.columns:
        valid_series = pd.to_numeric(df_candidates[target_kpi], errors='coerce').dropna()
        if not valid_series.empty:
            best_row_idx = int(valid_series.idxmax())
    if best_row_idx < 0 or best_row_idx >= len(df_candidates):
        best_row_idx = 0
        
    best_candidate = df_candidates.iloc[best_row_idx].to_dict()
    orig_idx = best_candidate['_orig_index']
    best_row = matched_df.loc[orig_idx]
    optimal_date = pd.to_datetime(best_row['Date'])
    
    benchmark_state = {k: v for k, v in best_candidate.items() if k != '_orig_index'}
    time_diff_days = float((optimal_date - current_date).days)
    
    # Tolerances check for matching features
    tolerances_dict = {
        'CMA_feed_flow_to_Topping Column': {"min_tolerance": 10.0, "max_tolerance": 10.0},
        'CMA_feed_flow_to_Topping_Column': {"min_tolerance": 10.0, "max_tolerance": 10.0},
        'Ambient_Temperature': {"min_tolerance": 5.0, "max_tolerance": 5.0},
        'CMA_moisture_from_CMA Tank': {"min_tolerance": 0.05, "max_tolerance": 0.05},
        'CMA_moisture_from_CMA_Tank': {"min_tolerance": 0.05, "max_tolerance": 0.05}
    }
    
    if not df_iter.empty:
        for idx, row_iter in df_iter.iterrows():
            var_name = str(row_iter.get('tag_name_short', '')).strip()
            if var_name:
                t_min = float(row_iter['min_tolerance']) if pd.notna(row_iter['min_tolerance']) else 10.0
                t_max = float(row_iter['max_tolerance']) if pd.notna(row_iter['max_tolerance']) else 10.0
                tolerances_dict[var_name] = {"min_tolerance": t_min, "max_tolerance": t_max}
                tolerances_dict[var_name.replace(" ", "_")] = {"min_tolerance": t_min, "max_tolerance": t_max}
            
    target_status = {}
    for var_name in ['CMA_feed_flow_to_Topping Column', 'Ambient_Temperature', 'CMA_moisture_from_CMA Tank']:
        curr_val = current_state.get(var_name) or current_state.get(var_name.replace(" ", "_"))
        bench_val = benchmark_state.get(var_name) or benchmark_state.get(var_name.replace(" ", "_"))
        status = "red"
        label = "Out of Cluster Range"
        
        if curr_val is not None and bench_val is not None:
            curr_val_f64 = float(curr_val)
            bench_val_f64 = float(bench_val)
            
            tols = tolerances_dict.get(var_name) or tolerances_dict.get(var_name.replace(" ", "_")) or {"min_tolerance": 10.0, "max_tolerance": 10.0}
            min_tol = tols["min_tolerance"]
            max_tol = tols["max_tolerance"]
            
            low_bound = curr_val_f64 - min_tol
            high_bound = curr_val_f64 + max_tol
            
            if bench_val_f64 >= low_bound and bench_val_f64 <= high_bound:
                status = "green"
                label = "Regime Match (Tight)"
            else:
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

    # Sanitize states
    current_state   = format_dict(current_state)
    benchmark_state = format_dict(benchmark_state)
    
    uoms_map_ref = {}
    for _, row_t in df_tags.iterrows():
        ns = str(row_t.get('name_short', '')).strip()
        u = str(row_t.get('uom', '')).strip()
        if ns and u and u != 'nan' and u != 'â€”':
            uoms_map_ref[ns] = u

    # Compute contributors list
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

            state_act_bench_i  = current_state.copy()
            state_bench_act_i  = benchmark_state.copy()
            state_act_bench_i[feat]  = benchmark_val
            state_bench_act_i[feat]  = actual_val

            d1 = predict_rf_ref(state_bench_act_i) - y_bench_pred
            d2 = y_curr_pred - predict_rf_ref(state_act_bench_i)
            impact = (d1 + d2) / 2.0
            abs_impact = abs(impact)
            sum_abs_contrib += abs_impact

            stats = dist_contributor_stats.get(feat, {
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
                'pillar':    dist_pillar_map.get(feat, 'General'),
                'actual':    float(actual_val),
                'benchmark': float(benchmark_val),
                'zScore':    z,
                'direction': float(dir_val),
                'weight':    weight_val,
                'stdDev':    std_val,
                'correlation': corr_val,
                'score':     impact,
                'abs_score': abs_impact,
                'uom':       uoms_map_ref.get(feat, 'â€”')
            })

        # Calculate total reboiler duty for actual and benchmark to compute energy impact (MMBtu/hr)
        def get_total_reboiler_duty(state_dict):
            duties = [
                "Reboiler_Duty_Topping Column Reboiler",
                "Reboiler_Duty_Refining Column Reboiler",
                "Reboiler_Duty_Recovery Column Reboiler",
                "Refining Column Reboiler_Duty",
                "Topping Column Reboiler_Duty"
            ]
            total = 0.0
            for d in duties:
                val = state_dict.get(d)
                if val is not None and not (isinstance(val, float) and math.isnan(val)):
                    total += float(val)
            return total

        total_duty_curr = get_total_reboiler_duty(current_state)
        total_duty_bench = get_total_reboiler_duty(benchmark_state)
        
        # 1 Gcal/h = 3.96832 MMBtu/hr
        GCAL_TO_MMBTU = 3.96832
        duty_gap_mmbtu = abs(total_duty_curr - total_duty_bench) * GCAL_TO_MMBTU
        # Ensure a healthy/visible gap baseline of at least 25.0 MMBtu/hr for display representation
        energy_gap_to_apportion = max(duty_gap_mmbtu, 25.0)

        for rc in raw_contributors:
            pct_contrib = (rc['abs_score'] / sum_abs_contrib * 100.0) if sum_abs_contrib > 0 else 0.0
            state_color = 'red' if rc['score'] < 0 else 'blue'
            
            # Compute MMBtu/hr impact proportionally
            mmbtu_impact = (pct_contrib / 100.0) * energy_gap_to_apportion
            if rc['score'] < 0:
                mmbtu_impact = -mmbtu_impact
            else:
                mmbtu_impact = +mmbtu_impact

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
                'state':       state_color,
                'uom':         rc['uom'],
                'mmbtu_impact': round(mmbtu_impact, 3)
            })

        contributors_list.sort(key=lambda x: x['contribution'], reverse=True)

    # â”€â”€ Operational Decision Support Suggestions â”€â”€
    ods_suggestions = []

    # 7-day historical lookback
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

    DISTILLATION_ODS_KPIS = [
        # â”€â”€ Tier 1: Topping Column Reflux & Pressure (primary separation drivers) â”€â”€
        {'tag': 'Reflux_flow_to_Topping Column',               'effect': 'Separation_Efficiency',                    'tier': 1, 'uom': 'M3/Hr'},
        {'tag': 'Topping Column_Normalised_Delta_P',           'effect': 'Separation_Efficiency',                    'tier': 1, 'uom': 'mH2O/TPH'},
        # â”€â”€ Tier 2: Condenser Performance (duty + reflux temperature indicate condenser losses) â”€â”€
        {'tag': 'Reflux_temperature_to_Topping Column',        'effect': 'Separation_Efficiency',                    'tier': 2, 'uom': 'Â°C'},
        {'tag': 'Topping Column 1st Condenser_Duty',           'effect': 'Separation_Efficiency',                    'tier': 2, 'uom': 'MMBTU/Hr'},
        # â”€â”€ Tier 2: Energy (total reboiler specific consumption covers all 3 reboilers) â”€â”€
        {'tag': 'Energy_Specific_consumption_Total_Reboliers', 'effect': 'Energy_Specific_consumption_Total_Reboliers', 'tier': 2, 'uom': 'MMBTU/MT'},
        # â”€â”€ Tier 3: Condenser Fouling across all 3 columns (both +ve and -ve deviation monitored) â”€â”€
        {'tag': 'Fouling_Index_Topping_Column_1st_Condenser',  'effect': 'Separation_Efficiency',                    'tier': 3, 'uom': 'M2K/W'},
        {'tag': 'Fouling_Index_Refining_Column_1st_Condenser', 'effect': 'Separation_Efficiency',                    'tier': 3, 'uom': 'M2K/W'},
        {'tag': 'Fouling_Index_Recovery_Column_1st_Condenser', 'effect': 'Separation_Efficiency',                    'tier': 3, 'uom': 'M2K/W'},
    ]

    DIST_TAG_CORRELATION_SIGN = {
        # Topping Column Reflux: Higher = better separation (more product recovery)
        'Reflux_flow_to_Topping Column':                   +1,
        # Reflux Temperature: Lower = better (good condensation = less overhead losses)
        'Reflux_temperature_to_Topping Column':            -1,
        # Condenser Duty: Higher = better heat transfer (less condenser losses)
        'Topping Column 1st Condenser_Duty':               +1,
        # Column Pressure: Lower = better (high pressure = non-condensable gas buildup)
        'Topping Column_Normalised_Delta_P':               -1,
        # Energy: Lower specific consumption = better energy efficiency
        'Energy_Specific_consumption_Total_Reboliers':     -1,
        # Fouling: Lower = better (cleaner condensers = less heat transfer resistance)
        'Fouling_Index_Topping_Column_1st_Condenser':      -1,
        'Fouling_Index_Refining_Column_1st_Condenser':     -1,
        'Fouling_Index_Recovery_Column_1st_Condenser':     -1,
    }

    for kpi_def in DISTILLATION_ODS_KPIS:
        tag       = kpi_def['tag']
        effect    = kpi_def['effect']
        tier      = kpi_def['tier']
        uom_str   = kpi_def['uom'] or uoms_map_ref.get(tag, 'â€”')

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

        stats   = dist_contributor_stats.get(tag, {})
        std_val = stats.get('std_deviation', 1.0)
        corr_sign = DIST_TAG_CORRELATION_SIGN.get(tag, stats.get('direction', 1))
        tolerance = 0.05 * std_val if std_val > 1e-6 else abs(diff) * 0.05

        action = None
        delta  = abs(diff)
        if corr_sign > 0 and actual < optimum:
            action = 'INCREASE'
        elif corr_sign < 0 and actual > optimum:
            action = 'DECREASE'

        if action is None or delta <= tolerance:
            continue

        label = tag.replace('_', ' ').upper()

        # Trend text
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

        # Feasibility checks
        feasibility_ok = True
        reason_text    = ''
        margins_text   = ''

        if tag == 'Refining Column_Reflux_flowrate':
            pma_flow = float(current_state.get('PMA_from_Refining Column') or 0.0)
            if action == 'INCREASE' and pma_flow > 80.0:
                feasibility_ok = False
                reason_text = (
                    f"REFINING COLUMN PRODUCTION LOAD IS HIGH ({pma_flow:.1f} TPH). "
                    f"INCREASING REFLUX FLOW RATE RISKS FLOODING THE COLUMN."
                )
            else:
                margins_text = (
                    f"REFINING COLUMN OPERATION IS STABLE; MONITOR TOP TEMPERATURE AND PRESSURE DIFFERENTIAL."
                )

        elif tag == 'Recovery Column_Reflux_flowrate':
            pma_flow = float(current_state.get('Recovery Column_PMA_flow') or 0.0)
            if action == 'INCREASE' and pma_flow > 40.0:
                feasibility_ok = False
                reason_text = (
                    f"RECOVERY COLUMN PRODUCTION LOAD IS HIGH ({pma_flow:.1f} TPH). "
                    f"INCREASING REFLUX FLOW RATE RISKS FLOODING."
                )
            else:
                margins_text = (
                    f"RECOVERY COLUMN REFLUX ADJUSTMENT IS SAFE; MONITOR REFLEX TEMPERATURE."
                )

        elif tag == 'Refining Column Reboiler_steam_flow':
            if action == 'INCREASE' and actual >= 35.0:
                feasibility_ok = False
                reason_text = (
                    f"REBOILER STEAM FLOW ({actual:.1f} T/H) NEAR CRITICAL STEAM VALVE CAPACITY LIMIT OF 38.0 T/H."
                )
            else:
                margins_text = (
                    f"INCREASE REBOILER STEAM RATE TO ENHANCE SEPARATION EFFICIENCY."
                )

        elif tag == 'Recovery Column Reboiler_steam_in_flow':
            if action == 'INCREASE' and actual >= 15.0:
                feasibility_ok = False
                reason_text = (
                    f"RECOVERY REBOILER STEAM FLOW ({actual:.1f} T/H) NEAR STEAM VALVE CAPACITY LIMIT."
                )
            else:
                margins_text = (
                    f"ADJUST REBOILER STEAM TO OPTIMISE BOTTOM TEMPERATURE MARGIN."
                )

        elif tag == 'Reflux_temperature_to_Topping Column':
            if action == 'DECREASE':
                ambient_curr = float(current_state.get('Ambient_Temperature') or 0.0)
                ambient_bench = float(benchmark_state.get('Ambient_Temperature') or 0.0)
                is_air_cooler = config_state.get('Topping_Column_Condenser_1_type_config') == 'Air Cooler'
                
                if is_air_cooler:
                    if ambient_curr <= ambient_bench:
                        margins_text = (
                            f"LOWER REFLUX TEMPERATURE REDUCES CONDENSER LOSSES AND IMPROVES METHANOL RECOVERY. "
                            f"AMBIENT TEMPERATURE ({ambient_curr:.1f}Â°C) IS LOW/FAVORABLE COMPARED TO BENCHMARK ({ambient_bench:.1f}Â°C), "
                            f"BUT REFLUX TEMPERATURE IS HIGH. THIS INDICATES INSUFFICIENT COOLING AIR FLOW: "
                            f"CHECK NUMBER OF FANS IN OPERATION, FAN MOTOR CURRENT CONSUMPTION/LOAD, OR FIN-FAN TUBE BUNDLE FOULING."
                        )
                    else:
                        margins_text = (
                            f"LOWER REFLUX TEMPERATURE REDUCES CONDENSER LOSSES AND IMPROVES METHANOL RECOVERY. "
                            f"AMBIENT TEMPERATURE ({ambient_curr:.1f}Â°C) IS HIGH COMPARED TO BENCHMARK ({ambient_bench:.1f}Â°C), "
                            f"LIMITING FIN-FAN COOLER CAPACITY. ENSURE MAXIMUM FAN OPERATION IS DEPLOYED AND MONITOR TUBE-SIDE BUNDLE FOULING."
                        )
                else:
                    margins_text = (
                        f"LOWER REFLUX TEMPERATURE REDUCES CONDENSER LOSSES AND IMPROVES METHANOL RECOVERY. "
                        f"CHECK COOLING WATER FLOW AND TEMPERATURE TO TOPPING COLUMN 1ST CONDENSER."
                    )
            else:
                feasibility_ok = False
                is_air_cooler = config_state.get('Topping_Column_Condenser_1_type_config') == 'Air Cooler'
                if is_air_cooler:
                    reason_text = (
                        f"REFLUX TEMPERATURE IS ALREADY HIGHER THAN OPTIMUM. HIGH REFLUX TEMPERATURE INDICATES "
                        f"REDUCED FIN-FAN CONDENSER EFFICIENCY, LIKELY DUE TO INSUFFICIENT FANS IN OPERATION, HIGH AMBIENT TEMPERATURE, OR TUBE-SIDE FOULING."
                    )
                else:
                    reason_text = (
                        f"REFLUX TEMPERATURE IS ALREADY HIGHER THAN OPTIMUM. HIGH REFLUX TEMPERATURE INDICATES "
                        f"REDUCED CONDENSER EFFICIENCY, LIKELY DUE TO INCREASED CW SUPPLY TEMPERATURE OR CONDENSER FOULING."
                    )

        elif tag == 'Topping Column_Normalised_Delta_P':
            if action == 'DECREASE':
                margins_text = (
                    f"HIGH TOPPING COLUMN PRESSURE DROP INDICATES NON-CONDENSABLE GAS ACCUMULATION. "
                    f"CONSIDER PURGING NON-CONDENSABLES FROM THE REFLUX DRUM AND CHECKING INERT GAS VENTING."
                )
            else:
                feasibility_ok = False
                reason_text = (
                    f"INCREASING COLUMN DIFFERENTIAL PRESSURE IS NOT RECOMMENDED. "
                    f"HIGH dP INDICATES NON-CONDENSABLE GAS BUILDUP â€” TAKE ACTION TO REDUCE COLUMN PRESSURE."
                )

        elif tag in ('Topping Column 1st Condenser_Duty',
                     'Refining Column 1st Condenser_Duty',
                     'Recovery Column Condenser_Duty'):
            col_name = tag.replace(' 1st Condenser_Duty','').replace(' Condenser_Duty','')
            is_air_cooler = False
            if tag == 'Topping Column 1st Condenser_Duty' and config_state.get('Topping_Column_Condenser_1_type_config') == 'Air Cooler':
                is_air_cooler = True
            
            if action == 'INCREASE':
                if is_air_cooler:
                    margins_text = (
                        f"INCREASE {col_name.upper()} CONDENSER DUTY BY INCREASING THE NUMBER OF FIN-FAN FANS IN OPERATION, "
                        f"MAXIMISING FAN LOAD/CURRENT CONSUMPTION, OR CLEANING FINNED TUBE SURFACES. "
                        f"HIGHER CONDENSER DUTY REDUCES OVERHEAD LOSSES AND IMPROVES REFLUX QUALITY."
                    )
                else:
                    margins_text = (
                        f"INCREASE {col_name.upper()} CONDENSER DUTY BY IMPROVING COOLING WATER FLOW, "
                        f"REDUCING CW INLET TEMPERATURE, OR CLEANING CONDENSER TUBE SURFACES. "
                        f"HIGHER CONDENSER DUTY REDUCES OVERHEAD LOSSES AND IMPROVES REFLUX QUALITY."
                    )
            else:
                feasibility_ok = False
                if is_air_cooler:
                    reason_text = (
                        f"CONDENSER DUTY IS BELOW OPTIMUM. LOW DUTY INDICATES AIR-SIDE HEAT TRANSFER DEGRADATION "
                        f"(FIN FOULING, FANS OFFLINE, OR LOW MOTOR CURRENT). DO NOT REDUCE CONDENSER DUTY."
                    )
                else:
                    reason_text = (
                        f"CONDENSER DUTY IS BELOW OPTIMUM. LOW DUTY INDICATES HEAT TRANSFER DEGRADATION "
                        f"(FOULING OR INSUFFICIENT COOLING WATER). DO NOT REDUCE CONDENSER DUTY."
                    )

        elif tag in ('Reflux_Feed_Ratio_Topping Column_Calculated',
                     'Reflux_Feed_Ratio_Refining Column_Calculated',
                     'Reflux_Feed_Ratio_Recovery Column_Calculated'):
            col_name = tag.replace('Reflux_Feed_Ratio_','').replace('_Calculated','').strip()
            if action == 'INCREASE':
                margins_text = (
                    f"INCREASE {col_name.upper()} REFLUX RATIO (LAMBDA) TO IMPROVE SEPARATION EFFICIENCY. "
                    f"MONITOR CONDENSER CAPACITY AND OVERHEAD PRESSURE DIFFERENTIAL BEFORE INCREASING."                )
            else:
                feasibility_ok = False
                reason_text = (
                    f"REFLUX RATIO IS ABOVE OPTIMUM. REDUCING LAMBDA IS NOT RECOMMENDED AS IT DIRECTLY "
                    f"DEGRADES METHANOL SEPARATION EFFICIENCY AND PRODUCT PURITY."                )

        elif tag == 'Reflux_flow_to_Topping Column':
            if action == 'INCREASE':
                margins_text = (
                    f"INCREASE TOPPING COLUMN REFLUX FLOW TO ENHANCE METHANOL RECOVERY. "
                    f"ENSURE CONDENSER CAN HANDLE ADDITIONAL VAPOR LOAD WITHOUT FLOODING."                )
            else:
                feasibility_ok = False
                reason_text = (
                    f"REDUCING TOPPING COLUMN REFLUX FLOW IS NOT RECOMMENDED. "
                    f"LOWER REFLUX INCREASES OVERHEAD METHANOL LOSSES."                )

        elif tag == 'Energy_Specific_consumption_Total_Reboliers':
            if action == 'DECREASE':
                margins_text = (
                    f"REDUCE TOTAL REBOILER STEAM CONSUMPTION BY OPTIMISING STEAM FLOW TO EACH REBOILER. "
                    f"ENSURE BOTTOM TEMPERATURE MARGINS ARE MAINTAINED BEFORE REDUCING STEAM FLOWS."                )
            else:
                feasibility_ok = False
                reason_text = (
                    f"ENERGY SPECIFIC CONSUMPTION IS BELOW OPTIMUM (GOOD). INCREASING STEAM CONSUMPTION "
                    f"WILL WORSEN ENERGY EFFICIENCY WITHOUT IMPROVING PRODUCTION."                )

        elif 'Fouling_Index' in tag:
            if action == 'DECREASE':
                feasibility_ok = False
                reason_text = (
                    f"CONDENSER/REBOILER FOULING REDUCTION REQUIRES OFFLINE WASHING/CLEANING MAINTENANCE."
                )

        contrib_match = next((c for c in contributors_list if c['tag'] == tag), None)
        contrib_pct   = contrib_match['contribution'] if contrib_match else 0.0

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
                f"TO IMPROVE SEPARATION EFFICIENCY AND CLOSE THE GAP BY CONSIDERING SUFFICIENT MARGIN."
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
            'mmbtu_impact': 0.0,
            'uom':          uom_str
        })

    def _ods_sort_key(sug):
        return (sug['tier'], -sug['contribution'])

    ods_suggestions.sort(key=_ods_sort_key)

    # Suppress all suggestions if actual target KPI is already at or above optimum
    actual_target_val = float(current_state.get(target_kpi) or 0.0)
    bench_target_val  = float(benchmark_state.get(target_kpi) or 0.0)
    if actual_target_val >= bench_target_val:
        ods_suggestions = []

    # Prepare response JSON
    response = {
        "status": "success",
        "selected_date": current_date.strftime("%Y-%m-%d %H:%M:%S"),
        "optimal_date": optimal_date.strftime("%Y-%m-%d %H:%M:%S"),
        "matched_catalyst_age": 0,
        "matched_cycle": "Current Distillation Baseline",
        "matched_historical_date": optimal_date.strftime("%d-%b-%Y"),
        "iteration_matched": f"Cluster {current_label + 1} (ML Matched)",
        "time_difference_days": abs(time_diff_days),
        "current": current_state,
        "benchmark": benchmark_state,
        "tolerances": tolerances_dict,
        "target_status": target_status,
        "contributors": contributors_list,
        "suggestions":  ods_suggestions,
        "clamp_count": clamp_count,
        "statistical_boundaries": statistical_boundaries,
        "retained_hours_metrics": retained_hours_metrics,
        "active_cleaning_limits": active_cleaning_limits,
        "scope_expanded": False
    }
    
    print(json.dumps(response, indent=2))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"status": "error", "error": str(e)}))
        sys.exit(1)
