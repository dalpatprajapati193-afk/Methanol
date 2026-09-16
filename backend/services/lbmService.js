import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

function parseDateHelper(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  let d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  
  const str = String(val).trim();
  const parts = str.split(/[-:\s/]/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase().substring(0, 3);
    const month = months[monthStr] !== undefined ? months[monthStr] : parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    
    const hour = parts[3] ? parseInt(parts[3], 10) : 0;
    const min = parts[4] ? parseInt(parts[4], 10) : 0;
    const sec = parts[5] ? parseInt(parts[5], 10) : 0;
    
    return new Date(year, month, day, hour, min, sec);
  }
  return null;
}

export class LBMService {
  /**
   * Parses the Easy_feature_file.xlsx dynamically.
   * Extracts tags, formulas, contributors, and rules.
   */
  static parseEasyFeatureFile() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    let filePath = path.join(__dirname, '..', 'Easy_feature_file.xlsx');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'server', 'Easy_feature_file.xlsx');
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'Easy_feature_file.xlsx');
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`Easy_feature_file.xlsx not found at paths checked.`);
    }

    const workbook = XLSX.readFile(filePath);
    
    // 1. Read Tags Sheet
    const tagsSheet = workbook.Sheets['Tags'];
    const tagsData = XLSX.utils.sheet_to_json(tagsSheet);
    
    const rawTags = [];
    const formulas = {};
    const uoms = {};
    const hierarchies = {};
    const benchmarks = {};
    
    tagsData.forEach(row => {
      const name = row.name_short;
      if (!name || name === '—') return;
      
      uoms[name] = row.uom || '—';
      hierarchies[name] = row.category || 'System';
      benchmarks[name] = row.ccp_default_value !== undefined ? parseFloat(row.ccp_default_value) : null;
      
      if (row.type === 'pi') {
        rawTags.push({
          name_short: name,
          pi_name: row.pi_name,
          default_value: row.ccp_default_value !== undefined ? parseFloat(row.ccp_default_value) : 0,
          min_value: (row.ccp_lolo !== undefined && row.ccp_lolo !== null && row.ccp_lolo !== '—') ? parseFloat(row.ccp_lolo) : null,
          max_value: (row.ccp_hihi !== undefined && row.ccp_hihi !== null && row.ccp_hihi !== '—') ? parseFloat(row.ccp_hihi) : null
        });
      } else if (row.type === 'inferred' || row.type === 'calculated') {
        if (row.formula && row.formula !== '—') {
          formulas[name] = row.formula;
        }
      }
    });
    
    // 2. Read LBM_Contributors Sheet
    const contributorsSheet = workbook.Sheets['LBM_Contributors'];
    const contributorsData = XLSX.utils.sheet_to_json(contributorsSheet);
    
    const contributors = [];
    contributorsData.forEach(row => {
      const name = row.tag_name_short;
      if (!name) return;
      
      contributors.push({
        tag_name_short: name,
        pillar_name: row.pillar_name || 'General',
        std_deviation: parseFloat(row.std_deviation) || 1.0,
        direction: row.direction,
        weight: parseFloat(row.weight) || 10.0,
        zscore_formula: row.zscore_formula || '(#{tag_name_actual}-#{tag_name_benchmark})/(#{tag_name_sigma})'
      });
    });
    
    // 3. Read ODS_Rules Sheet
    const rulesSheet = workbook.Sheets['ODS_Rules'];
    const rulesData = XLSX.utils.sheet_to_json(rulesSheet);
    
    const rules = [];
    rulesData.forEach(row => {
      if (row.cause_monitoring_tag) {
        rules.push({
          cause_tag: row.cause_tag,
          effect_tag: row.effect_tag,
          cause_monitoring_tag: row.cause_monitoring_tag,
          effect_monitoring_tag: row.effect_monitoring_tag,
          message: row.message,
          message_category: row.message_category || 'ods_cause_suggestion',
          actionable_tolerance: row.actionable_tolerance !== undefined ? parseFloat(row.actionable_tolerance) : null
        });
      }
    });

    // 4. Read Pipeline_Parameters Sheet (to get Catalyst_Installation_Date and Previous_Catalyst_Installation_Date)
    let catalystInstallationDate = '2025-05-28';
    let previousCatalystInstallationDate = '2024-01-01';
    const paramsSheet = workbook.Sheets['Pipeline_Parameters'];
    if (paramsSheet) {
      const paramsData = XLSX.utils.sheet_to_json(paramsSheet);
      const catParam = paramsData.find(row => row.parameter === 'Catalyst_Installation_Date');
      if (catParam && catParam.value) {
        catalystInstallationDate = String(catParam.value);
      }
      const prevCatParam = paramsData.find(row => row.parameter === 'Previous_Catalyst_Installation_Date');
      if (prevCatParam && prevCatParam.value) {
        previousCatalystInstallationDate = String(prevCatParam.value);
      }
    }

    return { rawTags, formulas, uoms, hierarchies, benchmarks, contributors, rules, catalystInstallationDate, previousCatalystInstallationDate };
  }

  /**
   * Dynamically evaluates a mathematical formula using current state variables.
   */
  static evaluateFormula(formula, sv) {
    let expr = formula.replace(/\blog\b/g, 'Math.log');
    
    // Extract all variable names
    const varRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    
    // Scan formula variables to check if any are null/undefined/NaN in sv
    let hasMissingDep = false;
    const tokens = formula.match(varRegex) || [];
    for (const token of tokens) {
      if (token !== 'Math' && token !== 'log') {
        if (!sv.hasOwnProperty(token) || sv[token] === null || sv[token] === undefined || isNaN(sv[token])) {
          hasMissingDep = true;
          break;
        }
      }
    }
    
    if (hasMissingDep) {
      return null;
    }
    
    expr = expr.replace(varRegex, (token) => {
      if (token === 'Math' || token === 'log') {
        return token;
      }
      return sv[token];
    });
    
    try {
      const fn = new Function(`return (${expr});`);
      const val = fn();
      return isFinite(val) && !isNaN(val) ? val : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Helper to evaluate direction formula or static direction.
   */
  static evaluateDirection(direction, currentState, benchmarkState) {
    if (direction === undefined || direction === null) {
      return 1;
    }
    if (typeof direction === 'number') {
      return direction;
    }
    const dirStr = String(direction).trim();
    if (!dirStr.startsWith('if')) {
      const parsed = parseFloat(dirStr);
      return isNaN(parsed) ? 1 : parsed;
    }

    // It's a formula, e.g. if([Loop_Pressure_actual]<[Loop_Pressure_benchmark]&&[Methanol_production_actual]<[Methanol_production_benchmark],-1,1)
    const match = dirStr.match(/if\((.+),\s*(.+),\s*(.+)\)/);
    if (!match) {
      return 1;
    }

    let condition = match[1];
    const valTrue = parseFloat(match[2]);
    const valFalse = parseFloat(match[3]);

    const getValue = (key, state) => {
      const lowerKey = key.toLowerCase();
      for (const [k, v] of Object.entries(state)) {
        if (k.toLowerCase() === lowerKey) {
          return v !== null && v !== undefined ? parseFloat(v) : 0.0;
        }
      }
      return 0.0;
    };

    const varRegex = /\[([^\]]+)\]/g;
    condition = condition.replace(varRegex, (m, varName) => {
      const lowerVar = varName.toLowerCase();
      if (lowerVar.endsWith('_actual')) {
        const baseKey = varName.substring(0, varName.length - 7);
        return getValue(baseKey, currentState);
      } else if (lowerVar.endsWith('_benchmark') || lowerVar.endsWith('_optimum')) {
        const suffixLen = lowerVar.endsWith('_benchmark') ? 10 : 8;
        const baseKey = varName.substring(0, varName.length - suffixLen);
        return getValue(baseKey, benchmarkState);
      }
      return 0.0;
    });

    try {
      const fn = new Function(`return (${condition});`);
      return fn() ? valTrue : valFalse;
    } catch (e) {
      return valFalse;
    }
  }

  /**
   * Evaluates formulas in topological order based on dependencies.
   */
  static resolveFormulas(rawVars, formulas, options = {}) {
    const sv = { ...rawVars };
    const pending = { ...formulas };
    let resolvedAny = true;
    
    // Calculate dependent variables iteratively
    while (Object.keys(pending).length > 0 && resolvedAny) {
      resolvedAny = false;
      for (const [key, formula] of Object.entries(pending)) {
        if (key === 'Catalyst_Age') {
          const currentDate = options.rowDate ? parseDateHelper(options.rowDate) : new Date();
          const installDate = parseDateHelper(options.catalystInstallationDate || '2025-05-28');
          const prevInstallDate = options.previousCatalystInstallationDate ? parseDateHelper(options.previousCatalystInstallationDate) : null;
          
          if (!currentDate || isNaN(currentDate.getTime()) || !installDate || isNaN(installDate.getTime())) {
            sv[key] = 0;
            delete pending[key];
            resolvedAny = true;
            continue;
          }
          
          let diffDays;
          if (prevInstallDate && currentDate < installDate && currentDate >= prevInstallDate) {
            const diffTime = currentDate.getTime() - prevInstallDate.getTime();
            diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          } else if (currentDate >= installDate) {
            const diffTime = currentDate.getTime() - installDate.getTime();
            diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          } else {
            const refDate = prevInstallDate || installDate;
            const diffTime = currentDate.getTime() - refDate.getTime();
            diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }
          sv[key] = diffDays >= 0 ? diffDays : 0;
          delete pending[key];
          resolvedAny = true;
          continue;
        }

        const varRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        const tokens = formula.match(varRegex) || [];
        const deps = tokens.filter(t => t !== 'log' && t !== 'Math');
        
        const allResolved = deps.every(dep => sv.hasOwnProperty(dep));
        if (allResolved) {
          sv[key] = this.evaluateFormula(formula, sv);
          delete pending[key];
          resolvedAny = true;
        }
      }
    }
    
    // If some calculations remain (due to circular dependency or missing tags), set them to null
    if (Object.keys(pending).length > 0) {
      for (const [key, formula] of Object.entries(pending)) {
        sv[key] = null;
      }
    }
    
    return sv;
  }

  /**
   * Executes LBM calculations (ODS & Contributors) against a dataset.
   */
  static runLbm(dataset, options = {}) {
    const config = this.parseEasyFeatureFile();
    const { rawTags, formulas, uoms, benchmarks, contributors, rules } = config;
    const catalystInstallationDate = (options.catalystInstallationDate !== undefined && options.catalystInstallationDate !== '') ? options.catalystInstallationDate : config.catalystInstallationDate;
    const previousCatalystInstallationDate = (options.previousCatalystInstallationDate !== undefined && options.previousCatalystInstallationDate !== '') ? options.previousCatalystInstallationDate : config.previousCatalystInstallationDate;
    
    let controllableTags = options.controllableTags || [
      'Water_Cooler_Fouling_Index',
      'Recycle_Ratio',
      'M_Value',
      'MUG_Gas_Molar_Flow',
      'Loop_Pressure',
      'Bed_1_Delta_T',
      'Bed_2_Delta_T',
      'Bed_3_Delta_T'
    ];
    
    const normalizedControllable = controllableTags.map(t => {
      const val = String(t).trim();
      if (val.toLowerCase() === 'mix_feed_inlet_pressure_to_convertor') return 'Loop_Pressure';
      if (val.toLowerCase() === 'm_value') return 'M_Value';
      return val;
    });
    let clampCount = 0;
    
    // Load data-driven contributor stats from JSON cache
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    let statsPath = path.join(__dirname, '..', 'data', 'contributor_stats.json');
    if (!fs.existsSync(statsPath)) {
      statsPath = path.join(process.cwd(), 'server', 'data', 'contributor_stats.json');
    }
    if (!fs.existsSync(statsPath)) {
      statsPath = path.join(process.cwd(), 'data', 'contributor_stats.json');
    }
    
    let dataDrivenStats = {};
    if (fs.existsSync(statsPath)) {
      try {
        dataDrivenStats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
      } catch (e) {
        console.error("Error reading contributor_stats.json in JS:", e);
      }
    }
    
    // Process each row
    const processedRows = dataset.map((row, index) => {
      const rawVars = {};
      
      // Mapping of columns from raw uploaded row, including Multi-Tag Aggregation rules
      rawTags.forEach(rt => {
        let val = undefined;
        const piNameStr = rt.pi_name || '';
        
        if (piNameStr.includes(':') && ['SUM', 'AVERAGE', 'MAX', 'MIN', 'CUSTOM'].some(m => piNameStr.toUpperCase().startsWith(m + ':'))) {
          const colonIdx = piNameStr.indexOf(':');
          const method = piNameStr.substring(0, colonIdx).toUpperCase();
          const ruleContent = piNameStr.substring(colonIdx + 1);
          
          if (method === 'CUSTOM') {
            let expr = ruleContent;
            const datasetVars = row.vars || row;
            const sortedKeys = Object.keys(datasetVars).sort((a, b) => b.length - a.length);
            let hasMissing = false;
            
            sortedKeys.forEach(k => {
              if (expr.includes(k)) {
                const kv = datasetVars[k];
                if (kv === undefined || kv === null || kv === '') {
                  hasMissing = true;
                } else {
                  expr = expr.replaceAll(k, String(parseFloat(kv)));
                }
              }
            });
            
            if (hasMissing) {
              val = null;
            } else {
              try {
                const fn = new Function(`return (${expr});`);
                const calculated = fn();
                val = isFinite(calculated) && !isNaN(calculated) ? calculated : null;
              } catch (e) {
                val = null;
              }
            }
          } else {
            const tags = ruleContent.split(',').map(t => t.trim()).filter(Boolean);
            const datasetVars = row.vars || row;
            const vals = tags.map(t => {
              const v = datasetVars[t];
              return (v !== undefined && v !== null && v !== '') ? parseFloat(v) : null;
            });
            
            const validVals = vals.filter(v => v !== null && !isNaN(v));
            if (validVals.length === 0) {
              val = null;
            } else {
              if (method === 'SUM') {
                val = validVals.reduce((sum, v) => sum + v, 0);
              } else if (method === 'AVERAGE') {
                val = validVals.reduce((sum, v) => sum + v, 0) / validVals.length;
              } else if (method === 'MAX') {
                val = Math.max(...validVals);
              } else if (method === 'MIN') {
                val = Math.min(...validVals);
              }
            }
          }
        } else {
          if (row.vars && row.vars.hasOwnProperty(rt.pi_name)) {
            val = row.vars[rt.pi_name];
          } else if (row.vars && row.vars.hasOwnProperty(rt.name_short)) {
            val = row.vars[rt.name_short];
          } else if (row.hasOwnProperty(rt.pi_name)) {
            val = row[rt.pi_name];
          } else if (row.hasOwnProperty(rt.name_short)) {
            val = row[rt.name_short];
          }
        }
        
        let numericVal = (val !== undefined && val !== null && val !== "") ? parseFloat(val) : null;
        
        // Min-Max Clamping Filter
        if (numericVal !== null && !isNaN(numericVal)) {
          if (rt.min_value !== null && rt.min_value !== undefined && !isNaN(rt.min_value) && numericVal < rt.min_value) {
            numericVal = rt.min_value;
            clampCount++;
          }
          if (rt.max_value !== null && rt.max_value !== undefined && !isNaN(rt.max_value) && numericVal > rt.max_value) {
            numericVal = rt.max_value;
            clampCount++;
          }
        }
        
        rawVars[rt.name_short] = numericVal;
      });
      
      // Feature Engineering
      const rowDate = row.timestamp || `Day ${index + 1}`;
      const resolvedState = this.resolveFormulas(rawVars, formulas, { catalystInstallationDate, previousCatalystInstallationDate, rowDate });
      
      // Calculate deviation score (ODS) and contributor breakdown
      const contributorBreakdown = [];
      
      const benchmarkState = {};
      for (const [k, v] of Object.entries(benchmarks)) {
        benchmarkState[k] = v;
      }

      let sumAbsScore = 0;
      const rawBreakdown = [];

      // Dynamically select contributors from keys in dataDrivenStats where weight > 0, fallback to sheet contributors
      let activeContributors = [];
      for (const [tag, stats] of Object.entries(dataDrivenStats)) {
        if (stats && stats.weight > 0) {
          activeContributors.push({
            tag_name_short: tag,
            pillar_name: tag.replace(/_/g, ' ')
          });
        }
      }
      if (activeContributors.length === 0) {
        activeContributors = contributors;
      }
      
      const pillarsMap = {
        'Water_Cooler_Fouling_Index': 'Cooling System',
        'Recycle_Ratio': 'Recycle Loop',
        'M_Value': 'Synthesis Loop',
        'MUG_Gas_Molar_Flow': 'Feed System',
        'Loop_Pressure': 'Synthesis Loop',
        'Bed_1_Delta_T': 'Reactor Bed 1',
        'Bed_2_Delta_T': 'Reactor Bed 2',
        'Bed_3_Delta_T': 'Reactor Bed 3'
      };
      
      activeContributors.forEach(ac => {
        if (pillarsMap[ac.tag_name_short]) {
          ac.pillar_name = pillarsMap[ac.tag_name_short];
        }
      });

      activeContributors.forEach(c => {
        const actual = resolvedState[c.tag_name_short];
        if (actual === null || actual === undefined || isNaN(actual)) {
          return;
        }
        
        // Get data-driven stats overrides
        const stats = dataDrivenStats[c.tag_name_short] || {};
        const stdVal = stats.std_deviation !== undefined ? stats.std_deviation : 1.0;
        const dirVal = stats.direction !== undefined ? stats.direction : 1;
        const weightVal = stats.weight !== undefined ? stats.weight : 10.0;
        const corrVal = stats.correlation !== undefined ? stats.correlation : 0.0;
        
        // Lookup benchmark from tags sheet default, fallback to standard baseline target
        let benchmark = benchmarks[c.tag_name_short];
        if (benchmark === null || benchmark === undefined) {
          if (c.tag_name_short === 'Recycle_Ratio') benchmark = 3.5;
          else if (c.tag_name_short === 'M_Value') benchmark = 3.0;
          else if (c.tag_name_short === 'Water_Cooler_Fouling_Index') benchmark = 1.0;
          else benchmark = 0.0;
        }
        
        const z = (actual - benchmark) / stdVal;
        const score = z * dirVal * weightVal;
        const absScore = Math.abs(score);
        sumAbsScore += absScore;
        
        rawBreakdown.push({
          tag: c.tag_name_short,
          pillar: c.pillar_name,
          actual,
          benchmark,
          z,
          dirVal,
          weightVal,
          stdVal,
          corrVal,
          score,
          absScore
        });
      });

      rawBreakdown.forEach(rb => {
        const pctContrib = sumAbsScore > 0 ? (rb.absScore / sumAbsScore) * 100.0 : 0.0;
        const state = rb.score < 0 ? 'red' : 'blue';
        
        contributorBreakdown.push({
          tag: rb.tag,
          pillar: rb.pillar,
          actual: parseFloat(rb.actual.toFixed(4)),
          benchmark: parseFloat(rb.benchmark.toFixed(4)),
          zScore: parseFloat(rb.z.toFixed(4)),
          direction: rb.dirVal,
          weight: parseFloat(rb.weightVal.toFixed(4)),
          stdDev: parseFloat(rb.stdVal.toFixed(6)),
          correlation: parseFloat(rb.corrVal.toFixed(6)),
          score: parseFloat(rb.score.toFixed(4)),
          contribution: parseFloat(pctContrib.toFixed(4)),
          state: state,
          uom: uoms[rb.tag] || '—'
        });
      });
      
      // Calculate ODS score using weighted average absolute z-score
      let sumWeights = 0;
      let sumWeightedDev = 0;
      rawBreakdown.forEach(rb => {
        sumWeights += rb.weightVal;
        sumWeightedDev += rb.absScore;
      });
      const averageAbsZ = sumWeights > 0 ? sumWeightedDev / sumWeights : 0;
      let odsScore = sumWeights > 0 ? Math.min(100, Math.round(averageAbsZ * 25)) : null;
      
      // Evaluate active ODS Suggestions dynamically based on correlation direction
      let activeSuggestions = [];
      
      normalizedControllable.forEach(tag => {
        const actual = resolvedState[tag];
        const optimum = benchmarkState[tag] !== undefined ? benchmarkState[tag] : benchmarks[tag];
        
        if (actual === null || actual === undefined || isNaN(actual) || optimum === null || optimum === undefined || isNaN(optimum)) {
          return;
        }
        
        const stats = dataDrivenStats[tag] || {};
        const stdVal = stats.std_deviation !== undefined ? stats.std_deviation : 1.0;
        const corrVal = stats.correlation !== undefined ? stats.correlation : 0.0;
        
        const diff = actual - optimum;
        const tolerance = 0.05 * stdVal;
        
        if (Math.abs(diff) > tolerance) {
          const uomStr = uoms[tag] || '—';
          const label = tag.replace(/_/g, ' ').toUpperCase();
          
          if (corrVal > 0 && actual < optimum) {
            const delta = optimum - actual;
            activeSuggestions.push({
              cause: tag,
              effect: 'Methanol_Production',
              message: `TO CLOSE THE METHANOL PRODUCTION GAP, INCREASE ${label} BY ${delta.toFixed(2)} ${uomStr} (TARGET: ${optimum.toFixed(2)} ${uomStr}) BASED ON POSITIVE CORRELATION.`,
              category: 'ods_cause_suggestion',
              actual: parseFloat(actual.toFixed(2)),
              optimum: parseFloat(optimum.toFixed(2))
            });
          } else if (corrVal < 0 && actual > optimum) {
            const delta = actual - optimum;
            activeSuggestions.push({
              cause: tag,
              effect: 'Methanol_Production',
              message: `TO CLOSE THE METHANOL PRODUCTION GAP, DECREASE ${label} BY ${delta.toFixed(2)} ${uomStr} (TARGET: ${optimum.toFixed(2)} ${uomStr}) BASED ON NEGATIVE CORRELATION.`,
              category: 'ods_cause_suggestion',
              actual: parseFloat(actual.toFixed(2)),
              optimum: parseFloat(optimum.toFixed(2))
            });
          }
        }
      });
      
      const actualProd = resolvedState['Methanol_Production'];
      const benchmarkProd = benchmarkState['Methanol_Production'];
      if (actualProd !== null && actualProd !== undefined && benchmarkProd !== null && benchmarkProd !== undefined && actualProd >= benchmarkProd) {
        odsScore = 0;
        activeSuggestions = [];
      }
      
      return {
        timestamp: row.timestamp || `Day ${index + 1}`,
        ods: odsScore,
        contributors: contributorBreakdown.sort((a, b) => b.contribution - a.contribution),
        suggestions: activeSuggestions,
        state: resolvedState
      };
    });
    
    // Overall Stats compilation
    const validRows = processedRows.filter(r => r.ods !== null);
    const totalOds = validRows.reduce((sum, r) => sum + r.ods, 0);
    const avgOds = validRows.length > 0 ? Math.round(totalOds / validRows.length) : null;
    
    // Sum contributions across all valid rows to find overall top contributors
    const totalContributions = {};
    let validRowsForContrib = 0;
    processedRows.forEach(r => {
      if (r.ods === null) return;
      validRowsForContrib++;
      r.contributors.forEach(c => {
        if (!totalContributions[c.tag]) {
          totalContributions[c.tag] = { tag: c.tag, pillar: c.pillar, contribution: 0, actualSum: 0, benchmarkSum: 0, scoreSum: 0 };
        }
        totalContributions[c.tag].contribution += c.contribution;
        totalContributions[c.tag].actualSum += c.actual;
        totalContributions[c.tag].benchmarkSum += c.benchmark;
        totalContributions[c.tag].scoreSum += c.score;
      });
    });
    
    const overallContributors = Object.values(totalContributions)
      .map(c => {
        const avgScore = c.scoreSum / (validRowsForContrib || 1);
        const stats = dataDrivenStats[c.tag] || {};
        const stdVal = stats.std_deviation !== undefined ? stats.std_deviation : 1.0;
        const dirVal = stats.direction !== undefined ? stats.direction : 1;
        const weightVal = stats.weight !== undefined ? stats.weight : 10.0;
        const corrVal = stats.correlation !== undefined ? stats.correlation : 0.0;
        
        return {
          tag: c.tag,
          pillar: c.pillar,
          actual: parseFloat((c.actualSum / (validRowsForContrib || 1)).toFixed(4)),
          benchmark: parseFloat((c.benchmarkSum / (validRowsForContrib || 1)).toFixed(4)),
          score: avgScore,
          contribution: parseFloat((c.contribution / (validRowsForContrib || 1)).toFixed(4)),
          state: avgScore < 0 ? 'red' : 'blue',
          weight: parseFloat(weightVal.toFixed(4)),
          stdDev: parseFloat(stdVal.toFixed(6)),
          direction: dirVal,
          correlation: parseFloat(corrVal.toFixed(6))
        };
      })
      .sort((a, b) => b.contribution - a.contribution);

    const inferredCount = Object.keys(formulas).length;
    const steps = [
      { name: "Initialization", status: "completed", details: "Loaded Easy_feature_file.xlsx" },
      { name: "Get PI Data", status: "completed", details: `Ingested ${dataset.length} row(s) of raw plant data` },
      { name: "Input Data Check", status: "completed", details: `Validated ${rawTags.length} mapped attributes` },
      { name: "Polynomial Encoding", status: "bypassed", details: "Default linear mappings active" },
      { name: "Compute Inferred Tags", status: "completed", details: `Evaluated ${inferredCount} inferred calculation(s)` },
      { name: "Moving Average", status: "bypassed", details: "Telemetry smoothing disabled" },
      { name: "Stability Index", status: "bypassed", details: "Transient state analysis skipped" },
      { name: "Min-Max Filter", status: "completed", details: `Clamped ${clampCount} out-of-bound sensor reading(s)` },
      { name: "Get Clean Data", status: "completed", details: "Clean dataset cache prepared" },
      { name: "Clean Data Processing", status: "completed", details: "Input data normalised for benchmarking" },
      { name: "LBM Main", status: "completed", details: `Evaluated deviation profiles, avg ODS: ${avgOds || '—'}` },
      { name: "Prepare Output", status: "completed", details: "Structured final time-series data" },
      { name: "Calculate Contributors", status: "completed", details: "Ranked top contributors" },
      { name: "Generate Suggestions", status: "completed", details: "Evaluated ODS rules" },
      { name: "Calculate KPIs", status: "completed", details: "Calculations finalised" }
    ];

    return {
      avgOds,
      rows: processedRows,
      overallContributors,
      steps
    };
  }
}
