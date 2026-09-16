/**
 * KPI Engine - Plant Optimizer & Decoupled Synthesis Suite Calculations
 * Decoupled from client-side runtime for robust, scalable full-stack execution.
 */

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

export class KPICalculator {
  // Constant molecular weights for composition normalization
  static MW_COMPONENTS = {
    h2: 2.016,
    co: 28.010,
    co2: 44.010,
    ch4: 16.043,
    n2: 28.014,
    ar: 39.948,
    h2o: 18.015,
    ch3oh: 32.042
  };

  /**
   * Evaluates standard KPI formulas on a single row of sensor values (vars).
   * @param {Object} sensorValues - Key-value pair of raw plant sensor values.
   * @param {Object} options - Optional calculation parameters.
   * @returns {Object} - Result of calculated KPIs with value, status, error, uom, and hierarchy details.
   */
  static calculateRow(sensorValues, options = {}) {
    const sv = { ...sensorValues };
    const kpiResults = {};

    // Mandatory KPI names classification
    const mandatoryKpiNames = new Set([
      'Methanol_Production', 'Recycle_Ratio', 'M_Value', 'Carbon_Yield',
      'Bed_1_Delta_T', 'Bed_2_Delta_T', 'Bed_3_Delta_T', 'Bed_4_Delta_T', 'Bed_5_Delta_T',
      'Water_Cooler_Heat_Duty', 'Water_Cooler_Fouling_Index', 'Water_Cooler_Fouling_Index_Ratio',
      'Catalyst_Age'
    ]);

    // KPI engine configurations containing sequential and dependent execution formulas
    const kpiConfigs = [
      // Methanol Separator
      {
        name: 'CMA_Density_kgm3',
        uom: 'kg/m³',
        hier: 'Methanol Separator',
        fn: s => s.CMA_Density * 1000
      },
      {
        name: 'Methanol_Molar_Flow',
        uom: 'kmol/hr',
        hier: 'Methanol Separator',
        fn: s => (s.CMA_Flow * s.CMA_Density_kgm3 * s.Methanol_Purity_In_CMA) / 32.04
      },
      {
        name: 'Methanol_Production',
        uom: 'MT/Day',
        hier: 'Methanol Separator',
        fn: s => s.CMA_Flow * s.CMA_Density_kgm3 * s.Methanol_Purity_In_CMA * 24 / 1000
      },
      // Circulation Loop
      {
        name: 'Recycle_Ratio',
        uom: 'ratio',
        hier: 'Circulation Loop',
        fn: s => s.Recycle_Gas_Molar_Flow / s.MUG_Gas_Molar_Flow
      },
      // MUG Gas
      {
        name: 'MUG_Gas_Molecular_Weight',
        uom: 'g/mol',
        hier: 'System',
        fn: s => {
          const _co  = s.System_MUG_Gas_CO_Mole_Concentration  || 0;
          const _co2 = s.System_MUG_Gas_CO2_Mole_Concentration || 0;
          const _h2  = s.System_MUG_Gas_H2_Mole_Concentration  || 0;
          const _ch4 = s.System_MUG_Gas_CH4_Mole_Concentration || 0;
          const _n2  = s.System_MUG_Gas_N2_Mole_Concentration  || 0;
          const _h2o = s.System_MUG_Gas_H2O_Mole_Concentration || 0;
          
          const _sumMW = (_co * 28.01) + (_co2 * 44.01) + (_h2 * 2.016) + (_ch4 * 16.04) + (_n2 * 28.013) + (_h2o * 18.015);
          const _sumY  = _co + _co2 + _h2 + _ch4 + _n2 + _h2o;
          
          if (_sumY <= 0) throw new Error('MUG mol% sum is zero');
          return _sumMW / _sumY;
        }
      },
      {
        name: 'MUG_Gas_Mass_Flow',
        uom: 'kg/h',
        hier: 'System',
        fn: s => s.MUG_Gas_Molecular_Weight * s.MUG_Gas_Molar_Flow * 44.14
      },
      // Recycle Gas
      {
        name: 'Recycle_Gas_Molecular_Weight',
        uom: 'g/mol',
        hier: 'Recycle Gas Compressor',
        fn: s => {
          const _co    = s.Recycle_Gas_CO_Mole_Concentration     || 0;
          const _co2   = s.Recycle_Gas_CO2_Mole_Concentration    || 0;
          const _h2    = s.Recycle_Gas_H2_Mole_Concentration     || 0;
          const _ch4   = s.Recycle_Gas_CH4_Mole_Concentration    || 0;
          const _n2    = s.Recycle_Gas_N2_Mole_Concentration     || 0;
          const _h2o   = s.Recycle_Gas_H2O_Mole_Concentration    || 0;
          const _ch3oh = s.Recycle_Gas_CH3OH_Mole_Concentration  || 0;
          
          const _sumMW = (_co * 28.01) + (_co2 * 44.01) + (_h2 * 2.016) + (_ch4 * 16.04) + (_n2 * 28.013) + (_h2o * 18.015) + (_ch3oh * 32.04);
          const _sumY  = _co + _co2 + _h2 + _ch4 + _n2 + _h2o + _ch3oh;
          
          if (_sumY <= 0) throw new Error('Recycle mol% sum is zero');
          return _sumMW / _sumY;
        }
      },
      {
        name: 'Recycle_Gas_Mass_Flow',
        uom: 'kg/h',
        hier: 'Recycle Gas Compressor',
        fn: s => s.Recycle_Gas_Molecular_Weight * s.Recycle_Gas_Molar_Flow * 44.14
      },
      // Convertor Feed
      {
        name: 'Convertor_Feed_Mass_Flow',
        uom: 'kg/h',
        hier: 'Convertor Preheater',
        fn: s => s.MUG_Gas_Mass_Flow + s.Recycle_Gas_Mass_Flow
      },
      {
        name: 'Convertor_Effluent_Mass_Flow_Calc',
        uom: 'kg/h',
        hier: 'Convertor Preheater',
        fn: s => s.Convertor_Feed_Mass_Flow * 1
      },
      // Methanol Synthesis
      {
        name: 'M_Value',
        uom: 'ratio',
        hier: 'Methanol Synthesis',
        fn: s => (s.System_MUG_Gas_H2_Mole_Concentration - s.System_MUG_Gas_CO2_Mole_Concentration) / 
                 (s.System_MUG_Gas_CO_Mole_Concentration + s.System_MUG_Gas_CO2_Mole_Concentration)
      },
      {
        name: 'CO_Makeup_Molar_Flow',
        uom: 'kmol/hr',
        hier: 'Methanol Synthesis',
        fn: s => (s.MUG_Gas_Molar_Flow * s.System_MUG_Gas_CO_Mole_Concentration * 44.68) / 100
      },
      {
        name: 'CO2_Makeup_Molar_Flow',
        uom: 'kmol/hr',
        hier: 'Methanol Synthesis',
        fn: s => (s.MUG_Gas_Molar_Flow * s.System_MUG_Gas_CO2_Mole_Concentration * 44.68) / 100
      },
      {
        name: 'CO_Recycle_Molar_Flow',
        uom: 'kmol/hr',
        hier: 'Methanol Synthesis',
        fn: s => (s.Recycle_Gas_Molar_Flow * s.Recycle_Gas_CO_Mole_Concentration * 44.68) / 100
      },
      {
        name: 'CO2_Recycle_Molar_Flow',
        uom: 'kmol/hr',
        hier: 'Methanol Synthesis',
        fn: s => (s.Recycle_Gas_Molar_Flow * s.Recycle_Gas_CO2_Mole_Concentration * 44.68) / 100
      },
      {
        name: 'Carbon_Yield',
        uom: '%',
        hier: 'Methanol Synthesis',
        fn: s => (s.Methanol_Molar_Flow / (s.CO_Makeup_Molar_Flow + s.CO2_Makeup_Molar_Flow)) * 100
      },
      {
        name: 'Catalyst_Age',
        uom: 'Days',
        hier: 'Methanol Synthesis',
        fn: (s, opts) => {
          const currentDate = opts && opts.rowDate ? parseDateHelper(opts.rowDate) : new Date();
          const installDate = parseDateHelper((opts && opts.catalystInstallationDate) || '2025-05-28');
          const prevInstallDate = opts && opts.previousCatalystInstallationDate ? parseDateHelper(opts.previousCatalystInstallationDate) : null;
          
          if (!currentDate || isNaN(currentDate.getTime()) || !installDate || isNaN(installDate.getTime())) {
            return 0;
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
          return diffDays >= 0 ? diffDays : 0;
        }
      },
      // Reactor Beds
      {
        name: 'Bed_1_Delta_T',
        uom: '°C',
        hier: 'Methanol Synthesis Reactor',
        fn: s => s.Convertor_Bed_1_Outlet_Temperature - s.Convertor_Bed_1_Inlet_Temperature
      },
      {
        name: 'Bed_2_Delta_T',
        uom: '°C',
        hier: 'Methanol Synthesis Reactor',
        fn: s => s.Convertor_Bed_2_Outlet_Temperature - s.Convertor_Bed_2_Inlet_Temperature
      },
      {
        name: 'Bed_3_Delta_T',
        uom: '°C',
        hier: 'Methanol Synthesis Reactor',
        fn: s => s.Convertor_Bed_3_Outlet_Temperature - s.Convertor_Bed_3_Inlet_Temperature
      },
      {
        name: 'Bed_4_Delta_T',
        uom: '°C',
        hier: 'Methanol Synthesis Reactor',
        fn: s => s.Convertor_Bed_4_Outlet_Temperature - s.Convertor_Bed_4_Inlet_Temperature
      },
      {
        name: 'Bed_5_Delta_T',
        uom: '°C',
        hier: 'Methanol Synthesis Reactor',
        fn: s => s.Convertor_Bed_5_Outlet_Temperature - s.Convertor_Bed_5_Inlet_Temperature
      },
      // Water Cooler Chain
      {
        name: 'Water_Cooler_Heat_Duty',
        uom: 'Gcal/hr',
        hier: 'Water cooler',
        fn: s => (s.Convertor_Effluent_Mass_Flow_Calc * 0.97 * (s.Convertor_Effluent_Cooler_Inlet_Temperature - s.Convertor_Effluent_Cooler_Outlet_Temperature) + 
                  s.Convertor_Effluent_Mass_Flow_Calc * 0.07 * 400) / 1000000
      },
      {
        name: 'Ccw_Outlet_Temperature',
        uom: '°C',
        hier: 'Water cooler',
        fn: s => s.Ccw_Inlet_Temperature + (s.Water_Cooler_Heat_Duty * 1000000) / (s.Ccw_Flow * 1.0)
      },
      {
        name: 'Water_Cooler_LMTD',
        uom: '°C',
        hier: 'Water cooler',
        fn: s => {
          const dT1 = s.Convertor_Effluent_Cooler_Inlet_Temperature - s.Ccw_Outlet_Temperature;
          const dT2 = s.Convertor_Effluent_Cooler_Outlet_Temperature - s.Ccw_Inlet_Temperature;
          if (dT1 <= 0 || dT2 <= 0 || dT1 === dT2) throw new Error('LMTD domain error');
          return (dT1 - dT2) / Math.log(dT1 / dT2);
        }
      },
      {
        name: 'Water_Cooler_Fouling_Index',
        uom: '°C/(Gcal/hr)',
        hier: 'Water cooler',
        fn: s => s.Water_Cooler_LMTD / s.Water_Cooler_Heat_Duty
      },
      {
        name: 'Water_Cooler_Fouling_Index_Ratio',
        uom: '%',
        hier: 'Water cooler',
        fn: s => ((s.Water_Cooler_Fouling_Index - 0.4) / (3 - 0.4)) * 100
      }
    ];

    // Determine if Methanol Production is overridden by the user setting it as a PI Tag
    const meohProdIsPI = options.meohProdIsPI || false;

    kpiConfigs.forEach(kpi => {
      // If Methanol_Production source is a PI Tag, we skip calculating it
      if (kpi.name === 'Methanol_Production' && meohProdIsPI) {
        kpiResults[kpi.name] = {
          value: null,
          status: 'pi_tag',
          uom: kpi.uom,
          hier: kpi.hier,
          error: 'Source set to PI Tag — value read from live sensor, not calculated'
        };
        return;
      }

      try {
        const val = kpi.fn(sv, options);
        if (!isFinite(val)) throw new Error('Non-finite result');
        
        sv[kpi.name] = val; // Store back in state for downstream formula dependency resolution
        kpiResults[kpi.name] = {
          value: val,
          status: 'ok',
          uom: kpi.uom,
          hier: kpi.hier
        };
      } catch (e) {
        kpiResults[kpi.name] = {
          value: null,
          status: 'fail',
          uom: kpi.uom,
          hier: kpi.hier,
          error: e.message
        };
      }
    });

    return kpiResults;
  }

  /**
   * Processes batch rows of plant Operational Logs and evaluates plant performance metrics.
   * @param {Array<Object>} rows - Array of logs with timestamp and vars properties.
   * @param {Object} options - Custom options (e.g. meohProdIsPI flags).
   * @returns {Array<Object>} - Calculated batch details.
   */
  static calculateBatch(rows, options = {}) {
    return rows.map(row => {
      const rowOptions = { ...options, rowDate: row.timestamp };
      const kpis = this.calculateRow(row.vars, rowOptions);
      return {
        timestamp: row.timestamp,
        kpis
      };
    });
  }
}
