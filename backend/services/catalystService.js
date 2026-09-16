import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CatalystService {
  static cachedModel = null;
  static dataRows = [];

  static initialize() {
    try {
      // The process cwd could be root or root/server
      let filePath = path.join(process.cwd(), 'MEOH back data.xlsx');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), 'server', 'MEOH back data.xlsx');
      }
      if (!fs.existsSync(filePath)) {
        console.error(`[CatalystService] Excel file not found at process.cwd(): ${process.cwd()}`);
        return;
      }

      console.log(`[CatalystService] Loading MEOH back data.xlsx for single cycle analysis (Average Delta T & 95 bar Limit)...`);
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet);
      console.log(`[CatalystService] Loaded ${rawRows.length} raw rows.`);

      const cycleStartDate = new Date("2024-01-01T00:00:00");
      const cycleEndDate = new Date("2025-09-30T00:00:00");

      const parsedRows = [];

      rawRows.forEach(row => {
        const timestampStr = row['Timestamp'];
        if (!timestampStr) return;
        const time = new Date(timestampStr);
        if (isNaN(time.getTime())) return;

        // Filter: Jan 1, 2024 to Sep 30, 2025
        if (time < cycleStartDate || time > cycleEndDate) return;

        const pressure = parseFloat(row['ar.ar2.syn.Mix_feed_inlet_pressure_1_to_R_1401']);
        const cmaFlow = parseFloat(row['ar.ar2.syn.Outlet_CMA_flow_from_V_1403']);
        
        // Bed Delta Ts
        const b1 = parseFloat(row['ar.ar2.syn.bed_1_bottom_avg']) - parseFloat(row['ar.ar2.syn.bed_1_upper_avg']);
        const b2 = parseFloat(row['ar.ar2.syn.bed_2_bottom_avg']) - parseFloat(row['ar.ar2.syn.bed_2_upper_avg']);
        const b3 = parseFloat(row['ar.ar2.syn.bed_3_bottom_avg']) - parseFloat(row['ar.ar2.syn.bed_3_upper_avg']);
        
        if (isNaN(pressure) || isNaN(cmaFlow) || isNaN(b1) || isNaN(b2) || isNaN(b3)) return;
        
        // Filter: CMA Flow > 40
        if (cmaFlow <= 40.0) return;

        // Average Bed Delta T (instead of sum)
        const avgDt = (b1 + b2 + b3) / 3.0;
        const theta = avgDt / pressure;
        if (theta <= 0) return;

        const age = Math.floor((time - cycleStartDate) / (1000 * 60 * 60 * 24));
        if (age < 0) return;

        parsedRows.push({
          time,
          timestampStr,
          pressure,
          avgDt,
          theta,
          age
        });
      });

      this.dataRows = parsedRows;
      console.log(`[CatalystService] Filtered rows for main cycle: ${parsedRows.length}`);

      // Perform Fit using daily-averaged values to remove hourly/diurnal noise
      const dailyMap = {};
      parsedRows.forEach(r => {
        const dKey = r.age;
        if (!dailyMap[dKey]) {
          dailyMap[dKey] = { sumTheta: 0, sumDt: 0, sumP: 0, count: 0 };
        }
        dailyMap[dKey].sumTheta += r.theta;
        dailyMap[dKey].sumDt += r.avgDt;
        dailyMap[dKey].sumP += r.pressure;
        dailyMap[dKey].count += 1;
      });

      const dailyRows = [];
      Object.keys(dailyMap).forEach(ageStr => {
        const age = parseInt(ageStr, 10);
        const item = dailyMap[ageStr];
        dailyRows.push({
          age,
          theta: item.sumTheta / item.count,
          totalDt: item.sumDt / item.count,
          pressure: item.sumP / item.count
        });
      });

      // Fit linear model on ln(theta) vs age
      const fit = this.linearFit(dailyRows);

      const targetDt = dailyRows.reduce((sum, r) => sum + r.totalDt, 0) / dailyRows.length;
      // EOL Age with 95 bar g: t_EOL = (1/lambda) * ln((95 * theta0) / targetDt)
      const eolAge = (1.0 / fit.lambda) * Math.log((95.0 * fit.theta0) / targetDt);

      const actualShutdownDate = new Date(Math.max(...parsedRows.map(r => r.time.getTime())));
      const actualShutdownAge = Math.floor((actualShutdownDate - cycleStartDate) / (1000 * 60 * 60 * 24));

      // Calculate initial values
      const initialPressure = targetDt / fit.theta0;

      // Actual values at shutdown
      let closestRow = null;
      let minDiff = Infinity;
      parsedRows.forEach(r => {
        const diff = Math.abs(r.time - actualShutdownDate);
        if (diff < minDiff) {
          minDiff = diff;
          closestRow = r;
        }
      });

      const actualDtAtShutdown = closestRow ? closestRow.avgDt : targetDt;
      const actualPressureAtShutdown = closestRow ? closestRow.pressure : 90.0;
      const actualThetaAtShutdown = closestRow ? closestRow.theta : (actualDtAtShutdown / actualPressureAtShutdown);

      this.cachedModel = {
        theta0: fit.theta0,
        lambda: fit.lambda,
        targetDt: targetDt,
        eolAge: eolAge,
        cycleStartDateStr: "2024-01-01",
        actualShutdownDateStr: actualShutdownDate.toISOString().split('T')[0],
        actualShutdownAge: actualShutdownAge,
        initialPressure,
        actualDtAtShutdown,
        actualPressureAtShutdown,
        actualThetaAtShutdown
      };

      console.log(`[CatalystService] Model fit complete for single cycle (Average DT & 95 bar): theta0=${fit.theta0.toFixed(6)}, lambda=${fit.lambda.toFixed(8)}, EOL Age=${eolAge.toFixed(1)}`);
    } catch (err) {
      console.error(`[CatalystService] Error initializing model:`, err);
    }
  }

  static linearFit(rows) {
    const N = rows.length;
    if (N === 0) return { theta0: 0.37, lambda: 0.0001 };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    rows.forEach(r => {
      const x = r.age;
      const y = Math.log(r.theta);
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const denominator = N * sumXX - sumX * sumX;
    if (denominator === 0) {
      return { theta0: 0.37, lambda: 0.0001 };
    }

    const slope = (N * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / N;

    const lambda = -slope;
    const theta0 = Math.exp(intercept);

    return { theta0, lambda };
  }

  static getMetrics(selectedDateStr) {
    if (!this.cachedModel) {
      this.initialize();
    }
    if (!this.cachedModel) return null;

    let selectedDate;
    if (selectedDateStr) {
      selectedDate = new Date(selectedDateStr);
    }
    
    const cycleStartDate = new Date("2024-01-01T00:00:00");
    const cycleEndDate = new Date("2025-09-30T00:00:00");

    if (!selectedDate || isNaN(selectedDate.getTime())) {
      selectedDate = new Date(this.cachedModel.actualShutdownDateStr);
    }

    // Clamp selected date to the cycle range
    if (selectedDate < cycleStartDate) {
      selectedDate = cycleStartDate;
    } else if (selectedDate > cycleEndDate) {
      selectedDate = cycleEndDate;
    }

    const age = Math.floor((selectedDate - cycleStartDate) / (1000 * 60 * 60 * 24));
    
    // Find closest actual row to get current Delta T and Loop Pressure
    let closestRow = null;
    let minDiff = Infinity;
    this.dataRows.forEach(r => {
      const diff = Math.abs(r.time - selectedDate);
      if (diff < minDiff) {
        minDiff = diff;
        closestRow = r;
      }
    });

    const actualDt = closestRow ? closestRow.avgDt : this.cachedModel.targetDt;
    const actualPressure = closestRow ? closestRow.pressure : 85.0;
    const actualTheta = closestRow ? closestRow.theta : (actualDt / actualPressure);

    const remainingLife = this.cachedModel.eolAge - age;
    const eolTime = new Date(cycleStartDate.getTime() + this.cachedModel.eolAge * 24 * 60 * 60 * 1000);

    return {
      cycleName: "Jan 2024 - Sep 2025 Run",
      selectedDateStr: selectedDate.toISOString().split('T')[0],
      age: Math.max(0, age),
      theta0: this.cachedModel.theta0,
      lambda: this.cachedModel.lambda,
      targetDt: this.cachedModel.targetDt,
      eolAge: this.cachedModel.eolAge,
      remainingLife: Math.max(0, remainingLife),
      estimatedEolDate: eolTime.toISOString().split('T')[0],
      actualDt,
      actualPressure,
      actualTheta,
      cachedMeta: this.cachedModel
    };
  }
}
