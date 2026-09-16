import sys
import json
import ast
import re

# Standard fallback Reformer KPIs and their metadata/formulas
DEFAULT_REFORMER_KPIS = {
    "Reformer_Steam_Carbon_Ratio": {
        "name": "Steam to Carbon Ratio",
        "description": "Steam to Carbon molar ratio in feed gas",
        "uom": "mol/mol",
        "category": "Reformer Feed",
        "formula": "(Steam_Flow * 18.02) / (Natural_Gas_Flow * 16.04 * Methane_Purity)",
        "inputs": ["Steam_Flow", "Natural_Gas_Flow", "Methane_Purity"]
    },
    "Reformer_Methane_Conversion": {
        "name": "Reformer Methane Conversion",
        "description": "Methane conversion percentage across the reformer",
        "uom": "%",
        "category": "Reformer Performance",
        "formula": "100 * (Methane_Inlet - Methane_Outlet) / Methane_Inlet",
        "inputs": ["Methane_Inlet", "Methane_Outlet"]
    },
    "Reformer_Furnace_Heat_Duty": {
        "name": "Reformer Furnace Heat Duty",
        "description": "Radiant heat duty of the reformer furnace",
        "uom": "Gcal/hr",
        "category": "Thermal Efficiency",
        "formula": "Fuel_Flow * Fuel_Heating_Value",
        "inputs": ["Fuel_Flow", "Fuel_Heating_Value"]
    },
    "Reformer_Approach_To_Equilibrium": {
        "name": "Approach to Equilibrium",
        "description": "Temperature difference between actual outlet and equilibrium",
        "uom": "°C",
        "category": "Reformer Performance",
        "formula": "Reformer_Outlet_Temperature - Reformer_Equilibrium_Temperature",
        "inputs": ["Reformer_Outlet_Temperature", "Reformer_Equilibrium_Temperature"]
    },
    "ATR_Oxygen_Carbon_Ratio": {
        "name": "ATR Oxygen to Carbon Ratio",
        "description": "Oxygen to Carbon molar ratio in Autothermal Reformer feed",
        "uom": "mol/mol",
        "category": "ATR Feed",
        "formula": "Oxygen_Flow / (ATR_Hydrocarbon_Flow * ATR_Hydrocarbon_Methane_Purity)",
        "inputs": ["Oxygen_Flow", "ATR_Hydrocarbon_Flow", "ATR_Hydrocarbon_Methane_Purity"]
    },
    "ATR_Steam_Carbon_Ratio": {
        "name": "ATR Steam to Carbon Ratio",
        "description": "Steam to Carbon molar ratio in Autothermal Reformer feed",
        "uom": "mol/mol",
        "category": "ATR Feed",
        "formula": "(ATR_Steam_Flow * 18.02) / (ATR_Hydrocarbon_Flow * 16.04)",
        "inputs": ["ATR_Steam_Flow", "ATR_Hydrocarbon_Flow"]
    }
}

# Standard metadata details for raw tags to enrich the UI tables
RAW_TAG_META_CATALOG = {
    "Steam_Flow": {"group": "Reformer Feed", "uom": "t/h", "design": 120.0, "min": 10.0, "max": 250.0, "def": 120.0},
    "Natural_Gas_Flow": {"group": "Reformer Feed", "uom": "t/h", "design": 40.0, "min": 5.0, "max": 100.0, "def": 40.0},
    "Methane_Purity": {"group": "Reformer Feed", "uom": "fraction 0-1", "design": 0.94, "min": 0.70, "max": 1.0, "def": 0.94},
    "Methane_Inlet": {"group": "Reformer Feed", "uom": "mol%", "design": 72.0, "min": 50.0, "max": 95.0, "def": 72.0},
    "Methane_Outlet": {"group": "Reformer Outlet", "uom": "mol%", "design": 4.5, "min": 1.0, "max": 15.0, "def": 4.5},
    "Fuel_Flow": {"group": "Furnace System", "uom": "t/h", "design": 15.0, "min": 1.0, "max": 40.0, "def": 15.0},
    "Fuel_Heating_Value": {"group": "Furnace System", "uom": "kcal/kg", "design": 8500.0, "min": 5000.0, "max": 12000.0, "def": 8500.0},
    "Reformer_Outlet_Temperature": {"group": "Reformer Outlet", "uom": "°C", "design": 860.0, "min": 500.0, "max": 1000.0, "def": 860.0},
    "Reformer_Equilibrium_Temperature": {"group": "Reformer Outlet", "uom": "°C", "design": 845.0, "min": 500.0, "max": 1000.0, "def": 845.0},
    "Oxygen_Flow": {"group": "ATR Feed", "uom": "Nm3/h", "design": 45000.0, "min": 5000.0, "max": 90000.0, "def": 45000.0},
    "ATR_Hydrocarbon_Flow": {"group": "ATR Feed", "uom": "Nm3/h", "design": 110000.0, "min": 10000.0, "max": 200000.0, "def": 110000.0},
    "ATR_Hydrocarbon_Methane_Purity": {"group": "ATR Feed", "uom": "fraction 0-1", "design": 0.90, "min": 0.70, "max": 1.0, "def": 0.90},
    "ATR_Steam_Flow": {"group": "ATR Feed", "uom": "t/h", "design": 80.0, "min": 10.0, "max": 180.0, "def": 80.0},
    "Ambient_Temperature": {"group": "Other", "uom": "°C", "design": 25.0, "min": -10.0, "max": 50.0, "def": 25.0},
    "Reformer_Outlet_Pressure": {"group": "Reformer Outlet", "uom": "bar g", "design": 28.0, "min": 5.0, "max": 50.0, "def": 28.0}
}

def clean_var_name(name):
    return re.sub(r'[^a-zA-Z0-9_]', '', name).strip()

def parse_formula_vars(formula_str):
    # Tokenize words, exclude numbers and math keywords
    tokens = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', formula_str)
    exclude = {'math', 'exp', 'log', 'sin', 'cos', 'tan', 'min', 'max', 'pow', 'sqrt', 'abs', 'round', 'float', 'int'}
    return [t for t in tokens if t not in exclude]

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No KPI file path provided."}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code_content = f.read()
            
        tree = ast.parse(code_content)
        
        kpis_extracted = {}
        raw_tags_extracted = set()
        
        # 1. Look for KPI_CATALOG variable definition in AST
        catalog_found = False
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == 'KPI_CATALOG':
                        try:
                            # Evaluate literal dict
                            eval_val = ast.literal_eval(node.value)
                            if isinstance(eval_val, dict):
                                for kpi_key, val in eval_val.items():
                                    if isinstance(val, dict):
                                        kpis_extracted[kpi_key] = {
                                            "name": val.get("name") or kpi_key.replace('_', ' '),
                                            "description": val.get("description") or "",
                                            "uom": val.get("uom") or val.get("unit") or "",
                                            "category": val.get("category") or val.get("cat") or "Reformer",
                                            "formula": val.get("formula_display") or val.get("formula") or ""
                                        }
                                        # Parse inputs from formula
                                        if kpis_extracted[kpi_key]["formula"]:
                                            for tok in parse_formula_vars(kpis_extracted[kpi_key]["formula"]):
                                                raw_tags_extracted.add(tok)
                                catalog_found = True
                        except Exception as e:
                            # If literal_eval fails, continue to parse using AST walking
                            pass
                            
        # 2. Walk AST to find assignments to dicts or variables
        # Look for kpis['KPI_Name'] = ... or similar
        for node in ast.walk(tree):
            # Dict subscripts like kpis['Reformer_Steam_Carbon_Ratio'] = ...
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Subscript):
                        if isinstance(target.value, ast.Name) and target.value.id in ('kpis', 'kpi', 'results', 'res', 'outputs'):
                            if isinstance(target.slice, ast.Constant) and isinstance(target.slice.value, str):
                                kpi_key = target.slice.value
                                if kpi_key not in kpis_extracted:
                                    kpis_extracted[kpi_key] = {
                                        "name": kpi_key.replace('_', ' '),
                                        "description": "Calculated KPI",
                                        "uom": "",
                                        "category": "Reformer",
                                        "formula": ""
                                    }
                            elif isinstance(target.slice, ast.Index) and isinstance(target.slice.value, ast.Constant) and isinstance(target.slice.value.value, str):
                                # Compatibility for older python AST index representation
                                kpi_key = target.slice.value.value
                                if kpi_key not in kpis_extracted:
                                    kpis_extracted[kpi_key] = {
                                        "name": kpi_key.replace('_', ' '),
                                        "description": "Calculated KPI",
                                        "uom": "",
                                        "category": "Reformer",
                                        "formula": ""
                                    }
                                    
            # Dict reads like raw['Steam_Flow'] or sv.get('Methane_Purity')
            elif isinstance(node, ast.Subscript):
                if isinstance(node.value, ast.Name) and node.value.id in ('raw', 'sv', 'vars', 'raw_vars', 'inputs'):
                    if isinstance(node.slice, ast.Constant) and isinstance(node.slice.value, str):
                        raw_tags_extracted.add(node.slice.value)
                    elif isinstance(node.slice, ast.Index) and isinstance(node.slice.value, ast.Constant) and isinstance(node.slice.value.value, str):
                        raw_tags_extracted.add(node.slice.value.value)
            
            # Method call get like raw.get('Methane_Purity') or sv.get(...)
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute):
                    if isinstance(node.func.value, ast.Name) and node.func.value.id in ('raw', 'sv', 'vars', 'raw_vars', 'inputs'):
                        if node.func.attr == 'get' and len(node.args) > 0:
                            first_arg = node.args[0]
                            if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
                                raw_tags_extracted.add(first_arg.value)

        # 3. If nothing extracted, fall back to standard list
        if not kpis_extracted:
            for k, info in DEFAULT_REFORMER_KPIS.items():
                kpis_extracted[k] = {
                    "name": info["name"],
                    "description": info["description"],
                    "uom": info["uom"],
                    "category": info["category"],
                    "formula": info["formula"]
                }
                for inp in info["inputs"]:
                    raw_tags_extracted.add(inp)
                    
        # Ensure all inputs listed in KPI formulas are in raw_tags_extracted
        for k, kpi in kpis_extracted.items():
            if kpi["formula"]:
                for tok in parse_formula_vars(kpi["formula"]):
                    if tok not in kpis_extracted: # Make sure we don't treat other KPIs as raw inputs
                        raw_tags_extracted.add(tok)
                        
        # 4. Filter raw tags list, construct rich output
        # Remove any KPIs that were accidentally classed as raw inputs
        raw_tags_set = raw_tags_extracted - set(kpis_extracted.keys())
        
        # Build the final lists
        kpis_list = []
        for key, details in kpis_extracted.items():
            kpis_list.append({
                "name_short": key,
                "name": details["name"],
                "description": details["description"],
                "uom": details["uom"] or DEFAULT_REFORMER_KPIS.get(key, {}).get("uom", "—"),
                "category": details["category"] or DEFAULT_REFORMER_KPIS.get(key, {}).get("category", "Reformer"),
                "formula": details["formula"] or DEFAULT_REFORMER_KPIS.get(key, {}).get("formula", "")
            })
            
        raw_inputs_list = []
        for tag in sorted(raw_tags_set):
            meta = RAW_TAG_META_CATALOG.get(tag, {"group": "Reformer Feed", "uom": "—", "design": "", "min": "", "max": "", "def": ""})
            raw_inputs_list.append({
                "name_short": tag,
                "group": meta["group"],
                "default_uom": meta["uom"],
                "design_value": meta["design"],
                "min_value": meta["min"],
                "max_value": meta["max"],
                "default_value": meta["def"],
                "pi_name": f"REF.{tag.upper()}.PV"
            })
            
        print(json.dumps({
            "status": "success",
            "kpis": kpis_list,
            "raw_inputs": raw_inputs_list
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": f"Failed to parse KPI script: {str(e)}"
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
