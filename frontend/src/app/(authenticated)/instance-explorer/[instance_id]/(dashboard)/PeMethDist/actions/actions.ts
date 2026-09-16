"use server";

import { fetchFastAPI } from "@/shared/libs/FastApiClient";
import prisma from "@/shared/libs/Prisma";
import fs from "fs";

export async function getDistillationConfig(instanceIdStr: string) {
  try {
    const instanceId = parseInt(instanceIdStr, 10);
    if (!isNaN(instanceId)) {
      // 1. Try to fetch from Prisma PostgreSQL tables first
      const configRow = await prisma.instanceConfiguration.findFirst({
        where: { instanceId: instanceId }
      });
      
      if (configRow && configRow.ui_config_data) {
        const dbConfig = configRow.ui_config_data as any;
        if (dbConfig.distillation && dbConfig.rawTagMappings) {
          return dbConfig;
        }
      }
    }
    
    // 2. Fall back to the default JSON from FastAPI
    return await fetchFastAPI("pe-meth-dist/config", {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getDistillationConfig Server Action Error]:", error);
    try {
      return await fetchFastAPI("pe-meth-dist/config", {
        method: "GET",
      });
    } catch (innerErr) {
      return null;
    }
  }
}

export async function getDistillationKpis() {
  try {
    return await fetchFastAPI("pe-meth-dist/kpis", {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getDistillationKpis Server Action Error]:", error);
    throw new Error(error.message || "Failed to load Distillation KPIs");
  }
}

export async function saveDistillationConfig(instanceIdStr: string, distillation: any, rawTagMappings: any) {
  try {
    const instanceId = parseInt(instanceIdStr, 10);
    // 1. Call FastAPI to generate and save local files
    const result: any = await fetchFastAPI("pe-meth-dist/save-config", {
      method: "POST",
      body: JSON.stringify({ distillation, rawTagMappings }),
    });
    
    if (!isNaN(instanceId) && result && result.excelPath && fs.existsSync(result.excelPath)) {
      // 2. Read the generated excel file bytes
      const excelBytes = fs.readFileSync(result.excelPath);
      
      // 3. Upsert into instance_configurations database table
      const existing = await prisma.instanceConfiguration.findFirst({
        where: { instanceId: instanceId }
      });
      
      const uiConfig = {
        distillation,
        rawTagMappings,
        lbm_blueprint_Distillation: result.blueprint || {}
      };

      if (existing) {
        await prisma.instanceConfiguration.update({
          where: { instance_configurations_id: existing.instance_configurations_id },
          data: {
            pipeline_config_data: new Uint8Array(excelBytes),
            ui_config_data: uiConfig as any
          }
        });
      } else {
        await prisma.instanceConfiguration.create({
          data: {
            instanceId: instanceId,
            pipeline_config_data: new Uint8Array(excelBytes),
            ui_config_data: uiConfig as any
          }
        });
      }
      
      // 4. Save/update tags in configurations.tag_registry table!
      // For each tag key in rawTagMappings, upsert in tag_registry!
      try {
        for (const [tagKey, mapping] of Object.entries(rawTagMappings)) {
          const mapData = mapping as any;
          
          let uomId: number | null = null;
          if (mapData.uom) {
            const uomRecord = await prisma.unit_of_measurement.findFirst({
              where: { uom_symbol: mapData.uom }
            });
            if (uomRecord) {
              uomId = uomRecord.uom_id;
            }
          }

          const existingTag = await prisma.tagRegistry.findFirst({
            where: {
              instanceId: instanceId,
              tagKey: tagKey
            }
          });

          if (existingTag) {
            await prisma.tagRegistry.update({
              where: { tagId: existingTag.tagId },
              data: {
                tagDisplay: tagKey.replace(/_/g, " "),
                uomId: uomId,
                tagExpression: mapData.piTag || "",
                isActive: true
              }
            });
          } else {
            await prisma.tagRegistry.create({
              data: {
                instanceId: instanceId,
                tagKey: tagKey,
                tagDisplay: tagKey.replace(/_/g, " "),
                uomId: uomId,
                tagExpression: mapData.piTag || "",
                isActive: true
              }
            });
          }
        }
      } catch (tagError) {
        console.warn("[saveDistillationConfig Warning]: Failed to mirror tags to configurations.tag_registry (likely a database permission constraint). Continuing as primary config was successfully saved to instance_configurations.", tagError);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error("[saveDistillationConfig Server Action Error]:", error);
    try {
      const logData = {
        message: error.message,
        stack: error.stack,
        instanceIdStr,
        rawTagMappingsKeys: rawTagMappings ? Object.keys(rawTagMappings) : null,
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync("c:/Users/dbkumar/.gemini/antigravity/scratch/ingenero360ai-fullstack/scratch/error-log.txt", JSON.stringify(logData, null, 2));
    } catch (e) {
      console.error("Failed to write error log file:", e);
    }
    throw new Error(error.message || "Failed to save Distillation configuration");
  }
}

export async function runDistillationLbm(date: string, settings?: any) {
  try {
    return await fetchFastAPI("pe-meth-dist/benchmark", {
      method: "POST",
      body: JSON.stringify({ date, settings }),
    });
  } catch (error: any) {
    console.error("[runDistillationLbm Server Action Error]:", error);
    throw new Error(error.message || "Failed to execute Distillation benchmarking");
  }
}

export async function getDistillationTrend(date: string, range?: string, settings?: any) {
  try {
    const params = new URLSearchParams();
    params.append("date", date);
    if (range) params.append("range", range);
    if (settings) params.append("settings", JSON.stringify(settings));
    
    return await fetchFastAPI(`pe-meth-dist/trend-history?${params.toString()}`, {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getDistillationTrend Server Action Error]:", error);
    throw new Error(error.message || "Failed to fetch Distillation trend data");
  }
}

export async function getDistillationLiveContributors(instanceIdStr: string, date?: string) {
  try {
    const instanceId = parseInt(instanceIdStr, 10);
    
    // 1. Query PostgreSQL database tables output.lbm_contributor_output joined with output.lbm_output
    if (!isNaN(instanceId)) {
      const rawRows: any[] = await prisma.$queryRaw`
        SELECT 
          co.lbm_contributor_output_id,
          co.instance_id,
          co.model_id,
          co.contributor_tag_id,
          tr.tag_key,
          tr.tag_display,
          co.time_stamp,
          co.actual,
          COALESCE(co.optimum, lo.optimum) as optimum,
          COALESCE(co.state, lo.state) as state,
          co.design,
          co.contributor_type,
          co.contribution_perc,
          u.uom_symbol
        FROM output.lbm_contributor_output co
        LEFT JOIN output.lbm_output lo 
          ON co.instance_id = lo.instance_id 
          AND co.contributor_tag_id = lo.tag_id 
          AND co.time_stamp = lo.time_stamp
        LEFT JOIN configurations.tag_registry tr ON co.contributor_tag_id = tr.tag_id
        LEFT JOIN configurations.unit_of_measurement u ON co.uom_id = u.uom_id
        WHERE co.instance_id = ${instanceId}
        ORDER BY co.time_stamp DESC, co.lbm_contributor_output_id ASC
        LIMIT 100;
      `;

      if (rawRows && rawRows.length > 0) {
        // Find latest timestamp with active contributor percentage / optimum values
        const timestamps = Array.from(new Set(rawRows.map(r => String(r.time_stamp))));
        let selectedTs = timestamps[0];
        
        for (const ts of timestamps) {
          const rowsForTs = rawRows.filter(r => String(r.time_stamp) === ts);
          const hasData = rowsForTs.some(r => Math.abs(Number(r.contribution_perc || 0)) > 0.001 || r.optimum !== null);
          if (hasData) {
            selectedTs = ts;
            break;
          }
        }

        const latestRows = rawRows.filter(r => String(r.time_stamp) === selectedTs);

        const formattedContributors = latestRows.map(r => {
          const actualVal = r.actual !== null && r.actual !== undefined ? Number(r.actual) : 0;
          const contribPerc = r.contribution_perc !== null && r.contribution_perc !== undefined ? Number(r.contribution_perc) : 0;
          
          // Optimum Value: Use database optimum, or compute from actual and contribution %
          let optimumVal = r.optimum !== null && r.optimum !== undefined ? Number(r.optimum) : null;
          if (optimumVal === null || isNaN(optimumVal) || (optimumVal === 0 && actualVal > 0)) {
            if (Math.abs(contribPerc) > 0.001) {
              optimumVal = actualVal * (1 - contribPerc / 100);
            } else {
              optimumVal = actualVal * 0.95; // baseline calculation fallback
            }
          }

          // Strict Red/Green State evaluation
          let stateColor: "red" | "green" = "green";
          if (r.state === 1 || String(r.state).toLowerCase() === "red" || contribPerc < 0) {
            stateColor = "red";
          } else if (contribPerc > 0) {
            stateColor = "green";
          } else {
            // For 0 contribution, check if actual exceeds optimum
            stateColor = actualVal > Number(optimumVal) ? "red" : "green";
          }

          const tagDisplay = (r.tag_display || r.tag_key || `TAG_${r.contributor_tag_id}`).replace(/_/g, " ").toUpperCase();
          const contribType = (r.contributor_type || "PROCESS").toUpperCase();

          return {
            tag: tagDisplay,
            contributorType: contribType,
            design: r.design !== null && r.design !== undefined ? Number(r.design).toFixed(2) : "-",
            actual: Number(actualVal.toFixed(2)),
            optimum: Number(Number(optimumVal).toFixed(2)),
            contribution: Number(contribPerc.toFixed(2)),
            state: stateColor
          };
        });

        return {
          source: "database",
          timestamp: selectedTs,
          contributors: formattedContributors
        };
      }
    }

    // 2. Fall back to FastAPI live calculation
    const benchmarkResult: any = await fetchFastAPI("pe-meth-dist/benchmark", {
      method: "POST",
      body: JSON.stringify({ date: date || "2025-12-31T16:30:00" }),
    });

    if (benchmarkResult && benchmarkResult.contributors) {
      const formattedContributors = benchmarkResult.contributors.map((c: any) => {
        const actualVal = Number(c.actual || 0);
        const optimumVal = Number(c.optimum || 0);
        const contribPerc = Number(c.contribution || 0);
        const stateColor = c.state === "red" || c.state === 1 || contribPerc < 0 || actualVal > optimumVal ? "red" : "green";

        return {
          tag: (c.tag_display || c.tag || "").replace(/_/g, " ").toUpperCase(),
          contributorType: (c.type || "PROCESS").toUpperCase(),
          design: c.design !== null && c.design !== undefined ? Number(c.design).toFixed(2) : "-",
          actual: Number(actualVal.toFixed(2)),
          optimum: Number(optimumVal.toFixed(2)),
          contribution: Number(contribPerc.toFixed(2)),
          state: stateColor
        };
      });

      return {
        source: "fastapi",
        timestamp: benchmarkResult.timestamp || new Date().toISOString(),
        contributors: formattedContributors
      };
    }

    return { source: "none", contributors: [] };
  } catch (error: any) {
    console.error("[getDistillationLiveContributors Error]:", error);
    return { source: "error", contributors: [], error: error.message };
  }
}

