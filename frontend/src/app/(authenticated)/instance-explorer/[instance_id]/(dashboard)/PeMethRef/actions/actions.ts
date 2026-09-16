"use server";

import { fetchFastAPI } from "@/shared/libs/FastApiClient";
import prisma from "@/shared/libs/Prisma";
import fs from "fs";

export async function getReformerConfig(instanceIdStr: string) {
  try {
    const instanceId = parseInt(instanceIdStr, 10);
    if (!isNaN(instanceId)) {
      const configRow = await prisma.instanceConfiguration.findFirst({
        where: { instanceId: instanceId }
      });
      
      if (configRow && configRow.ui_config_data) {
        const dbConfig = configRow.ui_config_data as any;
        if (dbConfig.reformer && dbConfig.rawTagMappings) {
          return dbConfig;
        }
      }
    }
    
    return await fetchFastAPI("pe-meth-ref/config", {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getReformerConfig Server Action Error]:", error);
    try {
      return await fetchFastAPI("pe-meth-ref/config", {
        method: "GET",
      });
    } catch (innerErr) {
      return null;
    }
  }
}

export async function getReformerKpis() {
  try {
    return await fetchFastAPI("pe-meth-ref/kpis", {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getReformerKpis Server Action Error]:", error);
    throw new Error(error.message || "Failed to load Reformer KPIs");
  }
}

export async function saveReformerConfig(instanceIdStr: string, reformer: any, rawTagMappings: any) {
  try {
    const instanceId = parseInt(instanceIdStr, 10);
    // 1. Call FastAPI to generate and save local files
    const result: any = await fetchFastAPI("pe-meth-ref/save-config", {
      method: "POST",
      body: JSON.stringify({ reformer, rawTagMappings }),
    });
    
    if (!isNaN(instanceId) && result && result.excelPath && fs.existsSync(result.excelPath)) {
      // 2. Read the generated excel file bytes
      const excelBytes = fs.readFileSync(result.excelPath);
      
      // 3. Upsert into instance_configurations database table
      const existing = await prisma.instanceConfiguration.findFirst({
        where: { instanceId: instanceId }
      });
      
      const uiConfig = {
        reformer,
        rawTagMappings,
        lbm_blueprint_Reformer: result.blueprint || {}
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
        console.warn("[saveReformerConfig Warning]: Failed to mirror tags to configurations.tag_registry. primary config was successfully saved to instance_configurations.", tagError);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error("[saveReformerConfig Server Action Error]:", error);
    throw new Error(error.message || "Failed to save Reformer configuration");
  }
}

export async function runReformerLbm(date: string, settings?: any) {
  try {
    return await fetchFastAPI("pe-meth-ref/benchmark", {
      method: "POST",
      body: JSON.stringify({ date, settings }),
    });
  } catch (error: any) {
    console.error("[runReformerLbm Server Action Error]:", error);
    throw new Error(error.message || "Failed to execute Reformer benchmarking");
  }
}

export async function getReformerTrend(date: string, range?: string, settings?: any) {
  try {
    const params = new URLSearchParams();
    params.append("date", date);
    if (range) params.append("range", range);
    if (settings) params.append("settings", JSON.stringify(settings));
    
    return await fetchFastAPI(`pe-meth-ref/trend-history?${params.toString()}`, {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getReformerTrend Server Action Error]:", error);
    throw new Error(error.message || "Failed to fetch Reformer trend data");
  }
}
