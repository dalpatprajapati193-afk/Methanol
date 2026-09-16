"use server";

import { fetchFastAPI } from "@/shared/libs/FastApiClient";
import prisma from "@/shared/libs/Prisma";
import fs from "fs";

export async function getSynthesisConfig(instanceIdStr: string) {
  try {
    const instanceId = parseInt(instanceIdStr, 10);
    if (!isNaN(instanceId)) {
      const configRow = await prisma.instanceConfiguration.findFirst({
        where: { instanceId: instanceId }
      });
      
      if (configRow && configRow.ui_config_data) {
        const dbConfig = configRow.ui_config_data as any;
        if (dbConfig.synthesis && dbConfig.rawTagMappings) {
          return dbConfig;
        }
      }
    }
    
    return await fetchFastAPI("pe-meth-synth/config", {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getSynthesisConfig Server Action Error]:", error);
    try {
      return await fetchFastAPI("pe-meth-synth/config", {
        method: "GET",
      });
    } catch (innerErr) {
      return null;
    }
  }
}

export async function getSynthesisKpis() {
  try {
    return await fetchFastAPI("pe-meth-synth/kpis", {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getSynthesisKpis Server Action Error]:", error);
    throw new Error(error.message || "Failed to load Synthesis KPIs");
  }
}

export async function saveSynthesisConfig(instanceIdStr: string, synthesis: any, rawTagMappings: any) {
  try {
    const instanceId = parseInt(instanceIdStr, 10);
    // 1. Call FastAPI to generate and save local files
    const result: any = await fetchFastAPI("pe-meth-synth/save-config", {
      method: "POST",
      body: JSON.stringify({ synthesis, rawTagMappings }),
    });
    
    if (!isNaN(instanceId) && result && result.excelPath && fs.existsSync(result.excelPath)) {
      // 2. Read the generated excel file bytes
      const excelBytes = fs.readFileSync(result.excelPath);
      
      // 3. Upsert into instance_configurations database table
      const existing = await prisma.instanceConfiguration.findFirst({
        where: { instanceId: instanceId }
      });
      
      const uiConfig = {
        synthesis,
        rawTagMappings
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
        console.warn("[saveSynthesisConfig Warning]: Failed to mirror tags to configurations.tag_registry. primary config was successfully saved to instance_configurations.", tagError);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error("[saveSynthesisConfig Server Action Error]:", error);
    throw new Error(error.message || "Failed to save Synthesis configuration");
  }
}

export async function runSynthesisLbm(date: string, settings?: any) {
  try {
    return await fetchFastAPI("pe-meth-synth/benchmark", {
      method: "POST",
      body: JSON.stringify({ date, settings }),
    });
  } catch (error: any) {
    console.error("[runSynthesisLbm Server Action Error]:", error);
    throw new Error(error.message || "Failed to execute Synthesis benchmarking");
  }
}

export async function getSynthesisTrend(date: string, range?: string, settings?: any) {
  try {
    const params = new URLSearchParams();
    params.append("date", date);
    if (range) params.append("range", range);
    if (settings) params.append("settings", JSON.stringify(settings));
    
    return await fetchFastAPI(`pe-meth-synth/trend-history?${params.toString()}`, {
      method: "GET",
    });
  } catch (error: any) {
    console.error("[getSynthesisTrend Server Action Error]:", error);
    throw new Error(error.message || "Failed to fetch Synthesis trend data");
  }
}
